# MeshPay — Complete Learning Roadmap & Revision Plan

## 1. Topic Map by Academic Discipline

### 1. Computer Networks
| Topic | Relevance Level | Where it Appears in MeshPay |
|---|---|---|
| **Delay-Tolerant Networking (DTN - RFC 4838)** | **MUST KNOW** | Store-carry-and-forward architecture in `MeshPacket.java` and `mesh.js`. |
| **Ad-Hoc Wireless Mesh vs. Star Topology** | **MUST KNOW** | Comparison between standard cellular UPI (star) and peer-to-peer BLE gossip (mesh). |
| **Hop Limit / TTL (Time To Live)** | **MUST KNOW** | `ttl` field decremented on each transfer to prevent infinite broadcast loops. |
| **HTTP/HTTPS & REST APIs** | **MUST KNOW** | `/api/v1/sync` and `/api/bridge/ingest` communication between bridge and backend. |
| **Bluetooth Low Energy (BLE) Advertising & GATT** | **SHOULD KNOW** | Peer discovery simulation (`meshNetwork.scanForPeers()` and RSSI calculation). |
| **TCP vs. UDP** | **SHOULD KNOW** | Reliable stream delivery (TCP) for bridge-to-backend vs. best-effort broadcast (BLE). |
| **OSI 7-Layer Model Mapping** | **SHOULD KNOW** | Clear separation between Network Layer (cleartext packetId/TTL) and Application Layer (encrypted payload). |
| **DNS & Socket Programming** | **OPTIONAL** | Underlying mechanics of IP address resolution. |

---

### 2. Database Management Systems (DBMS)
| Topic | Relevance Level | Where it Appears in MeshPay |
|---|---|---|
| **ACID Properties** | **MUST KNOW** | `SettlementService.settle()` wrapped in `@Transactional`. Debit and credit succeed or fail together. |
| **Optimistic vs. Pessimistic Locking** | **MUST KNOW** | `@Version` annotation on `Account.java` preventing lost updates under concurrent debits. |
| **Monetary Precision & Float Pitfalls** | **MUST KNOW** | Integer minor currency units (`balancePaise`, `amountPaise`) preventing IEEE 754 float drift. |
| **Primary Keys, Foreign Keys & Unique Constraints**| **MUST KNOW** | `packet_hash` unique index in `Transaction.java` enforcing idempotency at DB level. |
| **Database Normalisation (1NF, 2NF, 3NF)** | **SHOULD KNOW** | Entity design splitting `accounts`, `transactions`, `transaction_events`, and `idempotency_keys`. |
| **Transaction Isolation Levels** | **SHOULD KNOW** | `READ_COMMITTED` preventing dirty reads during concurrent balance checks. |
| **Database Migrations (Flyway/Liquibase)** | **OPTIONAL** | Schema versioning in production deployments. |

---

### 3. Cybersecurity & Cryptography
| Topic | Relevance Level | Where it Appears in MeshPay |
|---|---|---|
| **Hybrid Encryption Pattern** | **MUST KNOW** | AES-256-GCM for payload + RSA-2048-OAEP for AES key in `HybridCryptoService.java` & `crypto.js`. |
| **Authenticated Encryption (AEAD)** | **MUST KNOW** | 128-bit Galois Authentication Tag in AES-GCM; any bit flip causes `AEADBadTagException`. |
| **Replay Attack Defense** | **MUST KNOW** | UUID nonce + 24-hour freshness timestamp check in `BridgeIngestionService.java`. |
| **Cryptographic Hash Functions** | **MUST KNOW** | `SHA-256(ciphertext)` calculated deterministically for zero-decryption deduplication. |
| **Symmetric vs. Asymmetric Cryptography** | **MUST KNOW** | Why RSA alone is too small (capacity limit) and AES alone is insecure for untrusted intermediaries. |
| **Hardware Secure Enclaves (eSE / UICC)** | **SHOULD KNOW** | Why production UPI Lite uses pre-funded hardware chips to prevent offline double-spending. |
| **TLS / SSL Handshake** | **OPTIONAL** | Transport-layer security securing bridge-to-backend communication. |

---

