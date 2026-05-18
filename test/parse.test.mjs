import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMAC, extractOUI, splitInput, detectFormat, parseCiscoTable } from '../lib/parse.js';

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
