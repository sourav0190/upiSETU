/**
 * MeshPay Main Application Controller & UI Router
 * Orchestrates navigation, keypad, offline queue, sync engine, and soundbox synthesis.
 */

class MeshApp {
    constructor() {
        this.currentScreen = 'home';
        this.currentUser = {
            vpa: 'alice@demo',
            name: 'Alice Sharma',
            phone: '+91 98765 43210'
        };
        this.isOnline = true;
        this.balanceHidden = false;

        // Payment flow state
        this.selectedPeer = null;
        this.keypadAmount = '';
        this.enteredPin = '';
        this.paymentNote = '';

        // Wallet data
        this.wallet = {
            balance: 5000.00,
            offlineAllowanceLimit: 2000.00,
            offlineAllowanceSpent: 0.00,
            availableOfflineAllowance: 2000.00
        };

        this.transactions = [];
        this.outbox = [];
        this.theme = localStorage.getItem('meshpay_theme') || 'dark';
    }

    async init() {
        // Apply theme
        document.documentElement.setAttribute('data-theme', this.theme);

        // Default to the easy visual walkthrough on startup
        this.navigate('easy-demo');
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) bottomNav.style.display = 'none';

        // Initialize Crypto and DB
        await window.meshCrypto.init();
        await window.meshDB.init();

        // Load Initial Data
        await this.refreshData();

        // Setup Event Listeners
        this.setupEventListeners();

