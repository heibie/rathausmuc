// ─── Gremien ──────────────────────────────────────────────────────────────────
const GREMIEN = [
  {
    slug:    'stadtrat',
    name:    'Stadtrat',
    full:    'Stadtrat München 2026',
    csvFile: 'data/stadtrat.csv',
    type:    'stadtrat',
    tabs:    ['steckbrief', 'liste', 'netzwerkkarte'],
  },
  { slug: 'ba01', name: 'BA 01', full: 'BA 01 · Altstadt-Lehel',                                         csvFile: 'data/ba01.csv', type: 'ba', baNum: 1  },
  { slug: 'ba02', name: 'BA 02', full: 'BA 02 · Ludwigsvorstadt-Isarvorstadt',                            csvFile: 'data/ba02.csv', type: 'ba', baNum: 2  },
  { slug: 'ba03', name: 'BA 03', full: 'BA 03 · Maxvorstadt',                                             csvFile: 'data/ba03.csv', type: 'ba', baNum: 3  },
  { slug: 'ba04', name: 'BA 04', full: 'BA 04 · Schwabing-West',                                          csvFile: 'data/ba04.csv', type: 'ba', baNum: 4  },
  { slug: 'ba05', name: 'BA 05', full: 'BA 05 · Au-Haidhausen',                                           csvFile: 'data/ba05.csv', type: 'ba', baNum: 5  },
  { slug: 'ba06', name: 'BA 06', full: 'BA 06 · Sendling',                                                csvFile: 'data/ba06.csv', type: 'ba', baNum: 6  },
  { slug: 'ba07', name: 'BA 07', full: 'BA 07 · Sendling-Westpark',                                       csvFile: 'data/ba07.csv', type: 'ba', baNum: 7  },
  { slug: 'ba08', name: 'BA 08', full: 'BA 08 · Schwanthalerhöhe',                                        csvFile: 'data/ba08.csv', type: 'ba', baNum: 8  },
  { slug: 'ba09', name: 'BA 09', full: 'BA 09 · Neuhausen-Nymphenburg',                                   csvFile: 'data/ba09.csv', type: 'ba', baNum: 9  },
  { slug: 'ba10', name: 'BA 10', full: 'BA 10 · Moosach',                                                 csvFile: 'data/ba10.csv', type: 'ba', baNum: 10 },
  { slug: 'ba11', name: 'BA 11', full: 'BA 11 · Milbertshofen-Am Hart',                                   csvFile: 'data/ba11.csv', type: 'ba', baNum: 11 },
  { slug: 'ba12', name: 'BA 12', full: 'BA 12 · Schwabing-Freimann',                                      csvFile: 'data/ba12.csv', type: 'ba', baNum: 12 },
  { slug: 'ba13', name: 'BA 13', full: 'BA 13 · Bogenhausen',                                             csvFile: 'data/ba13.csv', type: 'ba', baNum: 13 },
  { slug: 'ba14', name: 'BA 14', full: 'BA 14 · Berg am Laim',                                            csvFile: 'data/ba14.csv', type: 'ba', baNum: 14 },
  { slug: 'ba15', name: 'BA 15', full: 'BA 15 · Trudering-Riem',                                          csvFile: 'data/ba15.csv', type: 'ba', baNum: 15 },
  { slug: 'ba16', name: 'BA 16', full: 'BA 16 · Ramersdorf-Perlach',                                      csvFile: 'data/ba16.csv', type: 'ba', baNum: 16 },
  { slug: 'ba17', name: 'BA 17', full: 'BA 17 · Obergiesing-Fasangarten',                                 csvFile: 'data/ba17.csv', type: 'ba', baNum: 17 },
  { slug: 'ba18', name: 'BA 18', full: 'BA 18 · Untergiesing-Harlaching',                                 csvFile: 'data/ba18.csv', type: 'ba', baNum: 18 },
  { slug: 'ba19', name: 'BA 19', full: 'BA 19 · Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln',  csvFile: 'data/ba19.csv', type: 'ba', baNum: 19 },
  { slug: 'ba20', name: 'BA 20', full: 'BA 20 · Hadern',                                                  csvFile: 'data/ba20.csv', type: 'ba', baNum: 20 },
  { slug: 'ba21', name: 'BA 21', full: 'BA 21 · Pasing-Obermenzing',                                      csvFile: 'data/ba21.csv', type: 'ba', baNum: 21 },
  { slug: 'ba22', name: 'BA 22', full: 'BA 22 · Aubing-Lochhausen-Langwied',                              csvFile: 'data/ba22.csv', type: 'ba', baNum: 22 },
  { slug: 'ba23', name: 'BA 23', full: 'BA 23 · Allach-Untermenzing',                                     csvFile: 'data/ba23.csv', type: 'ba', baNum: 23 },
  { slug: 'ba24', name: 'BA 24', full: 'BA 24 · Feldmoching-Hasenbergl',                                  csvFile: 'data/ba24.csv', type: 'ba', baNum: 24 },
  { slug: 'ba25', name: 'BA 25', full: 'BA 25 · Laim',                                                    csvFile: 'data/ba25.csv', type: 'ba', baNum: 25 },
];

