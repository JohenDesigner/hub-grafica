export const URL_CATALOGO = 'https://johendesigner.github.io/Johen-site/novo/dados/produtos.json';
export const NOMES_CATEGORIA = { cartoes: 'Cartões de Visita', panfletos: 'Panfletos', banners: 'Banners e Placas',
  adesivos: 'Adesivos e Etiquetas', camisetas: 'Camisetas', canecas: 'Canecas e Térmicos', extras: 'Meus produtos' };
const CACHE = 'hub_catalogo';

export function prazoDias(texto) {
  const nums = String(texto || '').match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : 3;
}

export function siteParaProduto(p, categoria) {
  const base = { id: `site:${categoria}:${p.id}`, origem: 'site', categoria, nome: p.nome,
    prazo_dias: prazoDias(p.prazo), acabamentos: [], opcoes: [], preco: 0, minimo: 0, minimo_por: 'total', m2_livre: 0, ativo: true };
  if (p.caixinha) base.acabamentos.push({ nome: 'Caixinha personalizada', valor: p.caixinha, cobranca: 'unidade' });
  if (p.m2) return { ...base, tipo: 'm2', preco: p.m2, minimo: p.minimo || 0, minimo_por: 'total' };
  const opcoes = (p.opcoes || []).map(o => ({ label: o.label, preco: o.preco }));
  if (p.m2livre) return { ...base, tipo: 'opcoes', opcoes, m2_livre: p.m2livre, minimo: p.minimo || 0, minimo_por: 'peca' };
  return { ...base, tipo: 'opcoes', opcoes };
}

export function catalogoDoSite(json) {
  return Object.entries(json || {}).flatMap(([cat, lista]) => (lista || []).map(p => siteParaProduto(p, cat)));
}

// Lê o catálogo do site; sem internet usa a última cópia guardada.
export async function carregarCatalogo({ forcar = false } = {}) {
  try {
    const r = await fetch(URL_CATALOGO + (forcar ? `?t=${Date.now()}` : ''), { cache: forcar ? 'no-store' : 'default' });
    if (!r.ok) throw new Error(r.status);
    const lista = catalogoDoSite(await r.json());
    try { localStorage.setItem(CACHE, JSON.stringify({ quando: new Date().toISOString(), lista })); } catch {}
    return { lista, quando: new Date().toISOString(), offline: false };
  } catch {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE));
      if (c) return { ...c, offline: true };
    } catch {}
    return { lista: [], quando: null, offline: true };
  }
}
