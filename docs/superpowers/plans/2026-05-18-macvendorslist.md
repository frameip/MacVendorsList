# MacVendorsList Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static GitHub Pages site that accepts a batch of MAC addresses and returns the manufacturer via a local OUI database with API fallback.

**Architecture:** Vanilla HTML/CSS/JS, no build step. `lib/parse.js` handles pure parsing (testable in Node), `lib/resolve.js` handles hybrid lookup (local OUI JSON first, `api.macvendors.com` fallback at 1 req/s). `app.js` wires the DOM. `scripts/build-oui.mjs` regenerates `oui.json` on demand.

**Tech Stack:** Vanilla ES modules, Node 20+ built-in test runner, GitHub Pages (static, root of `main`).

---

## File Map

| Path | Role |
|------|------|
| `index.html` | Single page: textarea, buttons, results table |
| `style.css` | All visual styling |
| `lib/parse.js` | Pure functions: normalizeMAC, extractOUI, splitInput |
| `lib/resolve.js` | resolveAll — OUI lookup + API queue |
| `app.js` | DOM event wiring and rendering |
| `oui.json` | Pre-built OUI database `{"AABBCC":"Vendor"}` |
| `scripts/build-oui.mjs` | Node script to regenerate oui.json from IEEE |
| `test/parse.test.mjs` | Node built-in test runner tests for lib/parse.js |

---

## Task 1: Générer la base OUI locale (oui.json)

**Files:**
- Create: `scripts/build-oui.mjs`
- Create: `oui.json` (généré par le script)

- [ ] **Step 1 : Créer le script**

Créer `scripts/build-oui.mjs` :

```mjs
import { writeFile } from 'fs/promises';
import https from 'https';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const OUI_URL = 'https://standards-oui.ieee.org/oui/oui.csv';
const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'oui.json');

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, (r) => {
      const b = [];
      r.on('data', d => b.push(d));
      r.on('end', () => res(Buffer.concat(b).toString()));
      r.on('error', rej);
    }).on('error', rej);
  });
}

function parse(csv) {
  const db = {};
  for (const line of csv.split('\n').slice(1)) {
    const m = line.match(/^[A-Z-]+,([0-9A-Fa-f]{6}),"?([^",\r]+)/i);
    if (!m) continue;
    db[m[1].toUpperCase()] = m[2].trim();
  }
  return db;
}

const csv = await get(OUI_URL);
const db = parse(csv);
await writeFile(OUT, JSON.stringify(db));
console.log(`oui.json : ${Object.keys(db).length} entrées`);
```

- [ ] **Step 2 : Lancer le script**

```bash
node scripts/build-oui.mjs
```

Sortie attendue :
```
oui.json : 37000+ entrées
```

- [ ] **Step 3 : Vérifier oui.json**

```bash
node -e "const d=JSON.parse(require('fs').readFileSync('oui.json')); console.log(Object.keys(d).length, d['FCAA14'])"
```

Sortie attendue (exemple) :
```
37xxx Apple, Inc.
```

- [ ] **Step 4 : Committer**

```bash
git add scripts/build-oui.mjs oui.json
git commit -m "feat: add OUI database generation script and initial oui.json"
```

---

## Task 2: lib/parse.js — logique pure (TDD)

**Files:**
- Create: `test/parse.test.mjs`
- Create: `lib/parse.js`

- [ ] **Step 1 : Écrire les tests (ils doivent échouer)**

Créer `test/parse.test.mjs` :

```mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMAC, extractOUI, splitInput } from '../lib/parse.js';

// normalizeMAC

test('normalizeMAC: format colon', () => {
  assert.equal(normalizeMAC('aa:bb:cc:dd:ee:ff'), 'AA:BB:CC:DD:EE:FF');
});

test('normalizeMAC: format dash', () => {
  assert.equal(normalizeMAC('aa-bb-cc-dd-ee-ff'), 'AA:BB:CC:DD:EE:FF');
});

test('normalizeMAC: format Cisco (points)', () => {
  assert.equal(normalizeMAC('aabb.ccdd.eeff'), 'AA:BB:CC:DD:EE:FF');
});

test('normalizeMAC: format sans séparateur', () => {
  assert.equal(normalizeMAC('aabbccddeeff'), 'AA:BB:CC:DD:EE:FF');
});

test('normalizeMAC: casse indifférente', () => {
  assert.equal(normalizeMAC('AA:BB:CC:DD:EE:FF'), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizeMAC('Aa:Bb:Cc:Dd:Ee:Ff'), 'AA:BB:CC:DD:EE:FF');
});

test('normalizeMAC: invalide → null (mauvais caractères)', () => {
  assert.equal(normalizeMAC('ZZ:BB:CC:DD:EE:FF'), null);
});

test('normalizeMAC: invalide → null (trop court)', () => {
  assert.equal(normalizeMAC('AA:BB:CC'), null);
});

test('normalizeMAC: invalide → null (chaîne vide)', () => {
  assert.equal(normalizeMAC(''), null);
});

test('normalizeMAC: invalide → null (12 chiffres + 2)', () => {
  assert.equal(normalizeMAC('aabbccddeeffgg'), null);
});

// extractOUI

test('extractOUI: extrait les 3 premiers octets', () => {
  assert.equal(extractOUI('AA:BB:CC:DD:EE:FF'), 'AABBCC');
  assert.equal(extractOUI('00:11:22:33:44:55'), '001122');
});

// splitInput

test('splitInput: séparateur newline', () => {
  assert.deepEqual(
    splitInput('aa:bb:cc:dd:ee:ff\nAA-BB-CC-DD-EE-FF'),
    ['aa:bb:cc:dd:ee:ff', 'AA-BB-CC-DD-EE-FF']
  );
});

test('splitInput: séparateur virgule', () => {
  assert.deepEqual(
    splitInput('aa:bb:cc:dd:ee:ff,AA-BB-CC-DD-EE-FF'),
    ['aa:bb:cc:dd:ee:ff', 'AA-BB-CC-DD-EE-FF']
  );
});

test('splitInput: séparateurs mixtes', () => {
  assert.deepEqual(
    splitInput('aa:bb:cc:dd:ee:ff; AA-BB-CC-DD-EE-FF, aabb.ccdd.eeff'),
    ['aa:bb:cc:dd:ee:ff', 'AA-BB-CC-DD-EE-FF', 'aabb.ccdd.eeff']
  );
});

test('splitInput: filtre les chaînes vides', () => {
  assert.deepEqual(splitInput('   \n  '), []);
});
```

- [ ] **Step 2 : Confirmer l'échec**

```bash
node --test test/parse.test.mjs
```

Attendu : `Cannot find module '../lib/parse.js'` ou équivalent — toutes les suites échouent.

- [ ] **Step 3 : Implémenter lib/parse.js**

Créer `lib/parse.js` :

```js
export function normalizeMAC(raw) {
  const s = raw.trim();

  // Colon ou dash : AA:BB:CC:DD:EE:FF ou AA-BB-CC-DD-EE-FF
  const cd = s.match(/^([0-9a-f]{2})[:\-]([0-9a-f]{2})[:\-]([0-9a-f]{2})[:\-]([0-9a-f]{2})[:\-]([0-9a-f]{2})[:\-]([0-9a-f]{2})$/i);
  if (cd) return cd.slice(1).join(':').toUpperCase();

  // Cisco : AABB.CCDD.EEFF
  const cisco = s.match(/^([0-9a-f]{4})\.([0-9a-f]{4})\.([0-9a-f]{4})$/i);
  if (cisco) {
    const hex = (cisco[1] + cisco[2] + cisco[3]).toUpperCase();
    return hex.match(/.{2}/g).join(':');
  }

  // Sans séparateur : AABBCCDDEEFF
  const plain = s.match(/^([0-9a-f]{12})$/i);
  if (plain) return s.toUpperCase().match(/.{2}/g).join(':');

  return null;
}

export function extractOUI(mac) {
  return mac.replace(/:/g, '').slice(0, 6);
}

export function splitInput(text) {
  return text.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
}
```

- [ ] **Step 4 : Confirmer le passage**

```bash
node --test test/parse.test.mjs
```

Attendu : tous les tests `✔ pass`, 0 échec.

- [ ] **Step 5 : Committer**

```bash
git add lib/parse.js test/parse.test.mjs
git commit -m "feat: add MAC address parsing library with tests"
```

---

## Task 3: lib/resolve.js — résolution hybride

**Files:**
- Create: `lib/resolve.js`

- [ ] **Step 1 : Créer lib/resolve.js**