const GREMIEN_BY_SLUG = Object.fromEntries(GREMIEN.map(g => [g.slug, g]));

// ─── Open-Data-Indikatoren (Indikatorenatlas München) ─────────────────────────
// Format: CSV mit Spalten Indikator, Ausprägung, Jahr, Raumbezug, Indikatorwert
// Raumbezug-Präfix: zweistellige BA-Nummer "01 Altstadt - Lehel"
// group: Rubrik für die Steckbriefanzeige (Bevölkerung | Fläche | Mobilität)
const OPENDATA_INDICATORS = [
  // Bevölkerung
  { group: 'Bevölkerung', file: 'data/bevoelkerungsanteil.csv',  label: 'Anteil an München', auspraegung: 'insgesamt',          decimals: 1, unit: '%',      skipForStadtrat: true },
  { group: 'Bevölkerung', file: 'data/durchschnittsalter.csv',   label: 'Ø Alter (Jahre)',   auspraegung: 'insgesamt',          decimals: 1 },
  { group: 'Bevölkerung', file: 'data/altersgruppen.csv',        label: 'Unter 18',          auspraegung: 'bis 17 Jahre',       decimals: 1, unit: '%' },
  { group: 'Bevölkerung', file: 'data/altersgruppen.csv',        label: '65 Jahre+',         auspraegung: '65 Jahre und älter', decimals: 1, unit: '%' },
  { group: 'Bevölkerung', file: 'data/einpersonenhaushalte.csv', label: 'Einpersonen-HH',    auspraegung: 'insgesamt',          decimals: 1, unit: '%' },
  // Fläche
  { group: 'Fläche', file: 'data/bevoelkerungsdichte.csv',  label: 'Dichte',             auspraegung: 'insgesamt',                          decimals: 0, unit: 'EW/km²' },
  { group: 'Fläche', file: 'data/flaechennutzung.csv',      label: 'Siedlung & Verkehr', auspraegung: 'Siedlungs- und Verkehrsfläche',      decimals: 1, unit: '%' },
  { group: 'Fläche', file: 'data/flaechennutzung.csv',      label: 'Grün & Natur',       auspraegung: 'Wald-, Wasser- und Erholungsfläche', decimals: 1, unit: '%' },
  // Mobilität
  { group: 'Mobilität', file: 'data/motorisierungsgrad.csv', label: 'PKW / 1.000 EW', auspraegung: 'insgesamt', decimals: 0 },
  { group: 'Mobilität', file: 'data/erstzulassung_pkw.csv',  label: 'Erstzulassung',   auspraegung: 'insgesamt', decimals: 1, unit: '%' },
];

// ─── Parteifarben ─────────────────────────────────────────────────────────────
const PARTY_COLORS = {
  'CSU':           { bg: '#000000', fg: '#fff' },
  'SPD':           { bg: '#CC0033', fg: '#fff' },
  'Grünen':        { bg: '#32A45F', fg: '#fff' },
  'Freie Wähler':  { bg: '#39B4C4', fg: '#fff' },
  'AfD':           { bg: '#99CCFF', fg: '#111' },
  'FDP':           { bg: '#FCCC34', fg: '#111' },
  'Linke':         { bg: '#8F57C7', fg: '#fff' },
  'Volt':          { bg: '#582C83', fg: '#fff' },
  'ÖDP':           { bg: '#FB9966', fg: '#111' },
  'PARTEI':        { bg: '#800808', fg: '#fff' },
  'Rosa Liste':    { bg: '#E4007E', fg: '#fff' },
  'München Liste': { bg: '#85AEDC', fg: '#fff' },
  'BK':            { bg: '#A0A0A0', fg: '#fff' },
};

