package com.demo.upimesh.service;

import com.demo.upimesh.model.MeshPacket;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simulates the Bluetooth mesh and coordinates real-time multi-device synchronization.
 * Supports variable numbers of devices (N nodes), dynamic registration,
 * real-time internet toggles, and store-and-forward gossip routing.
 */
@Service
public class MeshSimulatorService {

    private static final Logger log = LoggerFactory.getLogger(MeshSimulatorService.class);

    private final Map<String, VirtualDevice> devices = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> topologyLinks = new ConcurrentHashMap<>();

    public MeshSimulatorService() {
        seedDefaultDevices();
        initTopologyLinks();
    }

    public void initTopologyLinks() {
        topologyLinks.clear();
        addLink("phone-alice", "phone-carol");
        addLink("phone-alice", "phone-bob");
        addLink("phone-bob", "phone-carol");
        addLink("phone-carol", "phone-dave");
        addLink("phone-dave", "phone-bridge");
        addLink("phone-dave", "phone-bob");

        // Stranger aliases for test compatibility
        addLink("phone-stranger1", "phone-stranger2");
        addLink("phone-stranger2", "phone-stranger3");
    }

    public void addLink(String dev1, String dev2) {
        topologyLinks.computeIfAbsent(dev1, k -> ConcurrentHashMap.newKeySet()).add(dev2);
        topologyLinks.computeIfAbsent(dev2, k -> ConcurrentHashMap.newKeySet()).add(dev1);
    }

    public void removeLink(String dev1, String dev2) {
        if (topologyLinks.containsKey(dev1)) topologyLinks.get(dev1).remove(dev2);
        if (topologyLinks.containsKey(dev2)) topologyLinks.get(dev2).remove(dev1);
    }

    public boolean areNeighbors(String dev1, String dev2) {
        if (dev1 == null || dev2 == null || dev1.equals(dev2)) return false;
        Set<String> neighbors = topologyLinks.get(dev1);
        if (neighbors != null && neighbors.contains(dev2)) return true;
        // If neither node has defined link constraints (custom ad-hoc nodes), allow peer discovery
        return !topologyLinks.containsKey(dev1) && !topologyLinks.containsKey(dev2);
    }

    public void seedDefaultDevices() {
        devices.clear();
        // Core Demonstration Cluster (5 sample devices)
        registerOrUpdateDevice("phone-alice", "Alice Sharma", "alice@demo", false, "SENDER");
        registerOrUpdateDevice("phone-bob", "Bob Verma (Merchant)", "bob@demo", false, "MERCHANT");
        registerOrUpdateDevice("phone-carol", "Carol Patel (Relay)", "carol@demo", false, "RELAY");
        registerOrUpdateDevice("phone-dave", "Dave Singh (Relay)", "dave@demo", false, "RELAY");
        registerOrUpdateDevice("phone-bridge", "Eve / 4G Bridge Node", "bridge@demo", true, "BRIDGE");

        // Aliases for test backward compatibility
        devices.put("phone-stranger1", new VirtualDevice("phone-stranger1", "Stranger 1", "stranger1@demo", false, "RELAY"));
        devices.put("phone-stranger2", new VirtualDevice("phone-stranger2", "Stranger 2", "stranger2@demo", false, "RELAY"));
        devices.put("phone-stranger3", new VirtualDevice("phone-stranger3", "Stranger 3", "stranger3@demo", false, "RELAY"));
    }

    public Collection<VirtualDevice> getDevices() {
        return devices.values();
    }

    public VirtualDevice getDevice(String id) {
        if (id == null) return null;
        return devices.get(id);
    }

    /**
     * Dynamically register or update a connected device (physical phone or simulated client).
     */
    public VirtualDevice registerOrUpdateDevice(String deviceId, String deviceName, String vpa, boolean hasInternet, String role) {
        if (deviceId == null || deviceId.isBlank()) {
            deviceId = "phone-" + UUID.randomUUID().toString().substring(0, 8);
        }
        VirtualDevice dev = devices.get(deviceId);
        if (dev == null) {
            dev = new VirtualDevice(deviceId, deviceName, vpa, hasInternet, role);
            devices.put(deviceId, dev);
            log.info("Registered new device {} ({}, hasInternet={})", deviceId, deviceName, hasInternet);
        } else {
            if (deviceName != null) dev.setDeviceName(deviceName);
            if (vpa != null) dev.setVpa(vpa);
            if (role != null) dev.setRole(role);
            dev.setHasInternet(hasInternet);
            dev.updateHeartbeat();
        }
        return dev;
    }

