# MeshPay — System Design and Architectural Trade-Offs

## 1. System Context Diagram (C4 Level 1)

```mermaid
graph TD
    User["Offline Payer / Merchant<br>(Smartphone User)"]
    Bridge["Stranger / Mobile Node<br>(Walks to 4G Coverage)"]
    MeshPay["MeshPay System<br>(Offline-First P2P Mesh & Core Bank Backend)"]
    CoreLedger["Central Bank Core Ledger<br>(Simulated RBI / NPCI Switch)"]

    User -->|"1. Composes payment & exchanges BLE packet"| User
    User -->|"2. Gossip forwards envelope (TTL hops)"| Bridge
    Bridge -->|"3. Ingests packet over HTTPS"| MeshPay
    MeshPay -->|"4. Settles debit & credit atomically"| CoreLedger
```

---

## 2. Component Decomposition (C4 Level 2)

```mermaid
graph LR
    subgraph Client_Device["Client Mobile Device (Offline)"]
        UI_Layer["Fintech SPA (Web Crypto & Keypad)"]
        IndexedDB_Store["Local Store (IndexedDB Outbox)"]
        BLE_Transport["BLE / P2P Gossip Transceiver"]
    end

    subgraph MeshPay_Backend["MeshPay Spring Boot Backend"]
        Ingestion_GW["Bridge Ingestion Gateway<br>(/api/v1/sync, /api/bridge/ingest)"]
        Idempotency_Eng["Idempotency Engine<br>(ConcurrentHashMap + DB unique index)"]
        Crypto_Engine["Hybrid Crypto Engine<br>(RSA-2048-OAEP + AES-256-GCM)"]
        Settlement_Svc["Atomic Settlement Service<br>(@Transactional & Optimistic Locking)"]
        Event_Logger["Transaction Audit Logger<br>(transaction_events table)"]
    end

    subgraph Durable_Storage["Relational Database"]
        DB_Accounts["accounts & wallets"]
        DB_Txs["transactions & idempotency_keys"]
    end

    UI_Layer --> IndexedDB_Store
    IndexedDB_Store --> BLE_Transport
    BLE_Transport -.->|"Cellular / Wi-Fi Gateway"| Ingestion_GW
    Ingestion_GW --> Idempotency_Eng
    Idempotency_Eng --> Crypto_Engine
    Crypto_Engine --> Settlement_Svc
    Settlement_Svc --> DB_Accounts
    Settlement_Svc --> DB_Txs
    Settlement_Svc --> Event_Logger
```

---

## 3. Distributed Systems Concepts & Trade-offs in MeshPay

### 1. CAP Theorem & Network Partitions
- **Consistency (C):** Every read receives the most recent write or an error.
- **Availability (A):** Every non-failing node returns a response, without guaranteeing it contains the most recent write.
- **Partition Tolerance (P):** The system continues to operate despite an arbitrary number of messages being dropped or delayed by the network between nodes.
- **MeshPay's Decision:**
  During an offline period (network partition $P$), strict global real-time consistency is mathematically impossible without communication. MeshPay chooses **Eventual Consistency with an Offline Allowance Bound**:
  - The client trades strict global consistency for local availability ($A$), allowing users to spend up to ₹2,000.00 from their reserved offline allowance.
  - When the bridge node delivers the packet to the central backend, the system reconciles to strong consistency ($C$) through atomic ledger settlement.

### 2. Naive Retries vs. Idempotency & Exponential Backoff
- **The Problem:** In a gossip network, multiple peers forward copies of the same transaction simultaneously. If the backend treated every HTTP request as a new instruction, Alice would be debited multiple times for a single payment.
- **The Solution:**
  1. Deterministic hashing: `SHA-256(ciphertext)`.
  2. Multi-tier idempotency:
     - Tier 1: In-memory `ConcurrentHashMap.putIfAbsent(hash, timestamp)` (mimicking Redis `SET key NX EX 86400`).
     - Tier 2: Relational database unique constraint on `transactions.packet_hash` and `idempotency_keys.key_hash`.
  3. Client retry with truncated exponential backoff ($T = \min(T_{max}, T_{base} \times 2^{attempt}) \pm \text{jitter}$).

### 3. Monolith vs. Microservices
- **Decision:** MeshPay is implemented as a **Modular Monolith**.
- **Rationale:** Microservices introduce distributed transactions (2-Phase Commit / Sagas), network latency between services, and operational overhead that obscures core payment invariants. A clean modular monolith provides in-process transactional boundaries (`@Transactional`), compile-time type safety, zero network overhead between crypto and ledger, and trivial local testing via H2.
