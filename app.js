// ==========================================================================
// Senna Foods Logistics Integration - Core Engine Frontend Script
// ==========================================================================

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

// LMS Master Shop Dataset
let lmsShops = {
  "100245": "Sri Balaji Stores",
  "100317": "Ganesh Mart",
  "100402": "New Fresh Mart",
  "100118": "Lakshmi Traders",
  "100533": "Annapoorna Supermarket",
  "100274": "Royal Kirana",
  "100650": "Daily Needs Store",
  "100381": "Venkateshwara Provisions",
  "100712": "Green Basket",
  "100159": "Sai Ram Stores",
  "100826": "City Fresh Mart"
  // '100999' Om Provisions intentionally omitted initially
};

const productWeights = {
  "FG-1001": 5.0,
  "FG-2003": 4.0,
  "FG-3010": 5.0,
  "FG-4005": 5.0,
  "FG-5002": 5.0
};

let processedEventIds = new Set();
let lastGeneratedWebhook = null;

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.getAttribute('onclick').includes(tabId));
  if (activeBtn) activeBtn.classList.add('active');

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add('active');
}

// Initialize CSV Preview and run ingestion
document.addEventListener("DOMContentLoaded", () => {
  const csvPreview = document.getElementById("csv-input-preview");
  if (csvPreview) {
    csvPreview.value = SAMPLE_CSV_CONTENT;
  }
  runIngestion();
});

