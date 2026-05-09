#!/usr/bin/env python3
"""
Bezirksausschuss-Scraper: RIS → data/ba{NN}.csv, mit Wahlergebnis-Anreicherung.
Aufruf: python3 scrape_ba.py 1          (einzelner BA)
        python3 scrape_ba.py 1 2 3      (mehrere BAs)
        python3 scrape_ba.py all        (alle 25 BAs)
"""
import csv
import os
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
from bs4 import BeautifulSoup

# ─── Konfiguration ─────────────────────────────────────────────────────────────

RIS_BASE     = 'https://risi.muenchen.de/risi'
WAHLERG_BASE = 'https://www.wahlen-muenchen.de/ergebnisse/2_20260308bezirksausschusswahl'
DELAY        = 1.2
DATA_DIR     = os.path.join(os.path.dirname(__file__), 'data')

BAS = {
     1: {'name': 'BA 01 · Altstadt-Lehel',                                         'gremiumid': 210},
     2: {'name': 'BA 02 · Ludwigsvorstadt-Isarvorstadt',                            'gremiumid': 211},
     3: {'name': 'BA 03 · Maxvorstadt',                                             'gremiumid': 212},
     4: {'name': 'BA 04 · Schwabing-West',                                          'gremiumid': 213},
     5: {'name': 'BA 05 · Au-Haidhausen',                                           'gremiumid': 214},
     6: {'name': 'BA 06 · Sendling',                                                'gremiumid': 215},
     7: {'name': 'BA 07 · Sendling-Westpark',                                       'gremiumid': 216},
     8: {'name': 'BA 08 · Schwanthalerhöhe',                                        'gremiumid': 217},
     9: {'name': 'BA 09 · Neuhausen-Nymphenburg',                                   'gremiumid': 218},
    10: {'name': 'BA 10 · Moosach',                                                  'gremiumid': 219},
    11: {'name': 'BA 11 · Milbertshofen-Am Hart',                                    'gremiumid': 220},
    12: {'name': 'BA 12 · Schwabing-Freimann',                                       'gremiumid': 221},
    13: {'name': 'BA 13 · Bogenhausen',                                              'gremiumid': 222},
    14: {'name': 'BA 14 · Berg am Laim',                                             'gremiumid': 223},
    15: {'name': 'BA 15 · Trudering-Riem',                                           'gremiumid': 224},
    16: {'name': 'BA 16 · Ramersdorf-Perlach',                                       'gremiumid': 225},
    17: {'name': 'BA 17 · Obergiesing-Fasangarten',                                  'gremiumid': 226},
    18: {'name': 'BA 18 · Untergiesing-Harlaching',                                  'gremiumid': 227},
    19: {'name': 'BA 19 · Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln',   'gremiumid': 228},
    20: {'name': 'BA 20 · Hadern',                                                   'gremiumid': 229},
    21: {'name': 'BA 21 · Pasing-Obermenzing',                                       'gremiumid': 230},
    22: {'name': 'BA 22 · Aubing-Lochhausen-Langwied',                               'gremiumid': 231},
    23: {'name': 'BA 23 · Allach-Untermenzing',                                      'gremiumid': 232},
    24: {'name': 'BA 24 · Feldmoching-Hasenbergl',                                   'gremiumid': 233},
    25: {'name': 'BA 25 · Laim',                                                     'gremiumid': 234},
}

CSV_COLS = [
    'Nachname', 'Vorname', 'Geschlecht', 'ID', 'Titel', 'Partei',
    'Wahlperiode', 'E-Mail', 'Website', 'Büro-Adresse',
    'Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'Mastodon',
    'RIS-Link', 'Image', 'Wahldatum', 'Mandatsbeginn', 'Listenplatz', 'Stimmen',
    'Lebenslauf',
    'Ausschuss 1', 'Ausschuss 2', 'Ausschuss 3', 'Ausschuss 4',
    'Ausschuss 5', 'Ausschuss 6', 'Ausschuss 7', 'Ausschuss 8',
]

PARTEI_CHOICES = [
    'CSU', 'SPD', 'Die Grünen', 'Freie Wähler', 'AfD', 'FDP',
    'Die Linke', 'Volt', 'ÖDP', 'Die PARTEI', 'Rosa Liste', 'München Liste', 'BK',
]

PARTEI_MAP = {
    'die linke.':              'Die Linke',
    'die linke':               'Die Linke',
    'grüne':                   'Die Grünen',
    'bündnis 90/die grünen':   'Die Grünen',
    'freie wähler':            'Freie Wähler',
    'die partei':              'Die PARTEI',
    'oedp':                    'ÖDP',
    'oedp.':                   'ÖDP',
}

