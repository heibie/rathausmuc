// ─── Cache ────────────────────────────────────────────────────────────────────
const dataCache = {};
let bezirkDataCache = null;
let bezirkGeoCache  = null;

async function fetchBezirkData() {
  if (bezirkDataCache) return bezirkDataCache;
  const res = await fetch('data/bezirke_bevoelkerung.csv');
  const text = await res.text();
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  bezirkDataCache = data;
  return data;
}

async function fetchBezirkGeo() {
  if (bezirkGeoCache) return bezirkGeoCache;
  const res = await fetch('data/bezirke.geojson');
  bezirkGeoCache = await res.json();
  return bezirkGeoCache;
}

let _leafletMap = null;

function initBezirkMap(features) {
  if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
  if (!document.getElementById('bezirk-map')) return;

  // Sofort gültige View setzen damit nie Weltkarte zu sehen ist
  _leafletMap = L.map('bezirk-map', {
    zoomControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    dragging: false,
    attributionControl: false,
  }).setView([48.137, 11.576], 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(_leafletMap);

  const geoLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    style: { color: '#111111', weight: 2.5, fillColor: '#FFCC00', fillOpacity: 0.45 },
  }).addTo(_leafletMap);

  // 150 ms warten bis Container-Größe vom Browser berechnet wurde, dann einpassen
  setTimeout(() => {
    _leafletMap.invalidateSize();
    const bounds = geoLayer.getBounds();
    if (bounds.isValid()) {
      _leafletMap.fitBounds(bounds, { padding: [20, 20] });
    }
  }, 150);
}

async function fetchGremium(csvFile) {
  if (dataCache[csvFile]) return dataCache[csvFile];
  const res = await fetch(csvFile);
  if (!res.ok) throw new Error(`CSV nicht gefunden: ${csvFile} (${res.status})`);
  const text = await res.text();
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  dataCache[csvFile] = data;
  return data;
}

// ─── Router ──────────────────────────────────────────────────────────────────
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/');
  const slug = parts[0] || 'stadtrat';
  const tab  = parts[1] || 'liste';
  return { slug, tab };
}

function navigate(slug, tab) {
  location.hash = `${slug}/${tab}`;
}

window.addEventListener('hashchange', render);
window.addEventListener('load', render);

// ─── Navigation ───────────────────────────────────────────────────────────────
function renderNav(activeSlug) {
  const baGremien = GREMIEN.filter(g => g.type === 'ba');

  const baItems = baGremien.map(g => `
    <a class="ba-item${g.slug === activeSlug ? ' active' : ''}" href="#${g.slug}/liste">
      <span class="ba-num">${g.name}</span>
      <span class="ba-name">${g.full.split(' · ')[1] || ''}</span>
    </a>`).join('');

  const isBA = GREMIEN_BY_SLUG[activeSlug]?.type === 'ba';

  document.getElementById('main-nav').innerHTML = `
    <a class="nav-item${activeSlug === 'stadtrat' ? ' active' : ''}" href="#stadtrat/liste">Stadtrat</a>
    <div class="nav-item nav-dropdown${isBA ? ' active' : ''}">
      <span class="nav-dropdown-label">Bezirksausschüsse <svg width="10" height="6" viewBox="0 0 10 6"><path d="M0 0l5 6 5-6z" fill="currentColor"/></svg></span>
      <div class="ba-menu">
        <div class="ba-grid">${baItems}</div>
      </div>
    </div>`;
}

