# MeshPay — Quality Assurance & Testing Report

## 1. Automated Test Plan & Strategy

The test suite validates the system at 4 distinct layers:
1. **Unit Layer:** Monetary precision, balance arithmetic (paise), PIN validation, positive amount constraints.
2. **Security & Cryptography Layer:** AES-GCM bit-flipping/tampering detection, RSA key exchange, replay attack prevention, stale timestamp rejection, clock-skew boundaries.
3. **Concurrency & Distributed Systems Layer:** Multi-threaded duplicate storm tests simulating simultaneous delivery of identical packets by multiple bridge nodes.
4. **Integration Layer (MockMvc):** REST API contract validation, batch synchronisation endpoint, idempotency enforcement, and JSON serialization.

---

## 2. Actual Test Execution Results

**Executed on:** 2026-10-20  
**Runtime Environment:** OpenJDK 21.0.11 (Temurin LTS), Apache Maven 3.9.13, Windows 11  
**Command:** `mvn test`

```
[INFO] -------------------------------------------------------
[INFO]  T E S T S
[INFO] -------------------------------------------------------
[INFO] Running com.demo.upimesh.ApiV1IntegrationTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 8.328 s -- in com.demo.upimesh.ApiV1IntegrationTest
[INFO] Running com.demo.upimesh.IdempotencyConcurrencyTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.033 s -- in com.demo.upimesh.IdempotencyConcurrencyTest
[INFO] Running com.demo.upimesh.SecurityAndReplayTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.077 s -- in com.demo.upimesh.SecurityAndReplayTest
[INFO] Running com.demo.upimesh.WalletAndSettlementUnitTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.086 s -- in com.demo.upimesh.WalletAndSettlementUnitTest
[INFO] 
[INFO] Results:
[INFO] 
[INFO] Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time: 14.869 s
```

---

## 3. Test Cases Breakdown

### 3.1 Concurrency & Idempotency Tests (`IdempotencyConcurrencyTest`)
- **`singlePacketDeliveredByThreeBridgesSettlesExactlyOnce`**:
  Initializes an `ExecutorService` with 3 parallel threads synchronized on a `CountDownLatch(1)`. All 3 threads fire the same encrypted packet simultaneously to `BridgeIngestionService.ingest()`.
  *Assertion:* Exactly 1 thread returns `SETTLED`; the other 2 return `DUPLICATE_DROPPED`. Alice's balance is debited by exactly ₹100 once.
- **`tamperedCiphertextIsRejected`**:
  Flips a single byte in the middle of a valid Base64 ciphertext.
  *Assertion:* GCM authentication tag verification fails; returns `INVALID` outcome without modifying the database.
- **`encryptDecryptRoundTrip`**:
  Verifies that a payment instruction encrypted with the server's public key decrypts losslessly to identical fields using the server's private key.

### 3.2 Security & Replay Defense Tests (`SecurityAndReplayTest`)
- **`testStalePacketIsRejected`**:
  Generates a packet with `signedAt` set to 48 hours in the past.
  *Assertion:* Rejected with reason `stale_packet`.
- **`testFutureDatedPacketIsRejected`**:
  Generates a packet with `signedAt` set to 1 hour in the future.
  *Assertion:* Rejected with reason `future_dated`.
- **`testReplayOfIdenticalPacketIsDroppedAtIdempotencyGate`**:
  Submits an identical valid packet 3 sequential times.
  *Assertion:* First delivery settles; subsequent deliveries are dropped immediately at the idempotency cache gate.

### 3.3 Wallet & Settlement Unit Tests (`WalletAndSettlementUnitTest`)
- **`testSuccessfulSettlementDebitsSenderAndCreditsReceiver`**:
  Asserts exact atomic balance updates and integer minor currency paise units (`amountPaise = 25000L`).
- **`testInsufficientBalanceResultsInRejectedTransaction`**:
  Attempts to send ₹1,500 from an account holding ₹1,000.
  *Assertion:* Transaction is marked `REJECTED (INSUFFICIENT_BALANCE)`; sender balance remains ₹1,000.
- **`testNegativeOrZeroAmountThrowsException`**:
  Ensures business validation blocks negative amounts before touching storage.
- **`testInvalidPinRejectsTransaction`**:
  Verifies that an incorrect PIN hash results in `REJECTED (INVALID_UPI_PIN)`.

### 3.4 Integration Tests (`ApiV1IntegrationTest`)
- **`testGetWalletEndpoint`**: Tests JSON serialization and retrieval of offline allowance limits.
- **`testGetTransactionsEndpoint`**: Tests ledger search and filtering endpoints.
- **`testSyncBatchEndpoint`**: Submits a batch of packets and validates aggregate sync metrics.
- **`testSyncStatusEndpoint`**: Verifies health and cache metric endpoints.
