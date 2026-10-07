import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "lms_database.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Deliveries table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS deliveries (
        vbeln TEXT PRIMARY KEY,
        shop_code TEXT,
        shop_name TEXT,
        city TEXT,
        planned_date TEXT,
        total_weight REAL,
        items_count INTEGER,
        missing_weight INTEGER,
        status TEXT
    )
    """)

    # Quarantined items table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quarantine (
        vbeln TEXT PRIMARY KEY,
        raw_kunnr TEXT,
        shop_code TEXT,
        shop_name TEXT,
        reason TEXT,
        status TEXT,
        quarantined_at TEXT
    )
    """)

    # Quarantine resolution audit logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quarantine_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        action TEXT
    )
    """)

    # SAP Feedback Ledger table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sap_ledger (
        posting_id TEXT PRIMARY KEY,
        timestamp TEXT,
        payload_json TEXT,
        status TEXT
    )
    """)

    # Idempotency table for webhook event_ids
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS processed_events (
        event_id TEXT PRIMARY KEY,
        processed_at TEXT
    )
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully!")
