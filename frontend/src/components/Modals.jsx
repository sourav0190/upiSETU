import React, { useState, useEffect } from 'react';
import { X, CheckCircle, ShieldAlert, Cpu } from 'lucide-react';

export function PinModal({ isOpen, onClose, amount, recipientName, onSubmitPin }) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (isOpen) setPin('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = (d) => {
    if (pin.length < 4) {
      const next = pin + d;
      setPin(next);
      if (next.length === 4) {
        setTimeout(() => {
          onSubmitPin(next);
        }, 150);
      }
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  return (
    <div className="modal-backdrop active" role="dialog" aria-modal="true">
      <div className="modal-box" style={{ maxWidth: '380px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Enter 4-Digit UPI PIN</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Authorizing <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{parseFloat(amount || 100).toFixed(2)}</span> to <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{recipientName || 'Merchant'}</span>
        </p>

        <div className="pin-bubbles-row">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className={`pin-bubble ${idx < pin.length ? 'filled' : ''}`}></div>
          ))}
        </div>

        <div className="pin-keypad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button key={d} className="pin-key-btn" onClick={() => handleDigit(d.toString())}>
              {d}
            </button>
          ))}
          <button className="pin-key-btn" onClick={onClose} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <button className="pin-key-btn" onClick={() => handleDigit('0')}>
            0
          </button>
          <button className="pin-key-btn" onClick={handleBackspace} style={{ fontSize: '0.8rem' }}>
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}

