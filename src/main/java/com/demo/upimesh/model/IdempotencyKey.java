package com.demo.upimesh.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Durable persistence for idempotency keys, backing the in-memory cache
 * to ensure duplicate protection survives server restarts.
 */
@Entity
@Table(name = "idempotency_keys")
public class IdempotencyKey {

    @Id
    @Column(length = 64)
    private String keyHash; // SHA-256 hex of the ciphertext

    @Column(nullable = false)
    private Instant firstSeenAt;

    @Column(nullable = false, length = 32)
    private String status; // CLAIMED, SETTLED, DUPLICATE_DROPPED, INVALID

    @Column(length = 256)
    private String outcomeSummary;

    public IdempotencyKey() {}

    public IdempotencyKey(String keyHash, Instant firstSeenAt, String status, String outcomeSummary) {
        this.keyHash = keyHash;
        this.firstSeenAt = firstSeenAt;
        this.status = status;
        this.outcomeSummary = outcomeSummary;
    }

    public String getKeyHash() { return keyHash; }
    public void setKeyHash(String keyHash) { this.keyHash = keyHash; }

    public Instant getFirstSeenAt() { return firstSeenAt; }
    public void setFirstSeenAt(Instant firstSeenAt) { this.firstSeenAt = firstSeenAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getOutcomeSummary() { return outcomeSummary; }
    public void setOutcomeSummary(String outcomeSummary) { this.outcomeSummary = outcomeSummary; }
}
