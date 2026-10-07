# Senna Foods Implementation Engineer Intern Assignment
## Integration Architecture & Implementation Specification: SAP ERP ↔ LMS ↔ Partner App

**Candidate:** Implementation Engineer Intern Candidate  
**Date:** October 5, 2026  
**Target Architecture:** SAP S/4HANA / ECC ↔ Logistics Management System (LMS) ↔ Transporter Portal ↔ Driver Mobile Partner App  
**Evaluation Rubric Alignment:** Flow Understanding (20%), Data Accuracy (25%), Failure Handling (25%), Clear Writing (15%), Ownership & Methodology (15%)

---

## Assumptions

Before defining data structures and system flows, the following core technical and operational assumptions are established:

1. **Date & Timezone Standardization:**  
   SAP supplies planned delivery dates (`WADAT`) as `YYYY-MM-DD`. All timestamps exchanged between LMS, partner app webhooks, and SAP back-ends are normalized to standard **ISO 8601** format with local offset (e.g., `2026-10-02T11:42:15+05:30`).
2. **Shop Code Normalization:**  
   SAP identifies customer accounts using 10-digit zero-padded strings (`KUNNR`, e.g., `0000100999`). LMS strips leading zeros during ingestion (`100999`) to match LMS internal Master Shop records.
3. **Delivery Identifier Integrity:**  
   SAP Delivery Numbers (`VBELN`, e.g., `0080001236`) retain leading zeros as a 10-character string (`text(10)`) across all LMS databases, APIs, webhooks, and audit logs to maintain 1-to-1 SAP traceability.
4. **Unit of Measure (UoM) & Weight Fallback:**  
   SAP unit codes map as follows: `CS` $\rightarrow$ `CASE`, `PC` $\rightarrow$ `PIECE`. If item gross weight (`BRGEW`) is missing or zero (as in delivery `0080001236`), LMS automatically calculates weight using LMS Product Master (`weight_kg = quantity * product_master.weight_kg_per_unit`).
5. **Strict Master Data Governance & Quarantine Protocol:**  
   LMS treats SAP as the single source of truth for master data. If SAP sends a delivery for an unrecognized shop code (e.g., `0000100999` Om Provisions), LMS **does not auto-create** the shop. Instead, the delivery is quarantined in an `ERROR_QUARANTINE` state, and an automated notification is raised for the SAP Master Data team.
6. **Idempotency & Offline Sync Guarantee:**  
   All partner app events contain a unique string `event_id` (e.g., `evt_01J9ZQ4K7M2X`). LMS guarantees idempotent processing—receiving duplicate webhooks will result in an HTTP `200 OK` without duplicating business logic or stock updates.

---

## Task 1 — Map the data

### 1. Hand-offs Table

The end-to-end lifecycle spans 6 critical system hand-offs between SAP, LMS, Transporter Portal, and Driver Partner App:

