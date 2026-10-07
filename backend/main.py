import csv
import io
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, Request, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import database

app = FastAPI(title="Senna Foods LMS Engine API")

# Setup CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
database.init_db()

# Master Data Registry
MASTER_SHOPS = {
    "100245": {"shop_name": "Sri Balaji Stores", "city": "Bengaluru"},
    "100317": {"shop_name": "Ganesh Mart", "city": "Bengaluru"},
    "100402": {"shop_name": "New Fresh Mart", "city": "Bengaluru"},
    "100118": {"shop_name": "Lakshmi Traders", "city": "Bengaluru"},
    "100533": {"shop_name": "Annapoorna Supermarket", "city": "Bengaluru"},
    "100274": {"shop_name": "Royal Kirana", "city": "Bengaluru"},
    "100650": {"shop_name": "Daily Needs Store", "city": "Bengaluru"},
    "100381": {"shop_name": "Venkateshwara Provisions", "city": "Bengaluru"},
    "100712": {"shop_name": "Green Basket", "city": "Bengaluru"},
    "100159": {"shop_name": "Sai Ram Stores", "city": "Bengaluru"},
    "100826": {"shop_name": "City Fresh Mart", "city": "Bengaluru"}
    # Shop 100999 (Om Provisions) is omitted to simulate Master Data Quarantine
}

MASTER_PRODUCTS = {
    "FG-1001": {"weight_kg_per_unit": 5.0},
    "FG-2003": {"weight_kg_per_unit": 4.0},
    "FG-3010": {"weight_kg_per_unit": 5.0},
    "FG-4005": {"weight_kg_per_unit": 5.0},
    "FG-5002": {"weight_kg_per_unit": 5.0}
}

SAMPLE_CSV_TEXT = """VBELN,POSNR,KUNNR,NAME1,ORT01,PSTLZ,MATNR,ARKTX,LFIMG,VRKME,BRGEW,GEWEI,WADAT
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
0080001245,000020,0000100826,City Fresh Mart,Bengaluru,560095,FG-2003,Tomato Ketchup 500g,35,CS,175.0,KG,2026-10-06"""

def parse_and_seed_csv(csv_content: str):
    conn = database.get_db()
    cursor = conn.cursor()

    # Clear old data
    cursor.execute("DELETE FROM deliveries")
    cursor.execute("DELETE FROM quarantine")

    lines = csv_content.strip().splitlines()
    reader = csv.DictReader(lines)

    deliveries_map = {}
    quarantined_count = 0
    
    for row in reader:
        vbeln = row.get("VBELN", "").strip()
        if not vbeln:
            continue

        raw_kunnr = row.get("KUNNR", "").strip()
        shop_code = raw_kunnr.lstrip("0") if raw_kunnr else "UNKNOWN"
        shop_name = row.get("NAME1", "").strip()
        planned_date = row.get("WADAT", "").strip()
        city = row.get("ORT01", "Bengaluru").strip()
        matnr = row.get("MATNR", "").strip()
        qty = int(float(row.get("LFIMG", 0)))
        brgew_str = row.get("BRGEW", "").strip()

        # Weight calculation with fallback
        if not brgew_str:
            unit_weight = MASTER_PRODUCTS.get(matnr, {}).get("weight_kg_per_unit", 5.0)
            item_weight = qty * unit_weight
            missing_weight_flag = 1
        else:
            item_weight = float(brgew_str)
            missing_weight_flag = 0

        # Check Master Data Governance
        if shop_code not in MASTER_SHOPS:
            cursor.execute("""
            INSERT OR REPLACE INTO quarantine (vbeln, raw_kunnr, shop_code, shop_name, reason, status, quarantined_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                vbeln, raw_kunnr, shop_code, shop_name,
                "ERR_UNKNOWN_SHOP_CODE", "ERROR_QUARANTINE",
                datetime.now(timezone.utc).isoformat()
            ))
            quarantined_count += 1
            continue

        if vbeln not in deliveries_map:
            deliveries_map[vbeln] = {
                "vbeln": vbeln,
                "shop_code": shop_code,
                "shop_name": MASTER_SHOPS[shop_code]["shop_name"],
                "city": city,
                "planned_date": planned_date,
                "total_weight": 0.0,
                "items_count": 0,
                "missing_weight": 0,
                "status": "Planned"
            }

        deliveries_map[vbeln]["total_weight"] += item_weight
        deliveries_map[vbeln]["items_count"] += 1
        if missing_weight_flag:
            deliveries_map[vbeln]["missing_weight"] = 1

    for d in deliveries_map.values():
        cursor.execute("""
        INSERT OR REPLACE INTO deliveries (vbeln, shop_code, shop_name, city, planned_date, total_weight, items_count, missing_weight, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            d["vbeln"], d["shop_code"], d["shop_name"], d["city"],
            d["planned_date"], d["total_weight"], d["items_count"],
            d["missing_weight"], d["status"]
        ))

    conn.commit()
    conn.close()

    return len(deliveries_map), quarantined_count

# Parse default dataset on application start
parse_and_seed_csv(SAMPLE_CSV_TEXT)

@app.get("/")
def read_root():
    return {"message": "Senna Foods LMS Engine API is active with SQLite backend."}

