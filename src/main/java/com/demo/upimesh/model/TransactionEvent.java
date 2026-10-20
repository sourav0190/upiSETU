package com.demo.upimesh.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Audit event log for every state transition in a transaction's lifecycle.
 */
@Entity
@Table(name = "transaction_events",
        indexes = {
                @Index(name = "idx_event_tx_id", columnList = "transactionId"),
                @Index(name = "idx_event_created_at", columnList = "createdAt")
        })
public class TransactionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long transactionId;

    @Column(nullable = false, length = 64)
    private String eventType; // STATE_CHANGE, DEDUP_CHECK, REPLAY_CHECK, SETTLEMENT_ATTEMPT

    @Column(length = 32)
    private String fromState;

    @Column(length = 32)
    private String toState;

    @Column(length = 1024)
    private String details;

    @Column(nullable = false)
    private Instant createdAt;

    public TransactionEvent() {}

    public TransactionEvent(Long transactionId, String eventType, String fromState, String toState, String details) {
        this.transactionId = transactionId;
        this.eventType = eventType;
        this.fromState = fromState;
        this.toState = toState;
        this.details = details;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long transactionId) { this.transactionId = transactionId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getFromState() { return fromState; }
    public void setFromState(String fromState) { this.fromState = fromState; }

    public String getToState() { return toState; }
    public void setToState(String toState) { this.toState = toState; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
