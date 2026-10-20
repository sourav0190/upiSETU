package com.demo.upimesh.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Simulated bank account and wallet ledger.
 * Incorporates exact integer minor currency units (paise) to prevent IEEE 754 float drift,
 * offline spending allowance boundaries (UPI Lite paradigm), and optimistic locking.
 */
@Entity
@Table(name = "accounts")
public class Account {

    @Id
    @Column(length = 64)
    private String vpa; // Virtual Payment Address, e.g. "alice@demo"

    @Column(nullable = false, length = 128)
    private String holderName;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal balance;

    @Column(nullable = false)
    private Long balancePaise = 0L; // Integer minor currency units (1 INR = 100 paise)

    @Column(nullable = false)
    private Long offlineAllowanceLimitPaise = 200000L; // ₹2,000.00 max offline allowance

    @Column(nullable = false)
    private Long offlineAllowanceSpentPaise = 0L; // Current un-synced offline spending

    @Column(length = 64)
    private String pinHash; // SHA-256 hex of 4-digit UPI PIN

    @Version  // Optimistic locking — prevents lost updates on concurrent transfers
    private Long version;

    public Account() {}

    public Account(String vpa, String holderName, BigDecimal balance) {
        this.vpa = vpa;
        this.holderName = holderName;
        setBalance(balance);
        this.offlineAllowanceLimitPaise = 200000L;
        this.offlineAllowanceSpentPaise = 0L;
    }

    public Account(String vpa, String holderName, BigDecimal balance, String pinHash) {
        this(vpa, holderName, balance);
        this.pinHash = pinHash;
    }

    public String getVpa() { return vpa; }
    public void setVpa(String vpa) { this.vpa = vpa; }

    public String getHolderName() { return holderName; }
    public void setHolderName(String holderName) { this.holderName = holderName; }

    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) {
        this.balance = balance.setScale(2, RoundingMode.HALF_UP);
        this.balancePaise = this.balance.multiply(BigDecimal.valueOf(100)).longValue();
    }

    public Long getBalancePaise() { return balancePaise; }
    public void setBalancePaise(Long balancePaise) {
        this.balancePaise = balancePaise;
        this.balance = BigDecimal.valueOf(balancePaise).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    public Long getOfflineAllowanceLimitPaise() { return offlineAllowanceLimitPaise; }
    public void setOfflineAllowanceLimitPaise(Long limit) { this.offlineAllowanceLimitPaise = limit; }

    public Long getOfflineAllowanceSpentPaise() { return offlineAllowanceSpentPaise; }
    public void setOfflineAllowanceSpentPaise(Long spent) { this.offlineAllowanceSpentPaise = spent; }

    public Long getAvailableOfflineAllowancePaise() {
        return Math.max(0L, offlineAllowanceLimitPaise - offlineAllowanceSpentPaise);
    }

    public String getPinHash() { return pinHash; }
    public void setPinHash(String pinHash) { this.pinHash = pinHash; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