@app.post("/api/upload-csv")
async def upload_csv(file: Optional[UploadFile] = File(None), payload: Optional[Dict[str, str]] = Body(None)):
    """
    Dynamic CSV File Upload Endpoint.
    Parses any raw SAP delivery CSV file uploaded by the user, validates master shops,
    applies fallback weight calculations, and updates the SQLite database in real-time.
    """
    csv_text = ""
    if file:
        content = await file.read()
        csv_text = content.decode("utf-8")
    elif payload and "csv_text" in payload:
        csv_text = payload["csv_text"]
    else:
        raise HTTPException(status_code=400, detail="No CSV file or text payload provided.")

    valid_count, quarantine_count = parse_and_seed_csv(csv_text)

    return {
        "status": "SUCCESS",
        "message": f"CSV Processed! {valid_count} valid deliveries ingested, {quarantine_count} isolated in Quarantine.",
        "valid_deliveries_count": valid_count,
        "quarantined_count": quarantine_count
    }

@app.get("/api/deliveries")
def get_deliveries():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM deliveries")
    rows = cursor.fetchall()
    conn.close()

    deliveries = []
    for r in rows:
        d = dict(r)
        d["vbeln"] = r["vbeln"]
        d["shopCode"] = r["shop_code"]
        d["shopName"] = r["shop_name"]
        d["totalWeight"] = r["total_weight"]
        d["itemsCount"] = r["items_count"]
        d["missingWeight"] = bool(r["missing_weight"])
        d["isUnknownShop"] = False
        deliveries.append(d)

    return {"deliveries": deliveries}

@app.get("/api/quarantine")
def get_quarantine():
    conn = database.get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM quarantine")
    q_items = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM quarantine_logs ORDER BY id DESC")
    q_logs = [dict(r) for r in cursor.fetchall()]
    
    conn.close()

    quarantinedItems = []
    for q in q_items:
        quarantinedItems.append({
            "vbeln": q["vbeln"],
            "rawKunnr": q["raw_kunnr"],
            "shopCode": q["shop_code"],
            "shopName": q["shop_name"],
            "reason": q["reason"],
            "status": q["status"],
            "quarantinedAt": q["quarantined_at"]
        })

    return {
        "quarantinedItems": quarantinedItems,
        "quarantineLogs": q_logs
    }

@app.post("/api/quarantine/resolve")
def resolve_quarantine():
    conn = database.get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM quarantine WHERE status='ERROR_QUARANTINE' LIMIT 1")
    row = cursor.fetchone()

    if not row:
        conn.close()
        return {"message": "No quarantine issues pending."}

    q = dict(row)
    shop_code = q["shop_code"]
    shop_name = q["shop_name"]

    # Register Shop in Master Data dynamically
    MASTER_SHOPS[shop_code] = {"shop_name": shop_name, "city": "Bengaluru"}

    # Remove from quarantine
    cursor.execute("DELETE FROM quarantine WHERE vbeln=?", (q["vbeln"],))

    # Add to deliveries
    cursor.execute("""
    INSERT OR REPLACE INTO deliveries (vbeln, shop_code, shop_name, city, planned_date, total_weight, items_count, missing_weight, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        q["vbeln"], shop_code, shop_name, "Bengaluru",
        "2026-10-06", 125.0, 1, 0, "Planned"
    ))

    # Log action
    log_msg = f"Master Data updated: Shop '{shop_code}' ({shop_name}) registered into LMS. Delivery {q['vbeln']} released!"
    cursor.execute("INSERT INTO quarantine_logs (timestamp, action) VALUES (?, ?)", (
        datetime.now(timezone.utc).isoformat(), log_msg
    ))

    conn.commit()
    conn.close()

    return {"message": log_msg}

@app.get("/api/sap-ledger")
def get_sap_ledger():
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sap_ledger ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()

    ledgerEntries = []
    for r in rows:
        ledgerEntries.append({
            "posting_id": r["posting_id"],
            "timestamp": r["timestamp"],
            "payload": json.loads(r["payload_json"]),
            "status": r["status"]
        })

    return {"ledgerEntries": ledgerEntries}

@app.post("/api/webhooks/stop-result")
async def process_webhook(request: Request):
    payload = await request.json()
    event_id = payload.get("event_id", f"evt_{uuid.uuid4().hex[:8]}")

    conn = database.get_db()
    cursor = conn.cursor()

    # 1. Idempotency Check
    cursor.execute("SELECT event_id FROM processed_events WHERE event_id=?", (event_id,))
    if cursor.fetchone():
        conn.close()
        return {
            "status": "DUPLICATE_IGNORED",
            "code": 200,
            "message": f"Event {event_id} already processed. Idempotency preserved!"
        }

    # Record event_id
    cursor.execute("INSERT INTO processed_events (event_id, processed_at) VALUES (?, ?)", (
        event_id, datetime.now(timezone.utc).isoformat()
    ))

    # Update delivery status in SQLite
    stop_data = payload.get("stop", {})
    vbeln = stop_data.get("sap_delivery_number")
    result = stop_data.get("result", "DELIVERED")

    cursor.execute("UPDATE deliveries SET status=? WHERE vbeln=?", (result, vbeln))

    # Post to SAP Ledger
    posting_id = f"SAP-POST-{uuid.uuid4().hex[:8].upper()}"
    sap_payload = {
        "VBELN": vbeln,
        "KUNNR": stop_data.get("shop_code"),
        "DELIVERY_STATUS": result,
        "POD_URL": stop_data.get("pod_photo_url"),
        "RECORDED_AT": stop_data.get("recorded_at"),
        "SENT_AT": payload.get("sent_at"),
        "LINE_ITEMS": stop_data.get("items", [])
    }

    cursor.execute("""
    INSERT INTO sap_ledger (posting_id, timestamp, payload_json, status)
    VALUES (?, ?, ?, ?)
    """, (
        posting_id, datetime.now(timezone.utc).isoformat(),
        json.dumps(sap_payload), "POSTED_200_OK"
    ))

    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "code": 200,
        "event_id": event_id,
        "posting_id": posting_id,
        "sap_posting_status": "POSTED_200_OK"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
