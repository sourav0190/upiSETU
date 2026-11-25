package com.demo.upimesh.service;

import com.demo.upimesh.model.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Executes atomic ACID balance settlements and logs audit events.
 * Uses Hibernate optimistic locking (@Version) to prevent lost updates under concurrency.
 */
@Service
public class SettlementService {

    private static final Logger log = LoggerFactory.getLogger(SettlementService.class);

    @Autowired private AccountRepository accounts;
    @Autowired private TransactionRepository transactions;
    @Autowired(required = false) private TransactionEventRepository eventRepo;
    @Autowired private IdempotencyService idempotency;

    @Transactional
    public Transaction settle(PaymentInstruction instruction, String packetHash,
                              String bridgeNodeId, int hopCount) {

        if (instruction == null) {
            throw new IllegalArgumentException("Payment instruction cannot be null");
        }

        BigDecimal amount = instruction.getAmount();
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        // 1. Verify Sender Existence (NO automatic minting of new sender accounts)
        var senderOpt = accounts.findById(instruction.getSenderVpa());
        if (senderOpt.isEmpty()) {
            log.warn("Security rejection: unknown sender {}", instruction.getSenderVpa());
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "UNKNOWN_SENDER");
        }
        Account sender = senderOpt.get();

        // 2. Verify Receiver Existence
        var receiverOpt = accounts.findById(instruction.getReceiverVpa());
        if (receiverOpt.isEmpty()) {
            log.warn("Security rejection: unknown receiver {}", instruction.getReceiverVpa());
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "UNKNOWN_RECEIVER");
        }
        Account receiver = receiverOpt.get();

        // 3. Self-transfer policy
        if (sender.getVpa().equalsIgnoreCase(receiver.getVpa())) {
            log.warn("Security rejection: self-transfer prohibited for {}", sender.getVpa());
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "SELF_TRANSFER_PROHIBITED");
        }

        // 3b. Verify Transaction Reference Uniqueness in Database (Relational Defense-in-Depth)
        if (instruction.getNonce() != null && transactions.existsBySenderVpaAndTransactionRef(sender.getVpa(), instruction.getNonce())) {
            log.warn("Security rejection: transaction nonce {} already settled for {}", instruction.getNonce(), sender.getVpa());
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "DUPLICATE_TRANSACTION_NONCE");
        }

        // 4. Currency precision check
        if (amount.scale() > 2) {
            log.warn("Security rejection: invalid currency precision {} for {}", amount, sender.getVpa());
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "INVALID_CURRENCY_PRECISION");
        }

        // 5. PIN verification (if account has registered PIN hash)
        if (sender.getPinHash() != null) {
            if (instruction.getPinHash() == null || !sender.getPinHash().equalsIgnoreCase(instruction.getPinHash())) {
                log.warn("Security rejection: invalid UPI PIN for sender {}", sender.getVpa());
                return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "INVALID_UPI_PIN");
            }
        }

        // 6. Solvency check
        if (sender.getBalance().compareTo(amount) < 0) {
            log.warn("Insufficient balance: {} has ₹{}, tried to send ₹{}",
                    sender.getVpa(), sender.getBalance(), amount);
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "INSUFFICIENT_BALANCE");
        }

        // 7. Offline transaction limit (UPI-Lite maximum ₹500.00)
        if (amount.compareTo(new BigDecimal("500.00")) > 0) {
            log.warn("Transaction exceeds offline limit of ₹500.00: ₹{}", amount);
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "EXCEEDS_OFFLINE_LIMIT");
        }

        // 8. Offline spending allowance check
        long amtPaise = amount.multiply(BigDecimal.valueOf(100)).longValue();
        if (sender.getAvailableOfflineAllowancePaise() != null && amtPaise > sender.getAvailableOfflineAllowancePaise()) {
            log.warn("Exceeds offline allowance: {} needs {} paise, available {} paise",
                    sender.getVpa(), amtPaise, sender.getAvailableOfflineAllowancePaise());
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "EXCEEDS_OFFLINE_ALLOWANCE");
        }

        // 9. Atomic Debit & Credit
        sender.setBalance(sender.getBalance().subtract(amount));
        receiver.setBalance(receiver.getBalance().add(amount));

        // Synchronize offline allowance usage
        sender.setOfflineAllowanceSpentPaise(Math.max(0L, sender.getOfflineAllowanceSpentPaise() - amtPaise));

        accounts.save(sender);
        accounts.save(receiver);

        // 10. Ledger record
        Transaction tx = new Transaction();
        tx.setPacketHash(packetHash);
        tx.setTransactionRef(instruction.getNonce());
        tx.setSenderVpa(sender.getVpa());
        tx.setReceiverVpa(receiver.getVpa());
        tx.setAmount(amount);
        tx.setSignedAt(instruction.getSignedAt() != null ? Instant.ofEpochMilli(instruction.getSignedAt()) : Instant.now());
        tx.setSettledAt(Instant.now());
        tx.setBridgeNodeId(bridgeNodeId);
        tx.setHopCount(hopCount);
        tx.setStatus(Transaction.Status.SETTLED);
        tx.setPinVerified(true);
        transactions.save(tx);

        // 11. Audit timeline event
        if (eventRepo != null) {
            eventRepo.save(new TransactionEvent(tx.getId(), "SETTLEMENT_SUCCESS",
                    "PENDING_SETTLEMENT", "SETTLED",
                    "Debited ₹" + amount + " from " + sender.getVpa() + ", credited to " + receiver.getVpa()));
        }

        idempotency.recordOutcome(packetHash, "SETTLED", "Transaction ID: " + tx.getId());

        log.info("SETTLED ₹{} from {} to {} (packetHash={}, bridge={}, hops={})",
                amount, sender.getVpa(), receiver.getVpa(),
                packetHash.substring(0, Math.min(12, packetHash.length())) + "...", bridgeNodeId, hopCount);

        return tx;
    }

    private Transaction recordRejected(PaymentInstruction instruction, String packetHash,
                                       String bridgeNodeId, int hopCount, String reason) {
        Transaction tx = new Transaction();
        tx.setPacketHash(packetHash);
        tx.setTransactionRef(instruction.getNonce());
        tx.setSenderVpa(instruction.getSenderVpa() != null ? instruction.getSenderVpa() : "UNKNOWN");
        tx.setReceiverVpa(instruction.getReceiverVpa() != null ? instruction.getReceiverVpa() : "UNKNOWN");
        tx.setAmount(instruction.getAmount() != null ? instruction.getAmount() : BigDecimal.ZERO);
        tx.setSignedAt(instruction.getSignedAt() != null ? Instant.ofEpochMilli(instruction.getSignedAt()) : Instant.now());
        tx.setSettledAt(Instant.now());
        tx.setBridgeNodeId(bridgeNodeId);
        tx.setHopCount(hopCount);
        tx.setStatus(Transaction.Status.REJECTED);
        tx.setFailureReason(reason);
        transactions.save(tx);

        if (eventRepo != null) {
            eventRepo.save(new TransactionEvent(tx.getId(), "SETTLEMENT_REJECTED",
                    "PENDING_SETTLEMENT", "REJECTED", "Rejection reason: " + reason));
        }

        idempotency.recordOutcome(packetHash, "REJECTED", reason);
        return tx;
    }

    public Transaction recordRejected(PaymentInstruction instruction, String packetHash,
                                      String bridgeNodeId, int hopCount) {
        return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "INSUFFICIENT_BALANCE");
    }
}
