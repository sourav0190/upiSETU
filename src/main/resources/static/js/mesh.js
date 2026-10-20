/**
 * MeshPay Device-to-Device BLE & P2P Network Simulator
 * Manages peer discovery, RSSI signal estimation, and transport errors.
 */

class MeshNetwork {
    constructor() {
        this.bluetoothEnabled = true;
        this.permissionGranted = true;
        this.allPeers = [
            { id: 'phone-alice', name: 'Alice Sharma', vpa: 'alice@demo', rssi: -52, dist: '0.8m', type: 'peer' },
            { id: 'phone-bob', name: 'Bob Verma (Merchant)', vpa: 'bob@demo', rssi: -58, dist: '1.2m', type: 'merchant' },
            { id: 'phone-carol', name: 'Carol Patel', vpa: 'carol@demo', rssi: -72, dist: '3.5m', type: 'peer' },
            { id: 'phone-dave', name: 'Dave Singh', vpa: 'dave@demo', rssi: -85, dist: '6.1m', type: 'peer' },
            { id: 'phone-bridge', name: 'Metro Bridge Node (4G)', vpa: 'bridge@demo', rssi: -64, dist: '2.0m', type: 'bridge' }
        ];
    }

    /**
     * Scan for nearby BLE peers, excluding the current user's VPA.
     */
    async scanForPeers(excludeVpa = '') {
        if (!this.bluetoothEnabled) {
            throw new Error('BLUETOOTH_DISABLED: Turn on Bluetooth to discover nearby devices.');
        }
        if (!this.permissionGranted) {
            throw new Error('PERMISSION_DENIED: Nearby Devices permission is required.');
        }

        // Simulate 400ms discovery delay
        await new Promise(r => setTimeout(r, 400));

        // Filter out self
        const available = this.allPeers.filter(p => p.vpa !== excludeVpa);

        // Randomize RSSI slightly for realistic physical simulation
        return available.map(p => ({
            ...p,
            rssi: p.rssi + Math.floor(Math.random() * 5 - 2)
        }));
    }

    /**
     * Transfer an encrypted packet directly to a peer via simulated BLE GATT connection.
     */
    async transferPacketToPeer(peerId, packet) {
        if (!this.bluetoothEnabled) {
            throw new Error('BLUETOOTH_DISABLED');
        }

        // Simulate connection handshake & packet transmission
        await new Promise(r => setTimeout(r, 600));

        // Inject packet into server mesh state so other devices & bridges can gossip it
        try {
            await fetch('/api/demo/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderVpa: packet.instruction ? packet.instruction.senderVpa : 'alice@demo',
                    receiverVpa: packet.instruction ? packet.instruction.receiverVpa : 'bob@demo',
                    amount: packet.instruction ? packet.instruction.amount : 100,
                    pin: '1234',
                    ttl: 5,
                    startDevice: peerId
                })
            });
        } catch (e) {
            console.log('Server mesh simulation sync (offline client):', e.message);
        }

        return {
            status: 'RECEIVED_LOCALLY',
            peerId: peerId,
            transferredAt: Date.now()
        };
    }
}

window.meshNetwork = new MeshNetwork();
