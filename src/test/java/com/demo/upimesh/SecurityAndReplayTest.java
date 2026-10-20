package com.demo.upimesh;

import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.crypto.ServerKeyHolder;
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

@SpringBootTest
class SecurityAndReplayTest {

    @Autowired private BridgeIngestionService bridge;
    @Autowired private HybridCryptoService crypto;
    @Autowired private ServerKeyHolder serverKey;
    @Autowired private IdempotencyService idempotency;
    @Autowired private DemoService demo;

    @BeforeEach
    void clearCache() {
        idempotency.clear();
    }

    @Test
    void testStalePacketIsRejected() throws Exception {
        // Created 48 hours ago (exceeding 24-hour replay protection window)
        long twoDaysAgo = Instant.now().minusSeconds(48 * 3600).toEpochMilli();
        PaymentInstruction oldInstruction = new PaymentInstruction(
                "alice@demo", "bob@demo", new BigDecimal("50.00"),
                demo.sha256Hex("1234"), UUID.randomUUID().toString(), twoDaysAgo
        );

        String ct = crypto.encrypt(oldInstruction, serverKey.getPublicKey());
        MeshPacket packet = new MeshPacket();
        packet.setPacketId("stale_pkt_" + UUID.randomUUID());
        packet.setTtl(3);
        packet.setCreatedAt(twoDaysAgo);
        packet.setCiphertext(ct);

        BridgeIngestionService.IngestResult result = bridge.ingest(packet, "bridge-stale", 1);
        assertEquals("INVALID", result.outcome());
        assertEquals("stale_packet", result.reason());
    }

    @Test
    void testFutureDatedPacketIsRejected() throws Exception {
        // Created 1 hour in the future (violating clock skew tolerance)
        long futureTime = Instant.now().plusSeconds(3600).toEpochMilli();
        PaymentInstruction futureInstruction = new PaymentInstruction(
                "alice@demo", "bob@demo", new BigDecimal("50.00"),
                demo.sha256Hex("1234"), UUID.randomUUID().toString(), futureTime
        );

        String ct = crypto.encrypt(futureInstruction, serverKey.getPublicKey());
        MeshPacket packet = new MeshPacket();
        packet.setPacketId("future_pkt_" + UUID.randomUUID());
        packet.setTtl(3);
        packet.setCreatedAt(futureTime);
        packet.setCiphertext(ct);

        BridgeIngestionService.IngestResult result = bridge.ingest(packet, "bridge-future", 1);
        assertEquals("INVALID", result.outcome());
        assertEquals("future_dated", result.reason());
    }

    @Test
    void testReplayOfIdenticalPacketIsDroppedAtIdempotencyGate() throws Exception {
        MeshPacket packet = demo.createPacket(
                "alice@demo", "bob@demo", new BigDecimal("75.00"), "1234", 5);

        // First delivery: should settle
        BridgeIngestionService.IngestResult r1 = bridge.ingest(packet, "bridge-alpha", 1);
        assertEquals("SETTLED", r1.outcome());

        // Second delivery (e.g. replayed by intermediate node): MUST be dropped without charging again
        BridgeIngestionService.IngestResult r2 = bridge.ingest(packet, "bridge-beta", 2);
        assertEquals("DUPLICATE_DROPPED", r2.outcome());

        // Third delivery: MUST also be dropped
        BridgeIngestionService.IngestResult r3 = bridge.ingest(packet, "bridge-gamma", 3);
        assertEquals("DUPLICATE_DROPPED", r3.outcome());
    }
}
