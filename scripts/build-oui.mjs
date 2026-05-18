import { writeFile } from 'fs/promises';
import https from 'https';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const OUI_URL = 'https://standards-oui.ieee.org/oui/oui.csv';
const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'oui.json');

function get(url, redirects = 5) {
  return new Promise((res, rej) => {
    https.get(url, (r) => {
      if (r.statusCode === 301 || r.statusCode === 302) {
        if (redirects <= 0) return rej(new Error('Too many redirects'));
        r.resume(); // consume and discard body
        return get(r.headers.location, redirects - 1).then(res, rej);
      }
      if (r.statusCode !== 200) {
        r.resume();
        return rej(new Error(`HTTP ${r.statusCode} from ${url}`));
      }
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
    if (!line.trim()) continue;
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const oui = cols[1]?.trim();
    const vendor = cols[2]?.replace(/^"|"$/g, '').trim();
    if (!oui || !/^[0-9A-Fa-f]{6}$/.test(oui) || !vendor) continue;
    db[oui.toUpperCase()] = vendor;
  }
  return db;
}

const csv = await get(OUI_URL);
const db = parse(csv);
await writeFile(OUT, JSON.stringify(db));
console.log(`oui.json : ${Object.keys(db).length} entrées`);
