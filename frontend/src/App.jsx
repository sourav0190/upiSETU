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
  VolumeX,
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
  X,
  Sparkles,
  Zap,
  Target,
  Compass,
  MessageSquare
} from 'lucide-react';

// Character Map for Dynamic Sender / Recipient Selection
const CHARACTER_MAP = {
  'alice@demo': { key: 'alice', name: 'Alice Sharma', avatar: '👩', role: 'Payer (Offline)', battery: '95%', deviceId: 'phone-alice' },
  'bob@demo': { key: 'bob', name: 'Bob Verma', avatar: '👨', role: 'Merchant', battery: '88%', deviceId: 'phone-bob' },
  'carol@demo': { key: 'carol', name: 'Carol Patel', avatar: '👩‍💻', role: 'Relay Hop 1', battery: '76%', deviceId: 'phone-carol' },
  'dave@demo': { key: 'dave', name: 'Dave Singh', avatar: '🏃‍♂️', role: 'Relay Hop 2', battery: '82%', deviceId: 'phone-dave' }
};

// Node Positions on the 760 x 200 SVG canvas
const NODE_POSITIONS = {
  alice: { x: 100, y: 100, name: 'Alice', avatar: '👩', role: 'Payer (Offline)', battery: '95%', deviceId: 'phone-alice' },
  bob: { x: 250, y: 50, name: 'Bob', avatar: '👨', role: 'Merchant', battery: '88%', deviceId: 'phone-bob' },
  carol: { x: 250, y: 150, name: 'Carol', avatar: '👩‍💻', role: 'Relay Hop 1', battery: '76%', deviceId: 'phone-carol' },
  dave: { x: 410, y: 100, name: 'Dave', avatar: '🏃‍♂️', role: 'Relay Hop 2', battery: '82%', deviceId: 'phone-dave' },
  bridge: { x: 550, y: 150, name: 'Eve Bridge', avatar: '🌉', role: '4G Ingress', battery: '91%', deviceId: 'phone-bridge' },
  bank: { x: 680, y: 100, name: 'Central Bank', avatar: '🏛️', role: 'ACID Core', battery: '100%', deviceId: 'cloud-bank' }
};

