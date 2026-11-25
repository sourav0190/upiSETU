import React, { useState } from 'react';
import { Play, Pause, ChevronRight, UploadCloud, Unlink, RotateCcw, Smartphone, Plus } from 'lucide-react';

const NODE_POSITIONS = {
  'phone-alice': { x: 100, y: 110, name: 'Alice', role: 'Offline Sender' },
  'phone-bob': { x: 270, y: 70, name: 'Bob', role: 'BLE Merchant' },
  'phone-carol': { x: 270, y: 190, name: 'Carol', role: 'BLE Relay Hop 1' },
  'phone-dave': { x: 450, y: 110, name: 'Dave', role: 'BLE Relay Hop 2' },
  'phone-bridge': { x: 450, y: 270, name: 'Eve Bridge', role: '4G Ingress Node' },
  'cloud-bank': { x: 660, y: 190, name: 'Central Bank', role: 'ACID Ledger' }
};

export default function NetworkView({
  devices,
  activeNodes,
  transitDot,
  linkFailureActive,
  isAutoRunning,
  onToggleAutoRun,
  onStepHop,
  onSyncBank,
  onToggleLinkFailure,
  onResetNetwork,
  onToggleDeviceNet,
  onOpenAddDevice,
  onInspectNode
}) {
  return (
    <main className="workspace-view active">
      {/* Network Controls Bar */}
      <div className="network-controls-bar">
        <button
          className="btn-primary"
          onClick={onToggleAutoRun}
          style={{ width: 'auto', padding: '8px 16px' }}
        >
          {isAutoRunning ? <Pause size={15} /> : <Play size={15} />}
          <span>{isAutoRunning ? 'Pause' : 'Auto Run'}</span>
        </button>

        <button className="btn-secondary" onClick={onStepHop}>
          <ChevronRight size={15} />
          <span>Step Single Hop</span>
        </button>

        <button className="btn-secondary" onClick={onSyncBank}>
          <UploadCloud size={15} />
          <span>Sync Bridges to Bank</span>
        </button>

        <button
          className={`btn-secondary ${linkFailureActive ? 'primary' : ''}`}
          onClick={onToggleLinkFailure}
        >
          <Unlink size={15} />
          <span>{linkFailureActive ? 'Restore Primary Link' : 'Break Primary Link'}</span>
        </button>

        <button className="btn-secondary" onClick={onResetNetwork} style={{ marginLeft: 'auto' }}>
          <RotateCcw size={15} />
          <span>Reset Network State</span>
        </button>
      </div>

      {/* SVG Topology Visualizer */}
      <div className="topology-canvas-wrap">
        <svg id="topology-svg" className="topology-svg" viewBox="0 0 760 380">
          {/* Links Layer */}
          <g id="svg-links-group">
            <line className="mesh-link active" x1="100" y1="110" x2="270" y2="70" />
            <line className="mesh-link active" x1="100" y1="110" x2="270" y2="190" />
            <line className="mesh-link active" x1="270" y1="70" x2="450" y2="110" />
            <line className="mesh-link active" x1="270" y1="190" x2="450" y2="110" />
            <line
              className={`mesh-link ${linkFailureActive ? 'broken' : 'active'}`}
              x1="270"
              y1="190"
              x2="450"
              y2="270"
            />
            <line className="mesh-link active" x1="450" y1="110" x2="450" y2="270" />
            <line className="mesh-link active" x1="450" y1="270" x2="660" y2="190" />
          </g>

          {/* Animated Packet Transit Particle */}
          {transitDot && transitDot.visible && (
            <circle
              cx={transitDot.x}
              cy={transitDot.y}
              r="7"
              fill="#CBB3E8"
              stroke="#1F3B2E"
              strokeWidth="2"
              style={{ transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            />
          )}

          {/* Nodes Layer */}
          <g id="svg-nodes-group">
            {Object.entries(NODE_POSITIONS).map(([nodeId, pos]) => {
              const isActive = activeNodes && activeNodes.includes(nodeId);
              const isBridge = nodeId === 'phone-bridge';
              const isBank = nodeId === 'cloud-bank';
              const radius = isBank ? 34 : isBridge ? 32 : 28;

              return (
                <g
                  key={nodeId}
                  className={`mesh-node ${isActive ? 'active holding-packet' : ''} ${isBridge ? 'bridge' : ''}`}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => onInspectNode(nodeId)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle className="base" r={radius} />
                  <text y="-4" className="title">{pos.name}</text>
                  <text y="10" className="subtitle">{pos.role}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Connected Device Cluster Section */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Smartphone size={18} />
            <span>Participating Device Cluster (Variable N Nodes)</span>
          </div>
          <button className="btn-secondary" onClick={onOpenAddDevice} style={{ padding: '4px 12px', fontSize: '0.76rem' }}>
            <Plus size={14} />
            <span>Register Custom Node</span>
          </button>
        </div>

        <div className="device-roster-grid">
          {devices.map((d) => {
            const isOnline = Boolean(d.hasInternet);
            return (
              <div key={d.deviceId} className="device-card">
                <div className="device-card-header">
                  <div>
                    <div className="device-name">{d.deviceName || d.deviceId}</div>
                    <div className="device-vpa-sub">{d.vpa}</div>
                  </div>
                  <span className={`status-pill ${isOnline ? 'settled' : 'queued_offline'}`}>
                    {isOnline ? '4G Online' : 'Offline'}
                  </span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span>Role: <strong>{d.role || 'PEER'}</strong></span>
                  <span>Packets: <strong>{d.packetCount || 0}</strong></span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', padding: '4px 8px', fontSize: '0.74rem' }}
                    onClick={() => onToggleDeviceNet(d.deviceId, !isOnline)}
                  >
                    {isOnline ? 'Disconnect 4G Cellular' : 'Connect 4G Cellular'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
