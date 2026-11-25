package com.demo.upimesh.crypto;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Holds and persists the server's RSA keypair.
 *
 * Keys are loaded from disk if present, or generated once and persisted to disk.
 * This ensures that offline packets signed and queued across device restarts or server
 * reboots remain decryptable and valid within their freshness window.
 */
@Component
public class ServerKeyHolder {

    private static final Logger log = LoggerFactory.getLogger(ServerKeyHolder.class);

    @Value("${upi.mesh.key-dir:./data/keys}")
    private String keyDir;

    private KeyPair keyPair;
    private String keyId;

    @PostConstruct
    public void init() throws Exception {
        loadOrGenerateKeys();
    }

    public synchronized void loadOrGenerateKeys() throws Exception {
        Path dirPath = Path.of(keyDir);
        Path privPath = dirPath.resolve("server_rsa_private.der");
        Path pubPath = dirPath.resolve("server_rsa_public.der");

        if (Files.exists(privPath) && Files.exists(pubPath)) {
            try {
                byte[] privBytes = Files.readAllBytes(privPath);
                byte[] pubBytes = Files.readAllBytes(pubPath);

                KeyFactory kf = KeyFactory.getInstance("RSA");
                PrivateKey priv = kf.generatePrivate(new PKCS8EncodedKeySpec(privBytes));
                PublicKey pub = kf.generatePublic(new X509EncodedKeySpec(pubBytes));
                this.keyPair = new KeyPair(pub, priv);
                computeKeyId();
                log.info("Server RSA keypair loaded from disk ({}). Key ID: {}", dirPath.toAbsolutePath(), keyId);
                return;
            } catch (Exception e) {
                log.warn("Corrupted keys on disk, regenerating: {}", e.getMessage());
            }
        }

        // Generate new keypair
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        this.keyPair = gen.generateKeyPair();
        computeKeyId();

        try {
            Files.createDirectories(dirPath);
            Files.write(privPath, keyPair.getPrivate().getEncoded());
            Files.write(pubPath, keyPair.getPublic().getEncoded());
            log.info("Server RSA keypair generated and persisted to disk ({}). Key ID: {}", dirPath.toAbsolutePath(), keyId);
        } catch (Exception e) {
            log.warn("Could not persist RSA keys to disk (in-memory fallback): {}", e.getMessage());
        }
    }

    private void computeKeyId() throws NoSuchAlgorithmException {
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        byte[] digest = sha.digest(keyPair.getPublic().getEncoded());
        StringBuilder sb = new StringBuilder("v1-");
        for (int i = 0; i < 4; i++) {
            sb.append(String.format("%02x", digest[i]));
        }
        this.keyId = sb.toString();
    }

    public PublicKey getPublicKey() {
        return keyPair.getPublic();
    }

    public PrivateKey getPrivateKey() {
        return keyPair.getPrivate();
    }

    public String getPublicKeyBase64() {
        return Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
    }

    public String getKeyId() {
        return keyId;
    }
}
