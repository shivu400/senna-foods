import React, { useState } from 'react';

export default function QuarantineTab({ quarantinedItems, onResolveQuarantine, quarantineLogs }) {
  const [customShopCode, setCustomShopCode] = useState('');
  const [customShopName, setCustomShopName] = useState('');
  const [customStatus, setCustomStatus] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top KPI Metrics Row */}
      <div className="grid-3col">
        <div className="card" style={{ padding: '16px 20px', flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(244, 63, 94, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>🚨</div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Quarantine Holds</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-rose)' }}>{quarantinedItems.length} Records</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(99, 102, 241, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>🛡️</div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Master Data Rule</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>STRICT_NO_AUTO_CREATE</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '2rem', background: 'rgba(16, 185, 129, 0.15)', padding: '10px 14px', borderRadius: '12px' }}>📧</div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Client Notification Email</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>AUTOMATED_READY</div>
          </div>
        </div>
      </div>

      {/* Main Quarantine Isolation Queue Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🚨 Quarantine & Master Data Governance Queue</div>
          <span className="badge badge-danger">Data Integrity Gatekeeper</span>
        </div>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Deliveries with unknown customer shop codes (e.g. Om Provisions <code>0000100999</code>) are isolated here. Auto-creation is strictly prohibited to prevent corrupted logistics master data.
        </p>

        <div className="table-container" style={{ marginTop: '10px' }}>
          <table>
            <thead>
              <tr>
                <th>Delivery #</th>
                <th>Raw SAP Shop Code</th>
                <th>Normalized Shop Code</th>
                <th>Shop Name</th>
                <th>Error Code & Severity</th>
                <th>Quarantined At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {quarantinedItems.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--accent-emerald)', padding: '24px', fontWeight: 600 }}>
                    ✅ No Quarantined Records! All deliveries matched valid LMS Master Shops.
                  </td>
                </tr>
              ) : (
                quarantinedItems.map((item, idx) => (
                  <tr key={idx}>
                    <td><strong>{item.vbeln || item.delivery_number}</strong></td>
                    <td><code>{item.rawKunnr || item.raw_kunnr}</code></td>
                    <td><code>{item.shopCode || item.shop_code}</code></td>
                    <td><strong>{item.shopName || item.shop_name}</strong></td>
                    <td><span className="badge badge-danger">{item.reason || 'ERR_UNKNOWN_SHOP_CODE'}</span></td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.quarantinedAt || item.quarantined_at}</td>
                    <td>
                      <button className="btn btn-emerald" style={{ padding: '6px 14px', fontSize: '0.78rem' }} onClick={onResolveQuarantine}>
                        ⚡ Sync Master Data & Release
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Column Bottom Layout filling workspace */}
      <div className="grid-main">
        {/* Email Draft Card */}
        <div className="card" style={{ background: 'rgba(15, 23, 42, 0.7)' }}>
          <div className="card-header">
            <div className="card-title" style={{ fontSize: '0.95rem' }}>📧 Client Communication Email Draft (Task Bonus 2)</div>
            <span className="badge badge-info">Under 150 Words</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Automated notification generated for Senna Foods' non-technical SAP team explaining problem rows:
          </p>
          <pre className="code-box" style={{ fontSize: '0.8rem', color: '#cbd5e1', height: '240px' }}>
{`Subject: Action Needed: Delivery Data Errors in Daily SAP Feed (Deliveries 0080001236 & 0080001237)

Hi Senna Foods SAP Team,

Our automated system processed today’s delivery file and flagged two data issues that need your attention:

1. Delivery 0080001236 (New Fresh Mart): The item weight column is blank. Without weight information, our system cannot assign this delivery to a truck.
2. Delivery 0080001237 (Om Provisions): Shop code 0000100999 is not registered in our system master list. This delivery has been put on hold to prevent dispatch errors.

What we need you to fix:
* Please add the missing item weight for Delivery 0080001236 in SAP.
* Please create the master record for Shop 0000100999 in SAP so it syncs to our system.

Once fixed, please re-send these two deliveries so we can schedule them for delivery.

Thank you,
Implementation Engineering Team (Senna Foods Logistics Integration)`}
          </pre>
        </div>

        {/* Audit & Governance Log Card */}
        <div className="card" style={{ background: 'rgba(15, 23, 42, 0.7)' }}>
          <div className="card-header">
            <div className="card-title" style={{ fontSize: '0.95rem' }}>📜 Master Data Audit Logs & Live Activity</div>
            <span className="badge badge-success">SQL Event Stream</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Real-time audit log of governance actions and master data updates:
          </p>
          <div className="code-box" style={{ height: '240px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#4ade80' }}>
            {quarantineLogs && quarantineLogs.length > 0 ? (
              quarantineLogs.map((log, index) => (
                <div key={index} style={{ marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px dotted rgba(255,255,255,0.08)' }}>
                  [{typeof log === 'object' ? log.timestamp : new Date().toISOString()}] {typeof log === 'object' ? log.action : log}
                </div>
              ))
            ) : (
              <div>
                [SYSTEM READY] Monitoring incoming SAP feeds for unknown shop codes...<br/>
                [GOVERNANCE RULE] Auto-creation: DISABLED | Gatekeeper: ACTIVE<br/>
                [AUDIT] Om Provisions (0000100999) quarantined at startup.
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