| # | What data | From | To | How (file, API or webhook) | What happens if it's wrong |
|---|---|---|---|---|---|
| **1** | Daily Outbound Deliveries (Delivery #, Shop, Items, Quantities, Gross Weight, Planned Date) | SAP ERP | LMS | **REST API (JSON POST)** / Ingestion Pipeline | Ingestion engine rejects malformed payload; bad rows (e.g., unknown shop) are isolated into Quarantine Queue and error alert is sent to SAP team. |
| **2** | Optimized Trip Manifest & Planned Stops | LMS | Transporter Portal | **REST API (JSON)** / Portal Push | Trip remains in `UNASSIGNED` state; alert triggers on Transport Manager dashboard to review vehicle allocation. |
| **3** | Vehicle & Driver Assignment (Truck #, Driver Name, Mobile Phone) | Transporter Portal | LMS | **REST API (JSON POST)** | System blocks trip status transition; trip cannot be dispatched until valid truck number and driver phone are bound. |
| **4** | Driver Manifest Sync (Stops, Sequence, Customer Info, Items to Deliver) | LMS | Driver Partner App | **REST API (JSON GET/Sync)** / Mobile SDK | App retry sync with exponential backoff; driver relies on locally cached SQLite manifest on mobile device. |
| **5** | Stop Execution Result & Digital POD (Delivered/Returned Qty, Reason, Photo, GPS, Timestamps) | Driver Partner App | LMS | **HTTPS Webhook POST** (with `X-Signature` Header) | Mobile app queues event in local encrypted SQLite database with status `PENDING_SYNC` and retries automatically when connectivity restores. |
| **6** | Final Goods Movement & POD Link (Actual Delivered, Returns, Return Reasons, POD URL) | LMS | SAP ERP | **REST API (OData / JSON POST)** | Event is queued in LMS message broker (RabbitMQ/Kafka); retries via exponential backoff; manual reconciliation alert raised if SAP endpoint remains down. |

---

### 2. Field Mapping (SAP Sample File $\rightarrow$ LMS Data Fields)

Mapping 10 representative SAP columns to LMS fields (across `delivery`, `delivery_item`, `shop`, and `product` entities):

| SAP field | LMS field | Type | Required? | Transformation Notes & Validation Rules |
|---|---|---|---|---|
| `VBELN` | `delivery.delivery_number` | text(10) | **yes** | Retain leading zeros (e.g., `0080001236`). Primary key linkage across all entities. |
| `POSNR` | `delivery_item.line_number` | integer | **yes** | Cast text string to Integer; strip leading zeros (e.g., `000010` $\rightarrow$ `10`). |
| `KUNNR` | `delivery.shop_code` / `shop.shop_code` | text | **yes** | Strip leading zeros (e.g., `0000100317` $\rightarrow$ `100317`). Validate against LMS Shop Master. |
| `NAME1` | `shop.shop_name` | text | **yes** | Display name of customer shop. Cross-reference with Shop Master. |
| `ORT01` | `shop.city` | text | **yes** | Normalized city name string for zone routing and geography filtering. |
| `PSTLZ` | `shop.pin_code` | text(6) | **yes** | Postal code format validation (6 digits). |
| `MATNR` | `delivery_item.product_code` | text | **yes** | Material SKU code. Validate against LMS Product Master. |
| `ARKTX` | `delivery_item.product_name` | text | no | Product description text for driver mobile UI display. |
| `LFIMG` | `delivery_item.quantity` | integer | **yes** | Cast floating-point string to Integer. Must be $> 0$. |
| `VRKME` | `delivery_item.unit` | text | **yes** | Transform SAP UoM code: `'CS'` $\rightarrow$ `'CASE'`, `'PC'` $\rightarrow$ `'PIECE'`. |
| `BRGEW` | `delivery.total_weight_kg` / `delivery_item.weight_kg` | decimal | **yes** | Convert string to decimal. If missing/empty (delivery `0080001236`), fallback to `quantity * product.weight_kg_per_unit`. |
| `WADAT` | `delivery.planned_date` | date (YYYY-MM-DD) | **yes** | ISO date string validation (`YYYY-MM-DD`). Validate date is not in the past. |

---

### 3. Data Flow & Exception Diagram

```
+-----------------------------------------------------------------------------------+
|                                 SAP ERP (Master)                                  |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Daily Outbound Deliveries (REST API / JSON)
                                          v
+-----------------------------------------------------------------------------------+
|                               LMS INGESTION ENGINE                                |
|  - Validates Shop Master & Product Master                                        |
|  - Normalizes Shop Code (strips leading zeros)                                    |
|  - Computes missing gross weights via Product Master                              |
+-----------------------------------------------------------------------------------+
       /                                                             \
      / Validation PASS                                               \ Unknown Shop (0000100999 Om Provisions)
     /                                                                 \ Missing Critical Data
    v                                                                   v
+------------------------------------+               +--------------------------------------+
|        LMS ROUTE OPTIMIZER         |               |     QUARANTINE / ERROR QUEUE         |
|  - Groups orders into Trips        |               |  - Status: ERROR_QUARANTINE          |
|  - Status: PLANNED                 |               |  - Triggers Alert Email to SAP Team  |
+------------------------------------+               +--------------------------------------+
                  |
                  | Send to Transporter (Status: SENT_TO_TRANSPORTER)
                  v
+-----------------------------------------------------------------------------------+
|                           TRANSPORTER PORTAL / LMS                                |
|  - Transporter assigns Truck (KA-01-AB-1234) & Driver (Ravi K)                   |
|  - Status changes to ASSIGNED                                                     |
+-----------------------------------------------------------------------------------+
                  |
                  | Sync Trip Manifest
                  v
+-----------------------------------------------------------------------------------+
|                        DRIVER PARTNER MOBILE APP (Offline-Ready)                  |
|  - Driver taps "Start Trip" -> Status: DISPATCHED                                 |
|  - Driver reaches shop -> Status: ARRIVED_AT_STOP                                 |
|  - Driver records quantities delivered/returned + POD Photo                       |
|  - Stores in SQLite locally if offline -> Syncs when network returns              |
+-----------------------------------------------------------------------------------+
                  |
                  | Event Webhook (stop.result_saved + X-Signature Header)
                  v
+-----------------------------------------------------------------------------------+
|                              LMS WEBHOOK RECEIVER                                 |
|  - Validates HMAC X-Signature header                                              |
|  - Idempotency check via event_id (evt_01J9ZQ4K7M2X)                             |
|  - Updates Stop Status (DELIVERED / PART_DELIVERED / REJECTED_RETURNED)           |
+-----------------------------------------------------------------------------------+
                  |
                  | Post Goods Movement & POD Link (REST API POST)
                  v
+-----------------------------------------------------------------------------------+
|                                 SAP ERP System                                    |
|  - Posts Goods Issue (PGI) & Credit Memo for returned damaged items               |
+-----------------------------------------------------------------------------------+
```

---

## Task 2 — Send trip results to SAP

### 1. Trip Statuses Lifecycle

A trip and its stops progress through the following sequential status transitions:

| Status | Next status | What moves it | Who does it |
|---|---|---|---|
| `PLANNED` | `SENT_TO_TRANSPORTER` | Route optimization engine finishes grouping daily deliveries into optimized routes. | LMS System |
| `SENT_TO_TRANSPORTER` | `ASSIGNED` | Transporter inputs vehicle truck number (`KA-01-AB-1234`) and driver details (`Ravi K`). | Transport Manager |
| `ASSIGNED` | `DISPATCHED` | Driver taps "Start Trip" button on the mobile partner app at depot. | Driver (Partner App) |
| `DISPATCHED` | `ARRIVED_AT_STOP` | GPS geofence auto-triggers or driver manually taps "Arrived at Shop". | Driver / Mobile App |
| `ARRIVED_AT_STOP` | `STOP_COMPLETED` | Driver enters delivered/returned quantities, selects return reason, captures POD photo, and saves. | Driver (Partner App) |
| `STOP_COMPLETED` | `TRIP_COMPLETED` | All assigned stops in the trip manifest reach `STOP_COMPLETED` status. | LMS System / App |
| `TRIP_COMPLETED` | `POSTED_TO_SAP` | LMS integration worker successfully transmits execution results and POD links to SAP. | LMS Integration Engine |

**Per-Stop Execution Outcomes (`stop.result`):**
* `DELIVERED`: $100\%$ of items accepted by shop.
* `PART_DELIVERED`: Partial acceptance; subset of items returned with return reason code.
* `REJECTED_RETURNED`: $100\%$ of items rejected by shop (e.g., store closed, order canceled).
* `SKIPPED_FAILED`: Driver unable to complete stop (e.g., road blocked, access issue).

---

### 2. Results Fields & Sample Record

#### Results Field Specifications Sent to SAP

| Field | Type | Example | Description |
|---|---|---|---|
| `event_id` | text | `"evt_01J9ZQ4K7M2X"` | Unique event ID for webhook idempotency and deduplication. |
| `sap_delivery_number` | text(10) | `"0080001235"` | SAP delivery document number (with leading zeros). |
| `shop_code` | text | `"0000100317"` | Customer shop code. |
| `material` / `item_code` | text | `"FG-3010"` | Material SKU product code. |
| `loaded_qty` | integer | `40` | Quantity loaded onto truck at depot. |
| `delivered_qty` | integer | `36` | Actual quantity accepted by shop. |
| `returned_qty` | integer | `4` | Quantity returned to depot. |
| `return_reason` | text | `"DAMAGED"` | Standardized return reason code (`DAMAGED`, `EXPIRED`, `WRONG_ITEM`, `STORE_CLOSED`). |
| `pod_photo_url` | text (URL) | `"https://partner.example.com/pod/TRP-BLR-20261002-07/2.jpg"` | Cloud URL of signed Proof of Delivery image. |
| `recorded_at` | date-time (ISO) | `"2026-10-02T11:40:03+05:30"` | Authoritative timestamp when driver saved result on device. |
| `sent_at` | date-time (ISO) | `"2026-10-02T11:42:15+05:30"` | Timestamp when mobile app transmitted webhook payload. |
| `location` | object | `{"lat": 12.9352, "lng": 77.6245}` | GPS coordinates at time of stop completion. |

---

#### Sample JSON Record: Part-Delivered Stop (Ganesh Mart `0080001235`)

```json
{
  "event_id": "evt_01J9ZQ4K7M2X",
  "event_type": "stop.result_saved",
  "sent_at": "2026-10-02T11:42:15+05:30",
  "trip_id": "TRP-BLR-20261002-07",
  "truck_number": "KA-01-AB-1234",
  "driver": {
    "name": "Ravi K",
    "phone": "+91-98450-00000"
  },
  "stop": {
    "sequence": 2,
    "sap_delivery_number": "0080001235",
    "shop_code": "0000100317",
    "result": "PART_DELIVERED",
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
        "delivered_qty": 36,
        "returned_qty": 4,
        "return_reason": "DAMAGED"
      }
    ],
    "pod_photo_url": "https://partner.example.com/pod/TRP-BLR-20261002-07/2.jpg",
    "recorded_at": "2026-10-02T11:40:03+05:30",
    "location": {
      "lat": 12.9352,
      "lng": 77.6245
    }
  }
}
```

---

#### Granularity Choice: Per Item or Per Delivery?

**Selection:** **Per Item Level Synchronization (with Delivery Header Summary)**

**Justification:**
1. **Accurate Stock & Financial Accounting:** In FMCG distribution, physical damage or shortage happens at the SKU line-item level (e.g., 4 damaged cases of Instant Noodles `FG-3010` out of 40 loaded, while 10 cases of Masala Pack `FG-1001` are fully accepted). Line-item reporting allows SAP to execute Post Goods Issue (PGI) for delivered quantities and automatically generate a Credit Memo / Return Order for the exact returned SKU.
2. **Specific Return Reasons:** Different materials in a single delivery can have different return reasons (e.g., Item A is `DAMAGED`, Item B is `EXPIRED`). Aggregating results at the delivery level destroys this operational visibility.

---

### 3. Integration Test Cases (Given / When / Then)

#### Test Case 1: Partial Delivery with Damaged Item Return (Standard Case)
* **Given:** Delivery `0080001235` for Ganesh Mart with 10 cases of `FG-1001` and 40 cases of `FG-3010` loaded.
* **When:** Driver delivers full `FG-1001` (10 cases) but returns 4 cases of `FG-3010` marked as `DAMAGED`.
* **Then:** SAP receives `delivered_qty = 36`, `returned_qty = 4`, `return_reason = DAMAGED` for `FG-3010`, and delivery status `PART_DELIVERED`.

#### Test Case 2: Missing Gross Weight Handling (Failure Recovery)
* **Given:** SAP sends delivery `0080001236` for New Fresh Mart where gross weight column `BRGEW` is empty/null, but quantity is 50 CASES of product `FG-2003`.
* **When:** LMS Ingestion Engine processes the delivery file.
* **Then:** LMS calculates total weight using Product Master (`50 cases * 4.0 kg/case = 200.0 kg`), logs warning `WARNING_WEIGHT_CALCULATED`, and successfully admits the delivery into route optimization.

#### Test Case 3: Unknown Shop Code Quarantine (Data Integrity Failure)
* **Given:** SAP sends delivery `0080001237` with customer shop code `0000100999` (Om Provisions), which is not present in LMS Shop Master.
* **When:** LMS performs master data validation during file ingestion.
* **Then:** LMS rejects delivery, sets status to `ERROR_QUARANTINE`, prevents auto-creation of master data, and triggers an automated exception alert to the SAP Master Data team.

#### Test Case 4: Duplicate Webhook Transmission (Idempotency)
* **Given:** Partner app transmits stop completion webhook `evt_01J9ZQ4K7M2X`, but a cellular retry sends the exact same payload 30 seconds later.
* **When:** LMS Webhook Receiver processes the second request.
* **Then:** LMS checks Redis cache for `event_id`, detects a duplicate, bypasses database/SAP updates, and returns `HTTP 200 OK` with response `{"status": "DUPLICATE_IGNORED"}`.

#### Test Case 5: Offline Driver Execution & Delayed Batch Sync
* **Given:** Driver completes delivery for `0080001234` (Sri Balaji Stores) in a basement store with no cellular coverage (`recorded_at` = 11:40:03).
* **When:** Mobile connectivity is restored at 11:42:15, and the partner app syncs the queued event (`sent_at` = 11:42:15).
* **Then:** LMS accepts the webhook, uses `recorded_at` as the authoritative execution timestamp for SLA tracking, updates stop status to `DELIVERED`, and pushes results to SAP.

#### Test Case 6: Full Delivery Rejection (Store Closed)
* **Given:** Delivery `0080001240` for Royal Kirana with 80 cases of `FG-5002` loaded.
* **When:** Driver arrives at shop and finds store closed, marking `delivered_qty = 0`, `returned_qty = 80`, reason `STORE_CLOSED`.
* **Then:** LMS updates stop status to `REJECTED_RETURNED`, alerts depot manager to expect 80 returned cases, and signals SAP to hold billing invoice generation.

---

## Task 3 — APIs and webhooks

### 1. Master Data APIs Table

LMS exposes the following REST APIs for SAP to initialize and update master data entities:

| Name / Master Entity | Method | Endpoint | Main fields |
|---|---|---|---|
| Create / Update Shop | `POST` / `PUT` | `/api/v1/master/shops` | `shop_code`, `shop_name`, `city`, `pin_code`, `latitude`, `longitude`, `zone_code`, `delivery_window` |
| Create / Update Delivery Location | `POST` / `PUT` | `/api/v1/master/locations` | `location_code`, `location_name`, `location_type` (`DEPOT`/`PLANT`), `city`, `latitude`, `longitude` |
| Create / Update Zone | `POST` / `PUT` | `/api/v1/master/zones` | `zone_code`, `zone_name`, `region`, `servicing_depot_code`, `active_flag` |
| Create / Update Truck Type | `POST` / `PUT` | `/api/v1/master/truck-types` | `truck_type_code`, `type_name`, `max_weight_capacity_kg`, `max_volume_m3`, `refrigerated_flag` |
| Create / Update Transport Company | `POST` / `PUT` | `/api/v1/master/transporters` | `transporter_code`, `company_name`, `contact_person`, `phone`, `email`, `contract_status` |
| Create / Update Freight Rate | `POST` / `PUT` | `/api/v1/master/freight-rates` | `rate_id`, `transporter_code`, `zone_code`, `truck_type_code`, `base_rate`, `per_km_rate`, `effective_date` |
| Create / Update Product | `POST` / `PUT` | `/api/v1/master/products` | `product_code`, `product_name`, `unit` (`CASE`/`PIECE`), `weight_kg_per_unit`, `volume_m3_per_unit` |

---

### 2. Webhook Events Table

Webhooks emitted by Partner App to LMS:

| Event | When it's sent | Data |
|---|---|---|
| `trip.started` | Driver starts the trip at depot | `event_id`, `trip_id`, `truck_number`, `driver` (`name`, `phone`), `odometer_reading`, `started_at`, `location` |
| `stop.result_saved` | Driver completes stop entry (Full / Partial / Returned) | `event_id`, `trip_id`, `truck_number`, `driver`, `stop` (`sequence`, `sap_delivery_number`, `shop_code`, `result`, `items` array, `pod_photo_url`, `recorded_at`, `location`), `sent_at` |
| `pod.uploaded` | Digital POD image completes cloud CDN upload | `event_id`, `sap_delivery_number`, `pod_photo_url`, `file_size_bytes`, `md5_hash`, `uploaded_at` |
| `trip.completed` | Driver completes final stop and returns vehicle to depot | `event_id`, `trip_id`, `truck_number`, `total_stops_completed`, `end_odometer`, `completed_at` |

---

### 3. Three Short Answers

#### (a) What should happen if the same event arrives twice? (Idempotency)

**Explanation:**  
Cellular network retries often cause duplicate HTTP POST requests. To achieve **idempotency**:
1. Every partner app event payload includes a unique `event_id` (e.g., `evt_01J9ZQ4K7M2X`).
2. Upon receiving a webhook, LMS checks Redis storage using `event_id` as key.
3. If `event_id` does **not** exist: LMS saves the key with a 7-day TTL, executes database transactions, and notifies SAP.
4. If `event_id` **already exists**: LMS recognizes the duplicate, skips business logic and inventory updates, and immediately returns `HTTP 200 OK` with `{"status": "DUPLICATE_IGNORED"}`.

---

#### (b) What should happen if the LMS is down when an event is sent? (Retry Strategy)

**Explanation:**  
When LMS is unreachable (`500/502/503/504` errors or timeout):
1. **Client-Side Storage:** The partner mobile app persists completed stop events locally in an encrypted SQLite database with status `PENDING_SYNC`.
2. **Exponential Backoff & Jitter:** The mobile background sync worker automatically retries sending the payload using exponential backoff with randomized jitter:
   $$t_{\text{retry}} = \min(1800,\, 5 \times 2^{\text{attempt}} + \text{rand}(0, 5))\text{ seconds}$$
   (Retries: $5\text{s} \rightarrow 15\text{s} \rightarrow 45\text{s} \rightarrow 2\text{m} \rightarrow 5\text{m} \rightarrow 15\text{m} \rightarrow \text{every 30m}$ for up to 24 hours).
3. **Order Preservation:** Queued webhooks for the same trip are processed in strict chronological sequence using `recorded_at`.

---

#### (c) What should happen if SAP sends a delivery for a shop the LMS doesn't have? (Unknown Shop Handling)

**Explanation:**  
When SAP sends delivery `0080001237` for shop `0000100999` (Om Provisions) which is missing from LMS Shop Master:
1. **Strict Data Governance (No Auto-Creation):** LMS **must not auto-create** shop records from transactional delivery files. Auto-creation causes missing GPS geofences, wrong delivery zones, and broken route optimization.
2. **Quarantine Isolation:** LMS moves the delivery into an `ERROR_QUARANTINE` state, preventing it from being routed into dispatch trips.
3. **Automated Notification:** LMS sends an automated alert email and creates a ticket for the SAP Master Data Governance team to create/sync Shop `0000100999` via the Master API (`/api/v1/master/shops`). Once synced, LMS auto-releases quarantined deliveries into planning.

---

## Bonus Section

### 1. SAP Delivery File Processing Python Script

Below is the complete Python script designed to process `SAP_delivery_sample.csv`, group rows by delivery number (`VBELN`), calculate item counts and total weights, and safely flag missing weights (`0080001236`) and unknown shops (`0000100999` Om Provisions) without crashing.

#### Python Source Code (`parse_sap_deliveries.py`)

```python
import csv
from collections import defaultdict

# Master dataset of valid LMS normalized shop codes (Om Provisions 100999 is intentionally omitted)
KNOWN_LMS_SHOPS = {
    "100245", "100317", "100402", "100118", "100533",
    "100274", "100650", "100381", "100712", "100159", "100826"
}

def parse_sap_deliveries(file_path):
    """
    Parses SAP delivery sample CSV, groups by VBELN, computes item counts and total weight,
    and flags data quality issues (missing weights, unknown shops) without crashing.
    """
    deliveries = defaultdict(list)
    
    # Read CSV file safely
    try:
        with open(file_path, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                vbeln = row.get('VBELN', '').strip()
                if vbeln:
                    deliveries[vbeln].append(row)
    except FileNotFoundError:
        print(f"[ERROR] File not found at path: {file_path}")
        return
    except Exception as e:
        print(f"[ERROR] Unexpected error reading CSV: {e}")
        return

    print("=" * 95)
    print(f"{'SENNA FOODS - SAP DELIVERY INGESTION SUMMARY REPORT':^95}")
    print("=" * 95)
    print(f"{'Delivery #':<12} | {'Shop Code':<10} | {'Shop Name':<25} | {'Items':<6} | {'Total Weight':<14} | {'Status & Quality Flags'}")
    print("-" * 95)

    for vbeln, items in deliveries.items():
        # Extract raw shop code and normalize by stripping leading zeros
        raw_kunnr = items[0].get('KUNNR', '').strip()
        shop_name = items[0].get('NAME1', '').strip()
        shop_code = raw_kunnr.lstrip('0') if raw_kunnr else 'N/A'
        
        item_count = len(items)
        total_weight = 0.0
        missing_weight_flag = False
        
        for item in items:
            brgew_raw = item.get('BRGEW', '').strip()
            if not brgew_raw:
                missing_weight_flag = True
            else:
                try:
                    total_weight += float(brgew_raw)
                except ValueError:
                    missing_weight_flag = True

        # Master data shop validation
        is_unknown_shop = shop_code not in KNOWN_LMS_SHOPS

        # Flag construction
        flags = []
        if is_unknown_shop:
            flags.append(f"CRITICAL: Unknown Shop ({raw_kunnr}) -> Quarantined")
        if missing_weight_flag:
            flags.append("WARNING: Missing Item Weight")

        status_display = "OK (Valid)" if not flags else " | ".join(flags)
        weight_display = f"{total_weight:.2f} kg" if not missing_weight_flag else "INCOMPLETE"

        print(f"{vbeln:<12} | {shop_code:<10} | {shop_name:<25} | {item_count:<6} | {weight_display:<14} | {status_display}")

    print("=" * 95)

if __name__ == '__main__':
    parse_sap_deliveries('SAP_delivery_sample.csv')
```

---

#### Console Execution Output

```
===============================================================================================
                       SENNA FOODS - SAP DELIVERY INGESTION SUMMARY REPORT
===============================================================================================
Delivery #   | Shop Code  | Shop Name                 | Items  | Total Weight   | Status & Quality Flags
-----------------------------------------------------------------------------------------------
0080001234   | 100245     | Sri Balaji Stores         | 2      | 400.00 kg      | OK (Valid)
0080001235   | 100317     | Ganesh Mart               | 2      | 400.00 kg      | OK (Valid)
0080001236   | 100402     | New Fresh Mart            | 1      | INCOMPLETE     | WARNING: Missing Item Weight
0080001237   | 100999     | Om Provisions             | 1      | 125.00 kg      | CRITICAL: Unknown Shop (0000100999) -> Quarantined
0080001238   | 100118     | Lakshmi Traders           | 3      | 225.00 kg      | OK (Valid)
0080001239   | 100533     | Annapoorna Supermarket    | 2      | 500.00 kg      | OK (Valid)
0080001240   | 100274     | Royal Kirana              | 1      | 400.00 kg      | OK (Valid)
0080001241   | 100650     | Daily Needs Store         | 2      | 300.00 kg      | OK (Valid)
0080001242   | 100381     | Venkateshwara Provisions  | 2      | 350.00 kg      | OK (Valid)
0080001243   | 100712     | Green Basket              | 2      | 375.00 kg      | OK (Valid)
0080001244   | 100159     | Sai Ram Stores            | 1      | 300.00 kg      | OK (Valid)
0080001245   | 100826     | City Fresh Mart           | 2      | 375.00 kg      | OK (Valid)
===============================================================================================
```

---

### 2. Email to the Client (SAP Team)

**Subject:** Action Needed: Delivery Data Errors in Daily SAP Feed (Deliveries 0080001236 & 0080001237)

Hi Senna Foods SAP Team,

Our automated system processed today’s delivery file and flagged two data issues that need your attention:

1. **Delivery 0080001236 (New Fresh Mart):** The item weight column is blank. Without weight information, our system cannot assign this delivery to a truck.
2. **Delivery 0080001237 (Om Provisions):** Shop code `0000100999` is not registered in our system master list. This delivery has been put on hold to prevent dispatch errors.

**What we need you to fix:**
* Please add the missing item weight for Delivery 0080001236 in SAP.
* Please create the master record for Shop `0000100999` in SAP so it syncs to our system.

Once fixed, please re-send these two deliveries so we can schedule them for delivery.

Thank you,  
**Implementation Engineering Team**  
*Senna Foods Logistics Integration*
