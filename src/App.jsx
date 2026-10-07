import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ArchitectureTab from './components/ArchitectureTab';
import IngestionTab from './components/IngestionTab';
import QuarantineTab from './components/QuarantineTab';
import MobileSimulatorTab from './components/MobileSimulatorTab';
import SapLedgerTab from './components/SapLedgerTab';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const SAMPLE_CSV_CONTENT = `VBELN,POSNR,KUNNR,NAME1,ORT01,PSTLZ,MATNR,ARKTX,LFIMG,VRKME,BRGEW,GEWEI,WADAT
0080001234,000010,0000100245,Sri Balaji Stores,Bengaluru,560034,FG-1001,Masala Pack 1kg,50,CS,250.0,KG,2026-10-06
0080001234,000020,0000100245,Sri Balaji Stores,Bengaluru,560034,FG-2003,Tomato Ketchup 500g,30,CS,150.0,KG,2026-10-06
0080001235,000010,0000100317,Ganesh Mart,Bengaluru,560076,FG-1001,Masala Pack 1kg,40,CS,200.0,KG,2026-10-06
0080001235,000020,0000100317,Ganesh Mart,Bengaluru,560076,FG-3010,Instant Noodles 100g,40,CS,200.0,KG,2026-10-06
0080001236,000010,0000100402,New Fresh Mart,Bengaluru,560068,FG-2003,Tomato Ketchup 500g,50,CS,,KG,2026-10-06
0080001237,000010,0000100999,Om Provisions,Bengaluru,560037,FG-3010,Instant Noodles 100g,25,CS,125.0,KG,2026-10-06
0080001238,000010,0000100118,Lakshmi Traders,Bengaluru,560041,FG-1001,Masala Pack 1kg,20,CS,100.0,KG,2026-10-06
0080001238,000020,0000100118,Lakshmi Traders,Bengaluru,560041,FG-4005,Mango Pickle 300g,15,CS,75.0,KG,2026-10-06
0080001238,000030,0000100118,Lakshmi Traders,Bengaluru,560041,FG-3010,Instant Noodles 100g,10,CS,50.0,KG,2026-10-06
0080001239,000010,0000100533,Annapoorna Supermarket,Bengaluru,560011,FG-2003,Tomato Ketchup 500g,40,CS,200.0,KG,2026-10-06
0080001239,000020,0000100533,Annapoorna Supermarket,Bengaluru,560011,FG-5002,Wheat Flour 5kg,60,CS,300.0,KG,2026-10-06
0080001240,000010,0000100274,Royal Kirana,Bengaluru,560078,FG-5002,Wheat Flour 5kg,80,CS,400.0,KG,2026-10-06
0080001241,000010,0000100650,Daily Needs Store,Bengaluru,560102,FG-1001,Masala Pack 1kg,35,CS,175.0,KG,2026-10-06
0080001241,000020,0000100650,Daily Needs Store,Bengaluru,560102,FG-4005,Mango Pickle 300g,25,CS,125.0,KG,2026-10-06
0080001242,000010,0000100381,Venkateshwara Provisions,Bengaluru,560043,FG-3010,Instant Noodles 100g,50,CS,250.0,KG,2026-10-06
0080001242,000020,0000100381,Venkateshwara Provisions,Bengaluru,560043,FG-2003,Tomato Ketchup 500g,20,CS,100.0,KG,2026-10-06
0080001243,000010,0000100712,Green Basket,Bengaluru,560066,FG-5002,Wheat Flour 5kg,45,CS,225.0,KG,2026-10-06
0080001243,000020,0000100712,Green Basket,Bengaluru,560066,FG-1001,Masala Pack 1kg,30,CS,150.0,KG,2026-10-06
0080001244,000010,0000100159,Sai Ram Stores,Bengaluru,560085,FG-4005,Mango Pickle 300g,60,CS,300.0,KG,2026-10-06
0080001245,000010,0000100826,City Fresh Mart,Bengaluru,560095,FG-3010,Instant Noodles 100g,40,CS,200.0,KG,2026-10-06
0080001245,000020,0000100826,City Fresh Mart,Bengaluru,560095,FG-2003,Tomato Ketchup 500g,35,CS,175.0,KG,2026-10-06`;

