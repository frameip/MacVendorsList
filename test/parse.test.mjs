import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMAC, extractOUI, splitInput, detectFormat, parseCiscoTable, parseHPTable, parseOSCXTable, parseHuaweiTable } from '../lib/parse.js';

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

// ── normalizeMAC HP ProCurve ──────────────────────────────────────────────────

test('normalizeMAC: format HP ProCurve (aabbcc-ddeeff)', () => {
  assert.equal(normalizeMAC('aabbcc-ddeeff'), 'AA:BB:CC:DD:EE:FF');
});

// ── detectFormat HP / OS-CX ──────────────────────────────────────────────────

const HP_SAMPLE = `Status and Counters - Port Address Table

  MAC Address          Located on Port
  ------------- ---------------
  aabbcc-ddeeff 1
  001122-334455 A2`;

const OSCX_SAMPLE = `MAC age-time : 300 seconds
Number of MAC addresses : 2

MAC Address         VLAN Type    Port
--------------------------------------------------
00:11:22:33:44:55   1    dynamic 1/1/1
aa:bb:cc:dd:ee:ff   10   static  1/1/2`;

test('detectFormat: retourne hp sur en-tête HP ProCurve', () => {
  assert.equal(detectFormat(HP_SAMPLE), 'hp');
});

test('detectFormat: retourne oscx sur en-tête OS-CX', () => {
  assert.equal(detectFormat(OSCX_SAMPLE), 'oscx');
});

test('detectFormat: retourne oscx sur en-tête Aruba sans MAC age-time', () => {
  const sample = `MAC Address          VLAN     Type                      Port
--------------------------------------------------------------
e4:de:40:d9:2e:c0    100      dynamic                   1/1/49`;
  assert.equal(detectFormat(sample), 'oscx');
});

// ── parseHPTable ──────────────────────────────────────────────────────────────

test('parseHPTable: parse une ligne correctement', () => {
  const result = parseHPTable(HP_SAMPLE);
  assert.deepEqual(result[0], { rawMac: 'aabbcc-ddeeff', port: '1' });
});

test('parseHPTable: parse le port alphanumérique', () => {
  const result = parseHPTable(HP_SAMPLE);
  assert.deepEqual(result[1], { rawMac: '001122-334455', port: 'A2' });
});

test('parseHPTable: ignore l\'en-tête et les séparateurs', () => {
  const result = parseHPTable(HP_SAMPLE);
  assert.equal(result.length, 2);
});

test('parseHPTable: retourne tableau vide sur entrée vide', () => {
  assert.deepEqual(parseHPTable(''), []);
});

// ── parseOSCXTable ───────────────────────────────────────────────────────────

test('parseOSCXTable: parse une ligne dynamic', () => {
  const result = parseOSCXTable(OSCX_SAMPLE);
  assert.deepEqual(result[0], { vlan: '1', rawMac: '00:11:22:33:44:55', type: 'dynamic', port: '1/1/1' });
});

test('parseOSCXTable: parse une ligne static', () => {
  const result = parseOSCXTable(OSCX_SAMPLE);
  assert.deepEqual(result[1], { vlan: '10', rawMac: 'aa:bb:cc:dd:ee:ff', type: 'static', port: '1/1/2' });
});

test('parseOSCXTable: ignore les lignes d\'en-tête et séparateurs', () => {
  const result = parseOSCXTable(OSCX_SAMPLE);
  assert.equal(result.length, 2);
});

test('parseOSCXTable: retourne tableau vide sur entrée vide', () => {
  assert.deepEqual(parseOSCXTable(''), []);
});

// ── normalizeMAC Huawei ───────────────────────────────────────────────────────

test('normalizeMAC: format Huawei (xxxx-xxxx-xxxx)', () => {
  assert.equal(normalizeMAC('0009-0f09-0002'), '00:09:0F:09:00:02');
});

// ── detectFormat Huawei ──────────────────────────────────────────────────────

const HUAWEI_SAMPLE = `-------------------------------------------------------------------------------
MAC Address    VLAN/VSI/BD                       Learned-From        Type
-------------------------------------------------------------------------------
0009-0f09-0002 1/-/-                             Eth-Trunk3          dynamic
000a-5902-2dfd 1/-/-                             GE1/0/35            dynamic`;

test('detectFormat: retourne huawei sur en-tête Huawei', () => {
  assert.equal(detectFormat(HUAWEI_SAMPLE), 'huawei');
});

// ── parseHuaweiTable ─────────────────────────────────────────────────────────

test('parseHuaweiTable: parse une ligne correctement', () => {
  const result = parseHuaweiTable(HUAWEI_SAMPLE);
  assert.deepEqual(result[0], { vlan: '1', rawMac: '0009-0f09-0002', port: 'Eth-Trunk3', type: 'dynamic' });
});

test('parseHuaweiTable: extrait le VLAN depuis VLAN/VSI/BD', () => {
  const result = parseHuaweiTable(HUAWEI_SAMPLE);
  assert.equal(result[1].vlan, '1');
  assert.equal(result[1].port, 'GE1/0/35');
});

test('parseHuaweiTable: ignore les séparateurs et l\'en-tête', () => {
  const result = parseHuaweiTable(HUAWEI_SAMPLE);
  assert.equal(result.length, 2);
});

test('parseHuaweiTable: retourne tableau vide sur entrée vide', () => {
  assert.deepEqual(parseHuaweiTable(''), []);
});
