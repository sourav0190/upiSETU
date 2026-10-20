package com.demo.upimesh.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Tracks batch synchronisation events ingested from peer devices or bridges.
 */
@Entity
@Table(name = "sync_attempts")
public class SyncAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String bridgeNodeId;

    @Column(nullable = false)
    private int totalPackets;

    @Column(nullable = false)
    private int settledCount;

    @Column(nullable = false)
    private int duplicateCount;

    @Column(nullable = false)
    private int invalidCount;

    @Column(nullable = false)
    private Instant attemptedAt;

    @Column(nullable = false)
    private Long durationMs;

    public SyncAttempt() {}

    public SyncAttempt(String bridgeNodeId, int totalPackets, int settledCount,
                       int duplicateCount, int invalidCount, Long durationMs) {
        this.bridgeNodeId = bridgeNodeId;
        this.totalPackets = totalPackets;
        this.settledCount = settledCount;
        this.duplicateCount = duplicateCount;
        this.invalidCount = invalidCount;
        this.attemptedAt = Instant.now();
        this.durationMs = durationMs;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getBridgeNodeId() { return bridgeNodeId; }
    public void setBridgeNodeId(String bridgeNodeId) { this.bridgeNodeId = bridgeNodeId; }

    public int getTotalPackets() { return totalPackets; }
    public void setTotalPackets(int totalPackets) { this.totalPackets = totalPackets; }

    public int getSettledCount() { return settledCount; }
    public void setSettledCount(int settledCount) { this.settledCount = settledCount; }

    public int getDuplicateCount() { return duplicateCount; }
    public void setDuplicateCount(int duplicateCount) { this.duplicateCount = duplicateCount; }

    public int getInvalidCount() { return invalidCount; }
    public void setInvalidCount(int invalidCount) { this.invalidCount = invalidCount; }

    public Instant getAttemptedAt() { return attemptedAt; }
    public void setAttemptedAt(Instant attemptedAt) { this.attemptedAt = attemptedAt; }

    public Long getDurationMs() { return durationMs; }
    public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }
}
