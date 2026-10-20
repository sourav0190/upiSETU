const KNOWN_ACCOUNTS = {
    'alice': { vpa: 'alice@demo', name: 'Alice Sharma', phone: '+91 98765 43210', initialBalance: 5000.00, initials: 'AS' },
    'bob': { vpa: 'bob@demo', name: 'Bob Verma (Merchant)', phone: '+91 91234 56789', initialBalance: 1000.00, initials: 'BV' },
    'carol': { vpa: 'carol@demo', name: 'Carol Patel', phone: '+91 99887 76655', initialBalance: 2500.00, initials: 'CP' },
    'dave': { vpa: 'dave@demo', name: 'Dave Singh', phone: '+91 94567 12340', initialBalance: 500.00, initials: 'DS' }
};

class MeshApp {
    constructor() {
        this.currentScreen = 'easy-demo';

        // Detect active demo identity from URL query param (?user=bob) or local storage
        const urlParams = new URLSearchParams(window.location.search);
        const userKey = (urlParams.get('user') || localStorage.getItem('meshpay_active_user') || 'alice').toLowerCase();
        const profile = KNOWN_ACCOUNTS[userKey] || KNOWN_ACCOUNTS['alice'];

        this.userKey = userKey in KNOWN_ACCOUNTS ? userKey : 'alice';
        this.currentUser = {
            vpa: profile.vpa,
            name: profile.name,
            phone: profile.phone,
            initials: profile.initials
        };
        this.isOnline = true;
        this.balanceHidden = false;

        // Payment flow state
        this.selectedPeer = null;
        this.keypadAmount = '';
        this.enteredPin = '';
        this.paymentNote = '';
        this.historyFilter = 'ALL';
        this.lastSeenTxCount = 0;

        // Wallet data
        this.wallet = {
            balance: profile.initialBalance,
            offlineAllowanceLimit: 2000.00,
            offlineAllowanceSpent: 0.00,
            availableOfflineAllowance: 2000.00
        };

        this.transactions = [];
        this.outbox = [];
        this.theme = localStorage.getItem('meshpay_theme') || 'dark';
    }

    async init() {
        // Apply saved theme
        document.documentElement.setAttribute('data-theme', this.theme);

        // Sync header dropdown to active user
        const selectEl = document.getElementById('user-profile-select');
        if (selectEl) {
            selectEl.value = this.userKey;
        }

        // If URL explicitly requests a screen, navigate there
        const urlParams = new URLSearchParams(window.location.search);
        const screenParam = urlParams.get('screen');
        if (screenParam) {
            this.navigate(screenParam);
        } else {
            this.navigate('easy-demo');
        }

        // Initialize Web Crypto and IndexedDB
        if (window.meshCrypto) await window.meshCrypto.init();
        if (window.meshDB) await window.meshDB.init();

        // Load Initial Data from backend/DB
        await this.refreshData();

        // Setup Event Listeners
        this.setupEventListeners();

        // Update Simulator balances
        await this.updateDemoBalances();

        // Start Periodic Polling (every 3 seconds)
        setInterval(() => this.backgroundSync(), 3000);
    }

    switchUser(key) {
        localStorage.setItem('meshpay_active_user', key);
        const url = new URL(window.location);
        url.searchParams.set('user', key);
        url.searchParams.set('screen', 'home');
        window.location.href = url.toString();
    }

    setupEventListeners() {
        // Theme toggle button
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Network toggle pill (simulates 4G vs basement)
        const netPill = document.getElementById('network-status-pill');
        if (netPill) {
            netPill.addEventListener('click', () => this.toggleNetwork());
        }

        // Balance eye visibility toggle
        const eyeBtn = document.getElementById('toggle-balance-eye');
        if (eyeBtn) {
            eyeBtn.addEventListener('click', () => this.toggleBalanceVisibility());
        }
    }

