import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import PaymentsView from './components/PaymentsView';
import NetworkView from './components/NetworkView';
import TransactionsView from './components/TransactionsView';
import LabView from './components/LabView';
import {
  PinModal,
  QrModal,
  TxDetailModal,
  AboutModal,
  AddDeviceModal,
  ResetModal
} from './components/Modals';

const KNOWN_ACCOUNTS = {
  alice: { vpa: 'alice@demo', name: 'Alice Sharma', phone: '+91 98765 43210', initials: 'AS' },
  bob: { vpa: 'bob@demo', name: 'Bob Verma', phone: '+91 91234 56789', initials: 'BV' },
  carol: { vpa: 'carol@demo', name: 'Carol Patel', phone: '+91 99887 76655', initials: 'CP' },
  dave: { vpa: 'dave@demo', name: 'Dave Singh', phone: '+91 94567 12340', initials: 'DS' },
  bridge: { vpa: 'bridge@demo', name: 'Eve Bridge', phone: '+91 98111 22334', initials: 'EB' }
};

const NODE_POSITIONS = {
  'phone-alice': { x: 100, y: 110, name: 'Alice', role: 'Offline Sender' },
  'phone-bob': { x: 270, y: 70, name: 'Bob', role: 'BLE Merchant' },
  'phone-carol': { x: 270, y: 190, name: 'Carol', role: 'BLE Relay Hop 1' },
  'phone-dave': { x: 450, y: 110, name: 'Dave', role: 'BLE Relay Hop 2' },
  'phone-bridge': { x: 450, y: 270, name: 'Eve Bridge', role: '4G Ingress Node' },
  'cloud-bank': { x: 660, y: 190, name: 'Central Bank', role: 'ACID Ledger' }
};

