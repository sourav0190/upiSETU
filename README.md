# 📡 MeshPay — Secure Offline UPI & Dynamic Mesh Architecture
> **Store-and-Forward Peer-to-Peer Fintech Prototype with Hybrid Cryptography (RSA-2048-OAEP + AES-256-GCM), Dynamic QR Code Vouchers, Soundbox Audio & Variable N-Node Mesh Routing**

[![Build & Test](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Java 21 LTS](https://img.shields.io/badge/Java-21%20LTS-orange.svg)]()
[![Spring Boot 3.3.5](https://img.shields.io/badge/Spring%20Boot-3.3.5-brightgreen.svg)]()
[![Cryptography](https://img.shields.io/badge/Cryptography-AES--256--GCM%20%2B%20RSA--2048%20%2B%20SHA--256-blue.svg)]()
[![QR Engine](https://img.shields.io/badge/QR%20Transport-Dynamic%20Offline%20Voucher-emerald.svg)]()

---

## 🌟 Overview & Product Vision

**MeshPay** is a resilient, offline-first digital payment prototype inspired by Google Pay, PhonePe, and NPCI's UPI Lite X guidelines.

In real-world environments—such as crowded stadiums, underground metro stations, basements, highway tunnels, rural dead-zones, or natural disaster infrastructure blackouts—active cellular (4G/5G) and Wi-Fi internet connectivity frequently drops. Standard UPI fails in these conditions because its star topology requires simultaneous internet sockets on both payer and payee devices.

MeshPay solves this using a **Store-and-Forward Delay-Tolerant Network (DTN - RFC 4838)**:
1. **Offline Payer Phone:** Signs an authenticated payment instruction and encapsulates it into a zero-trust envelope using **Web Crypto Hybrid Encryption (AES-256-GCM + Central Bank RSA-2048-OAEP)**.
2. **Optical / BLE Transport:** Can be broadcasted via peer-to-peer radio or rendered as a high-density **Offline Signed QR Code Voucher** that nearby merchants or peers can scan directly without radio.
3. **Variable N-Node Relay Mesh:** Encrypted packets hop from phone to phone (whether 2, 5, 10, or $N$ participating devices). Intermediate peers (even those with ZERO internet) store and forward packets without ever being able to decrypt amounts, PINs, or balances.
4. **Opportunistic Bridge Nodes:** When ANY device in the crowd connects to 4G/Wi-Fi, it automatically uploads collected packets to the Central Bank backend.
5. **Central Backend Ledger:** Computes `SHA-256(ciphertext)` to atomically deduplicate redundant deliveries (solving the *Duplicate Storm* problem), decrypts the instruction, verifies PIN authenticity and account solvency, and atomically settles the ledger using `@Transactional` and Hibernate `@Version` optimistic locking.
6. **Merchant Soundbox:** Payee device triggers instant audio voice announcements using the Web Speech API (e.g., *"MeshPay received ₹100 from Alice Sharma"*).

---

## 👥 Real-Time Multi-Device Demonstration (Variable $N$ Nodes)

The mesh network supports **any variable number ($N$) of participating devices**—from a 2-person direct transfer up to a crowd of $N$ phones:

```
[ Person 1: Alice (Sender) ]
   • ZERO Internet (Basement)
   • Signs transaction using Web Crypto (RSA-2048-OAEP + AES-256-GCM)
   • Transmits via BLE Radio OR generates Offline Signed QR Voucher
                 │
                 ▼  (Local P2P / BLE / Optical QR Scan)
[ Person 2: Bob (Merchant / Payee) ]          [ Person 3: Carol (Relay Peer) ]
   • ZERO Internet (Basement)                    • ZERO Internet (Basement)
   • Displays Merchant QR / receives packet      • Stores & forwards packet (Zero-Trust)
                 │                                           │
                 └───────────────────┬───────────────────────┘
                                     ▼  (Mesh Gossip Relay)
                          [ Person 4: Dave (Relay Peer) ]
                             • ZERO Internet
                             • Relays packet via mesh
                                     │
                                     ▼  (Store-and-Forward Hop)
                          [ Person 5: Eve (Bridge Node) ]
                             • HAS 4G / Wi-Fi Internet!
                             • Detects connectivity & uploads packets
                                     │
                                     ▼  (HTTPS POST /api/v1/sync)
                      [ Central Bank Backend / NPCI Core Ledger ]
                         1. SHA-256 Hash Deduplication Gate
                         2. RSA-2048 Private Key Decryption
                         3. Freshness & Nonce Replay Check
                         4. Atomic Ledger Settlement
                         5. Soundbox Voice Alert Broadcast
```

### How to Run on Real Mobile Phones:
1. Connect your laptop and phones to the same Wi-Fi router or Phone Mobile Hotspot.
2. Find your laptop's local IP address (e.g. `192.168.1.5` via `ipconfig`).
3. Open `http://192.168.1.5:8080/` on each phone's browser.
4. Each phone selects or registers their name and toggles **"Online (4G)"** vs **"Offline (Mesh)"** to participate live in the mesh!

---

## 🛡️ Interactive Cybersecurity Lab

MeshPay includes a dedicated, live interactive attack & defense suite:

1. **Replay Attack Defense:** Attempts to replay an already-settled packet. The Central Bank's SHA-256 idempotency filter detects the duplicate hash and rejects it with `DUPLICATE_DROPPED` and zero balance alteration.
2. **Bit-Flip Tamper Attack:** An attacker flips 1 single bit in the AES-GCM ciphertext in an attempt to modify the transfer amount. AES-GCM authenticated encryption immediately detects the tag mismatch and rejects the envelope with `TAMPER_DETECTED: INVALID`.
3. **Zero-Knowledge Relay Inspection:** Proves that intermediate nodes (Carol/Dave) who forward packets see strictly randomized Base64 ciphertext: amounts, PINs, and balances are 100% hidden.
4. **Double-Spend Allowance Blocker:** Enforces RBI's UPI-Lite ₹2,000 offline cap at the device enclave level to prevent un-reconciled overspending.

---

## 📷 Dynamic QR Code Engine

MeshPay includes a 100% standalone, zero-dependency pure JavaScript QR engine (`qr.js`):
- **Merchant Dynamic UPI QR:** Generates `upi://pay?pa=...` with requested amount for instant scanning.
- **Offline Signed Voucher QR:** Encodes the full encrypted cryptographic envelope (`meshpay://voucher?data=...`) into a scannable optical QR code for true air-gapped data transfer without radio.
- **Built-in QR Scanner:** Decodes payloads via camera stream, file input, or direct paste.

---

## ⚡ Quick Start

### 1. Build & Run Application
```powershell
mvn clean compile
mvn spring-boot:run
```
*(Or run the pre-built jar directly: `java -jar target\upi-offline-mesh-0.0.1-SNAPSHOT.jar`)*

### 2. Access the Application
- **Main FinTech Workbench & Topology Visualizer:**  
  👉 **[http://localhost:8080/](http://localhost:8080/)**
- **5-Device Split-Screen Studio View:**  
  Click **[👥 Studio Mode]** in the header to view 5 phone screens side-by-side for live college presentations.
- **H2 Database Console:**  
  👉 **[http://localhost:8080/h2-console](http://localhost:8080/h2-console)** *(JDBC URL: `jdbc:h2:mem:upimesh`, User: `sa`, Password: empty)*

---

## 💡 Key Viva Concepts (In 60 Seconds)

1. **Why not standard UPI?** Standard UPI requires active internet sockets connecting both devices to NPCI. MeshPay routes deferred authenticated payment instructions over peer-to-peer radio or optical QR codes without internet.
2. **The Duplicate Storm:** When multiple bridge nodes walk into 4G signal with the same packet, the bank computes `SHA-256(ciphertext)` before decryption. Exactly one thread claims the hash atomically; the other copies are dropped immediately.
3. **Why Hybrid Encryption?** RSA-2048 cannot encrypt payloads larger than ~214 bytes. AES-256 is fast and supports arbitrary sizes. We generate a fresh AES key per transaction, encrypt the JSON payload with AES-GCM, and encrypt only the AES key with RSA-OAEP.
4. **How do non-senders forward safely?** Intermediate nodes act as untrusted forwarders (DTN RFC 4838). Because the payload is encrypted with the Bank's public key, intermediaries cannot inspect amounts or PINs, nor can they tamper with the ciphertext without invalidating the AES-GCM authentication tag.
