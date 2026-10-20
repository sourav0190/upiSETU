package com.demo.upimesh;

import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.PaymentInstruction;
import com.demo.upimesh.model.Transaction;
import com.demo.upimesh.service.DemoService;
import com.demo.upimesh.service.SettlementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class WalletAndSettlementUnitTest {

    @Autowired private SettlementService settlementService;
    @Autowired private AccountRepository accountRepo;
    @Autowired private DemoService demoService;

    @BeforeEach
    void setupAccounts() throws Exception {
        accountRepo.deleteAll();
        String pinHash = demoService.sha256Hex("1234");
        accountRepo.save(new Account("alice@demo", "Alice Sharma", new BigDecimal("1000.00"), pinHash));
        accountRepo.save(new Account("bob@demo", "Bob Verma", new BigDecimal("500.00"), pinHash));
    }

    @Test
    void testSuccessfulSettlementDebitsSenderAndCreditsReceiver() throws Exception {
        BigDecimal transferAmount = new BigDecimal("250.00");
        PaymentInstruction instruction = new PaymentInstruction(
                "alice@demo", "bob@demo", transferAmount,
                demoService.sha256Hex("1234"), UUID.randomUUID().toString(), System.currentTimeMillis()
        );

        String packetHash = "hash_" + UUID.randomUUID();
        Transaction tx = settlementService.settle(instruction, packetHash, "bridge-test", 2);

        assertEquals(Transaction.Status.SETTLED, tx.getStatus());
        assertEquals(0, transferAmount.compareTo(tx.getAmount()));
        assertEquals(25000L, tx.getAmountPaise());

        Account alice = accountRepo.findById("alice@demo").orElseThrow();
        Account bob = accountRepo.findById("bob@demo").orElseThrow();

        assertEquals(new BigDecimal("750.00"), alice.getBalance());
        assertEquals(new BigDecimal("750.00"), bob.getBalance());
    }

    @Test
    void testInsufficientBalanceResultsInRejectedTransaction() throws Exception {
        BigDecimal overAmount = new BigDecimal("1500.00"); // Alice only has 1000
        PaymentInstruction instruction = new PaymentInstruction(
                "alice@demo", "bob@demo", overAmount,
                demoService.sha256Hex("1234"), UUID.randomUUID().toString(), System.currentTimeMillis()
        );

        String packetHash = "hash_insufficient_" + UUID.randomUUID();
        Transaction tx = settlementService.settle(instruction, packetHash, "bridge-test", 2);

        assertEquals(Transaction.Status.REJECTED, tx.getStatus());
        assertEquals("INSUFFICIENT_BALANCE", tx.getFailureReason());

        // Assert balances remained untouched
        Account alice = accountRepo.findById("alice@demo").orElseThrow();
        assertEquals(new BigDecimal("1000.00"), alice.getBalance());
    }

    @Test
    void testNegativeOrZeroAmountThrowsException() {
        PaymentInstruction instruction = new PaymentInstruction(
                "alice@demo", "bob@demo", new BigDecimal("-50.00"),
                "pin", UUID.randomUUID().toString(), System.currentTimeMillis()
        );

        assertThrows(IllegalArgumentException.class, () ->
                settlementService.settle(instruction, "hash_neg", "bridge-test", 1));
    }

    @Test
    void testInvalidPinRejectsTransaction() throws Exception {
        String wrongPinHash = demoService.sha256Hex("9999");
        PaymentInstruction instruction = new PaymentInstruction(
                "alice@demo", "bob@demo", new BigDecimal("100.00"),
                wrongPinHash, UUID.randomUUID().toString(), System.currentTimeMillis()
        );

        Transaction tx = settlementService.settle(instruction, "hash_bad_pin", "bridge-test", 1);
        assertEquals(Transaction.Status.REJECTED, tx.getStatus());
        assertEquals("INVALID_UPI_PIN", tx.getFailureReason());
    }
}
