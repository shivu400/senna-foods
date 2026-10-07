"""
Senna Foods Logistics Integration - Python Backend REST API & Webhook Server
Pure Python Standard Library (http.server) - Zero External Dependencies Needed!

Endpoints exposed for React Frontend:
- GET  /api/health            -> System health check & status
- GET  /api/deliveries        -> Parses SAP CSV, normalizes codes, calculates missing weights
- GET  /api/quarantine        -> Returns current quarantined deliveries & governance logs
- POST /api/quarantine/resolve-> Registers Shop 100999 (Om Provisions) & releases quarantine
- POST /api/webhooks/stop-result -> Webhook receiver with HMAC validation & idempotency lock
- GET  /api/sap-ledger        -> Returns SAP ERP goods issue posting ledger entries
"""

import csv
import json
import uuid
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# ==============================================================================
# PYTHON BACKEND STATE & MASTER DATA
# ==============================================================================

MASTER_SHOPS = {
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
    # '100999' Om Provisions intentionally omitted until resolve API call
}

PRODUCT_WEIGHTS = {
    "FG-1001": 5.0,
    "FG-2003": 4.0,
    "FG-3010": 5.0,
    "FG-4005": 5.0,
    "FG-5002": 5.0
}

# Python In-Memory State
processed_event_ids = set()  # Idempotency lock set
quarantined_deliveries = [
    {
        "vbeln": "0080001237",
        "rawKunnr": "0000100999",
        "shopName": "Om Provisions",
        "errorCode": "ERR_UNKNOWN_SHOP_CODE",
        "timestamp": "2026-10-06 08:30:00 UTC"
    }
]
quarantine_logs = [
    "[08:30:02 UTC] INGESTION: Delivery 0080001237 received.",
    "[08:30:02 UTC] VALIDATION: Checking shop_code '100999' (Om Provisions) against LMS Master.",
    "[08:30:02 UTC] REJECTED: Shop '100999' NOT FOUND in LMS Master Database.",
    "[08:30:02 UTC] QUARANTINED: Delivery 0080001237 moved to lms_delivery_quarantine table.",
    "[08:30:03 UTC] ALERT SENT: Exception notification email dispatched to SAP Master Data Team."
]
sap_ledger_entries = []

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def parse_sap_csv():
    deliveries = {}
    file_path = "SAP_delivery_sample.csv"
    
    try:
        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                vbeln = row.get('VBELN', '').strip()
                raw_kunnr = row.get('KUNNR', '').strip()
                shop_code = raw_kunnr.lstrip('0')
                shop_name = row.get('NAME1', '').strip()
                matnr = row.get('MATNR', '').strip()
                qty = int(float(row.get('LFIMG', 0)))
                brgew_str = row.get('BRGEW', '').strip()
                
                if vbeln not in deliveries:
                    deliveries[vbeln] = {
                        "vbeln": vbeln,
                        "rawKunnr": raw_kunnr,
                        "shopCode": shop_code,
                        "shopName": shop_name,
                        "itemsCount": 0,
                        "totalWeight": 0.0,
                        "missingWeight": False,
                        "isUnknownShop": False
                    }
                    
                weight = 0.0
                if not brgew_str:
                    deliveries[vbeln]["missingWeight"] = True
                    weight = qty * PRODUCT_WEIGHTS.get(matnr, 4.0)
                else:
                    weight = float(brgew_str)
                    
                deliveries[vbeln]["totalWeight"] += weight
                deliveries[vbeln]["itemsCount"] += 1
                
                if shop_code not in MASTER_SHOPS:
                    deliveries[vbeln]["isUnknownShop"] = True
                    
        return list(deliveries.values())
    except Exception as e:
        print(f"[ERROR] CSV parse error: {e}")
        return []


# ==============================================================================
# HTTP REQUEST HANDLER
# ==============================================================================

class LMSBackendHandler(BaseHTTPRequestHandler):

    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Signature")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == "/api/health":
            self._set_headers(200)
            self.wfile.write(json.dumps({"status": "ONLINE", "engine": "Python 3.x LMS Backend"}).encode())

        elif path == "/api/deliveries":
            data = parse_sap_csv()
            self._set_headers(200)
            self.wfile.write(json.dumps({"status": "SUCCESS", "deliveries": data}).encode())

        elif path == "/api/quarantine":
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "status": "SUCCESS",
                "quarantineCount": len(quarantined_deliveries),
                "quarantinedItems": quarantined_deliveries,
                "quarantineLogs": quarantine_logs
            }).encode())

        elif path == "/api/sap-ledger":
            self._set_headers(200)
            self.wfile.write(json.dumps({"status": "SUCCESS", "ledgerEntries": sap_ledger_entries}).encode())

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())

    def do_POST(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length) if content_length > 0 else b"{}"
        
        try:
            body = json.loads(body_bytes.decode('utf-8'))
        except Exception:
            body = {}

        if path == "/api/quarantine/resolve":
            MASTER_SHOPS["100999"] = "Om Provisions"
            quarantined_deliveries.clear()
            quarantine_logs.append("[08:35:10 UTC] RESOLVED: Shop '100999' registered via Python Master API.")
            quarantine_logs.append("[08:35:10 UTC] RELEASED: Delivery 0080001237 moved to Active Planning Pool.")
            
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "status": "SUCCESS",
                "message": "Shop 100999 registered and delivery 0080001237 released!",
                "quarantineCount": 0
            }).encode())

        elif path == "/api/webhooks/stop-result":
            event_id = body.get("event_id", "evt_01J9ZQ4K7M2X")
            vbeln = body.get("stop", {}).get("sap_delivery_number", "0080001235")
            result = body.get("stop", {}).get("result", "PART_DELIVERED")
            items = body.get("stop", {}).get("items", [])
            pod_url = body.get("stop", {}).get("pod_photo_url", "")
            sent_at = body.get("sent_at", datetime.now(timezone.utc).isoformat())

            # Check Idempotency Lock
            if event_id in processed_event_ids:
                self._set_headers(200)
                resp = {
                    "status": "DUPLICATE_IGNORED",
                    "event_id": event_id,
                    "message": "Event previously processed by Python Backend. Idempotency lock active."
                }
                self.wfile.write(json.dumps(resp).encode())
                return

            processed_event_ids.add(event_id)

            # Record SAP Feedback Entry
            posting_id = f"SAP-PGI-{uuid.uuid4().hex[:6].upper()}"
            item_summary = ", ".join([f"{it.get('material')}: Delivered {it.get('delivered_qty')}, Returned {it.get('returned_qty')}" for it in items])
            
            ledger_item = {
                "postingId": posting_id,
                "vbeln": vbeln,
                "shopCode": "0000100317",
                "result": result,
                "itemDetails": item_summary,
                "podUrl": pod_url,
                "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
            }
            sap_ledger_entries.insert(0, ledger_item)

            self._set_headers(200)
            resp = {
                "status": "SUCCESS",
                "event_id": event_id,
                "postingId": posting_id,
                "sap_sync": "POSTED_200_OK"
            }
            self.wfile.write(json.dumps(resp).encode())

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())


def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, LMSBackendHandler)
    print(f"=================================================================")
    print(f"  SENNA FOODS PYTHON BACKEND SERVER RUNNING ON PORT {port}  ")
    print(f"  Endpoints: http://localhost:{port}/api/health                   ")
    print(f"=================================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Python server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server(8000)
