# MeshPay — AI Contributions & Personal Understanding Guide

## 1. Transparency Statement
This document transparently delineates the components designed, co-developed, and refactored with the assistance of AI, alongside the key concepts that the student must personally master to present, demonstrate, and defend MeshPay in university evaluations and technical interviews.

---

## 2. Breakdown of AI-Assisted Upgrades

| System Component | Baseline Upstream (`perryvegehan`) | Upgraded Architecture (`MeshPay`) | What I Must Personally Understand & Defend |
|---|---|---|---|
| **User Interface** | Basic HTML table with raw server controls | Complete 8-screen responsive fintech Single Page Application (Google Pay / PhonePe inspired design system, dark/light mode, Lucide SVG icons, soundbox audio). | How component-based UI routing works, how the numeric keypad updates state, and how Web Speech API triggers audio announcements. |
| **Client Cryptography** | Packets generated on the server side (`/api/demo/send`) | Real client-side Web Crypto API implementation (`crypto.js`) executing hybrid RSA-2048-OAEP and AES-256-GCM in the browser. | Why hybrid encryption is necessary (RSA size limit vs. AES key security) and how the 128-bit authentication tag detects bit-flipping. |
| **Local Persistence** | In-memory `VirtualDevice` storage | Multi-store `IndexedDB` with `localStorage` fallback (`db.js`) maintaining persistent outbox queues across page reloads and device reboots. | The difference between in-memory state and durable non-volatile client storage, and how the outbox pattern works. |
| **Monetary Ledger** | Simple `BigDecimal` without minor units | Dual-layer precision: `balancePaise` integer arithmetic (1 INR = 100 paise) preventing IEEE 754 float drift + Hibernate optimistic locking (`@Version`). | Why binary floating point numbers (`float`/`double`) cannot be used in financial ledgers. |
| **Idempotency Engine** | Single-tier in-memory `ConcurrentHashMap` | Multi-tier idempotency: In-memory atomic `putIfAbsent()` backed by durable relational database unique constraints and `IdempotencyKey` table. | How duplicate storms occur when multiple bridge nodes upload the same packet, and why hashing ciphertext is faster than decrypting first. |
| **Automated Testing** | 3 tests in a single class | 14 automated tests across 4 test suites covering concurrency, security, replay protection, wallet balance rules, and REST integration. | How `CountDownLatch` and `ExecutorService` simulate microsecond-level multi-threaded race conditions. |

---

## 3. Checklist of Concepts I Can Personally Explain

1. **The Core Analogy:** The Steel Lockbox analogy for explaining store-and-forward mesh routing in 60 seconds.
2. **The Wire Format:** Slicing the 256-byte RSA key, 12-byte IV, and AES ciphertext with 128-bit authentication tag.
3. **The Duplicate Storm:** Why at-least-once wireless flooding requires deterministic `SHA-256(ciphertext)` deduplication before decryption.
4. **ACID Transaction Guarantees:** How `@Transactional` and `@Version` maintain atomic debits and credits under high concurrency.
5. **The UPI Lite Distinction:** Why a software prototype uses simulated offline allowances, and why real production deployments require hardware Secure Enclaves (eSE / UICC).
