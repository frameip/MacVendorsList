# Cisco MAC Table Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre le site pour auto-détecter et parser la sortie `show mac address-table` Cisco, en affichant VLAN / MAC / Type / Port / Constructeur / Source.

**Architecture:** Deux nouvelles fonctions pures dans `lib/parse.js` (`detectFormat`, `parseCiscoTable`) testées en TDD. `app.js` branche sur le format détecté, injecte les bons `<th>` et rend les lignes avec les colonnes Cisco. `index.html` reçoit un nouveau placeholder. Les boutons Copier/CSV lisent les colonnes depuis le DOM — aucune modification nécessaire sur leur logique.

**Tech Stack:** Vanilla ES modules, Node 20 built-in test runner, GitHub Pages.

---

## File Map

| Fichier | Changement |
|---------|-----------|
| `lib/parse.js` | +`detectFormat(text)`, +`parseCiscoTable(text)` |
| `test/parse.test.mjs` | +8 nouveaux cas (detectFormat + parseCiscoTable) |
| `app.js` | +`setHeaders(mode)`, +`renderCiscoRows()`, handler btnResolve branché sur format, btnCopy/btnCsv lisent thead depuis DOM |
| `index.html` | Placeholder textarea mis à jour |

---

## Task 1: lib/parse.js — detectFormat + parseCiscoTable (TDD)

**Files:**
- Modify: `lib/parse.js`
- Modify: `test/parse.test.mjs`

- [ ] **Step 1 : Ajouter les imports dans le fichier de test**

En haut de `test/parse.test.mjs`, modifier la ligne d'import :

```mjs
import { normalizeMAC, extractOUI, splitInput, detectFormat, parseCiscoTable } from '../lib/parse.js';
```

- [ ] **Step 2 : Ajouter les 8 nouveaux tests à la fin de test/parse.test.mjs**

Ajouter après le dernier test existant :

```mjs
// ── detectFormat ──────────────────────────────────────────────────────────────

const CISCO_SAMPLE = `Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
 All    0100.0ccc.cccc    STATIC      CPU
   1    04d5.90d0.f034    DYNAMIC     Po2
  93    0009.0f09.0003    DYNAMIC     Gi2/0/45
Total Mac Addresses for this criterion: 3`;

test('detectFormat: retourne cisco sur en-tête Cisco', () => {
  assert.equal(detectFormat(CISCO_SAMPLE), 'cisco');
});

test('detectFormat: retourne simple sur liste de MAC', () => {
  assert.equal(detectFormat('aa:bb:cc:dd:ee:ff\nAA-BB-CC-DD-EE-FF'), 'simple');
});

// ── parseCiscoTable ───────────────────────────────────────────────────────────

test('parseCiscoTable: parse une ligne VLAN numérique', () => {
  const result = parseCiscoTable(CISCO_SAMPLE);
  assert.deepEqual(result[1], { vlan: '1', rawMac: '04d5.90d0.f034', type: 'DYNAMIC', port: 'Po2' });
});

test('parseCiscoTable: parse une ligne VLAN All', () => {
  const result = parseCiscoTable(CISCO_SAMPLE);
  assert.deepEqual(result[0], { vlan: 'All', rawMac: '0100.0ccc.cccc', type: 'STATIC', port: 'CPU' });
});

test('parseCiscoTable: ignore les séparateurs ----', () => {
  const result = parseCiscoTable(CISCO_SAMPLE);
  assert.ok(result.every(e => !/^-+$/.test(e.vlan)));
});

test('parseCiscoTable: ignore la ligne Total', () => {
  const result = parseCiscoTable(CISCO_SAMPLE);
  assert.equal(result.length, 3);
});

test('parseCiscoTable: ignore la ligne d\'en-tête', () => {
  const result = parseCiscoTable(CISCO_SAMPLE);
  assert.ok(result.every(e => e.vlan !== 'Vlan'));
});

test('parseCiscoTable: retourne tableau vide sur entrée vide', () => {
  assert.deepEqual(parseCiscoTable(''), []);
});
```

- [ ] **Step 3 : Confirmer l'échec**

```bash
node --test test/parse.test.mjs
```

Attendu : les 8 nouveaux tests échouent avec `detectFormat is not a function` / `parseCiscoTable is not a function`. Les 14 tests existants continuent de passer.

- [ ] **Step 4 : Implémenter les deux fonctions dans lib/parse.js**

Ajouter à la fin de `lib/parse.js` (après `splitInput`) :

```js
export function detectFormat(text) {
  return /vlan\s+mac\s+address\s+type\s+ports/i.test(text) ? 'cisco' : 'simple';
}

export function parseCiscoTable(text) {
  const entries = [];
  for (const line of text.split('\n')) {
    if (/vlan\s+mac\s+address/i.test(line)) continue;
    if (/^[\s\-]+$/.test(line)) continue;
    if (/^\s*total/i.test(line)) continue;
    const m = line.match(
      /^\s*(\S+)\s+([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+(\S+)\s+(\S+)/i
    );
    if (!m) continue;
    entries.push({ vlan: m[1], rawMac: m[2], type: m[3], port: m[4] });
  }
  return entries;
}
```

- [ ] **Step 5 : Confirmer le passage**

```bash
node --test test/parse.test.mjs
```

Attendu :
```
ℹ tests 22
ℹ pass 22
ℹ fail 0
```

- [ ] **Step 6 : Committer**

```bash
git add lib/parse.js test/parse.test.mjs
git commit -m "feat: add detectFormat and parseCiscoTable to parse.js"
```

---

## Task 2: app.js — intégration mode Cisco

**Files:**
- Modify: `app.js`

