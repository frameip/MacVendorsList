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