        // Start Periodic Polling (every 4 seconds)
        setInterval(() => this.backgroundSync(), 4000);
    }

    setupEventListeners() {
        // Theme toggle
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Network toggle pill (simulates going into a basement without 4G)
        const netPill = document.getElementById('network-status-pill');
        if (netPill) {
            netPill.addEventListener('click', () => this.toggleNetwork());
        }

        // Eye balance toggle
        const eyeBtn = document.getElementById('toggle-balance-eye');
        if (eyeBtn) {
            eyeBtn.addEventListener('click', () => this.toggleBalanceVisibility());
        }
    }

    navigate(screenId) {
        this.currentScreen = screenId;

        // Update active class on screen divs
        document.querySelectorAll('.view-screen').forEach(el => {
            el.classList.remove('active');
        });
        const targetScreen = document.getElementById(`screen-${screenId}`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        // Update active class on bottom nav items
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.screen === screenId) {
                el.classList.add('active');
            }
        });

        // Hide/show bottom nav depending on screen
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = (screenId === 'onboarding') ? 'none' : 'flex';
        }

        // Trigger screen-specific hooks
        if (screenId === 'home') this.renderHome();
        if (screenId === 'pay') this.initPayScreen();
        if (screenId === 'receive') this.renderReceiveScreen();
        if (screenId === 'history') this.renderHistory();
        if (screenId === 'sync') this.renderSyncCentre();
        if (screenId === 'profile') this.renderProfile();
    }

    // =========================================================================
    // Data Sync & Wallet State
    // =========================================================================

    async refreshData() {
        // Fetch wallet & accounts from backend if online
        if (this.isOnline) {
            try {
                const res = await fetch(`/api/v1/wallet?vpa=${this.currentUser.vpa}`);
                if (res.ok) {
                    const data = await res.json();
                    this.wallet.balance = parseFloat(data.balance);
                    this.wallet.offlineAllowanceLimit = parseFloat(data.offlineAllowanceLimit);
                    this.wallet.offlineAllowanceSpent = parseFloat(data.offlineAllowanceSpent);
                    this.wallet.availableOfflineAllowance = parseFloat(data.availableOfflineAllowance);
                }

                // Fetch settled transactions
                const txRes = await fetch(`/api/v1/transactions?vpa=${this.currentUser.vpa}`);
                if (txRes.ok) {
                    this.transactions = await txRes.json();
                }
            } catch (err) {
                console.warn('Backend unavailable, using local cache:', err.message);
            }
        }

        // Refresh local outbox from IndexedDB
        this.outbox = await window.meshDB.getOutbox();

        // Update badge counts
        this.updateSyncBadge();

        // Re-render active view
        if (this.currentScreen === 'home') this.renderHome();
    }

    updateSyncBadge() {
        const badge = document.getElementById('pending-sync-badge');
        const count = this.outbox.filter(p => p.status === 'QUEUED_OFFLINE' || p.status === 'RECEIVED_LOCALLY').length;
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('meshpay_theme', this.theme);
        this.showToast(`Switched to ${this.theme} mode`, 'theme');
    }

    toggleNetwork() {
        this.isOnline = !this.isOnline;
        const pill = document.getElementById('network-status-pill');
        if (pill) {
            pill.className = `network-pill ${this.isOnline ? 'online' : 'offline'}`;
            pill.innerHTML = `
                <span class="pulse-dot"></span>
                <span>${this.isOnline ? '🌐 Online (4G)' : '🚫 Offline (Basement)'}</span>
            `;
        }
        this.showToast(
            this.isOnline ? 'Connected to cellular 4G network' : 'Entered offline basement mode (DTN mesh active)',
            this.isOnline ? 'online' : 'offline'
        );

        if (this.isOnline) {
            this.triggerAutoSync();
        }
    }

    toggleBalanceVisibility() {
        this.balanceHidden = !this.balanceHidden;
        const balanceEl = document.getElementById('home-balance-amount');
        const eyeIcon = document.getElementById('eye-icon-path');
        if (balanceEl) {
            balanceEl.textContent = this.balanceHidden ? '••••••' : `₹${this.wallet.balance.toFixed(2)}`;
        }
    }

    // =========================================================================
    // Screen B: Home Dashboard
    // =========================================================================

    renderHome() {
        const balanceEl = document.getElementById('home-balance-amount');
        if (balanceEl) {
            balanceEl.textContent = this.balanceHidden ? '••••••' : `₹${this.wallet.balance.toFixed(2)}`;
        }

        const availableAllowanceEl = document.getElementById('home-available-allowance');
        if (availableAllowanceEl) {
            availableAllowanceEl.textContent = `₹${this.wallet.availableOfflineAllowance.toFixed(2)}`;
        }

        const fillEl = document.getElementById('allowance-fill-bar');
        if (fillEl) {
            const pct = Math.min(100, (this.wallet.availableOfflineAllowance / this.wallet.offlineAllowanceLimit) * 100);
            fillEl.style.width = `${pct}%`;
        }

        // Render Recent Transactions (Top 4)
        const recentList = document.getElementById('home-recent-txs');
        if (recentList) {
            const allTxs = [
                ...this.outbox.map(p => ({
                    id: p.packetId.substring(0, 8),
                    senderVpa: p.instruction.senderVpa,
                    receiverVpa: p.instruction.receiverVpa,
                    amount: p.instruction.amount,
                    status: p.status,
                    settledAt: p.createdAt,
                    isLocal: true,
                    fullPacket: p
                })),
                ...this.transactions.map(t => ({
                    ...t,
                    isLocal: false
                }))
            ];

            if (allTxs.length === 0) {
                recentList.innerHTML = `
                    <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">
                        No transactions recorded yet.<br>Tap 'Pay Nearby' to test an offline payment.
                    </div>
                `;
            } else {
                recentList.innerHTML = allTxs.slice(0, 4).map(tx => this._renderTxRow(tx)).join('');
            }
        }
    }

    // =========================================================================
    // Screen C: Pay Nearby Journey
    // =========================================================================

    async initPayScreen() {
        this.selectedPeer = null;
        this.keypadAmount = '';
        this.paymentNote = '';
        this.enteredPin = '';

        document.getElementById('pay-step-discovery').style.display = 'block';
        document.getElementById('pay-step-keypad').style.display = 'none';
        document.getElementById('pay-step-success').style.display = 'none';

        // Scan for BLE peers
        const peerListContainer = document.getElementById('nearby-peers-list');
        peerListContainer.innerHTML = `
            <div style="text-align: center; padding: 14px; color: var(--text-muted); font-size: 0.85rem;">
                Scanning 2.4GHz BLE advertising spectrum...
            </div>
        `;

        try {
            const peers = await window.meshNetwork.scanForPeers();
            peerListContainer.innerHTML = peers.map(p => `
                <div class="peer-card" onclick="window.app.selectPeer('${p.id}', '${p.name}', '${p.vpa}')">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="tx-avatar" style="background: var(--brand-surface); color: var(--brand-primary);">
                            ${p.name.charAt(0)}
                        </div>
                        <div>
                            <div style="font-size: 0.9rem; font-weight: 600;">${p.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${p.vpa}</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge badge-settled" style="font-size: 0.65rem;">${p.dist}</span>
                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${p.rssi} dBm</div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            peerListContainer.innerHTML = `
                <div style="padding: 16px; background: rgba(220, 38, 38, 0.1); border-radius: var(--radius-md); color: var(--accent-red); font-size: 0.85rem;">
                    ⚠️ ${err.message}
                </div>
            `;
        }
    }

    selectPeer(peerId, name, vpa) {
        this.selectedPeer = { id: peerId, name, vpa };
        document.getElementById('pay-step-discovery').style.display = 'none';
        document.getElementById('pay-step-keypad').style.display = 'block';

        document.getElementById('pay-recipient-name').textContent = name;
        document.getElementById('pay-recipient-vpa').textContent = vpa;
        this.updateKeypadDisplay();
    }

    keypadInput(char) {
        if (char === 'backspace') {
            this.keypadAmount = this.keypadAmount.slice(0, -1);
        } else if (char === '.') {
            if (!this.keypadAmount.includes('.')) {
                this.keypadAmount += (this.keypadAmount === '' ? '0.' : '.');
            }
        } else {
            if (this.keypadAmount.length < 8) {
                this.keypadAmount += char;
            }
        }
        this.updateKeypadDisplay();
    }

    addQuickAmount(amt) {
        const current = parseFloat(this.keypadAmount || '0');
        this.keypadAmount = (current + amt).toString();
        this.updateKeypadDisplay();
    }

    updateKeypadDisplay() {
        const displayEl = document.getElementById('pay-amount-display');
        const errorEl = document.getElementById('pay-amount-error');
        const payBtn = document.getElementById('pay-proceed-btn');

        const val = this.keypadAmount || '0';
        displayEl.textContent = `₹${val}`;

        const numeric = parseFloat(val);
        let error = null;

        if (numeric > this.wallet.balance) {
            error = `Exceeds total wallet balance (₹${this.wallet.balance.toFixed(2)})`;
        } else if (numeric > this.wallet.availableOfflineAllowance) {
            error = `Exceeds available offline allowance (₹${this.wallet.availableOfflineAllowance.toFixed(2)})`;
        } else if (numeric <= 0 && this.keypadAmount !== '') {
            error = 'Enter an amount greater than ₹0';
        }

        if (error) {
            errorEl.textContent = error;
            errorEl.style.display = 'block';
            payBtn.disabled = true;
        } else {
            errorEl.style.display = 'none';
            payBtn.disabled = (numeric <= 0 || isNaN(numeric));
        }
    }

    openPinModal() {
        this.enteredPin = '';
        this.updatePinDots();
        document.getElementById('pin-modal-backdrop').classList.add('active');
    }

    closePinModal() {
        document.getElementById('pin-modal-backdrop').classList.remove('active');
    }

    pinKeyInput(char) {
        if (char === 'backspace') {
            this.enteredPin = this.enteredPin.slice(0, -1);
        } else if (this.enteredPin.length < 4) {
            this.enteredPin += char;
        }
        this.updatePinDots();

        if (this.enteredPin.length === 4) {
            setTimeout(() => this.executeOfflinePayment(), 200);
        }
    }

    updatePinDots() {
        for (let i = 1; i <= 4; i++) {
            const dot = document.getElementById(`pin-dot-${i}`);
            if (dot) {
                dot.className = `pin-dot ${i <= this.enteredPin.length ? 'filled' : ''}`;
            }
        }
    }

    async executeOfflinePayment() {
        this.closePinModal();
        const amount = parseFloat(this.keypadAmount);

        this.showToast('Generating hybrid cryptographic envelope...', 'crypto');

        try {
            // 1. Hash PIN
            const pinHash = await window.meshCrypto.sha256Hex(this.enteredPin);

            // 2. Build payment instruction
            const nonce = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const instruction = {
                senderVpa: this.currentUser.vpa,
                receiverVpa: this.selectedPeer.vpa,
                amount: amount,
                pinHash: pinHash,
                nonce: nonce,
                signedAt: Date.now()
            };

            // 3. Encrypt with Web Crypto (RSA-OAEP + AES-256-GCM)
            const encrypted = await window.meshCrypto.encryptPayment(instruction);

            // 4. Wrap into MeshPacket
            const packet = {
                packetId: 'pkt_' + Math.random().toString(36).substring(2, 10),
                ttl: 5,
                createdAt: Date.now(),
                ciphertext: encrypted.ciphertext,
                packetHash: encrypted.packetHash,
                instruction: instruction,
                status: 'QUEUED_OFFLINE',
                peerId: this.selectedPeer.id,
                peerName: this.selectedPeer.name
            };

            // 5. Deduct from local offline allowance & persist in IndexedDB
            this.wallet.availableOfflineAllowance -= amount;
            this.wallet.offlineAllowanceSpent += amount;
            window.meshDB.addLocalAllowanceSpent(this.currentUser.vpa, amount);
            await window.meshDB.queuePacket(packet);

            // 6. Transmit to peer over simulated BLE
            await window.meshNetwork.transferPacketToPeer(this.selectedPeer.id, packet);
            await window.meshDB.updatePacketStatus(packet.packetId, 'RECEIVED_LOCALLY');
            packet.status = 'RECEIVED_LOCALLY';

            // 7. Render success screen
            this.renderPaymentSuccess(packet);

            // 8. If online, trigger immediate bridge upload
            if (this.isOnline) {
                this.triggerAutoSync();
            }

            // 9. Soundbox announcement synthesis
            this.announceSoundbox(amount, this.selectedPeer.name);

        } catch (err) {
            this.showToast(`Payment creation error: ${err.message}`, 'error');
        }
    }

    renderPaymentSuccess(packet) {
        document.getElementById('pay-step-keypad').style.display = 'none';
        document.getElementById('pay-step-success').style.display = 'block';

        document.getElementById('success-amount').textContent = `₹${packet.instruction.amount.toFixed(2)}`;
        document.getElementById('success-recipient').textContent = `To: ${packet.peerName} (${packet.instruction.receiverVpa})`;
        document.getElementById('success-packet-id').textContent = packet.packetId;
        document.getElementById('success-hash-preview').textContent = packet.packetHash.substring(0, 16) + '...';

        this.refreshData();
    }

    // =========================================================================
    // Screen D: Receive Payment & Soundbox
    // =========================================================================

    renderReceiveScreen() {
        document.getElementById('receive-vpa-text').textContent = this.currentUser.vpa;
        document.getElementById('receive-name-text').textContent = this.currentUser.name;

        // Dynamic QR code representation using public SVG generator or placeholder
        const qrContainer = document.getElementById('receive-qr-container');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div style="background: white; padding: 14px; border-radius: var(--radius-md); display: inline-block; box-shadow: var(--shadow-md);">
                    <svg width="180" height="180" viewBox="0 0 200 200" style="display: block;">
                        <rect width="200" height="200" fill="#ffffff"/>
                        <!-- QR Corner Markers -->
                        <rect x="20" y="20" width="45" height="45" fill="#0f172a" rx="4"/>
                        <rect x="28" y="28" width="29" height="29" fill="#ffffff" rx="2"/>
                        <rect x="34" y="34" width="17" height="17" fill="#0f172a"/>
                        
                        <rect x="135" y="20" width="45" height="45" fill="#0f172a" rx="4"/>
                        <rect x="143" y="28" width="29" height="29" fill="#ffffff" rx="2"/>
                        <rect x="149" y="34" width="17" height="17" fill="#0f172a"/>

                        <rect x="20" y="135" width="45" height="45" fill="#0f172a" rx="4"/>
                        <rect x="28" y="143" width="29" height="29" fill="#ffffff" rx="2"/>
                        <rect x="34" y="149" width="17" height="17" fill="#0f172a"/>

                        <!-- QR Simulated Data Pattern -->
                        <rect x="80" y="30" width="12" height="12" fill="#059669"/>
                        <rect x="100" y="40" width="14" height="14" fill="#0f172a"/>
                        <rect x="85" y="75" width="30" height="30" fill="#059669" rx="3"/>
                        <rect x="30" y="85" width="14" height="14" fill="#0f172a"/>
                        <rect x="145" y="90" width="24" height="24" fill="#0f172a"/>
                        <rect x="85" y="135" width="16" height="16" fill="#0f172a"/>
                        <rect x="120" y="145" width="20" height="20" fill="#059669"/>
                    </svg>
                </div>
            `;
        }
    }

    announceSoundbox(amount, recipient) {
        if ('speechSynthesis' in window) {
            try {
                const utterance = new SpeechSynthesisUtterance(`Payment of ${amount} rupees queued offline to ${recipient} on MeshPay`);
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            } catch (e) {
                console.log('Soundbox synthesis notice:', e);
            }
        }
    }

    // =========================================================================
    // Screen E: Transaction Details Modal
    // =========================================================================

    openTxDetails(tx) {
        document.getElementById('detail-amount').textContent = `₹${parseFloat(tx.amount).toFixed(2)}`;
        document.getElementById('detail-status-badge').textContent = tx.status;
        document.getElementById('detail-status-badge').className = `badge badge-${tx.status.toLowerCase()}`;

        document.getElementById('detail-sender').textContent = tx.senderVpa;
        document.getElementById('detail-receiver').textContent = tx.receiverVpa;
        document.getElementById('detail-packet-hash').textContent = tx.packetHash;
        document.getElementById('detail-tx-id').textContent = tx.id || 'Pending Settlement';
        document.getElementById('detail-bridge').textContent = tx.bridgeNodeId || 'P2P Gossip Relay';
        document.getElementById('detail-hops').textContent = tx.hopCount != null ? tx.hopCount : '1 hop';
        document.getElementById('detail-time').textContent = new Date(tx.signedAt || tx.settledAt).toLocaleString();

        document.getElementById('tx-detail-modal-backdrop').classList.add('active');
    }

    closeTxDetails() {
        document.getElementById('tx-detail-modal-backdrop').classList.remove('active');
    }

    // =========================================================================
    // Screen F: Transaction History
    // =========================================================================

    renderHistory() {
        const listEl = document.getElementById('history-list');
        const filter = document.querySelector('.filter-chip.active')?.dataset.filter || 'ALL';
        const query = (document.getElementById('history-search-input')?.value || '').toLowerCase();

        let all = [
            ...this.outbox.map(p => ({
                id: p.packetId.substring(0, 8),
                senderVpa: p.instruction.senderVpa,
                receiverVpa: p.instruction.receiverVpa,
                amount: p.instruction.amount,
                status: p.status,
                settledAt: p.createdAt,
                packetHash: p.packetHash,
                bridgeNodeId: 'Offline Mesh',
                hopCount: 1,
                isLocal: true,
                fullPacket: p
            })),
            ...this.transactions.map(t => ({
                ...t,
                isLocal: false
            }))
        ];

        // Apply filter
        if (filter !== 'ALL') {
            all = all.filter(t => t.status === filter);
        }

        // Apply search
        if (query) {
            all = all.filter(t =>
                t.senderVpa.toLowerCase().includes(query) ||
                t.receiverVpa.toLowerCase().includes(query) ||
                t.packetHash.toLowerCase().includes(query)
            );
        }

        if (all.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 0.85rem;">
                    No transactions match your filter criteria.
                </div>
            `;
        } else {
            listEl.innerHTML = all.map(t => this._renderTxRow(t)).join('');
        }
    }

    setHistoryFilter(filter, el) {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        this.renderHistory();
    }

    _renderTxRow(tx) {
        const isDebit = tx.senderVpa === this.currentUser.vpa;
        const counterpart = isDebit ? tx.receiverVpa : tx.senderVpa;
        const initial = counterpart.charAt(0).toUpperCase();

        return `
            <div class="tx-row" onclick='window.app.openTxDetails(${JSON.stringify(tx).replace(/'/g, "&#39;")})'>
                <div class="tx-left">
                    <div class="tx-avatar" style="${isDebit ? '' : 'background: var(--brand-surface); color: var(--brand-primary);'}">
                        ${initial}
                    </div>
                    <div class="tx-info">
                        <span class="tx-name">${counterpart}</span>
                        <span class="tx-subtext">${new Date(tx.settledAt || tx.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${tx.isLocal ? 'Offline Queue' : 'Ledger'}</span>
                    </div>
                </div>
                <div class="tx-right">
                    <span class="tx-amount ${isDebit ? 'debit' : 'credit'}">
                        ${isDebit ? '-' : '+'}₹${parseFloat(tx.amount).toFixed(2)}
                    </span>
                    <span class="badge badge-${tx.status.toLowerCase()}">
                        ${tx.status}
                    </span>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // Screen G: Sync Centre
    // =========================================================================

    async renderSyncCentre() {
        const listEl = document.getElementById('sync-outbox-list');
        const outbox = await window.meshDB.getOutbox();
        const pending = outbox.filter(p => p.status === 'QUEUED_OFFLINE' || p.status === 'RECEIVED_LOCALLY');

        document.getElementById('sync-pending-count').textContent = pending.length;
        document.getElementById('sync-connection-status').textContent = this.isOnline ? 'Online (4G / Wi-Fi)' : 'Offline (No Internet)';

        if (pending.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">
                    ✅ Local queue is completely clean and reconciled with server.
                </div>
            `;
        } else {
            listEl.innerHTML = pending.map(p => `
                <div class="card" style="padding: 12px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-family: var(--font-mono); font-size: 0.8rem; font-weight: 600;">${p.packetId}</span>
                        <span class="badge badge-queued">${p.status}</span>
                    </div>
                    <div style="font-size: 0.85rem; margin-top: 4px;">
                        ₹${p.instruction.amount.toFixed(2)} → ${p.instruction.receiverVpa}
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono); word-break: break-all; margin-top: 4px;">
                        Hash: ${p.packetHash.substring(0, 32)}...
                    </div>
                </div>
            `).join('');
        }
    }

    async triggerManualSync() {
        if (!this.isOnline) {
            this.showToast('Cannot sync while in offline basement mode. Reconnect first.', 'error');
            return;
        }

        const outbox = await window.meshDB.getOutbox();
        const pending = outbox.filter(p => p.status === 'QUEUED_OFFLINE' || p.status === 'RECEIVED_LOCALLY');

        if (pending.length === 0) {
            // Also trigger server mesh flush to reconcile stranger bridge nodes
            try {
                await fetch('/api/mesh/flush', { method: 'POST' });
                this.showToast('Triggered bridge node 4G flush and reconciliation.', 'success');
                await this.refreshData();
                this.renderSyncCentre();
            } catch (e) {
                this.showToast('No pending packets to sync.', 'info');
            }
            return;
        }

        this.showToast(`Syncing ${pending.length} packet(s) to central bank ledger...`, 'sync');

        try {
            const batchPayload = {
                bridgeNodeId: 'phone-alice-reconnect',
                packets: pending.map(p => ({
                    packetId: p.packetId,
                    ttl: p.ttl,
                    createdAt: p.createdAt,
                    ciphertext: p.ciphertext
                }))
            };

            const res = await fetch('/api/v1/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batchPayload)
            });

            if (res.ok) {
                const result = await res.json();
                this.showToast(`Sync complete: ${result.settledCount} settled, ${result.duplicateCount} duplicate(s) dropped`, 'success');

                // Mark reconciled in IndexedDB
                for (const p of pending) {
                    await window.meshDB.updatePacketStatus(p.packetId, 'SETTLED');
                }

                await this.refreshData();
                this.renderSyncCentre();
            }
        } catch (err) {
            this.showToast(`Sync error: ${err.message}`, 'error');
        }
    }

    async backgroundSync() {
        if (this.isOnline) {
            const outbox = await window.meshDB.getOutbox();
            const pending = outbox.filter(p => p.status === 'QUEUED_OFFLINE' || p.status === 'RECEIVED_LOCALLY');
            if (pending.length > 0) {
                this.triggerManualSync();
            }
        }
    }

    triggerAutoSync() {
        setTimeout(() => this.triggerManualSync(), 600);
    }

    // =========================================================================
    // Screen H: Profile & Settings
    // =========================================================================

    renderProfile() {
        document.getElementById('profile-name').textContent = this.currentUser.name;
        document.getElementById('profile-vpa').textContent = this.currentUser.vpa;
        document.getElementById('profile-phone').textContent = this.currentUser.phone;

        document.getElementById('profile-allowance-cap').textContent = `₹${this.wallet.offlineAllowanceLimit.toFixed(2)}`;
        document.getElementById('profile-allowance-spent').textContent = `₹${this.wallet.offlineAllowanceSpent.toFixed(2)}`;
    }

    openResetModal() {
        document.getElementById('reset-modal-backdrop').classList.add('active');
    }

    closeResetModal() {
        document.getElementById('reset-modal-backdrop').classList.remove('active');
    }

    async confirmDemoReset() {
        this.closeResetModal();
        try {
            await fetch('/api/mesh/reset', { method: 'POST' });
            await window.meshDB.clearOutbox();
            window.meshDB.resetLocalAllowanceSpent(this.currentUser.vpa);

            this.wallet.offlineAllowanceSpent = 0.00;
            this.wallet.availableOfflineAllowance = this.wallet.offlineAllowanceLimit;

            this.showToast('Demo data, mesh state & local outbox cleared.', 'success');
            await this.refreshData();
            this.navigate('home');
        } catch (e) {
            this.showToast(`Reset error: ${e.message}`, 'error');
        }
    }

    // =========================================================================
    // Toast Notification System
    // =========================================================================

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <div class="toast-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'sync' ? '🔄' : 'ℹ️'}
            </div>
            <div style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary);">${message}</div>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    // =========================================================================
    // Easy Interactive Visual Walkthrough Controller
    // =========================================================================

    switchMainMode(mode) {
        const demoTab = document.getElementById('tab-easy-demo');
        const appTab = document.getElementById('tab-app-mode');
        const bottomNav = document.querySelector('.bottom-nav');

        if (mode === 'demo') {
            if (demoTab) demoTab.classList.add('active');
            if (appTab) appTab.classList.remove('active');
            if (bottomNav) bottomNav.style.display = 'none';
            this.navigate('easy-demo');
            this.updateDemoBalances();
        } else {
            if (appTab) appTab.classList.add('active');
            if (demoTab) demoTab.classList.remove('active');
            if (bottomNav) bottomNav.style.display = 'flex';
            this.navigate('home');
        }
    }

    async updateDemoBalances() {
        try {
            const accs = await fetch('/api/accounts').then(r => r.json());
            const alice = accs.find(a => a.vpa === 'alice@demo');
            const bob = accs.find(a => a.vpa === 'bob@demo');

            const aliceEl = document.getElementById('demo-alice-balance');
            const bobEl = document.getElementById('demo-bob-balance');
            if (alice && aliceEl) aliceEl.textContent = `₹${parseFloat(alice.balance).toFixed(2)}`;
            if (bob && bobEl) bobEl.textContent = `₹${parseFloat(bob.balance).toFixed(2)}`;

            const state = await fetch('/api/mesh/state').then(r => r.json());
            const totalPackets = state.devices.reduce((acc, d) => acc + d.packetCount, 0);
            const packetsEl = document.getElementById('demo-mesh-packets');
            if (packetsEl) packetsEl.textContent = totalPackets;

            const txs = await fetch('/api/transactions').then(r => r.json());
            const settledEl = document.getElementById('demo-settled-count');
            if (settledEl) settledEl.textContent = txs.filter(t => t.status === 'SETTLED').length;
        } catch (e) {
            console.log('Error updating demo balances:', e.message);
        }
    }

    async executeDemoStep(step) {
        const storyEl = document.getElementById('demo-story-text');

        if (step === 1) {
            // Step 1: Alice creates & injects packet
            document.querySelectorAll('.walkthrough-step-card').forEach(c => c.classList.remove('completed'));
            document.getElementById('step-card-1').classList.add('completed');

            document.getElementById('node-alice').className = 'flow-node active has-packet';
            document.getElementById('connector-1').className = 'flow-connector active';
            document.getElementById('node-strangers').className = 'flow-node';
            document.getElementById('connector-2').className = 'flow-connector';
            document.getElementById('node-bridge').className = 'flow-node';
            document.getElementById('connector-3').className = 'flow-connector';
            document.getElementById('node-bank').className = 'flow-node';

            storyEl.innerHTML = `
                <strong>Step 1 (Offline Encryption):</strong> Alice enters ₹500 & PIN 1234 in the basement.
                Her phone generates a 256-bit AES key, encrypts the payment with AES-GCM, and encrypts the key with the Central Bank's RSA Public Key.
                Packet locked into an envelope and dropped into local mesh (TTL=5).
            `;

            // Trigger backend demo inject
            await fetch('/api/demo/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderVpa: 'alice@demo',
                    receiverVpa: 'bob@demo',
                    amount: 500.00,
                    pin: '1234',
                    ttl: 5,
                    startDevice: 'phone-alice'
                })
            });

            this.showToast('Step 1: Alice created & encrypted offline packet!', 'success');
            await this.updateDemoBalances();

        } else if (step === 2) {
            // Step 2: Mesh gossip round
            document.getElementById('step-card-2').classList.add('completed');

            document.getElementById('node-alice').className = 'flow-node';
            document.getElementById('connector-1').className = 'flow-connector active';
            document.getElementById('node-strangers').className = 'flow-node active has-packet';
            document.getElementById('connector-2').className = 'flow-connector active';
            document.getElementById('node-bridge').className = 'flow-node active has-packet';

            storyEl.innerHTML = `
                <strong>Step 2 (P2P Mesh Gossip):</strong> Nearby offline phones exchange packets over Bluetooth Low Energy.
                TTL decreases from 5 to 4. Strangers hold the locked envelope but <em>CANNOT read or modify</em> the payment!
            `;

            await fetch('/api/mesh/gossip', { method: 'POST' });
            this.showToast('Step 2: Packet hopped to nearby phones via BLE!', 'sync');
            await this.updateDemoBalances();

        } else if (step === 3) {
            // Step 3: Bridge node hits 4G
            document.getElementById('step-card-3').classList.add('completed');

            document.getElementById('node-strangers').className = 'flow-node';
            document.getElementById('node-bridge').className = 'flow-node active has-packet';
            document.getElementById('connector-3').className = 'flow-connector active';
            document.getElementById('node-bank').className = 'flow-node active';

            storyEl.innerHTML = `
                <strong>Step 3 (Gateway Ingress):</strong> The bridge node walks outside the basement into 4G LTE coverage.
                It automatically detects internet connectivity and sends an HTTPS POST to <code>/api/bridge/ingest</code>.
            `;

            this.showToast('Step 3: Bridge node detected 4G coverage!', 'online');
            await this.updateDemoBalances();

        } else if (step === 4) {
            // Step 4: Bank settles
            document.getElementById('step-card-4').classList.add('completed');

            document.getElementById('node-bridge').className = 'flow-node';
            document.getElementById('connector-3').className = 'flow-connector active';
            document.getElementById('node-bank').className = 'flow-node active has-packet';

            storyEl.innerHTML = `
                <strong>Step 4 (ACID Settlement):</strong> Central Bank receives the packet!
                <br>1. Checks SHA-256(ciphertext) to drop duplicate uploads with 0 decryption cost.
                <br>2. Decrypts with RSA Private Key & verifies PIN hash.
                <br>3. Debits ₹500 from Alice and credits ₹500 to Bob atomically. <strong>SETTLED!</strong>
            `;

            await fetch('/api/mesh/flush', { method: 'POST' });

            this.announceSoundbox(500, 'Bob Verma');
            this.showToast('Step 4: Central Bank settled ₹500 on ledger!', 'success');
            await this.updateDemoBalances();
        }
    }

    async runAutoDemo() {
        const btn = document.getElementById('btn-auto-demo');
        if (btn) btn.disabled = true;

        await this.resetDemoFlow();
        await new Promise(r => setTimeout(r, 600));

        await this.executeDemoStep(1);
        await new Promise(r => setTimeout(r, 2600));

        await this.executeDemoStep(2);
        await new Promise(r => setTimeout(r, 2600));

        await this.executeDemoStep(3);
        await new Promise(r => setTimeout(r, 2600));

        await this.executeDemoStep(4);

        if (btn) btn.disabled = false;
    }

    async resetDemoFlow() {
        try {
            await fetch('/api/mesh/reset', { method: 'POST' });
            document.querySelectorAll('.walkthrough-step-card').forEach(c => c.classList.remove('completed'));
            document.getElementById('connector-1').className = 'flow-connector';
            document.getElementById('connector-2').className = 'flow-connector';
            document.getElementById('connector-3').className = 'flow-connector';
            document.getElementById('node-alice').className = 'flow-node active has-packet';
            document.getElementById('node-strangers').className = 'flow-node';
            document.getElementById('node-bridge').className = 'flow-node';
            document.getElementById('node-bank').className = 'flow-node';

            const storyEl = document.getElementById('demo-story-text');
            if (storyEl) {
                storyEl.innerHTML = `
                    Reset complete! Tap <strong>"▶️ Auto-Play 1-Click Demo"</strong> or tap Step 1 to begin.
                `;
            }
            this.showToast('Demo state and mesh cache reset.', 'info');
            await this.updateDemoBalances();
        } catch (e) {
            console.log('Reset error:', e.message);
        }
    }
}

window.app = new MeshApp();
document.addEventListener('DOMContentLoaded', () => window.app.init());