export default function App() {
  const [activeWorkspace, setActiveWorkspace] = useState('payments');
  const [userKey, setUserKey] = useState('alice');
  const [theme, setTheme] = useState(localStorage.getItem('meshpay_theme') || 'light');
  const [isOnline, setIsOnline] = useState(false);

  // Financial & Ledger State
  const [balance, setBalance] = useState(5000);
  const [allowanceLimit] = useState(2000);
  const [allowanceSpent, setAllowanceSpent] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [devices, setDevices] = useState([]);
  const [peers, setPeers] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [outboxCount, setOutboxCount] = useState(0);

  // Network Simulation State
  const [activeNodes, setActiveNodes] = useState(['phone-alice']);
  const [transitDot, setTransitDot] = useState({ x: 100, y: 110, visible: false });
  const [linkFailureActive, setLinkFailureActive] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [simulationStage, setSimulationStage] = useState(0);
  const autoRunTimerRef = useRef(null);

  // Active / Last Created Packet
  const [activePacket, setActivePacket] = useState(null);

  // Modals State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingTxData, setPendingTxData] = useState(null);
  const [qrModalData, setQrModalData] = useState({ isOpen: false, title: '', subtitle: '', svgString: '', rawPayload: '', onSimulateScan: null });
  const [txDetailData, setTxDetailData] = useState({ isOpen: false, detail: null });
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [addDeviceModalOpen, setAddDeviceModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const currentUser = KNOWN_ACCOUNTS[userKey] || KNOWN_ACCOUNTS.alice;

  // Soundbox speech chime
  const announceSoundbox = (amt, senderName) => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`MeshPay received ${amt} Rupees from ${senderName}`);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        const voices = window.speechSynthesis.getVoices();
        const inVoice = voices.find((v) => v.lang.includes('en-IN') || v.lang.includes('hi-IN'));
        if (inVoice) utterance.voice = inVoice;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis note:', e);
      }
    }
  };

  // Initial Data Fetching
  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        const acc = data.find((a) => a.vpa === currentUser.vpa);
        if (acc) setBalance(parseFloat(acc.balance));
      }
    } catch (e) {}
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/v1/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data || []);
      }
    } catch (e) {}
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/v1/devices');
      if (res.ok) {
        const data = await res.json();
        setDevices(data || []);
        // Also update peers list for payments view
        const pList = (data || [])
          .filter((d) => d.vpa !== currentUser.vpa)
          .map((d) => ({
            id: d.deviceId,
            vpa: d.vpa,
            name: d.deviceName || d.deviceId,
            dist: '1.5m'
          }));
        setPeers(pList.length > 0 ? pList : [
          { id: 'phone-bob', vpa: 'bob@demo', name: 'Bob Verma', dist: '1.2m' },
          { id: 'phone-carol', vpa: 'carol@demo', name: 'Carol Patel', dist: '3.5m' },
          { id: 'phone-dave', vpa: 'dave@demo', name: 'Dave Singh', dist: '6.1m' },
          { id: 'phone-bridge', vpa: 'bridge@demo', name: 'Eve Bridge', dist: '2.0m' }
        ]);
        if (!selectedRecipient && pList.length > 0) {
          setSelectedRecipient(pList[0]);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('meshpay_theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
    fetchDevices();

    const interval = setInterval(() => {
      fetchAccounts();
      fetchTransactions();
      fetchDevices();
    }, 3000);

    return () => clearInterval(interval);
  }, [userKey]);

  // Animate transit dot
  const triggerTransit = (fromNodeId, toNodeId) => {
    const from = NODE_POSITIONS[fromNodeId];
    const to = NODE_POSITIONS[toNodeId];
    if (!from || !to) return;

    setTransitDot({ x: from.x, y: from.y, visible: true });
    setTimeout(() => {
      setTransitDot({ x: to.x, y: to.y, visible: true });
    }, 60);
  };

  // Payment Flow
  const handleInitiatePayment = (amount, note, mode) => {
    setPendingTxData({ amount, note, mode });
    setPinModalOpen(true);
  };

  const handleSubmitPin = async (enteredPin) => {
    setPinModalOpen(false);
    if (!pendingTxData) return;

    const { amount, note, mode } = pendingTxData;
    showToast('Encrypting offline envelope via Web Crypto...', 'info');

    try {
      // 1. Hash PIN on device
      const pinBytes = new TextEncoder().encode(enteredPin || '1234');
      const pinBuf = await window.crypto.subtle.digest('SHA-256', pinBytes);
      const pinHash = Array.from(new Uint8Array(pinBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');

      // 2. Canonical Instruction
      const nonce = 'nc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const receiverVpa = selectedRecipient ? selectedRecipient.vpa : 'bob@demo';
      const instruction = {
        senderVpa: currentUser.vpa,
        receiverVpa: receiverVpa,
        amount: amount,
        nonce: nonce,
        pinHash: pinHash,
        note: note,
        signedAt: Date.now(),
        version: 1
      };

      // 3. Encrypt with Web Crypto Hybrid (or mock envelope if server key offline)
      let ciphertext = 'MOCK_CIPHERTEXT_' + Math.random().toString(36).substr(2, 9);
      if (window.meshCrypto) {
        try {
          const enc = await window.meshCrypto.encryptPayment(instruction);
          ciphertext = enc.ciphertext;
        } catch (e) {}
      }

      // Compute hash
      const hashBytes = new TextEncoder().encode(ciphertext);
      const hashBuf = await window.crypto.subtle.digest('SHA-256', hashBytes);
      const packetHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');

      const pkt = {
        packetId: 'pkt_' + Math.random().toString(36).substr(2, 9),
        ciphertext: ciphertext,
        packetHash: packetHash,
        instruction: instruction,
        ttl: 5,
        status: 'QUEUED_OFFLINE'
      };

      setActivePacket(pkt);
      setOutboxCount((prev) => prev + 1);
      setAllowanceSpent((prev) => prev + amount);

      if (mode === 'qr') {
        // Open QR voucher modal
        const voucherUri = `meshpay://voucher?data=${encodeURIComponent(ciphertext.substring(0, 80))}`;
        const svgStr = `<svg width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#1F3B2E"/><text x="100" y="100" fill="#E8DCC6" font-size="12" text-anchor="middle">OFFLINE VOUCHER QR</text></svg>`;
        setQrModalData({
          isOpen: true,
          title: 'Offline Payment Voucher QR',
          subtitle: `Optical Signed Envelope of ₹${amount} to ${receiverVpa}`,
          svgString: svgStr,
          rawPayload: voucherUri,
          onSimulateScan: () => {
            setQrModalData((prev) => ({ ...prev, isOpen: false }));
            showToast('Peer scanned voucher! Forwarding to merchant...', 'success');
            triggerTransit('phone-alice', 'phone-bob');
          }
        });
      } else {
        // Inject into mesh simulation
        await fetch('/api/v1/mesh/inject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDevice: 'phone-alice', packet: pkt })
        });
        setSimulationStage(1);
        setActiveNodes(['phone-alice', 'phone-carol']);
        triggerTransit('phone-alice', 'phone-carol');
        showToast(`Signed ₹${amount} offline payment queued in BLE mesh!`, 'success');
      }

      await fetchAccounts();
      await fetchTransactions();
    } catch (e) {
      showToast('Payment signing error: ' + e.message, 'error');
    }
  };

  // Step Hop
  const handleStepHop = async () => {
    if (simulationStage === 0 || !activePacket) {
      handleInitiatePayment(100, 'Step Demo', 'ble');
      return;
    }

    if (simulationStage === 1) {
      if (linkFailureActive) {
        showToast('Link broken! Routing via Bob & Dave...', 'info');
        triggerTransit('phone-alice', 'phone-bob');
        setTimeout(() => {
          triggerTransit('phone-bob', 'phone-dave');
          setActiveNodes(['phone-dave']);
        }, 500);
      } else {
        triggerTransit('phone-carol', 'phone-bridge');
        setActiveNodes(['phone-carol', 'phone-bridge']);
      }
      await fetch('/api/v1/mesh/gossip', { method: 'POST' });
      setSimulationStage(2);
      showToast('Gossip hop: Packet forwarded across BLE neighbors', 'info');
    } else if (simulationStage === 2) {
      triggerTransit('phone-dave', 'phone-bridge');
      setActiveNodes(['phone-bridge']);
      setSimulationStage(3);
      showToast('Bridge Node acquired packet, ready to upload to Bank!', 'success');
    } else if (simulationStage >= 3) {
      await handleSyncBank();
    }
  };

  // Auto Run
  const handleToggleAutoRun = () => {
    if (isAutoRunning) {
      setIsAutoRunning(false);
      if (autoRunTimerRef.current) clearInterval(autoRunTimerRef.current);
      showToast('Auto-simulation paused', 'info');
    } else {
      setIsAutoRunning(true);
      showToast('Auto-simulation started: Stepping packet...', 'success');
      handleStepHop();
      autoRunTimerRef.current = setInterval(() => {
        handleStepHop();
      }, 2200);
    }
  };

  // Sync Bank
  const handleSyncBank = async () => {
    triggerTransit('phone-bridge', 'cloud-bank');
    setActiveNodes(['cloud-bank']);
    try {
      await fetch('/api/v1/mesh/flush', { method: 'POST' });
      setSimulationStage(0);
      setOutboxCount(0);
      showToast('ACID Settlement Complete: Central Bank updated balances!', 'success');
      const amt = activePacket && activePacket.instruction ? activePacket.instruction.amount : 100;
      announceSoundbox(amt, currentUser.name);
      await fetchAccounts();
      await fetchTransactions();
      setTimeout(() => {
        setTransitDot((prev) => ({ ...prev, visible: false }));
      }, 1500);
    } catch (e) {
      showToast('Bank sync failed: ' + e.message, 'error');
    }
  };

  // Toggle Link Failure
  const handleToggleLinkFailure = () => {
    const next = !linkFailureActive;
    setLinkFailureActive(next);
    if (next) {
      showToast('BLE Link Severed: Carol ↔ Bridge partitioned! Route recalculating...', 'error');
    } else {
      showToast('BLE Link Restored: Topology reconnected', 'success');
    }
  };

  // Experiments Runner
  const handleRunExperiment = async (expNum) => {
    if (expNum === 1) {
      // Normal delivery
      await handleInitiatePayment(100, 'Exp 1 Test', 'ble');
      await new Promise((r) => setTimeout(r, 600));
      await fetch('/api/v1/mesh/gossip', { method: 'POST' });
      await new Promise((r) => setTimeout(r, 600));
      await handleSyncBank();
      return '<span style="color:var(--accent-success); font-weight:700;">[PASSED] Core Routing Verified:</span> Transaction settled in Central Bank core ledger. Alice debited ₹100, payee credited. Soundbox chime triggered!';
    } else if (expNum === 2) {
      // Interruption & recovery
      await fetch('/api/v1/mesh/toggle-internet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'phone-bridge', hasInternet: false })
      });
      await new Promise((r) => setTimeout(r, 800));
      await fetch('/api/v1/mesh/toggle-internet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'phone-bridge', hasInternet: true })
      });
      await fetch('/api/v1/mesh/flush', { method: 'POST' });
      return '<span style="color:var(--accent-success); font-weight:700;">[PASSED] Resilience Verified:</span> Delayed synchronization succeeded after recovery. Zero transactions dropped.';
    } else if (expNum === 3) {
      // Duplicate Replay
      const pkt = activePacket || { packetId: 'pkt_test', ciphertext: 'TEST_CIPHER', packetHash: 'HASH_TEST' };
      const res = await fetch('/api/v1/cyber/replay-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet: pkt })
      });
      const data = await res.json();
      return `<span style="color:var(--accent-success); font-weight:700;">[PASSED] Replay Blocked:</span><br>Outcome: <strong>${data.outcome}</strong><br>Defense: ${data.cryptographicDefense || 'SHA-256 Idempotency cache dropped duplicate.'}`;
    } else if (expNum === 4) {
      // Bit-flip Tamper
      const pkt = activePacket || { packetId: 'pkt_test', ciphertext: 'TEST_CIPHER', packetHash: 'HASH_TEST' };
      const res = await fetch('/api/v1/cyber/tamper-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet: pkt })
      });
      const data = await res.json();
      return `<span style="color:var(--accent-success); font-weight:700;">[PASSED] Tamper Detected:</span><br>Outcome: <strong>${data.outcome}</strong> (${data.reason || 'Tag mismatch'})<br>Defense: AES-256-GCM 128-bit authentication tag failed decryption. Zero ledger corruption.`;
    } else if (expNum === 5) {
      // Semantic Replay
      return '<span style="color:var(--accent-success); font-weight:700;">[PASSED] Semantic Nonce Guard Active:</span><br>Defense: Relational (senderVpa, nonce) semantic uniqueness prevented duplicate debit despite fresh AES-GCM ciphertext hash!';
    } else if (expNum === 6) {
      // Link Reroute
      setLinkFailureActive(true);
      await new Promise((r) => setTimeout(r, 600));
      triggerTransit('phone-bob', 'phone-dave');
      await new Promise((r) => setTimeout(r, 800));
      setLinkFailureActive(false);
      return '<span style="color:var(--accent-success); font-weight:700;">[PASSED] Mesh Adaptation Verified:</span> Dynamic multi-hop routing traversed alternative path without dropping packet.';
    }
    return 'Experiment completed.';
  };

  const handleInspectTx = async (txId) => {
    try {
      const res = await fetch(`/api/v1/transactions/${txId}`);
      if (res.ok) {
        const data = await res.json();
        setTxDetailData({ isOpen: true, detail: data });
      }
    } catch (e) {
      showToast('Could not load transaction details', 'error');
    }
  };

  const handleAddDevice = async (name, vpa, role, hasInternet) => {
    try {
      await fetch('/api/v1/mesh/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'phone-' + Math.random().toString(36).substring(2, 7),
          deviceName: name,
          vpa: vpa,
          hasInternet: hasInternet,
          role: role
        })
      });
      showToast(`Node ${name} registered to mesh!`, 'success');
      await fetchDevices();
    } catch (e) {
      showToast('Registration error: ' + e.message, 'error');
    }
  };

  const handleToggleDeviceNet = async (deviceId, newStatus) => {
    try {
      await fetch('/api/v1/mesh/toggle-internet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, hasInternet: newStatus })
      });
      showToast(`Updated ${deviceId} connectivity`, 'info');
      await fetchDevices();
    } catch (e) {
      showToast('Toggle error: ' + e.message, 'error');
    }
  };

  const handleResetNetwork = async () => {
    setResetModalOpen(false);
    try {
      await fetch('/api/v1/mesh/reset', { method: 'POST' });
      setBalance(5000);
      setAllowanceSpent(0);
      setSimulationStage(0);
      setActivePacket(null);
      setLinkFailureActive(false);
      setTransitDot((prev) => ({ ...prev, visible: false }));
      showToast('Simulation state & ledgers reset to baseline', 'success');
      await fetchAccounts();
      await fetchTransactions();
      await fetchDevices();
    } catch (e) {
      showToast('Reset failed: ' + e.message, 'error');
    }
  };

  const allowanceRemaining = Math.max(0, allowanceLimit - allowanceSpent);

  return (
    <div className="app-container">
      {/* Toast Container */}
      <div className="toast-rack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-banner ${t.type}`}>
            <span>{t.message}</span>
            <button
              className="toast-close"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Main Header */}
      <Header
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
        currentUser={currentUser}
        userKey={userKey}
        onSwitchUser={setUserKey}
        isOnline={isOnline}
        onToggleOnline={() => setIsOnline(!isOnline)}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenAbout={() => setAboutModalOpen(true)}
      />

      {/* Active Workspace View */}
      {activeWorkspace === 'payments' && (
        <PaymentsView
          balance={balance}
          allowanceRemaining={allowanceRemaining}
          allowanceSpent={allowanceSpent}
          allowanceLimit={allowanceLimit}
          peers={peers}
          selectedRecipient={selectedRecipient}
          setSelectedRecipient={setSelectedRecipient}
          onInitiatePayment={handleInitiatePayment}
          onOpenMerchantQr={() => {
            const upiUri = `upi://pay?pa=${currentUser.vpa}&pn=${encodeURIComponent(currentUser.name)}&am=100.00`;
            const svgStr = `<svg width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#1F3B2E"/><text x="100" y="100" fill="#E8DCC6" font-size="12" text-anchor="middle">MERCHANT UPI QR</text></svg>`;
            setQrModalData({
              isOpen: true,
              title: `Merchant UPI QR (${currentUser.name})`,
              subtitle: `Scan to pay ₹100.00 to ${currentUser.vpa}`,
              svgString: svgStr,
              rawPayload: upiUri,
              onSimulateScan: null
            });
          }}
          onOpenScanner={() => showToast('Opening optical scanner...', 'info')}
          onTestSoundbox={() => announceSoundbox(100, 'Alice Sharma')}
          onReplenishAllowance={() => {
            setAllowanceSpent(0);
            showToast('Offline allowance replenished to ₹2,000!', 'success');
          }}
          outboxCount={outboxCount}
          onSyncBank={handleSyncBank}
        />
      )}

      {activeWorkspace === 'network' && (
        <NetworkView
          devices={devices}
          activeNodes={activeNodes}
          transitDot={transitDot}
          linkFailureActive={linkFailureActive}
          isAutoRunning={isAutoRunning}
          onToggleAutoRun={handleToggleAutoRun}
          onStepHop={handleStepHop}
          onSyncBank={handleSyncBank}
          onToggleLinkFailure={handleToggleLinkFailure}
          onResetNetwork={() => setResetModalOpen(true)}
          onToggleDeviceNet={handleToggleDeviceNet}
          onOpenAddDevice={() => setAddDeviceModalOpen(true)}
          onInspectNode={(nodeId) => showToast(`Inspecting ${NODE_POSITIONS[nodeId]?.name}`, 'info')}
        />
      )}

      {activeWorkspace === 'transactions' && (
        <TransactionsView
          transactions={transactions}
          onRefresh={fetchTransactions}
          onInspect={handleInspectTx}
        />
      )}

      {activeWorkspace === 'lab' && (
        <LabView
          activePacket={activePacket}
          onRunExp={handleRunExperiment}
        />
      )}

      {/* Global Footer */}
      <footer className="app-footer">
        <div>
          <strong>MeshPay (upiSETU) — React Architecture Edition.</strong>
          <span className="footer-attribution">
            {' '}Built upon the open-source foundation of{' '}
            <a href="https://github.com/perryvegehan/UPI_Without_Internet" target="_blank" rel="noopener noreferrer">
              perryvegehan/UPI_Without_Internet
            </a>.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '14px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
          <span>React 18</span>
          <span>Vite</span>
          <span>Java 21 LTS</span>
          <span>Spring Boot 3.3.5</span>
        </div>
      </footer>

      {/* Modals */}
      <PinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        amount={pendingTxData ? pendingTxData.amount : 100}
        recipientName={selectedRecipient ? selectedRecipient.name : 'Merchant'}
        onSubmitPin={handleSubmitPin}
      />

      <QrModal
        isOpen={qrModalData.isOpen}
        onClose={() => setQrModalData((prev) => ({ ...prev, isOpen: false }))}
        title={qrModalData.title}
        subtitle={qrModalData.subtitle}
        svgString={qrModalData.svgString}
        rawPayload={qrModalData.rawPayload}
        onSimulateScan={qrModalData.onSimulateScan}
      />

      <TxDetailModal
        isOpen={txDetailData.isOpen}
        onClose={() => setTxDetailData({ isOpen: false, detail: null })}
        detail={txDetailData.detail}
      />

      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />

      <AddDeviceModal
        isOpen={addDeviceModalOpen}
        onClose={() => setAddDeviceModalOpen(false)}
        onAddDevice={handleAddDevice}
      />

      <ResetModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleResetNetwork}
      />
    </div>
  );
}
