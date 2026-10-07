import React, { useState } from 'react';

export default function MobileSimulatorTab({ onSubmitWebhook }) {
  const [vbeln, setVbeln] = useState('0080001235');
  const [result, setResult] = useState('PART_DELIVERED');
  const [deliveredQty, setDeliveredQty] = useState(36);
  const [returnedQty, setReturnedQty] = useState(4);
  const [returnReason, setReturnReason] = useState('DAMAGED');
  const [podUrl, setPodUrl] = useState('https://partner.example.com/pod/TRP-BLR-20261002-07/2.jpg');
  const [isOffline, setIsOffline] = useState(false);
  const [webhookJson, setWebhookJson] = useState(null);
  const [responseJson, setResponseJson] = useState(null);

  const handleSubmit = async (isDuplicate = false) => {
    const res = await onSubmitWebhook({
      vbeln,
      result,
      deliveredQty: parseInt(deliveredQty) || 0,
      returnedQty: parseInt(returnedQty) || 0,
      returnReason,
      podUrl,
      isOffline,
      isDuplicate
    });

    setWebhookJson(res.payload);
    setResponseJson(res.response);
  };

  return (
    <div className="grid-main">
      <div className="phone-mockup">
        <div className="phone-header">
          <h3>📱 Senna Driver Partner App</h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Truck: KA-01-AB-1234 | Driver: Ravi K</p>
        </div>

        <div className="phone-screen">
          <div className="form-group">
            <label>Select Active Stop:</label>
            <select value={vbeln} onChange={(e) => setVbeln(e.target.value)}>
              <option value="0080001235">Stop 2: Ganesh Mart (0080001235)</option>
              <option value="0080001234">Stop 1: Sri Balaji Stores (0080001234)</option>
              <option value="0080001236">Stop 3: New Fresh Mart (0080001236)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Stop Outcome:</label>
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="PART_DELIVERED">PART_DELIVERED (Partial Delivery)</option>
              <option value="DELIVERED">DELIVERED (Full Acceptance)</option>
              <option value="REJECTED_RETURNED">REJECTED_RETURNED (100% Rejected)</option>
            </select>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Item Execution (FG-3010 Noodles):</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Delivered</label>
                <input type="number" value={deliveredQty} onChange={(e) => setDeliveredQty(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Returned</label>
                <input type="number" value={returnedQty} onChange={(e) => setReturnedQty(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Return Reason</label>
              <select value={returnReason} onChange={(e) => setReturnReason(e.target.value)}>
                <option value="DAMAGED">DAMAGED</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="WRONG_ITEM">WRONG_ITEM</option>
                <option value="STORE_CLOSED">STORE_CLOSED</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Digital POD Photo URL:</label>
            <input type="text" value={podUrl} onChange={(e) => setPodUrl(e.target.value)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
            <span>Simulate Offline Mode:</span>
            <input type="checkbox" checked={isOffline} onChange={(e) => setIsOffline(e.target.checked)} style={{ width: 'auto' }} />
          </div>

          <button className="btn btn-primary" onClick={() => handleSubmit(false)}>🚀 Submit Webhook Payload</button>
          <button className="btn btn-amber" onClick={() => handleSubmit(true)}>🔄 Re-send Duplicate (Test Idempotency)</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Transmitted Webhook Payload & LMS Response</div>
          <span className="badge badge-info">Task 2 JSON Contract</span>
        </div>

        <div className="form-group">
          <label>Transmitted HTTPS Webhook JSON (POST /api/webhooks/stop-result):</label>
          <pre className="code-box">
            {webhookJson ? JSON.stringify(webhookJson, null, 2) : '// Click "Submit Webhook Payload" on the simulator to generate payload'}
          </pre>
        </div>

        <div className="form-group">
          <label>LMS Webhook Server Response (HTTP Headers & Status):</label>
          <pre className="code-box" style={{ color: '#4ade80' }}>
            {responseJson || '// LMS Response will appear here'}
          </pre>
        </div>
      </div>
    </div>
  );
}