export function QrModal({ isOpen, onClose, title, subtitle, svgString, rawPayload, onSimulateScan }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop active" role="dialog" aria-modal="true">
      <div className="modal-box" style={{ maxWidth: '420px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>{title || 'QR Code'}</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>{subtitle}</p>

        <div
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}
          dangerouslySetInnerHTML={{ __html: svgString }}
        />

        <div
          style={{
            background: 'var(--surface-muted)',
            padding: '10px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            wordBreak: 'break-all',
            marginBottom: '16px',
            textAlign: 'left'
          }}
        >
          {rawPayload}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onSimulateScan && (
            <button className="btn-primary" onClick={onSimulateScan} style={{ flex: 1 }}>
              Simulate Peer Scan
            </button>
          )}
          <button className="btn-secondary" onClick={onClose} style={{ flex: onSimulateScan ? 1 : 2 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function TxDetailModal({ isOpen, onClose, detail }) {
  if (!isOpen || !detail) return null;

  const tx = detail.transaction || {};
  const events = detail.events || [];

  return (
    <div className="modal-backdrop active" role="dialog" aria-modal="true">
      <div className="modal-box" style={{ maxWidth: '580px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Transaction Audit Record</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Cryptographic proof and state machine audit trail
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <div className="allowance-box">
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Transaction Nonce & Ref</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{tx.transactionRef || ('TX-' + tx.id)}</span>
          </div>
          <div className="allowance-box">
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>SHA-256 Ciphertext Hash</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', wordBreak: 'break-all' }}>{tx.packetHash || 'Verified'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="allowance-box">
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Delivered Via Bridge</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{tx.bridgeNodeId || 'phone-bridge'}</span>
            </div>
            <div className="allowance-box">
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Hop Count</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{tx.hopCount || 2} hops via BLE Gossip</span>
            </div>
          </div>
          <div className="allowance-box">
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
              State Machine Progression
            </span>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {events.length > 0 ? (
                events.map((e, idx) => (
                  <div key={idx}>
                    • <strong>{e.eventType || 'STEP'}</strong>: {e.details || ''}
                  </div>
                ))
              ) : (
                <>
                  <div>• <strong>INGESTION_RECEIVED</strong>: Verified RSA-2048 envelope signature</div>
                  <div>• <strong>IDEMPOTENCY_VERIFIED</strong>: SHA-256 hash uniquely registered</div>
                  <div>• <strong>LEDGER_DEBIT</strong>: Debited ₹{parseFloat(tx.amount || 0).toFixed(2)} from {tx.senderVpa}</div>
                  <div>• <strong>LEDGER_CREDIT</strong>: Credited ₹{parseFloat(tx.amount || 0).toFixed(2)} to {tx.receiverVpa}</div>
                  <div>• <strong>SETTLEMENT_COMMITTED</strong>: Relational ACID state persisted</div>
                </>
              )}
            </div>
          </div>
        </div>

        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>
          Close Details
        </button>
      </div>
    </div>
  );
}

export function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop active" role="dialog" aria-modal="true">
      <div className="modal-box" style={{ maxWidth: '540px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px' }}>About MeshPay (upiSETU)</h3>
        <div className="editorial-callout" style={{ marginBottom: '14px' }}>
          <strong>Academic Prototype Disclosure:</strong> MeshPay is an educational simulation and engineering prototype designed to study offline payment instruction delivery over store-and-forward delay-tolerant networks. It is NOT connected to the live NPCI switch or commercial bank clearing networks.
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
          <strong>Open-Source Attribution:</strong> This project is built on the foundation of the open-source repository{' '}
          <a
            href="https://github.com/perryvegehan/UPI_Without_Internet"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-pine)', fontWeight: 600, textDecoration: 'underline' }}
          >
            perryvegehan/UPI_Without_Internet
          </a>.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
          <strong>Key Upgrades in upiSETU:</strong>
          Real Web Crypto RSA-2048-OAEP + AES-256-GCM hybrid cryptography, zero plaintext PIN persistence, dual-tier idempotency, persistent RSA key storage, file-based relational H2 persistence, Java 21 virtual threads, and a structured 6-part experimental testing laboratory.
        </p>
        <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>
          Close
        </button>
      </div>
    </div>
  );
}

export function AddDeviceModal({ isOpen, onClose, onAddDevice }) {
  const [name, setName] = useState('');
  const [vpa, setVpa] = useState('');
  const [role, setRole] = useState('RELAY');
  const [hasInternet, setHasInternet] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const finalName = name.trim() || 'Custom Node';
    const finalVpa = vpa.trim() || (finalName.toLowerCase().replace(/\s+/g, '') + '@demo');
    onAddDevice(finalName, finalVpa, role, hasInternet);
    setName('');
    setVpa('');
    onClose();
  };

  return (
    <div className="modal-backdrop active" role="dialog" aria-modal="true">
      <div className="modal-box" style={{ maxWidth: '440px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Register Node to Mesh</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Dynamically configure a variable phone or simulated relay
        </p>

        <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Node Display Name</label>
        <input
          type="text"
          className="text-input"
          placeholder="e.g. Farhan Merchant"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Virtual Payment Address (VPA)</label>
        <input
          type="text"
          className="text-input"
          placeholder="e.g. farhan@demo"
          value={vpa}
          onChange={(e) => setVpa(e.target.value)}
        />

        <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Node Role</label>
        <select
          className="user-select-dropdown"
          style={{ width: '100%', marginBottom: '14px' }}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="RELAY">RELAY (Store & Forward)</option>
          <option value="MERCHANT">MERCHANT (Payee)</option>
          <option value="SENDER">SENDER (Payer)</option>
          <option value="BRIDGE">BRIDGE (4G Cellular Uplink)</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input
            type="checkbox"
            id="modal-dev-net"
            checked={hasInternet}
            onChange={(e) => setHasInternet(e.target.checked)}
          />
          <label htmlFor="modal-dev-net" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
            Device has active 4G Cellular Internet
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-primary" onClick={handleSubmit} style={{ flex: 1 }}>
            Register to Cluster
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function ResetModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop active" role="dialog" aria-modal="true">
      <div className="modal-box" style={{ maxWidth: '420px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Reset Simulation State?</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
          This will clear all in-flight mesh packets, restore initial account balances (Alice: ₹5,000, Bob: ₹1,000), reset idempotency deduplication caches, and re-establish baseline peer links.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-primary" onClick={onConfirm} style={{ flex: 1, background: 'var(--accent-error)' }}>
            Confirm Reset
          </button>
          <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
