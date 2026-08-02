#!/usr/bin/env python3
"""
Prüft alle Quellen aus data/source-registry.json auf Änderungen und schreibt
das Ergebnis nach data/source-status.json (von faq.html per fetch() geladen).

Prüfmethoden pro Quelle (Feld "check.method" in der Registry):
  ckan       - opendata.muenchen.de CKAN-API: vergleicht das Änderungsdatum mit dem
               beim letzten Lauf gespeicherten. Nutzt bevorzugt das Extra-Feld
               "GeoPortal Last Modified Date" (echtes Geodaten-Änderungsdatum bei
               Geoportal-Datensätzen), sonst den jüngsten Resource-Zeitstempel.
               CKANs metadata_modified wird bewusst NICHT genutzt: bei Geoportal-
               Datensätzen wird täglich neu geharvestet (neue Resource-IDs) auch
               ohne echte Datenänderung.
  heuristic  - keine Live-Quelle vorhanden (RIS-Mitgliederdaten ändern sich nur bei
               Nachrücken/Rücktritt, nicht zeitbasiert prüfbar). Nutzt das Datum der
               letzten lokalen Änderung (git log) + den bekannten Turnus - ist die
               Datei länger als der Turnus nicht angefasst worden, gilt eine Prüfung
               als fällig.

Aufruf: python3 scripts/check_sources.py [--dry-run]
"""

import json
import subprocess
import sys
import urllib.request
import ssl
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = ROOT / "data" / "source-registry.json"
STATUS_PATH = ROOT / "data" / "source-status.json"

TURNUS_DAYS = {
    "jährlich": 365,
}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def git_last_changed(rel_path):
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%ad", "--date=short", "--", rel_path],
            cwd=ROOT, capture_output=True, text=True, timeout=10,
        )
        d = out.stdout.strip()
        return d or None
    except Exception:
        return None


def fetch(url, timeout=30):
    ctx = ssl.create_default_context()
    ctx.load_verify_locations("/etc/ssl/cert.pem")
    req = urllib.request.Request(url, headers={"User-Agent": "rathausmuc-source-check/1.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
        return resp.read()


def check_ckan(dataset, prev):
    url = f"https://opendata.muenchen.de/api/3/action/package_show?id={dataset}"
    try:
        data = json.loads(fetch(url))
        if not data.get("success"):
            raise RuntimeError(data.get("error"))
        result = data["result"]
        extras = {e["key"]: e["value"] for e in result.get("extras", [])}

        if "GeoPortal Last Modified Date" in extras:
            source_modified = extras["GeoPortal Last Modified Date"]
            source_field = "GeoPortal Last Modified Date"
        else:
            resources = result.get("resources", [])
            stamps = [r.get("last_modified") or r.get("created") for r in resources]
            stamps = [s for s in stamps if s]
            source_modified = max(stamps) if stamps else result.get("metadata_modified")
            source_field = "resource last_modified/created"
    except Exception as e:
        return {"status": "unknown", "detail": f"CKAN-Abruf fehlgeschlagen: {e}"}

    prev_modified = (prev or {}).get("source_modified")
    changed = prev_modified is not None and prev_modified != source_modified
    return {
        "status": "changed" if changed else "ok",
        "source_modified": source_modified,
        "detail": (f"Quelle wurde seit letzter Prüfung aktualisiert (laut {source_field})." if changed
                   else f"Laut Portal zuletzt geändert am {source_modified} ({source_field}), keine Änderung seit letzter Prüfung."),
    }


def check_heuristic(source):
    files = source.get("files", [])
    dates = [git_last_changed(f) for f in files]
    dates = [d for d in dates if d]
    last_changed = max(dates) if dates else None

    turnus = source.get("turnus", "")
    interval_days = None
    for key, days in TURNUS_DAYS.items():
        if key in turnus:
            interval_days = days
            break

    if not last_changed or interval_days is None:
        return {
            "status": "manual",
            "local_updated": last_changed,
            "detail": "Kein automatischer Änderungscheck möglich (keine Live-API, kein fester Turnus). Turnus: " + (turnus or "unbekannt"),
        }

    age_days = (datetime.now().date() - datetime.strptime(last_changed, "%Y-%m-%d").date()).days
    due = age_days > interval_days
    return {
        "status": "check_due" if due else "ok",
        "local_updated": last_changed,
        "detail": (f"Seit {age_days} Tagen nicht aktualisiert, Turnus ist '{turnus}' – Prüfung beim Original empfohlen." if due
                   else f"Zuletzt aktualisiert vor {age_days} Tagen, Turnus '{turnus}' noch nicht erreicht."),
    }


def main():
    dry_run = "--dry-run" in sys.argv
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    prev_status = {}
    if STATUS_PATH.exists():
        prev_status = json.loads(STATUS_PATH.read_text(encoding="utf-8")).get("sources", {})

    results = {}
    for cat in registry["categories"]:
        for source in cat["sources"]:
            sid = source["id"]
            method = source["check"]["method"]
            local_updated = None
            for f in source.get("files", []):
                d = git_last_changed(f)
                if d:
                    local_updated = d
                    break

            if method == "ckan":
                result = check_ckan(source["check"]["dataset"], prev_status.get(sid))
            elif method == "heuristic":
                result = check_heuristic(source)
            else:
                result = {"status": "unknown", "detail": f"Unbekannte Methode: {method}"}

            result.setdefault("local_updated", local_updated)
            result["method"] = method
            result["checked_at"] = now_iso()
            results[sid] = result
            print(f"{sid:30s} [{method:10s}] -> {result['status']}")

    if dry_run:
        print("\n--dry-run: nichts geschrieben.")
        return

    STATUS_PATH.write_text(
        json.dumps({"generated_at": now_iso(), "sources": results}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"\nGeschrieben: {STATUS_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
