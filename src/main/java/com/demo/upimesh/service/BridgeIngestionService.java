package com.demo.upimesh.service;

import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.PaymentInstruction;
import com.demo.upimesh.model.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Orchestrates the full server-side pipeline for one inbound packet from a
 * bridge node:
 *
 *   1. Hash the ciphertext (SHA-256).
 *   2. Atomic Idempotency check (drop if already claimed).
 *   3. Decrypt the ciphertext with server's RSA private key.
 *   4. Check freshness (replay protection).
 *   5. Settle ledger atomically via SettlementService.
 */
@Service
public class BridgeIngestionService {

    private static final Logger log = LoggerFactory.getLogger(BridgeIngestionService.class);

    @Autowired private HybridCryptoService crypto;
    @Autowired private IdempotencyService idempotency;
    @Autowired private SettlementService settlement;

    @Value("${upi.mesh.packet-max-age-seconds:86400}")
    private long maxAgeSeconds;

    public IngestResult ingest(MeshPacket packet, String bridgeNodeId, int hopCount) {
        try {
            if (packet == null || packet.getCiphertext() == null || packet.getCiphertext().isBlank()) {
                return IngestResult.invalid("?", "empty_packet");
            }

            // Packet TTL check
            if (packet.getTtl() <= 0 || packet.getTtl() > 10) {
                return IngestResult.invalid("?", "invalid_ttl");
            }

            String packetHash = crypto.hashCiphertext(packet.getCiphertext());

            // ---- Idempotency gate ----
            if (!idempotency.claim(packetHash)) {
                log.info("DUPLICATE packet {} from bridge {} — dropped",
                        packetHash.substring(0, Math.min(12, packetHash.length())) + "...", bridgeNodeId);
                return IngestResult.duplicate(packetHash);
            }

            // ---- Decrypt ----
            PaymentInstruction instruction;
            try {
                instruction = crypto.decrypt(packet.getCiphertext());
            } catch (Exception e) {
                log.warn("Decryption failed for packet {}: {}",
                        packetHash.substring(0, Math.min(12, packetHash.length())) + "...", e.getMessage());
                idempotency.recordOutcome(packetHash, "INVALID", "decryption_failed");
                return IngestResult.invalid(packetHash, "decryption_failed");
            }

            if (instruction == null) {
                idempotency.recordOutcome(packetHash, "INVALID", "null_instruction");
                return IngestResult.invalid(packetHash, "null_instruction");
            }

            // ---- Structural validation ----
            var validationErrors = instruction.validate();
            if (!validationErrors.isEmpty()) {
                String firstError = validationErrors.get(0);
                log.warn("Instruction validation failed for packet {}: {}",
                        packetHash.substring(0, Math.min(12, packetHash.length())) + "...", validationErrors);
                idempotency.recordOutcome(packetHash, "INVALID", firstError);
                return IngestResult.invalid(packetHash, firstError);
            }

            // ---- Semantic Deduplication Gate ----
            if (!idempotency.claimSemantic(instruction.getSenderVpa(), instruction.getNonce())) {
                log.info("SEMANTIC DUPLICATE instruction from sender {} nonce {} — dropped",
                        instruction.getSenderVpa(), instruction.getNonce());
                return IngestResult.duplicate(packetHash);
            }

            // ---- Freshness check (replay protection) ----
            if (instruction.getSignedAt() == null) {
                idempotency.recordOutcome(packetHash, "INVALID", "missing_timestamp");
                return IngestResult.invalid(packetHash, "missing_timestamp");
            }

            long ageSeconds = (Instant.now().toEpochMilli() - instruction.getSignedAt()) / 1000;
            if (ageSeconds > maxAgeSeconds) {
                log.warn("Packet {} too old ({}s), rejected",
                        packetHash.substring(0, Math.min(12, packetHash.length())) + "...", ageSeconds);
                idempotency.recordOutcome(packetHash, "INVALID", "stale_packet");
                return IngestResult.invalid(packetHash, "stale_packet");
            }
            if (ageSeconds < -300) { // small clock-skew tolerance
                idempotency.recordOutcome(packetHash, "INVALID", "future_dated");
                return IngestResult.invalid(packetHash, "future_dated");
            }

            // ---- Settle ----
            Transaction tx = settlement.settle(instruction, packetHash, bridgeNodeId, hopCount);
            if (tx.getStatus() == Transaction.Status.REJECTED) {
                return IngestResult.rejected(packetHash, tx.getFailureReason(), tx.getId());
            }
            return IngestResult.settled(packetHash, tx);

        } catch (Exception e) {
            log.error("Ingestion error: {}", e.getMessage(), e);
            return IngestResult.invalid("?", "internal_error: " + e.getMessage());
        }
    }

    public record IngestResult(String outcome, String packetHash, String reason, Long transactionId) {
        public static IngestResult settled(String hash, Transaction tx) {
            return new IngestResult("SETTLED", hash, null, tx.getId());
        }
        public static IngestResult rejected(String hash, String reason, Long txId) {
            return new IngestResult("REJECTED", hash, reason, txId);
        }
        public static IngestResult duplicate(String hash) {
            return new IngestResult("DUPLICATE_DROPPED", hash, null, null);
        }
        public static IngestResult invalid(String hash, String reason) {
            return new IngestResult("INVALID", hash, reason, null);
        }
    }
}
