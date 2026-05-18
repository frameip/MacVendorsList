import { normalizeMAC, splitInput, detectFormat, parseCiscoTable, parseHPTable, parseOSCXTable } from './lib/parse.js';
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
  if (mode === 'cisco' || mode === 'oscx') {
    theadRow.innerHTML = '<th>VLAN</th><th>Adresse MAC</th><th>Port</th><th>Constructeur</th>';
  } else if (mode === 'hp') {
    theadRow.innerHTML = '<th>Adresse MAC</th><th>Port</th><th>Constructeur</th>';
  } else {
    theadRow.innerHTML = '<th>Adresse MAC</th><th>Constructeur</th>';
  }
}

function renderRows(rows) {
  resultsBody.innerHTML = '';
  for (const row of rows) {
    const label = SOURCE_LABELS[row.source] ?? row.source;
    const tr = document.createElement('tr');
    tr.dataset.source = row.source;
    tr.innerHTML =
      `<td class="mono">${esc(row.display)}</td>` +
      `<td>${esc(row.vendor)}</td>`;
    resultsBody.appendChild(tr);
  }
  const n = rows.length;
  resultsCount.textContent = `${n} adresse${n > 1 ? 's' : ''}`;
}

function renderCiscoRows(ciscoLines, resolvedRows) {
  resultsBody.innerHTML = '';
  resolvedRows.forEach((row, i) => {
    const meta = ciscoLines[i];
    const tr = document.createElement('tr');
    tr.dataset.source = row.source;
    tr.innerHTML =
      `<td>${esc(meta.vlan)}</td>` +
      `<td class="mono">${esc(row.display)}</td>` +
      `<td>${esc(meta.port)}</td>` +
      `<td>${esc(row.vendor)}</td>`;
    resultsBody.appendChild(tr);
  });
  const n = resolvedRows.length;
  resultsCount.textContent = `${n} adresse${n > 1 ? 's' : ''}`;
}

function renderHPRows(hpLines, resolvedRows) {
  resultsBody.innerHTML = '';
  resolvedRows.forEach((row, i) => {
    const meta = hpLines[i];
    const tr = document.createElement('tr');
    tr.dataset.source = row.source;
    tr.innerHTML =
      `<td class="mono">${esc(row.display)}</td>` +
      `<td>${esc(meta.port)}</td>` +
      `<td>${esc(row.vendor)}</td>`;
    resultsBody.appendChild(tr);
  });
  const n = resolvedRows.length;
  resultsCount.textContent = `${n} adresse${n > 1 ? 's' : ''}`;
}

function renderOSCXRows(oscxLines, resolvedRows) {
  resultsBody.innerHTML = '';
  resolvedRows.forEach((row, i) => {
    const meta = oscxLines[i];
    const tr = document.createElement('tr');
    tr.dataset.source = row.source;
    tr.innerHTML =
      `<td>${esc(meta.vlan)}</td>` +
      `<td class="mono">${esc(row.display)}</td>` +
      `<td>${esc(meta.port)}</td>` +
      `<td>${esc(row.vendor)}</td>`;
    resultsBody.appendChild(tr);
  });
  const n = resolvedRows.length;
  resultsCount.textContent = `${n} adresse${n > 1 ? 's' : ''}`;
}

btnResolve.addEventListener('click', async () => {
  const text = macInput.value;
  const format = detectFormat(text);

  if (format === 'cisco') {
    const ciscoLines = parseCiscoTable(text)
      .filter(l => l.port !== 'CPU')
      .sort((a, b) => a.port.localeCompare(b.port, undefined, { numeric: true, sensitivity: 'base' }));
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

  } else if (format === 'hp') {
    const hpLines = parseHPTable(text)
      .sort((a, b) => a.port.localeCompare(b.port, undefined, { numeric: true, sensitivity: 'base' }));
    if (hpLines.length === 0) {
      macInput.classList.add('error');
      setTimeout(() => macInput.classList.remove('error'), 1500);
      return;
    }
    setHeaders('hp');
    rateLimitWarn.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    btnResolve.disabled = true;
    const entries = hpLines.map(l => ({ raw: l.rawMac, mac: normalizeMAC(l.rawMac) }));
    const { hasRateLimit } = await resolveAll(entries, (resolvedRows) => {
      renderHPRows(hpLines, resolvedRows);
    });
    if (hasRateLimit) rateLimitWarn.classList.remove('hidden');
    btnResolve.disabled = false;

  } else if (format === 'oscx') {
    const oscxLines = parseOSCXTable(text)
      .sort((a, b) => a.port.localeCompare(b.port, undefined, { numeric: true, sensitivity: 'base' }));
    if (oscxLines.length === 0) {
      macInput.classList.add('error');
      setTimeout(() => macInput.classList.remove('error'), 1500);
      return;
    }
    setHeaders('oscx');
    rateLimitWarn.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    btnResolve.disabled = true;
    const entries = oscxLines.map(l => ({ raw: l.rawMac, mac: normalizeMAC(l.rawMac) }));
    const { hasRateLimit } = await resolveAll(entries, (resolvedRows) => {
      renderOSCXRows(oscxLines, resolvedRows);
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
