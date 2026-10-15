Offline Mesh UPI (UPI Without Internet)
Complete Project Documentation, Architecture Specification & Viva Guide
1. Project Overview & Problem Statement
   The Real-World Problem:
   Standard UPI (Unified Payments Interface) transactions require 100% active cellular (3G/4G/5G) or Wi-Fi internet connectivity on both the sender's device and the receiver's device at the time of payment. In real-world conditions, internet connectivity regularly drops:

Underground locations: Basements, underground parking lots, metro stations.
Congested areas: Music festivals, cricket stadiums, college festivals where cellular towers are jammed.
Remote areas: Rural villages, mountain trails, highway tunnels.
Emergencies: Severe weather, natural disasters, or infrastructure blackouts.
The Solution:
Offline Mesh UPI uses a Store-and-Forward Delay-Tolerant Network (DTN) over peer-to-peer radio (simulating Bluetooth Low Energy / Wi-Fi Direct).

A sender in an offline area enters a payment (Receiver VPA, Amount, UPI PIN).
The sender's phone encrypts the transaction into an opaque, tamper-proof envelope using the Central Bank's RSA Public Key and a one-time AES-256 key.
The encrypted packet hops from phone to phone in the crowd (multi-hop gossip) without anyone being able to read or modify the data.
When any device (the "Bridge Node") eventually walks outside and connects to the internet (4G/Wi-Fi), it automatically uploads the packet to the Central Bank / NPCI server.
The server decrypts, verifies authenticity, deduplicates concurrent copies, validates the sender's PIN and account balance, and settles the funds on the ledger.
2. Non-Tech Analogy (How to Explain in 60 Seconds to Anyone)
   The "Steel Lockbox" Analogy:

Imagine you are in a basement with no phone signal and want to give ₹500 to your friend.
You write your payment note: "Pay ₹500 from Sourav to Rajat", add your secret PIN, and place it inside a small steel lockbox.
You snap the box shut with a one-way padlock. Only the Central Bank has the master key to open this padlock.
You hand the locked box to a stranger next to you. They pass it up the stairs to another stranger. Even though strangers are holding your box, they cannot read what is inside, cannot change the amount, and cannot steal your PIN.
Finally, someone carrying the box walks out onto the street where their phone catches 4G signal.
Their phone delivers the box to the Bank. The Bank unlocks it with its master key, checks your account balance, verifies your PIN, debits your account, credits your friend, and triggers the soundbox announcement!
If 3 different people deliver copies of the same locked box, the Bank checks the serial number stamped on the outside: the first copy is settled; the second and third are thrown away immediately so you are never charged twice!
3. High-Level Architecture & Data Flow
   [ OFFLINE SENDER PHONE ]
   │
   │  1. Create PaymentInstruction { sender, receiver, amount, pinHash, nonce, signedAt }
   │  2. Hybrid Encrypt (AES-256-GCM + RSA-2048-OAEP)
   ▼
   [ MeshPacket (TTL = 5, packetId, opaque ciphertext) ]
   │
   │  BLE / P2P Gossip Broadcast (Hop 1)
   ▼
   [ Stranger Phone 1 (Offline) ]
   │  TTL = 4
   ▼
   [ Stranger Phone 2 (Offline) ]
   │  TTL = 3
   ▼
   [ Bridge Phone (Offline in basement ➔ Walks outside ➔ Gets 4G) ]
   │
   │  HTTPS POST /api/bridge/ingest
   ▼
   [ CENTRAL BANK / NPCI BACKEND ]
   │
   ├── Step 1: Compute SHA-256(ciphertext)
   ├── Step 2: Atomic Idempotency Check (ConcurrentHashMap / Redis SETNX)
   │           └── If already seen ➔ DROP DUPLICATE (0 decryption cost)
   ├── Step 3: Decrypt with Bank's RSA Private Key (Unwrap AES key + Decrypt payload)
   │           └── If GCM tag mismatch ➔ REJECT AS TAMPERED
   ├── Step 4: Freshness & Replay Check (Ensure signedAt < 24 hours)
   └── Step 5: @Transactional Ledger Settlement
   ├── Verify Sender PIN hash
   ├── Check Sender Solvency (balance >= amount)
   ├── Debit Sender, Credit Receiver (@Version Optimistic Locking)
   └── Write to Transaction Ledger
