package com.demo.upimesh.service;

import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.crypto.ServerKeyHolder;
import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.PaymentInstruction;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Seeds demo accounts with default PINs and simulates device-side packet generation.
 * Also provisions dynamic user accounts when new participants join the mesh.
 */
@Service
public class DemoService {

    private static final Logger log = LoggerFactory.getLogger(DemoService.class);

    @Autowired private AccountRepository accounts;
    @Autowired private HybridCryptoService crypto;
    @Autowired private ServerKeyHolder serverKey;

    @PostConstruct
    public void seedAccounts() {
        try {
            String defaultPinHash = sha256Hex("1234");
            ensureAccount("alice@demo", "Alice Sharma", new BigDecimal("5000.00"), defaultPinHash);
            ensureAccount("bob@demo",   "Bob Verma",    new BigDecimal("1000.00"), defaultPinHash);
            ensureAccount("carol@demo", "Carol Patel",  new BigDecimal("2500.00"), defaultPinHash);
            ensureAccount("dave@demo",  "Dave Singh",   new BigDecimal("500.00"),  defaultPinHash);
            ensureAccount("bridge@demo","Eve Bridge",   new BigDecimal("3000.00"), defaultPinHash);
            log.info("Initialized core accounts with default PIN 1234");
        } catch (Exception e) {
            log.error("Failed to seed demo accounts", e);
        }
    }

    private void ensureAccount(String vpa, String name, BigDecimal balance, String pinHash) {
        if (!accounts.existsById(vpa)) {
            accounts.save(new Account(vpa, name, balance, pinHash));
        }
    }

    /**
     * Get an existing account or automatically provision a new one with ₹5,000 balance and PIN 1234.
     */
    public Account getOrCreateAccount(String vpa, String holderName) {
        if (vpa == null || vpa.isBlank()) vpa = "user_" + UUID.randomUUID().toString().substring(0, 6) + "@demo";
        Optional<Account> opt = accounts.findById(vpa);
        if (opt.isPresent()) return opt.get();

        String name = (holderName != null && !holderName.isBlank()) ? holderName : vpa.split("@")[0];
        try {
            String defaultPinHash = sha256Hex("1234");
            Account acc = new Account(vpa, name, new BigDecimal("5000.00"), defaultPinHash);
            accounts.save(acc);
            log.info("Auto-provisioned new account for {}: {}", vpa, name);
            return acc;
        } catch (Exception e) {
            Account acc = new Account(vpa, name, new BigDecimal("5000.00"));
            accounts.save(acc);
            return acc;
        }
    }

    /**
     * Simulates the sender's phone creating an authenticated, encrypted packet:
     *   1. Build PaymentInstruction with UUID nonce + signedAt timestamp.
     *   2. Encrypt with server's RSA public key (hybrid RSA-OAEP + AES-GCM).
     *   3. Wrap into MeshPacket with TTL.
     */
    public MeshPacket createPacket(String senderVpa, String receiverVpa,
                                   BigDecimal amount, String pin, int ttl) throws Exception {
        PaymentInstruction instruction = new PaymentInstruction(
                senderVpa,
                receiverVpa,
                amount,
                sha256Hex(pin),
                UUID.randomUUID().toString(),       // nonce — guarantees uniqueness
                Instant.now().toEpochMilli()        // signedAt — for freshness check
        );

        String ciphertext = crypto.encrypt(instruction, serverKey.getPublicKey());

        MeshPacket packet = new MeshPacket();
        packet.setPacketId(UUID.randomUUID().toString());
        packet.setTtl(ttl);
        packet.setCreatedAt(Instant.now().toEpochMilli());
        packet.setCiphertext(ciphertext);
        return packet;
    }

    public String sha256Hex(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(input.getBytes());
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) hex.append(String.format("%02x", b));
        return hex.toString();
    }
}
