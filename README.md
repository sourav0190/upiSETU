# 📡 MeshPay (upiSETU) — Secure Offline UPI & Delay-Tolerant Mesh Architecture

> **An offline-first peer-to-peer digital payment prototype utilizing Web Crypto hybrid encryption (RSA-2048-OAEP + AES-256-GCM), store-carry-forward delay-tolerant routing (RFC 4838), dual-tier idempotency deduplication, dynamic optical QR vouchers, merchant voice Soundbox, and an interactive 6-part cybersecurity research laboratory.**

[![Build & Test](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Java 21 LTS](https://img.shields.io/badge/Java-21%20LTS-orange.svg)]()
[![Spring Boot 3.3.5](https://img.shields.io/badge/Spring%20Boot-3.3.5-brightgreen.svg)]()
[![Cryptography](https://img.shields.io/badge/Cryptography-AES--256--GCM%20%2B%20RSA--2048--OAEP-blue.svg)]()
[![Tests](https://img.shields.io/badge/Tests-23%2F23%20Passing-brightgreen.svg)]()
[![Persistence](https://img.shields.io/badge/Database-File--based%20H2%20ACID-success.svg)]()
[![Viva Guide](https://img.shields.io/badge/Documentation-Comprehensive%20Viva%20Guide-purple.svg)](VIVA_GUIDE.md)

---

## 📜 Academic Attribution & Open-Source Foundation

> [!IMPORTANT]
> **Open-Source Attribution:** MeshPay (upiSETU) is built upon the open-source conceptual project:  
> 🔗 **Repository:** [https://github.com/perryvegehan/UPI_Without_Internet](https://github.com/perryvegehan/UPI_Without_Internet)  
> **Original Concept:** Offline UPI instruction transmission using mock packets and simple encryption.  
>
> **Major Engineering Enhancements in upiSETU:**
> 1. Standard Web Crypto **RSA-2048-OAEP + AES-256-GCM** hybrid encryption with 128-bit authentication tags.
> 2. **Zero Plaintext PIN Storage:** Immediate client-side SHA-256 hashing; zero credentials stored in IndexedDB, network, or logs.
> 3. **Dual-Tier Idempotency Defense:** Wire-level SHA-256 ciphertext hash filter + relational database semantic `(senderVpa, nonce)` uniqueness constraint.
> 4. **Persistent Key Management:** Server RSA keypair persisted to disk (`./data/keys/`), surviving reboots.
> 5. **ACID Relational Persistence:** File-based H2 database (`./data/db/upimesh`) with optimistic locking (`@Version`).
> 6. **Four Specialized Workspaces:** Payments, Network Topology, Verified Audit Ledger, and Advanced Research Lab.
> 7. **6-Part Cybersecurity & DTN Lab:** Live automated simulations verifying defense against replay, tampering, and link failures.
> 8. **23/23 Automated Test Suite:** Exhaustive integration and concurrency tests covering the complete payment lifecycle.

---

> [!NOTE]
> **Prototype & Simulator Disclosure:** MeshPay is an educational engineering prototype and architectural simulation of offline-first UPI payment routing over Delay-Tolerant Networks (RFC 4838). It does not connect to the live NPCI production switch or commercial bank core banking systems. All balances, accounts, and cryptographic tokens operate within this self-contained prototype environment.

---

## 🎨 Identity & Organic Design System

MeshPay features a custom editorial, fintech-meets-networking design language created specifically to avoid generic dashboard templates:

| Color Token | Hex Code | Role |
|---|---|---|
| **Oatmeal** | `#E8DCC6` | Secondary accents, subtle container backgrounds, light chip borders |
| **Pine Green** | `#1F3B2E` | Primary brand identity, dark headers, active navigation pills, primary CTA |
| **Soft Lilac** | `#CBB3E8` | Dynamic transit particle, highlight badges, modal accents |
| **Warm Background** | `#F5F1E8` | Page background, calm organic surface |
| **Main Text** | `#243229` | High-contrast readable editorial typography |
| **Secondary Text** | `#6B746D` | Subtitles, helper text, and technical labels |
| **Surface Card** | `#FFFFFF` | Elevated white card and modal containers |
| **Border Tone** | `#D8D1C4` | Subtle borders and structural dividing lines |

---

## 🏛️ Four Modular Workspaces

Rather than cramming unrelated controls onto a single page, MeshPay organizes functionality into **four dedicated workspaces**:

### 1. Payments Workspace (`#workspace-payments`)
- **Verified Balance Card:** Live core ledger balance with visibility privacy toggle.
- **UPI-Lite Allowance Gauge:** Enforces the RBI ₹2,000 cumulative offline cap and ₹500 per-transaction ceiling.
- **Recipient Chips Grid:** Live peer selector indicating distance (meters) and signal strength (dBm).
- **Amount & Note Inputs:** Quick preset buttons (₹50, ₹100, ₹200, ₹500) and transaction description.
- **Interactive PIN Keypad Modal:** Client-side 4-digit PIN entry with bubble indicators, immediately hashed with SHA-256.
- **Merchant Soundbox:** Payee voice alerts powered by the Web Speech API (*"MeshPay received ₹100 from Alice Sharma"*).
- **Optical Voucher Hub:** Generate and scan offline signed SVG QR vouchers with live camera video decoding.

### 2. Network & Mesh Simulation Workspace (`#workspace-network`)
- **Interactive SVG Topology Canvas:** Visualizes live physical nodes (Alice, Bob, Carol, Dave, Eve Bridge, Central Bank).
- **Animated Transit Particle:** Watch packets traverse the mesh node-by-node in real time.
- **Simulation Step Controls:** Step single hop, Auto Run, and Flush Bridge to Bank.
- **Dynamic Link Failure Toggle:** Sever the Carol ↔ Bridge primary link to observe automatic gossip rerouting via Dave.
- **Variable $N$-Node Cluster Roster:** Dynamically register custom devices with custom roles (SENDER, MERCHANT, RELAY, BRIDGE) and cellular switches.

### 3. Transactions & Verified Ledger Workspace (`#workspace-transactions`)
- **Central Bank Settlement Journal:** Comprehensive table showing Tx ID, Sender, Recipient, Amount, Signed At, Bridge Node, Hop Count, and Settlement Status.
- **Instant Search & Filter:** Filter transactions in real time by VPA, nonce, or packet hash.
- **Cryptographic Audit Drawer:** Click **Inspect** on any transaction to view its transaction reference, SHA-256 ciphertext hash, bridge ingress identifier, hop count, and complete state machine event progression.

### 4. Advanced Engineering Laboratory (`#workspace-lab`)
Six structured experiments designed for university project viva voce and technical defense:
1. **Experiment 1 (Core Routing):** End-to-End Store-Carry-Forward Delivery (RFC 4838).
2. **Experiment 2 (Resilience):** Network Interruption & Outbox Buffering during 4G cellular drops.
3. **Experiment 3 (Duplicate Storm):** Wire-level ciphertext replay rejected by SHA-256 idempotency cache.
4. **Experiment 4 (Integrity):** Bit-flip tampering rejected by AES-256-GCM 128-bit authentication tag.
5. **Experiment 5 (Semantic Defense):** Re-encryption replay with fresh AES IV caught by relational `(senderVpa, nonce)` constraint.
6. **Experiment 6 (Mesh Adaptation):** Dynamic multi-hop rerouting around severed topology links.

---

## 👥 Multi-Device Demonstration (Variable $N$ Nodes)

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
                         2. Semantic Nonce Intent Verification
                         3. RSA-2048 Private Key Decryption
                         4. Freshness Window & TTL Verification
                         5. Solvency, PIN & Business Rule Validation
                         6. Atomic ACID Ledger Settlement
                         7. Soundbox Voice Alert Broadcast
```

### Running on Real Mobile Devices Over Local Wi-Fi:
1. Connect your computer and smartphones to the same local Wi-Fi router or phone mobile hotspot.
2. Find your laptop's IP address (e.g., `192.168.1.45` via `ipconfig` or `ifconfig`).
3. Open `http://192.168.1.45:8080/` on each phone's browser.
4. On Phone 1 (Alice), toggle status to **Offline (Mesh)** and initiate a payment.
5. On Phone 2 (Eve), toggle status to **Online (4G)** to act as the bridge and flush packets to the ledger!

---

## ⚡ Quick Start & Execution

### Prerequisites:
- Java 21 LTS installed (`java -version`)
- Maven 3.8+ installed (`mvn -version`)

### 1. Run Complete Automated Test Suite (23 Tests)
```powershell
mvn test -o
```
*All 23 unit, integration, cryptographic, concurrency, and security tests execute in ~14 seconds.*

### 2. Package the Application
```powershell
mvn package -DskipTests -o
```

### 3. Run the Server
```powershell
java -jar target\upi-offline-mesh-0.0.1-SNAPSHOT.jar
```
*(Or via Maven: `mvn spring-boot:run`)*

### 4. Access the Workbench
- **Modern Application UI:** [http://localhost:8080/](http://localhost:8080/)
- **Upstream Classic Developer View:** [http://localhost:8080/classic](http://localhost:8080/classic)
- **H2 Database Console:** [http://localhost:8080/h2-console](http://localhost:8080/h2-console)  
  *(JDBC URL: `jdbc:h2:file:./data/db/upimesh`, Username: `sa`, Password: empty)*

---

## 📚 Viva Voce & Technical Defense Preparation

For students presenting this project to external examiners, consult our comprehensive companion guide:
📖 **[VIVA_GUIDE.md](VIVA_GUIDE.md)**

It includes:
- **2-Minute Elevator Pitch** for external examiners.
- **5-Minute Live Demo Script** with minute-by-minute actions and talking points.
- **30 Deep Technical Questions & Authoritative Answers** covering RSA-OAEP, AES-GCM, DTN RFC 4838, BLE MTU fragmentation, dual-tier idempotency, and RBI UPI-Lite regulations.
- **Full Attribution & Architecture Comparison Matrix**.

---

## 📄 License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details. Built upon the open-source foundation of [perryvegehan/UPI_Without_Internet](https://github.com/perryvegehan/UPI_Without_Internet).
