import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensagem, linkWa } from '../js/whatsapp.js';
test('mensagem de orçamento', () => {
  const t = mensagem('orcamento', { ficha: { numero: 12, criado_em: '2026-11-01T12:00:00Z', prazo: '2026-11-05',
    total_centavos: 5400, itens: [{ tipo: 'm2', quantidade: 2, largura_cm: 100, altura_cm: 60, preco: 45, nome: 'Banner', acabamentos: [] }] },
    cliente: { nome: 'Ana Souza' }, cfg: { pix: '65.480.613/0001-19', validade_dias: 7 } });
  assert.match(t, /Olá, Ana!/);
  assert.match(t, /2× Banner 100×60 cm: R\$\s54,00/);
  assert.match(t, /Válido até: 08\/11\/2026/);
});
test('link', () => assert.equal(linkWa('(11) 98287-7142', 'oi'), 'https://wa.me/5511982877142?text=oi'));
