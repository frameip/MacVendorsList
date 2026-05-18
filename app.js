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
