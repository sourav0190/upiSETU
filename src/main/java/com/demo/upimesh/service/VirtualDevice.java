package com.demo.upimesh.service;

import com.demo.upimesh.model.MeshPacket;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A simulated or physical device in the mesh. Holds packets it has seen.
 * Supports dynamic configuration, variable roles, and live multi-device synchronization.
 */
public class VirtualDevice {

    private final String deviceId;
    private String deviceName;
    private String vpa;
    private volatile boolean hasInternet;
    private String role; // "SENDER", "MERCHANT", "RELAY", "BRIDGE"
    private volatile long lastHeartbeat;
    private final Map<String, MeshPacket> heldPackets = new ConcurrentHashMap<>();

    public VirtualDevice(String deviceId, boolean hasInternet) {
        this(deviceId, deviceId, deviceId + "@demo", hasInternet, hasInternet ? "BRIDGE" : "RELAY");
    }

    public VirtualDevice(String deviceId, String deviceName, String vpa, boolean hasInternet, String role) {
        this.deviceId = deviceId;
        this.deviceName = deviceName != null ? deviceName : deviceId;
        this.vpa = vpa != null ? vpa : deviceId + "@demo";
        this.hasInternet = hasInternet;
        this.role = role != null ? role : (hasInternet ? "BRIDGE" : "RELAY");
        this.lastHeartbeat = System.currentTimeMillis();
    }

    public String getDeviceId() { return deviceId; }

    public String getDeviceName() { return deviceName; }
    public void setDeviceName(String deviceName) { this.deviceName = deviceName; }

    public String getVpa() { return vpa; }
    public void setVpa(String vpa) { this.vpa = vpa; }

    public boolean hasInternet() { return hasInternet; }
    public void setHasInternet(boolean hasInternet) { this.hasInternet = hasInternet; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public long getLastHeartbeat() { return lastHeartbeat; }
    public void updateHeartbeat() { this.lastHeartbeat = System.currentTimeMillis(); }

    public void hold(MeshPacket packet) {
        if (packet != null && packet.getPacketId() != null) {
            heldPackets.putIfAbsent(packet.getPacketId(), packet);
        }
    }

    public Collection<MeshPacket> getHeldPackets() {
        return heldPackets.values();
    }

    public boolean holds(String packetId) {
        return heldPackets.containsKey(packetId);
    }

    public int packetCount() {
        return heldPackets.size();
    }

    public void clear() {
        heldPackets.clear();
    }
}
