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
