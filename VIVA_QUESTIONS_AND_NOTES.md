# MESHPAY (upiSETU): VIVA VOCE EXAMINATION & TECHNICAL DEFENSE HANDBOOK
**Bachelor of Technology in Computer Science and Engineering (Batch: VIIth Semester)**  
**Delhi Skill and Entrepreneurship University (DSEU), Okhla-II Campus, New Delhi**  

---

### Team & Faculty Details
- **Sourav Thakur (Roll No. 41523099)** — Project Lead, Backend Architecture, Cryptography & Database Systems
- **Sushant Sunder (Roll No. 41523103)** — Delay-Tolerant Mesh Routing, Epidemic Gossip Protocol & Detour Engine
- **Rajat Trehan (Roll No. 41523078)** — Frontend Engineering, Metro Disaster Theater, 4G Water Pipe & Cyber Lab
- **Project Mentor:** **Ms. Meenu Munjal**, Assistant Professor, Department of CSE, DSEU Okhla-II Campus

---

## 1. Executive Summary & 2-Minute Elevator Pitch

> **Examiner Prompt:** *"Can you explain what your project is, what problem it solves, and how it works in 2 minutes?"*

**Model Answer:**  
"Good morning, respected external examiners and faculty members. Our project is **MeshPay (upiSETU)**, an offline-first peer-to-peer payment architecture and store-carry-forward routing engine designed for zero-connectivity environments—such as subterranean metro corridors, deep basements, disaster-affected regions, and rural blind-spots where conventional UPI fails.

Traditional UPI requires synchronous client-to-server cellular (4G/5G) connectivity. In an underground metro station, transactions abort due to socket timeouts. MeshPay decouples **offline transaction signing** from **deferred bank settlement** using Delay-Tolerant Networking (RFC 4838):
1. **Client Enclave:** Payer smartphone seals an envelope locally using W3C Web Crypto hybrid encryption (RSA-2048-OAEP encapsulating an ephemeral AES-256-GCM session key). The UPI PIN is hashed via salted SHA-256 with zero plaintext exposure.
2. **Store-Carry-Forward Mesh:** The packet gossips across nearby peer smartphones via Bluetooth Low Energy (BLE). Intermediate relays have zero knowledge of payment amounts or recipient accounts and cannot tamper with ciphertext.
3. **Bridge Upload & Settlement:** When any device exits the tunnel and gets 4G connectivity (acting as an autonomous Bridge Node), it uploads accumulated envelopes to the Central Bank. The bank enforces a **dual-tier idempotency defense** (in-memory SHA-256 cache + relational database unique constraint) to prevent double-spending and bridge race conditions before executing atomic ACID ledger debits and credits.

Our system is verified with **23 automated tests (100% pass rate)**, sub-30ms settlement latency, persistent RSA keys that survive server reboots, and an interactive React simulation with audio Soundbox chimes."

---

## 2. Topic-by-Topic Master Checklist
- **Topic 1: Delay-Tolerant Networking (DTN)** — Store-Carry-Forward routing paradigm (IETF RFC 4838).
- **Topic 2: Hybrid Cryptography** — RSA-2048-OAEP wrapping ephemeral AES-256-GCM symmetric session keys.
- **Topic 3: Zero-Plaintext PIN Enclave** — Client-side salted SHA-256 PIN hashing; raw PINs never enter storage or wire.
- **Topic 4: Controlled Epidemic Gossip** — Bounded message replication with integer TTL decrements (TTL=10) and hop limits.
- **Topic 5: Dual-Tier Idempotency Defense** — Tier 1 in-memory SHA-256 cache + Tier 2 database unique constraint on (senderVpa, nonce).
- **Topic 6: ACID Ledger Settlement** — Spring Boot 3.3.5 + H2 file database with JPA `@Version` optimistic locking.
- **Topic 7: Keypair Disk Persistence** — `ServerKeyHolder.java` serializing DER keys to `./data/keys/` surviving reboots (DEF-01).
- **Topic 8: Regulatory Compliance** — RBI Circular DPSS.CO.PD.No.S-526/02-14-003/2021-22 limits (₹500 / ₹2,000).

---

## 3. Role-Specific Questions & Answers

### A. For SOURAV THAKUR (41523099) — Backend & Cryptography
- **Q1: Can you explain the exact cryptographic and settlement flow when an envelope arrives at your backend?**  
  *Answer:* 1. Wire-hash deduplication (<0.5ms lookup). 2. Asymmetric RSA-OAEP private decryption of AES key. 3. AES-256-GCM unsealing with IV and 128-bit tag verification. 4. Relational uniqueness check on `(senderVpa, nonce)`. 5. ACID balance validation, debit/credit execution, and idempotency key commit.
