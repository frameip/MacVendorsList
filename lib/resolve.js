let ouiDb = null;
let lastApiCall = 0;

async function loadDb() {
  if (ouiDb) return ouiDb;
  try {
    const r = await fetch('./oui.json');
    ouiDb = await r.json();
  } catch {
    console.warn('oui.json unavailable, fallback to API only');
    ouiDb = {};
  }
  return ouiDb;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function apiLookup(mac) {
  const elapsed = Date.now() - lastApiCall;
  if (elapsed < 1000) await sleep(1000 - elapsed);
  lastApiCall = Date.now();
  const r = await fetch(`https://api.macvendors.com/${encodeURIComponent(mac)}`);
  if (r.status === 429) {
    const e = new Error('rate_limit');
    e.isRateLimit = true;
    throw e;
  }
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

// entries: Array<{raw: string, mac: string|null}>
// onUpdate: (rows: Row[]) => void  — appelé à chaque mise à jour
// Row: {display, vendor, source}  source ∈ 'local'|'api'|'inconnu'|'invalid'|'pending'
export async function resolveAll(entries, onUpdate) {
  const db = await loadDb();

  const rows = entries.map(({ raw, mac }) => {
    if (!mac) return { display: raw, vendor: 'format invalide', source: 'invalid' };
    const oui = mac.replace(/:/g, '').slice(0, 6);
    if (db[oui]) return { display: mac, vendor: db[oui], source: 'local' };
    return { display: mac, vendor: '...', source: 'pending', oui };
  });

  onUpdate([...rows]);

  let hasRateLimit = false;
  const ouiCache = {};

  for (const row of rows) {
    if (row.source !== 'pending') continue;

    if (ouiCache[row.oui] !== undefined) {
      row.vendor = ouiCache[row.oui] || 'inconnu';
      row.source = ouiCache[row.oui] ? 'api' : 'inconnu';
      onUpdate([...rows]);
      continue;
    }

    try {
      const vendor = await apiLookup(row.display);
      ouiCache[row.oui] = vendor || '';
      row.vendor = vendor || 'inconnu';
      row.source = vendor ? 'api' : 'inconnu';
    } catch (e) {
      if (e.isRateLimit) {
        hasRateLimit = true;
        // Mark all remaining pending rows as inconnu
        for (const remaining of rows) {
          if (remaining.source === 'pending') {
            remaining.vendor = 'inconnu';
            remaining.source = 'inconnu';
          }
        }
        onUpdate([...rows]);
        break;
      }
      ouiCache[row.oui] = '';
      row.vendor = 'inconnu';
      row.source = 'inconnu';
    }
    onUpdate([...rows]);
  }

  return { rows, hasRateLimit };
}
