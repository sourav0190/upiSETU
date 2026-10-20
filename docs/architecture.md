# MeshPay — Secure Offline Payment Experience
## Architecture and Technical Design Specification

### 1. Executive Summary & Product Vision
**MeshPay** is an offline-first, store-and-forward peer-to-peer digital payment prototype. It is modeled on real-world fintech workflows (Google Pay, PhonePe, UPI Lite) to demonstrate how nearby devices can securely initiate and route deferred payment promises without an active cellular or internet connection, settling with the backend ledger once connectivity is restored.

```
+---------------------------------------------------------------------------------------------------+
|                                   MESHPAY HIGH-LEVEL ARCHITECTURE                                |
+---------------------------------------------------------------------------------------------------+

 [ Offline Sender Phone ]                  [ Offline Peer / Merchant ]               [ Bridge Node ]
+-------------------------+              +-----------------------------+         +--------------------+
| UI: Mobile Fintech Web  |              | UI: Merchant QR / Soundbox  |         | Background Worker  |
| - Keypad & Recipient    |              | - Scans / Pairs P2P         |         | - Holds Packets    |
| - Web Crypto: AES + RSA |   BLE / P2P  | - Verifies Packet Format    |  BLE    | - Detects Internet |
| - Local Queue (IndexedDB| ------------>| - Queues Packet in Local DB | ------->|   (Cellular / Wi-Fi|
+-------------------------+              +-----------------------------+         +---------+----------+
                                                                                           |
                                                                                HTTPS POST | /api/v1/sync
                                                                                           v
                                                                             +----------------------------+
                                                                             | CENTRAL MESHPAY BACKEND    |
                                                                             | (Spring Boot 3.3.5 / Java) |
                                                                             |----------------------------|
                                                                             | 1. SHA-256 Deduplication   |
                                                                             | 2. Idempotency Gate (Redis)|
                                                                             | 3. RSA-OAEP Decryption     |
                                                                             | 4. Freshness Replay Filter |
                                                                             | 5. @Transactional Ledger   |
                                                                             | 6. Optimistic Locking DB   |
                                                                             +--------------+-------------+
                                                                                            |
                                                                               PostgreSQL / H2 In-Memory
                                                                             +--------------v-------------+
                                                                             | - users, devices, wallets  |
                                                                             | - transactions & events    |
                                                                             | - idempotency_keys         |
                                                                             +----------------------------+
```

---

### 2. Repository Audit: Baseline vs. Upgraded System

| Component / Dimension | Existing Baseline (`perryvegehan`) | MeshPay Upgraded Architecture |
|---|---|---|
| **User Interface** | Basic single-page developer table (`dashboard.html`) | Premium, responsive Fintech Web App (Google Pay / PhonePe aesthetic), Dark/Light mode, Lucide icons, 8 dedicated flows (Onboarding, Home, Pay Nearby, Receive, Details, History, Sync, Profile). |
| **Client Payment Flow** | Server-side simulated endpoint (`/api/demo/send`) generates the packet | True client-side offline execution: Web Crypto API generates one-time AES-256 keys, encrypts payload, encrypts AES key with RSA public key, stores in persistent local queue (`IndexedDB`). |
| **Offline Wallet Logic** | Single balance per account; no concept of offline reservation | Structured wallet: Total Balance, Reserved Offline Allowance, Available Online Balance, Disputed/Reconciliation Balance. |
| **State Machine** | Only 2 states: `SETTLED`, `REJECTED` | 9-state distributed payment state machine: `CREATED`, `AUTHENTICATED`, `QUEUED_OFFLINE`, `RECEIVED_LOCALLY`, `PENDING_SETTLEMENT`, `SETTLED`, `REJECTED`, `FAILED`, `REQUIRES_RECONCILIATION`. |
| **Database Schema** | 2 tables (`accounts`, `transactions`) with raw decimal amounts | Relational schema (`users`, `devices`, `wallets`, `transactions`, `transaction_events`, `idempotency_keys`, `sync_attempts`), integer paise amounts + strict constraints, Flyway / PostgreSQL readiness. |
| **Security & Cryptography** | Server-side RSA-2048 + AES-256-GCM | Client + Server hybrid encryption, nonce replay protection, 24h freshness window, device credentials, PIN hash validation, tamper-evident GCM authentication tags. |
| **Idempotency & Replay** | In-memory `ConcurrentHashMap` with fixed TTL | Multi-tier idempotency: Fast in-memory cache + durable database unique constraint on `packet_hash` + event audit log. |
| **Synchronisation & Mesh** | In-memory `VirtualDevice` batch gossip loop | Persistent client queue with exponential backoff, retry limits, conflict handling, and interactive bridge simulation. |

