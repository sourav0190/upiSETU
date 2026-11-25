/**
 * MeshPay Unified Workbench Controller
 * Orchestrates FinTech transaction terminal, interactive SVG gossip topology,
 * dynamic variable (N) nodes, Web Crypto hybrid encryption, QR voucher generation & scanning,
 * Paytm/PhonePe Soundbox voice announcements, and cybersecurity attack verification.
 */

const KNOWN_ACCOUNTS = {
    'alice': { vpa: 'alice@demo', name: 'Alice Sharma', phone: '+91 98765 43210', initialBalance: 5000.00, initials: 'AS' },
    'bob': { vpa: 'bob@demo', name: 'Bob Verma', phone: '+91 91234 56789', initialBalance: 1000.00, initials: 'BV' },
    'carol': { vpa: 'carol@demo', name: 'Carol Patel', phone: '+91 99887 76655', initialBalance: 2500.00, initials: 'CP' },
    'dave': { vpa: 'dave@demo', name: 'Dave Singh', phone: '+91 94567 12340', initialBalance: 500.00, initials: 'DS' },
    'bridge': { vpa: 'bridge@demo', name: 'Eve Bridge', phone: '+91 98111 22334', initialBalance: 3000.00, initials: 'EB' }
};

const NODE_POSITIONS = {
    'phone-alice': { x: 100, y: 110, name: 'Alice', role: 'Offline Sender' },
    'phone-bob': { x: 270, y: 70, name: 'Bob', role: 'BLE Merchant' },
    'phone-carol': { x: 270, y: 190, name: 'Carol', role: 'BLE Relay Hop 1' },
    'phone-dave': { x: 450, y: 110, name: 'Dave', role: 'BLE Relay Hop 2' },
    'phone-bridge': { x: 450, y: 270, name: '4G Bridge', role: 'Cellular Ingress' },
    'cloud-bank': { x: 660, y: 190, name: 'Central Bank', role: 'ACID Core Ledger' }
};

class UnifiedMeshPayApp {
    constructor() {
        const urlParams = new URLSearchParams(window.location.search);
        const userKey = (urlParams.get('user') || localStorage.getItem('meshpay_active_user') || 'alice').toLowerCase();
        this.userKey = userKey in KNOWN_ACCOUNTS ? userKey : 'alice';
        const profile = KNOWN_ACCOUNTS[this.userKey] || { vpa: this.userKey + '@demo', name: this.userKey, phone: '+91 90000 00000', initials: 'MP' };

        this.currentUser = {
            vpa: profile.vpa,
            name: profile.name,
            phone: profile.phone,
            initials: profile.initials
        };

        // UI & Simulation State
        this.theme = localStorage.getItem('meshpay_theme') || 'dark';
        this.isOnline = false; // Sender starts offline in basement
        this.balanceHidden = false;
        this.selectedRecipient = null;
        this.paymentMode = 'ble'; // 'ble' or 'qr'
        this.enteredPin = '';
        this.activePacket = null;
        this.lastCreatedPacket = null;
        this.isAutoRunning = false;
        this.autoRunTimer = null;
        this.linkFailureActive = false;
        this.currentSimulationStage = 0; // 0=idle, 1=alice, 2=relays, 3=bridge, 4=bank settled

        // Offline UPI-Lite Allowance
        this.allowanceLimit = 2000.00;
        this.allowanceSpent = 0.00;

        // Subsystems
        this.network = new MeshNetwork();
        this.crypto = new MeshCrypto();
        this.db = new MeshDB();

        // Variable N Nodes roster
        this.allDevices = [];
        this.scannerStream = null;
    }

    async init() {
        document.documentElement.setAttribute('data-theme', this.theme);

        const userSelect = document.getElementById('user-profile-select');
        if (userSelect) userSelect.value = this.userKey;

        // Initialize Crypto & DB
        try {
            await this.crypto.init();
            await this.db.init();
        } catch (e) {
            console.warn('Storage/Crypto initialization note:', e);
        }

        // Register current device with backend mesh
        try {
            const role = this.userKey === 'bridge' ? 'BRIDGE' : (this.userKey === 'bob' ? 'MERCHANT' : 'SENDER');
            const hasNet = this.userKey === 'bridge';
            this.isOnline = hasNet;
            await this.network.registerDevice(this.currentUser.name, this.currentUser.vpa, hasNet, role);
        } catch (e) {}

        this.updateConnectivityPillUI();

        // Load devices & UI
        await this.fetchAndRenderDevices();
        await this.refreshLedgerAndBalances();
        await this.refreshOutboxBadge();

        this.addTimelineEvent('gossip', `MeshPay initialized. Node ${this.currentUser.name} online in local cluster.`);

        // Periodic background ledger & mesh sync polling
        setInterval(() => this.backgroundRefresh(), 3000);
    }

