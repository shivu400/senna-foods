import React from 'react';

export default function ArchitectureTab() {
  const procedureSteps = [
    {
      step: '01',
      title: 'SAP Outbound Batch Feed',
      from: 'SAP ERP (SD/LE)',
      to: 'LMS Ingestion Service',
      protocol: 'CSV File Ingestion / REST API',
      desc: 'Parses daily outbound deliveries. Normalizes 10-digit zero-padded customer shop codes (KUNNR) and calculates missing item weights automatically.',
      badge: 'Step 1: Ingestion'
    },
    {
      step: '02',
      title: 'Master Data Governance',
      from: 'LMS Ingestion Engine',
      to: 'Quarantine Queue',
      protocol: 'SQL Master Lookup',
      desc: 'Validates customer shops against LMS master database. Unknown shops (e.g. Om Provisions 0000100999) are strictly quarantined to preserve data integrity.',
      badge: 'Step 2: Gatekeeper'
    },
    {
      step: '03',
      title: 'Trip Manifest & Dispatch',
      from: 'LMS Optimization Core',
      to: 'Transporter Portal',
      protocol: 'REST API / Push',
      desc: 'Groups valid deliveries by geographic zone and vehicle capacity, creating optimized trip manifests for transporter assignment.',
      badge: 'Step 3: Planning'
    },
    {
      step: '04',
      title: 'Driver Partner Sync',
      from: 'LMS Dispatcher',
      to: 'Driver Mobile App',
      protocol: 'HTTPS REST / Offline Sync',
      desc: 'Pushes assigned trip manifests to driver partner mobile app. Supports offline mode caching for remote delivery execution.',
      badge: 'Step 4: Driver Mobile'
    },
    {
      step: '05',
      title: 'Driver Execution & Webhook',
      from: 'Driver Mobile App',
      to: 'LMS Webhook Receiver',
      protocol: 'HTTPS Webhook (X-Signature)',
      desc: 'Driver records stop outcome, item-level accepted/returned quantities, return reasons, and photo POD. Enforces Redis idempotency via event_id.',
      badge: 'Step 5: Webhook Sync'
    },
    {
      step: '06',
      title: 'SAP Goods Movement Feedback',
      from: 'LMS Webhook Service',
      to: 'SAP ERP (OData)',
      protocol: 'OData REST POST',
      desc: 'Posts final Post Goods Issue (PGI) and inventory credit memo requests back to SAP ERP. Retries automatically until HTTP 200 is confirmed.',
      badge: 'Step 6: SAP Ledger'
    }
  ];

  const fieldMappings = [
    { sapField: 'VBELN', lmsField: 'delivery_number', type: 'String (10)', req: 'YES', transform: 'Unique primary key for SAP delivery' },
    { sapField: 'POSNR', lmsField: 'line_item_id', type: 'Integer', req: 'YES', transform: 'Stripped leading zeros (000010 → 10)' },
    { sapField: 'KUNNR', lmsField: 'shop_code', type: 'String (10)', req: 'YES', transform: 'Normalized leading zeros (0000100245 → 100245)' },
    { sapField: 'NAME1', lmsField: 'shop_name', type: 'String (35)', req: 'YES', transform: 'Direct string mapping' },
    { sapField: 'ORT01', lmsField: 'city', type: 'String (35)', req: 'YES', transform: 'Geographic zone routing key' },
    { sapField: 'MATNR', lmsField: 'product_code', type: 'String (18)', req: 'YES', transform: 'Material SKU lookup in LMS Master' },
    { sapField: 'ARKTX', lmsField: 'product_name', type: 'String (40)', req: 'NO', transform: 'Fallback to Master Product Name if empty' },
    { sapField: 'LFIMG', lmsField: 'quantity', type: 'Integer', req: 'YES', transform: 'Parsed numeric case count' },
    { sapField: 'BRGEW', lmsField: 'gross_weight_kg', type: 'Decimal', req: 'NO', transform: 'If blank, fallback: LFIMG × Unit Master Weight' },
    { sapField: 'WADAT', lmsField: 'planned_date', type: 'Date (YYYY-MM-DD)', req: 'YES', transform: 'ISO 8601 Date format' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Visual Procedure Roadmap */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📌 End-to-End Integration Procedure Architecture</div>
          <span className="badge badge-info">Standard Operating Procedure</span>
        </div>
        
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Structured 6-step integration pipeline governing data exchange between SAP ERP, Senna LMS, Transporter Portal, and Driver Mobile Application.
        </p>

        <div className="grid-3col" style={{ marginTop: '12px' }}>
          {procedureSteps.map((s, idx) => (
            <div key={idx} className="card" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-indigo)' }}>{s.step}</span>
                <span className="badge badge-info">{s.badge}</span>
              </div>
              <h4 style={{ color: '#fff', fontSize: '1rem', marginTop: '6px' }}>{s.title}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0' }}>{s.desc}</p>
              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.74rem', color: 'var(--accent-cyan)' }}>
                <strong>{s.from}</strong> → <strong>{s.to}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Field Mapping Dictionary */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 SAP ERP ↔ LMS Master Field Data Dictionary</div>
          <span className="badge badge-success">Task 1 Field Contract</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>SAP Field</th>
                <th>LMS Field Name</th>
                <th>Data Type</th>
                <th>Required?</th>
                <th>Transformation & Business Logic Rule</th>
              </tr>
            </thead>
            <tbody>
              {fieldMappings.map((f, idx) => (
                <tr key={idx}>
                  <td><code>{f.sapField}</code></td>
                  <td><strong>{f.lmsField}</strong></td>
                  <td><span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{f.type}</span></td>
                  <td>
                    <span className={`badge ${f.req === 'YES' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                      {f.req}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{f.transform}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hand-off Matrix */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🌐 System Hand-offs & Integration Contract Matrix</div>
          <span className="badge badge-info">Task 1 System Matrix</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>What Data</th>
                <th>From</th>
                <th>To</th>
                <th>Protocol / API</th>
                <th>What Happens If It's Wrong?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Daily Outbound Deliveries</td>
                <td>SAP ERP</td>
                <td>LMS Engine</td>
                <td>REST API / File Ingestion</td>
                <td>Quarantine invalid rows (e.g. unknown shop); trigger client notification email.</td>
              </tr>
              <tr>
                <td>2</td>
                <td>Optimized Trip Manifest</td>
                <td>LMS Engine</td>
                <td>Transporter Portal</td>
                <td>REST API POST</td>
                <td>Trip remains in UNASSIGNED pool; alerts fleet manager.</td>
              </tr>
              <tr>
                <td>3</td>
                <td>Vehicle & Driver Assignment</td>
                <td>Transporter Portal</td>
                <td>LMS Engine</td>
                <td>REST API POST</td>
                <td>Blocks trip dispatch until valid vehicle & licensed driver are bound.</td>
              </tr>
              <tr>
                <td>4</td>
                <td>Driver Manifest Sync</td>
                <td>LMS Engine</td>
                <td>Driver Partner App</td>
                <td>HTTPS Mobile SDK</td>
                <td>App retries sync; falls back to cached local SQLite manifest.</td>
              </tr>
              <tr>
                <td>5</td>
                <td>Stop Execution & POD Result</td>
                <td>Driver Partner App</td>
                <td>LMS Webhook Receiver</td>
                <td>HTTPS Webhook (X-Signature)</td>
                <td>Stores payload in app SQLite queue; retries with exponential backoff.</td>
              </tr>
              <tr>
                <td>6</td>
                <td>Final Delivery & Goods Movement</td>
                <td>LMS Engine</td>
                <td>SAP ERP</td>
                <td>REST API (OData POST)</td>
                <td>Queues in RabbitMQ/Kafka; retries until SAP returns HTTP 200.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
