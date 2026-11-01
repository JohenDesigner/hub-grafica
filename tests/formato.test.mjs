import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moeda, lerNumero, data, soDigitos, telefoneWa } from '../js/formato.js';

test('moeda', () => {
  assert.equal(moeda(123456), 'R$ 1.234,56');
  assert.equal(moeda(0), 'R$ 0,00');
});
test('lerNumero', () => {
  assert.equal(lerNumero('1.234,5'), 1234.5);
  assert.equal(lerNumero('45'), 45);
  assert.equal(lerNumero('0,6'), 0.6);
  assert.ok(Number.isNaN(lerNumero('')));
});
test('data', () => assert.equal(data('2026-11-01'), '01/11/2026'));
test('telefone', () => {
  assert.equal(soDigitos('(11) 98287-7142'), '11982877142');
  assert.equal(telefoneWa('(11) 98287-7142'), '5511982877142');
  assert.equal(telefoneWa('+55 11 98287-7142'), '5511982877142');
});
