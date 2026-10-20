# MeshPay — Payment Flow and State Machine Specification

## 1. End-to-End Payment Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Sender as Alice (Sender - Offline)
    participant AliceApp as Alice's Phone (Local App)
    participant ReceiverApp as Bob's Phone (Receiver - Offline)
    participant BridgePhone as Stranger's Phone (Bridge - Walks to 4G)
    participant Backend as MeshPay Backend (NPCI / Core)
    participant DB as Relational Database

    Note over Sender,AliceApp: Step 1: Offline Payment Initiation
    Sender->>AliceApp: Select Bob (bob@demo), Enter ₹350, Enter PIN
    AliceApp->>AliceApp: Validate Balance & Offline Allowance (₹350 <= ₹2,000)
    AliceApp->>AliceApp: Deduct available local allowance, reserve funds
    AliceApp->>AliceApp: Generate fresh UUID nonce + signedAt timestamp
    AliceApp->>AliceApp: Web Crypto: Generate random 256-bit AES key
    AliceApp->>AliceApp: AES-256-GCM encrypt PaymentInstruction
    AliceApp->>AliceApp: RSA-2048-OAEP encrypt AES key with Bank's Public Key
    AliceApp->>AliceApp: Pack into MeshPacket (packetId, ttl=5, ciphertext)
    AliceApp->>AliceApp: Persist packet in IndexedDB [State: QUEUED_OFFLINE]

    Note over AliceApp,ReceiverApp: Step 2: Peer-to-Peer Transfer (BLE / QR / Mesh)
    AliceApp->>ReceiverApp: Transmit MeshPacket via BLE / QR / P2P Gossip
    ReceiverApp->>ReceiverApp: Validate packet header & format integrity
    ReceiverApp->>ReceiverApp: Persist packet in local buffer [State: RECEIVED_LOCALLY]
    ReceiverApp-->>AliceApp: Acknowledge transfer receipt

    Note over ReceiverApp,BridgePhone: Step 3: Multi-hop Gossip Diffusion
    ReceiverApp->>BridgePhone: BLE Gossip exchange (decrement TTL to 4)
    BridgePhone->>BridgePhone: Store packet in relay cache

    Note over BridgePhone,Backend: Step 4: Bridge Reaches 4G Internet & Ingests
    BridgePhone->>BridgePhone: Detect active cellular / Wi-Fi connection
    BridgePhone->>Backend: HTTPS POST /api/v1/sync (or /api/bridge/ingest)
    
    Note over Backend,DB: Step 5: Backend Idempotency & Decryption
    Backend->>Backend: Compute packetHash = SHA-256(ciphertext)
    Backend->>Backend: Atomic claim in Idempotency Engine (ConcurrentHashMap / Redis SETNX)
    alt Already Claimed (Duplicate Bridge Upload)
        Backend-->>BridgePhone: HTTP 200 { outcome: "DUPLICATE_DROPPED" }
    else First Claim (New Transaction)
        Backend->>Backend: RSA-2048 Decrypt AES key using Bank's Private Key
        Backend->>Backend: AES-256-GCM Decrypt payload + verify 128-bit GCM Tag
        Backend->>Backend: Validate Freshness: (now - signedAt) < 24 Hours
        Backend->>Backend: Validate PIN hash & sender account solvency

        Note over Backend,DB: Step 6: Atomic ACID Settlement
        Backend->>DB: BEGIN @Transactional
        Backend->>DB: SELECT * FROM wallets WHERE vpa = 'alice@demo' FOR UPDATE (or @Version)
        Backend->>DB: Deduct ₹350 from Alice, Credit ₹350 to Bob
        Backend->>DB: INSERT INTO transactions (packet_hash, status='SETTLED', ...)
        Backend->>DB: INSERT INTO transaction_events (tx_id, state='SETTLED', ...)
        Backend->>DB: COMMIT TRANSACTION
        Backend-->>BridgePhone: HTTP 200 { outcome: "SETTLED", transactionId: 1042 }
    end

    Note over Backend,AliceApp: Step 7: Final Client Reconciliation
    AliceApp->>Backend: When Alice reconnects: GET /api/v1/sync/status
    Backend-->>AliceApp: Transaction 1042 confirmed SETTLED
    AliceApp->>AliceApp: Transition local state QUEUED_OFFLINE -> SETTLED, release reservation
```

---

## 2. Distributed Transaction State Machine

The transaction transitions through well-defined lifecycle states across the client, peer, and backend:

```mermaid
stateDiagram-v2
    [*] --> CREATED: User inputs recipient, amount & PIN
    CREATED --> AUTHENTICATED: Local PIN verified, envelope created
    AUTHENTICATED --> QUEUED_OFFLINE: Stored in persistent local queue
    
    QUEUED_OFFLINE --> RECEIVED_LOCALLY: Transmitted to peer / merchant
    RECEIVED_LOCALLY --> PENDING_SETTLEMENT: Bridge node ingests to backend
    
    PENDING_SETTLEMENT --> SETTLED: Hash claimed, decrypted, solvent balance debited
    PENDING_SETTLEMENT --> REJECTED: Solvency failure or invalid PIN
    PENDING_SETTLEMENT --> FAILED: Stale packet (>24h) or decryption tag mismatch
    
    QUEUED_OFFLINE --> REQUIRES_RECONCILIATION: Client reconnects with conflicting local state
    REQUIRES_RECONCILIATION --> SETTLED: Backend confirmed settlement
    REQUIRES_RECONCILIATION --> REJECTED: Backend rejected (e.g. over-drafted)

    SETTLED --> [*]
    REJECTED --> [*]
    FAILED --> [*]
```

### State Definitions & Invariants

1. **`CREATED`**: Initial draft on sender's device. No cryptographic envelope yet.
2. **`AUTHENTICATED`**: User authorized transfer; AES-256-GCM + RSA-OAEP envelope created.
3. **`QUEUED_OFFLINE`**: Envelope stored in client's durable local store (IndexedDB). Sender wallet reserves funds from offline allowance.
4. **`RECEIVED_LOCALLY`**: Peer or merchant received the raw encrypted packet over BLE/QR. Displays local receipt with clear disclaimer: "Payment Promise Received (Pending Settlement)".
5. **`PENDING_SETTLEMENT`**: Ingested by backend, undergoing cryptographic validation and idempotency check.
6. **`SETTLED`**: Core ledger debited sender and credited receiver inside an atomic ACID transaction.
7. **`REJECTED`**: Sender account possessed insufficient total balance when packet was settled.
8. **`FAILED`**: Ciphertext was tampered with (AES-GCM tag mismatch), packet was stale (>24 hours), or malformed.
9. **`REQUIRES_RECONCILIATION`**: Client local record is pending or conflicting and requires synchronization with server.
