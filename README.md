# 📡 MeshPay — Secure Offline Payment Experience
> **Store-and-Forward Peer-to-Peer Fintech Prototype with Hybrid Cryptography, Multi-Tier Idempotency & Delay-Tolerant Mesh Routing**

[![Build & Test](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Java 21 LTS](https://img.shields.io/badge/Java-21%20LTS-orange.svg)]()
[![Spring Boot 3.3.5](https://img.shields.io/badge/Spring%20Boot-3.3.5-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-14%2F14%20passing-success.svg)]()
[![Web Crypto](https://img.shields.io/badge/Cryptography-AES--256--GCM%20%2B%20RSA--2048-blue.svg)]()

---

## 🌟 Overview & Product Vision

**MeshPay** is a premium, offline-first digital payment prototype inspired by the simplicity of Google Pay, the clarity of PhonePe, and the security architecture of modern fintech systems.

In real-world environments—such as crowded stadiums, underground metro stations, highway tunnels, rural villages, or during natural disaster infrastructure blackouts—active cellular (4G/5G) and Wi-Fi internet connectivity frequently drops. Standard UPI (Unified Payments Interface) fails in these conditions because its centralized star topology requires simultaneous, uninterrupted client-server sockets on both payer and payee devices.

MeshPay solves this using a **Store-and-Forward Delay-Tolerant Network (DTN - RFC 4838)**:
1. **Offline Payer Phone:** Composes an authenticated payment instruction and encapsulates it into a zero-trust envelope using **Web Crypto Hybrid Encryption (AES-256-GCM + Central Bank RSA-2048-OAEP)**.
2. **Untrusted Peer Relays:** Encrypted packets hop phone-to-phone via wireless mesh gossip (decrementing TTL) without any intermediate peer being able to read balances, amounts, or PINs.
3. **Opportunistic Bridge Nodes:** When any device in the crowd eventually emerges outside and catches 4G cellular signal, it automatically uploads collected packets to the Central Bank backend.
4. **Central Backend Ledger:** Computes `SHA-256(ciphertext)` to atomically deduplicate redundant deliveries (solving the *Duplicate Storm* problem), decrypts the instruction, verifies PIN authenticity and account solvency, and atomically settles the ledger using `@Transactional` and Hibernate `@Version` optimistic locking.

> [!NOTE]
> **Prototype Disclaimer:** All wallet balances, accounts, and transactions in MeshPay use simulated funds for engineering and academic demonstration. MeshPay does not process real money or connect to real banking networks.

---

## 🏗️ Architecture & High-Level Flow

```
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

## 📱 User Interface (The 8 Complete User Flows)

MeshPay includes a fully responsive, modern mobile-first web application served directly by Spring Boot:

- **Screen A (Onboarding):** DTN mesh overview, security explanation, prototype disclaimer, and permission guide.
- **Screen B (Home Dashboard):** Personal greeting, wallet balance with eye hide/show toggle, offline spending allowance meter (₹2,000 cap), network status simulator (Online 4G vs. Offline Basement), quick action tiles, and recent transactions.
- **Screen C (Pay Nearby):** BLE peer discovery radar, recipient verification card, financial numeric keypad (`+₹50`, `+₹100`, `+₹500` quick pills), 4-digit PIN authentication modal, Web Crypto packet creation, and local queueing.
- **Screen D (Receive Payment):** Dynamic pairing QR code generator, recipient identity badge, and **interactive Soundbox audio synthesis** using the Web Speech API.
- **Screen E (Transaction Details Modal):** SHA-256 cryptographic verification badge, packet hash preview, hop count, delivering bridge ID, and event sourcing timeline.
- **Screen F (Transaction History):** Real-time search by VPA or hash, filter chips (`ALL`, `SETTLED`, `QUEUED_OFFLINE`, `REJECTED`), and incoming/outgoing indicators.
- **Screen G (Sync Centre):** IndexedDB outbox viewer, connection status, manual "Reconcile Now" trigger, and bridge upload simulation.
- **Screen H (Profile & Settings):** User details, dark/light theme switch, offline allowance management, hardware key fingerprints, and demo data reset.

---

## ⚡ Quick Start (Run Locally in 60 Seconds)

### Prerequisites
- **JDK 17 or 21+** (check via `java -version`)
- **Maven** (or included `./mvnw` / `.\mvnw.cmd` wrapper)

### 1. Start the Server & Web App
```powershell
mvn clean spring-boot:run
```
*(On Windows cmd: `.\mvnw.cmd spring-boot:run` | On Linux/macOS: `./mvnw spring-boot:run`)*

### 2. Access the Application
- **Fintech Single Page Application (Google Pay / PhonePe UI):**  
  👉 **[http://localhost:8080/](http://localhost:8080/)**
- **Classic Developer Diagnostic Dashboard:**  
  👉 **[http://localhost:8080/classic](http://localhost:8080/classic)**
- **Embedded H2 Database Browser:**  
  👉 **[http://localhost:8080/h2-console](http://localhost:8080/h2-console)** *(JDBC URL: `jdbc:h2:mem:upimesh`, User: `sa`, Password: empty)*

---

## 🧪 Comprehensive Automated Test Results

MeshPay includes 14 automated unit, concurrency, security, and integration tests. Run all tests with:
```powershell
mvn test
```

### Verified Test Summary (`14 / 14 Passing - 0 Failures`):
| Test Class | Focus Area | Result |
|---|---|---|
| `IdempotencyConcurrencyTest` | 3 simultaneous bridge uploads of identical packet + tamper test | **3 / 3 PASSED** |
| `SecurityAndReplayTest` | Stale timestamp rejection (> 24h), future-dated rejection, replay filtering | **3 / 3 PASSED** |
| `WalletAndSettlementUnitTest` | Atomic debit/credit, integer paise arithmetic, PIN validation, overdraft rejection | **4 / 4 PASSED** |
| `ApiV1IntegrationTest` | REST API contracts, `/api/v1/wallet`, `/api/v1/sync` batch processing | **4 / 4 PASSED** |

---

## 📚 Complete Project Documentation Suite

Explore the comprehensive technical design documents in the [`docs/`](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs) folder:

1. [**docs/architecture.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/architecture.md) — System architecture, layered decomposition, and DTN principles.
2. [**docs/system-design.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/system-design.md) — C4 context and component diagrams, CAP theorem, and modular monolith trade-offs.
3. [**docs/payment-flow.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/payment-flow.md) — End-to-end payment sequence diagram and 9-state transaction lifecycle state machine.
4. [**docs/database-design.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/database-design.md) — Relational schema ER diagram, ACID transaction mechanics, and "No-Float" integer paise rule.
5. [**docs/api-reference.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/api-reference.md) — Complete REST API contract specifications and payload examples.
6. [**docs/security.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/security.md) — Threat model matrix, hybrid cryptographic wire format, and honest limitations.
7. [**docs/testing.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/testing.md) — Quality assurance report and verified execution logs.
8. [**docs/deployment.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/deployment.md) — Local development, Docker Compose, and PostgreSQL configuration.
9. [**docs/learning-roadmap.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/learning-roadmap.md) — Academic topic map (Networks, DBMS, DSA, OS, Java) + 7-day and 4-week study plans.
10. [**docs/viva-questions.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/viva-questions.md) — 60 project-specific questions with spoken model answers, technical depth, and pitfalls to avoid.
11. [**docs/ai-contributions.md**](file:///c:/Users/soura/Desktop/Synopsis/upiSETU/docs/ai-contributions.md) — Transparent breakdown of AI-assisted upgrades and student mastery checklist.

---

## 💡 Key Viva & Interview Concepts (In 60 Seconds)

1. **Why not standard UPI?** Standard UPI requires active internet sockets connecting both devices to NPCI. MeshPay routes deferred authenticated payment instructions over peer-to-peer radio without internet.
2. **The Duplicate Storm:** When 3 bridge nodes walk into 4G signal with the same packet, the bank computes `SHA-256(ciphertext)` before decryption. Exactly one thread claims the hash atomically; the other two are dropped immediately.
3. **Why Hybrid Encryption?** RSA-2048 cannot encrypt payloads larger than ~214 bytes. AES-256 is fast and supports arbitrary sizes. We generate a fresh AES key per transaction, encrypt the JSON payload with AES-GCM, and encrypt only the AES key with RSA-OAEP.
4. **Is Offline Double-Spending Solved?** In pure software, no. Like RBI's UPI Lite, MeshPay bounds offline financial risk using a **pre-funded offline spending allowance** (capped at ₹2,000). Production hardware solutions require a Secure Enclave (eSE/UICC).