### 4. Data Structures & Algorithms (DSA)
| Topic | Relevance Level | Where it Appears in MeshPay |
|---|---|---|
| **Hash Tables / ConcurrentHashMap** | **MUST KNOW** | Tier-1 in-memory idempotency cache in `IdempotencyService.java` using atomic `putIfAbsent()`. |
| **Queues (FIFO / Outbox Pattern)** | **MUST KNOW** | `IndexedDB` local outbox buffer on the client holding packets until connectivity is restored. |
| **State Machines (FSM)** | **MUST KNOW** | 9-state payment lifecycle (`CREATED` -> `QUEUED_OFFLINE` -> `RECEIVED_LOCALLY` -> `SETTLED`). |
| **Exponential Backoff & Jitter** | **SHOULD KNOW** | Retry scheduling algorithm in `MeshApp.backgroundSync()` preventing network thundering herds. |
| **Graph Traversal / Epidemic Gossip** | **SHOULD KNOW** | Breadth-first packet dissemination across virtual devices in `MeshSimulatorService.java`. |

---

### 5. Object-Oriented Programming & Java / Spring Boot
| Topic | Relevance Level | Where it Appears in MeshPay |
|---|---|---|
| **Dependency Injection & Inversion of Control** | **MUST KNOW** | Spring `@Autowired`, `@Service`, `@RestController`, `@Component` decoupling layers. |
| **Separation of Concerns (MVC/Layered)** | **MUST KNOW** | Controller -> Service -> Repository -> Entity architecture. |
| **Java Generics & Collections Framework** | **MUST KNOW** | `List<MeshPacket>`, `Map<String, Object>`, `Optional<Account>`. |
| **Exception Handling & Robustness** | **MUST KNOW** | Graceful handling of decryption errors, stale packets, and invalid VPAs. |
| **Immutability & Records** | **SHOULD KNOW** | `IngestResult` record class in `BridgeIngestionService.java`. |
| **Java Concurrency & Thread Pools** | **SHOULD KNOW** | `ExecutorService`, `CountDownLatch`, `AtomicInteger` in `IdempotencyConcurrencyTest.java`. |

---

## 2. Seven-Day Fast-Track Revision Plan

- **Day 1: Product Overview & Core Analogy**
  - Master the "Steel Lockbox" non-technical analogy.
  - Understand the difference between Real-time UPI and Store-and-Forward Mesh UPI.
- **Day 2: Cybersecurity & Hybrid Cryptography**
  - Explain why RSA-2048 alone cannot encrypt the payload ($< 214$ bytes limit).
  - Walk through AES-256-GCM authenticated encryption and how tamper detection works.
- **Day 3: Distributed Systems, Idempotency & The Duplicate Storm**
  - Explain why 3 bridge nodes deliver duplicate packets simultaneously.
  - Walk through `SHA-256(ciphertext)` hashing and `ConcurrentHashMap.putIfAbsent()`.
- **Day 4: Database Design, ACID & Optimistic Locking**
  - Walk through the ER diagram (`accounts`, `transactions`, `events`, `idempotency_keys`).
  - Explain `@Version` optimistic locking and why integer paise units are used instead of `float`.
- **Day 5: Payment Sequence & Transaction State Machine**
  - Trace the complete lifecycle from `CREATED` on phone to `SETTLED` on ledger.
  - Explain how offline spending allowances prevent overspending.
- **Day 6: Networking & Offline Communication**
  - Explain BLE advertising vs GATT connections.
  - Understand the role of bridge nodes bridging BLE DTN to cellular HTTPS.
- **Day 7: Mock Viva & Code Walkthrough**
  - Run the application locally (`mvn spring-boot:run`).
  - Demonstrate a live offline payment, peer scan, and sync upload.
  - Practice answering the 60 viva questions out loud.

---

## 3. Four-Week Deep-Dive Learning Plan

- **Week 1: Foundations of Networking & Delay-Tolerant Networks**
  - Study RFC 4838 (DTN Architecture).
  - Practice socket programming and REST API design.
  - Compare BLE mesh topology vs standard Wi-Fi star topology.
- **Week 2: Advanced Relational Database Engineering**
  - Practice writing SQL DDL, indexes, and transactions.
  - Experiment with race conditions: simulate two simultaneous debits without `@Version`.
  - Explore PostgreSQL WAL logs and ACID isolation levels (`READ COMMITTED` vs `SERIALIZABLE`).
- **Week 3: Modern Cryptography & Fintech Security**
  - Study symmetric (AES) vs asymmetric (RSA, ECC) ciphers.
  - Implement Web Crypto API hybrid encryption in JavaScript from scratch.
  - Read RBI UPI Lite architectural guidelines on pre-funded offline hardware wallets.
- **Week 4: Full-Stack Architecture, Testing & Presentation Mastery**
  - Write unit, integration, and multi-threaded concurrency tests using JUnit 5.
  - Build and containerize the app using Docker and Docker Compose.
  - Deliver a complete technical presentation and project defense.
