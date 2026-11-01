import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prazoDias, siteParaProduto, catalogoDoSite } from '../js/catalogo.js';

test('prazo do texto do site', () => {
  assert.equal(prazoDias('3 a 5 dias úteis'), 5);
  assert.equal(prazoDias('7 dias úteis'), 7);
  assert.equal(prazoDias(''), 3);
});
test('cartão vira produto por opção', () => {
  const p = siteParaProduto({ id: 'p1', nome: 'Couché 250g — Couché Brilho (Frente)', prazo: '3 a 5 dias úteis',
    unidade: '', opcoes: [{ label: '100 un.', preco: 76.5 }, { label: '500 un.', preco: 85 }] }, 'cartoes');
  assert.equal(p.id, 'site:cartoes:p1');
  assert.equal(p.origem, 'site');
  assert.equal(p.tipo, 'opcoes');
  assert.equal(p.opcoes.length, 2);
  assert.equal(p.prazo_dias, 5);
});
test('adesivo vira m² com mínimo no total', () => {
  const p = siteParaProduto({ id: 'p11', nome: 'Adesivo com Recorte', prazo: '', unidade: 'por m²', opcoes: [], m2: 100, minimo: 85 }, 'adesivos');
  assert.deepEqual([p.tipo, p.preco, p.minimo, p.minimo_por], ['m2', 100, 85, 'total']);
});
test('banner tem tamanhos prontos e outro tamanho com mínimo por peça', () => {
  const p = siteParaProduto({ id: 'p1', nome: 'Banner', prazo: '', unidade: '',
    opcoes: [{ label: '60×40cm', preco: 55 }], m2livre: 120, minimo: 55 }, 'banners');
  assert.deepEqual([p.tipo, p.m2_livre, p.minimo, p.minimo_por], ['opcoes', 120, 55, 'peca']);
});
test('caneca ganha caixinha como acabamento', () => {
  const p = siteParaProduto({ id: 'p1', nome: 'Caneca', prazo: '', unidade: 'cada', opcoes: [{ label: 'cada', preco: 35 }], caixinha: 5 }, 'canecas');
  assert.deepEqual(p.acabamentos, [{ nome: 'Caixinha personalizada', valor: 5, cobranca: 'unidade' }]);
});
test('catálogo inteiro', () => {
  const lista = catalogoDoSite({ cartoes: [{ id: 'p1', nome: 'A', prazo: '', unidade: '', opcoes: [{ label: 'cada', preco: 1 }] }],
    adesivos: [{ id: 'p2', nome: 'B', prazo: '', unidade: 'por m²', opcoes: [], m2: 10, minimo: 5 }] });
  assert.deepEqual(lista.map(p => [p.categoria, p.nome]), [['cartoes', 'A'], ['adesivos', 'B']]);
});
