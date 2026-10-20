# MeshPay — REST API Reference Specification

## Base URL
- Production / Local: `http://localhost:8080`

---

## 1. Modern Client REST API (`/api/v1`)

### 1.1 Fetch Wallet Summary
`GET /api/v1/wallet`

Retrieves wallet balance, exact integer paise units, offline spending allowances, and account version.

**Query Parameters:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `vpa` | string | No | User Virtual Payment Address (defaults to `alice@demo`) |

**Sample Response (`200 OK`):**
```json
{
  "vpa": "alice@demo",
  "holderName": "Alice Sharma",
  "balance": 5000.00,
  "balancePaise": 500000,
  "offlineAllowanceLimitPaise": 200000,
  "offlineAllowanceLimit": 2000.00,
  "offlineAllowanceSpentPaise": 0,
  "offlineAllowanceSpent": 0.00,
  "availableOfflineAllowancePaise": 200000,
  "availableOfflineAllowance": 2000.00,
  "version": 0
}
```

---

### 1.2 List Transactions with Filtering
`GET /api/v1/transactions`

**Query Parameters:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `vpa` | string | No | Filter by sender or receiver VPA |
| `status` | string | No | `SETTLED`, `REJECTED`, `FAILED` |
| `search` | string | No | Search query for VPA, reference, or hash |

**Sample Response (`200 OK`):**
```json
[
  {
    "id": 1,
    "packetHash": "f51470e6aa75e039bf3368735391c4980bbd0dd9c661c9e89d15c7198bbda9bc",
    "transactionRef": "tx_1730000000_abc12",
    "senderVpa": "alice@demo",
    "receiverVpa": "bob@demo",
    "amount": 75.00,
    "amountPaise": 7500,
    "signedAt": "2026-10-20T04:42:54.887Z",
    "settledAt": "2026-10-20T04:42:54.912Z",
    "bridgeNodeId": "bridge-alpha",
    "hopCount": 1,
    "status": "SETTLED",
    "failureReason": null,
    "pinVerified": true
  }
]
```

---

### 1.3 Batch Packet Synchronisation
`POST /api/v1/sync`

Endpoint used by bridge nodes or reconnecting clients to upload a batch of stored offline packets.

**Request Body:**
```json
{
  "bridgeNodeId": "phone-bridge-node",
  "packets": [
    {
      "packetId": "pkt_7d8a9f0b",
      "ttl": 3,
      "createdAt": 1730000000000,
      "ciphertext": "base64-rsa-aes-encrypted-payload..."
    }
  ]
}
```

**Sample Response (`200 OK`):**
```json
{
  "totalPackets": 1,
  "settledCount": 1,
  "duplicateCount": 0,
  "invalidCount": 0,
  "durationMs": 14,
  "results": [
    {
      "packetId": "pkt_7d8a9f0b",
      "outcome": "SETTLED",
      "reason": "",
      "transactionId": 42,
      "packetHash": "a3f8c9..."
    }
  ]
}
```

---

## 2. Ingestion & Cryptography API

### 2.1 Get Server RSA Public Key
`GET /api/server-key`

Returns the Central Bank's RSA-2048 Public Key in Base64 SPKI format for client-side Web Crypto hybrid encryption.

**Response (`200 OK`):**
```json
{
  "publicKey": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
  "algorithm": "RSA-2048 / OAEP-SHA256",
  "hybridScheme": "RSA-OAEP encrypts an AES-256-GCM session key"
}
```

### 2.2 Bridge Ingest Endpoint (Production Format)
`POST /api/bridge/ingest`

**Headers:**
- `X-Bridge-Node-Id`: Identifier of the delivering device
- `X-Hop-Count`: Number of mesh hops traversed

**Request Body:**
```json
{
  "packetId": "550e8400-e29b-41d4-a716-446655440000",
  "ttl": 2,
  "createdAt": 1730000000000,
  "ciphertext": "base64-hybrid-ciphertext"
}
```

**Response Outcomes:**
- `SETTLED`: Cryptographically verified, balance solvency verified, debited & credited.
- `DUPLICATE_DROPPED`: SHA-256 hash already claimed by prior bridge node. Dropped with zero decryption overhead.
- `REJECTED`: Insufficient funds or invalid UPI PIN.
- `INVALID`: Tampered ciphertext (AEADBadTagException) or stale packet (> 24 hours).
