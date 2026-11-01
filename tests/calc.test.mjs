import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emCentavos, areaPeca, calcularItem, calcularFicha, saldoAberto, validarItem,
  validarPagamento, orcamentoVencido, somarDiasUteis } from '../js/calc.js';

test('emCentavos arredonda', () => {
  assert.equal(emCentavos(1.005), 101);
  assert.equal(emCentavos(45), 4500);
});
test('area de banner 100x60', () => assert.equal(areaPeca(100, 60), 0.6));
test('opção: 2 pacotes de 100 cartões couché 250g', () => {
  assert.equal(calcularItem({ tipo: 'opcoes', quantidade: 2, opcao: { label: '100 un.', preco: 76.5 }, acabamentos: [] }).centavos, 15300);
});
test('opção com caixinha: 2 canecas brancas', () => {
  assert.equal(calcularItem({ tipo: 'opcoes', quantidade: 2, opcao: { label: 'cada', preco: 35 },
    acabamentos: [{ nome: 'Caixinha personalizada', valor: 5, cobranca: 'unidade' }] }).centavos, 8000);
});
test('m²: adesivo pequeno cai no mínimo do total', () => {
  const it = { tipo: 'm2', quantidade: 3, largura_cm: 20, altura_cm: 10, preco: 100, minimo: 85, minimo_por: 'total', acabamentos: [] };
  assert.equal(calcularItem(it).centavos, 8500);
  assert.equal(calcularItem({ ...it, quantidade: 1, largura_cm: 100, altura_cm: 100 }).centavos, 10000);
});
test('m² com acabamentos', () => {
  const r = calcularItem({ tipo: 'm2', quantidade: 2, largura_cm: 100, altura_cm: 60, preco: 45, minimo: 0,
    acabamentos: [{ nome: 'Ilhós', valor: 2, cobranca: 'unidade' },
                  { nome: 'Laminação', valor: 10, cobranca: 'm2' },
                  { nome: 'Arte', valor: 30, cobranca: 'fixo' }] });
  // 0,6 × 2 × 45 = 54 ; ilhós 2×2 = 4 ; laminação 0,6×2×10 = 12 ; arte 30 → 100
  assert.equal(r.area, 0.6);
  assert.equal(r.centavos, 10000);
});
test('banner em outro tamanho: mínimo por peça', () => {
  const it = { tipo: 'opcoes', livre: true, quantidade: 2, largura_cm: 50, altura_cm: 50, m2_livre: 120, minimo: 55, acabamentos: [] };
  assert.equal(calcularItem(it).centavos, 11000);              // 0,25 m² × 120 = 30 → 55 por peça × 2
  assert.equal(calcularItem({ ...it, quantidade: 1, largura_cm: 150, altura_cm: 100 }).centavos, 18000);
});
test('unidade', () => {
  assert.equal(calcularItem({ tipo: 'unidade', quantidade: 3, preco: 12.5, acabamentos: [] }).centavos, 3750);
});
test('ficha com desconto em reais e em %', () => {
  const itens = [{ tipo: 'unidade', quantidade: 1, preco: 100, acabamentos: [] }];
  assert.deepEqual(calcularFicha(itens, { tipo: 'reais', valor: 10 }), { subtotal: 10000, desconto: 1000, total: 9000 });
  assert.deepEqual(calcularFicha(itens, { tipo: 'pct', valor: 15 }), { subtotal: 10000, desconto: 1500, total: 8500 });
  assert.equal(calcularFicha(itens, { tipo: 'reais', valor: 500 }).total, 0);
});
test('saldo', () => {
  assert.equal(saldoAberto(10000, [{ valor_centavos: 3000 }, { valor_centavos: 2000 }]), 5000);
  assert.equal(saldoAberto(10000, []), 10000);
});
test('validações', () => {
  assert.equal(validarItem({ tipo: 'unidade', quantidade: 0, preco: 5, acabamentos: [] }), 'Quantidade precisa ser maior que zero');
  assert.equal(validarItem({ tipo: 'm2', quantidade: 1, largura_cm: 0, altura_cm: 50, preco: 5, acabamentos: [] }), 'Informe largura e altura');
  assert.equal(validarItem({ tipo: 'opcoes', quantidade: 1, acabamentos: [] }), 'Escolha uma opção');
  assert.equal(validarItem({ tipo: 'opcoes', livre: true, quantidade: 1, largura_cm: 50, altura_cm: 0, m2_livre: 120, acabamentos: [] }), 'Informe largura e altura');
  assert.equal(validarItem({ tipo: 'unidade', quantidade: 1, preco: 0, acabamentos: [] }), 'Preço precisa ser maior que zero');
  assert.equal(validarItem({ tipo: 'unidade', quantidade: 1, preco: 5, acabamentos: [{ nome: 'Lam', valor: 1, cobranca: 'm2' }] }), 'O acabamento Lam é por m² e precisa de medida');
  assert.equal(validarItem({ tipo: 'unidade', quantidade: 1, preco: 5, acabamentos: [] }), null);
  assert.equal(validarPagamento(6000, 5000), 'Valor maior que o que falta receber (R$ 50,00)');
  assert.equal(validarPagamento(0, 5000), 'Valor precisa ser maior que zero');
  assert.equal(validarPagamento(5000, 5000), null);
});
test('orçamento vencido', () => {
  const f = { etapa: 'orcamento', criado_em: '2026-11-01T12:00:00Z' };
  assert.equal(orcamentoVencido(f, 7, new Date('2026-11-08T11:00:00Z')), false);
  assert.equal(orcamentoVencido(f, 7, new Date('2026-11-09T13:00:00Z')), true);
  assert.equal(orcamentoVencido({ ...f, etapa: 'arte' }, 7, new Date('2026-12-01')), false);
});
test('dias úteis pulam sábado e domingo', () => {
  assert.equal(somarDiasUteis('2026-11-06', 1), '2026-11-09');   // sexta + 1 = segunda
  assert.equal(somarDiasUteis('2026-11-02', 5), '2026-11-09');   // segunda + 5 = segunda seguinte
});
