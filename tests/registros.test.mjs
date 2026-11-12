import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarRegistros, filtrarRegistros, somarRegistros } from '../js/registros.js';

const clientes = [{ id: 'c1', nome: 'Ana Souza' }];
const fichas = [
  { id: 'f1', numero: 1, cliente_id: 'c1', etapa: 'entregue', total_centavos: 10000, itens: [{ nome: 'Banner' }] },
  { id: 'f2', numero: 2, cliente_id: 'c1', etapa: 'arte', total_centavos: 8000, itens: [{ nome: 'Cartão' }] }
];
const pagamentos = [
  { id: 'p1', ficha_id: 'f1', valor_centavos: 4000, forma: 'pix', tipo: 'sinal', pago_em: '2026-11-01', criado_em: '2026-11-01T10:00:00Z' },
  { id: 'p2', ficha_id: 'f1', valor_centavos: 6000, forma: 'pix', tipo: 'pagamento', pago_em: '2026-11-05', criado_em: '2026-11-05T10:00:00Z' },
  { id: 'p3', ficha_id: 'f2', valor_centavos: 3000, forma: 'dinheiro', tipo: 'sinal', pago_em: '2026-11-05', criado_em: '2026-11-05T09:00:00Z' }
];
const vendas = [{ id: 'v1', itens: [{ qtd: 10, nome: 'Cópia A4' }], total_centavos: 500, forma: 'dinheiro', criado_em: '2026-11-07T15:00:00Z', vendido_em: '2026-11-07' }];

test('junta sinais, pagamentos e balcão, do mais novo pro mais velho', () => {
  const r = montarRegistros({ fichas, pagamentos, vendas, clientes });
  assert.deepEqual(r.map(x => x.id), ['v1', 'p2', 'p3', 'p1']);
  assert.deepEqual(r.map(x => x.tipo), ['balcao', 'pagamento', 'sinal', 'sinal']);
});
test('sinal entra no histórico como dinheiro recebido', () => {
  const r = montarRegistros({ fichas, pagamentos, vendas, clientes });
  const p1 = r.find(x => x.id === 'p1');
  assert.equal(p1.valor, 4000); assert.equal(p1.numero, 1); assert.equal(p1.cliente, 'Ana Souza');
});
test('balcão sempre entra', () => {
  const r = montarRegistros({ vendas: [{ id: 'x', itens: [], total_centavos: 1234, forma: 'pix', vendido_em: '2026-11-01' }] });
  assert.equal(r[0].tipo, 'balcao'); assert.equal(r[0].valor, 1234);
});
test('soma total e por forma', () => {
  const s = somarRegistros(montarRegistros({ fichas, pagamentos, vendas, clientes }));
  assert.equal(s.total, 13500); assert.equal(s.quantidade, 4);
  assert.deepEqual(s.porForma, { pix: 10000, dinheiro: 3500 });
});
test('filtros', () => {
  const r = montarRegistros({ fichas, pagamentos, vendas, clientes });
  assert.deepEqual(filtrarRegistros(r, { tipo: 'sinal' }).map(x => x.id), ['p3', 'p1']);
  assert.deepEqual(filtrarRegistros(r, { forma: 'dinheiro' }).map(x => x.id), ['v1', 'p3']);
  assert.deepEqual(filtrarRegistros(r, { busca: 'cópia' }).map(x => x.id), ['v1']);
  assert.deepEqual(filtrarRegistros(r, { busca: 'nº 2' }).map(x => x.id), ['p3']);
  assert.deepEqual(filtrarRegistros(r, { desde: '2026-11-05' }).map(x => x.id), ['v1', 'p2', 'p3']);
});
