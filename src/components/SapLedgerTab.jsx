import React from 'react';

export default function SapLedgerTab({ ledgerEntries }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📜 Real-Time SAP ERP Feedback Ledger</div>
        <span className="badge badge-success">Final Goods Movement Sync</span>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Real-time log of result payloads sent back from LMS to SAP ERP via OData / REST API for Post Goods Issue (PGI) and inventory credit memos.
      </p>

      <div className="table-container" style={{ marginTop: '10px' }}>
        <table>
          <thead>
            <tr>
              <th>Posting ID</th>
              <th>SAP Delivery #</th>
              <th>Shop Code</th>
              <th>Status</th>
              <th>Item Level Details</th>
              <th>POD Image Link</th>
              <th>Timestamp (UTC)</th>
              <th>SAP HTTP Response</th>
            </tr>
          </thead>
          <tbody>
            {ledgerEntries.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                  No SAP postings recorded yet. Submit a webhook payload in the Mobile Simulator tab to generate ledger entries!
                </td>
              </tr>
            ) : (
              ledgerEntries.map((entry, idx) => (
                <tr key={idx}>
                  <td><code>{entry.postingId}</code></td>
                  <td><strong>{entry.vbeln}</strong></td>
                  <td><code>{entry.shopCode}</code></td>
                  <td>
                    <span className={`badge ${entry.result === 'DELIVERED' ? 'badge-success' : 'badge-warning'}`}>
                      {entry.result}
                    </span>
                  </td>
                  <td>{entry.itemDetails}</td>
                  <td>
                    <a href={entry.podUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>
                      View POD Link
                    </a>
                  </td>
                  <td>{entry.timestamp}</td>
                  <td><span className="badge badge-success">HTTP 200 PGI_SUCCESS</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
