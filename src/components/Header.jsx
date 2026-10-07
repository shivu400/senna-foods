import React from 'react';

export default function Header({ quarantineCount, backendOnline }) {
  return (
    <header>
      <div className="brand-section">
        <div className="brand-icon">📦</div>
        <div className="brand-title">
          <h1>Senna Foods Integration Control Studio</h1>
          <p>React Frontend ↔ Python Backend (REST API) ↔ SAP ERP Ecosystem</p>
        </div>
      </div>
      <div className="status-pills">
        <div className={`pill ${backendOnline ? 'pill-active' : 'pill-warning'}`}>
          <span className="pill-dot"></span>
          Python Backend: {backendOnline ? 'CONNECTED (Port 8000)' : 'STANDALONE / READY'}
        </div>
        <div className={`pill ${quarantineCount > 0 ? 'pill-warning' : 'pill-active'}`}>
          <span className="pill-dot"></span>
          Quarantine: <span>{quarantineCount} Records</span>
        </div>
        <div className="pill pill-active">
          <span className="pill-dot"></span>
          Webhook HMAC: SIGNED
        </div>
      </div>
    </header>
  );
}
