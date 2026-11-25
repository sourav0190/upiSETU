# MeshPay (upiSETU) — Comprehensive Viva Voce & Technical Defense Guide

---

## 1. Executive Summary & 2-Minute Elevator Pitch

> **Examiner Prompt:** *"Can you explain what your project is, what problem it solves, and how it works in 2 minutes?"*

**Candidate Pitch:**
> "Good morning, respected professors and external examiners.
>
> Our project is **MeshPay (upiSETU)**, an offline-first payment architecture and store-carry-forward simulation designed for zero-connectivity environments—such as underground transit tunnels, remote rural hamlets, disaster-affected regions, and congested festival zones where conventional UPI payments fail due to network timeouts.
>
> In regular UPI, every transaction requires real-time synchronous client-to-server cellular connectivity. If either the payer or the merchant loses 4G connectivity, the transaction fails.
>
> MeshPay solves this by decoupling **offline transaction signing** from **deferred backend settlement** through Delay-Tolerant Networking (RFC 4838).
>
> 1. **Client-Side Cryptographic Enclave:** When an offline user initiates a payment, the client generates a one-time 256-bit AES key, encrypts the payment instruction using **AES-256-GCM**, and wraps the AES key using the Central Bank's public key with **RSA-2048-OAEP**. The raw UPI PIN is never stored or transmitted; only a salted SHA-256 hash is signed on-device.
> 2. **Local Persistence:** The encrypted packet is immediately saved in the device's local **IndexedDB outbox**, ensuring transaction survival across battery outages and app restarts.
> 3. **Store-Carry-Forward Mesh Relaying:** The packet is propagated peer-to-peer across nearby Bluetooth Low Energy (BLE) devices using an epidemic gossip protocol. Intermediate relay devices have **zero-knowledge** of the payment content; they cannot inspect amounts, PINs, or account balances.
> 4. **Opportunistic Settlement:** As soon as any participating device enters cellular or Wi-Fi range (acting as a **Bridge Node**), it flushes its cached packets to the Central Bank's REST gateway.
> 5. **ACID Ledger & Dual-Tier Idempotency:** The Central Bank gateway enforces a two-tier defense: first, a SHA-256 ciphertext hash filter to drop duplicate network packets instantly; second, a relational unique constraint on `(senderVpa, nonce)` to eliminate re-encryption replay attacks before executing atomic ACID debit/credit ledger settlement.
>
> **Prototype Disclosure:** MeshPay is an educational simulation and engineering prototype. While our cryptographic and backend settlement pipelines are genuinely implemented and verified with 23 passing tests, the multi-hop BLE radio transport is simulated via WebSocket and REST gossip topology."

---

## 2. 5-Minute Structured Live Demonstration Script

| Minute | Screen / Workspace | Action | Spoken Explanation |
|---|---|---|---|
| **0:00 - 1:00** | **Header & Workspace 1 (Payments)** | Show user profile dropdown (Alice), balance card (₹5,000.00), and toggle connectivity status pill to **Offline (Mesh)**. | *"Here we see Alice's terminal. She is in a basement metro station with zero 4G connectivity. Notice our UI is organized into four distinct workspaces: Payments, Network, Transactions, and the Advanced Lab."* |
| **1:00 - 2:00** | **Workspace 1 (Payments)** | Select **Bob Verma (Merchant)**, choose ₹100, enter PIN `1234` on keypad, click **Sign & Dispatch**. | *"The Web Crypto API executes on Alice's device: it computes SHA-256(PIN), packages a canonical instruction with a cryptographic nonce, encrypts via AES-256-GCM, and envelopes with Bank RSA-2048-OAEP. The packet is stored in local IndexedDB (Pending Outbox: 1). Notice Alice's RBI UPI-Lite allowance gauge automatically decreases by ₹100."* |
| **2:00 - 3:00** | **Workspace 2 (Network Topology)** | Switch to Network tab. Show the SVG canvas with Alice, Bob, Carol, Dave, Eve Bridge, and Central Bank. Click **Step Single Hop**. | *"Alice has no 4G backhaul, so the packet hops over Bluetooth LE to peer Carol (Hop 1), then to Dave (Hop 2). Intermediate nodes only hold ciphertext. We can toggle 'Break Primary Link' to show dynamic gossip rerouting around network partitions."* |
| **3:00 - 4:00** | **Workspace 2 & Workspace 1** | Click **Sync Bridges to Bank** (or toggle Eve Bridge online). Listen for Soundbox voice chime. | *"Eve Bridge enters cellular coverage at the metro exit and flushes the packet to the Central Bank `/api/v1/sync` endpoint. The bank decrypts using its RSA private key, verifies idempotency, and executes atomic ledger settlement. Bob's Soundbox announces: 'MeshPay received 100 Rupees from Alice Sharma'."* |
| **4:00 - 5:00** | **Workspace 4 (Advanced Lab) & Workspace 3 (Transactions)** | Switch to Lab tab. Click **Run Experiment 3 (Replay Attack)** and **Run Experiment 4 (Tamper Attack)**. Switch to Transactions tab and click **Inspect**. | *"In the Advanced Lab, we demonstrate security: Experiment 3 submits an identical packet twice; the gateway drops it with `DUPLICATE_DROPPED`. Experiment 4 flips 1 bit in the ciphertext; AES-GCM authentication tag mismatch immediately rejects it. In the Transactions ledger, clicking Inspect displays the full cryptographic audit record."* |