// Run SAP CSV Ingestion
function runIngestion() {
  const lines = SAMPLE_CSV_CONTENT.trim().split("\n");
  const headers = lines[0].split(",");
  
  const deliveries = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 12) continue;
    
    const vbeln = cols[0].trim();
    const rawKunnr = cols[2].trim();
    const shopCode = rawKunnr.replace(/^0+/, '');
    const shopName = cols[3].trim();
    const matnr = cols[6].trim();
    const qty = parseInt(cols[8].trim()) || 0;
    const brgewStr = cols[10].trim();

    if (!deliveries[vbeln]) {
      deliveries[vbeln] = {
        vbeln,
        rawKunnr,
        shopCode,
        shopName,
        items: [],
        totalWeight: 0,
        missingWeight: false,
        isUnknownShop: false
      };
    }

    let weight = 0;
    if (!brgewStr) {
      deliveries[vbeln].missingWeight = true;
      weight = qty * (productWeights[matnr] || 4.0);
    } else {
      weight = parseFloat(brgewStr) || 0;
    }

    deliveries[vbeln].totalWeight += weight;
    deliveries[vbeln].items.push({ matnr, qty, weight });

    if (!lmsShops[shopCode]) {
      deliveries[vbeln].isUnknownShop = true;
    }
  }

  // Render Table
  const tbody = document.querySelector("#ingestion-results-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let count = 0;
  for (const key in deliveries) {
    const d = deliveries[key];
    count++;
    
    let statusBadge = `<span class="badge badge-success">OK (Valid)</span>`;
    let weightDisplay = `${d.totalWeight.toFixed(2)} kg`;

    if (d.isUnknownShop) {
      statusBadge = `<span class="badge badge-danger">CRITICAL: Unknown Shop (${d.rawKunnr})</span>`;
    } else if (d.missingWeight) {
      statusBadge = `<span class="badge badge-warning">WARNING: Missing Weight</span>`;
      weightDisplay = `${d.totalWeight.toFixed(2)} kg (Calculated)`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${d.vbeln}</strong></td>
      <td><code>${d.shopCode}</code></td>
      <td>${d.shopName}</td>
      <td>${d.items.length}</td>
      <td>${weightDisplay}</td>
      <td>${statusBadge}</td>
    `;
    tbody.appendChild(tr);
  }

  const badge = document.getElementById("ingest-status-badge");
  if (badge) badge.innerText = `${count} Deliveries Ingested`;
}

// Resolve Quarantine Queue
function resolveQuarantine() {
  lmsShops["100999"] = "Om Provisions";
  alert("✅ Master Data Updated: Shop '100999' (Om Provisions) has been created in LMS Master. Delivery 0080001237 released from Quarantine!");
  
  const qBadge = document.getElementById("quarantine-count-badge");
  if (qBadge) qBadge.innerText = "0 Records";

  const qLog = document.getElementById("quarantine-log-box");
  if (qLog) {
    qLog.innerHTML += `\n[08:35:10 UTC] RESOLVED: Shop '100999' registered via Master API.\n[08:35:10 UTC] RELEASED: Delivery 0080001237 moved from Quarantine to Active Planning Pool.`;
  }

  runIngestion();
}

// Mobile Webhook Simulator
function sendMobileWebhook() {
  const vbeln = document.getElementById("sim-stop-select").value;
  const result = document.getElementById("sim-result-select").value;
  const deliveredQty = parseInt(document.getElementById("sim-delivered-qty").value) || 0;
  const returnedQty = parseInt(document.getElementById("sim-returned-qty").value) || 0;
  const returnReason = document.getElementById("sim-return-reason").value;
  const podUrl = document.getElementById("sim-pod-url").value;
  const isOffline = document.getElementById("sim-offline-toggle").checked;

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
    "driver": {
      "name": "Ravi K",
      "phone": "+91-98450-00000"
    },
    "stop": {
      "sequence": 2,
      "sap_delivery_number": vbeln,
      "shop_code": "0000100317",
      "result": result,
      "items": [
        {
          "material": "FG-1001",
          "loaded_qty": 10,
          "delivered_qty": 10,
          "returned_qty": 0
        },
        {
          "material": "FG-3010",
          "loaded_qty": 40,
          "delivered_qty": deliveredQty,
          "returned_qty": returnedQty,
          "return_reason": returnReason
        }
      ],
      "pod_photo_url": podUrl,
      "recorded_at": recordedAt,
      "location": {
        "lat": 12.9352,
        "lng": 77.6245
      }
    }
  };

  lastGeneratedWebhook = payload;
  document.getElementById("webhook-json-output").innerText = JSON.stringify(payload, null, 2);

  // Check Idempotency
  if (processedEventIds.has(eventId)) {
    document.getElementById("webhook-response-output").innerHTML = 
      `HTTP/1.1 200 OK\nHeader X-Signature: VALID_HMAC_SHA256\nContent-Type: application/json\n\n{\n  "status": "DUPLICATE_IGNORED",\n  "event_id": "${eventId}",\n  "message": "Event previously processed. Idempotency lock active."\n}`;
    return;
  }

  processedEventIds.add(eventId);

  document.getElementById("webhook-response-output").innerHTML = 
    `HTTP/1.1 200 OK\nHeader X-Signature: VALID_HMAC_SHA256\nContent-Type: application/json\n\n{\n  "status": "SUCCESS",\n  "event_id": "${eventId}",\n  "recorded_at": "${recordedAt}",\n  "sap_sync": "POSTED_200_OK"\n}`;

  // Log to SAP Ledger
  addSapLedgerEntry(vbeln, "0000100317", result, deliveredQty, returnedQty, returnReason, podUrl, sentAt);
}

// Test Idempotency with Duplicate Request
function sendDuplicateWebhook() {
  if (!lastGeneratedWebhook) {
    alert("Please submit a initial webhook payload first.");
    return;
  }
  sendMobileWebhook();
}

// Add Entry to SAP Ledger Table
function addSapLedgerEntry(vbeln, shopCode, result, deliveredQty, returnedQty, reason, podUrl, timestamp) {
  const tbody = document.querySelector("#sap-ledger-table tbody");
  if (!tbody) return;

  const postingId = "SAP-PGI-" + Math.floor(100000 + Math.random() * 900000);
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td><code>${postingId}</code></td>
    <td><strong>${vbeln}</strong></td>
    <td><code>${shopCode}</code></td>
    <td><span class="badge ${result === 'DELIVERED' ? 'badge-success' : 'badge-warning'}">${result}</span></td>
    <td>FG-3010: Delivered ${deliveredQty}, Returned ${returnedQty} (${reason})</td>
    <td><a href="${podUrl}" target="_blank" style="color: var(--accent-cyan);">View POD Link</a></td>
    <td>${new Date(timestamp).toLocaleTimeString()} UTC</td>
    <td><span class="badge badge-success">HTTP 200 PGI_SUCCESS</span></td>
  `;

  tbody.prepend(tr);
}
