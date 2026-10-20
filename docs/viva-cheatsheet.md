# 🎓 MeshPay — Engineering & Viva Defense Cheatsheet

> **Purpose:** Quick reference card for students preparing for project review, internal viva, and final external defense. Keep this open on your laptop/phone while presenting or studying.

---

## ⚡ Core 3-Question Rapid Defense

### Q1: How does MeshPay work without internet?
**Answer:**  
The sender locks the payment instruction using the Central Bank's public key via **Hybrid Encryption (RSA-2048-OAEP + AES-256-GCM)** and transmits the encrypted envelope over **Bluetooth Low Energy (BLE 5.0)**. The packet hops phone-to-phone through nearby carrier devices via a **Delay-Tolerant Gossip Protocol (RFC 5050)** until any device discovers 4G LTE/Wi-Fi coverage (becoming a "Bridge Node") and uploads the envelope to the Bank gateway via HTTPS. The Bank decrypts, verifies the PIN hash, and settles the transaction on the core ledger.

---

### Q2: Can intermediate stranger phones tamper with the amount or steal the PIN?
**Answer:**  
**No.** Intermediate carrier devices only hold opaque ciphertext. MeshPay uses **Authenticated Encryption with Associated Data (AES-256-GCM / RFC 5116)**. Any unauthorized modification of the ciphertext (even flipping a single bit) invalidates the 128-bit authentication tag, causing instant cryptographic rejection upon receipt. Only the Central Bank's private key can decrypt the envelope; intermediate nodes have zero access to the PIN or payment details.

---

### Q3: How is double-spending and duplicate delivery prevented?
**Answer:**  
1. **Duplicate Delivery (Idempotency)**: Every packet has a unique **SHA-256 content hash**. The Central Bank maintains an atomic idempotency cache with database unique constraints on `packet_hash`. If multiple phones upload the same packet, the bank detects the duplicate in $\mathcal{O}(1)$ time and discards it without decrypting or debiting twice.
2. **Offline Double-Spending**: Bounded by an **RBI UPI Lite-inspired local spending cap (₹2,000)** enforced by the client's secure storage. Once ₹2,000 is spent offline, subsequent offline transfers are blocked until reconnection. In the case of rooted/adversarial devices, transactions settle on a **first-come, first-served basis** at the ledger, and any negative float is treated as a legal lien on the user's primary KYC-linked account.

---

## 🔍 Additional Viva Questions for High Marks

### Q4: Why Hybrid Encryption instead of pure RSA?
* Pure RSA-2048 can only encrypt payloads smaller than $\approx 214\text{ bytes}$ (due to OAEP padding) and is computationally slow.
* AES-256-GCM is ultrafast and has no payload size limit, but requires a pre-shared key.
* **Hybrid Architecture**: We generate an ephemeral one-time 256-bit AES key to encrypt the transaction, and use RSA-2048 to lock only that 32-byte key.

### Q5: Why integer paise instead of floating-point numbers?
* IEEE 754 floats in Java (`double`) and JavaScript produce binary fraction drift (`0.1 + 0.2 = 0.30000000000000004`).
* In banking, this creates reconciliation drift. MeshPay enforces **exact integer arithmetic** (`long balancePaise = 500000L` for ₹5,000.00), guaranteeing exact balance arithmetic down to the single paisa.

### Q6: What prevents packets from looping endlessly in the crowd?
* Every `MeshPacket` has a **Time-To-Live (TTL)** counter (default: 5 hops) and a creation epoch timestamp.
* Every BLE hop decrements the TTL by 1. When $\text{TTL} = 0$ or when 24 hours expire, carrier nodes automatically prune the packet from memory.

---

## 📌 Practical Industry Analogues to Cite

1. **Apple "Find My" Network**: Hundreds of millions of strangers' iPhones relay encrypted BLE location beacons without the owners knowing or seeing the data.
2. **RBI UPI Lite & NCMC Transit Cards**: Contactless cards (Delhi Metro / London Tube) use offline floor limits (₹2,000) and deferred overnight ledger settlement.
3. **IETF RFC 5050 (Delay-Tolerant Networking)**: The official computer science standard for opportunistic store-and-forward bundle routing.