```js
let ouiDb = null;
let lastApiCall = 0;

async function loadDb() {
  if (ouiDb) return ouiDb;
  const r = await fetch('./oui.json');
  ouiDb = await r.json();
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
      if (e.isRateLimit) hasRateLimit = true;
      ouiCache[row.oui] = '';
      row.vendor = 'inconnu';
      row.source = 'inconnu';
    }
    onUpdate([...rows]);
  }

  return { rows, hasRateLimit };
}
```

- [ ] **Step 2 : Committer**

```bash
git add lib/resolve.js
git commit -m "feat: add hybrid OUI resolution (local DB + API fallback)"
```

---

## Task 4: index.html + style.css

**Files:**
- Create: `index.html`
- Create: `style.css`

- [ ] **Step 1 : Créer index.html**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAC Vendors List</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main>
    <h1>MAC Vendors List</h1>
    <p class="subtitle">Collez vos adresses MAC pour identifier les constructeurs.<br>
      Formats acceptés : <code>AA:BB:CC:DD:EE:FF</code>, <code>AA-BB-CC-DD-EE-FF</code>,
      <code>AABB.CCDD.EEFF</code>, <code>AABBCCDDEEFF</code></p>

    <section class="input-section">
      <textarea id="mac-input"
        placeholder="AA:BB:CC:DD:EE:FF&#10;AA-BB-CC-DD-EE-FF&#10;AABB.CCDD.EEFF&#10;..."
        rows="8" spellcheck="false" autocomplete="off"></textarea>
      <div class="input-actions">
        <button id="btn-resolve">Identifier</button>
        <button id="btn-clear" class="secondary">Effacer</button>
      </div>
    </section>

    <div id="rate-limit-warning" class="warning hidden">
      Quota API atteint (429). Certaines adresses sont marquées « inconnu ». Réessayez dans quelques minutes.
    </div>

    <section id="results-section" class="hidden">
      <div class="results-header">
        <span id="results-count"></span>
        <div class="results-actions">
          <button id="btn-copy" class="secondary">Copier le tableau</button>
          <button id="btn-csv" class="secondary">Export CSV</button>
        </div>
      </div>
      <table id="results-table">
        <thead>
          <tr>
            <th>Adresse MAC</th>
            <th>Constructeur</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody id="results-body"></tbody>
      </table>
    </section>
  </main>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2 : Créer style.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #f5f6fa;
  color: #1a1a2e;
  min-height: 100vh;
  padding: 2rem 1rem;
}

main {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f3460;
}

.subtitle {
  color: #555;
  line-height: 1.6;
}

code {
  background: #e8eaf0;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-size: 0.85em;
  font-family: 'Courier New', monospace;
}

/* Input */

.input-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #d1d5e0;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  resize: vertical;
  transition: border-color 0.2s;
  background: #fff;
}

textarea:focus {
  outline: none;
  border-color: #0f3460;
}

textarea.error {
  border-color: #e74c3c;
}

.input-actions {
  display: flex;
  gap: 0.75rem;
}

/* Buttons */

button {
  padding: 0.6rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  background: #0f3460;
  color: #fff;
}

