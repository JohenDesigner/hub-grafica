import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensagem, linkWa } from '../js/whatsapp.js';
test('mensagem de orçamento', () => {
  const t = mensagem('orcamento', { ficha: { numero: 12, criado_em: '2026-11-01T12:00:00Z', prazo: '2026-11-05',
    total_centavos: 5400, itens: [{ tipo: 'm2', quantidade: 2, largura_cm: 100, altura_cm: 60, preco: 45, nome: 'Banner', acabamentos: [] }] },
    cliente: { nome: 'Ana Souza' }, cfg: { pix: '65.480.613/0001-19', validade_dias: 7 } });
  assert.match(t, /Olá, Ana!/);
  assert.match(t, /2× Banner — 100×60 cm: R\$\s54,00/);
  assert.match(t, /Válido até: 08\/11\/2026/);
});
test('link', () => assert.equal(linkWa('(11) 98287-7142', 'oi'), 'https://api.whatsapp.com/send?phone=5511982877142&text=oi'));
import { detalheItem } from '../js/whatsapp.js';
test('detalhe do item', () => {
  assert.equal(detalheItem({ tipo: 'opcoes', opcao: { label: '100 un.', preco: 76.5 }, acabamentos: [] }), '100 un.');
  assert.equal(detalheItem({ tipo: 'opcoes', opcao: { label: 'cada', preco: 35 }, acabamentos: [{ nome: 'Caixinha personalizada' }] }), 'Caixinha personalizada');
  assert.equal(detalheItem({ tipo: 'opcoes', livre: true, largura_cm: 150, altura_cm: 100, acabamentos: [] }), '150×100 cm');
  assert.equal(detalheItem({ tipo: 'opcoes', opcao: { label: 'Frente e Verso (+R$15)', preco: 60 }, acabamentos: [] }), 'Frente e Verso');
});
import { citar } from '../js/whatsapp.js';
test('mensagens saem como citação', () => {
  assert.equal(citar('a\n\nb\n> c'), '> a\n\n> b\n> c');
  const t = mensagem('pronto', { ficha: { numero: 28 }, cliente: { nome: 'Marcia Lima' }, saldo: 8400,
    cfg: { endereco: 'R. Pedro Fernandes Aragão, 269', horario: 'seg a sáb, 11h às 20h' } });
  for (const l of t.split('\n')) assert.ok(l === '' || l.startsWith('> '), l);
  assert.match(t, /PEDIDO Nº 28 — PRONTO PARA RETIRADA/);
  assert.match(t, /Falta pagar: \*R\$\s84,00\*/);
});
test('link no computador abre o aplicativo do WhatsApp e mantém emoji', () => {
  const l = linkWa('(11) 98287-7142', '✅ oi', true);
  assert.ok(l.startsWith('whatsapp://send?phone=5511982877142&text='));
  assert.equal(new URL(l).searchParams.get('text'), '✅ oi');
});
test('orçamento pede o de acordo do cliente, também com texto personalizado', () => {
  const ficha = { numero: 31, total_centavos: 1000, itens: [] };
  for (const cfg of [{}, { textos: { orcamento: 'Oi {cliente}, total {total}' } }]) {
    const t = mensagem('orcamento', { ficha, cliente: { nome: 'Ana' }, cfg });
    assert.match(t, /> ✍️ Pra confirmar, me responde aqui: \*Li e concordo com o orçamento nº 31 e as condições\.\*/);
  }
  const ja = mensagem('orcamento', { ficha, cliente: { nome: 'Ana' }, cfg: { textos: { orcamento: 'Responda: Li e concordo' } } });
  assert.doesNotMatch(ja, /Pra confirmar/);
  assert.doesNotMatch(mensagem('arte', { ficha, cliente: { nome: 'Ana' } }), /Li e concordo/);
});
test('pedido de avaliação: nome, número e link sozinho na última linha, fora da citação', () => {
  const base = { ficha: { numero: 40 }, cliente: { nome: 'Ana Souza' } };
  const t = mensagem('avaliacao', base);
  assert.match(t, /PREFERÊNCIA, Ana!/);
  assert.match(t, /pedido nº 40/);
  assert.equal(t.split('\n').at(-1), 'https://g.page/r/CWKTHinBP02gEAE/review');
  assert.doesNotMatch(t, /[{}]/);
  assert.match(mensagem('avaliacao', { ...base, cfg: { textos: { avaliacao: 'Oi {cliente}\n{avaliacao}' } } }), /^> Oi Ana\nhttps:\/\/g\.page/);
});