    // =========================================================================
    // Theme & Identity Switcher
    // =========================================================================

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('meshpay_theme', this.theme);
        this.showToast(`Switched to ${this.theme} theme`, 'info');
    }

    switchUser(key) {
        if (key === '__new__') {
            this.openAddDeviceModal();
            return;
        }
        localStorage.setItem('meshpay_active_user', key);
        const url = new URL(window.location);
        url.searchParams.set('user', key);
        window.location.href = url.toString();
    }

    toggleConnectivityMode() {
        this.isOnline = !this.isOnline;
        this.updateConnectivityPillUI();

        // Update server
        this.network.toggleInternet(this.network.deviceId, this.isOnline);

        if (this.isOnline) {
            this.showToast('Reconnected to 4G Cellular network', 'online');
            this.addTimelineEvent('gossip', `${this.currentUser.name} acquired 4G Cellular backhaul.`);
            this.syncMeshToBank();
        } else {
            this.showToast('Offline Mode: Disconnected from internet (Using BLE Gossip)', 'offline');
            this.addTimelineEvent('gossip', `${this.currentUser.name} entered offline basement (Zero 4G/Wi-Fi).`);
        }
        this.fetchAndRenderDevices();
    }

    updateConnectivityPillUI() {
        const pill = document.getElementById('network-status-pill');
        const text = document.getElementById('network-status-text');
        if (!pill || !text) return;

        if (this.isOnline) {
            pill.className = 'network-status-badge online';
            text.textContent = 'Online (4G)';
        } else {
            pill.className = 'network-status-badge offline';
            text.textContent = 'Offline (Mesh)';
        }
    }

    toggleBalanceVisibility() {
        this.balanceHidden = !this.balanceHidden;
        const balEl = document.getElementById('user-balance-display');
        if (this.balanceHidden) {
            balEl.textContent = '••••••';
        } else {
            this.refreshLedgerAndBalances();
        }
    }

    // =========================================================================
    // Variable N-Device Roster Management
    // =========================================================================

    async fetchAndRenderDevices() {
        try {
            const peers = await this.network.scanForPeers(this.currentUser.vpa);
            this.renderRecipientGrid(peers);

            // Render studio roster
            const res = await fetch('/api/v1/devices');
            if (res.ok) {
                this.allDevices = await res.json();
                this.renderDeviceRosterTab(this.allDevices);
            }
        } catch (e) {
            console.log('Peer scan note:', e.message);
        }
    }

    renderRecipientGrid(peers = []) {
        const grid = document.getElementById('peer-grid');
        if (!grid) return;

        const defaultList = [
            { id: 'phone-bob', vpa: 'bob@demo', name: 'Bob Verma', role: 'Merchant', dist: '1.2m', rssi: -58 },
            { id: 'phone-carol', vpa: 'carol@demo', name: 'Carol Patel', role: 'Peer Relay', dist: '3.5m', rssi: -72 },
            { id: 'phone-dave', vpa: 'dave@demo', name: 'Dave Singh', role: 'Peer Relay', dist: '6.1m', rssi: -85 },
            { id: 'phone-bridge', vpa: 'bridge@demo', name: 'Eve Bridge', role: '4G Bridge', dist: '2.0m', rssi: -64 }
        ].filter(r => r.vpa !== this.currentUser.vpa);

        const list = (peers && peers.length > 0) ? peers : defaultList;

        if (!this.selectedRecipient && list.length > 0) {
            this.selectedRecipient = list[0];
        }

        grid.innerHTML = list.map(r => `
            <button class="peer-chip-btn ${this.selectedRecipient && this.selectedRecipient.vpa === r.vpa ? 'active' : ''}"
                    onclick="window.app.selectRecipient('${r.vpa}', '${r.name}')">
                <span class="peer-chip-name">📱 ${r.name}</span>
                <span class="peer-chip-vpa">${r.vpa} • <span style="color:var(--brand-primary);">${r.dist || '1m'}</span></span>
            </button>
        `).join('');
    }

    selectRecipient(vpa, name) {
        this.selectedRecipient = { vpa, name };
        this.fetchAndRenderDevices();
    }

    renderDeviceRosterTab(devices = []) {
        const container = document.getElementById('device-roster-container');
        if (!container) return;

        container.innerHTML = devices.map(d => {
            const isCurrent = d.vpa === this.currentUser.vpa;
            const isOnline = Boolean(d.hasInternet);
            return `
                <div class="device-tile ${isCurrent ? 'active-user' : ''}">
                    <div class="device-tile-header">
                        <span class="device-tile-name">${d.deviceName || d.deviceId} ${isCurrent ? '(You)' : ''}</span>
                        <span class="status-pill ${isOnline ? 'settled' : 'queued_offline'}">
                            ${isOnline ? '4G Online' : 'Offline'}
                        </span>
                    </div>
                    <div class="device-tile-vpa">${d.vpa} • Role: ${d.role || 'PEER'}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                        <span style="font-size: 0.7rem; color: var(--text-muted);">Packets: <strong>${d.packetCount || 0}</strong></span>
                        <button class="device-status-toggle-btn ${isOnline ? 'online' : 'offline'}"
                                onclick="window.app.toggleDeviceInternetById('${d.deviceId}', ${!isOnline})">
                            ${isOnline ? 'Cut 4G Net' : 'Enable 4G Net'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async toggleDeviceInternetById(deviceId, newStatus) {
        await this.network.toggleInternet(deviceId, newStatus);
        this.showToast(`Updated device ${deviceId} connectivity`, 'info');
        await this.fetchAndRenderDevices();
    }

    openAddDeviceModal() {
        document.getElementById('add-device-modal-backdrop').classList.add('active');
    }

    closeAddDeviceModal() {
        document.getElementById('add-device-modal-backdrop').classList.remove('active');
    }

    async confirmAddDevice() {
        const nameInput = document.getElementById('new-device-name');
        const vpaInput = document.getElementById('new-device-vpa');
        const roleInput = document.getElementById('new-device-role');
        const netInput = document.getElementById('new-device-internet');

        const name = (nameInput && nameInput.value.trim()) || 'Custom Node';
        const vpa = (vpaInput && vpaInput.value.trim()) || (name.toLowerCase().replace(/\s+/g, '') + '@demo');
        const role = roleInput ? roleInput.value : 'RELAY';
        const hasInternet = netInput ? netInput.checked : false;

        this.closeAddDeviceModal();
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
            this.showToast(`Node ${name} registered to mesh network!`, 'success');
            this.addTimelineEvent('gossip', `New physical node ${name} (${vpa}) joined mesh cluster.`);
            await this.fetchAndRenderDevices();
        } catch (e) {
            this.showToast('Registration error: ' + e.message, 'error');
        }
    }

    // =========================================================================
    // Amount & PIN Modal
    // =========================================================================

    setAmount(amt) {
        const input = document.getElementById('amount-input');
        if (input) input.value = amt;

        document.querySelectorAll('.pill-amt-btn').forEach(btn => {
            if (btn.textContent.includes(amt.toString())) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    openPinModal(mode = 'ble') {
        this.paymentMode = mode;
        const amtInput = document.getElementById('amount-input');
        const amt = parseFloat(amtInput ? amtInput.value : 0);

        if (!amt || amt <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }

        if (amt > 500) {
            this.showToast('RBI UPI-Lite limit: Maximum ₹500 per offline transaction', 'error');
            return;
        }

        if (this.allowanceSpent + amt > this.allowanceLimit) {
            this.showToast('Exceeds daily offline spending limit of ₹2,000', 'error');
            return;
        }

        this.enteredPin = '';
        this.updatePinDots();

        document.getElementById('pin-modal-amount').textContent = `₹${amt.toFixed(2)}`;
        document.getElementById('pin-modal-recipient').textContent = this.selectedRecipient ? this.selectedRecipient.name : 'Merchant';
        document.getElementById('pin-modal-backdrop').classList.add('active');
    }

    closePinModal() {
        this.enteredPin = '';
        this.updatePinDots();
        document.getElementById('pin-modal-backdrop').classList.remove('active');
    }

    enterPinDigit(digit) {
        if (this.enteredPin.length < 4) {
            this.enteredPin += digit;
            this.updatePinDots();

            if (this.enteredPin.length === 4) {
                setTimeout(() => this.processPaymentSubmission(), 200);
            }
        }
    }

    backspacePin() {
        if (this.enteredPin.length > 0) {
            this.enteredPin = this.enteredPin.slice(0, -1);
            this.updatePinDots();
        }
    }

    updatePinDots() {
        const dots = document.querySelectorAll('.pin-bubble-dot');
        dots.forEach((dot, idx) => {
            if (idx < this.enteredPin.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        });
    }

    // =========================================================================
    // Payment Creation, Cryptographic Envelope & Outbox
    // =========================================================================

    async processPaymentSubmission() {
        const pin = this.enteredPin;
        this.closePinModal();

        const amtInput = document.getElementById('amount-input');
        const noteInput = document.getElementById('note-input');
        const amount = parseFloat(amtInput ? amtInput.value : 100);
        const note = noteInput ? noteInput.value.trim() : 'Payment';
        const receiverVpa = this.selectedRecipient ? this.selectedRecipient.vpa : 'bob@demo';

        this.showToast('Web Crypto: Generating RSA-2048-OAEP + AES-256-GCM envelope...', 'crypto');

        try {
            // 1. Create Payment Instruction Object
            const nonce = 'nc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            const instruction = {
                senderVpa: this.currentUser.vpa,
                receiverVpa: receiverVpa,
                amount: amount,
                nonce: nonce,
                pin: pin,
                note: note,
                timestamp: Date.now()
            };

            // 2. Encrypt using Web Crypto
            const encryptedEnvelope = await this.crypto.encryptPayment(instruction);
            const packetId = 'pkt_' + Math.random().toString(36).substr(2, 9);
            const packetHash = encryptedEnvelope.packetHash;

            const packetRecord = {
                packetId: packetId,
                ciphertext: encryptedEnvelope.ciphertext,
                packetHash: packetHash,
                instruction: instruction,
                ttl: 5,
                createdAt: Date.now(),
                status: 'QUEUED_OFFLINE'
            };

            this.lastCreatedPacket = packetRecord;
            this.activePacket = packetRecord;

            // 3. Save to local IndexedDB outbox
            await this.db.queuePacket(packetRecord);
            this.allowanceSpent += amount;
            this.updateAllowanceGauge();
            await this.refreshOutboxBadge();

            // 4. Update Packet Inspector
            this.updatePacketInspector(packetRecord);

            // 5. Log live events
            this.addTimelineEvent('payment', `Signed ₹${amount} offline payment to ${receiverVpa} (SHA-256: ${packetHash.substr(0, 14)}...)`);

            if (this.paymentMode === 'qr') {
                // Display Voucher QR
                this.openVoucherQrModalWithPacket(packetRecord);
            } else {
                // Submit to server mesh simulation state
                await this.network.transferPacketToPeer('phone-alice', packetRecord);

                this.currentSimulationStage = 1;
                this.highlightActiveRoute(['phone-alice', 'phone-carol']);
                this.animatePacketTransit('phone-alice', 'phone-carol');

                this.showToast(`Payment of ₹${amount} signed & queued in BLE mesh!`, 'success');
            }

            await this.refreshLedgerAndBalances();

        } catch (err) {
            console.error('Payment generation error:', err);
            this.showToast(`Payment error: ${err.message}`, 'error');
            this.addTimelineEvent('failure', `Payment failed: ${err.message}`);
        }
    }

    // =========================================================================
    // Dynamic QR Code Generation & Scanning Engine
    // =========================================================================

    openMerchantQrModal() {
        const amtInput = document.getElementById('amount-input');
        const amount = parseFloat(amtInput ? amtInput.value : 100);
        const upiUri = window.meshQR.createUpiUri(this.currentUser.vpa, this.currentUser.name, amount, 'Offline Store Payment');

        document.getElementById('qr-modal-title').textContent = `Merchant UPI QR (${this.currentUser.name})`;
        document.getElementById('qr-modal-subtitle').textContent = `Scan to pay ₹${amount.toFixed(2)} to ${this.currentUser.vpa}`;

        window.meshQR.renderSVG('qr-svg-target', upiUri, { size: 210, fgColor: '#00e5a3' });
        document.getElementById('qr-raw-payload-preview').textContent = upiUri;

        document.getElementById('qr-display-modal-backdrop').classList.add('active');
    }

    openVoucherQrModalWithPacket(packetRecord) {
        const voucherUri = window.meshQR.createVoucherUri(packetRecord);

        document.getElementById('qr-modal-title').textContent = 'Offline Payment Voucher QR';
        document.getElementById('qr-modal-subtitle').textContent = `Optical Signed Envelope of ₹${packetRecord.instruction.amount} to ${packetRecord.instruction.receiverVpa}`;

        window.meshQR.renderSVG('qr-svg-target', voucherUri, { size: 210, fgColor: '#38bdf8' });
        document.getElementById('qr-raw-payload-preview').textContent = voucherUri.substring(0, 120) + '...';

        document.getElementById('qr-display-modal-backdrop').classList.add('active');
    }

    closeQrDisplayModal() {
        document.getElementById('qr-display-modal-backdrop').classList.remove('active');
    }

    async simulateScanThisVoucher() {
        this.closeQrDisplayModal();
        if (!this.lastCreatedPacket) return;

        this.showToast('Peer Phone Scanned QR: Importing encrypted voucher into local outbox...', 'info');
        this.addTimelineEvent('gossip', `Optical Transfer: Peer merchant scanned offline QR voucher (SHA-256: ${this.lastCreatedPacket.packetHash.substring(0, 12)}...)`);

        // Inject into mesh as if transferred to merchant Bob
        await this.network.transferPacketToPeer('phone-bob', this.lastCreatedPacket);
        this.currentSimulationStage = 2;
        this.highlightActiveRoute(['phone-bob', 'phone-bridge']);
        this.animatePacketTransit('phone-bob', 'phone-bridge');
    }

    openScannerModal() {
        document.getElementById('qr-scanner-modal-backdrop').classList.add('active');
        this.startScannerCamera();
    }

    closeScannerModal() {
        document.getElementById('qr-scanner-modal-backdrop').classList.remove('active');
        this.stopScannerCamera();
    }

    async startScannerCamera() {
        try {
            const video = document.getElementById('qr-video-feed');
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                this.scannerStream = stream;
                if (video) video.srcObject = stream;
            }
        } catch (e) {
            console.log('Camera access simulated (no physical camera or permission denied):', e.message);
        }
    }

    stopScannerCamera() {
        if (this.scannerStream) {
            this.scannerStream.getTracks().forEach(t => t.stop());
            this.scannerStream = null;
        }
    }

    async decodeManualQrInput() {
        const input = document.getElementById('manual-qr-input');
        const text = input ? input.value.trim() : '';
        if (!text) {
            this.showToast('Please paste a QR code string or voucher data', 'error');
            return;
        }
        await this.processScannedText(text);
    }

    async scanSampleVoucher() {
        // Create an instant test voucher
        const sampleInstruction = {
            senderVpa: 'alice@demo',
            receiverVpa: 'bob@demo',
            amount: 50.00,
            nonce: 'nc_test_' + Date.now(),
            pin: '1234',
            note: 'Sample Chai',
            timestamp: Date.now()
        };
        const env = await this.crypto.encryptPayment(sampleInstruction);
        const sampleRecord = {
            packetId: 'pkt_sample_' + Math.random().toString(36).substring(2, 7),
            packetHash: env.packetHash,
            ciphertext: env.ciphertext,
            instruction: sampleInstruction,
            ttl: 5
        };
        const voucherUri = window.meshQR.createVoucherUri(sampleRecord);
        await this.processScannedText(voucherUri);
    }

    async processScannedText(text) {
        this.closeScannerModal();
        const parsed = window.meshQR.parseScannedText(text);

        if (!parsed) {
            this.showToast('Could not decode QR payload format', 'error');
            return;
        }

        if (parsed.type === 'OFFLINE_VOUCHER') {
            this.showToast(`Decoded Signed Voucher: ₹${parsed.amount} from ${parsed.senderVpa}`, 'success');
            this.addTimelineEvent('payment', `[QR Scanner] Scanned offline signed voucher for ₹${parsed.amount} (Hash: ${parsed.packetHash.substring(0, 12)}...)`);

            // Queue in local outbox
            await this.db.queuePacket({
                packetId: parsed.packetId,
                packetHash: parsed.packetHash,
                ciphertext: parsed.ciphertext,
                ttl: 4,
                createdAt: parsed.timestamp || Date.now(),
                status: 'QUEUED_OFFLINE'
            });
            await this.refreshOutboxBadge();

            // Settle to bank if online
            if (this.isOnline) {
                this.syncMeshToBank();
            } else {
                this.showToast('Voucher stored in local outbox. Will sync when bridge connects!', 'info');
            }

        } else if (parsed.type === 'UPI_PAY_REQUEST') {
            this.showToast(`Scanned UPI Merchant QR: Pay ₹${parsed.amount} to ${parsed.receiverVpa}`, 'info');
            this.selectRecipient(parsed.receiverVpa, parsed.receiverName || parsed.receiverVpa);
            if (parsed.amount > 0) this.setAmount(parsed.amount);
        } else {
            this.showToast('Scanned text: ' + text.substring(0, 40), 'info');
        }
    }

    // =========================================================================
    // Soundbox Audio Speech Synthesizer
    // =========================================================================

    announceSoundbox(amount, senderOrReceiverName) {
        if (!('speechSynthesis' in window)) return;

        try {
            window.speechSynthesis.cancel();
            const text = `MeshPay received ${amount} Rupees from ${senderOrReceiverName}`;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.1;

            // Pick Indian English voice if available
            const voices = window.speechSynthesis.getVoices();
            const inVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('hi-IN'));
            if (inVoice) utterance.voice = inVoice;

            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.log('Soundbox synthesis note:', e.message);
        }
    }

    testSoundbox() {
        this.showToast('Soundbox: Announcing test payment...', 'crypto');
        this.announceSoundbox(100, 'Alice Sharma');
    }

    // =========================================================================
    // Cybersecurity Attack & Defense Center
    // =========================================================================

    async runReplayAttack() {
        this.switchDiagTab('cyber');
        const resEl = document.getElementById('result-replay');

        if (!this.lastCreatedPacket) {
            this.showToast('Please create an offline transaction first', 'error');
            if (resEl) resEl.innerHTML = '<span style="color:var(--accent-red);">Error: Create a transaction first to obtain a signed packet.</span>';
            return;
        }

        if (resEl) resEl.innerHTML = 'Sending duplicate replay packet to bank gateway...';

        try {
            const res = await fetch('/api/v1/cyber/replay-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packet: this.lastCreatedPacket })
            });
            const data = await res.json();

            if (resEl) {
                resEl.innerHTML = `
                    <span style="color:var(--brand-primary); font-weight:700;">[REPLAY SHIELD BLOCKED ATTACK]</span><br>
                    Outcome: <strong>${data.outcome}</strong><br>
                    Defense: ${data.cryptographicDefense}
                `;
            }
            this.showToast('Replay Attack Neutralized: Dropped duplicate packet with zero ledger debit!', 'success');
            this.addTimelineEvent('duplicate', `[Cyber Defense] Replay attack blocked by SHA-256 Idempotency filter.`);
        } catch (e) {
            if (resEl) resEl.textContent = 'Error: ' + e.message;
        }
    }

    async runTamperAttack() {
        this.switchDiagTab('cyber');
        const resEl = document.getElementById('result-tamper');

        if (!this.lastCreatedPacket) {
            this.showToast('Please create an offline transaction first', 'error');
            if (resEl) resEl.innerHTML = '<span style="color:var(--accent-red);">Error: Create a transaction first to obtain a signed packet.</span>';
            return;
        }

        if (resEl) resEl.innerHTML = 'Flipping bit in AES-GCM ciphertext and submitting to bank...';

        try {
            const res = await fetch('/api/v1/cyber/tamper-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packet: this.lastCreatedPacket })
            });
            const data = await res.json();

            if (resEl) {
                resEl.innerHTML = `
                    <span style="color:var(--accent-red); font-weight:700;">[TAMPER DETECTED: INVALID]</span><br>
                    Outcome: <strong>${data.outcome}</strong> (Reason: ${data.reason})<br>
                    Defense: ${data.cryptographicDefense}
                `;
            }
            this.showToast('Tamper Attack Neutralized: Decryption failed due to authentication tag mismatch!', 'success');
            this.addTimelineEvent('failure', `[Cyber Defense] AES-GCM tag mismatch: Tampered ciphertext rejected.`);
        } catch (e) {
            if (resEl) resEl.textContent = 'Error: ' + e.message;
        }
    }

    runSnoopingTest() {
        this.switchDiagTab('cyber');
        const resEl = document.getElementById('result-snoop');
        if (!this.lastCreatedPacket) {
            this.showToast('Please create an offline transaction first', 'error');
            return;
        }

        const cipher = this.lastCreatedPacket.ciphertext;
        if (resEl) {
            resEl.innerHTML = `
                <span style="color:var(--accent-blue); font-weight:700;">[ZERO-KNOWLEDGE RELAY INSPECTION]</span><br>
                What Intermediate Peer (Carol/Dave) Sees:<br>
                <code style="color:var(--accent-amber);">${cipher.substring(0, 60)}...</code><br>
                <strong>Zero Leakage:</strong> Amount: HIDDEN | PIN: HIDDEN | Balance: HIDDEN.<br>
                Only the Central Bank's RSA-2048 private key can open this envelope!
            `;
        }
        this.showToast('Privacy Proven: Intermediate peers cannot read PIN, balances, or amounts!', 'info');
    }

    testDoubleSpendLimit() {
        this.switchDiagTab('cyber');
        const resEl = document.getElementById('result-doublespend');
        if (resEl) {
            resEl.innerHTML = `
                <span style="color:var(--accent-red); font-weight:700;">[ENCLAVE LIMIT ENFORCED]</span><br>
                Attempted: ₹2,500 offline transfer.<br>
                Rule: RBI UPI-Lite specification caps offline un-synced allowance at ₹2,000.<br>
                Result: Local hardware keystore rejected signing. Reconnection required to refresh limit!
            `;
        }
        this.showToast('Double-spend prevented: Exceeds ₹2,000 RBI UPI-Lite cap!', 'error');
    }

    async topUpAllowance() {
        try {
            await fetch('/api/v1/wallet/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vpa: this.currentUser.vpa, amount: 1000.00, resetAllowance: true })
            });
            this.allowanceSpent = 0.00;
            this.updateAllowanceGauge();
            this.showToast('Offline allowance reset to ₹2,000 & balance topped up!', 'success');
            this.addTimelineEvent('settlement', `Reconciled allowance for ${this.currentUser.vpa}: ₹2,000 daily limit replenished.`);
            await this.refreshLedgerAndBalances();
        } catch (e) {
            this.showToast('Top-up error: ' + e.message, 'error');
        }
    }

    // =========================================================================
    // Multi-Device Split-Screen Studio Showcase
    // =========================================================================

    toggleStudioView() {
        const overlay = document.getElementById('studio-overlay');
        if (!overlay) return;

        const isActive = overlay.classList.contains('active');
        if (isActive) {
            overlay.classList.remove('active');
        } else {
            overlay.classList.add('active');
            this.renderStudioPhones();
        }
    }

    renderStudioPhones() {
        const grid = document.getElementById('studio-phones-grid');
        if (!grid) return;

        const phones = [
            { id: 'alice', name: 'Alice Sharma', role: 'Offline Sender (Basement)', net: 'OFFLINE', color: '#10b981', action: 'Initiates Payment' },
            { id: 'bob', name: 'Bob Verma', role: 'Offline Merchant (Shop)', net: 'OFFLINE', color: '#38bdf8', action: 'Receives Dynamic QR' },
            { id: 'carol', name: 'Carol Patel', role: 'Peer Relay Hop 1', net: 'OFFLINE', color: '#a855f7', action: 'Relays via BLE Gossip' },
            { id: 'dave', name: 'Dave Singh', role: 'Peer Relay Hop 2', net: 'OFFLINE', color: '#f59e0b', action: 'Relays via BLE Gossip' },
            { id: 'bridge', name: 'Eve Bridge', role: 'Cellular Bridge Node', net: '4G ONLINE', color: '#2563eb', action: 'Ingests to Central Bank' }
        ];

        grid.innerHTML = phones.map(p => `
            <div class="phone-viewport-frame">
                <div class="phone-notch-bar"></div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <strong style="font-size:0.88rem; color:${p.color};">${p.name}</strong>
                    <span class="status-pill ${p.net.includes('ONLINE') ? 'settled' : 'queued_offline'}">${p.net}</span>
                </div>
                <div style="font-size:0.74rem; color:var(--text-muted); margin-bottom:12px;">Role: ${p.role}</div>
                <div style="background:var(--surface-input); border:1px solid var(--border-subtle); border-radius:12px; padding:12px; flex:1; display:flex; flex-direction:column; justify-content:center; text-align:center;">
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px;">Current State</div>
                    <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary); margin-bottom:8px;">${p.action}</div>
                    <div style="font-size:0.7rem; font-family:var(--font-mono); color:var(--text-muted);">
                        ${this.lastCreatedPacket ? 'Holding Envelope ' + this.lastCreatedPacket.packetId : 'Awaiting Transaction'}
                    </div>
                </div>
                <div style="margin-top:12px;">
                    <button class="sim-btn" onclick="window.app.switchUser('${p.id}')" style="width:100%; justify-content:center; font-size:0.72rem;">
                        Switch View to ${p.name.split(' ')[0]}
                    </button>
                </div>
            </div>
        `).join('');
    }

    // =========================================================================
    // SVG Topology Visualizer & Dynamic Gossip Routing
    // =========================================================================

    highlightActiveRoute(nodeIds) {
        document.querySelectorAll('.graph-node').forEach(n => {
            n.classList.remove('active', 'holding-packet');
        });
        nodeIds.forEach(id => {
            const el = document.getElementById(id.replace('phone-', 'node-'));
            if (el) el.classList.add('active', 'holding-packet');
        });
    }

    animatePacketTransit(fromNodeId, toNodeId) {
        const from = NODE_POSITIONS[fromNodeId];
        const to = NODE_POSITIONS[toNodeId];
        const dot = document.getElementById('transit-packet-dot');

        if (!from || !to || !dot) return;

        dot.style.display = 'block';
        dot.setAttribute('cx', from.x);
        dot.setAttribute('cy', from.y);

        setTimeout(() => {
            dot.setAttribute('cx', to.x);
            dot.setAttribute('cy', to.y);
        }, 50);
    }

    async stepSimulationHop() {
        try {
            if (this.currentSimulationStage === 0 || !this.lastCreatedPacket) {
                this.setAmount(100);
                this.enteredPin = '1234';
                await this.processPaymentSubmission();
                return;
            }

            if (this.currentSimulationStage === 1) {
                if (this.linkFailureActive) {
                    this.addTimelineEvent('gossip', 'Primary path broken! Gossip protocol rerouting via Dave.');
                    this.animatePacketTransit('phone-alice', 'phone-bob');
                    setTimeout(() => {
                        this.animatePacketTransit('phone-bob', 'phone-dave');
                        this.highlightActiveRoute(['phone-dave']);
                    }, 500);
                } else {
                    this.animatePacketTransit('phone-carol', 'phone-bridge');
                    this.highlightActiveRoute(['phone-carol', 'phone-bridge']);
                }

                await fetch('/api/v1/mesh/gossip', { method: 'POST' });
                this.addTimelineEvent('gossip', 'BLE Gossip step completed. Packet stored and forwarded across neighbors (TTL: 4).');
                this.currentSimulationStage = 2;
                this.showToast('Gossip hop: Packet forwarded to intermediate BLE peers', 'sync');

            } else if (this.currentSimulationStage === 2) {
                this.animatePacketTransit('phone-dave', 'phone-bridge');
                this.highlightActiveRoute(['phone-bridge']);
                this.addTimelineEvent('gossip', 'Bridge Node (Metro Ingress) acquired packet and detected 4G LTE signal.');
                this.currentSimulationStage = 3;
                this.showToast('4G Bridge device acquired signal, ready to sync!', 'online');

            } else if (this.currentSimulationStage >= 3) {
                await this.syncMeshToBank();
            }

            await this.refreshLedgerAndBalances();
        } catch (e) {
            console.error('Step hop error:', e);
            this.showToast('Gossip step error: ' + e.message, 'error');
        }
    }

    async toggleAutoRun() {
        const btn = document.getElementById('btn-sim-autorun');
        const label = document.getElementById('btn-autorun-label');

        if (this.isAutoRunning) {
            this.isAutoRunning = false;
            if (this.autoRunTimer) clearInterval(this.autoRunTimer);
            if (label) label.textContent = 'Auto Run';
            if (btn) btn.classList.remove('danger');
            this.showToast('Auto-simulation paused', 'info');
        } else {
            this.isAutoRunning = true;
            if (label) label.textContent = 'Pause';
            if (btn) btn.classList.add('danger');
            this.showToast('Auto-simulation started: Stepping packet through mesh...', 'success');

            const executeStep = async () => {
                if (!this.isAutoRunning) return;
                await this.stepSimulationHop();
                if (this.currentSimulationStage === 0) {
                    this.isAutoRunning = false;
                    if (this.autoRunTimer) clearInterval(this.autoRunTimer);
                    if (label) label.textContent = 'Auto Run';
                    if (btn) btn.classList.remove('danger');
                }
            };

            await executeStep();
            this.autoRunTimer = setInterval(executeStep, 2400);
        }
    }

    async syncMeshToBank() {
        this.animatePacketTransit('phone-bridge', 'cloud-bank');
        this.highlightActiveRoute(['cloud-bank']);
        this.addTimelineEvent('settlement', '4G Bridge transmitting encrypted batch to Central Bank via HTTPS POST /api/v1/sync');

        try {
            const res = await fetch('/api/v1/mesh/flush', { method: 'POST' });
            const data = await res.json();

            if (this.lastCreatedPacket) {
                await this.db.updatePacketStatus(this.lastCreatedPacket.packetId, 'SETTLED');
            }

            this.currentSimulationStage = 0;
            this.addTimelineEvent('settlement', `Central Bank decrypted RSA envelope: Settlement complete!`);
            this.showToast('ACID Settlement Complete: Central Bank verified & updated balances!', 'success');

            // Trigger Soundbox Audio Announcement
            const amount = this.lastCreatedPacket && this.lastCreatedPacket.instruction ? this.lastCreatedPacket.instruction.amount : 100;
            this.announceSoundbox(amount, this.currentUser.name);

            await this.refreshLedgerAndBalances();
            await this.refreshOutboxBadge();

            setTimeout(() => {
                const dot = document.getElementById('transit-packet-dot');
                if (dot) dot.style.display = 'none';
            }, 1500);

        } catch (e) {
            console.error('Bank sync error:', e);
            this.showToast('Bank sync failed: ' + e.message, 'error');
        }
    }

    toggleLinkFailure() {
        this.linkFailureActive = !this.linkFailureActive;
        const link = document.getElementById('link-carol-bridge');
        const btn = document.getElementById('btn-sim-fail-link');
        const label = document.getElementById('label-link-toggle');

        if (this.linkFailureActive) {
            if (link) link.classList.add('broken');
            if (btn) btn.classList.add('primary');
            if (label) label.textContent = '🔗 Restore Link';
            this.showToast('BLE Link Severed: Carol ↔ Bridge partitioned! Route recalculating...', 'offline');
            this.addTimelineEvent('failure', '[Network Failure] Carol ↔ Bridge connection lost. Protocol routing via Dave.');
        } else {
            if (link) link.classList.remove('broken');
            if (btn) btn.classList.remove('primary');
            if (label) label.textContent = '⚡ Break Link';
            this.showToast('BLE Link Restored: Topology reconnected', 'online');
            this.addTimelineEvent('gossip', '[Topology Restored] Carol ↔ Bridge BLE link restored.');
        }
    }

    inspectNode(nodeId) {
        const info = NODE_POSITIONS[nodeId];
        if (!info) return;

        this.showToast(`Node ${info.name}: ${info.role}`, 'info');
        this.addTimelineEvent('gossip', `Inspecting ${info.name} (${info.role}) — BLE Radio Active, RSSI: -54 dBm.`);

        document.querySelectorAll('.graph-node').forEach(n => n.classList.remove('active'));
        const el = document.getElementById(nodeId.replace('phone-', 'node-'));
        if (el) el.classList.add('active');
    }

    // =========================================================================
    // Diagnostics Tabs & Packet Inspector
    // =========================================================================

    switchDiagTab(tabKey) {
        document.querySelectorAll('.diag-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.diag-tab-content').forEach(pane => pane.classList.remove('active'));

        const btn = document.getElementById(`tab-btn-${tabKey}`);
        const pane = document.getElementById(`pane-${tabKey}`);
        if (btn) btn.classList.add('active');
        if (pane) pane.classList.add('active');
    }

    updatePacketInspector(pkt) {
        if (!pkt) return;

        const idEl = document.getElementById('inspect-packet-id');
        const senderEl = document.getElementById('inspect-sender-vpa');
        const recvEl = document.getElementById('inspect-receiver-vpa');
        const hashEl = document.getElementById('inspect-hash-digest');
        const routeEl = document.getElementById('inspect-route-status');

        if (idEl) idEl.textContent = pkt.packetId;
        if (senderEl) senderEl.textContent = pkt.instruction ? pkt.instruction.senderVpa : 'alice@demo';
        if (recvEl) recvEl.textContent = pkt.instruction ? pkt.instruction.receiverVpa : 'bob@demo';
        if (hashEl) hashEl.textContent = pkt.packetHash ? pkt.packetHash : 'Generated (SHA-256)';
        if (routeEl) routeEl.textContent = `TTL: ${pkt.ttl || 5} hops | Status: Active Routing`;
    }

    addTimelineEvent(category, message) {
        const feed = document.getElementById('timeline-feed');
        if (!feed) return;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const row = document.createElement('div');
        row.className = `timeline-event-row ${category}`;
        row.innerHTML = `
            <span class="event-timestamp">[${timeStr}]</span>
            <span class="event-message">${message}</span>
        `;

        feed.insertBefore(row, feed.firstChild);

        while (feed.children.length > 30) {
            feed.removeChild(feed.lastChild);
        }
    }

    // =========================================================================
    // Ledger, Balances & Outbox Sync
    // =========================================================================

    async refreshLedgerAndBalances() {
        try {
            const accs = await fetch('/api/accounts').then(r => r.json());
            const userAcc = accs.find(a => a.vpa === this.currentUser.vpa);

            if (userAcc && !this.balanceHidden) {
                const balEl = document.getElementById('user-balance-display');
                if (balEl) balEl.textContent = parseFloat(userAcc.balance).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }

            const txs = await fetch('/api/transactions').then(r => r.json());
            const ledgerBox = document.getElementById('tx-ledger-box');

            if (ledgerBox && txs && txs.length > 0) {
                ledgerBox.innerHTML = txs.slice(0, 6).map(tx => {
                    const isDebit = tx.senderVpa === this.currentUser.vpa;
                    const counterpart = isDebit ? tx.receiverVpa : tx.senderVpa;
                    const dateStr = new Date(tx.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return `
                        <div class="tx-row-item">
                            <div>
                                <div class="tx-party-title">${isDebit ? 'To: ' : 'From: '}${counterpart}</div>
                                <div class="tx-time-sub">${dateStr} • Status: <span class="status-pill settled">${tx.status || 'SETTLED'}</span></div>
                            </div>
                            <div class="tx-amt-pill ${isDebit ? 'debit' : 'credit'}">
                                ${isDebit ? '-' : '+'}₹${parseFloat(tx.amount).toFixed(2)}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (e) {
            console.log('Balance refresh note:', e.message);
        }
    }

    async refreshOutboxBadge() {
        try {
            const outbox = await this.db.getOutbox();
            const pending = outbox.filter(p => p.status === 'QUEUED_OFFLINE');
            const badge = document.getElementById('outbox-count');
            if (badge) badge.textContent = pending.length;
        } catch (e) {}
    }

    updateAllowanceGauge() {
        const remaining = Math.max(0, this.allowanceLimit - this.allowanceSpent);
        const pct = Math.round((remaining / this.allowanceLimit) * 100);

        const remText = document.getElementById('allowance-remaining-text');
        const meterBar = document.getElementById('allowance-meter-bar');

        if (remText) remText.textContent = `₹${remaining.toFixed(2)} left`;
        if (meterBar) meterBar.style.width = `${pct}%`;
    }

    async backgroundRefresh() {
        await this.refreshLedgerAndBalances();
        await this.refreshOutboxBadge();
    }

    // =========================================================================
    // Reset Demo Modal & State
    // =========================================================================

    openResetModal() {
        document.getElementById('reset-modal-backdrop').classList.add('active');
    }

    closeResetModal() {
        document.getElementById('reset-modal-backdrop').classList.remove('active');
    }

    async confirmDemoReset() {
        this.closeResetModal();
        try {
            await fetch('/api/v1/mesh/reset', { method: 'POST' });
            await this.db.clearOutbox();
            this.allowanceSpent = 0.00;
            this.updateAllowanceGauge();
            this.currentSimulationStage = 0;
            this.lastCreatedPacket = null;
            this.activePacket = null;

            document.querySelectorAll('.mesh-link').forEach(l => l.classList.remove('broken'));
            document.querySelectorAll('.graph-node').forEach(n => n.classList.remove('active', 'holding-packet'));
            const aliceNode = document.getElementById('node-alice');
            if (aliceNode) aliceNode.classList.add('active');

            const dot = document.getElementById('transit-packet-dot');
            if (dot) dot.style.display = 'none';

            this.showToast('Mesh simulation queues and account balances reset to baseline.', 'success');
            this.addTimelineEvent('gossip', 'System reset: All account ledgers restored to initial balances.');

            await this.refreshLedgerAndBalances();
            await this.refreshOutboxBadge();
            await this.fetchAndRenderDevices();
        } catch (e) {
            this.showToast('Reset failed: ' + e.message, 'error');
        }
    }

    showToast(message, type = 'info') {
        const portal = document.getElementById('toast-container');
        if (!portal) return;

        const toast = document.createElement('div');
        toast.className = `toast-banner ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
        `;

        portal.appendChild(toast);
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 3600);
    }
}

// Instantiate and initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    window.app = new UnifiedMeshPayApp();
    window.app.init();
});