- **Q2: Why hybrid RSA-2048 + AES-GCM instead of pure RSA?**  
  *Answer:* RSA-2048 can only encrypt up to 190 bytes under OAEP padding. Our payment JSON is ~350 bytes. Pure AES requires pre-shared keys which strangers cannot have in an ad-hoc mesh. Hybrid encryption solves both.
- **Q3: How does Dual-Tier Idempotency handle bridge race conditions?**  
  *Answer:* Tier 1 in-memory cache drops 99% of retransmissions in 0.28ms. If two bridges upload simultaneously, the database unique constraint on `(senderVpa, nonce)` forces the second thread to rollback via `DataIntegrityViolationException`.
- **Q4: How did you fix the server reboot key loss defect (DEF-01)?**  
  *Answer:* Engineered `ServerKeyHolder.java` to serialize keys to `./data/keys/server_private.der`. Startup checks for existing files before generating new ones.

### B. For SUSHANT SUNDER (41523103) — Delay-Tolerant Mesh Routing
- **Q5: What is Delay-Tolerant Networking (DTN) and how does it differ from TCP/IP?**  
  *Answer:* TCP/IP requires continuous end-to-end synchronized circuits. DTN uses Store-Carry-Forward (RFC 4838): intermediate nodes buffer messages in flash storage and carry them physically across space until encountering peers.
- **Q6: How do you prevent message storms in epidemic gossip?**  
  *Answer:* 1. Bounded TTL integer decrement (TTL=10). 2. Ring buffer of 500 seen packet SHA-256 hashes. 3. Summary vector exchange in discovery handshakes.
- **Q7: Can intermediate relays snoop on payment amounts or steal PINs?**  
  *Answer:* No. Relays only observe opaque Base64 ciphertexts. The AES session key is sealed under the Bank's RSA public key, so only the bank can read transaction parameters.

### C. For RAJAT TREHAN (41523078) — Frontend & Motion Simulation
- **Q8: Why build the Metro Tunnel Disaster Theater rather than a standard dashboard?**  
  *Answer:* Conveys the physical reality of an underground radio dead zone (Depth: -42.5m, 0-bar No Service) and demonstrates client-side Web Crypto execution in the browser.
- **Q9: How do you ensure the PIN is never exposed in plaintext?**  
  *Answer:* Keypad input triggers immediate `SHA-256(pin + ":" + senderVpa)`. Raw PIN is wiped from memory; only the salted hash is encrypted into the envelope.
- **Q10: What do the 6 experiments in the Cybersecurity Viva Lab prove?**  
  *Answer:* LAB-01: Replay attack rejection. LAB-02: Bit-flip tampering detection. LAB-03: Expired TTL eviction. LAB-04: Double-spending prevention. LAB-05: Cold reboot key recovery. LAB-06: Multi-bridge race condition suppression.

---

## 4. Tough "Grill" Questions Every Examiner Asks
- **Q11: How do you mathematically prevent double-spending without a live connection?**  
  *Answer:* Acknowledging FLP impossibility theorem, we enforce a hybrid model: RBI ₹500/₹2,000 regulatory exposure bounds, sequential bank clearing (first envelope consumes balance, second rejected), and future hardware Secure Element (eSE) monotonic sequence counters.
- **Q12: Why not just use USSD (*99#) or UPI 123PAY?**  
  *Answer:* USSD requires GSM 2G voice signaling; UPI 123PAY requires telecom voice coverage. In subterranean transit tunnels, there is zero signal for either. MeshPay requires zero telecom infrastructure at the point of transaction.

---

## 5. Live Demonstration 5-Minute Script
1. **Minute 1:** Show Metro Tunnel theater (-42.5m depth, 0-bar No Service).
2. **Minute 2:** Alice composes ₹500 payment to Bob, inputs PIN 1234, clicks 'Inject into Mesh' (local Web Crypto envelope sealing).
3. **Minute 3:** Click 'Run Gossip Round' — observe packet hop Alice → Carol → Dave → Eve Bridge with live speech bubbles.
4. **Minute 4:** Click 'Bridges Upload to Backend' — observe 4G water pipe flow liquid into Central Bank; listen to Soundbox audio chime.
5. **Minute 5:** Inspect transaction ledger showing ₹500 debit/credit and run 'Test Replay Attack' in Cyber Lab.