---

## 3. 30 Deep Technical Questions & Authoritative Answers

### Category A: Cryptography & Packet Security (Q1 – Q8)

#### Q1: Why did you choose hybrid encryption instead of pure RSA or pure AES?
**Answer:** Pure RSA-2048 cannot encrypt arbitrary data larger than its key modulus minus padding overhead (at most 214 bytes under OAEP with SHA-1, or 190 bytes with SHA-256). Payment instructions with nonces, VPAs, and metadata exceed this size limit. Pure AES requires both the client and the bank to share a pre-distributed symmetric secret, which presents a severe key-distribution and storage risk on untrusted consumer phones. 
Hybrid cryptography gives the best of both worlds: a fresh, cryptographically random 256-bit AES key is generated per transaction on the fly, used to encrypt the payload with high-speed AES-256-GCM, and only the 32-byte AES key is enveloped using the Bank's RSA-2048 public key.

#### Q2: What exact padding scheme is used with RSA, and why is PKCS#1 v1.5 forbidden?
**Answer:** We strictly use **RSA-OAEP** (Optimal Asymmetric Encryption Padding) with SHA-256 as specified in RFC 8017. PKCS#1 v1.5 padding is vulnerable to Bleichenbacher's chosen-ciphertext padding oracle attack, where an attacker repeatedly queries a server and observes different error responses to systematically decrypt ciphertexts without knowing the private key. OAEP incorporates randomized masking and hash verification, preventing padding oracle vulnerabilities.

#### Q3: Why AES-GCM instead of AES-CBC or AES-CTR?
**Answer:** AES-GCM (Galois/Counter Mode) provides **Authenticated Encryption with Associated Data (AEAD)**. Unlike AES-CBC (which only provides confidentiality and is susceptible to bit-flipping attacks unless paired with an HMAC via Encrypt-then-MAC), AES-GCM simultaneously computes a 128-bit authentication tag over the ciphertext and initialization vector. If an intermediate forwarder alters even a single bit of the ciphertext, decryption fails with an authentication tag mismatch *before* any ledger processing occurs.

#### Q4: How is the UPI PIN handled? Does plaintext PIN ever touch storage or network?
**Answer:** No. Plaintext PIN never touches IndexedDB, `localStorage`, server network requests, or backend logs. In `processPaymentSubmission()`, the entered PIN is hashed immediately on the client using Web Crypto SHA-256: `pinHash = await crypto.subtle.digest('SHA-256', encoder.encode(pin))`. The raw PIN in JavaScript memory is immediately overwritten with an empty string. The backend verifies the `pinHash` against the salted hash stored in the user's Central Bank wallet record.

