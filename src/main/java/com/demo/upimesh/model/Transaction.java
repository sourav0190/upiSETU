package com.demo.upimesh.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

/**
 * Permanent record of every settled, rejected, or reconciled transaction.
 * The packetHash is the cryptographic idempotency key — uniqueness is enforced
 * at the DB level as a defense-in-depth fallback.
 */
@Entity
@Table(name = "transactions",
        indexes = {
                @Index(name = "idx_packet_hash", columnList = "packetHash", unique = true),
                @Index(name = "idx_tx_ref", columnList = "transactionRef"),
                @Index(name = "idx_tx_sender", columnList = "senderVpa"),
                @Index(name = "idx_tx_receiver", columnList = "receiverVpa"),
                @Index(name = "idx_tx_settled_at", columnList = "settledAt")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_sender_txref", columnNames = {"senderVpa", "transactionRef"})
        })
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String packetHash; // SHA-256 hex of the encrypted packet

    @Column(length = 64)
    private String transactionRef; // UUID generated on client device

    @Column(nullable = false, length = 64)
    private String senderVpa;

    @Column(nullable = false, length = 64)
    private String receiverVpa;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private Long amountPaise; // Exact integer minor currency unit

    @Column(nullable = false)
    private Instant signedAt; // When sender originally signed it (offline)

    @Column(nullable = false)
    private Instant settledAt; // When backend actually processed it

    @Column(nullable = false, length = 64)
    private String bridgeNodeId; // Which mesh node finally delivered it

    @Column(nullable = false)
    private int hopCount; // How many devices it passed through

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status;

    @Column(length = 256)
    private String failureReason; // Explains REJECTED or FAILED outcomes

    @Column
    private Boolean pinVerified = true;

    public enum Status {
        SETTLED,
        REJECTED,
        FAILED,
        PENDING_SETTLEMENT,
        REQUIRES_RECONCILIATION
    }

    public Transaction() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPacketHash() { return packetHash; }
    public void setPacketHash(String packetHash) { this.packetHash = packetHash; }

    public String getTransactionRef() { return transactionRef; }
    public void setTransactionRef(String transactionRef) { this.transactionRef = transactionRef; }

    public String getSenderVpa() { return senderVpa; }
    public void setSenderVpa(String senderVpa) { this.senderVpa = senderVpa; }

    public String getReceiverVpa() { return receiverVpa; }
    public void setReceiverVpa(String receiverVpa) { this.receiverVpa = receiverVpa; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) {
        this.amount = amount.setScale(2, RoundingMode.HALF_UP);
        this.amountPaise = this.amount.multiply(BigDecimal.valueOf(100)).longValue();
    }

    public Long getAmountPaise() { return amountPaise; }
    public void setAmountPaise(Long amountPaise) {
        this.amountPaise = amountPaise;
        this.amount = BigDecimal.valueOf(amountPaise).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    public Instant getSignedAt() { return signedAt; }
    public void setSignedAt(Instant signedAt) { this.signedAt = signedAt; }

    public Instant getSettledAt() { return settledAt; }
    public void setSettledAt(Instant settledAt) { this.settledAt = settledAt; }

    public String getBridgeNodeId() { return bridgeNodeId; }
    public void setBridgeNodeId(String bridgeNodeId) { this.bridgeNodeId = bridgeNodeId; }

    public int getHopCount() { return hopCount; }
    public void setHopCount(int hopCount) { this.hopCount = hopCount; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }

    public Boolean getPinVerified() { return pinVerified; }
    public void setPinVerified(Boolean pinVerified) { this.pinVerified = pinVerified; }
}
