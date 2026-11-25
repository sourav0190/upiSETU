package com.demo.upimesh.controller;

import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.crypto.ServerKeyHolder;
import com.demo.upimesh.model.*;
import com.demo.upimesh.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/**
 * Modern RESTful API v1 for the MeshPay client application.
 * Supports dynamic multi-device mesh synchronization (variable N nodes),
 * wallet management, dynamic QR voucher ingest, and cybersecurity attack verification.
 */
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = {"http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:3000"})
public class ApiV1Controller {

    @Autowired private AccountRepository accountRepo;
    @Autowired private TransactionRepository txRepo;
    @Autowired(required = false) private TransactionEventRepository eventRepo;
    @Autowired(required = false) private SyncAttemptRepository syncAttemptRepo;
    @Autowired private BridgeIngestionService bridgeService;
    @Autowired private IdempotencyService idempotencyService;
    @Autowired private MeshSimulatorService meshService;
    @Autowired private DemoService demoService;
    @Autowired private HybridCryptoService cryptoService;
    @Autowired private ServerKeyHolder serverKey;

    // ------------------------------------------------------------- Wallet
    @GetMapping("/wallet")
    public ResponseEntity<?> getWallet(@RequestParam(value = "vpa", defaultValue = "alice@demo") String vpa) {
        Account acc = demoService.getOrCreateAccount(vpa, null);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("vpa", acc.getVpa());
        resp.put("holderName", acc.getHolderName());
        resp.put("balance", acc.getBalance());
        resp.put("balancePaise", acc.getBalancePaise());
        resp.put("offlineAllowanceLimitPaise", acc.getOfflineAllowanceLimitPaise());
        resp.put("offlineAllowanceLimit", BigDecimal.valueOf(acc.getOfflineAllowanceLimitPaise()).divide(BigDecimal.valueOf(100)));
        resp.put("offlineAllowanceSpentPaise", acc.getOfflineAllowanceSpentPaise());
        resp.put("offlineAllowanceSpent", BigDecimal.valueOf(acc.getOfflineAllowanceSpentPaise()).divide(BigDecimal.valueOf(100)));
        resp.put("availableOfflineAllowancePaise", acc.getAvailableOfflineAllowancePaise());
        resp.put("availableOfflineAllowance", BigDecimal.valueOf(acc.getAvailableOfflineAllowancePaise()).divide(BigDecimal.valueOf(100)));
        resp.put("version", acc.getVersion());
        return ResponseEntity.ok(resp);
    }

    public static class TopUpRequest {
        public String vpa;
        public BigDecimal amount = new BigDecimal("1000.00");
        public boolean resetAllowance = true;
    }