- [ ] **Step 1 : Remplacer intégralement app.js**

```js
import { normalizeMAC, splitInput, detectFormat, parseCiscoTable } from './lib/parse.js';
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
const theadRow      = document.querySelector('#results-table thead tr');

const SOURCE_LABELS = { local: 'local', api: 'api', inconnu: 'inconnu', invalid: 'invalide', pending: '...' };

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setHeaders(mode) {
  theadRow.innerHTML = mode === 'cisco'
    ? '<th>VLAN</th><th>Adresse MAC</th><th>Type</th><th>Port</th><th>Constructeur</th><th>Source</th>'
    : '<th>Adresse MAC</th><th>Constructeur</th><th>Source</th>';
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

function renderCiscoRows(ciscoLines, resolvedRows) {
  resultsBody.innerHTML = '';
  resolvedRows.forEach((row, i) => {
    const meta = ciscoLines[i];
    const label = SOURCE_LABELS[row.source] ?? row.source;
    const tr = document.createElement('tr');
    tr.dataset.source = row.source;
    tr.innerHTML =
      `<td>${esc(meta.vlan)}</td>` +
      `<td class="mono">${esc(row.display)}</td>` +
      `<td>${esc(meta.type)}</td>` +
      `<td>${esc(meta.port)}</td>` +
      `<td>${esc(row.vendor)}</td>` +
      `<td><span class="badge badge-${esc(row.source)}">${esc(label)}</span></td>`;
    resultsBody.appendChild(tr);
  });
  const n = resolvedRows.length;
  resultsCount.textContent = `${n} adresse${n > 1 ? 's' : ''}`;
}

btnResolve.addEventListener('click', async () => {
  const text = macInput.value;
  const format = detectFormat(text);

  if (format === 'cisco') {
    const ciscoLines = parseCiscoTable(text);
    if (ciscoLines.length === 0) {
      macInput.classList.add('error');
      setTimeout(() => macInput.classList.remove('error'), 1500);
      return;
    }
    setHeaders('cisco');
    rateLimitWarn.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    btnResolve.disabled = true;
    const entries = ciscoLines.map(l => ({ raw: l.rawMac, mac: normalizeMAC(l.rawMac) }));
    const { hasRateLimit } = await resolveAll(entries, (resolvedRows) => {
      renderCiscoRows(ciscoLines, resolvedRows);
    });
    if (hasRateLimit) rateLimitWarn.classList.remove('hidden');
    btnResolve.disabled = false;

  } else {
    const tokens = splitInput(text);
    if (tokens.length === 0) {
      macInput.classList.add('error');
      setTimeout(() => macInput.classList.remove('error'), 1500);
      return;
    }
    setHeaders('simple');
    rateLimitWarn.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    btnResolve.disabled = true;
    const entries = tokens.map(t => ({ raw: t, mac: normalizeMAC(t) }));
    const { hasRateLimit } = await resolveAll(entries, renderRows);
    if (hasRateLimit) rateLimitWarn.classList.remove('hidden');
    btnResolve.disabled = false;
  }
});

btnClear.addEventListener('click', () => {
  macInput.value = '';
  resultsSection.classList.add('hidden');
  rateLimitWarn.classList.add('hidden');
  setHeaders('simple');
});

btnCopy.addEventListener('click', () => {
  const header = [...document.querySelectorAll('#results-table thead th')]
    .map(th => th.textContent.trim()).join('\t');
  const rows = [...resultsBody.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('td')].map(td => td.textContent.trim()).join('\t')
  );
  navigator.clipboard.writeText([header, ...rows].join('\n'));
});

btnCsv.addEventListener('click', () => {
  const q = s => `"${s.replace(/"/g, '""')}"`;
  const header = [...document.querySelectorAll('#results-table thead th')]
    .map(th => q(th.textContent.trim())).join(',');
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
git commit -m "feat: add Cisco MAC table mode with auto-detection in app.js"
```

---

## Task 3: index.html — placeholder + push

**Files:**
- Modify: `index.html`

- [ ] **Step 1 : Mettre à jour le subtitle et le placeholder**

Dans `index.html`, remplacer le bloc `<p class="subtitle">` et l'attribut `placeholder` du textarea :

```html
    <p class="subtitle">
      Collez une liste d'adresses MAC ou la sortie d'un <code>show mac address-table</code> Cisco.<br>
      Formats MAC acceptés : <code>AA:BB:CC:DD:EE:FF</code>, <code>AA-BB-CC-DD-EE-FF</code>,
      <code>AABB.CCDD.EEFF</code>, <code>AABBCCDDEEFF</code>
    </p>
```

Remplacer le `placeholder` du textarea :

```html
      <textarea id="mac-input"
        placeholder="Mode liste :&#10;AA:BB:CC:DD:EE:FF&#10;AA-BB-CC-DD-EE-FF&#10;&#10;Mode tableau Cisco :&#10;Vlan  Mac Address        Type     Ports&#10;  93  0009.0f09.0003  DYNAMIC  Gi2/0/45"
        rows="8" spellcheck="false" autocomplete="off"></textarea>
```

- [ ] **Step 2 : Committer et pousser**

```bash
git add index.html
git commit -m "feat: update placeholder and subtitle for Cisco table mode"
git push
```

Attendu :
```
To https://github.com/frameip/MacVendorsList.git
   ...  main -> main
```

- [ ] **Step 3 : Vérifier le déploiement**

Attendre ~1 min puis ouvrir https://frameip.github.io/MacVendorsList/ et coller un bloc `show mac address-table` Cisco. Vérifier que le tableau affiche 6 colonnes (VLAN, Adresse MAC, Type, Port, Constructeur, Source).
