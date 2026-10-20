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
import java.util.UUID;

/**
 * Seeds demo accounts with default PINs and simulates device-side packet generation.
 */
@Service
public class DemoService {

    private static final Logger log = LoggerFactory.getLogger(DemoService.class);

    @Autowired private AccountRepository accounts;
    @Autowired private HybridCryptoService crypto;
    @Autowired private ServerKeyHolder serverKey;

    @PostConstruct
    public void seedAccounts() {
        if (accounts.count() == 0) {
            try {
                String defaultPinHash = sha256Hex("1234");
                accounts.save(new Account("alice@demo", "Alice Sharma", new BigDecimal("5000.00"), defaultPinHash));
                accounts.save(new Account("bob@demo",   "Bob Verma",    new BigDecimal("1000.00"), defaultPinHash));
                accounts.save(new Account("carol@demo", "Carol Patel",  new BigDecimal("2500.00"), defaultPinHash));
                accounts.save(new Account("dave@demo",  "Dave Singh",   new BigDecimal("500.00"),  defaultPinHash));
                log.info("Seeded 4 demo accounts with default PIN 1234");
            } catch (Exception e) {
                log.error("Failed to seed demo accounts", e);
            }
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