button:hover { background: #16213e; }
button:disabled { opacity: 0.5; cursor: not-allowed; }

button.secondary {
  background: #e8eaf0;
  color: #333;
}

button.secondary:hover { background: #d1d5e0; }

/* Warning */

.warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  color: #7d5a00;
}

/* Results */

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.results-actions { display: flex; gap: 0.5rem; }

#results-count { font-weight: 600; color: #555; }

table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

th {
  background: #0f3460;
  color: #fff;
  text-align: left;
  padding: 0.65rem 1rem;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

td {
  padding: 0.6rem 1rem;
  border-bottom: 1px solid #f0f1f5;
  font-size: 0.9rem;
}

tr:last-child td { border-bottom: none; }
tr:nth-child(even) { background: #fafbfc; }
tr[data-source="invalid"] td { color: #999; }

.mono { font-family: 'Courier New', monospace; }

/* Badges */

.badge {
  display: inline-block;
  padding: 0.2em 0.55em;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.badge-local  { background: #d4edda; color: #155724; }
.badge-api    { background: #cce5ff; color: #004085; }
.badge-inconnu, .badge-invalid { background: #f8d7da; color: #721c24; }
.badge-pending { background: #e8eaf0; color: #555; }

.hidden { display: none !important; }
```

- [ ] **Step 3 : Committer**

```bash
git add index.html style.css
git commit -m "feat: add HTML structure and CSS styling"
```

---

## Task 5: app.js — câblage DOM

**Files:**
- Create: `app.js`

- [ ] **Step 1 : Créer app.js**

```js
import { normalizeMAC, splitInput } from './lib/parse.js';
import { resolveAll } from './lib/resolve.js';

const macInput      = document.getElementById('mac-input');
const btnResolve    = document.getElementById('btn-resolve');
const btnClear      = document.getElementById('btn-clear');
const btnCopy       = document.getElementById('btn-copy');
const btnCsv        = document.getElementById('btn-csv');
const rateLimitWarn = document.getElementById('rate-limit-warning');
const resultsSection= document.getElementById('results-section');
const resultsBody   = document.getElementById('results-body');
const resultsCount  = document.getElementById('results-count');

const SOURCE_LABELS = { local: 'local', api: 'api', inconnu: 'inconnu', invalid: 'invalide', pending: '...' };

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderRows(rows) {
  resultsBody.innerHTML = '';
  for (const row of rows) {
    const label = SOURCE_LABELS[row.source] ?? row.source;
    const tr = document.createElement('tr');
    tr.dataset.source = row.source;
    tr.innerHTML =
      `<td class="mono">${esc(row.display)}</td>` +
      `<td>${esc(row.vendor)}</td>` +
      `<td><span class="badge badge-${esc(row.source)}">${esc(label)}</span></td>`;
    resultsBody.appendChild(tr);
  }
  const n = rows.length;
  resultsCount.textContent = `${n} adresse${n > 1 ? 's' : ''}`;
}

btnResolve.addEventListener('click', async () => {
  const tokens = splitInput(macInput.value);
  if (tokens.length === 0) {
    macInput.classList.add('error');
    setTimeout(() => macInput.classList.remove('error'), 1500);
    return;
  }

  rateLimitWarn.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  btnResolve.disabled = true;

  const entries = tokens.map(t => ({ raw: t, mac: normalizeMAC(t) }));
  const { hasRateLimit } = await resolveAll(entries, renderRows);

  if (hasRateLimit) rateLimitWarn.classList.remove('hidden');
  btnResolve.disabled = false;
});

btnClear.addEventListener('click', () => {
  macInput.value = '';
  resultsSection.classList.add('hidden');
  rateLimitWarn.classList.add('hidden');
});

btnCopy.addEventListener('click', () => {
  const header = 'Adresse MAC\tConstructeur\tSource';
  const rows = [...resultsBody.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('td')].map(td => td.textContent.trim()).join('\t')
  );
  navigator.clipboard.writeText([header, ...rows].join('\n'));
});

btnCsv.addEventListener('click', () => {
  const q = s => `"${s.replace(/"/g, '""')}"`;
  const header = [q('Adresse MAC'), q('Constructeur'), q('Source')].join(',');
  const rows = [...resultsBody.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('td')].map(td => q(td.textContent.trim())).join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'mac-vendors.csv' }).click();
  URL.revokeObjectURL(url);
});
```

- [ ] **Step 2 : Committer**

```bash
git add app.js
git commit -m "feat: add DOM event wiring and rendering (app.js)"
```

---

## Task 6: Déploiement GitHub Pages

**Files:** aucun

- [ ] **Step 1 : Pousser sur GitHub**

```bash
git push -u origin main
```

- [ ] **Step 2 : Activer GitHub Pages**

```bash
gh api repos/slynet76/MacVendorsList/pages \
  --method POST \
  --field source='{"branch":"main","path":"/"}'
```

Réponse attendue : JSON avec `"status": "enabled"` ou `"built"`.

- [ ] **Step 3 : Vérifier l'URL**

```bash
gh api repos/slynet76/MacVendorsList/pages --jq '.html_url'
```

Attendu : `https://slynet76.github.io/MacVendorsList/`

- [ ] **Step 4 : Tester manuellement**
  - Ouvrir l'URL dans un navigateur (attendre ~1–2 min après activation).
  - Coller `AA:BB:CC:DD:EE:FF` → constructeur "Unknown" ou "inconnu" (OUI test).
  - Coller `FCAA14AABBCC` → constructeur "Apple, Inc." (via base locale).
  - Coller `ZZ:ZZ:ZZ` → ligne "format invalide".
  - Tester « Copier le tableau » et « Export CSV ».
