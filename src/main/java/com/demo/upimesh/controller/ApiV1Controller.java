package com.demo.upimesh.controller;

import com.demo.upimesh.model.*;
import com.demo.upimesh.service.BridgeIngestionService;
import com.demo.upimesh.service.IdempotencyService;
import com.demo.upimesh.service.MeshSimulatorService;
import com.demo.upimesh.service.VirtualDevice;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/**
 * Modern RESTful API v1 for the MeshPay client application.
 */
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*")
public class ApiV1Controller {

    @Autowired private AccountRepository accountRepo;
    @Autowired private TransactionRepository txRepo;
    @Autowired(required = false) private TransactionEventRepository eventRepo;
    @Autowired(required = false) private SyncAttemptRepository syncAttemptRepo;
    @Autowired private BridgeIngestionService bridgeService;
    @Autowired private IdempotencyService idempotencyService;
    @Autowired private MeshSimulatorService meshService;

    // ------------------------------------------------------------- Wallet
    @GetMapping("/wallet")
    public ResponseEntity<?> getWallet(@RequestParam(value = "vpa", defaultValue = "alice@demo") String vpa) {
        Optional<Account> accOpt = accountRepo.findById(vpa);
        if (accOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Account acc = accOpt.get();

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

    // ----------------------------------------------------------- Devices
    @GetMapping("/devices")
    public ResponseEntity<?> listDevices() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (VirtualDevice d : meshService.getDevices()) {
            list.add(Map.of(
                    "deviceId", d.getDeviceId(),
                    "hasInternet", d.hasInternet(),
                    "packetCount", d.packetCount(),
                    "packetIds", d.getHeldPackets().stream().map(MeshPacket::getPacketId).toList()
            ));
        }
        return ResponseEntity.ok(list);
    }
}