def normalize_partei(raw):
    key = raw.strip().lower()
    if key in PARTEI_MAP:
        return PARTEI_MAP[key]
    for choice in PARTEI_CHOICES:
        if choice.lower() == key:
            return choice
    return raw.strip() or None

TITEL_PREFIXES = re.compile(
    r'^(Dr\.|Prof\.|Dr\.-Ing\.|Dr\.med\.|Prof\.Dr\.|Prof\.\s*Dr\.)\s*', re.IGNORECASE
)

# ─── HTTP-Helfer ───────────────────────────────────────────────────────────────

HEADERS = [
    '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
    '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H', 'Accept-Language: de,en;q=0.9',
]

def curl(url, extra=None):
    cmd = ['curl', '-s', '-L', url] + HEADERS + (extra or [])
    return subprocess.run(cmd, capture_output=True).stdout.decode('utf-8', errors='replace')

# ─── 1. Übersichtsseite → aktuelle Mitglieder (Wicket-AJAX) ──────────────────

def get_members_from_overview(gremiumid):
    cookie_file = tempfile.mktemp(suffix='.txt')
    overview_url = f'{RIS_BASE}/gremium/detail/{gremiumid}?tab=mitgliederaktuell'

    html = subprocess.run(
        ['curl', '-s', '-L', '-c', cookie_file, overview_url] + HEADERS,
        capture_output=True
    ).stdout.decode('utf-8', errors='replace')

    sid_m = re.search(r'jsessionid=([A-F0-9a-f]+)', html)
    if not sid_m:
        raise RuntimeError(f'Keine Session-ID für gremiumid={gremiumid}')
    sid = sid_m.group(1)

    ajax_url = (
        f'{RIS_BASE}/gremium/detail/{gremiumid};jsessionid={sid}'
        f'?0-1.0-typedSectionsPanel-tabcontainer-containerAktuelleMitglieder'
        f'-mitgliederAktuellListSection-sectionContainer-list-card-cardheader'
        f'-itemsperpage_dropdown_top&tab=mitgliederaktuell'
    )
    post_data = (
        'typedSectionsPanel%3Atabcontainer%3AcontainerAktuelleMitglieder'
        '%3AmitgliederAktuellListSection%3AsectionContainer%3Alist%3Acard'
        '%3Acardheader%3Aitemsperpage_dropdown_top=3'
    )
    ajax_resp = subprocess.run(
        ['curl', '-s', '-X', 'POST', ajax_url,
         '-b', cookie_file,
         '-H', 'Accept: application/xml, text/xml, */*; q=0.01',
         '-H', 'Wicket-Ajax: true',
         '-H', f'Wicket-Ajax-BaseURL: gremium/detail/{gremiumid}?tab=mitgliederaktuell',
         '-H', 'X-Requested-With: XMLHttpRequest',
         '-H', 'Content-Type: application/x-www-form-urlencoded',
         '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
         '-d', post_data],
        capture_output=True
    ).stdout.decode('utf-8', errors='replace')

    cdata = re.findall(r'<!\[CDATA\[(.*?)\]\]>', ajax_resp, re.DOTALL)
    soup  = BeautifulSoup(' '.join(cdata), 'html.parser')
    links = soup.find_all('a', href=re.compile(r'/person/detail/\d+'))

    seen, members = set(), []
    for a in links:
        m = re.search(r'/person/detail/(\d+)', a['href'])
        if not m:
            continue
        pid = m.group(1)
        if pid in seen:
            continue
        seen.add(pid)

        full     = a.get_text(strip=True)
        anrede_m = re.match(r'^(Herr|Frau)\s+', full)
        anrede   = anrede_m.group(1) if anrede_m else ''
        raw      = full[anrede_m.end():] if anrede_m else full
        title_m  = re.match(r'^(Dr\.|Prof\.|Dr\.-Ing\.)\s+', raw)
        if title_m:
            raw = raw[title_m.end():]
        parts    = raw.split(None, 1)
        members.append({
            'id':      pid,
            'vorname': parts[0] if parts else '',
            'nachname':parts[1] if len(parts) > 1 else '',
            'anrede':  anrede,
        })
    return members

# ─── 2. RIS-Detailseite ────────────────────────────────────────────────────────

