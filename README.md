# rathausmuc.de

Stadtrat und Bezirksausschüsse München nach der Kommunalwahl vom 8. März 2026 – 81 Stadtratsmitglieder, 25 Bezirksausschüsse, Netzwerkkarte, Statistiken und Bezirksdaten.

**→ [rathausmuc.de](https://rathausmuc.de)**

---

## Architektur

Statische Single-Page-Application. Hash-basiertes Routing, alles läuft im Browser.

```
index.html              — SPA-Hauptseite
faq.html                — FAQ
impressum.html          — Impressum (noindex)
favicon.svg             — Rathausturm-Icon
js/
  app.js                — App-Logik: Routing, Render-Funktionen, Charts, Popups
  config.js             — GREMIEN, PARTY_COLORS, SOCIAL_ICONS, OPENDATA_INDICATORS
data/
  stadtrat.csv          — 81 Stadtratsmitglieder + Fraktions-/Parteimetadaten für Kumu
  ba01.csv … ba25.csv   — Mitglieder der 25 Bezirksausschüsse
  bezirke.geojson       — Bezirksgrenzen für Leaflet-Karte
  *.csv                 — Open-Data-Indikatoren je Bezirksausschuss (Bevölkerung, Fläche, Mobilität)
  datapackage.json      — Frictionless Data Paketbeschreibung
```

**Libraries (alle per CDN, kein npm):**

| Library | Version | Zweck | Releases |
|---|---|---|---|
| [Leaflet](https://leafletjs.com) | 1.9.4 | Bezirkskarte | [Releases](https://github.com/Leaflet/Leaflet/releases) |
| [Chart.js](https://www.chartjs.org) | 4.4.4 | Fraktions-/Partei-/Sozial-Charts | [Releases](https://github.com/chartjs/Chart.js/releases) |
| [PapaParse](https://www.papaparse.com) | 5.4.1 | CSV-Parsing im Browser | [Releases](https://github.com/mholt/PapaParse/releases) |
| [Kumu](https://kumu.io) | – | Netzwerkkarte (iFrame-Embed) | – |

> **Library-Updates (einmal jährlich prüfen):** Versionsnummern sind fest in den CDN-URLs in `index.html` eingebaut. Release-Seiten prüfen, Versionen tauschen, kurz testen, committen.

---

## Deployment

Deployment läuft **vollautomatisch via GitHub Actions** bei jedem Push auf `main`:

```
git push → GitHub Actions → rsync → All-Inkl Webserver
```

Keine manuellen Schritte nötig. Der Workflow liegt in `.github/workflows/deploy.yml`. Voraussetzung: SSH-Key als GitHub Secret `SSH_PRIVATE_KEY` hinterlegt.

**Ausgeschlossen vom Deploy** (per rsync `--exclude`): `.git`, `.github`, `__pycache__`, `*.py`, `*.xlsx`, `*.log`, `dashboard/`

---

## Routing

Hash-basiertes SPA-Routing in `js/app.js`:

| Hash | Ansicht |
|---|---|
| `#stadtrat/steckbrief` | Stadtrat-Übersicht mit Charts und Statistiken |
| `#stadtrat/liste` | Stadtrat-Mitgliederliste |
| `#stadtrat/netzwerkkarte` | Kumu-Netzwerkkarte |
| `#ba01/steckbrief` … `#ba25/steckbrief` | BA-Steckbrief mit Bezirksdaten |
| `#ba01/liste` … `#ba25/liste` | BA-Mitgliederliste |

---

## Daten aktuell halten

### stadtrat.csv – Stadtratsmitglieder

Hauptdatei mit 102 Zeilen (81 Personen + Fraktions-/Parteimetadaten für Kumu).

**Spaltenstruktur (Auszug):**
`Label, Type, Nachname, Vorname, Geschlecht, ID RIS, Partei, Fraktion, Bürgermeister, E-Mail, Website, Instagram, Facebook, LinkedIn, TikTok, Mastodon, RIS-Link, Image, Wahldatum, Mandatsbeginn, Listenplatz, Stimmen, Description, Ausschuss 1–8`

- `Type=Person` → Stadtratsmitglied (wird von der App angezeigt)
- `Type=Fraktion` / `Type=Partei` → nur für Kumu-Netzwerkkarte, App filtert diese raus

**Quellen:**
- Personendaten: [Ratsinformationssystem München (RIS)](https://risi.muenchen.de)
- Wahlergebnisse: [wahlen-muenchen.de](https://www.wahlen-muenchen.de/ergebnisse/2_20260308bezirksausschusswahl/)

**Hilfsskripte** (lokal, werden nicht deployed):
- `scrape_risi.py` — scrapet Stammdaten aus dem RIS
- `scrape_ergebnisse.py` — scrapet Wahlergebnisse
- `update_excel.py` — schreibt Daten in die Excel-Arbeitsmappe

### ba01.csv … ba25.csv – Bezirksausschüsse

Mitgliederdaten der 25 Bezirksausschüsse. Gleiche Spaltenstruktur wie `stadtrat.csv` (ohne Ausschuss-Spalten).

**Quelle:** [Ratsinformationssystem München (RIS)](https://risi.muenchen.de) — `scrape_ba.py`

### Open-Data-Indikatoren (BA-Steckbrief)

Statistische Kennzahlen je Bezirksausschuss, konfiguriert in `js/config.js` unter `OPENDATA_INDICATORS`:

| Datei | Inhalt | Quelle |
|---|---|---|
| `bevoelkerungsanteil.csv` | Bevölkerungsanteil an München | [OpenData LHM](https://opendata.muenchen.de) |
| `durchschnittsalter.csv` | Durchschnittsalter | [OpenData LHM](https://opendata.muenchen.de) |
| `altersgruppen.csv` | Anteil unter 18 / 65+ | [OpenData LHM](https://opendata.muenchen.de) |
| `einpersonenhaushalte.csv` | Anteil Einpersonenhaushalte | [OpenData LHM](https://opendata.muenchen.de) |
| `bevoelkerungsdichte.csv` | EW/km² | [OpenData LHM](https://opendata.muenchen.de) |
| `flaechennutzung.csv` | Siedlung/Verkehr, Grün/Natur | [OpenData LHM](https://opendata.muenchen.de) |
| `motorisierungsgrad.csv` | PKW je 1.000 EW | [OpenData LHM](https://opendata.muenchen.de) |
| `erstzulassung_pkw.csv` | PKW-Erstzulassungen | [OpenData LHM](https://opendata.muenchen.de) |

Alle Open-Data-Dateien stammen aus dem [OpenData-Portal der LHM](https://opendata.muenchen.de) und werden manuell aktualisiert wenn neue Jahrgänge erscheinen.

---

## Kumu-Netzwerkkarte

Die Netzwerkkarte läuft als iFrame-Embed von [kumu.io](https://kumu.io). Datenquelle für Kumu ist `data/stadtrat.csv` — die `Type=Fraktion`- und `Type=Partei`-Zeilen sind speziell dafür angelegt und enthalten Verbindungsmetadaten.

Wenn Stadtratsdaten aktualisiert werden, muss Kumu separat über das Kumu-Dashboard synchronisiert werden.

---

## Tracking

Matomo Analytics, Site-ID 13, gehostet auf `piwik.bielinski.de`. SPA-Tracking: jede Hash-Navigation löst manuell `trackPageView` aus (in `render()` in `app.js`).

---

## Daten & Lizenz

Personendaten aus dem RIS stehen unter den Nutzungsbedingungen der LHM. Open-Data-Indikatoren: [Datenlizenz Deutschland – Namensnennung 2.0](https://www.govdata.de/dl-de/by-2-0).
