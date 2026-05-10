#!/bin/bash
# Generates byedoom.com RSS feed URLs for stadtrat.csv — run once per day (limit: 10 new feeds/day)
# Usage: ./generate_feeds.sh

CSV="data/stadtrat.csv"
ENDPOINT="https://qgesqcymfpqykxgkrxiu.supabase.co/functions/v1/discover-feed"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnZXNxY3ltZnBxeWt4Z2tyeGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5OTAwNzIsImV4cCI6MjA4ODU2NjA3Mn0.T96ALzZEufigD9hedWrgoPkaIDzxUaNVBqekYy3ZyXI"
TMP=$(mktemp)

python3 - "$CSV" "$ENDPOINT" "$ANON_KEY" <<'PYEOF'
import sys, csv, json, time, subprocess

CSV_FILE = sys.argv[1]
ENDPOINT = sys.argv[2]
ANON_KEY = sys.argv[3]

FEED_MAP = [
    ("Instagram", "Feed_Instagram", "instagram.com"),
    ("Facebook",  "Feed_Facebook",  "facebook.com"),
    ("TikTok",    "Feed_TikTok",    "tiktok.com"),
]

def discover(url):
    result = subprocess.run([
        "curl", "-s", "-X", "POST", ENDPOINT,
        "-H", "Content-Type: application/json",
        "-H", f"apikey: {ANON_KEY}",
        "-H", f"Authorization: Bearer {ANON_KEY}",
        "-d", json.dumps({"url": url})
    ], capture_output=True, text=True, timeout=20)
    try:
        d = json.loads(result.stdout)
        if d.get("success") and d.get("feeds"):
            return d["feeds"][0]["url"], d.get("type","")
        if not d.get("success"):
            return None, d.get("error","unknown")
    except Exception as e:
        return None, str(e)
    return None, "no feeds"

with open(CSV_FILE) as f:
    reader = csv.DictReader(f)
    fieldnames = list(reader.fieldnames)
    rows = list(reader)

for _, feed_col, _ in FEED_MAP:
    if feed_col not in fieldnames:
        fieldnames.append(feed_col)

generated = 0
skipped   = 0
failed    = 0

for i, row in enumerate(rows):
    name = f"{row.get('Vorname','')} {row.get('Nachname','')}".strip()
    for src_col, feed_col, domain in FEED_MAP:
        url = row.get(src_col, "").strip()
        if not url or domain not in url:
            continue
        if row.get(feed_col, "").strip():
            skipped += 1
            continue
        print(f"  [{i+1}] {name} / {src_col}: {url}")
        feed_url, info = discover(url)
        if feed_url:
            row[feed_col] = feed_url
            print(f"        ✓ [{info}] {feed_url}")
            generated += 1
        elif info == "daily limit":
            print(f"        ✗ Tageslimit erreicht — abgebrochen.")
            # Write what we have so far
            with open(CSV_FILE, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            total_remaining = sum(
                1 for r in rows
                for sc, fc, dom in FEED_MAP
                if r.get(sc,"") and dom in r.get(sc,"") and not r.get(fc,"")
            )
            print(f"\n  Heute generiert: {generated}  |  Noch fehlend: {total_remaining}")
            sys.exit(0)
        else:
            print(f"        ✗ Fehler: {info}")
            failed += 1
        time.sleep(0.8)

with open(CSV_FILE, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

total_remaining = sum(
    1 for r in rows
    for sc, fc, dom in FEED_MAP
    if r.get(sc,"") and dom in r.get(sc,"") and not r.get(fc,"")
)

print(f"\n  Heute generiert: {generated}  |  Fehler: {failed}  |  Noch fehlend: {total_remaining}")
if total_remaining == 0:
    print("  ✓ Alle Feed-URLs vollständig!")
PYEOF