4. Deep-Dive: Core Technical Concepts
   Concept 1: Hybrid Cryptography (Why not just RSA? Why not just AES?)
   Why not RSA alone? RSA is an asymmetric cipher. A 2048-bit RSA key can only encrypt data up to ~214–245 bytes. A JSON payment instruction with signatures and metadata exceeds this limit.
   Why not AES alone? AES is symmetric (same key encrypts and decrypts). If an AES key were stored in the mobile app, anyone could decompile the app, extract the key, and decrypt every user's payments.
   The Hybrid Pattern (Used by TLS/HTTPS, Signal, PGP):
   Generate a random one-time 256-bit AES session key using SecureRandom.
   Encrypt the payment JSON using AES-256-GCM (fast, authenticated, unlimited payload size).
   Encrypt only the 32-byte AES key using the Bank's RSA-2048 Public Key with OAEP padding.
   Wire format: [256-byte RSA-encrypted AES key] + [12-byte IV] + [AES ciphertext + 16-byte GCM tag].
   Intermediaries cannot decrypt because only the bank has the RSA Private Key.
   Concept 2: Authenticated Encryption (AEAD) & Tamper Resistance
   AES-GCM (Galois/Counter Mode) produces a 128-bit authentication tag over the plaintext and initialization vector.
   If an intermediate node flips even 1 bit in transit (e.g. attempting to alter the amount or recipient), decryption fails with AEADBadTagException. Tampered packets are discarded before touching the database.
   Concept 3: Distributed Idempotency & The Duplicate Storm
   The Problem: In a gossip mesh, 3 different phones might receive the same packet and walk outside into 4G coverage at the same moment. All 3 upload the packet to the server simultaneously.
   The Solution:
   Calculate SHA-256(ciphertext).
   Perform an atomic compare-and-set claim: seen.putIfAbsent(hash, timestamp) (In production: Redis SET key NX EX 86400).
   Exactly one thread gets null (first claimer) and proceeds. The other threads are returned DUPLICATE_DROPPED.
   Why hash ciphertext rather than packetId or cleartext?
   Intermediaries can tamper with packetId.
   Cleartext requires decryption first. Hashing ciphertext allows deduplication before wasting CPU on RSA decryption.
   Concept 4: Replay Attack Defense
   UUID Nonce: Every payment instruction contains a unique UUID. Two payments of ₹100 from Alice to Bob will have different nonces, generating different ciphertexts and different hashes.
   Timestamp Freshness: Every instruction contains signedAt epoch millis. The backend rejects packets older than 24 hours.
   Concept 5: Epidemic Gossip Protocol & TTL
   Virtual devices store packets in local buffers.
   Each round, devices in proximity exchange packets they do not already hold.
   Each hop decrements the packet's TTL (Time To Live). When TTL == 0, propagation stops, preventing network packet storms.
   Concept 6: ACID Transactions & Optimistic Locking
   Ledger updates are decorated with @Transactional. Both debit and credit must succeed together or roll back completely.
   Entities include a @Version column. If two processes attempt to debit the same account concurrently, Hibernate detects a version mismatch and throws an OptimisticLockException, preventing balance corruption.
   4.1. Dedicated Computer Networking (N/W) Concepts & OSI Mapping
1. Delay-Tolerant Networking (DTN - RFC 4838) & Opportunistic Routing
   Traditional IP Networking: Requires an unbroken, active end-to-end path from client to server. If a link breaks, the connection aborts.
   DTN Paradigm: Communication is asynchronous. Nodes follow the Store-Carry-and-Forward model: nodes store packets in local flash memory, physically transport them as users move, and opportunistically forward packets whenever another node enters Bluetooth/Wi-Fi range.