function partyColor(name) {
  if (!name) return { bg: '#e4e6ea', fg: '#74788a' };
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(PARTY_COLORS)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return { bg: '#e4e6ea', fg: '#74788a' };
}

// ─── Social Icons ─────────────────────────────────────────────────────────────
const SOCIAL_ICONS = {
  Instagram: { cls: 'si-ig', label: 'Instagram', color: '#E4405F',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
  Facebook:  { cls: 'si-fb', label: 'Facebook',  color: '#1877F2',
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
  LinkedIn:  { cls: 'si-li', label: 'LinkedIn',  color: '#0A66C2',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
  TikTok:    { cls: 'si-tt', label: 'TikTok',    color: '#010101',
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
  Mastodon:  { cls: 'si-ms', label: 'Mastodon',  color: '#6364FF',
    path: 'M23.268 5.313c-.35-2.409-2.622-4.3-5.273-4.715-4.18-.643-8.337-.717-12.5 0C2.622 1.013.35 2.903 0 5.313-.133 6.2-.12 7.108-.05 8.01c.17 1.952.32 3.908.554 5.852.175 1.479.484 2.936 1.02 4.333.961 2.6 3.248 4.47 5.968 4.921 2.764.457 5.48.537 8.235.194.32-.04.64-.09.956-.145.58-.1 1.15-.23 1.717-.374l-.1-.992-.1-.99c-.677.238-1.36.445-2.05.606-2.387.55-4.827.587-7.23.196-2.118-.356-3.972-1.9-4.592-3.962-.164-.54-.29-1.09-.38-1.647a22.627 22.627 0 01-.033-.2l.153.02c1.694.211 3.382.476 5.073.686 3.097.383 6.214.557 9.342.38 1.77-.1 3.484-.557 4.832-1.73.994-.869 1.67-2.064 1.929-3.341.247-1.225.37-2.47.39-3.715-.004-.32.004-.64.004-.96zm-3.44 5.04h-2.163V6.02c0-1.085-.458-1.635-1.38-1.635-1.018 0-1.528.656-1.528 1.953v2.826h-2.153V6.338c0-1.297-.51-1.953-1.528-1.953-.922 0-1.38.55-1.38 1.635v4.333H7.533V5.96c0-1.085.277-1.944.832-2.578.574-.633 1.323-.959 2.252-.959 1.077 0 1.89.414 2.43 1.242l.524.879.524-.879c.54-.828 1.353-1.242 2.43-1.242.93 0 1.678.326 2.252.959.555.634.832 1.493.832 2.578v4.393z' },
  Bluesky:   { cls: 'si-bs', label: 'Bluesky',   color: '#0085FF',
    path: 'M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 01-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z' },
  Threads:   { cls: 'si-th', label: 'Threads',   color: '#000000',
    path: 'M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 011.57.043c-.224-.776-.708-1.33-1.413-1.553-1.302-.417-2.828-.037-4.01.997l-.977-1.366c1.52-1.337 3.576-1.912 5.615-1.265 1.73.554 2.868 1.877 3.053 3.622a11.93 11.93 0 011.252.422c1.051.44 1.908 1.189 2.388 2.262.773 1.77.915 4.605-1.354 6.827-1.756 1.716-3.966 2.491-7.092 2.515zm-1.024-7.03c-.956.051-1.7.299-2.161.716-.39.355-.576.824-.546 1.356.046.857.672 1.474 1.612 1.647.12.022.243.033.367.033.714 0 1.391-.225 1.953-.654.719-.546 1.15-1.404 1.24-2.456a12.003 12.003 0 00-1.265-.07 10.83 10.83 0 00-1.2.428z' },
};