SOCIAL_PATTERNS = {
    'Instagram': re.compile(r'instagram\.com/([^/"?\s]+)', re.I),
    'Facebook':  re.compile(r'facebook\.com/([^/"?\s]+)', re.I),
    'LinkedIn':  re.compile(r'linkedin\.com/in/([^/"?\s]+)', re.I),
    'TikTok':    re.compile(r'tiktok\.com/@([^/"?\s]+)', re.I),
    'Mastodon':  re.compile(r'(mastodon\.[^/"?\s]+/@[^/"?\s]+)', re.I),
}

GENERIC_URLS = re.compile(
    r'(www\.muenchen\.de|de-de\.facebook\.com/muenchen|twitter\.com/muenchen'
    r'|facebook\.com/muenchen/?$)',
    re.I
)

def scrape_detail(pid):
    url  = f'{RIS_BASE}/person/detail/{pid}'
    html = curl(url)
    soup = BeautifulSoup(html, 'html.parser')
    res  = {'id': str(pid), 'ris_link': url}

    name_el = soup.find('h1') or soup.find(class_='headline')
    if name_el:
        text = name_el.get_text()
        if 'Dr.' in text:
            res['titel'] = 'Prof. Dr.' if 'Prof.' in text else 'Dr.'

    if re.search(rf'bild/{pid}["\']', html):
        res['image'] = f'{RIS_BASE}/bild/{pid}'

    for row in soup.find_all(class_='keyvalue-row'):
        key_el = row.find(class_='keyvalue-key')
        val_el = row.find(class_='keyvalue-value')
        if not key_el or not val_el:
            continue
        key = key_el.get_text(strip=True).lower()

        if 'partei' in key:
            raw = val_el.get_text(strip=True)
            if raw:
                res['partei'] = normalize_partei(raw) or raw

        elif 'mail' in key:
            for a in val_el.find_all('a', href=True):
                if not a['href'].startswith('mailto:'):
                    continue
                if 'Geschäftsstelle' in a.get_text():
                    continue
                res.setdefault('email', a['href'][7:].split('?')[0])

        elif any(k in key for k in ('website', 'internet', 'homepage', 'web-seite')):
            for a in val_el.find_all('a', href=True):
                href = a['href']
                if not href.startswith('http') or GENERIC_URLS.search(href):
                    continue
                for platform, pat in SOCIAL_PATTERNS.items():
                    if pat.search(href):
                        res.setdefault(platform.lower(), href)
                        break
                else:
                    res.setdefault('website', href)

        elif any(k in key for k in ('instagram', 'facebook', 'linkedin', 'tiktok', 'mastodon')):
            for a in val_el.find_all('a', href=True):
                href = a['href']
                if not href.startswith('http') or GENERIC_URLS.search(href):
                    continue
                for platform, pat in SOCIAL_PATTERNS.items():
                    if pat.search(href):
                        res.setdefault(platform.lower(), href)
                        break

        elif any(k in key for k in ('adresse', 'anschrift', 'straße', 'ort')):
            res['adresse'] = val_el.get_text(strip=True)

        elif any(k in key for k in ('lebenslauf', 'vita', 'biografie')):
            res['lebenslauf'] = val_el.get_text(strip=True)[:2000]

    return res

# ─── 3. Wahlergebnisse ─────────────────────────────────────────────────────────

def norm(s):
    s = unicodedata.normalize('NFC', (s or '').strip())
    return TITEL_PREFIXES.sub('', s).replace('ğ', 'g').replace('ĝ', 'g').lower()

def get_election_results(ba_num):
    url  = f'{WAHLERG_BASE}/bezirksausschusswahl_stadtbezirk_{ba_num}.html'
    html = curl(url)
    soup = BeautifulSoup(html, 'html.parser')
    results = {}

    for article in soup.find_all('article'):
        table = article.find('table')
        if not table:
            continue
        for row in table.find_all('tr'):
            ths = row.find_all('th')
            tds = row.find_all('td')
            if len(ths) < 2 or len(tds) < 3:
                continue
            try:
                int(ths[0].get_text(strip=True))
            except ValueError:
                continue

            gewaehlt = tds[2].get_text(strip=True)
            if 'Nicht' in gewaehlt or 'Nachrücker' in gewaehlt:
                continue

            name_clean = TITEL_PREFIXES.sub('', ths[1].get_text(strip=True)).strip()
            parts      = name_clean.split(' ', 1)
            nachname   = parts[0] if parts else ''
            vorname    = parts[1] if len(parts) > 1 else ''

            try:
                rang    = int(tds[0].get_text(strip=True))
                stimmen = int(tds[1].get_text(strip=True).replace('.', '').replace(',', ''))
            except ValueError:
                continue

            key = (norm(nachname), norm(vorname.split()[0]) if vorname else '')
            results[key] = {'rang': rang, 'stimmen': stimmen}

    return results