2. Ad-Hoc Wireless Mesh vs. Star Topology
   Standard UPI (Star Topology): All smartphones communicate directly with an ISP cellular base station. Single point of failure: no cellular tower signal = no payment.
   Offline Mesh (Decentralized Ad-Hoc Mesh): No centralized access point. Every mobile phone serves simultaneously as a terminal host and a packet router.
3. Protocol Data Units (PDUs) & Encapsulation
   Separation of concerns across network layers:
   Network Routing Header (Cleartext): packetId, ttl, createdAt. Readable by any intermediary device for routing decisions.
   Application Payload (Encrypted Ciphertext): Fully encrypted financial payload. Unreadable by intermediate routers (Zero-Trust Forwarding).
4. Hop Limit / Time-To-Live (TTL) Loop Prevention
   Borrowed directly from IPv4 TTL (RFC 791) and IPv6 Hop Limit:
   Initialized to
   .
   Decremented at every forwarding hop:
   .
   Dropped when
   , effectively preventing broadcast packet loops and infinite memory consumption.
5. Heterogeneous Protocol Bridging (Gateway Architecture)
   A Bridge Node acts as a cross-network gateway translating between two entirely different communication stacks:
   Ingress Medium: 2.4 GHz Bluetooth Low Energy / Wi-Fi Direct ad-hoc gossip protocol.
   Egress Medium: TCP/IP stack over cellular LTE/5G sending HTTP/REST payloads secured by TLS.
6. Transport Guarantee: Transforming At-Least-Once into Exactly-Once
   Wireless gossip flooding guarantees At-Least-Once packet delivery (multiple copies reach the destination).
   The bank's SHA-256 deduplication cache acts as an idempotency filter, converting uncoordinated network floods into an Exactly-Once transactional guarantee.
5. API Specification
   Method	Endpoint	Description
   GET	/	Main interactive visual dashboard
   GET	/api/accounts	Fetch all user accounts and current balances
   GET	/api/transactions	Fetch the settled transaction ledger
   GET	/api/server-key	Central Bank RSA Public Key (Base64)
   GET	/api/mesh/state	Current state of all simulated devices
   POST	/api/demo/send	Simulate sender phone (encrypts & injects packet)
   POST	/api/mesh/gossip	Execute one round of peer-to-peer packet gossip
   POST	/api/mesh/flush	Trigger all bridge nodes with internet to upload
   POST	/api/mesh/reset	Reset mesh state, accounts, and idempotency cache
   POST	/api/bridge/ingest	Production Ingestion Gateway: Receives encrypted packet from bridges
6. Honest Limitations & Viva Points
   Deferred Settlement vs Instant Settlement:
   In standard online UPI, settlement is real-time (2 seconds).
   In offline mesh UPI, when the sender's phone says "Sent", it is an authenticated promise (IOU). Settlement occurs when a bridge connects to the internet.
   Offline Double-Spend Vulnerability:
   If Alice has ₹500, she could pay Bob ₹500 in Basement A and Carol ₹500 in Basement B while offline.
   Whichever packet reaches the bank first settles; the second packet is rejected (INSUFFICIENT_BALANCE).
   Production Solution (e.g. RBI UPI Lite): Requires a pre-funded offline hardware wallet capped at ₹500/₹2000 locked by device Secure Enclave/eSIM.
7. Group Project Member Roles
   Member 1 (Lead & Architecture): End-to-end system design, REST controllers, ingestion pipeline orchestration.
   Member 2 (Security & Cryptography): RSA-2048 OAEP, AES-256-GCM AEAD, key distribution, replay protection.
   Member 3 (Distributed Systems & Database): Idempotency caching, atomic deduplication, ACID settlement, optimistic locking.
   Member 4 (Mesh Networking & UI/Demo): Peer-to-peer gossip protocol, TTL management, interactive UI, soundbox voice synthesis.