#### Q5: What is the purpose of the cryptographic Nonce?
**Answer:** The nonce (`nc_<timestamp>_<random>`) is a unique, single-use token embedded inside the plaintext payment instruction. It binds the payment to an explicit, non-repeatable transaction intent. Even if an attacker captures the payload or attempts to generate a new ciphertext with a different IV, the embedded nonce cannot be modified without invalidating the AES-GCM authentication tag.

#### Q6: How does the system handle Server RSA private key persistence across restarts?
**Answer:** In early prototypes, generating keys in memory (`KeyPairGenerator.generateKeyPair()`) caused all previous offline packets to fail decryption upon server reboot because the private key was lost. We engineered `ServerKeyHolder.java` to persist keys as DER/PKCS#8 encoded files (`server_private_key.der` and `server_public_key.der`) in `./data/keys/`. On boot, the server loads the existing keypair from disk, ensuring backward compatibility with previously signed offline packets.

#### Q7: Can an intermediate relay node alter the recipient VPA or the transaction amount?
**Answer:** No. The recipient VPA and amount are inside the plaintext JSON payload encrypted with AES-256-GCM. Because only the Central Bank holds the RSA private key required to decrypt the AES session key, an intermediate relay has zero capability to alter the payload. Any unauthorized modification destroys the 128-bit GCM tag, causing the bank to reject the packet during ingestion.

#### Q8: What prevents an attacker from generating a forged Central Bank public key?
**Answer:** In production architectures, the Central Bank's public key certificate is embedded directly into the trusted app binary or hardware Secure Element and verified against NPCI's root Certificate Authority (CA) chain. For our prototype, the public key is retrieved from `/api/v1/auth/public-key` and cached securely in the browser's persistent key storage.

---

### Category B: Network Routing & Delay-Tolerant Networking (Q9 – Q15)

#### Q9: What networking paradigm governs MeshPay's offline packet propagation?
**Answer:** MeshPay is based on **Delay-Tolerant Networking (DTN)** as formalized in **RFC 4838** and the Bundle Protocol (RFC 5050). DTN handles environments characterized by intermittent connectivity, long or variable delay, and the absence of end-to-end continuous paths. It relies on the **Store-Carry-Forward** model, where intermediate nodes act as physical or radio couriers holding encrypted bundles until encountering another node or a network ingress bridge.

#### Q10: How do you prevent endless packet looping and infinite network flooding?
**Answer:** We implement two complementary controls:
1. **Time-to-Live (TTL) Hop Limits:** Every packet contains a decrementing integer hop counter (default: 5 hops). Each relay node decrements the TTL before retransmitting. Once TTL reaches 0, the packet is discarded.
2. **Hop Expiration Timestamp:** The packet contains a `signedAt` epoch millisecond timestamp. Packets older than 24 hours (86,400 seconds) or with future timestamps exceeding 300 seconds (clock skew) are rejected by the gateway.

#### Q11: What is the difference between Epidemic Routing and Controlled Gossip Routing?
**Answer:** Pure epidemic routing blindly floods every known neighbor with copies of all held packets, which causes catastrophic battery drain, memory exhaustion, and radio spectrum contention in dense environments. Controlled gossip routing restricts forwarding:
- Nodes exchange Bloom filters or vector summaries of held packet hashes.
- Packets are forwarded only to neighbors who do not already possess the hash.
- Hop limits (TTL) constrain network depth.

#### Q12: What are the physical constraints of Bluetooth Low Energy (BLE) for offline packets?
**Answer:** Standard Bluetooth 4.0/4.2 specifies an Attribute Protocol (ATT) Maximum Transmission Unit (MTU) of **23 bytes** (3 bytes header, 20 bytes payload). Bluetooth 5.0+ supports Data Length Extension (DLE) up to **251 bytes** and MTU exchange up to **512 bytes**. Because our RSA-2048 + AES-256-GCM envelope is approximately 600–900 bytes, real-world deployment requires **L2CAP connection-oriented channels** or packet fragmentation across 3 to 4 sequential BLE notification frames.

#### Q13: What happens if two bridge nodes receive the same packet and submit it simultaneously?
**Answer:** This is a classic "duplicate packet storm". Both bridges upload the packet to `/api/v1/sync`. The server processes the submissions concurrently. The first request to commit the SHA-256 hash into the `IdempotencyKey` table succeeds; the second database insertion encounters a unique key collision constraint, triggers a rollback, and returns `status: DUPLICATE_DROPPED` with zero ledger debit.

