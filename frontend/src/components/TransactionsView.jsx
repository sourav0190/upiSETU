import React, { useState } from 'react';
import { History, Search, RefreshCw, Eye } from 'lucide-react';

export default function TransactionsView({ transactions, onRefresh, onInspect }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTx = transactions.filter((tx) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (tx.senderVpa && tx.senderVpa.toLowerCase().includes(q)) ||
      (tx.receiverVpa && tx.receiverVpa.toLowerCase().includes(q)) ||
      (tx.transactionRef && tx.transactionRef.toLowerCase().includes(q)) ||
      (tx.packetHash && tx.packetHash.toLowerCase().includes(q))
    );
  });

  return (
    <main className="workspace-view active">
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <History size={18} />
            <span>Central Bank Audit Ledger & Settlement Journal</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="text-input"
              placeholder="Search VPA or Nonce..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ margin: 0, padding: '6px 12px', fontSize: '0.78rem', width: '220px' }}
            />
            <button
              className="btn-secondary"
              onClick={onRefresh}
              style={{ padding: '6px 12px', fontSize: '0.76rem' }}
            >
              <RefreshCw size={13} />
              <span>Refresh Journal</span>
            </button>
          </div>
        </div>

        <div className="editorial-callout">
          Each settled transaction represents an atomic ACID ledger entry debited and credited in relational persistence. Cryptographic hash guarantees idempotency across duplicate deliveries and server restarts.
        </div>

        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Tx ID</th>
                <th>Sender</th>
                <th>Recipient</th>
                <th>Amount</th>
                <th>Signed At</th>
                <th>Bridge Node</th>
                <th>Hops</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                    No transactions recorded in journal yet. Create an offline payment to begin.
                  </td>
                </tr>
              ) : (
                filteredTx.map((tx) => {
                  const statusLower = (tx.status || 'settled').toLowerCase();
                  const dateStr = new Date(tx.createdAt || Date.now()).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });
                  return (
                    <tr key={tx.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>#{tx.id}</td>
                      <td><strong>{tx.senderVpa}</strong></td>
                      <td>{tx.receiverVpa}</td>
                      <td className="tabular-nums" style={{ fontWeight: 700 }}>
                        ₹{parseFloat(tx.amount || 0).toFixed(2)}
                      </td>
                      <td style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{dateStr}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                        {tx.bridgeNodeId || 'phone-bridge'}
                      </td>
                      <td><span style={{ fontSize: '0.74rem' }}>{tx.hopCount || 2} hops</span></td>
                      <td>
                        <span className={`status-pill ${statusLower}`}>
                          {tx.status || 'SETTLED'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                          onClick={() => onInspect(tx.id)}
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