// ─── Sub-Tabs ─────────────────────────────────────────────────────────────────
function renderSubNav(gremium, activeTab) {
  const tabs = gremium.tabs || ['liste', 'steckbrief'];
  const labels = { liste: 'Liste', steckbrief: 'Steckbrief', netzwerkkarte: 'Netzwerkkarte' };
  const tabsHtml = tabs.map(t => `
    <a class="tab${t === activeTab ? ' active' : ''}" href="#${gremium.slug}/${t}">${labels[t]}</a>`).join('');

  document.getElementById('sub-nav').innerHTML = `
    <div class="breadcrumb">${gremium.full}</div>
    <div class="tabs-bar">${tabsHtml}</div>`;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function renderStats(data, gremium) {
  const herr = data.filter(d => d['Geschlecht'] === 'Herr').length;
  const frau = data.filter(d => d['Geschlecht'] === 'Frau').length;
  const hasSocial = d => d['Instagram'] || d['Facebook'] || d['LinkedIn'] || d['TikTok'] || d['Mastodon'];

  const items = gremium.type === 'stadtrat'
    ? [
        { id: 'stat-total',   val: data.length,                          label: 'Mitglieder' },
        { id: 'stat-frau',    val: frau,                                  label: 'Frauen' },
        { id: 'stat-herr',    val: herr,                                  label: 'Männer' },
        { id: 'stat-photos',  val: data.filter(d => d['Image']).length,   label: 'mit Foto' },
        { id: 'stat-social',  val: data.filter(hasSocial).length,         label: 'mit Social Media' },
        { id: 'stat-email',   val: data.filter(d => d['E-Mail']).length,  label: 'mit E-Mail' },
      ]
    : [
        { id: 'stat-total',   val: data.length,                           label: 'Mitglieder' },
        { id: 'stat-frau',    val: frau,                                   label: 'Frauen' },
        { id: 'stat-herr',    val: herr,                                   label: 'Männer' },
        { id: 'stat-email',   val: data.filter(d => d['E-Mail']).length,   label: 'mit E-Mail' },
        { id: 'stat-social',  val: data.filter(hasSocial).length,          label: 'mit Social Media' },
      ];

  document.getElementById('stats-bar').innerHTML = items.map(s => `
    <div class="stat">
      <div class="stat-value">${s.val}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
}

// ─── Liste ────────────────────────────────────────────────────────────────────
let sortField = 'Nachname';
let sortDir   = 'asc';
let allData   = [];
let filteredData = [];

function renderListe(data, gremium) {
  allData = data;

  const isStadtrat = gremium.type === 'stadtrat';

  document.getElementById('content').innerHTML = `
    <div class="list-toolbar">
      <input type="search" class="search-input" id="search-name" placeholder="Name suchen…">
      ${isStadtrat ? `
      <select class="filter-select" id="filter-fraktion"><option value="">Alle Fraktionen</option></select>
      ` : ''}
      <select class="filter-select" id="filter-partei"><option value="">Alle Parteien</option></select>
      <select class="filter-select" id="filter-geschlecht">
        <option value="">Alle</option>
        <option value="Frau">Frau</option>
        <option value="Herr">Herr</option>
      </select>
      <button class="btn-reset" id="btn-reset">Zurücksetzen</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${isStadtrat ? '<th style="width:46px"></th>' : ''}
          <th class="sortable" data-field="Nachname">Nachname <span class="sort-arrow"></span></th>
          <th class="sortable" data-field="Vorname">Vorname <span class="sort-arrow"></span></th>
          <th class="sortable" data-field="Partei" style="width:110px">Partei <span class="sort-arrow"></span></th>
          ${isStadtrat ? '<th class="sortable" data-field="Fraktion">Fraktion <span class="sort-arrow"></span></th>' : ''}
          <th class="sortable" data-field="Listenplatz" style="width:80px;text-align:center">Listenplatz <span class="sort-arrow"></span></th>
          <th class="sortable" data-field="Stimmen" style="width:90px;text-align:right">Stimmen <span class="sort-arrow"></span></th>
          <th style="width:200px">E-Mail</th>
          <th style="width:110px">Social</th>
          <th style="width:44px">RIS</th>
        </tr></thead>
        <tbody id="list-tbody"></tbody>
      </table>
      <div class="table-empty" id="table-empty" style="display:none">Keine Einträge gefunden</div>
    </div>`;

  // Filter-Optionen befüllen
  if (isStadtrat) {
    const fraktionen = [...new Set(data.map(d => d['Fraktion']).filter(Boolean))].sort();
    const sel = document.getElementById('filter-fraktion');
    fraktionen.forEach(f => sel.appendChild(new Option(f, f)));
  }
  const parteien = [...new Set(data.map(d => d['Partei']).filter(Boolean))].sort();
  const pSel = document.getElementById('filter-partei');
  parteien.forEach(p => pSel.appendChild(new Option(p, p)));

  // Sortierung initialisieren
  sortField = 'Nachname'; sortDir = 'asc';

  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      if (sortField === th.dataset.field) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = th.dataset.field; sortDir = 'asc';
      }
      document.querySelectorAll('th.sortable').forEach(t => t.classList.remove('sort-asc','sort-desc'));
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      applyFilters(gremium);
    });
  });

  document.getElementById('search-name').addEventListener('input', () => applyFilters(gremium));
  if (isStadtrat) document.getElementById('filter-fraktion').addEventListener('change', () => applyFilters(gremium));
  document.getElementById('filter-partei').addEventListener('change', () => applyFilters(gremium));
  document.getElementById('filter-geschlecht').addEventListener('change', () => applyFilters(gremium));
  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('search-name').value = '';
    if (isStadtrat) document.getElementById('filter-fraktion').value = '';
    document.getElementById('filter-partei').value = '';
    document.getElementById('filter-geschlecht').value = '';
    applyFilters(gremium);
  });

  applyFilters(gremium);
}

function applyFilters(gremium) {
  const isStadtrat = gremium.type === 'stadtrat';
  const name       = document.getElementById('search-name').value.trim().toLowerCase();
  const partei     = document.getElementById('filter-partei').value;
  const geschlecht = document.getElementById('filter-geschlecht').value;
  const fraktion   = isStadtrat ? document.getElementById('filter-fraktion').value : '';

  filteredData = allData.filter(row => {
    const fullName = `${row['Vorname'] || ''} ${row['Nachname'] || ''}`.toLowerCase();
    if (name && !fullName.includes(name)) return false;
    if (fraktion && row['Fraktion'] !== fraktion) return false;
    if (partei && row['Partei'] !== partei) return false;
    if (geschlecht && row['Geschlecht'] !== geschlecht) return false;
    return true;
  });

  renderTableBody(filteredData, gremium);
}

function renderTableBody(data, gremium) {
  const isStadtrat = gremium.type === 'stadtrat';
  const sorted = [...data].sort((a, b) => {
    let av = (a[sortField] || '').toString();
    let bv = (b[sortField] || '').toString();
    // Numerische Sortierung für Listenplatz
    if (sortField === 'Listenplatz' || sortField === 'Stimmen') {
      return sortDir === 'asc' ? (parseInt(av)||0) - (parseInt(bv)||0) : (parseInt(bv)||0) - (parseInt(av)||0);
    }
    return sortDir === 'asc' ? av.localeCompare(bv, 'de') : bv.localeCompare(av, 'de');
  });

  const tbody = document.getElementById('list-tbody');
  const empty = document.getElementById('table-empty');
  if (sorted.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = sorted.map(row => {
    const initial = ((row['Vorname']||'')[0]||'') + ((row['Nachname']||'')[0]||'');
    const avatar  = isStadtrat ? (row['Image']
      ? `<img class="avatar" src="${row['Image']}" loading="lazy" alt="" onerror="this.outerHTML='<div class=avatar-placeholder>${initial}</div>'">`
      : `<div class="avatar-placeholder">${initial}</div>`) : '';

    const c = partyColor(row['Partei']);
    const badge = row['Partei']
      ? `<span class="party-badge" style="background:${c.bg};color:${c.fg}">${row['Partei']}</span>`
      : '<span class="td-empty">–</span>';

    const email = row['E-Mail']
      ? `<a class="mail-link" href="mailto:${row['E-Mail']}">${row['E-Mail']}</a>`
      : '<span class="td-empty">–</span>';

    const socialHtml = Object.entries(SOCIAL_ICONS).map(([field, icon]) => {
      const href = row[field];
      if (!href) return '';
      return `<a class="social-link ${icon.cls}" href="${href}" target="_blank" rel="noopener" title="${icon.label}"><svg viewBox="0 0 24 24" width="14" height="14" fill="${icon.color}"><path d="${icon.path}"/></svg></a>`;
    }).join('');

    const ris = row['RIS-Link']
      ? `<a class="ris-link" href="${row['RIS-Link']}" target="_blank" rel="noopener" title="RIS-Profil">↗</a>`
      : '';

    return `<tr>
      ${isStadtrat ? `<td style="text-align:center">${avatar}</td>` : ''}
      <td>${row['Nachname'] || ''}</td>
      <td>${row['Vorname'] || ''}</td>
      <td>${badge}</td>
      ${isStadtrat ? `<td><span class="fraktion-text">${row['Fraktion'] || ''}</span></td>` : ''}
      <td style="text-align:center;color:var(--text-dim)">${row['Listenplatz'] || '<span class="td-empty">–</span>'}</td>
      <td style="text-align:right;color:var(--text-dim)">${row['Stimmen'] ? Number(row['Stimmen']).toLocaleString('de') : '<span class="td-empty">–</span>'}</td>
      <td>${email}</td>
      <td><div class="social-icons">${socialHtml}</div></td>
      <td style="text-align:center">${ris}</td>
    </tr>`;
  }).join('');
}

// ─── Steckbrief ───────────────────────────────────────────────────────────────
async function renderSteckbrief(data, gremium) {
  const isStadtrat = gremium.type === 'stadtrat';

  // Bezirk-Infos für BAs laden
  let bezirkHtml = '';
  let bezirkFeatures = [];
  if (!isStadtrat && gremium.baNum) {
    try {
      const [bezirkData, geoData] = await Promise.all([fetchBezirkData(), fetchBezirkGeo()]);
      const b = bezirkData.find(r => parseInt(r['stadtbezirksnummer']) === gremium.baNum);
      const features = geoData.features.filter(f => parseInt(f.properties.sb_nummer) === gremium.baNum);
      bezirkFeatures = features;

      if (b) {
        const ew      = Number(b['bevölkerung']).toLocaleString('de');
        const flaeche = Number(b['fläche in ha']).toLocaleString('de', { maximumFractionDigits: 0 });
        const km2     = (Number(b['fläche in ha']) / 100).toLocaleString('de', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const dichte  = Number(b['einwohnerdichte']).toLocaleString('de');

        bezirkHtml = `
          <div class="steckbrief-section">
            <div class="steckbrief-label">Stadtbezirk</div>
            <div class="steckbrief-body">
              <div>
                <div class="steckbrief-stats">
                  <div class="stat"><div class="stat-value">${ew}</div><div class="stat-label">Einwohner</div></div>
                  <div class="stat"><div class="stat-value">${km2} km²</div><div class="stat-label">Fläche (${flaeche} ha)</div></div>
                  <div class="stat"><div class="stat-value">${dichte}</div><div class="stat-label">EW pro Hektar</div></div>
                </div>
                <div class="steckbrief-source">Quelle: Open Data München · Stand 31.12.2024</div>
              </div>
              ${features.length ? '<div class="steckbrief-map"><div id="bezirk-map"></div></div>' : ''}
            </div>
          </div>`;
      }
    } catch(e) { /* Bezirkdaten optional */ }
  }

  const chartCards = isStadtrat ? `
    <div class="chart-card"><div class="chart-title">Sitze nach Fraktion</div><div class="chart-wrap"><canvas id="chart-fraktion"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">Sitze nach Partei</div><div class="chart-wrap"><canvas id="chart-partei"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">Geschlecht</div><div class="chart-wrap"><canvas id="chart-geschlecht"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">Social-Media-Präsenz</div><div class="chart-wrap"><canvas id="chart-social"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">Kontaktdaten-Abdeckung</div><div class="chart-wrap"><canvas id="chart-kontakt"></canvas></div></div>
  ` : `
    <div class="chart-card"><div class="chart-title">Sitze nach Partei</div><div class="chart-wrap"><canvas id="chart-partei"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">Geschlecht</div><div class="chart-wrap"><canvas id="chart-geschlecht"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">Social-Media-Präsenz</div><div class="chart-wrap"><canvas id="chart-social"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">Kontaktdaten-Abdeckung</div><div class="chart-wrap"><canvas id="chart-kontakt"></canvas></div></div>
  `;

  document.getElementById('content').innerHTML = bezirkHtml + `<div class="charts-grid">${chartCards}</div>`;

  if (bezirkFeatures.length) initBezirkMap(bezirkFeatures);

  const chartDefaults = {
    plugins: { legend: { labels: { color: '#74788a', font: { size: 12 } } } }
  };

  // Fraktion (nur Stadtrat)
  if (isStadtrat) {
    const COALITION_KEYS = ['grünen', 'rosa liste', 'spd', 'fdp', 'freie'];
    const frakCount = {};
    data.forEach(d => { const f = d['Fraktion'] || 'Unbekannt'; frakCount[f] = (frakCount[f] || 0) + 1; });
    const allFrak = Object.entries(frakCount).sort((a,b) => b[1]-a[1]);
    const isCoalition = name => COALITION_KEYS.some(k => name.toLowerCase().includes(k));
    const frakSorted = [
      ...allFrak.filter(e => isCoalition(e[0])),
      ...allFrak.filter(e => !isCoalition(e[0])),
    ];
    const coalitionSeats = frakSorted.filter(e => isCoalition(e[0])).reduce((s,e) => s+e[1], 0);
    const totalSeats     = frakSorted.reduce((s,e) => s+e[1], 0);

    function shortFrak(name) {
      if (name.includes('CSU')) return 'CSU';
      if (name.includes('SPD')) return 'SPD';
      if (name.includes('Grünen')) return 'Grüne/Rosa Liste';
      if (name.includes('Volt')) return 'Volt';
      if (name.includes('AfD')) return 'AfD';
      if (name.includes('FDP') || name.toLowerCase().includes('freie')) return 'FDP/FW';
      if (name.includes('Linke')) return 'Die Linke';
      if (name.includes('ÖDP')) return 'ÖDP/BK/ML';
      if (name.toLowerCase().includes('partei')) return 'Die PARTEI';
      return name;
    }

    const coalitionPlugin = {
      id: 'coalitionCenter',
      afterDraw(chart) {
        const { ctx, chartArea: { left, right, top, bottom } } = chart;
        const cx = (left+right)/2, cy = (top+bottom)/2;
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px -apple-system,sans-serif'; ctx.fillStyle = '#1c1e21';
        ctx.fillText(coalitionSeats, cx, cy-10);
        ctx.font = '500 11px -apple-system,sans-serif'; ctx.fillStyle = '#74788a';
        ctx.fillText(`von ${totalSeats} Sitzen`, cx, cy+12);
        ctx.restore();
      }
    };

    new Chart(document.getElementById('chart-fraktion'), {
      type: 'doughnut', plugins: [coalitionPlugin],
      data: {
        labels: frakSorted.map(e => `${shortFrak(e[0])} (${e[1]})`),
        datasets: [{ data: frakSorted.map(e => e[1]),
          backgroundColor: frakSorted.map(e => partyColor(e[0]).bg),
          borderColor: frakSorted.map(e => isCoalition(e[0]) ? '#1c1e21' : '#fff'),
          borderWidth: 1 }]
      },
      options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
        cutout: '58%', plugins: { legend: { display: false } } }
    });
  }

  // Partei
  const parteiCount = {};
  data.forEach(d => { const p = d['Partei'] || 'Sonstige'; parteiCount[p] = (parteiCount[p]||0)+1; });
  const parteiSorted = Object.entries(parteiCount).sort((a,b) => b[1]-a[1]);
  new Chart(document.getElementById('chart-partei'), {
    type: 'doughnut',
    data: {
      labels: parteiSorted.map(([p,n]) => `${p} (${n})`),
      datasets: [{ data: parteiSorted.map(e => e[1]),
        backgroundColor: parteiSorted.map(([p]) => partyColor(p).bg),
        borderColor: '#fff', borderWidth: 2 }]
    },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } } }
  });

  // Geschlecht
  const herr = data.filter(d => d['Geschlecht'] === 'Herr').length;
  const frau = data.filter(d => d['Geschlecht'] === 'Frau').length;
  const genderPlugin = {
    id: 'genderCenter',
    afterDraw(chart) {
      const { ctx, chartArea: { left, right, top, bottom } } = chart;
      const cx = (left+right)/2, cy = (top+bottom)/2;
      const pct = data.length > 0 ? Math.round(frau / data.length * 100) : 0;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 28px -apple-system,sans-serif'; ctx.fillStyle = '#1c1e21';
      ctx.fillText(pct + '%', cx, cy-10);
      ctx.font = '500 11px -apple-system,sans-serif'; ctx.fillStyle = '#74788a';
      ctx.fillText('Frauen', cx, cy+12);
      ctx.restore();
    }
  };
  new Chart(document.getElementById('chart-geschlecht'), {
    type: 'doughnut', plugins: [genderPlugin],
    data: {
      labels: [`weiblich (${frau})`, `männlich (${herr})`],
      datasets: [{ data: [frau, herr],
        backgroundColor: ['#E4007E', '#1c1e21'],
        borderColor: '#fff', borderWidth: 2 }]
    },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      cutout: '58%', plugins: { legend: { labels: { color: '#74788a', font: { size: 12 } } } } }
  });

  // Social Media
  const platforms = ['Instagram','Facebook','LinkedIn','TikTok','Mastodon'];
  new Chart(document.getElementById('chart-social'), {
    type: 'bar',
    data: {
      labels: platforms,
      datasets: [{ label: 'Mitglieder',
        data: platforms.map(p => data.filter(d => d[p]).length),
        backgroundColor: Object.values(SOCIAL_ICONS).map(i => i.color),
        borderWidth: 0, borderRadius: 3 }]
    },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#1c1e21' }, grid: { display: false } },
        y: { ticks: { color: '#a0a4b0', font: { size: 11 } }, grid: { color: '#f0f1f3' }, max: data.length }
      } }
  });

  // Kontaktdaten
  const hasSocial = d => d['Instagram'] || d['Facebook'] || d['LinkedIn'] || d['TikTok'] || d['Mastodon'];
  const kontaktLabels = isStadtrat ? ['Foto', 'E-Mail', 'Website', 'Social Media'] : ['E-Mail', 'Website', 'Social Media'];
  const kontaktData   = isStadtrat
    ? [data.filter(d => d['Image']).length, data.filter(d => d['E-Mail']).length, data.filter(d => d['Website']).length, data.filter(hasSocial).length]
    : [data.filter(d => d['E-Mail']).length, data.filter(d => d['Website']).length, data.filter(hasSocial).length];
  new Chart(document.getElementById('chart-kontakt'), {
    type: 'bar',
    data: {
      labels: kontaktLabels,
      datasets: [{ label: 'Mitglieder', data: kontaktData,
        backgroundColor: '#1c1e21', borderWidth: 0, borderRadius: 3 }]
    },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#1c1e21' }, grid: { display: false } },
        y: { ticks: { color: '#a0a4b0', font: { size: 11 } }, grid: { color: '#f0f1f3' }, max: data.length }
      } }
  });
}

// ─── Netzwerkkarte ────────────────────────────────────────────────────────────
function renderNetzwerkkarte() {
  document.getElementById('content').innerHTML = `
    <div class="kumu-wrap">
      <div class="kumu-placeholder">
        <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="4" fill="#1c1e21"/>
          <circle cx="10" cy="16" r="3" fill="#e4e6ea"/>
          <circle cx="38" cy="16" r="3" fill="#e4e6ea"/>
          <circle cx="10" cy="34" r="3" fill="#e4e6ea"/>
          <circle cx="38" cy="34" r="3" fill="#e4e6ea"/>
          <line x1="24" y1="24" x2="10" y2="16" stroke="#e4e6ea" stroke-width="1.5"/>
          <line x1="24" y1="24" x2="38" y2="16" stroke="#e4e6ea" stroke-width="1.5"/>
          <line x1="24" y1="24" x2="10" y2="34" stroke="#e4e6ea" stroke-width="1.5"/>
          <line x1="24" y1="24" x2="38" y2="34" stroke="#e4e6ea" stroke-width="1.5"/>
        </svg>
        <p>Kumu-Netzwerkkarte</p>
        <p>Embed-URL in js/config.js eintragen</p>
      </div>
    </div>`;
}

// ─── Loading / Error ──────────────────────────────────────────────────────────
function showLoading() {
  document.getElementById('content').innerHTML = `
    <div class="loading"><div class="spinner"></div><span>Daten werden geladen…</span></div>`;
}

function showError(msg) {
  document.getElementById('content').innerHTML = `<div class="error-box">${msg}</div>`;
}

// ─── Render ───────────────────────────────────────────────────────────────────
async function render() {
  const { slug, tab } = parseHash();
  const gremium = GREMIEN_BY_SLUG[slug] || GREMIEN[0];
  const actualTab = (gremium.tabs || ['liste','steckbrief']).includes(tab) ? tab : 'liste';

  // Falls Slug unbekannt oder Tab nicht verfügbar → korrekten Hash setzen
  if (!GREMIEN_BY_SLUG[slug] || actualTab !== tab) {
    navigate(gremium.slug, actualTab);
    return;
  }

  renderNav(gremium.slug);
  renderSubNav(gremium, actualTab);

  if (actualTab === 'netzwerkkarte') {
    renderNetzwerkkarte();
    return;
  }

  showLoading();
  try {
    const data = await fetchGremium(gremium.csvFile);
    if (actualTab === 'liste') {
      renderStats(data, gremium);
      renderListe(data, gremium);
    } else {
      document.getElementById('stats-bar').innerHTML = '';
      await renderSteckbrief(data, gremium);
    }
  } catch(e) {
    showError(`Fehler beim Laden: ${e.message}`);
    console.error(e);
  }
}