#### Q14: How does the dynamic link failure experiment demonstrate routing resilience?
**Answer:** In Experiment 6, we sever the direct BLE link between Carol and Eve Bridge. The simulated gossip engine re-evaluates adjacent graph nodes (`MeshSimulatorService.java`), identifies Bob and Dave as reachable alternate hops, and routes the packet through Dave to Eve Bridge. This proves that mesh networks maintain high availability even when individual relay nodes drop out or move out of physical radio range.

#### Q15: Why is the optical QR code channel important in addition to BLE?
**Answer:** Radio technologies (BLE, Wi-Fi Direct) require OS-level permissions, Bluetooth radio activation, and device pairing handshakes that can fail on diverse Android/iOS hardware. The optical channel (Voucher QR) provides a 100% device-agnostic, zero-radio fallback: the payer renders the encrypted envelope as an SVG QR code, and the payee captures it using their camera.

---

### Category C: Database, Concurrency & Idempotency (Q16 – Q22)

#### Q16: What is the exact dual-tier idempotency strategy implemented in MeshPay?
**Answer:** 
- **Tier 1 — Wire-Level Ciphertext SHA-256 Gate:** The server computes `SHA-256(packet.ciphertext)`. If this hash exists in `IdempotencyKeyRepository`, the duplicate is dropped immediately without invoking RSA decryption or database ledger locks.
- **Tier 2 — Semantic Intent Database Constraint:** If an attacker re-encrypts the *same* payment with a fresh AES-GCM IV, the ciphertext hash is completely different, bypassing Tier 1. However, upon decryption, the backend checks a unique relational constraint: `@UniqueConstraint(name = "uk_sender_txref", columnNames = {"senderVpa", "transactionRef"})`. Because the internal nonce is identical, the database throws a `DataIntegrityViolationException`, and the duplicate is dropped.

#### Q17: How is concurrency handled when two transactions debit the same account simultaneously?
**Answer:** We use JPA `@Version` optimistic locking on the `Account` entity:
```java
@Version
private Long version;
```
When two concurrent threads attempt to update the balance of the same account, Hibernate includes the version in the SQL statement: `UPDATE account SET balance = ?, version = version + 1 WHERE id = ? AND version = ?`. If one thread commits first, the second thread's update affects 0 rows, triggering an `OptimisticLockException` and preventing race conditions.

#### Q18: Why did you switch from H2 in-memory mode to H2 file-based persistence?
**Answer:** In-memory mode (`jdbc:h2:mem:testdb`) wipes all balances, idempotency keys, and transaction history as soon as the JVM process terminates or crashes. To ensure realistic banking durability (the 'D' in ACID), we configured:
`jdbc:h2:file:./data/db/upimesh;DB_CLOSE_DELAY=-1;AUTO_SERVER=TRUE`
Balances, settled audit records, and idempotency logs survive full application restarts.

#### Q19: How are financial amounts represented in Java and the database?
**Answer:** We strictly use `java.math.BigDecimal` with explicit scale: `amount.setScale(2, RoundingMode.UNNECESSARY)`. Floating-point types (`float`, `double`) use binary representation (IEEE 754) that causes cumulative fractional rounding errors (e.g., `0.1 + 0.2 = 0.30000000000000004`), which is unacceptable in financial accounting. In the database, amounts are stored as `DECIMAL(19, 2)`.

#### Q20: What are the possible transaction statuses in the Central Bank state machine?
**Answer:** 
1. `QUEUED_OFFLINE`: Stored in local phone IndexedDB.
2. `RELAYING`: Forwarding through intermediate mesh hops.
3. `INGESTED`: Received by Central Bank gateway.
4. `SETTLED`: Cryptographically validated, balances debited and credited atomically.
5. `DUPLICATE_DROPPED`: Discarded due to SHA-256 or nonce collision.
6. `REJECTED`: Invalid PIN, expired timestamp, or insufficient balance.

