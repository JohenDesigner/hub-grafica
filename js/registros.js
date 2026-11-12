// Histórico de recebimentos: todo dinheiro que entrou (sinal, pagamento de pedido e venda do balcão) numa lista só.
// Sem acesso ao banco, para dar para testar.

// tipo: 'sinal' | 'pagamento' | 'balcao'
export function montarRegistros({ fichas = [], pagamentos = [], vendas = [], clientes = [] }) {
  const nomeCli = new Map(clientes.map(c => [c.id, c.nome]));
  const ficha = new Map(fichas.map(f => [f.id, f]));

  const dePags = pagamentos.map(p => {
    const f = ficha.get(p.ficha_id);
    return {
      tipo: p.tipo === 'sinal' ? 'sinal' : 'pagamento', id: p.id, tabela: 'pagamentos', original: p,
      dia: p.pago_em, criado: p.criado_em || '', valor: p.valor_centavos || 0, forma: p.forma,
      fichaId: p.ficha_id, numero: f?.numero ?? null, cliente: f ? nomeCli.get(f.cliente_id) || 'Cliente' : 'Pedido excluído',
      resumo: (f?.itens || []).map(i => i.nome).join(', '), excluida: !f || !!f.excluido_em,
      pendente: !!p._pendente
    };
  });

  // Balcão é pago na hora: sempre entra aqui.
  const deVendas = vendas.map(v => ({
    tipo: 'balcao', id: v.id, tabela: 'vendas_balcao', original: v,
    dia: v.vendido_em, criado: v.criado_em || '', valor: v.total_centavos || 0, forma: v.forma,
    fichaId: null, numero: null, cliente: 'Balcão', resumo: (v.itens || []).map(i => `${i.qtd}× ${i.nome}`).join(', '),
    excluida: false, pendente: !!v._pendente
  }));

  return [...dePags, ...deVendas].sort((a, b) => String(b.dia).localeCompare(String(a.dia)) || String(b.criado).localeCompare(String(a.criado)));
}

export function filtrarRegistros(lista, { tipo = 'todos', forma = 'todas', desde = null, busca = '' } = {}) {
  const t = busca.trim().toLowerCase(), num = t.replace(/^(n[ºo°]?\.?\s*)/, '');
  return lista.filter(r =>
    (tipo === 'todos' || r.tipo === tipo) &&
    (forma === 'todas' || r.forma === forma) &&
    (!desde || String(r.dia) >= desde) &&
    (!t || r.cliente.toLowerCase().includes(t) || r.resumo.toLowerCase().includes(t) || (r.numero != null && String(r.numero) === num)));
}

// Soma do que está na lista, e quanto foi em cada forma de pagamento.
export function somarRegistros(lista) {
  const porForma = {};
  for (const r of lista) porForma[r.forma] = (porForma[r.forma] || 0) + r.valor;
  return { total: lista.reduce((s, r) => s + r.valor, 0), quantidade: lista.length, porForma };
}