    navigate(screenId) {
        this.currentScreen = screenId;

        // Update active class on screen sections
        document.querySelectorAll('.view-screen').forEach(el => {
            el.classList.remove('active');
        });
        const targetScreen = document.getElementById(`screen-${screenId}`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        // Update active class on mobile bottom nav
        document.querySelectorAll('.nav-tab-item').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.screen === screenId) {
                el.classList.add('active');
            }
        });

        // Trigger screen-specific render hooks
        if (screenId === 'home') this.renderHome();
        if (screenId === 'pay') this.initPayScreen();
        if (screenId === 'receive') this.renderReceiveScreen();
        if (screenId === 'history') this.renderHistory();
        if (screenId === 'sync') this.renderSyncCentre();
        if (screenId === 'profile') this.renderProfile();
        if (screenId === 'easy-demo') this.updateDemoBalances();
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

                    // Automatic soundbox notification when a payment is received from another phone!
                    if (this.lastSeenTxCount > 0 && this.transactions.length > this.lastSeenTxCount) {
                        const latestTx = this.transactions[0];
                        if (latestTx && latestTx.receiverVpa === this.currentUser.vpa) {
                            this.announceSoundbox(parseFloat(latestTx.amount), latestTx.senderVpa);
                            this.showToast(`Received ₹${parseFloat(latestTx.amount).toFixed(2)} from ${latestTx.senderVpa}`, 'success');
                            this.logDemoEvent(`Incoming settlement: Received ₹${parseFloat(latestTx.amount).toFixed(2)} from ${latestTx.senderVpa}`);
                        }
                    }
                    this.lastSeenTxCount = this.transactions.length;
                }
            } catch (err) {
                console.warn('Backend temporarily unavailable, using local cache:', err.message);
            }
        }

        // Refresh local outbox from IndexedDB
        if (window.meshDB) {
            this.outbox = await window.meshDB.getOutbox();
        }

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
            badge.style.display = count > 0 ? 'inline-block' : 'none';
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
            pill.className = `network-status-badge ${this.isOnline ? 'online' : 'offline'}`;
            pill.innerHTML = `
                <span class="pulse-indicator"></span>
                <span>${this.isOnline ? 'Online (4G)' : 'Offline (Basement)'}</span>
            `;
        }
        this.showToast(
            this.isOnline ? 'Connected to cellular 4G network' : 'Entered offline basement mode (DTN mesh active)',
            this.isOnline ? 'online' : 'offline'
        );

        this.logDemoEvent(this.isOnline ? 'Network restored: 4G LTE available' : 'Network disconnected: Offline BLE Mesh activated');

        if (this.isOnline) {
            this.triggerAutoSync();
        }
    }

    toggleBalanceVisibility() {
        this.balanceHidden = !this.balanceHidden;
        const balanceEl = document.getElementById('home-balance-amount');
        if (balanceEl) {
            balanceEl.textContent = this.balanceHidden ? '••••••' : this.wallet.balance.toFixed(2);
        }
    }

    // =========================================================================
    // Screen B: Home Dashboard
    // =========================================================================

    renderHome() {
        // Update greeting & identity
        const avatarEl = document.querySelector('.user-avatar-circle');
        if (avatarEl) avatarEl.textContent = this.currentUser.initials || 'AS';
        const nameEl = document.querySelector('.user-name-title');
        if (nameEl) nameEl.textContent = this.currentUser.name;
        const vpaChip = document.querySelector('.user-vpa-chip');
        if (vpaChip) vpaChip.textContent = this.currentUser.vpa;

        const balanceEl = document.getElementById('home-balance-amount');
        if (balanceEl) {
            balanceEl.textContent = this.balanceHidden ? '••••••' : this.wallet.balance.toFixed(2);
        }

        const availableAllowanceEl = document.getElementById('home-available-allowance');
        if (availableAllowanceEl) {
            availableAllowanceEl.textContent = `₹${this.wallet.availableOfflineAllowance.toFixed(2)}`;
        }

        const fillEl = document.getElementById('allowance-fill-bar');
        if (fillEl) {
            const pct = Math.min(100, Math.max(0, (this.wallet.availableOfflineAllowance / this.wallet.offlineAllowanceLimit) * 100));
            fillEl.style.width = `${pct}%`;
        }

        // Render Recent Transactions (Top 5)
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
                    <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); font-size: 0.85rem;">
                        No transactions recorded yet.<br>Click 'Pay Nearby' to initiate an offline payment.
                    </div>
                `;
            } else {
                recentList.innerHTML = allTxs.slice(0, 5).map(tx => this._renderTxRow(tx)).join('');
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
            <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">
                Scanning 2.4GHz BLE advertising spectrum for nearby peers...
            </div>
        `;

        try {
            const peers = await window.meshNetwork.scanForPeers(this.currentUser.vpa);
            peerListContainer.innerHTML = peers.map(p => `
                <div class="peer-candidate-card" onclick="window.app.selectPeer('${p.id}', '${p.name}', '${p.vpa}')">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="peer-avatar-bubble">
                            ${p.name.charAt(0)}
                        </div>
                        <div>
                            <div style="font-size: 0.92rem; font-weight: 700; color: var(--text-primary);">${p.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${p.vpa}</div>
                        </div>
                    </div>
                    <div class="peer-signal-meta">
                        <span class="status-pill settled">${p.dist}</span>
                        <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${p.rssi} dBm</span>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            peerListContainer.innerHTML = `
                <div style="padding: 16px; background: var(--accent-red-surface); border-radius: var(--radius-md); color: var(--accent-red); font-size: 0.85rem;">
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
            if (this.keypadAmount.length < 7) {
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
            error = `Amount exceeds total balance (₹${this.wallet.balance.toFixed(2)})`;
        } else if (numeric > this.wallet.availableOfflineAllowance) {
            error = `Exceeds available offline limit (₹${this.wallet.availableOfflineAllowance.toFixed(2)})`;
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
                dot.className = `pin-bubble-dot ${i <= this.enteredPin.length ? 'filled' : ''}`;
            }
        }
    }

    async executeOfflinePayment() {
        this.closePinModal();
        const amount = parseFloat(this.keypadAmount);

        this.showToast('Generating hybrid RSA-2048 + AES-256-GCM envelope...', 'crypto');

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

            this.logDemoEvent(`Payment created: ₹${amount.toFixed(2)} to ${this.selectedPeer.vpa} (Hash: ${encrypted.packetHash.substring(0, 12)}...)`);

        } catch (err) {
            this.showToast(`Payment creation error: ${err.message}`, 'error');
        }
    }

    renderPaymentSuccess(packet) {
        document.getElementById('pay-step-keypad').style.display = 'none';
        document.getElementById('pay-step-success').style.display = 'block';

        document.getElementById('success-amount').textContent = `₹${packet.instruction.amount.toFixed(2)}`;
        document.getElementById('success-recipient').textContent = `Recipient: ${packet.peerName} (${packet.instruction.receiverVpa})`;
        document.getElementById('success-packet-id').textContent = packet.packetId;
        document.getElementById('success-hash-preview').textContent = packet.packetHash.substring(0, 18) + '...';

        this.refreshData();
    }

    // =========================================================================
    // Screen D: Receive Payment & Soundbox
    // =========================================================================

    renderReceiveScreen() {
        document.getElementById('receive-vpa-text').textContent = this.currentUser.vpa;
        document.getElementById('receive-name-text').textContent = this.currentUser.name;

        // Render QR Code SVG
        const qrContainer = document.getElementById('receive-qr-container');
        if (qrContainer) {
            qrContainer.innerHTML = `
                <div style="background: white; padding: 16px; border-radius: var(--radius-md); display: inline-block; box-shadow: var(--shadow-md);">
                    <svg width="180" height="180" viewBox="0 0 200 200" style="display: block;">
                        <!-- QR Pattern representation -->
                        <rect x="0" y="0" width="200" height="200" fill="#ffffff"/>
                        <!-- Corner 1 -->
                        <rect x="20" y="20" width="50" height="50" fill="#090e17"/>
                        <rect x="28" y="28" width="34" height="34" fill="#ffffff"/>
                        <rect x="36" y="36" width="18" height="18" fill="#090e17"/>
                        <!-- Corner 2 -->
                        <rect x="130" y="20" width="50" height="50" fill="#090e17"/>
                        <rect x="138" y="28" width="34" height="34" fill="#ffffff"/>
                        <rect x="146" y="36" width="18" height="18" fill="#090e17"/>
                        <!-- Corner 3 -->
                        <rect x="20" y="130" width="50" height="50" fill="#090e17"/>
                        <rect x="28" y="138" width="34" height="34" fill="#ffffff"/>
                        <rect x="36" y="146" width="18" height="18" fill="#090e17"/>
                        <!-- Data Dots -->
                        <rect x="85" y="25" width="12" height="12" fill="#090e17"/>
                        <rect x="105" y="45" width="12" height="12" fill="#090e17"/>
                        <rect x="85" y="65" width="12" height="12" fill="#090e17"/>
                        <rect x="40" y="85" width="12" height="12" fill="#090e17"/>
                        <rect x="65" y="85" width="12" height="12" fill="#090e17"/>
                        <rect x="95" y="95" width="14" height="14" fill="#059669"/>
                        <rect x="125" y="85" width="12" height="12" fill="#090e17"/>
                        <rect x="150" y="100" width="12" height="12" fill="#090e17"/>
                        <rect x="85" y="130" width="12" height="12" fill="#090e17"/>
                        <rect x="105" y="145" width="12" height="12" fill="#090e17"/>
                        <rect x="140" y="135" width="12" height="12" fill="#090e17"/>
                        <rect x="160" y="155" width="12" height="12" fill="#090e17"/>
                    </svg>
                </div>
            `;
        }
    }

    announceSoundbox(amount, sender) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const text = `MeshPay par ${amount} rupaye prapt hue. Verified offline.`;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.lang = 'hi-IN';
            window.speechSynthesis.speak(utterance);
        }
        this.showToast(`Soundbox: ₹${amount.toFixed(2)} received from ${sender}`, 'success');
    }

    // =========================================================================
    // Screen F: Transaction History
    // =========================================================================

    renderHistory() {
        const listEl = document.getElementById('history-list');
        const searchInput = document.getElementById('history-search-input');
        const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

        const allTxs = [
            ...this.outbox.map(p => ({
                id: p.packetId.substring(0, 8),
                senderVpa: p.instruction.senderVpa,
                receiverVpa: p.instruction.receiverVpa,
                amount: p.instruction.amount,
                status: p.status,
                settledAt: p.createdAt,
                isLocal: true,
                packetHash: p.packetHash,
                bridgeNodeId: 'BLE Mesh Relay',
                hopsTaken: 2,
                fullPacket: p
            })),
            ...this.transactions.map(t => ({
                ...t,
                isLocal: false
            }))
        ];

        let filtered = allTxs;

        // Apply Status Filter
        if (this.historyFilter !== 'ALL') {
            filtered = filtered.filter(t => t.status === this.historyFilter);
        }

        // Apply Search Query Filter
        if (query) {
            filtered = filtered.filter(t => 
                (t.senderVpa && t.senderVpa.toLowerCase().includes(query)) ||
                (t.receiverVpa && t.receiverVpa.toLowerCase().includes(query)) ||
                (t.packetHash && t.packetHash.toLowerCase().includes(query)) ||
                (t.id && t.id.toLowerCase().includes(query))
            );
        }

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; padding: 40px 16px; color: var(--text-muted); font-size: 0.88rem;">
                    No transactions match your current search or filter criteria.
                </div>
            `;
        } else {
            listEl.innerHTML = filtered.map(t => this._renderTxRow(t)).join('');
        }
    }

    setHistoryFilter(filter, el) {
        this.historyFilter = filter;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        if (el) el.classList.add('active');
        this.renderHistory();
    }

    _renderTxRow(tx) {
        const isDebit = tx.senderVpa === this.currentUser.vpa;
        const counterpart = isDebit ? tx.receiverVpa : tx.senderVpa;
        const initial = counterpart ? counterpart.charAt(0).toUpperCase() : 'T';
        const statusClass = (tx.status || 'settled').toLowerCase();

        return `
            <div class="tx-item-row" onclick='window.app.openTxDetails(${JSON.stringify(tx).replace(/'/g, "&#39;")})'>
                <div class="tx-party-group">
                    <div class="tx-initial-badge ${isDebit ? '' : 'credit'}">
                        ${initial}
                    </div>
                    <div class="tx-meta-col">
                        <span class="tx-party-name">${counterpart}</span>
                        <span class="tx-date-sub">${new Date(tx.settledAt || tx.signedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${tx.isLocal ? 'Offline Outbox' : 'Ledger Settled'}</span>
                    </div>
                </div>
                <div class="tx-amount-col">
                    <span class="tx-amount-num tabular-nums ${isDebit ? 'debit' : 'credit'}">
                        ${isDebit ? '-' : '+'}₹${parseFloat(tx.amount).toFixed(2)}
                    </span>
                    <span class="status-pill ${statusClass}">
                        ${tx.status}
                    </span>
                </div>
            </div>
        `;
    }

    openTxDetails(tx) {
        document.getElementById('detail-amount').textContent = `₹${parseFloat(tx.amount).toFixed(2)}`;
        const badge = document.getElementById('detail-status-badge');
        badge.className = `status-pill ${(tx.status || 'settled').toLowerCase()}`;
        badge.textContent = tx.status || 'SETTLED';

        document.getElementById('detail-sender').textContent = tx.senderVpa || 'alice@demo';
        document.getElementById('detail-receiver').textContent = tx.receiverVpa || 'bob@demo';
        document.getElementById('detail-tx-id').textContent = tx.id || 'N/A (Local Outbox)';
        document.getElementById('detail-bridge').textContent = tx.bridgeNodeId || 'phone-alice-reconnect';
        document.getElementById('detail-hops').textContent = `${tx.hopsTaken || 1} hops (Store-and-forward)`;
        document.getElementById('detail-time').textContent = new Date(tx.settledAt || tx.signedAt || Date.now()).toLocaleString();
        document.getElementById('detail-packet-hash').textContent = tx.packetHash || 'sha256_mock_hash_authenticated';

        document.getElementById('tx-detail-modal-backdrop').classList.add('active');
    }

    closeTxDetails() {
        document.getElementById('tx-detail-modal-backdrop').classList.remove('active');
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
                <div style="text-align: center; padding: 36px 16px; color: var(--text-muted); font-size: 0.88rem; background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
                    <div style="font-size: 1.8rem; margin-bottom: 8px;">✅</div>
                    <strong>Outbox Reconciled</strong>
                    <div style="font-size: 0.78rem; margin-top: 4px;">Local IndexedDB queue is completely synchronized with the central bank ledger.</div>
                </div>
            `;
        } else {
            listEl.innerHTML = pending.map(p => `
                <div style="background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; color: var(--text-primary);">${p.packetId}</span>
                        <span class="status-pill queued_offline">${p.status}</span>
                    </div>
                    <div style="font-size: 0.9rem; font-weight: 600; margin-top: 4px; color: var(--text-primary);">
                        ₹${p.instruction.amount.toFixed(2)} → ${p.instruction.receiverVpa}
                    </div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono); word-break: break-all; margin-top: 4px;">
                        Hash: ${p.packetHash.substring(0, 36)}...
                    </div>
                </div>
            `).join('');
        }
    }

    async triggerManualSync() {
        if (!this.isOnline) {
            this.showToast('Cannot sync in offline basement mode. Reconnect first.', 'error');
            return;
        }

        const outbox = await window.meshDB.getOutbox();
        const pending = outbox.filter(p => p.status === 'QUEUED_OFFLINE' || p.status === 'RECEIVED_LOCALLY');

        if (pending.length === 0) {
            try {
                await fetch('/api/mesh/flush', { method: 'POST' });
                this.showToast('Reconciled with central ledger gateway.', 'success');
                await this.refreshData();
                this.renderSyncCentre();
            } catch (e) {
                this.showToast('Outbox queue already empty.', 'info');
            }
            return;
        }

        this.showToast(`Syncing ${pending.length} envelope(s) to central bank...`, 'sync');

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
                this.showToast(`Settled: ${result.settledCount}, Duplicates dropped: ${result.duplicateCount}`, 'success');

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
    // Toast Notification System (With SVG Vector Icons)
    // =========================================================================

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast-alert-pill';

        let iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        if (type === 'success' || type === 'online') {
            iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--brand-primary)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
        } else if (type === 'error' || type === 'offline') {
            iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--accent-red)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        } else if (type === 'sync' || type === 'crypto') {
            iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--accent-blue)" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
        }

        toast.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center;">${iconSvg}</div>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => toast.remove(), 260);
        }, 3000);
    }

    logDemoEvent(msg) {
        const logContainer = document.getElementById('demo-event-log');
        if (!logContainer) return;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const entry = document.createElement('div');
        entry.className = 'log-entry-item';
        entry.innerHTML = `<span class="log-timestamp">[${timeStr}]</span><span>${msg}</span>`;
        logContainer.insertBefore(entry, logContainer.firstChild);
        while (logContainer.children.length > 8) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    // =========================================================================
    // Architecture Simulator Controller
    // =========================================================================

    switchMainMode(mode) {
        const demoTab = document.getElementById('tab-easy-demo');
        const appTab = document.getElementById('tab-app-mode');

        if (mode === 'demo') {
            if (demoTab) demoTab.classList.add('active');
            if (appTab) appTab.classList.remove('active');
            this.navigate('easy-demo');
            this.updateDemoBalances();
        } else {
            if (appTab) appTab.classList.add('active');
            if (demoTab) demoTab.classList.remove('active');
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
            // Stage 1: Alice creates & encrypts packet
            document.querySelectorAll('.stage-pill-card').forEach(c => c.classList.remove('completed'));
            const s1 = document.getElementById('step-card-1');
            if (s1) s1.classList.add('completed');

            document.getElementById('node-alice').className = 'node-box-item active has-packet';
            document.getElementById('connector-1').className = 'connector-rail-line active';
            document.getElementById('node-strangers').className = 'node-box-item';
            document.getElementById('connector-2').className = 'connector-rail-line';
            document.getElementById('node-bridge').className = 'node-box-item';
            document.getElementById('connector-3').className = 'connector-rail-line';
            document.getElementById('node-bank').className = 'node-box-item';

            storyEl.innerHTML = `
                <strong>Stage 1 (Offline Encryption):</strong> Alice enters ₹500 & PIN 1234 in the basement.
                Her phone generates a 256-bit AES key, encrypts the payment with AES-GCM, and encrypts the key with the Central Bank's RSA-2048 Public Key.
                Packet is locked into an envelope and dropped into local mesh (TTL=5).
            `;

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

            this.showToast('Stage 1: Offline RSA envelope generated & signed!', 'success');
            this.logDemoEvent('Stage 1: Signed ₹500 packet (TTL=5, RSA-OAEP + AES-GCM)');
            await this.updateDemoBalances();

        } else if (step === 2) {
            // Stage 2: Mesh gossip round
            const s2 = document.getElementById('step-card-2');
            if (s2) s2.classList.add('completed');

            document.getElementById('node-alice').className = 'node-box-item';
            document.getElementById('connector-1').className = 'connector-rail-line active';
            document.getElementById('node-strangers').className = 'node-box-item active has-packet';
            document.getElementById('connector-2').className = 'connector-rail-line active';
            document.getElementById('node-bridge').className = 'node-box-item active has-packet';

            storyEl.innerHTML = `
                <strong>Stage 2 (P2P Mesh Gossip):</strong> Nearby offline phones exchange packets over Bluetooth Low Energy.
                TTL decreases from 5 to 4. Intermediate devices hold the locked envelope but <em>CANNOT read or modify</em> the payment!
            `;

            await fetch('/api/mesh/gossip', { method: 'POST' });
            this.showToast('Stage 2: Packet relayed through BLE gossip hops!', 'sync');
            this.logDemoEvent('Stage 2: BLE Gossip relay round complete (TTL decremented to 4)');
            await this.updateDemoBalances();

        } else if (step === 3) {
            // Stage 3: Bridge phone hits 4G
            const s3 = document.getElementById('step-card-3');
            if (s3) s3.classList.add('completed');

            document.getElementById('node-strangers').className = 'node-box-item';
            document.getElementById('node-bridge').className = 'node-box-item active has-packet';
            document.getElementById('connector-3').className = 'connector-rail-line active';
            document.getElementById('node-bank').className = 'node-box-item active';

            storyEl.innerHTML = `
                <strong>Stage 3 (Gateway Ingress):</strong> The bridge device walks outside the basement into 4G LTE coverage.
                It detects cellular connectivity and automatically sends an HTTPS POST to the bank gateway at <code>/api/bridge/ingest</code>.
            `;

            this.showToast('Stage 3: Bridge device connected to 4G gateway!', 'online');
            this.logDemoEvent('Stage 3: Bridge node detected 4G, initiating HTTPS upload');
            await this.updateDemoBalances();

        } else if (step === 4) {
            // Stage 4: Bank settles
            const s4 = document.getElementById('step-card-4');
            if (s4) s4.classList.add('completed');

            document.getElementById('node-bridge').className = 'node-box-item';
            document.getElementById('connector-3').className = 'connector-rail-line active';
            document.getElementById('node-bank').className = 'node-box-item active has-packet';

            storyEl.innerHTML = `
                <strong>Stage 4 (ACID Settlement):</strong> Central Bank receives the packet:
                <br>1. Checks SHA-256(ciphertext) to drop duplicate uploads without decryption.
                <br>2. Decrypts with RSA-2048 Private Key & verifies PIN hash.
                <br>3. Debits ₹500 from Alice and credits ₹500 to Bob atomically. <strong>SETTLED!</strong>
            `;

            await fetch('/api/mesh/flush', { method: 'POST' });

            this.announceSoundbox(500, 'Bob Verma');
            this.showToast('Stage 4: Central Bank settled ₹500 on ledger!', 'success');
            this.logDemoEvent('Stage 4: ACID settlement complete. ₹500 credited to bob@demo');
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
            document.querySelectorAll('.stage-pill-card').forEach(c => c.classList.remove('completed'));
            document.getElementById('connector-1').className = 'connector-rail-line';
            document.getElementById('connector-2').className = 'connector-rail-line';
            document.getElementById('connector-3').className = 'connector-rail-line';
            document.getElementById('node-alice').className = 'node-box-item active has-packet';
            document.getElementById('node-strangers').className = 'node-box-item';
            document.getElementById('node-bridge').className = 'node-box-item';
            document.getElementById('node-bank').className = 'node-box-item';

            const storyEl = document.getElementById('demo-story-text');
            if (storyEl) {
                storyEl.innerHTML = `
                    Reset complete! Click <strong>"▶️ Auto-Play Simulation"</strong> or click Stage 1 to begin.
                `;
            }
            this.showToast('Demo state and mesh cache reset.', 'info');
            this.logDemoEvent('Simulator reset to initial ledger state.');
            await this.updateDemoBalances();
        } catch (e) {
            console.log('Reset error:', e.message);
        }
    }
}

window.app = new MeshApp();
document.addEventListener('DOMContentLoaded', () => window.app.init());
