import React, { useState } from 'react';
import { Eye, EyeOff, Send, QrCode, Camera, Volume2, ShieldCheck, Clock } from 'lucide-react';

export default function PaymentsView({
  balance,
  allowanceRemaining,
  allowanceSpent,
  allowanceLimit,
  peers,
  selectedRecipient,
  setSelectedRecipient,
  onInitiatePayment,
  onOpenMerchantQr,
  onOpenScanner,
  onTestSoundbox,
  onReplenishAllowance,
  outboxCount,
  onSyncBank
}) {
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState('Coffee & Snacks');

  const presetAmounts = [50, 100, 200, 500];

  const handleQuickAmount = (val) => {
    setAmount(val);
  };

  const handleStartPayment = (mode) => {
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (amount > 500) {
      alert('RBI UPI-Lite limit: Maximum ₹500 per offline transaction');
      return;
    }
    onInitiatePayment(amount, note, mode);
  };

  const allowancePercent = Math.round((allowanceRemaining / allowanceLimit) * 100);

  return (
    <main className="workspace-view active">
      {/* Top Hero Balance Row */}
      <div className="balance-hero-card">
        <div className="balance-top-row">
          <span className="balance-label">Verified Core Ledger Balance</span>
          <button
            className="icon-button"
            onClick={() => setBalanceHidden(!balanceHidden)}
            title="Toggle Balance Privacy"
          >
            {balanceHidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="balance-val-row">
          <span className="balance-currency">₹</span>
          <span className="balance-amount tabular-nums">
            {balanceHidden ? '••••••' : parseFloat(balance || 5000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* UPI-Lite Offline Allowance Gauge */}
        <div className="allowance-box">
          <div className="allowance-row">
            <span>UPI-Lite Offline Allowance (RBI ₹2,000 Cap)</span>
            <span className="tabular-nums">₹{allowanceRemaining.toFixed(2)} available</span>
          </div>
          <div className="allowance-bar-track">
            <div className="allowance-bar-fill" style={{ width: `${allowancePercent}%` }}></div>
          </div>
          <div className="allowance-meta">
            <span>Limit per offline transaction: ₹500.00</span>
            <a
              href="#replenish"
              onClick={(e) => { e.preventDefault(); onReplenishAllowance(); }}
              style={{ color: 'var(--color-pine)', textDecoration: 'underline', fontWeight: 600 }}
            >
              + Replenish Allowance
            </a>
          </div>
        </div>
      </div>

      {/* 2-Column Payment Grid */}
      <div className="payments-grid">
        {/* Left: Payment Form Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Send size={18} />
              <span>Create Offline Payment</span>
            </div>
            <span className="exp-badge">Web Crypto Enclave</span>
          </div>

          <div className="editorial-callout">
            Encapsulates an offline payment instruction into an authenticated zero-trust hybrid envelope (RSA-2048-OAEP + AES-256-GCM). The payload is safely routable by untrusted intermediate devices without exposing amounts, PINs, or balances.
          </div>

          {/* Recipient Selector */}
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            Select Nearby Peer / Merchant in Range
          </label>
          <div className="recipient-list-group">
            {peers.map((p) => {
              const isSelected = selectedRecipient && selectedRecipient.vpa === p.vpa;
              return (
                <div
                  key={p.vpa}
                  className={`recipient-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedRecipient(p)}
                >
                  <span className="chip-name">{p.name}</span>
                  <span className="chip-vpa">{p.vpa} • {p.dist || '1.5m'}</span>
                </div>
              );
            })}
          </div>

          {/* Amount Input */}
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            Transaction Amount (INR)
          </label>
          <div className="amount-input-wrap">
            <span className="amount-symbol">₹</span>
            <input
              type="number"
              className="amount-field tabular-nums"
              min="1"
              max="500"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Preset Quick Buttons */}
          <div className="preset-row">
            {presetAmounts.map((amt) => (
              <button
                key={amt}
                className={`preset-btn ${amount === amt ? 'active' : ''}`}
                onClick={() => handleQuickAmount(amt)}
              >
                ₹{amt}
              </button>
            ))}
          </div>

          {/* Note Input */}
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            Purpose / Note
          </label>
          <input
            type="text"
            className="text-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Chai, Groceries, Metro token"
          />

          {/* Submit Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-primary" onClick={() => handleStartPayment('ble')} style={{ flex: 1 }}>
              <ShieldCheck size={16} />
              <span>Sign & Dispatch via Mesh</span>
            </button>
            <button className="btn-secondary" onClick={() => handleStartPayment('qr')} title="Generate scannable offline optical voucher">
              <QrCode size={16} />
              <span>Voucher QR</span>
            </button>
          </div>

          {/* Outbox Strip */}
          <div className="outbox-strip">
            <div className="outbox-label">
              <Clock size={16} style={{ color: 'var(--accent-warning)' }} />
              <span>Pending Outbox Packets: <strong>{outboxCount}</strong></span>
            </div>
            <button className="btn-secondary" onClick={onSyncBank} style={{ padding: '4px 12px', fontSize: '0.74rem' }}>
              Flush to Bank
            </button>
          </div>
        </div>

        {/* Right: Walkthrough Infographic & Soundbox */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <ShieldCheck size={18} />
                <span>Offline Lifecycle Architecture</span>
              </div>
              <span className="card-subtitle">RFC 4838 Delay-Tolerant Networking</span>
            </div>

            <div className="workflow-steps-box">
              <div className="workflow-step">
                <div className="step-num-badge">1</div>
                <div className="step-content">
                  <span className="step-title">Client-Side Hybrid Cryptography</span>
                  <span className="step-desc">Sender generates a one-time 256-bit AES key, encrypts instruction JSON with AES-GCM, and encrypts the AES key with the Bank's RSA-2048 public key.</span>
                </div>
              </div>
              <div className="workflow-step">
                <div className="step-num-badge">2</div>
                <div className="step-content">
                  <span className="step-title">Local IndexedDB Outbox Persistence</span>
                  <span className="step-desc">The encrypted envelope is securely held in browser IndexedDB. Transactions survive device reboots and basement connectivity loss.</span>
                </div>
              </div>
              <div className="workflow-step">
                <div className="step-num-badge">3</div>
                <div className="step-content">
                  <span className="step-title">Store-and-Forward Gossip Relay</span>
                  <span className="step-desc">Packets hop across nearby BLE peers (Carol, Dave). Intermediate nodes forward packets without having cryptographic ability to read balances or PINs.</span>
                </div>
              </div>
              <div className="workflow-step">
                <div className="step-num-badge">4</div>
                <div className="step-content">
                  <span className="step-title">Opportunistic 4G Ingress & Settlement</span>
                  <span className="step-desc">Any node with cellular internet acts as a bridge, uploading packets to the central bank for SHA-256 deduplication and atomic ledger settlement.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Merchant Soundbox & QR Hub */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Volume2 size={18} />
                <span>Merchant Soundbox & QR Hub</span>
              </div>
              <span className="card-subtitle">Payee Audio & Optical Ingress</span>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.45 }}>
              Merchants receive real-time voice confirmations via the Web Speech API when offline packets settle, and can display static or dynamic QR codes for customer scanning.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" onClick={onOpenMerchantQr} style={{ flex: 1 }}>
                <QrCode size={15} />
                <span>Display Merchant QR</span>
              </button>
              <button className="btn-secondary" onClick={onOpenScanner} style={{ flex: 1 }}>
                <Camera size={15} />
                <span>Scan Optical Voucher</span>
              </button>
              <button className="btn-secondary" onClick={onTestSoundbox} title="Test Soundbox Audio Chime">
                <Volume2 size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