#### Q21: What is the transaction isolation level used during settlement?
**Answer:** Spring Boot's `@Transactional` annotation defaults to the underlying database isolation level, which is `READ_COMMITTED` on H2/PostgreSQL. Coupled with `@Version` optimistic locking and explicit unique constraints on `(senderVpa, transactionRef)`, this guarantees strict serializability for individual account balances while maintaining high concurrent throughput.

#### Q22: What happens if a sender enters a negative or zero transaction amount?
**Answer:** `SettlementService.java` enforces validation: `if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0)`. The API immediately returns an unprocessable entity error (`INVALID_AMOUNT`). The frontend also enforces `min="1"` and `max="500"` on the input field.

---

### Category D: Regulatory Compliance & Prototype Limitations (Q23 – Q26)

#### Q23: How does MeshPay align with the Reserve Bank of India (RBI) UPI-Lite framework?
**Answer:** RBI circulars (RBI/2021-22/146) mandate strict risk-mitigation guardrails for offline digital transactions:
1. **Per-Transaction Cap:** Limited to **₹500.00** per offline payment.
2. **Cumulative Offline Balance Cap:** Total un-synchronized offline spending cannot exceed **₹2,000.00** at any time.
3. **Replenishment Requirement:** Once the ₹2,000 allowance is exhausted, the user must connect to online banking with two-factor authentication (AFA) to replenish the offline wallet.
MeshPay enforces both the ₹500 transaction cap and the ₹2,000 cumulative allowance in client code and server-side validation.

#### Q24: What is the risk of "Double-Spending" in offline payment systems?
**Answer:** In any offline payment system without centralized real-time locking, a malicious user could sign two different payment packets to two different merchants for ₹500 each, while having only ₹500 total in their account. Because neither merchant can query the bank in real time, both accept the signed packet.
MeshPay mitigates this in three ways:
1. **Pre-allocated Offline Allowance:** The user's account reserves a segregated offline wallet (UPI-Lite model) capped at ₹2,000.
2. **Hardware Enclave Tracking:** On genuine hardware, an Android KeyStore / iOS Secure Enclave monotonically decrements the hardware counter.
3. **Merchant Overdraft Guarantee:** Under RBI UPI-Lite rules, the issuing bank guarantees merchant settlement up to the ₹500 limit, and subsequently recoups any deficit from the sender upon their next online connection.

#### Q25: Why is MeshPay honest about being a prototype rather than claiming to be a production UPI system?
**Answer:** Academic integrity and engineering defense require honest boundaries:
- Real UPI requires formal membership in the NPCI Unified Payments Interface network, proprietary ISO 8583/XML switches, and private bank leased lines.
- Real mobile deployments require device binding with encrypted SIM hardware telemetries (`SimCardManager`) and telco SMS handshakes.
- Real Bluetooth mesh in production requires Android Nearby Connections API or native BLE GATT peripheral/central background services.
MeshPay demonstrates and verifies the fundamental computer science and security principles (hybrid cryptography, delay-tolerant routing, idempotent distributed ledger settlement) in an educational testbed.

#### Q26: What is the merchant Soundbox feature and why is it included?
**Answer:** In Indian retail environments (Paytm, PhonePe Soundbox), merchants rely on immediate audio confirmation ("*₹100 received on Paytm*") to verify customer payment without checking a smartphone screen. MeshPay integrates the Web Speech API (`SpeechSynthesisUtterance`) with an Indian English voice synthesizer to trigger immediate voice confirmation when a transaction settles.

---

### Category E: Advanced Cybersecurity & Attack Verification (Q27 – Q30)

#### Q27: How does Experiment 3 prove resilience against Replay Attacks?
**Answer:** In Experiment 3, a previously recorded packet is re-transmitted to the server endpoint `/api/v1/cyber/replay-test`. The server checks its in-memory and database SHA-256 idempotency cache. The test confirms that the server returns `outcome: DUPLICATE_DROPPED`, and the database audit shows zero secondary debit to Alice's balance.

