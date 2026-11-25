import React from 'react';
import { CreditCard, Network, History, FlaskConical, Sun, Moon, Info, Radio } from 'lucide-react';

export default function Header({
  activeWorkspace,
  setActiveWorkspace,
  currentUser,
  userKey,
  onSwitchUser,
  isOnline,
  onToggleOnline,
  theme,
  onToggleTheme,
  onOpenAbout
}) {
  return (
    <header className="app-header">
      {/* Brand Identity */}
      <div className="brand-wrapper" onClick={() => setActiveWorkspace('payments')} style={{ cursor: 'pointer' }}>
        <div className="brand-badge" title="MeshPay (upiSETU)">
          <Radio size={20} />
        </div>
        <div className="brand-title-group">
          <div className="brand-name">
            <span>MeshPay</span>
            <span className="brand-tag">upiSETU</span>
          </div>
          <div className="brand-subtitle">Offline-First Peer-to-Peer Mesh Architecture</div>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <nav className="nav-workspace-tabs" aria-label="Workspace Tabs">
        <button
          className={`nav-workspace-tab ${activeWorkspace === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveWorkspace('payments')}
        >
          <CreditCard size={15} />
          <span>Payments</span>
        </button>

        <button
          className={`nav-workspace-tab ${activeWorkspace === 'network' ? 'active' : ''}`}
          onClick={() => setActiveWorkspace('network')}
        >
          <Network size={15} />
          <span>Network</span>
        </button>

        <button
          className={`nav-workspace-tab ${activeWorkspace === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveWorkspace('transactions')}
        >
          <History size={15} />
          <span>Transactions</span>
        </button>

        <button
          className={`nav-workspace-tab ${activeWorkspace === 'lab' ? 'active' : ''}`}
          onClick={() => setActiveWorkspace('lab')}
        >
          <FlaskConical size={15} />
          <span>Advanced Lab</span>
        </button>
      </nav>

      {/* Header Actions */}
      <div className="header-actions">
        {/* Connectivity Toggle */}
        <button
          className={`network-pill ${isOnline ? 'online' : 'offline'}`}
          onClick={onToggleOnline}
          title="Toggle simulated 4G vs Offline Basement mode"
        >
          <span className="pulse-dot"></span>
          <span>{isOnline ? 'Online (4G)' : 'Offline (Mesh)'}</span>
        </button>

        {/* User Switcher */}
        <select
          value={userKey}
          onChange={(e) => onSwitchUser(e.target.value)}
          className="user-select-dropdown"
          title="Switch active participant"
        >
          <option value="alice">Alice Sharma (Sender)</option>
          <option value="bob">Bob Verma (Merchant)</option>
          <option value="carol">Carol Patel (Relay)</option>
          <option value="dave">Dave Singh (Relay)</option>
          <option value="bridge">Eve (4G Bridge)</option>
        </select>

        {/* Classic Original View Link */}
        <a
          href="/classic"
          className="icon-button"
          title="Switch to Upstream Classic Developer View (/classic)"
          style={{
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            padding: '0 8px',
            width: 'auto',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)'
          }}
        >
          Classic UI
        </a>

        {/* About Modal Button */}
        <button className="icon-button" onClick={onOpenAbout} title="Project Info & Attribution">
          <Info size={16} />
        </button>

        {/* Theme Toggle Button */}
        <button className="icon-button" onClick={onToggleTheme} title="Toggle Warm / Dark Theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
