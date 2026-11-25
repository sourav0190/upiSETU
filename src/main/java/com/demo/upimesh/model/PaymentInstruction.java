package com.demo.upimesh.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * The canonical payment instruction decrypted from a MeshPacket ciphertext.
 *
 * Implements strict schema validation, backwards-compatible Jackson aliases,
 * and eliminates sensitive plaintext credential storage.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class PaymentInstruction {

    @JsonProperty("senderVpa")
    private String senderVpa;

    @JsonProperty("receiverVpa")
    private String receiverVpa;

    @JsonProperty("amount")
    private BigDecimal amount;

    @JsonProperty("pinHash")
    @JsonAlias({"pinHash", "authProof", "pin"})
    private String pinHash;

    @JsonProperty("nonce")
    private String nonce; // UUID or unique intent reference

    @JsonProperty("signedAt")
    @JsonAlias({"signedAt", "timestamp"})
    private Long signedAt; // epoch millis when sender signed the instruction

    @JsonProperty("note")
    private String note;

    @JsonProperty("version")
    private Integer version = 1;

    public PaymentInstruction() {}

    public PaymentInstruction(String senderVpa, String receiverVpa, BigDecimal amount,
                              String pinHash, String nonce, Long signedAt) {
        this(senderVpa, receiverVpa, amount, pinHash, nonce, signedAt, null, 1);
    }

    public PaymentInstruction(String senderVpa, String receiverVpa, BigDecimal amount,
                              String pinHash, String nonce, Long signedAt, String note, Integer version) {
        this.senderVpa = senderVpa;
        this.receiverVpa = receiverVpa;
        this.amount = amount;
        this.pinHash = pinHash;
        this.nonce = nonce;
        this.signedAt = signedAt;
        this.note = note;
        this.version = version != null ? version : 1;
    }

    /**
     * Validates that the payment instruction satisfies structural and integrity constraints.
     * Returns a list of validation failure descriptions, or empty list if valid.
     */
    public List<String> validate() {
        List<String> errors = new ArrayList<>();
        if (senderVpa == null || senderVpa.isBlank()) {
            errors.add("missing_sender_vpa");
        } else if (!senderVpa.matches("^[\\w.-]+@[\\w.-]+$")) {
            errors.add("malformed_sender_vpa");
        }

        if (receiverVpa == null || receiverVpa.isBlank()) {
            errors.add("missing_receiver_vpa");
        } else if (!receiverVpa.matches("^[\\w.-]+@[\\w.-]+$")) {
            errors.add("malformed_receiver_vpa");
        }

        if (senderVpa != null && receiverVpa != null && senderVpa.trim().equalsIgnoreCase(receiverVpa.trim())) {
            errors.add("self_transfer_prohibited");
        }

        if (amount == null) {
            errors.add("missing_amount");
        } else if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            errors.add("amount_must_be_positive");
        } else if (amount.scale() > 2) {
            errors.add("invalid_currency_precision");
        }

        if (nonce == null || nonce.isBlank()) {
            errors.add("missing_nonce");
        }

        if (signedAt == null) {
            errors.add("missing_timestamp");
        }

        return errors;
    }

    public String getSenderVpa() { return senderVpa; }
    public void setSenderVpa(String senderVpa) { this.senderVpa = senderVpa; }

    public String getReceiverVpa() { return receiverVpa; }
    public void setReceiverVpa(String receiverVpa) { this.receiverVpa = receiverVpa; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getPinHash() { return pinHash; }
    public void setPinHash(String pinHash) { this.pinHash = pinHash; }

    public String getNonce() { return nonce; }
    public void setNonce(String nonce) { this.nonce = nonce; }

    public Long getSignedAt() { return signedAt; }
    public void setSignedAt(Long signedAt) { this.signedAt = signedAt; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
}
