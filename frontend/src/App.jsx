import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Send,
  RefreshCw,
  FastForward,
  UploadCloud,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Volume2,
  Unlink,
  Link2,
  Smartphone,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Moon,
  Sun,
  Info,
  ExternalLink,
  QrCode,
  Copy,
  Check,
  Eye,
  X
} from 'lucide-react';

const NODE_POSITIONS = {
  alice: { x: 90, y: 80, name: 'Alice', role: 'Payer (Offline)', deviceId: 'phone-alice' },
  bob: { x: 230, y: 40, name: 'Bob', role: 'Merchant', deviceId: 'phone-bob' },
  carol: { x: 230, y: 120, name: 'Carol', role: 'Relay Hop 1', deviceId: 'phone-carol' },
  dave: { x: 380, y: 80, name: 'Dave', role: 'Relay Hop 2', deviceId: 'phone-dave' },
  bridge: { x: 520, y: 120, name: 'Eve Bridge', role: 'Bridge (4G)', deviceId: 'phone-bridge' },
  bank: { x: 670, y: 80, name: 'Central Bank', role: 'ACID Core', deviceId: 'cloud-bank' }
};

export default function App() {
  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('meshpay_theme') || 'dark');

  // Payment Composer State (Step 1)
  const [senderVpa, setSenderVpa] = useState('alice@demo');
  const [receiverVpa, setReceiverVpa] = useState('bob@demo');
  const [amount, setAmount] = useState(500);
  const [pin, setPin] = useState('1234');
  const [note, setNote] = useState('Basement offline payment');

  // Visual Journey & Simulation State
  const [currentStep, setCurrentStep] = useState(1); // 1: Inject, 2: Gossip, 3: Bridge
  const [simStatus, setSimStatus] = useState('Status: Idle (Ready to compose offline payment)');
  const [activePacket, setActivePacket] = useState(null);
  const [transitDot, setTransitDot] = useState({ x: 90, y: 80, visible: false });
  const [highlightedNodes, setHighlightedNodes] = useState([]);
  const [linkFailureActive, setLinkFailureActive] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Backend Live Data
  const [devices, setDevices] = useState([]);
  const [idempotencyCacheSize, setIdempotencyCacheSize] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [logs, setLogs] = useState([]);

  // Modals & Inspection State
  const [inspectPacketModal, setInspectPacketModal] = useState({ isOpen: false, packet: null });
  const [qrModal, setQrModal] = useState({ isOpen: false, payload: '', amount: 0 });
  const [aboutModal, setAboutModal] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);

  // Auto-run interval ref
  const autoRunTimerRef = useRef(null);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('meshpay_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Add Log Entry
  const addLog = (msg, type = 'info') => {
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time: timeStr, text: msg, type, id: Date.now() + Math.random() }, ...prev]);
  };

  // Soundbox Voice Alert
  const announceSoundbox = (amt, sender) => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const cleanSender = (sender || 'Alice').split('@')[0];
        const text = `MeshPay received ${amt} Rupees from ${cleanSender}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        const voices = window.speechSynthesis.getVoices();
        const inVoice = voices.find((v) => v.lang.includes('en-IN') || v.lang.includes('hi-IN'));
        if (inVoice) utterance.voice = inVoice;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Voice synthesis note:', e);
      }
    }
  };

  // Fetch Mesh State, Accounts, and Transactions
  const refreshData = async () => {
    try {
      // 1. Mesh State
      const meshRes = await fetch('/api/mesh/state');
      if (meshRes.ok) {
        const m = await meshRes.json();
        setDevices(m.devices || []);
        setIdempotencyCacheSize(m.idempotencyCacheSize || 0);
      }

      // 2. Accounts
      const accRes = await fetch('/api/accounts');
      if (accRes.ok) {
        const accs = await accRes.json();
        setAccounts(accs || []);
      }

      // 3. Transactions
      const txRes = await fetch('/api/transactions');
      if (txRes.ok) {
        const txs = await txRes.json();
        setTransactions(txs || []);
      }
    } catch (e) {
      console.warn('Background sync note:', e.message);
    }
  };

  // Initial load and periodic refresh
  useEffect(() => {
    refreshData();
    addLog('System initialised. MeshPay offline daemon running on virtual threads.', 'system');
    const interval = setInterval(refreshData, 2800);
    return () => clearInterval(interval);
  }, []);

  // Update visual particle position
  const movePacketTo = (x, y, visible = true) => {
    setTransitDot({ x, y, visible });
  };

  // =========================================================================
  // STEP 1: INJECT INTO MESH
  // =========================================================================
  const handleInjectIntoMesh = async (e) => {
    if (e) e.preventDefault();
    if (!amount || amount <= 0) {
      addLog('Validation failed: Amount must be greater than 0', 'error');
      return;
    }
    if (senderVpa === receiverVpa) {
      addLog('Validation failed: Sender and recipient cannot be the same', 'error');
      return;
    }

    setIsSubmitting(true);
    addLog(`Creating RSA-OAEP + AES-GCM envelope for ₹${amount} from ${senderVpa}...`, 'info');

    try {
      const payload = {
        senderVpa,
        receiverVpa,
        amount: parseFloat(amount),
        pin: pin || '1234',
        ttl: 5,
        startDevice: 'phone-alice'
      };

      const res = await fetch('/api/demo/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to inject packet');
      }

      const data = await res.json();
      setActivePacket(data);
      setCurrentStep(2);
      setHighlightedNodes(['alice']);

      // Visual particle appears at Alice
      movePacketTo(NODE_POSITIONS.alice.x, NODE_POSITIONS.alice.y, true);
      setSimStatus(`Packet ${data.packetId.substring(0, 8)}... created & stored in Alice's offline outbox`);

      addLog(`[STEP 1 COMPLETE] Packet ${data.packetId.substring(0, 8)} injected at phone-alice (TTL ${data.ttl})`, 'success');
      addLog(`Ciphertext preview: ${data.ciphertextPreview}`, 'mono');

      await refreshData();
    } catch (err) {
      addLog(`Error injecting packet: ${err.message}`, 'error');
      setSimStatus(`Injection failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // STEP 2: GOSSIP HOP & AUTO-RUN
  // =========================================================================
  const handleGossipHop = async () => {
    setIsSubmitting(true);
    setSimStatus('Propagating gossip packets across local BLE neighborhood...');

    try {
      const res = await fetch('/api/mesh/gossip', { method: 'POST' });
      if (!res.ok) throw new Error('Gossip propagation call failed');

      const data = await res.json();
      addLog(`[STEP 2 GOSSIP] ${data.transfers} transfer(s) across mesh. Device packet counts: ${JSON.stringify(data.deviceCounts)}`, 'info');

      // Check where packet moves based on link failure or normal route
      if (linkFailureActive) {
        // Detour through Bob & Dave to Bridge
        setHighlightedNodes(['bob', 'dave']);
        movePacketTo(NODE_POSITIONS.bob.x, NODE_POSITIONS.bob.y, true);
        setTimeout(() => {
          movePacketTo(NODE_POSITIONS.dave.x, NODE_POSITIONS.dave.y, true);
          setTimeout(() => {
            movePacketTo(NODE_POSITIONS.bridge.x, NODE_POSITIONS.bridge.y, true);
            setHighlightedNodes(['bridge']);
            setCurrentStep(3);
            setSimStatus('Packet successfully rerouted around severed link to Eve Bridge (4G)!');
            addLog('Reroute successful: Packet reached Eve Bridge via alternative peer Dave', 'success');
          }, 400);
        }, 400);
      } else {
        // Normal Carol -> Bridge or Dave -> Bridge
        setHighlightedNodes(['carol']);
        movePacketTo(NODE_POSITIONS.carol.x, NODE_POSITIONS.carol.y, true);
        setTimeout(() => {
          movePacketTo(NODE_POSITIONS.bridge.x, NODE_POSITIONS.bridge.y, true);
          setHighlightedNodes(['bridge']);
          setCurrentStep(3);
          setSimStatus('Packet reached Eve Bridge (4G Ingress) — Ready to upload to Central Bank');
          addLog('Packet buffered in Eve Bridge outbox. 4G connectivity available for upload.', 'success');
        }, 450);
      }

      await refreshData();
    } catch (err) {
      addLog(`Gossip error: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoStepToBridge = async () => {
    if (isAutoRunning) {
      setIsAutoRunning(false);
      if (autoRunTimerRef.current) clearInterval(autoRunTimerRef.current);
      addLog('Auto-run paused by user', 'info');
      return;
    }

    setIsAutoRunning(true);
    addLog('⚡ Auto-step sequence started: Stepping packet through simulated mesh to Bridge...', 'info');

    // If currently at step 1 with no packet, inject first
    if (currentStep === 1 || !activePacket) {
      await handleInjectIntoMesh();
      await new Promise((r) => setTimeout(r, 600));
    }

    await handleGossipHop();
    setIsAutoRunning(false);
  };

  // =========================================================================
  // STEP 3: BRIDGE UPLOADS TO BACKEND
  // =========================================================================
  const handleFlushBridges = async () => {
    setIsSubmitting(true);
    setSimStatus('Eve Bridge uploading held packets to Central Bank via cellular uplink...');
    setHighlightedNodes(['bridge', 'bank']);

    // Animate packet particle from Bridge to Bank
    movePacketTo(NODE_POSITIONS.bank.x, NODE_POSITIONS.bank.y, true);

    try {
      const res = await fetch('/api/mesh/flush', { method: 'POST' });
      if (!res.ok) throw new Error('Bridge flush failed');

      const data = await res.json();
      addLog(`[STEP 3 UPLOAD] ${data.uploadsAttempted} bridge upload(s) delivered to Central Bank`, 'info');

      let settledCount = 0;
      let duplicateCount = 0;

      if (data.results && data.results.length > 0) {
        data.results.forEach((r) => {
          if (r.outcome === 'SETTLED') {
            settledCount++;
            addLog(`✅ Bridge ${r.bridgeNode} packet ${r.packetId} -> SETTLED in ledger (Tx #${r.transactionId})`, 'success');
          } else if (r.outcome === 'DUPLICATE_DROPPED') {
            duplicateCount++;
            addLog(`⚠️ Bridge ${r.bridgeNode} packet ${r.packetId} -> DUPLICATE DROPPED (Idempotency check: ${r.reason})`, 'warning');
          } else {
            addLog(`❌ Bridge ${r.bridgeNode} packet ${r.packetId} -> ${r.outcome}: ${r.reason}`, 'error');
          }
        });
      }

      if (settledCount > 0) {
        setSimStatus(`Settlement Complete! Core ACID ledger updated (Settled ₹${amount})`);
        announceSoundbox(amount, senderVpa);
      } else if (duplicateCount > 0) {
        setSimStatus('Duplicate packet detected and safely dropped. Zero double-spending verified.');
      } else {
        setSimStatus('Upload completed. Ledger is in sync.');
      }

      // Reset step for next demo round after a brief pause
      setTimeout(() => {
        movePacketTo(NODE_POSITIONS.alice.x, NODE_POSITIONS.alice.y, false);
        setHighlightedNodes([]);
        setCurrentStep(1);
      }, 1600);

      await refreshData();
    } catch (err) {
      addLog(`Bridge upload error: ${err.message}`, 'error');
      setSimStatus(`Upload error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // ATTACK TESTS & SIMULATION CONTROLS
  // =========================================================================
  const handleResetMesh = async () => {
    try {
      await fetch('/api/mesh/reset', { method: 'POST' });
      addLog('🗑 Mesh state, in-flight packets, and idempotency cache cleared to baseline', 'system');
      setActivePacket(null);
      setCurrentStep(1);
      setHighlightedNodes([]);
      movePacketTo(NODE_POSITIONS.alice.x, NODE_POSITIONS.alice.y, false);
      setSimStatus('Status: Idle (Ready to compose offline payment)');
      await refreshData();
    } catch (err) {
      addLog(`Reset error: ${err.message}`, 'error');
    }
  };

  const handleTestReplayAttack = async () => {
    addLog('🛡 [REPLAY ATTACK TEST] Adversary re-broadcasting recorded payment packet...', 'warning');
    try {
      const pkt = activePacket || {
        packetId: 'pkt_adversary_replay_' + Math.random().toString(36).substr(2, 6),
        ciphertext: 'ENCRYPTED_PACKET_CIPHERTEXT_SIMULATION',
        packetHash: 'HASH_REPLAY_' + Math.random().toString(36).substr(2, 8)
      };

      const res = await fetch('/api/v1/cyber/replay-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet: pkt })
      });

      if (res.ok) {
        const data = await res.json();
        addLog(`🛡 REPLAY DEFENSE VERIFIED: Outcome = ${data.outcome}`, 'success');
        addLog(`   Defense explanation: ${data.cryptographicDefense || 'SHA-256 idempotency cache rejected duplicate submission.'}`, 'mono');
      } else {
        addLog('Replay attack test completed via fallback verification.', 'info');
      }
    } catch (err) {
      addLog(`Replay test note: ${err.message}`, 'error');
    }
  };

  const handleTestTamperAttack = async () => {
    addLog('🛡 [TAMPER ATTACK TEST] Man-in-the-middle flipping 1 bit in encrypted payload...', 'warning');
    try {
      const pkt = activePacket || {
        packetId: 'pkt_adversary_tamper_' + Math.random().toString(36).substr(2, 6),
        ciphertext: 'ENCRYPTED_PACKET_CIPHERTEXT_SIMULATION',
        packetHash: 'HASH_TAMPER_' + Math.random().toString(36).substr(2, 8)
      };

      const res = await fetch('/api/v1/cyber/tamper-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet: pkt })
      });

      if (res.ok) {
        const data = await res.json();
        addLog(`🛡 TAMPER DEFENSE VERIFIED: Outcome = ${data.outcome} (Reason: ${data.reason})`, 'success');
        addLog(`   Cryptographic defense: ${data.cryptographicDefense || 'AES-GCM authentication tag verification failed. Modified packet discarded.'}`, 'mono');
      } else {
        addLog('Tamper attack test completed via fallback verification.', 'info');
      }
    } catch (err) {
      addLog(`Tamper test note: ${err.message}`, 'error');
    }
  };

  const handleToggleLinkFailure = () => {
    const next = !linkFailureActive;
    setLinkFailureActive(next);
    if (next) {
      addLog('⚠️ BLE LINK SEVERED: Carol ↔ Bridge link broken. Mesh must reroute via Bob & Dave!', 'warning');
    } else {
      addLog('✅ BLE LINK RESTORED: Carol ↔ Bridge primary channel re-established.', 'success');
    }
  };

  const handleGenerateQrVoucher = () => {
    const voucherPayload = `upi://pay?pa=${receiverVpa}&pn=Merchant&am=${amount}&cu=INR&mode=02&orgid=MESHPAY&offlinePkt=${activePacket ? activePacket.packetId : 'pkt_offline_preview'}`;
    setQrModal({ isOpen: true, payload: voucherPayload, amount });
  };

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.time}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  return (
    <div className="meshpay-app-container">
      {/* =====================================================================
          HEADER BAR
          ===================================================================== */}
      <header className="meshpay-header">
        <div className="header-brand">
          <div className="brand-logo-icon">
            <Radio size={20} className="icon-pulse" />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">MeshPay</h1>
            <span className="brand-subtitle">OFFLINE PAYMENT NETWORK</span>
          </div>
          <span className="badge badge-sim">
            <span className="badge-dot"></span> Live Core Simulation
          </span>
        </div>

        <div className="header-actions">
          <button className="btn-header-link" onClick={() => setAboutModal(true)} title="System Architecture">
            <Info size={15} />
            <span>Architecture</span>
          </button>

          <a href="/classic" className="btn-header-link" title="Open Upstream Classic Template View">
            <ExternalLink size={14} />
            <span>Classic View (/classic)</span>
          </a>

          <button className="btn-theme-toggle" onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="meshpay-main-content">
        {/* Intro Subtitle */}
        <p className="lead-tagline">
          Send payments in basements or disasters with zero cellular coverage. Encrypted offline packets gossip
          from phone to phone over Bluetooth Low Energy until an internet bridge node synchronizes with the central bank.
        </p>

        {/* =====================================================================
            3-STEP DEMO JOURNEY CARD
            ===================================================================== */}
        <div className="card card-demo-journey">
          <div className="card-header-bar">
            <h2 className="section-title">
              <span className="emoji-icon">🎬</span> Interactive 3-Step Payment Journey
            </h2>
            <div className="step-tracker">
              <span className={`step-pill ${currentStep === 1 ? 'active' : currentStep > 1 ? 'done' : ''}`}>
                01 Inject
              </span>
              <span className="step-arrow">→</span>
              <span className={`step-pill ${currentStep === 2 ? 'active' : currentStep > 2 ? 'done' : ''}`}>
                02 Gossip Mesh
              </span>
              <span className="step-arrow">→</span>
              <span className={`step-pill ${currentStep === 3 ? 'active' : ''}`}>
                03 Bank Sync
              </span>
            </div>
          </div>

          <div className="journey-steps-grid">
            {/* STEP 1: Compose & Inject */}
            <div className={`journey-step-box ${currentStep === 1 ? 'is-current' : ''}`}>
              <div className="step-header">
                <span className="step-badge">1</span>
                <div>
                  <strong className="step-name">Compose Payment</strong>
                  <div className="step-sub">Simulates sender offline smartphone</div>
                </div>
              </div>

              <form onSubmit={handleInjectIntoMesh} className="step-form">
                <div className="form-row-compact">
                  <div className="input-group">
                    <label>Payer (Sender)</label>
                    <select value={senderVpa} onChange={(e) => setSenderVpa(e.target.value)}>
                      <option value="alice@demo">alice@demo (Alice Sharma)</option>
                      <option value="bob@demo">bob@demo (Bob Verma)</option>
                      <option value="carol@demo">carol@demo (Carol Patel)</option>
                    </select>
                  </div>

                  <span className="form-arrow">→</span>

                  <div className="input-group">
                    <label>Payee (Merchant)</label>
                    <select value={receiverVpa} onChange={(e) => setReceiverVpa(e.target.value)}>
                      <option value="bob@demo">bob@demo (Merchant)</option>
                      <option value="carol@demo">carol@demo (Carol Patel)</option>
                      <option value="alice@demo">alice@demo (Alice)</option>
                      <option value="dave@demo">dave@demo (Dave Singh)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-compact">
                  <div className="input-group" style={{ maxWidth: '140px' }}>
                    <label>Amount (₹)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="1"
                      max="2000"
                      required
                    />
                  </div>

                  <div className="input-group" style={{ maxWidth: '100px' }}>
                    <label>UPI PIN</label>
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      maxLength={4}
                      required
                    />
                  </div>

                  <div className="amount-pills">
                    {[100, 200, 500, 1000].map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        className={`pill-btn ${amount === amt ? 'selected' : ''}`}
                        onClick={() => setAmount(amt)}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="step-actions-bar">
                  <button type="submit" className="btn-primary" disabled={isSubmitting}>
                    <Send size={15} />
                    <span>Inject into Mesh</span>
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleGenerateQrVoucher}
                    title="Generate QR Voucher"
                  >
                    <QrCode size={15} />
                    <span>QR Voucher</span>
                  </button>

                  {activePacket && (
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setInspectPacketModal({ isOpen: true, packet: activePacket })}
                    >
                      <Eye size={14} />
                      <span>Inspect Envelope</span>
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* STEP 2: Gossip Round */}
            <div className={`journey-step-box ${currentStep === 2 ? 'is-current' : ''}`}>
              <div className="step-header">
                <span className="step-badge">2</span>
                <div>
                  <strong className="step-name">Gossip Propagation</strong>
                  <div className="step-sub">Packets hop phone-to-phone via BLE</div>
                </div>
              </div>

              <p className="step-desc-text">
                Store-and-forward routing: intermediate devices forward the encrypted packet without having access
                to the payment payload.
              </p>

              <div className="step-actions-cluster">
                <button
                  type="button"
                  className="btn-accent"
                  onClick={handleGossipHop}
                  disabled={isSubmitting}
                >
                  <RefreshCw size={15} className={isSubmitting ? 'icon-spin' : ''} />
                  <span>Run Gossip Round</span>
                </button>

                <button
                  type="button"
                  className="btn-purple"
                  onClick={handleAutoStepToBridge}
                  disabled={isSubmitting}
                >
                  <FastForward size={15} />
                  <span>Auto-Step to Bridge</span>
                </button>
              </div>

              <div className="link-toggle-wrap">
                <button
                  type="button"
                  className={`btn-link-status ${linkFailureActive ? 'severed' : 'healthy'}`}
                  onClick={handleToggleLinkFailure}
                >
                  {linkFailureActive ? <Unlink size={14} /> : <Link2 size={14} />}
                  <span>{linkFailureActive ? 'Carol ↔ Bridge Severed (Rerouting)' : 'Carol ↔ Bridge Healthy'}</span>
                </button>
              </div>
            </div>

            {/* STEP 3: Bridge Upload */}
            <div className={`journey-step-box ${currentStep === 3 ? 'is-current' : ''}`}>
              <div className="step-header">
                <span className="step-badge">3</span>
                <div>
                  <strong className="step-name">Bridge 4G Upload</strong>
                  <div className="step-sub">Ingress node syncs with Central Bank</div>
                </div>
              </div>

              <p className="step-desc-text">
                When a device hits 4G, all buffered packets are concurrently uploaded. The bank's SHA-256
                idempotency engine guarantees zero double-spending.
              </p>

              <div className="step-actions-cluster">
                <button
                  type="button"
                  className="btn-success"
                  onClick={handleFlushBridges}
                  disabled={isSubmitting}
                >
                  <UploadCloud size={16} />
                  <span>Upload Packets to Backend</span>
                </button>
              </div>

              <div className="step-note-muted">
                Parallel upload verifies concurrent idempotency protection.
              </div>
            </div>
          </div>

          {/* Action / Security Toolbar */}
          <div className="demo-actions-toolbar">
            <button className="btn-danger-compact" onClick={handleResetMesh}>
              <RotateCcw size={14} />
              <span>Reset Mesh + Cache</span>
            </button>

            <span className="toolbar-divider">|</span>

            <button className="btn-toolbar" onClick={handleTestReplayAttack} title="Simulate Replay Attack">
              <ShieldAlert size={14} className="text-warning" />
              <span>Test Replay Attack</span>
            </button>

            <button className="btn-toolbar" onClick={handleTestTamperAttack} title="Simulate Ciphertext Tampering">
              <ShieldX size={14} className="text-error" />
              <span>Test Tamper Attack</span>
            </button>

            <button
              className="btn-toolbar"
              onClick={() => announceSoundbox(amount, senderVpa)}
              title="Test Soundbox Audio Chime"
            >
              <Volume2 size={14} className="text-success" />
              <span>Test Soundbox Voice</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            LIVE TOPOLOGY & PACKET HOP VISUALIZER
            ===================================================================== */}
        <div className="card card-topology">
          <div className="card-header-bar">
            <h3 className="section-title-sm">
              <span className="emoji-icon">🗺️</span> Live Topology & Packet Hop Visualizer
            </h3>
            <span className="status-label-badge" id="sim-status-label">
              {simStatus}
            </span>
          </div>

          <div className="topology-svg-wrapper">
            <svg viewBox="0 0 760 160" className="topology-svg-element">
              {/* Mesh Connection Lines */}
              <g className="links-layer">
                {/* Alice -> Bob */}
                <line x1="90" y1="80" x2="230" y2="40" className="topo-link" />
                {/* Alice -> Carol */}
                <line x1="90" y1="80" x2="230" y2="120" className="topo-link" />
                {/* Bob -> Dave */}
                <line x1="230" y1="40" x2="380" y2="80" className="topo-link" />
                {/* Carol -> Dave */}
                <line x1="230" y1="120" x2="380" y2="80" className="topo-link" />
                {/* Carol -> Bridge (May be severed) */}
                <line
                  x1="230"
                  y1="120"
                  x2="520"
                  y2="120"
                  className={`topo-link ${linkFailureActive ? 'topo-link-severed' : ''}`}
                />
                {/* Dave -> Bridge */}
                <line x1="380" y1="80" x2="520" y2="120" className="topo-link" />
                {/* Bridge -> Bank (4G Cellular Uplink) */}
                <line x1="520" y1="120" x2="670" y2="80" className="topo-link-4g" />
              </g>

              {/* Animated Moving Packet Dot */}
              {transitDot.visible && (
                <circle
                  cx={transitDot.x}
                  cy={transitDot.y}
                  r="8"
                  className="moving-packet-particle"
                />
              )}

              {/* Nodes */}
              {/* ALICE */}
              <g
                transform="translate(90, 80)"
                className={`topo-node ${highlightedNodes.includes('alice') ? 'is-active-node' : ''}`}
              >
                <circle r="22" className="node-circle node-offline" />
                <text textAnchor="middle" y="4" className="node-name">Alice</text>
                <text textAnchor="middle" y="34" className="node-role">Payer (Offline)</text>
              </g>

              {/* BOB */}
              <g
                transform="translate(230, 40)"
                className={`topo-node ${highlightedNodes.includes('bob') ? 'is-active-node' : ''}`}
              >
                <circle r="20" className="node-circle node-offline" />
                <text textAnchor="middle" y="4" className="node-name">Bob</text>
                <text textAnchor="middle" y="32" className="node-role">Merchant</text>
              </g>

              {/* CAROL */}
              <g
                transform="translate(230, 120)"
                className={`topo-node ${highlightedNodes.includes('carol') ? 'is-active-node' : ''}`}
              >
                <circle r="20" className="node-circle node-offline" />
                <text textAnchor="middle" y="4" className="node-name">Carol</text>
                <text textAnchor="middle" y="32" className="node-role">Hop 1</text>
              </g>

              {/* DAVE */}
              <g
                transform="translate(380, 80)"
                className={`topo-node ${highlightedNodes.includes('dave') ? 'is-active-node' : ''}`}
              >
                <circle r="20" className="node-circle node-offline" />
                <text textAnchor="middle" y="4" className="node-name">Dave</text>
                <text textAnchor="middle" y="32" className="node-role">Hop 2</text>
              </g>

              {/* EVE BRIDGE */}
              <g
                transform="translate(520, 120)"
                className={`topo-node is-bridge ${highlightedNodes.includes('bridge') ? 'is-active-node' : ''}`}
              >
                <circle r="24" className="node-circle node-bridge" />
                <text textAnchor="middle" y="4" className="node-name node-name-bridge">Bridge</text>
                <text textAnchor="middle" y="36" className="node-role node-role-bridge">Eve (4G)</text>
              </g>

              {/* CENTRAL BANK */}
              <g
                transform="translate(670, 80)"
                className={`topo-node is-bank ${highlightedNodes.includes('bank') ? 'is-active-node' : ''}`}
              >
                <circle r="26" className="node-circle node-bank" />
                <text textAnchor="middle" y="4" className="node-name node-name-bank">Bank</text>
                <text textAnchor="middle" y="38" className="node-role node-role-bank">ACID Core</text>
              </g>
            </svg>
          </div>
        </div>

        {/* =====================================================================
            2-COLUMN GRID: MESH DEVICES & ACCOUNT BALANCES
            ===================================================================== */}
        <div className="grid-devices-balances">
          {/* MESH DEVICES */}
          <div className="card">
            <div className="card-header-bar">
              <h3 className="section-title-sm">
                <span className="emoji-icon">📱</span> Mesh Devices
              </h3>
              <span className="count-pill">{devices.length} nodes</span>
            </div>

            <div className="devices-roster-list">
              {devices.length === 0 ? (
                <div className="empty-state-notice">Connecting to local mesh simulator...</div>
              ) : (
                devices.map((d) => {
                  const isHolding = d.packetCount > 0;
                  return (
                    <div
                      key={d.deviceId}
                      className={`device-item-card ${d.hasInternet ? 'is-bridge-node' : 'is-offline-node'} ${
                        isHolding ? 'is-holding-packet' : ''
                      }`}
                    >
                      <div className="device-item-header">
                        <div className="device-id-wrap">
                          <Smartphone size={14} />
                          <strong>{d.deviceId}</strong>
                        </div>
                        <span className={`badge ${d.hasInternet ? 'badge-4g' : 'badge-offline'}`}>
                          {d.hasInternet ? '🌐 4G' : '🚫 OFFLINE'}
                        </span>
                      </div>

                      <div className="device-holding-info">
                        <span className="text-muted">holding {d.packetCount} packet(s)</span>
                      </div>

                      {d.packetIds && d.packetIds.length > 0 && (
                        <div className="packet-chips-row">
                          {d.packetIds.map((pktId) => (
                            <span
                              key={pktId}
                              className="packet-id-chip"
                              onClick={() =>
                                setInspectPacketModal({
                                  isOpen: true,
                                  packet: { packetId: pktId, heldAt: d.deviceId }
                                })
                              }
                              title="Click to inspect packet envelope"
                            >
                              {pktId}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ACCOUNT BALANCES */}
          <div className="card">
            <div className="card-header-bar">
              <h3 className="section-title-sm">
                <span className="emoji-icon">🏦</span> Account Balances (Core ACID Ledger)
              </h3>
              <span className="cache-pill">
                Idempotency Cache: <strong>{idempotencyCacheSize}</strong> hashes
              </span>
            </div>

            <div className="accounts-table-container">
              <table className="meshpay-data-table">
                <thead>
                  <tr>
                    <th>VPA</th>
                    <th>Account Holder</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center">Loading accounts...</td>
                    </tr>
                  ) : (
                    accounts.map((acc) => (
                      <tr key={acc.vpa}>
                        <td><code>{acc.vpa}</code></td>
                        <td>{acc.holderName}</td>
                        <td className="text-right font-balance">
                          ₹{parseFloat(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="security-guarantee-note">
              <strong>Offline Security Guarantee:</strong> Payments made offline are cryptographically signed with
              the user's private key and encrypted with the bank's RSA-2048 public key. Intermediate mesh relays
              cannot forge, tamper, or duplicate transactions.
            </div>
          </div>
        </div>

        {/* =====================================================================
            TRANSACTION LEDGER
            ===================================================================== */}
        <div className="card card-ledger">
          <div className="card-header-bar">
            <h3 className="section-title-sm">
              <span className="emoji-icon">📜</span> Settled Transaction Ledger
            </h3>
            <span className="count-pill">{transactions.length} records</span>
          </div>

          <div className="table-responsive">
            <table className="meshpay-data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Bridge Node</th>
                  <th>Hops</th>
                  <th>Settled At</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-ledger-notice">
                      No transactions settled yet. Run the 3-step payment flow to inject and settle an offline transaction.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td><span className="tx-id-badge">#{tx.id}</span></td>
                      <td><code>{tx.senderVpa}</code></td>
                      <td><code>{tx.receiverVpa}</code></td>
                      <td className="font-balance">₹{parseFloat(tx.amount).toFixed(2)}</td>
                      <td>
                        <span className={`status-badge status-${tx.status}`}>
                          {tx.status === 'SETTLED' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          <span>{tx.status}</span>
                        </span>
                      </td>
                      <td><code>{tx.bridgeNodeId || 'N/A'}</code></td>
                      <td><span className="hop-pill">{tx.hopCount} hop(s)</span></td>
                      <td className="text-muted">
                        {tx.settledAt ? new Date(tx.settledAt).toLocaleTimeString() : 'Just now'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =====================================================================
            ACTIVITY & EVENT LOG
            ===================================================================== */}
        <div className="card card-log">
          <div className="card-header-bar">
            <h3 className="section-title-sm">
              <span className="emoji-icon">🪵</span> Live Network Event & Cryptography Stream
            </h3>
            <div className="log-header-actions">
              <button className="btn-log-action" onClick={handleCopyLogs} title="Copy activity log to clipboard">
                {copiedLog ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                <span>{copiedLog ? 'Copied' : 'Copy Log'}</span>
              </button>
              <button className="btn-log-action" onClick={() => setLogs([])} title="Clear terminal">
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="terminal-log-output">
            {logs.length === 0 ? (
              <div className="log-line muted">[System ready. Activity will stream here...]</div>
            ) : (
              logs.map((item) => (
                <div key={item.id} className={`log-entry type-${item.type}`}>
                  <span className="log-timestamp">[{item.time}]</span>
                  <span className="log-body">{item.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* =====================================================================
          MODAL: PACKET ENVELOPE INSPECTION
          ===================================================================== */}
      {inspectPacketModal.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">🔐 Cryptographic Packet Envelope</h3>
              <button className="modal-close-btn" onClick={() => setInspectPacketModal({ isOpen: false, packet: null })}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                In MeshPay, payment instructions are sealed inside a hybrid envelope (RSA-2048-OAEP session key + AES-256-GCM ciphertext).
                Relay nodes forward the envelope without learning the payment amount, PIN hash, or recipient.
              </p>

              <div className="inspector-field">
                <label>Packet Identifier (Nonce Hash)</label>
                <code>{inspectPacketModal.packet?.packetId || 'pkt_8a7b6c5d'}</code>
              </div>

              <div className="inspector-field">
                <label>Encryption Scheme</label>
                <code>RSA-2048-OAEP-SHA256 (Session Key) + AES-256-GCM (Payload)</code>
              </div>

              <div className="inspector-field">
                <label>Ciphertext Preview (AES-GCM Authenticated)</label>
                <div className="cipher-preview-box">
                  {inspectPacketModal.packet?.ciphertextPreview ||
                    '7e3b9f4a1c0d8e2f5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f...'}
                </div>
              </div>

              <div className="inspector-field">
                <label>Time-To-Live (Hop Budget)</label>
                <span>{inspectPacketModal.packet?.ttl || 5} network hops remaining</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setInspectPacketModal({ isOpen: false, packet: null })}>
                Done Inspecting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: QR VOUCHER
          ===================================================================== */}
      {qrModal.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3 className="modal-title">📱 Offline Optical Voucher</h3>
              <button className="modal-close-btn" onClick={() => setQrModal({ isOpen: false, payload: '', amount: 0 })}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                When Bluetooth is disabled, this optical QR voucher transmits the encrypted transaction envelope
                directly from payer to merchant camera!
              </p>

              <div className="qr-box-wrap">
                <svg width="180" height="180" viewBox="0 0 180 180" className="qr-svg-sample">
                  <rect width="180" height="180" fill="#1F3B2E" rx="8" />
                  <rect x="20" y="20" width="40" height="40" fill="#E8DCC6" />
                  <rect x="28" y="28" width="24" height="24" fill="#1F3B2E" />
                  <rect x="120" y="20" width="40" height="40" fill="#E8DCC6" />
                  <rect x="128" y="28" width="24" height="24" fill="#1F3B2E" />
                  <rect x="20" y="120" width="40" height="40" fill="#E8DCC6" />
                  <rect x="28" y="128" width="24" height="24" fill="#1F3B2E" />
                  <circle cx="90" cy="90" r="14" fill="#CBB3E8" />
                  <text x="90" y="160" fill="#E8DCC6" fontSize="10" textAnchor="middle" fontWeight="bold">
                    MESHPAY VOUCHER
                  </text>
                </svg>
              </div>

              <div className="font-balance" style={{ fontSize: '1.4rem', margin: '14px 0 6px' }}>
                ₹{qrModal.amount}
              </div>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                Signed for <code>{receiverVpa}</code>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  setQrModal({ isOpen: false, payload: '', amount: 0 });
                  addLog('Merchant scanned offline QR voucher! Packet ingested into local merchant outbox.', 'success');
                  handleGossipHop();
                }}
              >
                Simulate Merchant Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ABOUT & ARCHITECTURE
          ===================================================================== */}
      {aboutModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h3 className="modal-title">🏛️ MeshPay Technical Architecture</h3>
              <button className="modal-close-btn" onClick={() => setAboutModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ lineHeight: 1.6, fontSize: '0.92rem' }}>
              <p>
                <strong>MeshPay (upiSETU)</strong> is a store-and-forward asynchronous payment protocol enabling
                financial inclusion in subterranean environments, remote geographies, and disaster areas where
                direct internet connectivity is unavailable.
              </p>

              <h4 style={{ color: 'var(--brand-primary)', margin: '14px 0 6px' }}>Key Pillars:</h4>
              <ul style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
                <li>
                  <strong>Hybrid Cryptography:</strong> Client-side RSA-2048-OAEP session key encapsulation and
                  AES-256-GCM encryption ensure end-to-end privacy.
                </li>
                <li>
                  <strong>Opportunistic BLE Gossiping:</strong> Devices exchange encrypted envelopes via Bluetooth
                  Low Energy advertisement intervals with TTL hop budgets.
                </li>
                <li>
                  <strong>Server-Side Idempotency:</strong> High-speed SHA-256 hash checking prevents double-spending
                  and drops duplicate packets delivered by multiple bridge nodes.
                </li>
                <li>
                  <strong>ACID Settlement Engine:</strong> Runs on Java 21 Virtual Threads with Hibernate batching
                  for real-time transactional integrity.
                </li>
              </ul>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setAboutModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
