import React, { useState } from 'react';
import { FlaskConical, Play, ShieldAlert, Cpu, Lock } from 'lucide-react';

export default function LabView({ activePacket, onRunExp }) {
  const [consoles, setConsoles] = useState({
    1: 'Ready. Click Run to simulate normal packet lifecycle.',
    2: 'Ready. Click Run to simulate network failure & recovery.',
    3: 'Ready. Click Run to trigger identical packet replay.',
    4: 'Ready. Click Run to tamper with envelope ciphertext.',
    5: 'Ready. Click Run to test re-encryption replay.',
    6: 'Ready. Click Run to test mesh dynamic rerouting.'
  });

  const [loading, setLoading] = useState({});

  const handleRun = async (expNum) => {
    setLoading((prev) => ({ ...prev, [expNum]: true }));
    try {
      const resultText = await onRunExp(expNum);
      setConsoles((prev) => ({ ...prev, [expNum]: resultText }));
    } catch (e) {
      setConsoles((prev) => ({ ...prev, [expNum]: `[FAILED] ${e.message}` }));
    } finally {
      setLoading((prev) => ({ ...prev, [expNum]: false }));
    }
  };

  return (
    <main className="workspace-view active">
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FlaskConical size={18} />
            <span>Interactive Engineering Experiments Testbed</span>
          </div>
          <span className="card-subtitle">Designed for College Viva & Technical Defense</span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
          Demonstrates how MeshPay solves fundamental edge-case challenges in offline digital transactions: duplicate packet storms, MITM tampering, semantic re-encryption replay, and broken routing links.
        </p>

        <div className="lab-grid">
          {/* Experiment 1 */}
          <div className="experiment-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="exp-badge">Experiment 1</span>
                <span className="status-pill settled">Core Routing</span>
              </div>
              <div className="exp-title">End-to-End Store-Carry-Forward Delivery</div>
              <div className="exp-desc">Creates a ₹100 payment offline, hops across BLE relays to Eve Bridge, and syncs to Central Bank.</div>
            </div>
            <div
              className="exp-console"
              dangerouslySetInnerHTML={{ __html: consoles[1] }}
            />
            <button
              className="btn-secondary"
              disabled={loading[1]}
              onClick={() => handleRun(1)}
            >
              {loading[1] ? 'Running...' : 'Run Experiment 1'}
            </button>
            <div className="exp-conclusion">Proves Store-and-Forward routing (RFC 4838) functions over untrusted peers without internet.</div>
          </div>

          {/* Experiment 2 */}
          <div className="experiment-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="exp-badge">Experiment 2</span>
                <span className="status-pill queued_offline">Resilience</span>
              </div>
              <div className="exp-title">Network Interruption & Outbox Buffering</div>
              <div className="exp-desc">Cuts bridge 4G cellular backhaul. Packet is safely buffered in outbox; connectivity is restored, and packet flushes.</div>
            </div>
            <div
              className="exp-console"
              dangerouslySetInnerHTML={{ __html: consoles[2] }}
            />
            <button
              className="btn-secondary"
              disabled={loading[2]}
              onClick={() => handleRun(2)}
            >
              {loading[2] ? 'Running...' : 'Run Experiment 2'}
            </button>
            <div className="exp-conclusion">Proves zero packet loss when cellular backhaul experiences intermittent connection drops.</div>
          </div>

          {/* Experiment 3 */}
          <div className="experiment-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="exp-badge">Experiment 3</span>
                <span className="status-pill duplicate_dropped">Duplicate Storm</span>
              </div>
              <div className="exp-title">Ciphertext Duplicate Replay (SHA-256 Gate)</div>
              <div className="exp-desc">Delivers the exact same signed envelope twice from different bridge devices to test idempotency deduplication.</div>
            </div>
            <div
              className="exp-console"
              dangerouslySetInnerHTML={{ __html: consoles[3] }}
            />
            <button
              className="btn-secondary"
              disabled={loading[3]}
              onClick={() => handleRun(3)}
            >
              {loading[3] ? 'Running...' : 'Run Experiment 3'}
            </button>
            <div className="exp-conclusion">Proves duplicate copies are dropped atomically at the gateway before ledger debit.</div>
          </div>

          {/* Experiment 4 */}
          <div className="experiment-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="exp-badge">Experiment 4</span>
                <span className="status-pill rejected">Integrity</span>
              </div>
              <div className="exp-title">Ciphertext Bit-Flip Tampering (AES-256-GCM)</div>
              <div className="exp-desc">An attacker flips 1 character in the AES-GCM ciphertext to alter the amount. Tested against the bank gateway.</div>
            </div>
            <div
              className="exp-console"
              dangerouslySetInnerHTML={{ __html: consoles[4] }}
            />
            <button
              className="btn-secondary"
              disabled={loading[4]}
              onClick={() => handleRun(4)}
            >
              {loading[4] ? 'Running...' : 'Run Experiment 4'}
            </button>
            <div className="exp-conclusion">Proves AES-GCM 128-bit authentication tags prevent any in-flight tampering by intermediate nodes.</div>
          </div>

          {/* Experiment 5 */}
          <div className="experiment-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="exp-badge">Experiment 5</span>
                <span className="status-pill duplicate_dropped">Semantic Defense</span>
              </div>
              <div className="exp-title">Re-Encryption Semantic Nonce Replay</div>
              <div className="exp-desc">Re-encrypts the same intent with a fresh random AES IV. Tested against server semantic nonce database constraint.</div>
            </div>
            <div
              className="exp-console"
              dangerouslySetInnerHTML={{ __html: consoles[5] }}
            />
            <button
              className="btn-secondary"
              disabled={loading[5]}
              onClick={() => handleRun(5)}
            >
              {loading[5] ? 'Running...' : 'Run Experiment 5'}
            </button>
            <div className="exp-conclusion">Proves (senderVpa, nonce) uniqueness prevents re-encryption attacks bypassing SHA-256 hash checks.</div>
          </div>

          {/* Experiment 6 */}
          <div className="experiment-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="exp-badge">Experiment 6</span>
                <span className="status-pill relaying">Mesh Adaptation</span>
              </div>
              <div className="exp-title">Broken Link Gossip Rerouting</div>
              <div className="exp-desc">Breaks the direct Alice-Carol link; verifies mesh gossip dynamically discovers alternative path via Bob to Dave.</div>
            </div>
            <div
              className="exp-console"
              dangerouslySetInnerHTML={{ __html: consoles[6] }}
            />
            <button
              className="btn-secondary"
              disabled={loading[6]}
              onClick={() => handleRun(6)}
            >
              {loading[6] ? 'Running...' : 'Run Experiment 6'}
            </button>
            <div className="exp-conclusion">Proves decentralized multi-hop routing adapts dynamically around broken or out-of-range physical nodes.</div>
          </div>
        </div>
      </div>

      {/* Packet Inspector Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Cpu size={18} />
            <span>Cryptographic Packet Inspector</span>
          </div>
          <span className="card-subtitle">Zero-Knowledge Forwarder Verification</span>
        </div>

        <div className="editorial-callout">
          Examine the exact byte-level contents held by intermediate forwarders. Intermediate nodes see only randomized ciphertext; amount, PIN, and balance remain cryptographically concealed.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div className="allowance-box">
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Packet UUID (Wire ID)</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', wordBreak: 'break-all' }}>
              {activePacket ? activePacket.packetId : 'pkt-none-queued'}
            </span>
          </div>
          <div className="allowance-box">
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>SHA-256 Idempotency Hash</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', wordBreak: 'break-all' }}>
              {activePacket && activePacket.packetHash ? activePacket.packetHash : 'Waiting for transaction...'}
            </span>
          </div>
          <div className="allowance-box">
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cryptographic Suite</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>RSA-2048-OAEP + AES-256-GCM (128-bit tag)</span>
          </div>
          <div className="allowance-box">
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Forwarder Visibility</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-success)' }}>
              ZERO-KNOWLEDGE (Payload Fully Encrypted)
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