#### Q28: How does Experiment 4 prove resistance to Ciphertext Tampering?
**Answer:** In Experiment 4, the test suite flips a single bit in the AES-GCM ciphertext payload and submits it to `/api/v1/cyber/tamper-test`. During decryption, the GCM cipher computes the GHASH polynomial over the altered ciphertext and compares it with the embedded 128-bit authentication tag. Because the tag does not match, Java's `AEADBadTagException` is thrown, and the server returns `outcome: INVALID`.

#### Q29: What is a "Semantic Re-Encryption Attack" (Experiment 5)?
**Answer:** If an adversary intercepts Alice's payment instruction and re-encrypts the *identical* JSON string with a new AES key and random IV, the resulting ciphertext produces a completely fresh SHA-256 hash. A naive system relying solely on ciphertext hash deduplication would process the payment twice, double-debiting Alice. Experiment 5 proves that MeshPay's Tier 2 semantic uniqueness constraint on `(senderVpa, nonce)` detects and rejects the re-encrypted duplicate.

#### Q30: What is Zero-Knowledge packet forwarding?
**Answer:** Zero-knowledge packet forwarding means that intermediate relay nodes (Carol and Dave) have only enough information to fulfill routing (packet ID, hop count, TTL, and recipient bridge identifier), but zero visibility into sensitive financial payload data. Because the payload is encrypted with AES-256-GCM and the key is protected by the Central Bank's RSA-2048 public key, forwarders cannot inspect account balances, transaction amounts, or user PINs.

---

## 4. Open-Source Attribution & Engineering Transformation Matrix

### Attribution Statement
MeshPay (upiSETU) is built upon the open-source conceptual project:
- **Original Repository:** `https://github.com/perryvegehan/UPI_Without_Internet`
- **Original Concept:** Offline UPI transaction simulation using mock packets and simple encryption.

### What Was Re-Engineered in upiSETU (Side-by-Side Comparison)

| Engineering Dimension | Original Repository (`perryvegehan`) | MeshPay `upiSETU` (Our Implementation) |
|---|---|---|
| **Cryptographic Suite** | Simple Base64 mock / hardcoded strings with non-standard AES | **Standard Web Crypto RSA-2048-OAEP + AES-256-GCM** with 128-bit authentication tags |
| **PIN Security** | Plaintext PIN stored in client state and passed in plaintext payloads | **Client-side SHA-256 PIN hashing**; zero plaintext PIN storage in IndexedDB, network, or logs |
| **Idempotency Strategy** | Single-tier basic string check; vulnerable to re-encryption replay | **Dual-Tier Idempotency**: Tier 1 SHA-256 ciphertext filter + Tier 2 Relational `(senderVpa, nonce)` semantic guard |
| **Key Management** | In-memory ephemeral keys regenerated on reboot (breaks old packets) | **Persistent RSA Keypair Storage** in `./data/keys/` surviving complete server restarts |
| **Database & Persistence** | In-memory H2 (all state wiped on server shutdown) | **File-Based Relational H2 Persistence** (`./data/db/upimesh`) with ACID transaction rollback |
| **Frontend Architecture** | Single monolithic page with mixed concerns and cards | **4 Modular Workspaces**: Payments, Network Topology, Verified Audit Ledger, and Advanced Lab |
| **Design System** | Generic template styling with emojis as interface icons | **Custom Organic Palette** (Oatmeal `#E8DCC6`, Pine Green `#1F3B2E`, Soft Lilac `#CBB3E8`), editorial typography, SVG icons |
| **QR Code Capabilities** | Basic static text QR | **Dual-Mode QR Engine**: Dynamic Merchant UPI URIs + Scannable Optical Encrypted Voucher payloads |
| **Camera Scanning** | File upload fallback only | **Live Camera Video Stream** with native `BarcodeDetector` API and optical voucher decoding |
| **Merchant Audio** | No audio chime | **Integrated Soundbox Voice Synthesizer** (Web Speech API) with Indian English accents |
| **Cybersecurity Testbed** | None | **Interactive 6-Part Engineering Lab** with live automated attacks and defense verification |
| **Test Suite** | Minimal unit tests | **Comprehensive 23-Test Suite** covering crypto, race conditions, replay storms, and settlement |

---

*End of Viva Voce & Technical Defense Guide.*
