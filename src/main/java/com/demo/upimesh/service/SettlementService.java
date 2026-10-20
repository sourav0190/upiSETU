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

        Account sender = accounts.findById(instruction.getSenderVpa())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown sender VPA: " + instruction.getSenderVpa()));

        Account receiver = accounts.findById(instruction.getReceiverVpa())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unknown receiver VPA: " + instruction.getReceiverVpa()));

        BigDecimal amount = instruction.getAmount();
        if (amount.signum() <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        // 1. PIN verification (if account has registered PIN hash)
        if (sender.getPinHash() != null && instruction.getPinHash() != null
                && !sender.getPinHash().equalsIgnoreCase(instruction.getPinHash())) {
            log.warn("Security rejection: invalid UPI PIN for sender {}", sender.getVpa());
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "INVALID_UPI_PIN");
        }

        // 2. Solvency check
        if (sender.getBalance().compareTo(amount) < 0) {
            log.warn("Insufficient balance: {} has ₹{}, tried to send ₹{}",
                    sender.getVpa(), sender.getBalance(), amount);
            return recordRejected(instruction, packetHash, bridgeNodeId, hopCount, "INSUFFICIENT_BALANCE");
        }

        // 3. Atomic Debit & Credit
        sender.setBalance(sender.getBalance().subtract(amount));
        receiver.setBalance(receiver.getBalance().add(amount));

        // Synchronize offline allowance usage
        long amtPaise = amount.multiply(BigDecimal.valueOf(100)).longValue();
        sender.setOfflineAllowanceSpentPaise(Math.max(0L, sender.getOfflineAllowanceSpentPaise() - amtPaise));

        accounts.save(sender);
        accounts.save(receiver);

        // 4. Ledger record
        Transaction tx = new Transaction();
        tx.setPacketHash(packetHash);
        tx.setTransactionRef(instruction.getNonce());
        tx.setSenderVpa(instruction.getSenderVpa());
        tx.setReceiverVpa(instruction.getReceiverVpa());
        tx.setAmount(amount);
        tx.setSignedAt(Instant.ofEpochMilli(instruction.getSignedAt()));
        tx.setSettledAt(Instant.now());
        tx.setBridgeNodeId(bridgeNodeId);
        tx.setHopCount(hopCount);
        tx.setStatus(Transaction.Status.SETTLED);
        tx.setPinVerified(true);
        transactions.save(tx);

        // 5. Audit timeline event
        if (eventRepo != null) {
            eventRepo.save(new TransactionEvent(tx.getId(), "SETTLEMENT_SUCCESS",
                    "PENDING_SETTLEMENT", "SETTLED",
                    "Debited ₹" + amount + " from " + sender.getVpa() + ", credited to " + receiver.getVpa()));
        }

        idempotency.recordOutcome(packetHash, "SETTLED", "Transaction ID: " + tx.getId());

        log.info("SETTLED ₹{} from {} to {} (packetHash={}, bridge={}, hops={})",
                amount, sender.getVpa(), receiver.getVpa(),
                packetHash.substring(0, 12) + "...", bridgeNodeId, hopCount);

        return tx;
    }

    private Transaction recordRejected(PaymentInstruction instruction, String packetHash,
                                       String bridgeNodeId, int hopCount, String reason) {
        Transaction tx = new Transaction();
        tx.setPacketHash(packetHash);
        tx.setTransactionRef(instruction.getNonce());
        tx.setSenderVpa(instruction.getSenderVpa());
        tx.setReceiverVpa(instruction.getReceiverVpa());
        tx.setAmount(instruction.getAmount());
        tx.setSignedAt(Instant.ofEpochMilli(instruction.getSignedAt()));
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
