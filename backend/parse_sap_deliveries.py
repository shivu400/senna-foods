import csv
from collections import defaultdict

# Master dataset of valid LMS normalized shop codes (Om Provisions 100999 is intentionally omitted)
KNOWN_LMS_SHOPS = {
    "100245", "100317", "100402", "100118", "100533",
    "100274", "100650", "100381", "100712", "100159", "100826"
}

def parse_sap_deliveries(file_path):
    deliveries = defaultdict(list)
    
    # Read CSV safely
    try:
        with open(file_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                vbeln = row.get('VBELN', '').strip()
                if vbeln:
                    deliveries[vbeln].append(row)
    except FileNotFoundError:
        print(f"Error: File {file_path} not found.")
        return

    print("\n" + "=" * 95)
    print(f"{'DELIVERY #':<12} | {'SHOP CODE':<10} | {'SHOP NAME':<26} | {'ITEMS':<6} | {'TOTAL WEIGHT':<15} | {'STATUS'}")
    print("=" * 95)

    for vbeln, items in deliveries.items():
        raw_kunnr = items[0].get('KUNNR', '').strip()
        shop_code = raw_kunnr.lstrip('0') if raw_kunnr else 'UNKNOWN'
        shop_name = items[0].get('NAME1', '').strip()
        
        total_weight = 0.0
        has_missing_weight = False
        item_count = len(items)
        
        for item in items:
            brgew_str = item.get('BRGEW', '').strip()
            if not brgew_str:
                has_missing_weight = True
            else:
                try:
                    total_weight += float(brgew_str)
                except ValueError:
                    has_missing_weight = True

        # Problem flagging rules
        status_flags = []
        if shop_code not in KNOWN_LMS_SHOPS:
            status_flags.append(f"UNKNOWN SHOP ({raw_kunnr})")
        if has_missing_weight:
            status_flags.append("MISSING WEIGHT")
            
        status_str = "OK (Valid)" if not status_flags else "FLAGGED: " + ", ".join(status_flags)

        weight_str = f"{total_weight:.2f} kg" if not has_missing_weight else f"{total_weight:.2f} kg (Incomplete)"
        
        print(f"{vbeln:<12} | {shop_code:<10} | {shop_name:<26} | {item_count:<6} | {weight_str:<15} | {status_str}")

    print("=" * 95 + "\n")

if __name__ == "__main__":
    parse_sap_deliveries("SAP_delivery_sample.csv")