# ─── 4. Record aufbauen ────────────────────────────────────────────────────────

def build_record(member, detail):
    return {
        'Nachname':     member['nachname'],
        'Vorname':      member['vorname'],
        'Geschlecht':   member.get('anrede', ''),
        'ID':           detail.get('id', ''),
        'Titel':        detail.get('titel', ''),
        'Partei':       detail.get('partei', ''),
        'Wahlperiode':  '2026-2032',
        'E-Mail':       detail.get('email', ''),
        'Website':      detail.get('website', ''),
        'Büro-Adresse': detail.get('adresse', ''),
        'Instagram':    detail.get('instagram', ''),
        'Facebook':     detail.get('facebook', ''),
        'LinkedIn':     detail.get('linkedin', ''),
        'TikTok':       detail.get('tiktok', ''),
        'Mastodon':     detail.get('mastodon', ''),
        'RIS-Link':     detail.get('ris_link', ''),
        'Image':        detail.get('image', ''),
        'Wahldatum':    '2026-03-08',
        'Mandatsbeginn':'2026-05-01',
        'Listenplatz':  '',
        'Stimmen':      '',
        'Lebenslauf':   detail.get('lebenslauf', ''),
        **{f'Ausschuss {i}': '' for i in range(1, 9)},
    }

# ─── 5. Wahlergebnisse einarbeiten ─────────────────────────────────────────────

def enrich_with_results(records, election_results):
    by_nachname = {}
    for key, res in election_results.items():
        by_nachname.setdefault(key[0], []).append((key, res))

    missing = []
    for rec in records:
        nn  = rec['Nachname']
        vn  = rec['Vorname']
        key = (norm(nn), norm(vn.split()[0]) if vn else '')
        res = election_results.get(key)

        if not res:
            candidates = by_nachname.get(norm(nn), [])
            if len(candidates) == 1:
                res = candidates[0][1]
                print(f'    (Fallback-Match per Nachname: {nn})')

        if res:
            rec['Listenplatz'] = str(res['rang'])
            rec['Stimmen']     = str(res['stimmen'])
        else:
            missing.append(f'{nn}, {vn}')

    return missing

# ─── 6. CSV schreiben ──────────────────────────────────────────────────────────

def write_csv(ba_num, records):
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, f'ba{ba_num:02d}.csv')
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLS, extrasaction='ignore')
        w.writeheader()
        for rec in records:
            w.writerow({col: rec.get(col, '') for col in CSV_COLS})
    return path

# ─── Main ──────────────────────────────────────────────────────────────────────

def process_ba(ba_num):
    config    = BAS[ba_num]
    gremiumid = config['gremiumid']

    print(f'\n{"="*60}')
    print(f'Verarbeite BA {ba_num:02d} (gremiumid={gremiumid})')
    print(f'{"="*60}')

    print(f'Lade Mitgliederliste …')
    members = get_members_from_overview(gremiumid)
    print(f'{len(members)} aktuelle Mitglieder gefunden')

    print('Scrape Detailseiten …')
    records = []
    for m in members:
        print(f'  {m["nachname"]}, {m["vorname"]} (ID {m["id"]}) …', end=' ', flush=True)
        detail = scrape_detail(m['id'])
        records.append(build_record(m, detail))
        print('✓')
        time.sleep(DELAY)

    print(f'\nLade Wahlergebnisse …')
    election_results = get_election_results(ba_num)
    print(f'{len(election_results)} gewählte Personen gefunden')

    missing = enrich_with_results(records, election_results)

    path = write_csv(ba_num, records)
    print(f'\n{len(records)} Records → {path}')

    if missing:
        print(f'Kein Wahlergebnis-Match ({len(missing)}):')
        for m in missing:
            print(f'  {m}')

    print(f'\n✓ BA {ba_num:02d} abgeschlossen.')

if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        print('Aufruf: python3 scrape_ba.py <nummer>  oder  python3 scrape_ba.py all')
        sys.exit(1)

    if args[0] == 'all':
        nums = list(BAS.keys())
    else:
        nums = []
        for a in args:
            n = int(a)
            if n not in BAS:
                print(f'Ungültige BA-Nummer: {n} (gültig: 1–25)')
                sys.exit(1)
            nums.append(n)

    for n in nums:
        process_ba(n)
