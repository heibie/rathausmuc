// ─── Cache ────────────────────────────────────────────────────────────────────
const dataCache      = {};
const indicatorCache = {};
let bezirkDataCache  = null;
let bezirkGeoCache   = null;

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

let _leafletMap    = null;
let _homeMap       = null;
let _sortedData    = [];
let _lastIsStadtrat = false;

function initBezirkMap(allFeatures, activeBaNum) {
  if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
  if (!document.getElementById('bezirk-map')) return;

  _leafletMap = L.map('bezirk-map', {
    zoomControl: true, scrollWheelZoom: true,
    doubleClickZoom: true, touchZoom: true,
    dragging: true, attributionControl: false,
  }).setView([48.137, 11.576], 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(_leafletMap);

  const geoLayer = L.geoJSON({ type: 'FeatureCollection', features: allFeatures }, {
    style(feature) {
      const isActive = parseInt(feature.properties.sb_nummer) === activeBaNum;
      return {
        color: '#111111', weight: isActive ? 2.5 : 1,
        fillColor: '#FFCC00', fillOpacity: isActive ? 0.55 : 0.08,
      };
    },
    onEachFeature(feature, layer) {
      const num = parseInt(feature.properties.sb_nummer);
      const gremium = GREMIEN.find(g => g.baNum === num);
      const isActive = num === activeBaNum;
      const label = gremium?.full.replace(' · ', ' – ') || feature.properties.sb_name || '';

      layer.bindTooltip(label, { sticky: true });
      layer.on({
        mouseover(e) { e.target.setStyle({ fillOpacity: isActive ? 0.7 : 0.28 }); },
        mouseout(e)  { e.target.setStyle({ fillOpacity: isActive ? 0.55 : 0.08 }); },
        click()      { if (gremium) navigate(gremium.slug, 'steckbrief'); },
      });
    },
  }).addTo(_leafletMap);

  setTimeout(() => {
    _leafletMap.invalidateSize();
    const activeFeatures = allFeatures.filter(f => parseInt(f.properties.sb_nummer) === activeBaNum);
    if (activeFeatures.length) {
      const b = L.geoJSON({ type: 'FeatureCollection', features: activeFeatures }).getBounds();
      if (b.isValid()) { _leafletMap.fitBounds(b, { padding: [40, 40] }); return; }
    }
    const b = geoLayer.getBounds();
    if (b.isValid()) _leafletMap.fitBounds(b, { padding: [20, 20] });
  }, 150);
}

function initHomeMap(features) {
  if (_homeMap) { _homeMap.remove(); _homeMap = null; }
  if (!document.getElementById('overview-map')) return;

  _homeMap = L.map('overview-map', {
    zoomControl: true, scrollWheelZoom: true,
    doubleClickZoom: true, touchZoom: true,
    dragging: true, attributionControl: false,
  }).setView([48.137, 11.576], 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(_homeMap);

  const geoLayer = L.geoJSON({ type: 'FeatureCollection', features }, {
    style: { color: '#111111', weight: 1.5, fillColor: '#FFCC00', fillOpacity: 0.25 },
    onEachFeature(feature, layer) {
      const num = parseInt(feature.properties.sb_nummer);
      const gremium = GREMIEN.find(g => g.baNum === num);
      const label = gremium?.full.replace(' · ', ' – ') || feature.properties.sb_name || '';

      layer.bindTooltip(label, { sticky: true });
      layer.on({
        mouseover(e) { e.target.setStyle({ fillOpacity: 0.6 }); },
        mouseout(e)  { e.target.setStyle({ fillOpacity: 0.25 }); },
        click()      { if (gremium) navigate(gremium.slug, 'steckbrief'); },
      });
    },
  }).addTo(_homeMap);

  // Rathaus-Marker am Marienplatz
  setTimeout(() => {
    _homeMap.invalidateSize();
    const bounds = geoLayer.getBounds();
    if (bounds.isValid()) _homeMap.fitBounds(bounds, { padding: [20, 20] });
  }, 150);
}

// ─── Startseite ───────────────────────────────────────────────────────────────
async function renderHome() {
  showLoading();
  try {
    const indFiles = ['data/motorisierungsgrad.csv', 'data/durchschnittsalter.csv', 'data/einpersonenhaushalte.csv'];
    const [bezirkData, geoData, ...indResults] = await Promise.all([
      fetchBezirkData(),
      fetchBezirkGeo(),
      ...indFiles.map(f => fetchIndicator(f).catch(() => null)),
    ]);

    const totalEW = bezirkData.reduce((s, r) => s + Number(r['bevölkerung']), 0);
    const totalHa = bezirkData.reduce((s, r) => s + Number(r['fläche in ha']), 0);
    const km2 = (totalHa / 100).toLocaleString('de', { maximumFractionDigits: 0 });
    const ewFmt = totalEW.toLocaleString('de');

    const cityVal = (rows, auspraegung) => {
      if (!rows) return '–';
      const r = rows
        .filter(r => r['Raumbezug'] === 'Stadt München' && r['Ausprägung'] === auspraegung)
        .sort((a, b) => Number(b['Jahr']) - Number(a['Jahr']))[0];
      return r ? r['Indikatorwert'] : '–';
    };

    const fmt = (v, dec = 0) => v === '–' ? '–' : Number(v).toLocaleString('de', { maximumFractionDigits: dec });

    const stat = (val, label) =>
      `<div class="stat"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`;

    const groups = {
      'Stadtrat': [
        stat('25', 'Stadtbezirke'),
        stat('81', 'Stadtratsmitglieder'),
      ],
      'Bevölkerung': [
        stat(ewFmt, 'Einwohner'),
        stat(km2 + ' km²', 'Stadtfläche'),
        stat(fmt(cityVal(indResults[1], 'insgesamt'), 1), 'Ø Alter (Jahre)'),
        stat(fmt(cityVal(indResults[2], 'insgesamt'), 1), 'Einpersonen-HH (%)'),
      ],
      'Mobilität': [
        stat(fmt(cityVal(indResults[0], 'insgesamt'), 0), 'PKW / 1.000 EW'),
      ],
    };

    const statHtml = s => `<div class="stat"><div class="stat-value">${s.val}</div><div class="stat-label">${s.lbl}</div></div>`;

    const groupsHtml = Object.entries(groups).map(([name, stats]) => `
      <div class="steckbrief-group">
        <div class="steckbrief-group-label">${name}</div>
        <div class="steckbrief-stats">${stats.join('')}</div>
      </div>`).join('');

    document.getElementById('content').innerHTML = `
      <div class="steckbrief-card home-card">
        <div class="steckbrief-card-content">
          <div class="chart-title">München</div>
          ${groupsHtml}
          <div class="steckbrief-source">Quelle: Open Data München · Stand 2024</div>
        </div>
        <div class="steckbrief-card-map">
          <div id="home-map"></div>
        </div>
      </div>`;

    initHomeMap(geoData.features);
  } catch(e) {
    showError(`Fehler beim Laden: ${e.message}`);
    console.error(e);
  }
}

// ─── Member popup ─────────────────────────────────────────────────────────────
let _popupCloseTimer = null;

function scheduleHidePopup() {
  _popupCloseTimer = setTimeout(() => {
    const p = document.getElementById('member-popup');
    if (p) p.style.display = 'none';
  }, 160);
}

function cancelHidePopup() {
  if (_popupCloseTimer) { clearTimeout(_popupCloseTimer); _popupCloseTimer = null; }
}

function buildMemberPopup(row, isStadtrat) {
  const v = row['Vorname'] || '', n = row['Nachname'] || '';
  const ini = (v[0] || '') + (n[0] || '');

  const avatarHtml = isStadtrat && row['Image']
    ? `<img class="mp-avatar" src="${row['Image']}" alt="${ini}">`
    : `<div class="mp-avatar mp-avatar-ph">${ini}</div>`;

  const c = partyColor(row['Partei']);
  const badge = row['Partei']
    ? `<span class="party-badge" style="background:${c.bg};color:${c.fg}">${row['Partei']}</span>` : '';
  const fraktion = row['Fraktion']
    ? `<div class="mp-sub">${row['Fraktion']}</div>` : '';
  const geschlecht = row['Geschlecht']
    ? `<div class="mp-sub">${row['Geschlecht']}</div>` : '';

  // Helper: text row
  const txt = (key, val) =>
    `<div class="mp-row"><span class="mp-key">${key}</span><span class="mp-val">${val}</span></div>`;
  // Helper: link row
  const lnk = (key, href, label) =>
    `<div class="mp-row"><span class="mp-key">${key}</span><a class="mp-link" href="${href}" target="_blank" rel="noopener">${label}</a></div>`;

  let body = '';
  if (row['Listenplatz'])   body += txt('Listenplatz', row['Listenplatz']);
  if (row['Stimmen'])       body += txt('Stimmen', Number(row['Stimmen']).toLocaleString('de'));
  if (row['Gewählt am'])    body += txt('Gewählt am', row['Gewählt am']);
  if (row['E-Mail'])        body += `<div class="mp-row"><span class="mp-key">E-Mail</span><a class="mp-link" href="mailto:${row['E-Mail']}">${row['E-Mail']}</a></div>`;
  if (row['Website'])       body += lnk('Website', row['Website'], row['Website'].replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 38));
  if (row['RIS-Link'])      body += lnk('RIS', row['RIS-Link'], 'Profil im RIS ↗');
  if (row['Lebenslauf']) {
    const lv = row['Lebenslauf'];
    body += lv.startsWith('http')
      ? lnk('Lebenslauf', lv, 'Lebenslauf ↗')
      : txt('Lebenslauf', lv);
  }

  const socialBtns = Object.entries(SOCIAL_ICONS)
    .filter(([field]) => row[field])
    .map(([field, ic]) =>
      `<a class="mp-social-btn" href="${row[field]}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="12" height="12" fill="${ic.color}"><path d="${ic.path}"/></svg>${ic.label}</a>`)
    .join('');
  if (socialBtns) body += `<div class="mp-row mp-row-wrap"><span class="mp-key">Social</span><span class="mp-social-row">${socialBtns}</span></div>`;

  // Bio / Beschreibung (falls eigene Spalte vorhanden)
  const bio = row['Bio'] || row['Beschreibung'] || '';

  return `
    <div class="mp-head">
      ${avatarHtml}
      <div class="mp-identity">
        <div class="mp-name">${v} ${n}</div>
        ${badge}${fraktion}${geschlecht}
      </div>
    </div>
    ${body ? `<div class="mp-body">${body}</div>` : ''}
    ${bio ? `<div class="mp-bio">${bio}</div>` : ''}`;
}

function showMemberPopup(idx, el) {
  cancelHidePopup();
  const popup = document.getElementById('member-popup');
  const row = _sortedData[idx];
  if (!popup || !row) return;
  popup.innerHTML = buildMemberPopup(row, _lastIsStadtrat);
  popup.style.display = 'block';

  // Position: right of avatar cell, aligned to top of cell
  const rect = el.getBoundingClientRect();
  const pw = popup.offsetWidth || 296;
  const ph = popup.offsetHeight || 300;
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = rect.right + 8;
  if (x + pw > vw - 8) x = rect.left - pw - 8;
  if (x < 8) x = 8;
  let y = rect.top;
  if (y + ph > vh - 8) y = vh - ph - 8;
  if (y < 8) y = 8;
  popup.style.left = x + 'px';
  popup.style.top  = y + 'px';
}

async function fetchIndicator(file) {
  if (indicatorCache[file]) return indicatorCache[file];
  const res  = await fetch(file);
  if (!res.ok) throw new Error(`${file} (${res.status})`);
  const text = await res.text();
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  indicatorCache[file] = data;
  return data;
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
  if (!h || h === 'home') return { slug: 'home', tabRaw: null };
  const parts = h.split('/');
  return { slug: parts[0], tabRaw: parts[1] || null };
}

function navigate(slug, tab) {
  location.hash = tab ? `${slug}/${tab}` : slug;
}

window.addEventListener('hashchange', render);
window.addEventListener('load', render);

// ─── Navigation ───────────────────────────────────────────────────────────────
function renderNav(activeSlug) {
  const baGremien = GREMIEN.filter(g => g.type === 'ba');

  const baItems = baGremien.map(g => `
    <a class="ba-item${g.slug === activeSlug ? ' active' : ''}" href="#${g.slug}/steckbrief">
      <span class="ba-num">${g.name}</span>
      <span class="ba-name">${g.full.split(' · ')[1] || ''}</span>
    </a>`).join('');

  const isBA = GREMIEN_BY_SLUG[activeSlug]?.type === 'ba';

  document.getElementById('main-nav').innerHTML = `
    <a class="nav-item${activeSlug === 'stadtrat' ? ' active' : ''}" href="#stadtrat/steckbrief">Stadtrat</a>
    <div class="nav-item nav-dropdown${isBA ? ' active' : ''}" tabindex="0">
      <span class="nav-dropdown-label">Bezirksausschüsse <svg width="10" height="6" viewBox="0 0 10 6"><path d="M0 0l5 6 5-6z" fill="currentColor"/></svg></span>
      <div class="ba-menu">
        <div class="ba-grid">${baItems}</div>
      </div>
    </div>`;
}

// ─── Sub-Tabs ─────────────────────────────────────────────────────────────────
function renderSubNav(gremium, activeTab) {
  const tabs = gremium.tabs || (gremium.type === 'ba' ? ['steckbrief', 'liste'] : ['liste', 'steckbrief']);
  const labels = { liste: 'Mitglieder', steckbrief: 'Steckbrief', netzwerkkarte: 'Netzwerkkarte', sozialwall: 'Social Wall' };
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
          <th style="width:32px;text-align:right;color:var(--text-light)">#</th>
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
  _lastIsStadtrat = isStadtrat;

  const sorted = [...data].sort((a, b) => {
    let av = (a[sortField] || '').toString();
    let bv = (b[sortField] || '').toString();
    if (sortField === 'Listenplatz' || sortField === 'Stimmen') {
      return sortDir === 'asc' ? (parseInt(av)||0) - (parseInt(bv)||0) : (parseInt(bv)||0) - (parseInt(av)||0);
    }
    return sortDir === 'asc' ? av.localeCompare(bv, 'de') : bv.localeCompare(av, 'de');
  });
  _sortedData = sorted;

  const tbody = document.getElementById('list-tbody');
  const empty = document.getElementById('table-empty');
  if (sorted.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = sorted.map((row, idx) => {
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

    return `<tr data-idx="${idx}">
      <td style="text-align:right;font-size:11px;color:var(--text-light);padding-right:10px">${idx + 1}</td>
      ${isStadtrat ? `<td style="text-align:center;cursor:pointer" onmouseenter="showMemberPopup(${idx},this)" onmouseleave="scheduleHidePopup()">${avatar}</td>` : ''}
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

  let overviewHtml    = '';
  let bezirkFeatures  = [];
  let overviewFeatures = [];

  try {
    const uniqueFiles = [...new Set(OPENDATA_INDICATORS.map(i => i.file))];
    const [bezirkData, geoData, ...fileResults] = await Promise.all([
      fetchBezirkData(),
      fetchBezirkGeo(),
      ...uniqueFiles.map(f => fetchIndicator(f).catch(() => null)),
    ]);
    const fileMap = Object.fromEntries(uniqueFiles.map((f, i) => [f, fileResults[i]]));

    const statHtml = s =>
      `<div class="stat"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`;

    const buildGroupsHtml = (groups) =>
      Object.entries(groups).map(([name, stats]) => `
        <div class="steckbrief-group">
          <div class="steckbrief-group-label">${name}</div>
          <div class="steckbrief-stats">${stats.map(statHtml).join('')}</div>
        </div>`).join('');

    const addIndicators = (groups, raumbezugFilter, forStadtrat = false) => {
      let maxJahr = null;
      for (const ind of OPENDATA_INDICATORS) {
        if (forStadtrat && ind.skipForStadtrat) continue;
        const rows = fileMap[ind.file];
        if (!rows) continue;
        const matching = rows
          .filter(r => raumbezugFilter(r['Raumbezug']) && r['Ausprägung'] === ind.auspraegung)
          .sort((a, b) => Number(b['Jahr']) - Number(a['Jahr']));
        if (!matching.length) continue;
        const jahr = Number(matching[0]['Jahr']);
        if (!maxJahr || jahr > maxJahr) maxJahr = jahr;
        const formatted = Number(matching[0]['Indikatorwert']).toLocaleString('de', { maximumFractionDigits: ind.decimals ?? 1 });
        const val = ind.unit ? `${formatted} ${ind.unit}` : formatted;
        if (!groups[ind.group]) groups[ind.group] = [];
        groups[ind.group].push({ label: ind.label, value: val });
      }
      return maxJahr || new Date().getFullYear();
    };

    // Leerzeichen als Tausendertrennzeichen entfernen (z.B. "101 901")
    const parseNum = v => Number(String(v).replace(/\s/g, ''));

    if (isStadtrat) {
      overviewFeatures = geoData.features;

      const totalRow = bezirkData.find(r => r['stadtbezirk'] === 'insgesamt');
      const totalEW  = totalRow ? parseNum(totalRow['bevölkerung']) : 0;
      const totalHa  = totalRow ? parseNum(totalRow['fläche in ha']) : 0;
      const km2 = (totalHa / 100).toLocaleString('de', { maximumFractionDigits: 0 });

      const frau = data.filter(d => d['Geschlecht'] === 'Frau').length;
      const herr = data.filter(d => d['Geschlecht'] === 'Herr').length;

      const groups = {
        'Stadtrat': [
          { label: 'Mitglieder', value: String(data.length) },
          { label: 'Frauen',     value: String(frau) },
          { label: 'Männer',     value: String(herr) },
        ],
        'Bevölkerung': [
          { label: 'Einwohner', value: totalEW.toLocaleString('de') },
        ],
        'Fläche': [
          { label: 'Stadtfläche', value: km2 + ' km²' },
        ],
      };
      const standJahr = addIndicators(groups, rz => rz === 'Stadt München', true);

      // Stadtspitze: OB + 2. + 3. Bürgermeister*in via "Bürgermeister"-Spalte (Werte 1, 2, 3)
      const BUERGERMEISTER_LABELS = { '1': 'Oberbürgermeister', '2': '2. Bürgermeisterin', '3': '3. Bürgermeisterin' };
      const stadtspitzePersons = ['1','2','3'].map(nr => {
        const p = data.find(d => (d['Bürgermeister'] || '').trim() === nr);
        const rolle = BUERGERMEISTER_LABELS[nr];
        if (p) {
          const ini = ((p['Vorname']||'')[0]||'') + ((p['Nachname']||'')[0]||'');
          const av = p['Image']
            ? `<img class="sp-avatar" src="${p['Image']}" alt="${ini}">`
            : `<div class="sp-avatar sp-ph">${ini}</div>`;
          return `<div class="sp-person">${av}<div class="sp-name">${p['Vorname']||''} ${p['Nachname']||''}</div><div class="sp-rolle">${rolle}</div></div>`;
        }
        return `<div class="sp-person"><div class="sp-avatar sp-ph sp-empty"></div><div class="sp-name sp-name-empty">–</div><div class="sp-rolle">${rolle}</div></div>`;
      }).join('');

      overviewHtml = `
        <div class="chart-card steckbrief-info">
          <div class="chart-title">München</div>
          <div class="stadtspitze" style="margin-top:0; padding-top:0; border-top:none;">
            <div class="sp-persons">${stadtspitzePersons}</div>
          </div>
          ${buildGroupsHtml(groups)}
          <div class="steckbrief-source">Quelle: Open Data München · Stand ${standJahr}</div>
        </div>
        <div class="steckbrief-map-card"><div id="overview-map"></div></div>`;

    } else if (gremium.baNum) {
      const baPrefix = String(gremium.baNum).padStart(2, '0');
      const b = bezirkData.find(r => parseInt(r['stadtbezirksnummer']) === gremium.baNum);
      bezirkFeatures = geoData.features;

      if (b) {
        const ew     = parseNum(b['bevölkerung']).toLocaleString('de');
        const km2    = (parseNum(b['fläche in ha']) / 100).toLocaleString('de', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const dichte = parseNum(b['einwohnerdichte']).toLocaleString('de');

        const groups = {
          'Bevölkerung': [
            { label: 'Einwohner', value: ew },
          ],
          'Fläche': [
            { label: 'Fläche (km²)', value: km2 },
            { label: 'EW / ha',      value: dichte },
          ],
        };
        const standJahr = addIndicators(groups, rz => rz.startsWith(baPrefix));

        overviewHtml = `
          <div class="chart-card steckbrief-info">
            <div class="chart-title">Stadtbezirk</div>
            ${buildGroupsHtml(groups)}
            <div class="steckbrief-source">Quelle: Open Data München · Stand ${standJahr}</div>
          </div>
          <div class="steckbrief-map-card"><div id="bezirk-map"></div></div>`;
      }
    }
  } catch(e) { console.error(e); }

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

  const sectionTitle = isStadtrat ? 'Statistiken zum Stadtrat' : 'Statistiken zum Bezirksausschuss';
  const sectionDivider = `<div class="section-divider"><span class="section-title">${sectionTitle}</span></div>`;

  document.getElementById('content').innerHTML = `<div class="charts-grid">${overviewHtml}${sectionDivider}${chartCards}</div>`;

  if (overviewFeatures.length) initHomeMap(overviewFeatures);
  if (bezirkFeatures.length) initBezirkMap(bezirkFeatures, gremium.baNum);

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

// ─── Social Wall ─────────────────────────────────────────────────────────────
const SW_FEED_COLS = ['Feed_Instagram', 'Feed_Facebook', 'Feed_TikTok', 'Feed_Bluesky', 'Feed_Threads'];
const SW_PLATFORM_LABELS = {
  Feed_Instagram: 'Instagram', Feed_Facebook: 'Facebook',
  Feed_TikTok: 'TikTok', Feed_Bluesky: 'Bluesky', Feed_Threads: 'Threads',
};
const SW_CACHE_TTL = 30 * 60 * 1000; // 30 min — CDN-URLs laufen ab

function swCacheKey(url)  { return 'sw_feed_v4_' + url; }

function swReadCache(url) {
  try {
    const raw = localStorage.getItem(swCacheKey(url));
    if (!raw) return null;
    const { ts, items } = JSON.parse(raw);
    if (Date.now() - ts > SW_CACHE_TTL) { localStorage.removeItem(swCacheKey(url)); return null; }
    return items;
  } catch { return null; }
}

function swWriteCache(url, items) {
  try { localStorage.setItem(swCacheKey(url), JSON.stringify({ ts: Date.now(), items })); } catch {}
}

function clearSwCache() {
  Object.keys(localStorage).filter(k => k.startsWith('sw_feed_')).forEach(k => localStorage.removeItem(k));
  // Also bust the in-memory CSV cache so updated Feed_* columns are picked up
  delete dataCache['data/stadtrat.csv'];
  render();
}

function swParseFeed(xml, memberName, platform) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const items = [];
  doc.querySelectorAll('item').forEach(item => {
    const rawTitle = item.querySelector('title')?.textContent?.trim() || '';
    const link     = item.querySelector('link')?.textContent?.trim() || '';
    const pubDate  = item.querySelector('pubDate')?.textContent?.trim() || '';
    // description is always "From Instagram/Facebook/TikTok" → ignore it, title has the real text
    // Filter empty Facebook placeholder posts
    const text = (rawTitle === 'New Post' || rawTitle === '') ? '' : rawTitle;
    // Image: enclosure is reliably present; media:content needs namespace-aware lookup
    const encImg   = item.querySelector('enclosure[type^="image"]')?.getAttribute('url') || '';
    const mediaEl  = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0];
    const mediaImg = mediaEl?.getAttribute('url') || '';
    const img = encImg || mediaImg || '';
    const ts  = pubDate ? new Date(pubDate).getTime() : 0;
    if (!link) return;
    items.push({ text, link, pubDate, img, ts, memberName, platform });
  });
  return items;
}

async function swFetchFeed(url, memberName, platform) {
  const cached = swReadCache(url);
  if (cached !== null && cached.length > 0) return cached;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = swParseFeed(xml, memberName, platform);
    swWriteCache(url, items);
    return items;
  } catch { return []; }
}

async function swFetchAll(data) {
  const tasks = [];
  data.forEach(row => {
    const name = `${row['Vorname'] || ''} ${row['Nachname'] || ''}`.trim();
    SW_FEED_COLS.forEach(col => {
      const url = (row[col] || '').trim();
      if (url) tasks.push({ url, name, platform: SW_PLATFORM_LABELS[col] });
    });
  });
  // batch of 5 concurrent
  const results = [];
  for (let i = 0; i < tasks.length; i += 5) {
    const batch = tasks.slice(i, i + 5);
    const fetched = await Promise.all(batch.map(t => swFetchFeed(t.url, t.name, t.platform)));
    fetched.forEach(items => results.push(...items));
  }
  return results;
}

function swPlatformIcon(platform) {
  const map = { Instagram: 'si-ig', Facebook: 'si-fb', TikTok: 'si-tt', Bluesky: 'si-bs', Threads: 'si-th' };
  return map[platform] || '';
}

const SW_PLATFORM_COLORS = {
  Instagram: '#E4405F', Facebook: '#1877F2', TikTok: '#010101',
  Bluesky: '#0085FF', Threads: '#000000',
};

function swBuildCard(post) {
  const date    = post.ts ? new Date(post.ts).toLocaleDateString('de', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const rawText = post.text || '';
  const excerpt = rawText.length > 240 ? rawText.slice(0, 238) + '…' : rawText;
  const color   = SW_PLATFORM_COLORS[post.platform] || '#888';

  // TikTok thumbnails are .heic (only Safari can render) → show video placeholder
  // Any other unsupported format detected by .heic extension → same
  const isTikTok  = post.platform === 'TikTok';
  const isHeic    = post.img && post.img.includes('.heic');
  const useImg    = post.img && !isTikTok && !isHeic;

  const mediaHtml = isTikTok
    ? `<a class="sw-video-thumb" href="${post.link}" target="_blank" rel="noopener" style="background:${color}">
         <svg viewBox="0 0 24 24" fill="white" width="32" height="32"><path d="${SOCIAL_ICONS.TikTok.path}"/></svg>
       </a>`
    : useImg
      ? `<div class="sw-img-wrap"><a href="${post.link}" target="_blank" rel="noopener"><img class="sw-img" src="${post.img}" loading="lazy" alt="" onerror="this.closest('.sw-img-wrap').style.display='none'"></a></div>`
      : '';

  return `
    <div class="sw-card" data-platform="${post.platform}" data-member="${post.memberName}">
      ${mediaHtml}
      <div class="sw-body">
        <div class="sw-meta">
          <span class="sw-platform-badge" style="background:${color}">${post.platform}</span>
          <span class="sw-member">${post.memberName}</span>
          <span class="sw-date">${date}</span>
        </div>
        ${excerpt ? `<p class="sw-text">${excerpt}</p>` : ''}
        <a class="sw-link" href="${post.link}" target="_blank" rel="noopener">Zum Beitrag →</a>
      </div>
    </div>`;
}

async function renderSozialwall(data) {
  const content = document.getElementById('content');
  content.innerHTML = `<div class="sw-loading"><div class="spinner"></div><span>Social-Feeds werden geladen…</span></div>`;

  const allPosts = await swFetchAll(data);
  allPosts.sort((a, b) => b.ts - a.ts);

  if (!allPosts.length) {
    content.innerHTML = `<div class="sw-empty">Keine Feed-URLs in den CSV-Daten gefunden. Bitte Feed_Instagram, Feed_Facebook, Feed_TikTok, Feed_Bluesky oder Feed_Threads Spalten befüllen.</div>`;
    return;
  }

  const platforms = [...new Set(allPosts.map(p => p.platform))].sort();
  const members   = [...new Set(allPosts.map(p => p.memberName))].sort();

  const filterHtml = platforms.map(p =>
    `<button class="sw-filter-btn" data-platform="${p}">${p}</button>`
  ).join('');

  const memberOptions = members.map(m =>
    `<option value="${m}">${m}</option>`
  ).join('');

  content.innerHTML = `
    <div class="sw-toolbar">
      <div class="sw-filters">
        <button class="sw-filter-btn active" data-platform="">Alle</button>
        ${filterHtml}
      </div>
      <select class="sw-member-select" id="sw-member-select">
        <option value="">Alle Personen</option>
        ${memberOptions}
      </select>
      <button class="sw-refresh-btn" onclick="clearSwCache()">Aktualisieren</button>
    </div>
    <div class="sw-grid" id="sw-grid">
      ${allPosts.map(swBuildCard).join('')}
    </div>`;

  function applyFilters() {
    const plat   = content.querySelector('.sw-filter-btn.active')?.dataset.platform || '';
    const member = document.getElementById('sw-member-select')?.value || '';
    content.querySelectorAll('.sw-card').forEach(card => {
      const platMatch   = !plat   || card.dataset.platform === plat;
      const memberMatch = !member || card.dataset.member   === member;
      card.style.display = (platMatch && memberMatch) ? '' : 'none';
    });
  }

  content.querySelectorAll('.sw-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.sw-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });

  document.getElementById('sw-member-select').addEventListener('change', applyFilters);
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
  const { slug, tabRaw } = parseHash();

  if (slug === 'home') {
    navigate('stadtrat', 'steckbrief');
    return;
  }

  const gremium    = GREMIEN_BY_SLUG[slug] || GREMIEN[0];
  const defaultTab = gremium.tabs?.[0] || (gremium.type === 'ba' ? 'steckbrief' : 'liste');
  const tab        = tabRaw || defaultTab;
  const actualTab  = (gremium.tabs || ['liste','steckbrief']).includes(tab) ? tab : defaultTab;

  // Falls Slug unbekannt, Tab fehlt oder Tab ungültig → korrekten Hash setzen
  if (!GREMIEN_BY_SLUG[slug] || !tabRaw || actualTab !== tab) {
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
    if (actualTab === 'sozialwall') {
      document.getElementById('stats-bar').innerHTML = '';
      await renderSozialwall(data);
    } else if (actualTab === 'liste') {
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
