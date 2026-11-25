/**
 * MeshPay Persistent Local Storage Layer (IndexedDB / LocalStorage)
 * Ensures offline transactions and wallet balances survive device reboot & offline app reloads.
 */

class MeshDB {
    constructor() {
        this.dbName = 'meshpay_offline_db';
        this.version = 1;
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('outbox')) {
                    const outbox = db.createObjectStore('outbox', { keyPath: 'packetId' });
                    outbox.createIndex('createdAt', 'createdAt', { unique: false });
                    outbox.createIndex('status', 'status', { unique: false });
                }
                if (!db.objectStoreNames.contains('inbox')) {
                    const inbox = db.createObjectStore('inbox', { keyPath: 'packetId' });
                    inbox.createIndex('createdAt', 'createdAt', { unique: false });
                }
                if (!db.objectStoreNames.contains('wallet')) {
                    db.createObjectStore('wallet', { keyPath: 'vpa' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.warn('IndexedDB unavailable, falling back to localStorage:', event.target.error);
                resolve(null);
            };
        });
    }

    // --- Outbox (Pending Offline Transactions) ---

    async queuePacket(packetData) {
        await this.init();
        if (this.db) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('outbox', 'readwrite');
                const store = tx.objectStore('outbox');
                store.put(packetData);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
            });
        } else {
            const list = this._getFallback('outbox') || [];
            list.push(packetData);
            this._setFallback('outbox', list);
            return true;
        }
    }

    async getOutbox() {
        await this.init();
        if (this.db) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('outbox', 'readonly');
                const store = tx.objectStore('outbox');
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        } else {
            return this._getFallback('outbox') || [];
        }
    }

    async updatePacketStatus(packetId, status, details = {}) {
        await this.init();
        if (this.db) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('outbox', 'readwrite');
                const store = tx.objectStore('outbox');
                const req = store.get(packetId);
                req.onsuccess = () => {
                    const item = req.result;
                    if (item) {
                        item.status = status;
                        Object.assign(item, details);
                        store.put(item);
                    }
                    resolve(true);
                };
                req.onerror = () => reject(req.error);
            });
        } else {
            const list = this._getFallback('outbox') || [];
            const idx = list.findIndex(p => p.packetId === packetId);
            if (idx !== -1) {
                list[idx].status = status;
                Object.assign(list[idx], details);
                this._setFallback('outbox', list);
            }
            return true;
        }
    }

    async clearOutbox() {
        await this.init();
        if (this.db) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('outbox', 'readwrite');
                tx.objectStore('outbox').clear();
                tx.oncomplete = () => resolve(true);
            });
        } else {
            localStorage.removeItem('meshpay_outbox');
        }
    }

    // --- Local Wallet Allowance Cache ---

    getLocalAllowanceSpent(vpa) {
        return parseFloat(localStorage.getItem(`meshpay_allowance_${vpa}`) || '0.00');
    }

    addLocalAllowanceSpent(vpa, amount) {
        const current = this.getLocalAllowanceSpent(vpa);
        const updated = current + amount;
        localStorage.setItem(`meshpay_allowance_${vpa}`, updated.toFixed(2));
        return updated;
    }

    resetLocalAllowanceSpent(vpa) {
        localStorage.setItem(`meshpay_allowance_${vpa}`, '0.00');
    }

    _getFallback(key) {
        try {
            return JSON.parse(localStorage.getItem(`meshpay_${key}`));
        } catch (e) {
            return null;
        }
    }

    _setFallback(key, value) {
        localStorage.setItem(`meshpay_${key}`, JSON.stringify(value));
    }
}

window.meshDB = new MeshDB();