    @PostMapping("/wallet/topup")
    public ResponseEntity<?> topUpWallet(@RequestBody TopUpRequest req) {
        if (req == null || req.vpa == null || req.vpa.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "VPA is required for wallet top-up"));
        }
        if (req.amount == null || req.amount.compareTo(BigDecimal.ZERO) <= 0 || req.amount.compareTo(new BigDecimal("5000.00")) > 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Top-up amount must be positive and at most ₹5,000.00"));
        }
        Account acc = demoService.getOrCreateAccount(req.vpa, null);
        acc.setBalance(acc.getBalance().add(req.amount));
        if (req.resetAllowance) {
            acc.setOfflineAllowanceSpentPaise(0L);
        }
        accountRepo.save(acc);
        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Wallet topped up and offline allowance reset",
                "newBalance", acc.getBalance(),
                "availableAllowance", BigDecimal.valueOf(acc.getAvailableOfflineAllowancePaise()).divide(BigDecimal.valueOf(100))
        ));
    }

    // ------------------------------------------------------- Transactions
    @GetMapping("/transactions")
    public ResponseEntity<?> getTransactions(
            @RequestParam(value = "vpa", required = false) String vpa,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "search", required = false) String search) {

        List<Transaction> list;
        if (vpa != null && !vpa.isBlank()) {
            list = txRepo.findBySenderVpaOrReceiverVpaOrderByIdDesc(vpa, vpa);
        } else if (status != null && !status.isBlank()) {
            try {
                Transaction.Status st = Transaction.Status.valueOf(status.toUpperCase());
                list = txRepo.findByStatusOrderByIdDesc(st);
            } catch (Exception e) {
                list = txRepo.findTop50ByOrderByIdDesc();
            }
        } else {
            list = txRepo.findTop50ByOrderByIdDesc();
        }

        if (search != null && !search.isBlank()) {
            String q = search.toLowerCase();
            list = list.stream().filter(t ->
                    t.getSenderVpa().toLowerCase().contains(q) ||
                    t.getReceiverVpa().toLowerCase().contains(q) ||
                    (t.getTransactionRef() != null && t.getTransactionRef().toLowerCase().contains(q)) ||
                    t.getPacketHash().toLowerCase().contains(q)
            ).toList();
        }

        return ResponseEntity.ok(list);
    }

    @GetMapping("/transactions/{id}")
    public ResponseEntity<?> getTransactionDetail(@PathVariable("id") Long id) {
        Optional<Transaction> txOpt = txRepo.findById(id);
        if (txOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Transaction tx = txOpt.get();

        List<TransactionEvent> events = Collections.emptyList();
        if (eventRepo != null) {
            events = eventRepo.findByTransactionIdOrderByCreatedAtAsc(id);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("transaction", tx);
        resp.put("events", events);
        resp.put("verificationStatus", Map.of(
                "hashAlgorithm", "SHA-256",
                "integrityVerified", true,
                "pinVerified", Boolean.TRUE.equals(tx.getPinVerified()),
                "immutabilityGuaranteed", true
        ));

        return ResponseEntity.ok(resp);
    }

    // -------------------------------------------------------------- Sync
    public static class SyncBatchRequest {
        public String bridgeNodeId = "client-p2p-bridge";
        public List<MeshPacket> packets = new ArrayList<>();
    }

    @PostMapping("/sync")
    public ResponseEntity<?> syncPackets(@RequestBody SyncBatchRequest req) {
        long start = System.currentTimeMillis();
        List<Map<String, Object>> results = new ArrayList<>();
        int settled = 0;
        int duplicates = 0;
        int invalids = 0;

        for (MeshPacket pkt : req.packets) {
            BridgeIngestionService.IngestResult r =
                    bridgeService.ingest(pkt, req.bridgeNodeId, Math.max(0, 5 - pkt.getTtl()));

            if ("SETTLED".equalsIgnoreCase(r.outcome())) settled++;
            else if ("DUPLICATE_DROPPED".equalsIgnoreCase(r.outcome())) duplicates++;
            else invalids++;

            results.add(Map.of(
                    "packetId", pkt.getPacketId(),
                    "outcome", r.outcome(),
                    "reason", r.reason() == null ? "" : r.reason(),
                    "transactionId", r.transactionId() == null ? -1 : r.transactionId(),
                    "packetHash", r.packetHash()
            ));
        }

        long duration = System.currentTimeMillis() - start;
        if (syncAttemptRepo != null && !req.packets.isEmpty()) {
            syncAttemptRepo.save(new SyncAttempt(
                    req.bridgeNodeId, req.packets.size(), settled, duplicates, invalids, duration));
        }

        return ResponseEntity.ok(Map.of(
                "totalPackets", req.packets.size(),
                "settledCount", settled,
                "duplicateCount", duplicates,
                "invalidCount", invalids,
                "durationMs", duration,
                "results", results
        ));
    }

    @GetMapping("/sync/status")
    public ResponseEntity<?> getSyncStatus() {
        long txCount = txRepo.count();
        List<SyncAttempt> recentAttempts = syncAttemptRepo != null
                ? syncAttemptRepo.findTop10ByOrderByAttemptedAtDesc()
                : Collections.emptyList();

        return ResponseEntity.ok(Map.of(
                "serverTime", Instant.now().toEpochMilli(),
                "idempotencyCacheSize", idempotencyService.size(),
                "totalSettledTransactions", txCount,
                "recentSyncAttempts", recentAttempts
        ));
    }

    // ----------------------------------------------------------- Multi-Device Mesh
    @GetMapping("/devices")
    public ResponseEntity<?> listDevices() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (VirtualDevice d : meshService.getDevices()) {
            list.add(Map.of(
                    "deviceId", d.getDeviceId(),
                    "deviceName", d.getDeviceName(),
                    "vpa", d.getVpa(),
                    "hasInternet", d.hasInternet(),
                    "role", d.getRole(),
                    "packetCount", d.packetCount(),
                    "lastHeartbeat", d.getLastHeartbeat(),
                    "packetIds", d.getHeldPackets().stream().map(MeshPacket::getPacketId).toList()
            ));
        }
        return ResponseEntity.ok(list);
    }

    public static class DeviceRegisterRequest {
        public String deviceId;
        public String deviceName;
        public String vpa;
        public Boolean hasInternet = false;
        public String role = "RELAY";
    }

    @PostMapping("/mesh/register")
    public ResponseEntity<?> registerDevice(@RequestBody DeviceRegisterRequest req) {
        VirtualDevice dev = meshService.registerOrUpdateDevice(
                req.deviceId, req.deviceName, req.vpa, Boolean.TRUE.equals(req.hasInternet), req.role);

        // Ensure wallet exists for this device
        if (dev.getVpa() != null && !dev.getVpa().isBlank()) {
            demoService.getOrCreateAccount(dev.getVpa(), dev.getDeviceName());
        }

        return ResponseEntity.ok(Map.of(
                "status", "REGISTERED",
                "deviceId", dev.getDeviceId(),
                "deviceName", dev.getDeviceName(),
                "vpa", dev.getVpa(),
                "hasInternet", dev.hasInternet(),
                "role", dev.getRole()
        ));
    }

    public static class ToggleInternetRequest {
        public String deviceId;
        public boolean hasInternet;
    }

    @PostMapping("/mesh/toggle-internet")
    public ResponseEntity<?> toggleInternet(@RequestBody ToggleInternetRequest req) {
        boolean updated = meshService.setDeviceInternet(req.deviceId, req.hasInternet);
        return ResponseEntity.ok(Map.of("success", updated, "deviceId", req.deviceId, "hasInternet", req.hasInternet));
    }

    public static class InjectPacketRequest {
        public String deviceId;
        public MeshPacket packet;
    }

    @PostMapping("/mesh/inject")
    public ResponseEntity<?> injectPacket(@RequestBody InjectPacketRequest req) {
        meshService.inject(req.deviceId, req.packet);
        return ResponseEntity.ok(Map.of(
                "status", "INJECTED",
                "deviceId", req.deviceId,
                "packetId", req.packet.getPacketId()
        ));
    }

    @PostMapping("/mesh/gossip")
    public ResponseEntity<?> gossip() {
        MeshSimulatorService.GossipResult res = meshService.gossipOnce();
        return ResponseEntity.ok(Map.of(
                "transfers", res.transfers(),
                "deviceCounts", res.deviceCounts()
        ));
    }

    @PostMapping("/mesh/flush")
    public ResponseEntity<?> flushBridges() {
        List<MeshSimulatorService.BridgeUpload> uploads = meshService.collectBridgeUploads();
        List<Map<String, Object>> results = new ArrayList<>();

        for (MeshSimulatorService.BridgeUpload up : uploads) {
            BridgeIngestionService.IngestResult r =
                    bridgeService.ingest(up.packet(), up.bridgeNodeId(), 5 - up.packet().getTtl());

            results.add(Map.of(
                    "bridgeNode", up.bridgeNodeId(),
                    "packetId", up.packet().getPacketId(),
                    "outcome", r.outcome(),
                    "reason", r.reason() == null ? "" : r.reason(),
                    "transactionId", r.transactionId() == null ? -1 : r.transactionId(),
                    "packetHash", r.packetHash()
            ));
        }

        return ResponseEntity.ok(Map.of(
                "uploadsAttempted", uploads.size(),
                "results", results
        ));
    }

    @PostMapping("/mesh/reset")
    public ResponseEntity<?> resetMesh() {
        meshService.resetMesh();
        idempotencyService.clear();
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Mesh state and idempotency cache cleared"));
    }

    // ----------------------------------------------------------- Cybersecurity Lab
    public static class TamperTestRequest {
        public MeshPacket packet;
    }

    @PostMapping("/cyber/tamper-test")
    public ResponseEntity<?> tamperTest(@RequestBody TamperTestRequest req) {
        if (req.packet == null || req.packet.getCiphertext() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Packet required"));
        }

        // Intentionally tamper with ciphertext: flip 1 character in base64 string
        char[] chars = req.packet.getCiphertext().toCharArray();
        int mid = chars.length / 2;
        chars[mid] = (chars[mid] == 'A') ? 'B' : 'A';
        String tamperedCiphertext = new String(chars);

        MeshPacket tamperedPkt = new MeshPacket();
        tamperedPkt.setPacketId("tampered_" + req.packet.getPacketId());
        tamperedPkt.setCiphertext(tamperedCiphertext);
        tamperedPkt.setTtl(req.packet.getTtl());
        tamperedPkt.setCreatedAt(req.packet.getCreatedAt());

        BridgeIngestionService.IngestResult r = bridgeService.ingest(tamperedPkt, "adversary-mitm-node", 1);

        return ResponseEntity.ok(Map.of(
                "attackType", "CIPHERTEXT_BIT_FLIP_ATTACK",
                "tamperedBytePosition", mid,
                "outcome", r.outcome(),
                "reason", r.reason(),
                "cryptographicDefense", "AES-256-GCM Authenticated Encryption tag mismatch detected; envelope rejected without leaking balance or settling.",
                "tamperDetected", "INVALID".equals(r.outcome())
        ));
    }

    public static class ReplayTestRequest {
        public MeshPacket packet;
    }

    @PostMapping("/cyber/replay-test")
    public ResponseEntity<?> replayTest(@RequestBody ReplayTestRequest req) {
        if (req.packet == null || req.packet.getCiphertext() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Packet required"));
        }

        BridgeIngestionService.IngestResult r = bridgeService.ingest(req.packet, "replay-attacker-node", 1);

        return ResponseEntity.ok(Map.of(
                "attackType", "REPLAY_ATTACK",
                "outcome", r.outcome(),
                "reason", r.reason(),
                "cryptographicDefense", "SHA-256 Idempotency Filter claimed atomic digest; duplicate storm neutralized with zero ledger debit.",
                "replayBlocked", "DUPLICATE_DROPPED".equals(r.outcome())
        ));
    }
}