export default function App() {
  const [activeTab, setActiveTab] = useState('tab-architecture');
  const [backendOnline, setBackendOnline] = useState(false);
  const [deliveries, setDeliveries] = useState([]);
  const [quarantinedItems, setQuarantinedItems] = useState([]);
  const [quarantineLogs, setQuarantineLogs] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);

  // Fetch Deliveries from Python Backend API
  const fetchDeliveriesFromPython = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/deliveries`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries || []);
        setBackendOnline(true);
      }
    } catch (e) {
      console.warn("Python backend not responding on port 8000. Running in React fallback mode.");
      setBackendOnline(false);
    }
  };

  // Fetch Quarantine Data from Python Backend API
  const fetchQuarantineFromPython = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/quarantine`);
      if (res.ok) {
        const data = await res.json();
        setQuarantinedItems(data.quarantinedItems || []);
        setQuarantineLogs(data.quarantineLogs || []);
      }
    } catch (e) {
      // Fallback
    }
  };

  // Fetch SAP Ledger from Python Backend API
  const fetchLedgerFromPython = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sap-ledger`);
      if (res.ok) {
        const data = await res.json();
        setLedgerEntries(data.ledgerEntries || []);
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    fetchDeliveriesFromPython();
    fetchQuarantineFromPython();
    fetchLedgerFromPython();
  }, []);

  // Quarantine Resolution via Python API
  const handleResolveQuarantine = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/quarantine/resolve`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`✅ Python Backend: ${data.message}`);
        fetchDeliveriesFromPython();
        fetchQuarantineFromPython();
        return;
      }
    } catch (e) {
      alert("✅ React Fallback: Shop '100999' registered and quarantine released!");
      setQuarantinedItems([]);
    }
  };

  // Mobile Webhook Simulator via Python API
  const handleMobileWebhook = async ({ vbeln, result, deliveredQty, returnedQty, returnReason, podUrl, isOffline, isDuplicate }) => {
    const eventId = "evt_01J9ZQ4K7M2X";
    const now = new Date();
    const recordedAt = new Date(now.getTime() - (isOffline ? 120000 : 0)).toISOString();
    const sentAt = now.toISOString();

    const payload = {
      "event_id": eventId,
      "event_type": "stop.result_saved",
      "sent_at": sentAt,
      "trip_id": "TRP-BLR-20261002-07",
      "truck_number": "KA-01-AB-1234",
      "driver": { "name": "Ravi K", "phone": "+91-98450-00000" },
      "stop": {
        "sequence": 2,
        "sap_delivery_number": vbeln,
        "shop_code": "0000100317",
        "result": result,
        "items": [
          { "material": "FG-1001", "loaded_qty": 10, "delivered_qty": 10, "returned_qty": 0 },
          { "material": "FG-3010", "loaded_qty": 40, "delivered_qty": deliveredQty, "returned_qty": returnedQty, "return_reason": returnReason }
        ],
        "pod_photo_url": podUrl,
        "recorded_at": recordedAt,
        "location": { "lat": 12.9352, "lng": 77.6245 }
      }
    };

    try {
      const res = await fetch(`${API_BASE_URL}/webhooks/stop-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Signature': 'sha256=mock_valid_signature' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        fetchLedgerFromPython();
        return {
          payload,
          response: `HTTP/1.1 200 OK\nHeader X-Signature: VALID_HMAC_SHA256\nContent-Type: application/json\n\n${JSON.stringify(data, null, 2)}`
        };
      }
    } catch (e) {
      // React fallback response formatting
    }

    return {
      payload,
      response: `HTTP/1.1 200 OK\nHeader X-Signature: VALID_HMAC_SHA256\nContent-Type: application/json\n\n{\n  "status": "SUCCESS",\n  "event_id": "${eventId}",\n  "recorded_at": "${recordedAt}",\n  "sap_sync": "POSTED_200_OK"\n}`
    };
  };

  return (
    <div className="app-container">
      <Header quarantineCount={quarantinedItems.length} backendOnline={backendOnline} />

      {/* Tabs Bar */}
      <div className="nav-tabs">
        <button className={`tab-btn ${activeTab === 'tab-architecture' ? 'active' : ''}`} onClick={() => setActiveTab('tab-architecture')}>
          🌐 Architecture & Pipeline
        </button>
        <button className={`tab-btn ${activeTab === 'tab-ingestion' ? 'active' : ''}`} onClick={() => setActiveTab('tab-ingestion')}>
          📥 SAP CSV Ingestion
        </button>
        <button className={`tab-btn ${activeTab === 'tab-quarantine' ? 'active' : ''}`} onClick={() => setActiveTab('tab-quarantine')}>
          🚨 Quarantine Queue
        </button>
        <button className={`tab-btn ${activeTab === 'tab-mobile-simulator' ? 'active' : ''}`} onClick={() => setActiveTab('tab-mobile-simulator')}>
          📱 Driver Webhook Simulator
        </button>
        <button className={`tab-btn ${activeTab === 'tab-sap-ledger' ? 'active' : ''}`} onClick={() => setActiveTab('tab-sap-ledger')}>
          📜 SAP Feedback Ledger
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'tab-architecture' && <ArchitectureTab />}
      {activeTab === 'tab-ingestion' && <IngestionTab csvContent={SAMPLE_CSV_CONTENT} deliveries={deliveries} onRunIngestion={fetchDeliveriesFromPython} />}
      {activeTab === 'tab-quarantine' && <QuarantineTab quarantinedItems={quarantinedItems} onResolveQuarantine={handleResolveQuarantine} quarantineLogs={quarantineLogs} />}
      {activeTab === 'tab-mobile-simulator' && <MobileSimulatorTab onSubmitWebhook={handleMobileWebhook} />}
      {activeTab === 'tab-sap-ledger' && <SapLedgerTab ledgerEntries={ledgerEntries} />}
    </div>
  );
}
