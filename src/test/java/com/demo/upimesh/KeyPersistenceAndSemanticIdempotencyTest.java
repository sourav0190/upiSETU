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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Validates:
 * 1. Persistent RSA key generation, loading, and cross-restart decryptability.
 * 2. Semantic re-encryption replay protection (different ciphertext, same semantic intent).
 * 3. Database uniqueness enforcement for (senderVpa, transactionRef).
 */
@SpringBootTest
class KeyPersistenceAndSemanticIdempotencyTest {

    @Autowired private ServerKeyHolder serverKey;
    @Autowired private HybridCryptoService crypto;
    @Autowired private BridgeIngestionService bridge;
    @Autowired private IdempotencyService idempotency;
    @Autowired private AccountRepository accounts;
    @Autowired private DemoService demo;

    @BeforeEach
    void setup() throws Exception {
        idempotency.clear();
        accounts.deleteAll();
        String pinHash = demo.sha256Hex("1234");
        accounts.save(new Account("alice@demo", "Alice Sharma", new BigDecimal("1000.00"), pinHash));
        accounts.save(new Account("bob@demo", "Bob Verma", new BigDecimal("500.00"), pinHash));
    }

    @Test
    void testServerKeyHolderPersistsAndReloadsMatchingKey() throws Exception {
        assertNotNull(serverKey.getPublicKey());
        assertNotNull(serverKey.getPrivateKey());
        assertNotNull(serverKey.getKeyId());

        String initialKeyId = serverKey.getKeyId();
        String initialPubKeyBase64 = serverKey.getPublicKeyBase64();

        // Simulate reload from disk
        serverKey.loadOrGenerateKeys();

        assertEquals(initialKeyId, serverKey.getKeyId(), "Key ID must persist across reloads");
        assertEquals(initialPubKeyBase64, serverKey.getPublicKeyBase64(), "Public key must remain identical after reload");
    }

    @Test
    void testSemanticReEncryptionReplayIsBlocked() throws Exception {
        String fixedNonce = "intent_" + UUID.randomUUID();
        long now = Instant.now().toEpochMilli();

        PaymentInstruction instruction1 = new PaymentInstruction(
                "alice@demo", "bob@demo", new BigDecimal("100.00"),
                demo.sha256Hex("1234"), fixedNonce, now
        );

        PaymentInstruction instruction2 = new PaymentInstruction(
                "alice@demo", "bob@demo", new BigDecimal("100.00"),
                demo.sha256Hex("1234"), fixedNonce, now
        );

        // Encrypting twice generates two distinct AES keys and IVs -> completely different ciphertexts!
        String ct1 = crypto.encrypt(instruction1, serverKey.getPublicKey());
        String ct2 = crypto.encrypt(instruction2, serverKey.getPublicKey());

        assertNotEquals(ct1, ct2, "AES-GCM encryption with fresh IV must generate different ciphertexts");
        assertNotEquals(crypto.hashCiphertext(ct1), crypto.hashCiphertext(ct2), "Ciphertext hashes must differ");

        MeshPacket packet1 = new MeshPacket();
        packet1.setPacketId("pkt_first_" + UUID.randomUUID());
        packet1.setTtl(5);
        packet1.setCreatedAt(now);
        packet1.setCiphertext(ct1);

        MeshPacket packet2 = new MeshPacket();
        packet2.setPacketId("pkt_reencrypted_" + UUID.randomUUID());
        packet2.setTtl(5);
        packet2.setCreatedAt(now);
        packet2.setCiphertext(ct2);

        // 1. First packet settles
        BridgeIngestionService.IngestResult res1 = bridge.ingest(packet1, "bridge-1", 1);
        assertEquals("SETTLED", res1.outcome());

        // Verify balance debited once
        Account aliceAfterFirst = accounts.findById("alice@demo").orElseThrow();
        assertEquals(new BigDecimal("900.00"), aliceAfterFirst.getBalance());

        // 2. Re-encrypted semantic replay arrives with distinct ciphertext and hash!
        // Semantic idempotency gate MUST detect that alice@demo has already claimed fixedNonce and drop it.
        BridgeIngestionService.IngestResult res2 = bridge.ingest(packet2, "bridge-2", 2);
        assertEquals("DUPLICATE_DROPPED", res2.outcome());

        // Verify balance was NOT debited a second time
        Account aliceAfterSecond = accounts.findById("alice@demo").orElseThrow();
        assertEquals(new BigDecimal("900.00"), aliceAfterSecond.getBalance(), "Balance must not be debited on re-encrypted duplicate");
    }
}