export default function App() {
  // Theme & Audio State
  const [theme, setTheme] = useState(() => localStorage.getItem('meshpay_theme') || 'dark');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Active Story Mission
  // 'disaster' | 'replay' | 'chaos'
  const [activeMission, setActiveMission] = useState('disaster');

  // Payment Composer State (Step 1)
  const [senderVpa, setSenderVpa] = useState('alice@demo');
  const [receiverVpa, setReceiverVpa] = useState('bob@demo');
  const [amount, setAmount] = useState(500);
  const [pin, setPin] = useState('1234');
  const [note, setNote] = useState('Basement coffee payment');

  const currentSender = CHARACTER_MAP[senderVpa] || CHARACTER_MAP['alice@demo'];
  const currentReceiver = CHARACTER_MAP[receiverVpa] || { key: 'bob', name: receiverVpa, avatar: '👨', role: 'Merchant' };

  // Simulation & Visual Journey State
  const [currentStep, setCurrentStep] = useState(1); // 1: Inject, 2: Gossip, 3: Bridge
  const [simStatus, setSimStatus] = useState('Network Idle. Alice has zero cellular reception in the basement.');
  const [activePacket, setActivePacket] = useState(null);
  const [transitDot, setTransitDot] = useState({ x: 100, y: 100, visible: false, angle: 0 });
  const [highlightedNodes, setHighlightedNodes] = useState([]);
  const [linkFailureActive, setLinkFailureActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Alive Speech Bubble & Sticker System
  const [speechBubbles, setSpeechBubbles] = useState({
    alice: { text: "No signal down here... but MeshPay's ready!", visible: true, mood: 'idle' },
    bob: { text: "Cash counter ready! Waiting for Alice's payment.", visible: false, mood: 'idle' },
    carol: { text: "BLE radio listening for incoming gossip...", visible: false, mood: 'idle' },
    dave: { text: "Ready to hop packets forward!", visible: false, mood: 'idle' },
    bridge: { text: "Searching for 4G cell towers...", visible: false, mood: 'idle' },
    bank: { text: "ACID Vault open. Awaiting signed envelopes.", visible: false, mood: 'idle' }
  });

  const [activeSticker, setActiveSticker] = useState(null);

  // Backend Live Data
  const [devices, setDevices] = useState([]);
  const [idempotencyCacheSize, setIdempotencyCacheSize] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [logs, setLogs] = useState([]);

  // Modals State
  const [inspectPacketModal, setInspectPacketModal] = useState({ isOpen: false, packet: null });
  const [qrModal, setQrModal] = useState({ isOpen: false, payload: '', amount: 0 });
  const [aboutModal, setAboutModal] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);

  // Sound Synthesizer via Web Audio API (No external files needed)
  const audioCtxRef = useRef(null);

  const playSound = (type) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      if (type === 'launch') {
        // Frequency whoosh up
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(260, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.36);
      } else if (type === 'hop') {
        // High ping
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(540, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.19);
      } else if (type === 'settled') {
        // Joyful chord (C5 + E5 + G5)
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.16, ctx.currentTime + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + idx * 0.08 + 0.6);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.62);
        });
      } else if (type === 'block') {
        // Double low buzz
        [180, 150].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
          gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + idx * 0.12 + 0.1);
          osc.start(ctx.currentTime + idx * 0.12);
          osc.stop(ctx.currentTime + idx * 0.12 + 0.11);
        });
      }
    } catch (e) {
      console.warn('Audio synthesis note:', e);
    }
  };

  // Soundbox Voice Speech
  const announceSoundbox = (amt, sender) => {
    if ('speechSynthesis' in window && soundEnabled) {
      try {
        window.speechSynthesis.cancel();
        const cleanSender = (sender || 'Alice').split('@')[0];
        const text = `MeshPay payment received! ₹${amt} from ${cleanSender}. Settled offline via mesh!`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        const voices = window.speechSynthesis.getVoices();
        const inVoice = voices.find((v) => v.lang.includes('en-IN') || v.lang.includes('hi-IN'));
        if (inVoice) utterance.voice = inVoice;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Voice speech note:', e);
      }
    }
  };

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('meshpay_theme', theme);
  }, [theme]);

  // Show contextual speech bubble
  const triggerBubble = (nodeId, text, duration = 3800) => {
    setSpeechBubbles((prev) => ({
      ...prev,
      [nodeId]: { text, visible: true }
    }));
    setTimeout(() => {
      setSpeechBubbles((prev) => ({
        ...prev,
        [nodeId]: { ...prev[nodeId], visible: false }
      }));
    }, duration);
  };

  // Show floating sticker reaction
  const triggerSticker = (emoji, title, subtitle, duration = 3000) => {
    setActiveSticker({ emoji, title, subtitle });
    setTimeout(() => setActiveSticker(null), duration);
  };

  // Log Stream
  const addLog = (msg, type = 'info') => {
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time: timeStr, text: msg, type, id: Date.now() + Math.random() }, ...prev]);
  };

  // Fetch Mesh State, Accounts, and Transactions
  const refreshData = async () => {
    try {
      const meshRes = await fetch('/api/mesh/state');
      if (meshRes.ok) {
        const m = await meshRes.json();
        setDevices(m.devices || []);
        setIdempotencyCacheSize(m.idempotencyCacheSize || 0);
      }
      const accRes = await fetch('/api/accounts');
      if (accRes.ok) {
        const accs = await accRes.json();
        setAccounts(accs || []);
      }
      const txRes = await fetch('/api/transactions');
      if (txRes.ok) {
        const txs = await txRes.json();
        setTransactions(txs || []);
      }
    } catch (e) {
      console.warn('Refresh note:', e.message);
    }
  };

  useEffect(() => {
    refreshData();
    addLog('✨ MeshPay Playground active. Virtual threads & BLE gossip protocol ready.', 'system');
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Move visual packet particle
  const movePacketTo = (x, y, visible = true) => {
    setTransitDot((prev) => ({ x, y, visible }));
  };

  // =========================================================================
  // STEP 1: LAUNCH PAYMENT INTO MESH
  // =========================================================================
  const handleLaunchPayment = async (e) => {
    if (e) e.preventDefault();
    if (!amount || amount <= 0) {
      triggerSticker('⚠️', 'Invalid Amount', 'Please enter a valid rupee amount!');
      return;
    }
    if (senderVpa === receiverVpa) {
      triggerSticker('🤔', 'Same Account', 'Cannot send money to yourself!');
      return;
    }

    const senderChar = CHARACTER_MAP[senderVpa] || CHARACTER_MAP['alice@demo'];
    const receiverChar = CHARACTER_MAP[receiverVpa] || { key: 'bob', name: receiverVpa, avatar: '👨' };
    const startDeviceId = senderChar.deviceId;
    const startPos = NODE_POSITIONS[senderChar.key] || NODE_POSITIONS.alice;

    setIsSubmitting(true);
    playSound('launch');
    triggerBubble(senderChar.key, `Sealing ₹${amount} inside RSA-2048 envelope for ${receiverChar.name}... ✉️`);
    triggerSticker('🚀', 'Payment Launched!', `₹${amount} sealed & injected into ${senderChar.name}'s outbox`);

    try {
      const payload = {
        senderVpa,
        receiverVpa,
        amount: parseFloat(amount),
        pin: pin || '1234',
        ttl: 5,
        startDevice: startDeviceId
      };

      const res = await fetch('/api/demo/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to inject payment');

      const data = await res.json();
      setActivePacket(data);
      setCurrentStep(2);
      setHighlightedNodes([senderChar.key]);

      movePacketTo(startPos.x, startPos.y, true);
      setSimStatus(`Packet ${data.packetId.substring(0, 8)}... created & stored in ${senderChar.name}'s offline outbox`);

      addLog(`🚀 [LAUNCH] Packet ${data.packetId.substring(0, 8)} signed with PIN hash & buffered in ${senderChar.name} outbox (${startDeviceId}, TTL ${data.ttl})`, 'success');
      addLog(`🔐 AES-GCM Ciphertext preview: ${data.ciphertextPreview}`, 'mono');

      await refreshData();
    } catch (err) {
      triggerBubble(senderChar.key, `Uh oh, something went wrong: ${err.message}`);
      addLog(`Launch failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // STEP 2: SPREAD THE GOSSIP
  // =========================================================================
  const handleSpreadGossip = async () => {
    setIsSubmitting(true);
    playSound('hop');
    setSimStatus('Propagating gossip packets across local BLE neighborhood...');

    try {
      const res = await fetch('/api/mesh/gossip', { method: 'POST' });
      if (!res.ok) throw new Error('Gossip call failed');

      const data = await res.json();
      addLog(`🗣️ [GOSSIP ROUND] ${data.transfers} packet transfer(s) across mesh. Device counts: ${JSON.stringify(data.deviceCounts)}`, 'info');

      if (linkFailureActive) {
        // Detour through Bob & Dave
        triggerBubble('carol', 'Bridge is out of range! Rerouting to Dave! 🔄');
        setHighlightedNodes(['bob']);
        movePacketTo(NODE_POSITIONS.bob.x, NODE_POSITIONS.bob.y, true);

        setTimeout(() => {
          playSound('hop');
          triggerBubble('dave', 'Dave received packet! Forwarding to Eve Bridge! 🏃‍♂️');
          setHighlightedNodes(['dave']);
          movePacketTo(NODE_POSITIONS.dave.x, NODE_POSITIONS.dave.y, true);

          setTimeout(() => {
            playSound('hop');
            triggerBubble('bridge', 'Eve Bridge got the packet! 4G connection spotted! 🌐');
            triggerSticker('🌉', 'Bridge Discovered!', 'Packet safely buffered in Eve 4G outbox');
            setHighlightedNodes(['bridge']);
            movePacketTo(NODE_POSITIONS.bridge.x, NODE_POSITIONS.bridge.y, true);
            setCurrentStep(3);
            setSimStatus('Packet successfully rerouted around severed link to Eve Bridge (4G)!');
          }, 450);
        }, 450);
      } else {
        // Normal Route: Carol -> Bridge
        const senderShortName = currentSender?.name?.split(' ')[0] || 'Alice';
        triggerBubble('carol', `Psst! Got ${senderShortName}’s packet! Passing forward! 👀`);
        setHighlightedNodes(['carol']);
        movePacketTo(NODE_POSITIONS.carol.x, NODE_POSITIONS.carol.y, true);

        setTimeout(() => {
          playSound('hop');
          triggerBubble('bridge', 'Eve Bridge here! 4G cellular signal detected! 🌐');
          triggerSticker('🗣️', 'Gossip Successful!', 'Packet hopped via Carol to Eve Bridge');
          setHighlightedNodes(['bridge']);
          movePacketTo(NODE_POSITIONS.bridge.x, NODE_POSITIONS.bridge.y, true);
          setCurrentStep(3);
          setSimStatus('Packet reached Eve Bridge (4G Ingress) — Ready to upload to Central Bank');
        }, 500);
      }

      await refreshData();
    } catch (err) {
      addLog(`Gossip error: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoWhisperToBridge = async () => {
    addLog('⚡ [AUTO-WHISPER] Stepping packet through simulated mesh to Bridge...', 'info');
    if (currentStep === 1 || !activePacket) {
      await handleLaunchPayment();
      await new Promise((r) => setTimeout(r, 600));
    }
    await handleSpreadGossip();
  };

  // =========================================================================
  // STEP 3: UPLOAD TO CENTRAL BANK
  // =========================================================================
  const handleSendToBank = async () => {
    setIsSubmitting(true);
    setSimStatus('Eve Bridge uploading held packets to Central Bank via cellular uplink...');
    setHighlightedNodes(['bridge', 'bank']);
    triggerBubble('bridge', 'Blasting packet through 4G cellular uplink to Reserve Bank! 🚀');

    movePacketTo(NODE_POSITIONS.bank.x, NODE_POSITIONS.bank.y, true);

    try {
      const res = await fetch('/api/mesh/flush', { method: 'POST' });
      if (!res.ok) throw new Error('Bridge flush failed');

      const data = await res.json();
      let settledCount = 0;
      let duplicateCount = 0;

      if (data.results && data.results.length > 0) {
        data.results.forEach((r) => {
          if (r.outcome === 'SETTLED') {
            settledCount++;
            addLog(`✅ Bridge ${r.bridgeNode} packet ${r.packetId} -> SETTLED in ledger (Tx #${r.transactionId})`, 'success');
          } else if (r.outcome === 'DUPLICATE_DROPPED') {
            duplicateCount++;
            addLog(`⚠️ Bridge ${r.bridgeNode} packet ${r.packetId} -> DUPLICATE DROPPED (${r.reason})`, 'warning');
          } else {
            addLog(`❌ Bridge ${r.bridgeNode} packet ${r.packetId} -> ${r.outcome}: ${r.reason}`, 'error');
          }
        });
      }

      if (settledCount > 0) {
        playSound('settled');
        const sName = currentSender?.name?.split(' ')[0] || 'Sender';
        const rName = currentReceiver?.name?.split(' ')[0] || 'Recipient';
        triggerBubble('bank', `Hash verified! ${sName} ₹${amount} debited, ${rName} credited! 🎉`);
        triggerBubble(currentReceiver?.key || 'bob', `Cha-ching! Soundbox announced ₹${amount}! 🔔💸`);
        triggerSticker('🎉', 'Payment Settled!', `₹${amount} safely settled in ACID core ledger`);
        setSimStatus(`Settlement Complete! Core ACID ledger updated (Settled ₹${amount})`);
        announceSoundbox(amount, senderVpa);
      } else if (duplicateCount > 0) {
        playSound('block');
        triggerBubble('bank', 'Hold on! We already settled this packet hash! Duplicate dropped. 🛑');
        triggerSticker('🔁', 'Duplicate Caught!', 'Idempotency cache protected against replay');
        setSimStatus('Duplicate packet detected and safely dropped. Zero double-spending verified.');
      }

      setTimeout(() => {
        const startPos = NODE_POSITIONS[currentSender?.key] || NODE_POSITIONS.alice;
        movePacketTo(startPos.x, startPos.y, false);
        setHighlightedNodes([]);
        setCurrentStep(1);
      }, 2000);

      await refreshData();
    } catch (err) {
      addLog(`Upload error: ${err.message}`, 'error');
      setSimStatus(`Upload error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // PLAYFUL LAB CONTROLS & ATTACK EXPERIMENTS
  // =========================================================================
  const handleResetNetwork = async () => {
    try {
      await fetch('/api/mesh/reset', { method: 'POST' });
      playSound('hop');
      triggerSticker('🔄', 'Network Rewound', 'All node outboxes & hash caches cleared');
      addLog('🔄 Network state, in-flight packets, and idempotency cache cleared', 'system');
      setActivePacket(null);
      setCurrentStep(1);
      setHighlightedNodes([]);
      movePacketTo(NODE_POSITIONS.alice.x, NODE_POSITIONS.alice.y, false);
      setSimStatus('Network Idle. Alice has zero cellular reception in the basement.');
      setSpeechBubbles({
        alice: { text: "Back to square one! No signal down here.", visible: true },
        bob: { text: "Cash counter ready!", visible: false },
        carol: { text: "Listening for packets...", visible: false },
        dave: { text: "Ready to hop!", visible: false },
        bridge: { text: "Waiting for roaming nodes...", visible: false },
        bank: { text: "ACID Vault ready.", visible: false }
      });
      await refreshData();
    } catch (err) {
      addLog(`Reset error: ${err.message}`, 'error');
    }
  };

  const handleSimulateReplayAttack = async () => {
    playSound('block');
    triggerBubble('bank', 'Adversary detected replaying packet! Idempotency cache checking... 🛑');
    addLog('🕵️ [REPLAY ATTACK SIMULATION] Attacker re-broadcasting recorded payment envelope...', 'warning');

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
        triggerSticker('🛡️', 'Replay Intercepted!', data.outcome + ': Zero double-spending');
        addLog(`🛡️ REPLAY DEFENSE VERIFIED: Outcome = ${data.outcome}`, 'success');
        addLog(`   Defense explanation: ${data.cryptographicDefense || 'SHA-256 idempotency cache rejected duplicate submission.'}`, 'mono');
      }
    } catch (err) {
      addLog(`Replay test note: ${err.message}`, 'error');
    }
  };

  const handleSimulateTamperAttack = async () => {
    playSound('block');
    triggerBubble('bank', 'Bit-flip detected! AES-GCM Auth Tag verification failed! 🚨');
    addLog('🧪 [TAMPER ATTACK SIMULATION] Attacker flipped 1 bit in AES-GCM ciphertext...', 'warning');

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
        triggerSticker('🚨', 'Tamper Detected!', 'Authentication tag mismatch. Dropped!');
        addLog(`🛡️ TAMPER DEFENSE VERIFIED: Outcome = ${data.outcome} (Reason: ${data.reason})`, 'success');
        addLog(`   Cryptographic defense: ${data.cryptographicDefense || 'AES-GCM authentication tag verification failed. Modified packet discarded.'}`, 'mono');
      }
    } catch (err) {
      addLog(`Tamper test note: ${err.message}`, 'error');
    }
  };

  const handleToggleLinkFailure = () => {
    const next = !linkFailureActive;
    setLinkFailureActive(next);
    playSound('hop');
    if (next) {
      triggerBubble('carol', 'Uh oh! Bluetooth link to Eve Bridge broken! We must detour! 💥');
      triggerSticker('⚠️', 'BLE Link Broken', 'Carol ↔ Bridge severed! Dynamic mesh rerouting');
      addLog('⚠️ BLE LINK SEVERED: Carol ↔ Bridge link broken. Mesh will reroute via Bob & Dave!', 'warning');
    } else {
      triggerBubble('carol', 'Phew! Link to Eve Bridge restored! Direct channel open. ✅');
      triggerSticker('✅', 'Link Restored', 'Primary Carol ↔ Bridge channel reconnected');
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
    <div className="meshpay-app-container alive-environment">
      {/* Background Animated Particle Canvas */}
      <div className="ambient-mesh-canvas">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
      </div>

      {/* Floating Sticker Popup Notification */}
      {activeSticker && (
        <div className="floating-sticker-toast">
          <span className="sticker-emoji">{activeSticker.emoji}</span>
          <div className="sticker-body">
            <strong>{activeSticker.title}</strong>
            <p>{activeSticker.subtitle}</p>
          </div>
        </div>
      )}

      {/* =====================================================================
          HEADER BAR
          ===================================================================== */}
      <header className="meshpay-header">
        <div className="header-brand">
          <div className="brand-logo-icon alive-badge">
            <Radio size={20} className="icon-pulse" />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">MeshPay 🚀</h1>
            <span className="brand-subtitle">THE LIVING OFFLINE PAYMENT MESH</span>
          </div>
          <span className="badge badge-sim">
            <span className="badge-dot"></span> Simulation Alive
          </span>
        </div>

        <div className="header-actions">
          {/* Sound Toggle */}
          <button
            className={`btn-header-link ${soundEnabled ? 'active-audio' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Sound Effects Active' : 'Sound Effects Muted'}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{soundEnabled ? 'Sound ON' : 'Muted'}</span>
          </button>

          <button className="btn-header-link" onClick={() => setAboutModal(true)} title="System Architecture">
            <Info size={15} />
            <span>Architecture</span>
          </button>

          <a href="/classic" className="btn-header-link" title="Open Upstream Classic Template View">
            <ExternalLink size={14} />
            <span>Classic View</span>
          </a>

          <button className="btn-theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle Day/Night Theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="meshpay-main-content">
        {/* =====================================================================
            MISSION SELECTOR CARDS (Storytelling Mode)
            ===================================================================== */}
        <section className="mission-deck-section">
          <div className="mission-pills-bar">
            <span className="mission-label">🎮 CHOOSE YOUR MISSION:</span>
            <button
              className={`mission-tab-btn ${activeMission === 'disaster' ? 'active' : ''}`}
              onClick={() => setActiveMission('disaster')}
            >
              <span>🏔️ Mission 1: The Basement Disaster</span>
            </button>
            <button
              className={`mission-tab-btn ${activeMission === 'replay' ? 'active' : ''}`}
              onClick={() => setActiveMission('replay')}
            >
              <span>🕵️ Mission 2: The Replay Heist</span>
            </button>
            <button
              className={`mission-tab-btn ${activeMission === 'chaos' ? 'active' : ''}`}
              onClick={() => setActiveMission('chaos')}
            >
              <span>⚡ Mission 3: The Broken Link Chaos</span>
            </button>
          </div>

          {/* SCENARIO 1: METRO TUNNEL UNDERGROUND DISASTER SIMULATOR */}
          {activeMission === 'disaster' && (
            <div className="metro-tunnel-theater">
              {/* Overhead Flickering Industrial Fluorescent Lamp */}
              <div className="metro-fluorescent-lamp" title="Subway Fluorescent Tube Light (Flickering)"></div>

              <div className="metro-tunnel-header">
                <div className="metro-title-group">
                  <h2>🚇 METRO TUNNEL UNDERGROUND DISASTER (SCENARIO 1)</h2>
                  <p>Stuck deep underground on Station Platform B3. 0 bars of cellular service. All traditional banking apps fail.</p>
                </div>
                <div className="metro-depth-indicator">
                  <Compass size={14} className="icon-spin" />
                  <span>DEPTH: -42.5m | 📵 0 BARS CELLULAR | 🔵 BLE MESH ACTIVE</span>
                </div>
              </div>

              <div className="metro-stage-grid">
                {/* LEFT: Alice's Realistic Offline Smartphone Frame */}
                <div className="phone-mockup-frame">
                  <div className="phone-screen">
                    {/* Phone Status Bar */}
                    <div className="phone-status-bar">
                      <span className="carrier-no-service">
                        <span style={{ fontSize: '13px' }}>📵</span> NO SERVICE
                      </span>
                      <div className="phone-sensors-right">
                        <span className="ble-indicator-badge">🔵 BLE ACTIVE</span>
                        <span>🔋 94%</span>
                      </div>
                    </div>

                    {/* Emergency Alert Banner */}
                    <div className="phone-tunnel-banner">
                      <strong>⚠️ SUB-SURFACE METRO LEVEL B3</strong>
                      {currentSender.name}'s phone has 0 bars. Cellular towers out of reach. MeshPay offline peer-to-peer radio is ACTIVE & READY!
                    </div>

                    <div className="phone-app-header">
                      <div className="phone-app-icon">{currentSender.avatar}</div>
                      <div>
                        <div className="phone-app-name">MeshPay Offline</div>
                        <div className="phone-app-sub">Local BLE Wallet ({currentSender.name})</div>
                      </div>
                    </div>

                    {/* Payment Form Inside Sender's Phone */}
                    <div className="step-form">
                      <div className="form-row-compact">
                        <div className="input-group">
                          <label>📱 Active Sender Phone (You)</label>
                          <select
                            value={senderVpa}
                            onChange={(e) => {
                              const newSender = e.target.value;
                              setSenderVpa(newSender);
                              if (receiverVpa === newSender) {
                                const fallback = Object.keys(CHARACTER_MAP).find((k) => k !== newSender) || 'bob@demo';
                                setReceiverVpa(fallback);
                              }
                            }}
                          >
                            {Object.entries(CHARACTER_MAP).map(([vpa, char]) => (
                              <option key={vpa} value={vpa}>
                                {char.avatar} {char.name} ({vpa})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-row-compact">
                        <div className="input-group">
                          <label>🏪 Recipient in Tunnel</label>
                          <select value={receiverVpa} onChange={(e) => setReceiverVpa(e.target.value)}>
                            {Object.entries(CHARACTER_MAP)
                              .filter(([vpa]) => vpa !== senderVpa)
                              .map(([vpa, char]) => (
                                <option key={vpa} value={vpa}>
                                  {char.avatar} {char.name} ({vpa})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-row-compact">
                        <div className="input-group">
                          <label>Amount (₹)</label>
                          <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            min="1"
                            max="2000"
                          />
                        </div>
                        <div className="input-group" style={{ maxWidth: '80px' }}>
                          <label>PIN</label>
                          <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            maxLength={4}
                          />
                        </div>
                      </div>

                      <div className="amount-pills" style={{ marginBottom: '12px' }}>
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

                      <button
                        type="button"
                        className="btn-primary"
                        style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
                        onClick={handleLaunchPayment}
                        disabled={isSubmitting}
                      >
                        <Send size={15} />
                        <span>🚀 Broadcast Offline Payment (₹{amount})</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Subway Tunnel & Platform Atmosphere */}
                <div className="subway-platform-stage">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-lilac)' }}>
                        📡 METRO PLATFORM 2 (BLE BEACON ADVERTISEMENT)
                      </span>
                      <span className="tunnel-tag">🚇 METRO LINE 3</span>
                    </div>

                    <p style={{ fontSize: '0.82rem', color: '#C5D0C9', lineHeight: 1.5, margin: '0 0 16px' }}>
                      Alice's phone has zero cellular bars, but its Bluetooth Low Energy chip broadcasts small 31-byte advertising
                      beacons into the tunnel air. Nearby passengers' phones pick up the encrypted packet and carry it toward the station exit!
                    </p>

                    {/* SVG Illustrated Subway Platform */}
                    <svg viewBox="0 0 400 130" className="tunnel-arch-svg">
                      <defs>
                        <linearGradient id="tunnelDarkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#0E1612" />
                          <stop offset="100%" stopColor="#1E2F26" />
                        </linearGradient>
                      </defs>

                      {/* Tunnel Arch */}
                      <path d="M 20 120 Q 200 -20 380 120" stroke="#2D4236" strokeWidth="4" fill="url(#tunnelDarkGrad)" />

                      {/* Active Sender on Platform with Expanding Circular BLE Radio Waves */}
                      <g transform="translate(60, 80)">
                        <circle r="12" fill="none" stroke="var(--color-lilac)" strokeWidth="1.5" className="ble-radio-pulse" />
                        <circle r="12" fill="none" stroke="var(--color-lilac)" strokeWidth="1" className="ble-radio-pulse pulse-2" />
                        <circle r="16" fill="#1F3B2E" stroke="var(--color-oatmeal)" strokeWidth="2" />
                        <text textAnchor="middle" y="5" fontSize="14">{currentSender.avatar}</text>
                        <text textAnchor="middle" y="24" fontSize="9" fill="#F5F1E8" fontWeight="bold">{currentSender.name.split(' ')[0]}</text>
                        <text textAnchor="middle" y="34" fontSize="8" fill="#FF7B7B">0 Bars 📵</text>
                      </g>

                      {/* Radio Wave Travel Path to Carol */}
                      <path d="M 85 80 Q 140 60 195 80" stroke="var(--color-lilac)" strokeWidth="2" strokeDasharray="4 4" fill="none" className="active-pulse" />

                      {/* Carol on Platform Bench */}
                      <g transform="translate(200, 80)">
                        <circle r="16" fill="#1F3B2E" stroke="var(--color-lilac)" strokeWidth="2" />
                        <text textAnchor="middle" y="5" fontSize="14">👩‍💻</text>
                        <text textAnchor="middle" y="24" fontSize="9" fill="#F5F1E8" fontWeight="bold">Carol</text>
                        <text textAnchor="middle" y="34" fontSize="8" fill="var(--color-lilac)">BLE Relay ⚡</text>
                      </g>

                      {/* Travel Path to Eve Escalator */}
                      <path d="M 225 80 Q 280 60 335 50" stroke="#3D7656" strokeWidth="2" strokeDasharray="4 4" fill="none" />

                      {/* Eve Walking up Escalator to Street 4G */}
                      <g transform="translate(340, 50)">
                        <circle r="16" fill="#052E16" stroke="#2EA043" strokeWidth="2" />
                        <text textAnchor="middle" y="5" fontSize="14">🌉</text>
                        <text textAnchor="middle" y="24" fontSize="9" fill="#56D364" fontWeight="bold">Eve Bridge</text>
                        <text textAnchor="middle" y="34" fontSize="8" fill="#56D364">Escalator (4G 🌐)</text>
                      </g>
                    </svg>
                  </div>

                  {/* Subway Rails */}
                  <div>
                    <div className="subway-rails-bar">
                      <span>═ ═ ═ ═ ═ TRACK 1 (DOWNTOWN) ═ ═ ═ ═ ═</span>
                      <span>🚇 SUBWAY TUNNEL</span>
                      <span>═ ═ ═ ═ ═ TRACK 2 (UPTOWN) ═ ═ ═ ═ ═</span>
                    </div>

                    <div className="subway-ambient-tags">
                      <span className="tunnel-tag">💧 Humidity: 82%</span>
                      <span className="tunnel-tag">🌡️ Temp: 21°C</span>
                      <span className="tunnel-tag">📶 RF Cellular: -110 dBm (Dead Zone)</span>
                      <span className="tunnel-tag">🔵 2.4GHz BLE: Active (15m radius)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENARIO 2: THE REPLAY HEIST */}
          {activeMission === 'replay' && (
            <div className="mission-story-banner">
              <div className="story-content">
                <span className="story-badge warning">SCENARIO: ADVERSARY ON THE AIRWAVES</span>
                <h3>A hacker intercepted Alice's signed packet and attempts to submit it twice! Will the bank fall for it?</h3>
                <p>Objective: Launch payment ➔ Click Unleash Replay Hack ➔ Watch SHA-256 Idempotency Engine drop the duplicate!</p>
              </div>
            </div>
          )}

          {/* SCENARIO 3: BROKEN LINK CHAOS */}
          {activeMission === 'chaos' && (
            <div className="mission-story-banner">
              <div className="story-content">
                <span className="story-badge error">SCENARIO: BROKEN BLUETOOTH LINK</span>
                <h3>Carol walked out of Bluetooth range! The direct Carol ↔ Bridge connection is severed. Can the mesh adapt?</h3>
                <p>Objective: Break primary link ➔ Watch the packet dynamically detour through Dave ➔ Reach Eve Bridge!</p>
              </div>
            </div>
          )}
        </section>

        {/* =====================================================================
            LIVE LIVING TOPOLOGY & PACKET HOP VISUALIZER
            ===================================================================== */}
        <div className="card card-topology alive-card">
          <div className="card-header-bar">
            <h3 className="section-title-sm">
              <span className="emoji-icon">🗺️</span> Living Network Topology & Gossip Conversations
            </h3>
            <span className="status-label-badge" id="sim-status-label">
              {simStatus}
            </span>
          </div>

          <div className="topology-canvas-container">
            <svg viewBox="0 0 760 210" className="topology-svg-element">
              {/* Subtle Background Grid Points */}
              <defs>
                <pattern id="gridDots" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="var(--border-subtle)" opacity="0.4" />
                </pattern>
                <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--color-pine)" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="var(--color-lilac)" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              <rect width="760" height="210" fill="url(#gridDots)" />

              {/* Mesh Connection Lines */}
              <g className="links-layer">
                {/* Alice -> Bob */}
                <line x1="100" y1="100" x2="250" y2="50" className="topo-link" />
                {/* Alice -> Carol */}
                <line x1="100" y1="100" x2="250" y2="150" className="topo-link active-pulse" />
                {/* Bob -> Dave */}
                <line x1="250" y1="50" x2="410" y2="100" className="topo-link" />
                {/* Carol -> Dave */}
                <line x1="250" y1="150" x2="410" y2="100" className="topo-link" />
                {/* Carol -> Bridge (May be severed in chaos mission) */}
                <line
                  x1="250"
                  y1="150"
                  x2="550"
                  y2="150"
                  className={`topo-link ${linkFailureActive ? 'topo-link-severed' : 'active-pulse'}`}
                />
                {/* Dave -> Bridge */}
                <line x1="410" y1="100" x2="550" y2="150" className="topo-link" />
                {/* Bridge -> Bank (4G Cellular Uplink) */}
                <line x1="550" y1="150" x2="680" y2="100" className="topo-link-4g" />
              </g>

              {/* Animated Living Packet Character */}
              {transitDot.visible && (
                <g transform={`translate(${transitDot.x}, ${transitDot.y})`} className="packet-mascot-group">
                  {/* Energy Aura */}
                  <circle r="14" className="packet-aura" />
                  {/* Envelope Body */}
                  <circle r="9" className="packet-capsule" />
                  <text textAnchor="middle" y="4" fontSize="10">✉️</text>
                  {/* Floating Amount Tag */}
                  <rect x="-18" y="-24" width="36" height="14" rx="4" fill="var(--color-pine)" />
                  <text textAnchor="middle" y="-14" fontSize="8.5" fill="var(--color-oatmeal)" fontWeight="bold">
                    ₹{amount}
                  </text>
                </g>
              )}

              {/* Nodes with Character Avatars */}
              {Object.entries(NODE_POSITIONS).map(([nodeKey, node]) => {
                const isActive = highlightedNodes.includes(nodeKey);
                const bubble = speechBubbles[nodeKey];

                return (
                  <g
                    key={nodeKey}
                    transform={`translate(${node.x}, ${node.y})`}
                    className={`topo-node ${isActive ? 'is-active-node node-bounce' : ''}`}
                    onClick={() => triggerBubble(nodeKey, `Hey! I'm ${node.name}. Battery: ${node.battery}`)}
                  >
                    {/* Node Base Ring */}
                    <circle
                      r={nodeKey === 'bank' ? 26 : nodeKey === 'bridge' ? 24 : 22}
                      className={`node-circle ${nodeKey === 'bank' ? 'node-bank' : nodeKey === 'bridge' ? 'node-bridge' : 'node-offline'}`}
                    />

                    {/* Character Avatar Icon */}
                    <text textAnchor="middle" y="6" fontSize={nodeKey === 'bank' ? '18' : '16'} className="node-avatar-emoji">
                      {node.avatar}
                    </text>

                    {/* Node Label & Role */}
                    <text textAnchor="middle" y="32" className="node-name">
                      {node.name}
                    </text>
                    <text textAnchor="middle" y="44" className="node-role">
                      {node.role}
                    </text>

                    {/* Dynamic Speech Bubble */}
                    {bubble && bubble.visible && (
                      <g transform="translate(0, -32)" className="speech-bubble-group">
                        <rect
                          x="-80"
                          y="-28"
                          width="160"
                          height="28"
                          rx="6"
                          className="speech-bubble-rect"
                        />
                        <polygon points="-5,0 0,6 5,0" className="speech-bubble-triangle" />
                        <text textAnchor="middle" y="-10" className="speech-bubble-text">
                          {bubble.text.length > 28 ? bubble.text.substring(0, 26) + '...' : bubble.text}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* =====================================================================
            CREATIVE 3-STEP JOURNEY CONTROLS
            ===================================================================== */}
        <div className="card card-demo-journey alive-card">
          <div className="card-header-bar">
            <h2 className="section-title">
              <span className="emoji-icon">🎬</span> 3-Step Living Offline Journey
            </h2>
            <div className="step-tracker">
              <span className={`step-pill ${currentStep === 1 ? 'active' : currentStep > 1 ? 'done' : ''}`}>
                01 🚀 Launch Payment
              </span>
              <span className="step-arrow">➔</span>
              <span className={`step-pill ${currentStep === 2 ? 'active' : currentStep > 2 ? 'done' : ''}`}>
                02 🗣️ Spread Gossip
              </span>
              <span className="step-arrow">➔</span>
              <span className={`step-pill ${currentStep === 3 ? 'active' : ''}`}>
                03 🌉 Bank Settlement
              </span>
            </div>
          </div>

          <div className="journey-steps-grid">
            {/* STEP 1: Compose & Launch */}
            <div className={`journey-step-box ${currentStep === 1 ? 'is-current' : ''}`}>
              <div className="step-emoji-art">
                <span className="emoji-large">👩</span>
                <span className="emoji-arrow">➔</span>
                <span className="emoji-large">✉️</span>
                <span className="emoji-badge-lock">🔐</span>
              </div>

              <div className="step-header">
                <span className="step-badge">1</span>
                <div>
                  <strong className="step-name">1. Seal Offline Envelope</strong>
                  <div className="step-sub">{currentSender.name}'s Phone ({currentSender.role} 📴)</div>
                </div>
              </div>

              <div className="step-mini-visual">
                <span>{currentSender.avatar} {currentSender.name.split(' ')[0]}</span>
                <span className="visual-tx-flow">💸 ₹{amount} Encrypted</span>
                <span>{currentReceiver.avatar} {currentReceiver.name.split(' ')[0]}</span>
              </div>

              <form onSubmit={handleLaunchPayment} className="step-form">
                <div className="form-row-compact">
                  <div className="input-group">
                    <label>👤 Payer (Sender Phone)</label>
                    <select
                      value={senderVpa}
                      onChange={(e) => {
                        const newSender = e.target.value;
                        setSenderVpa(newSender);
                        if (receiverVpa === newSender) {
                          const fallback = Object.keys(CHARACTER_MAP).find((k) => k !== newSender) || 'bob@demo';
                          setReceiverVpa(fallback);
                        }
                      }}
                    >
                      {Object.entries(CHARACTER_MAP).map(([vpa, char]) => (
                        <option key={vpa} value={vpa}>
                          {char.avatar} {char.name} ({vpa})
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="form-arrow">➔</span>

                  <div className="input-group">
                    <label>🏪 Payee (Recipient)</label>
                    <select value={receiverVpa} onChange={(e) => setReceiverVpa(e.target.value)}>
                      {Object.entries(CHARACTER_MAP)
                        .filter(([vpa]) => vpa !== senderVpa)
                        .map(([vpa, char]) => (
                          <option key={vpa} value={vpa}>
                            {char.avatar} {char.name} ({vpa})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-compact">
                  <div className="input-group" style={{ maxWidth: '140px' }}>
                    <label>💵 Amount (₹)</label>
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
                    <label>🔑 UPI PIN</label>
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
                    <span>🚀 Launch Payment</span>
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleGenerateQrVoucher}
                    title="Generate QR Voucher"
                  >
                    <QrCode size={15} />
                    <span>📱 QR Voucher</span>
                  </button>

                  {activePacket && (
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setInspectPacketModal({ isOpen: true, packet: activePacket })}
                    >
                      <Eye size={14} />
                      <span>🔍 Inspect Envelope</span>
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* STEP 2: Gossip Propagation */}
            <div className={`journey-step-box ${currentStep === 2 ? 'is-current' : ''}`}>
              <div className="step-emoji-art">
                <span className="emoji-large">📡</span>
                <span className="emoji-arrow">⇄</span>
                <span className="emoji-large">📲</span>
                <span className="emoji-arrow">⇄</span>
                <span className="emoji-large">🏃‍♂️</span>
              </div>

              <div className="step-header">
                <span className="step-badge">2</span>
                <div>
                  <strong className="step-name">2. Spread the Gossip!</strong>
                  <div className="step-sub">Phone-to-phone BLE store-and-forward 🗣️</div>
                </div>
              </div>

              <div className="step-mini-visual">
                <span>👩 Alice</span>
                <span className="visual-tx-flow">⚡ Carol ⚡ Dave</span>
                <span>🌉 Bridge</span>
              </div>

              <p className="step-desc-text">
                "Psst! Carol, Alice has a payment for Bob!" Relays forward the sealed capsule without knowing the PIN or balance.
              </p>

              <div className="step-actions-cluster">
                <button
                  type="button"
                  className="btn-accent"
                  onClick={handleSpreadGossip}
                  disabled={isSubmitting}
                >
                  <RefreshCw size={15} className={isSubmitting ? 'icon-spin' : ''} />
                  <span>🗣️ Spread the Gossip</span>
                </button>

                <button
                  type="button"
                  className="btn-purple"
                  onClick={handleAutoWhisperToBridge}
                  disabled={isSubmitting}
                >
                  <FastForward size={15} />
                  <span>⚡ Auto-Whisper to Bridge</span>
                </button>
              </div>

              <div className="link-toggle-wrap">
                <button
                  type="button"
                  className={`btn-link-status ${linkFailureActive ? 'severed' : 'healthy'}`}
                  onClick={handleToggleLinkFailure}
                >
                  {linkFailureActive ? <Unlink size={14} /> : <Link2 size={14} />}
                  <span>{linkFailureActive ? '💥 Carol ↔ Bridge Link Severed (Detour Active)' : '✅ Carol ↔ Bridge Link Healthy'}</span>
                </button>
              </div>
            </div>

            {/* STEP 3: Bridge 4G Settlement */}
            <div className={`journey-step-box ${currentStep === 3 ? 'is-current' : ''}`}>
              <div className="step-emoji-art">
                <span className="emoji-large">🌉</span>
                <span className="emoji-arrow">➔</span>
                <span className="emoji-large">🌐</span>
                <span className="emoji-arrow">➔</span>
                <span className="emoji-large">🏛️</span>
                <span className="emoji-badge-sound">🔊</span>
              </div>

              <div className="step-header">
                <span className="step-badge">3</span>
                <div>
                  <strong className="step-name">3. Bridge Hits 4G & Settles</strong>
                  <div className="step-sub">ACID Ledger Credit + Voice Chime 🔔</div>
                </div>
              </div>

              <div className="step-mini-visual">
                <span>🌉 Eve Bridge (4G)</span>
                <span className="visual-tx-flow">🛰️ Cellular ➔</span>
                <span>🏛️ Central Bank</span>
              </div>

              <p className="step-desc-text">
                Eve walks outside, connects to 4G, and flushes all held envelopes. Bank settles funds and announces chime!
              </p>

              <div className="step-actions-cluster">
                <button
                  type="button"
                  className="btn-success"
                  onClick={handleSendToBank}
                  disabled={isSubmitting}
                >
                  <UploadCloud size={16} />
                  <span>🌉 Send to the Bank</span>
                </button>
              </div>

              <div className="step-note-muted">
                🛡️ SHA-256 Idempotency ensures zero double-spending even if 10 bridges upload concurrently!
              </div>
            </div>
          </div>

          {/* Action / Security Toolbar */}
          <div className="demo-actions-toolbar">
            <button className="btn-danger-compact" onClick={handleResetNetwork}>
              <RotateCcw size={14} />
              <span>🔄 Rewind Network</span>
            </button>

            <span className="toolbar-divider">|</span>

            <button className="btn-toolbar" onClick={handleSimulateReplayAttack} title="Simulate Replay Attack">
              <ShieldAlert size={14} className="text-warning" />
              <span>🕵️ Unleash Replay Hack</span>
            </button>

            <button className="btn-toolbar" onClick={handleSimulateTamperAttack} title="Simulate Ciphertext Tampering">
              <ShieldX size={14} className="text-error" />
              <span>🧪 Flip Payload Bit</span>
            </button>

            <button
              className="btn-toolbar"
              onClick={() => announceSoundbox(amount, senderVpa)}
              title="Test Soundbox Audio Chime"
            >
              <Volume2 size={14} className="text-success" />
              <span>🔊 Test Soundbox Voice</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            2-COLUMN GRID: MESH DEVICES & ACCOUNT BALANCES
            ===================================================================== */}
        <div className="grid-devices-balances">
          {/* MESH DEVICES */}
          <div className="card alive-card">
            <div className="card-header-bar">
              <h3 className="section-title-sm">
                <span className="emoji-icon">📱</span> BLE Neighborhood Devices
              </h3>
              <span className="count-pill">{devices.length} roaming nodes</span>
            </div>

            <div className="devices-roster-list">
              {devices.length === 0 ? (
                <div className="empty-state-notice">Connecting to local mesh simulator...</div>
              ) : (
                devices.map((d) => {
                  const isHolding = d.packetCount > 0;
                  const isBridge = d.hasInternet;
                  return (
                    <div
                      key={d.deviceId}
                      className={`device-item-card ${isBridge ? 'is-bridge-node' : 'is-offline-node'} ${
                        isHolding ? 'is-holding-packet' : ''
                      }`}
                    >
                      <div className="device-item-header">
                        <div className="device-id-wrap">
                          <span style={{ fontSize: '1.2rem' }}>{isBridge ? '🌉' : '📱'}</span>
                          <strong>{d.deviceId}</strong>
                        </div>
                        <span className={`badge ${isBridge ? 'badge-4g' : 'badge-offline'}`}>
                          {isBridge ? '🌐 4G ONLINE' : '📴 OFFLINE BLE'}
                        </span>
                      </div>

                      <div className="device-holding-info">
                        <span className="text-muted">📦 holding {d.packetCount} packet(s)</span>
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
                              ✉️ {pktId}
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
          <div className="card alive-card">
            <div className="card-header-bar">
              <h3 className="section-title-sm">
                <span className="emoji-icon">🏦</span> Real-Time ACID Bank Balances
              </h3>
              <span className="cache-pill">
                🛡️ Idempotency: <strong>{idempotencyCacheSize}</strong> verified hashes
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
                    accounts.map((acc) => {
                      const avatar = acc.vpa.includes('alice') ? '👩' : acc.vpa.includes('bob') ? '👨' : acc.vpa.includes('bridge') ? '🌉' : '👩‍💻';
                      const isSender = acc.vpa === senderVpa;
                      const isReceiver = acc.vpa === receiverVpa;
                      return (
                        <tr key={acc.vpa} style={isSender ? { background: 'rgba(203, 179, 232, 0.08)' } : {}}>
                          <td>
                            <code>{acc.vpa}</code>
                            {isSender && <span className="active-sender-pill">YOU (Sender 📱)</span>}
                            {isReceiver && <span className="active-receiver-pill">Payee 🏪</span>}
                          </td>
                          <td>
                            <span style={{ marginRight: '6px' }}>{avatar}</span>
                            <strong>{acc.holderName}</strong>
                          </td>
                          <td className="text-right font-balance">
                            ₹{parseFloat(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="security-guarantee-note">
              <strong>🔐 Offline Settlement Guarantee:</strong> Even if Alice generates multiple offline packets,
              the Central Bank's SHA-256 hash idempotency engine ensures her account is never debited twice.
            </div>
          </div>
        </div>

        {/* =====================================================================
            TRANSACTION LEDGER
            ===================================================================== */}
        <div className="card card-ledger alive-card">
          <div className="card-header-bar">
            <h3 className="section-title-sm">
              <span className="emoji-icon">📜</span> Settled Transaction Ledger (ACID Ledger Core)
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
                      No settled transactions yet. Complete the 3-step payment journey above to settle an offline payment!
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td><span className="tx-id-badge">#{tx.id}</span></td>
                      <td><code>👩 {tx.senderVpa}</code></td>
                      <td><code>👨 {tx.receiverVpa}</code></td>
                      <td className="font-balance">₹{parseFloat(tx.amount).toFixed(2)}</td>
                      <td>
                        <span className={`status-badge status-${tx.status}`}>
                          {tx.status === 'SETTLED' ? '✅ SETTLED' : tx.status === 'DUPLICATE_DROPPED' ? '⚠️ DUPLICATE' : '❌ ' + tx.status}
                        </span>
                      </td>
                      <td><code>{tx.bridgeNodeId || 'N/A'}</code></td>
                      <td><span className="hop-pill">{tx.hopCount} hop(s) ⚡</span></td>
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
        <div className="card card-log alive-card">
          <div className="card-header-bar">
            <h3 className="section-title-sm">
              <span className="emoji-icon">🪵</span> Live Gossip Stream & Cryptographic Terminal
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
              <div className="log-line muted">[Gossip channel listening for BLE advertisements...]</div>
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
                  handleSpreadGossip();
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
                <strong>MeshPay (upiSETU)</strong> is an asynchronous peer-to-peer offline payment network
                demonstrating deferred settlement, hybrid cryptography, and store-and-forward BLE gossip protocols.
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
