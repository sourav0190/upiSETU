package com.demo.upimesh;

import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.crypto.ServerKeyHolder;
import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.PaymentInstruction;
import com.demo.upimesh.service.BridgeIngestionService;
import com.demo.upimesh.service.DemoService;
import com.demo.upimesh.service.IdempotencyService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Validates Stage 2 requirements:
 * 1. Frontend-Backend canonical PaymentInstruction contract and Jackson alias compatibility.
 * 2. Elimination of automatic account creation and balance minting during settlement.
 * 3. Strict server-side enforcement of business rules (₹500 limit, currency scale, self-transfer, TTL).
 * 4. Graceful handling of malformed or invalid packets without NullPointerExceptions.
 */
@SpringBootTest
class ContractAndSecurityValidationTest {

    @Autowired private BridgeIngestionService bridge;
    @Autowired private HybridCryptoService crypto;
    @Autowired private ServerKeyHolder serverKey;
    @Autowired private IdempotencyService idempotency;
    @Autowired private AccountRepository accounts;
    @Autowired private DemoService demo;
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    void resetState() throws Exception {
        idempotency.clear();
        accounts.deleteAll();
        String defaultPinHash = demo.sha256Hex("1234");
        accounts.save(new Account("alice@demo", "Alice Sharma", new BigDecimal("1000.00"), defaultPinHash));
        accounts.save(new Account("bob@demo", "Bob Verma", new BigDecimal("500.00"), defaultPinHash));
    }

    @Test
    void testFrontendPayloadFormatWithAliasesDeserializesAndSettles() throws Exception {
        // Construct JSON using frontend property names ("timestamp" instead of "signedAt", "pin" instead of "pinHash")
        String frontendJson = "{\n" +
                "  \"senderVpa\": \"alice@demo\",\n" +
                "  \"receiverVpa\": \"bob@demo\",\n" +
                "  \"amount\": 150.00,\n" +
                "  \"nonce\": \"" + UUID.randomUUID() + "\",\n" +
                "  \"pin\": \"" + demo.sha256Hex("1234") + "\",\n" +
                "  \"note\": \"Chai and Samosa\",\n" +
                "  \"timestamp\": " + Instant.now().toEpochMilli() + "\n" +
                "}";

        PaymentInstruction instruction = objectMapper.readValue(frontendJson, PaymentInstruction.class);
        assertNotNull(instruction.getSignedAt(), "signedAt should be populated from timestamp alias");
        assertNotNull(instruction.getPinHash(), "pinHash should be populated from pin alias");

        String ct = crypto.encrypt(instruction, serverKey.getPublicKey());
        MeshPacket packet = new MeshPacket();
        packet.setPacketId("pkt_" + UUID.randomUUID());
        packet.setTtl(5);
        packet.setCreatedAt(Instant.now().toEpochMilli());
        packet.setCiphertext(ct);

        BridgeIngestionService.IngestResult result = bridge.ingest(packet, "bridge-frontend", 1);
        assertEquals("SETTLED", result.outcome());
    }

    @Test
    void testUnknownSenderIsRejectedWithoutCreatingAccountOrMintingBalance() throws Exception {
        String unknownVpa = "eve_stranger_" + UUID.randomUUID().toString().substring(0, 6) + "@demo";
        assertFalse(accounts.existsById(unknownVpa), "Sender account must not exist before test");

        PaymentInstruction instruction = new PaymentInstruction(
                unknownVpa, "bob@demo", new BigDecimal("50.00"),
                demo.sha256Hex("1234"), UUID.randomUUID().toString(), Instant.now().toEpochMilli()
        );

        String ct = crypto.encrypt(instruction, serverKey.getPublicKey());
        MeshPacket packet = new MeshPacket();
        packet.setPacketId("pkt_unknown_" + UUID.randomUUID());
        packet.setTtl(5);
        packet.setCreatedAt(Instant.now().toEpochMilli());
        packet.setCiphertext(ct);

        BridgeIngestionService.IngestResult result = bridge.ingest(packet, "bridge-test", 1);
        assertEquals("REJECTED", result.outcome());
        assertEquals("UNKNOWN_SENDER", result.reason());

        // Crucial: The unknown sender account must NOT have been auto-created with ₹5,000!
        assertFalse(accounts.existsById(unknownVpa), "Settlement must never automatically mint or create unknown accounts");
    }

