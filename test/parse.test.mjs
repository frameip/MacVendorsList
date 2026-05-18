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
