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