---

### 3. Layered Architectural Decomposition

```mermaid
graph TD
    subgraph Presentation_Layer["Presentation Layer (Client App)"]
        UI[Responsive Fintech SPA]
        NAV[Tab / Screen Router]
        STATE[Local Reactive State Store]
        CRYPTO_C[Web Crypto Client Engine]
        QUEUE[Persistent Queue: IndexedDB / LocalStorage]
    end

    subgraph Network_Transport["Transport & Bridging"]
        BLE[P2P / BLE Simulation & Web Bluetooth]
        HTTP_CLIENT[Fetch Client with Retry & Backoff]
    end

    subgraph API_Gateway["API & Controller Layer"]
        C_WALLET[Wallet & Account Controller]
        C_TX[Transaction Controller]
        C_SYNC[Synchronisation & Bridge Controller]
        C_MESH[Mesh Simulator Controller]
    end

    subgraph Service_Domain["Service & Domain Logic"]
        S_INGEST[Bridge Ingestion Pipeline]
        S_IDEMP[Idempotency & Deduplication Engine]
        S_CRYPTO[Hybrid Cryptography Service]
        S_SETTLE[Atomic Settlement Service]
        S_AUDIT[Transaction Event & Audit Service]
    end

    subgraph Persistence_Layer["Durable Storage Layer"]
        DB[(PostgreSQL / H2 RDBMS)]
        T_USERS[users & devices]
        T_WALLETS[wallets & balances]
        T_TXS[transactions & events]
        T_IDEMP[idempotency_keys]
    end

    UI --> STATE
    STATE --> CRYPTO_C
    CRYPTO_C --> QUEUE
    QUEUE --> BLE
    QUEUE --> HTTP_CLIENT
    HTTP_CLIENT --> API_Gateway
    API_Gateway --> Service_Domain
    Service_Domain --> Persistence_Layer
```

---

### 4. Core Distributed Systems Principles in MeshPay

1. **Store-Carry-and-Forward (DTN - RFC 4838):**
   Unlike standard TCP/IP requiring an active end-to-end circuit, Delay-Tolerant Networking treats transport as asynchronous. Packets are persisted to non-volatile local storage on whatever device holds them, physically carried across space, and opportunistically forwarded when another peer is detected.

2. **At-Least-Once Transport + Idempotent Processing = Exactly-Once Semantics:**
   In epidemic gossip routing, duplicate delivery is guaranteed: multiple peer bridges will upload copies of the same transaction packet to the backend. The backend computes the deterministic cryptographic hash `SHA-256(ciphertext)` before decryption and claims it atomically. Redundant deliveries are dropped without incurring decryption or ledger update overhead.

3. **Deferred Settlement vs. Real-Time Settlement:**
   Online UPI provides real-time irrevocable settlement in < 2 seconds through NPCI and Immediate Payment Service (IMPS). In MeshPay, an offline transfer is an **authenticated cryptographically signed promise (IOU)**. Settlement is deferred until internet ingress occurs. To prevent malicious over-spending offline, MeshPay introduces an **offline spending allowance** (similar to RBI UPI Lite guidelines).