    @Test
    void testUnknownReceiverIsRejected() throws Exception {
        String unknownReceiver = "nonexistent_merchant@demo";
        PaymentInstruction instruction = new PaymentInstruction(
                "alice@demo", unknownReceiver, new BigDecimal("50.00"),
                demo.sha256Hex("1234"), UUID.randomUUID().toString(), Instant.now().toEpochMilli()
        );

        String ct = crypto.encrypt(instruction, serverKey.getPublicKey());
        MeshPacket packet = new MeshPacket();
        packet.setPacketId("pkt_unknown_rec_" + UUID.randomUUID());
        packet.setTtl(5);
        packet.setCreatedAt(Instant.now().toEpochMilli());
        packet.setCiphertext(ct);

        BridgeIngestionService.IngestResult result = bridge.ingest(packet, "bridge-test", 1);
        assertEquals("REJECTED", result.outcome());
        assertEquals("UNKNOWN_RECEIVER", result.reason());
    }

    @Test
    void testSelfTransferIsRejected() throws Exception {
        PaymentInstruction instruction = new PaymentInstruction(
                "alice@demo", "alice@demo", new BigDecimal("50.00"),
                demo.sha256Hex("1234"), UUID.randomUUID().toString(), Instant.now().toEpochMilli()
        );

        String ct = crypto.encrypt(instruction, serverKey.getPublicKey());
        MeshPacket packet = new MeshPacket();
        packet.setPacketId("pkt_selftx_" + UUID.randomUUID());
        packet.setTtl(5);
        packet.setCreatedAt(Instant.now().toEpochMilli());
        packet.setCiphertext(ct);

        BridgeIngestionService.IngestResult result = bridge.ingest(packet, "bridge-test", 1);
        assertEquals("INVALID", result.outcome());
        assertEquals("self_transfer_prohibited", result.reason());
    }

    @Test
    void testAmountExceedingOfflineLimitIsRejected() throws Exception {
        // ₹501.00 exceeds the ₹500.00 maximum offline allowance limit
        PaymentInstruction instruction = new PaymentInstruction(
                "alice@demo", "bob@demo", new BigDecimal("501.00"),
                demo.sha256Hex("1234"), UUID.randomUUID().toString(), Instant.now().toEpochMilli()
        );

        String ct = crypto.encrypt(instruction, serverKey.getPublicKey());
        MeshPacket packet = new MeshPacket();
        packet.setPacketId("pkt_overlimit_" + UUID.randomUUID());
        packet.setTtl(5);
        packet.setCreatedAt(Instant.now().toEpochMilli());
        packet.setCiphertext(ct);

        BridgeIngestionService.IngestResult result = bridge.ingest(packet, "bridge-test", 1);
        assertEquals("REJECTED", result.outcome());
        assertEquals("EXCEEDS_OFFLINE_LIMIT", result.reason());
    }

    @Test
    void testInvalidCurrencyPrecisionIsRejected() throws Exception {
        // Scale of 3 decimal places (₹50.005) is invalid for INR currency
        PaymentInstruction instruction = new PaymentInstruction(
                "alice@demo", "bob@demo", new BigDecimal("50.005"),
                demo.sha256Hex("1234"), UUID.randomUUID().toString(), Instant.now().toEpochMilli()
        );

        String ct = crypto.encrypt(instruction, serverKey.getPublicKey());
        MeshPacket packet = new MeshPacket();
        packet.setPacketId("pkt_precision_" + UUID.randomUUID());
        packet.setTtl(5);
        packet.setCreatedAt(Instant.now().toEpochMilli());
        packet.setCiphertext(ct);

        BridgeIngestionService.IngestResult result = bridge.ingest(packet, "bridge-test", 1);
        assertEquals("INVALID", result.outcome());
        assertEquals("invalid_currency_precision", result.reason());
    }

    @Test
    void testInvalidTtlIsRejectedSafely() throws Exception {
        PaymentInstruction instruction = new PaymentInstruction(
                "alice@demo", "bob@demo", new BigDecimal("50.00"),
                demo.sha256Hex("1234"), UUID.randomUUID().toString(), Instant.now().toEpochMilli()
        );

        String ct = crypto.encrypt(instruction, serverKey.getPublicKey());
        MeshPacket packet = new MeshPacket();
        packet.setPacketId("pkt_bad_ttl_" + UUID.randomUUID());
        packet.setTtl(0); // TTL 0 or negative
        packet.setCreatedAt(Instant.now().toEpochMilli());
        packet.setCiphertext(ct);

        BridgeIngestionService.IngestResult result = bridge.ingest(packet, "bridge-test", 1);
        assertEquals("INVALID", result.outcome());
        assertEquals("invalid_ttl", result.reason());
    }
}
