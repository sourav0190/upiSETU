package com.demo.upimesh.service;

import com.demo.upimesh.model.IdempotencyKey;
import com.demo.upimesh.model.IdempotencyKeyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Multi-tier idempotency engine.
 * Tier 1: Ultra-fast JVM-local ConcurrentHashMap (equivalent to Redis SETNX + EX).
 * Tier 2: Relational database fallback (IdempotencyKeyRepository) to guarantee
 * that idempotency protections survive server crashes and restarts.
 */
@Service
public class IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyService.class);

    private final Map<String, Instant> seen = new ConcurrentHashMap<>();

    @Autowired(required = false)
    private IdempotencyKeyRepository keyRepo;

    @Value("${upi.mesh.idempotency-ttl-seconds:86400}")
    private long ttlSeconds;

    /**
     * Atomically claim a packet hash.
     * Returns true if this caller is the first to claim; false if already claimed.
     */
    public boolean claim(String packetHash) {
        Instant now = Instant.now();

        // 1. In-memory check
        Instant prev = seen.putIfAbsent(packetHash, now);
        if (prev != null) {
            return false;
        }

        // 2. Persistent fallback check
        if (keyRepo != null) {
            try {
                if (keyRepo.existsById(packetHash)) {
                    log.warn("Packet hash {} found in database idempotency store; rejecting as duplicate",
                            packetHash.substring(0, Math.min(12, packetHash.length())) + "...");
                    return false;
                }
                keyRepo.save(new IdempotencyKey(packetHash, now, "CLAIMED", "In-flight"));
            } catch (Exception e) {
                // Unique constraint violation in DB caught as duplicate
                log.info("Database unique constraint caught duplicate packet {}",
                        packetHash.substring(0, Math.min(12, packetHash.length())) + "...");
                return false;
            }
        }

        return true;
    }

    /**
     * Atomically claim a semantic payment intent (sender VPA + payment nonce).
     * Defends against re-encryption replay attacks where identical payment intents are
     * encrypted with different random AES-GCM IVs to produce distinct ciphertexts.
     */
    public boolean claimSemantic(String senderVpa, String nonce) {
        if (senderVpa == null || nonce == null || senderVpa.isBlank() || nonce.isBlank()) {
            return true;
        }

        String semanticKey;
        try {
            java.security.MessageDigest sha = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = sha.digest((senderVpa.toLowerCase().trim() + ":" + nonce.trim()).getBytes());
            StringBuilder sb = new StringBuilder("sem_");
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            semanticKey = sb.toString();
        } catch (Exception e) {
            semanticKey = "sem_" + (senderVpa.toLowerCase().trim() + ":" + nonce.trim());
        }

        Instant now = Instant.now();

        // 1. In-memory check
        Instant prev = seen.putIfAbsent(semanticKey, now);
        if (prev != null) {
            return false;
        }

        // 2. Persistent fallback check
        if (keyRepo != null) {
            try {
                if (keyRepo.existsById(semanticKey)) {
                    log.warn("Semantic intent {} found in database idempotency store; rejecting duplicate intent", semanticKey);
                    return false;
                }
                keyRepo.save(new IdempotencyKey(semanticKey, now, "CLAIMED", "Semantic deduplication: " + senderVpa));
            } catch (Exception e) {
                log.info("Database unique constraint caught duplicate semantic intent {}", semanticKey);
                return false;
            }
        }
        return true;
    }

    public void recordOutcome(String packetHash, String outcome, String details) {
        if (keyRepo != null) {
            try {
                keyRepo.findById(packetHash).ifPresent(k -> {
                    k.setStatus(outcome);
                    k.setOutcomeSummary(details);
                    keyRepo.save(k);
                });
            } catch (Exception e) {
                log.warn("Could not record outcome for key {}: {}", packetHash, e.getMessage());
            }
        }
    }

    public int size() {
        return seen.size();
    }

    /** Periodically evict entries past their TTL so memory does not grow unbounded. */
    @Scheduled(fixedDelay = 60_000)
    public void evictExpired() {
        Instant cutoff = Instant.now().minusSeconds(ttlSeconds);
        seen.entrySet().removeIf(e -> e.getValue().isBefore(cutoff));
    }

    /** Test and demo helper. */
    public void clear() {
        seen.clear();
        if (keyRepo != null) {
            try {
                keyRepo.deleteAll();
            } catch (Exception ignored) {}
        }
    }
}