    public boolean setDeviceInternet(String deviceId, boolean hasInternet) {
        VirtualDevice dev = devices.get(deviceId);
        if (dev != null) {
            dev.setHasInternet(hasInternet);
            dev.updateHeartbeat();
            log.info("Device {} internet toggled to {}", deviceId, hasInternet);
            return true;
        }
        return false;
    }

    public boolean removeDevice(String deviceId) {
        return devices.remove(deviceId) != null;
    }

    /**
     * Sender drops a packet into the mesh by handing it to their own device.
     */
    public void inject(String senderDeviceId, MeshPacket packet) {
        VirtualDevice sender = devices.get(senderDeviceId);
        if (sender == null) {
            // Auto-register unknown device if needed
            sender = registerOrUpdateDevice(senderDeviceId, senderDeviceId, senderDeviceId + "@demo", false, "SENDER");
        }
        sender.hold(packet);
        log.info("Packet {} injected at {} (TTL={})",
                packet.getPacketId().length() >= 8 ? packet.getPacketId().substring(0, 8) : packet.getPacketId(),
                senderDeviceId, packet.getTtl());
    }

    /**
     * One round of gossip. Every device shares everything it has with every
     * other device. TTL is decremented per hop; packets at TTL 0 stay where
     * they are but are not forwarded further.
     */
    public GossipResult gossipOnce() {
        int transfers = 0;
        List<VirtualDevice> deviceList = new ArrayList<>(devices.values());

        // Snapshot what each device holds at the start of this round
        Map<String, List<MeshPacket>> snapshot = new HashMap<>();
        for (VirtualDevice d : deviceList) {
            snapshot.put(d.getDeviceId(), new ArrayList<>(d.getHeldPackets()));
        }

        for (VirtualDevice src : deviceList) {
            for (MeshPacket pkt : snapshot.get(src.getDeviceId())) {
                if (pkt.getTtl() <= 0) continue;
                for (VirtualDevice dst : deviceList) {
                    if (dst == src) continue;
                    // Topology link hop boundary (RFC 4838 Delay-Tolerant physical link proximity)
                    if (topologyLinks.containsKey(src.getDeviceId()) && !areNeighbors(src.getDeviceId(), dst.getDeviceId())) {
                        continue;
                    }
                    if (dst.holds(pkt.getPacketId())) continue;

                    MeshPacket copy = new MeshPacket();
                    copy.setPacketId(pkt.getPacketId());
                    copy.setTtl(pkt.getTtl() - 1);
                    copy.setCreatedAt(pkt.getCreatedAt());
                    copy.setCiphertext(pkt.getCiphertext());
                    dst.hold(copy);
                    transfers++;
                }
            }
        }

        log.info("Gossip round complete: {} packet transfers across {} devices", transfers, deviceList.size());
        return new GossipResult(transfers, snapshotMap());
    }

    public Map<String, Integer> snapshotMap() {
        Map<String, Integer> m = new LinkedHashMap<>();
        for (VirtualDevice d : devices.values()) {
            m.put(d.getDeviceId(), d.packetCount());
        }
        return m;
    }

    /**
     * Returns all packets held by devices with internet — these are what would
     * be uploaded to the backend the moment they reach connectivity.
     */
    public List<BridgeUpload> collectBridgeUploads() {
        List<BridgeUpload> out = new ArrayList<>();
        for (VirtualDevice d : devices.values()) {
            if (!d.hasInternet()) continue;
            for (MeshPacket pkt : d.getHeldPackets()) {
                out.add(new BridgeUpload(d.getDeviceId(), pkt));
            }
        }
        return out;
    }

    public void resetMesh() {
        devices.values().forEach(VirtualDevice::clear);
    }

    public record GossipResult(int transfers, Map<String, Integer> deviceCounts) {}
    public record BridgeUpload(String bridgeNodeId, MeshPacket packet) {}
}
