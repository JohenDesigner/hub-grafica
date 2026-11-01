// Supabase de mentira para os testes no navegador (substitui vendor/supabase.js só durante o teste).
// Imita as regras do supabase/schema.sql: número do pedido, datas, limite de pagamento, cliente com pedidos, lixeira.
(() => {
  const CHAVE = '__mockdb';
  const USUARIO = { id: '11111111-1111-4111-8111-111111111111', email: 'teste@johen.com' };
  const SENHA = 'senha123';
  const carregar = () => { try { return JSON.parse(localStorage.getItem(CHAVE)); } catch { return null; } };
  let banco = carregar() || { seq: 0, relogio: 0, sessao: null, t: { clientes: [], produtos: [], fichas: [], pagamentos: [], configuracoes: [] } };
  const gravar = () => localStorage.setItem(CHAVE, JSON.stringify(banco));
  const agora = () => new Date(Date.now() + (++banco.relogio)).toISOString();
  window.__mock = { banco: () => banco, gravar, recarregar: () => { banco = carregar() || banco; } };

  const rede = () => navigator.onLine ? null : { message: 'TypeError: Failed to fetch' };
  const PADRAO = {
    clientes: () => ({ whatsapp: '', documento: '', endereco: '', observacoes: '', arquivado: false }),
    produtos: () => ({ opcoes: [], preco: 0, m2_livre: 0, minimo: 0, minimo_por: 'total', acabamentos: [], prazo_dias: 3, ativo: true }),
    fichas: () => ({ itens: [], desconto: { tipo: 'reais', valor: 0 }, total_centavos: 0, etapa: 'orcamento', prazo: null, os_fpq: '', link_arte: '', observacoes: '', excluido_em: null }),
    pagamentos: () => ({ tipo: 'pagamento', pago_em: new Date().toISOString().slice(0, 10) }),
    configuracoes: () => ({ dados: {} })
  };

  function checarPagamento(p) {
    const f = banco.t.fichas.find(x => x.id === p.ficha_id);
    const outros = banco.t.pagamentos.filter(x => x.ficha_id === p.ficha_id && x.id !== p.id).reduce((s, x) => s + x.valor_centavos, 0);
    if (!f || outros + p.valor_centavos > f.total_centavos) return { message: 'Pagamento maior que o valor em aberto' };
    return null;
  }

  class Consulta {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.ord = null; this.um = false; this.talvez = false; }
    select() { return this; }
    eq(c, v) { this.f.push(r => r[c] === v); return this; }
    ilike(c, p) { const s = p.replace(/%/g, '').toLowerCase(); this.f.push(r => String(r[c] || '').toLowerCase().includes(s)); return this; }
    is(c, v) { this.f.push(r => (r[c] ?? null) === v); return this; }
    not(c) { this.f.push(r => (r[c] ?? null) !== null); return this; }
    order(c, o = {}) { this.ord = [c, o.ascending !== false]; return this; }
    upsert(o, opts) { this.op = 'upsert'; this.dado = o; this.chave = opts?.onConflict || 'id'; return this; }
    update(o) { this.op = 'update'; this.dado = o; return this; }
    delete() { this.op = 'delete'; return this; }
    single() { this.um = true; return this; }
    maybeSingle() { this.talvez = true; return this; }
    then(ok, falha) { return new Promise(r => setTimeout(r, 5)).then(() => this.executar()).then(ok, falha); }

    executar() {
      const erro = rede(); if (erro) return { data: null, error: erro };
      if (!banco.sessao) return { data: this.op === 'select' ? [] : null, error: this.op === 'select' ? null : { message: 'new row violates row-level security policy' } };
      banco = carregar() || banco;
      const tab = banco.t[this.t];
      const meus = tab.filter(r => r.user_id === USUARIO.id);
      let linhas;
      if (this.op === 'select') {
        linhas = meus.filter(r => this.f.every(fn => fn(r)));
        if (this.ord) { const [c, asc] = this.ord; linhas.sort((a, b) => ((a[c] ?? '') > (b[c] ?? '') ? 1 : (a[c] ?? '') < (b[c] ?? '') ? -1 : 0) * (asc ? 1 : -1)); }
        linhas = JSON.parse(JSON.stringify(linhas));
      } else if (this.op === 'upsert') {
        const o = { ...this.dado };
        const atual = tab.find(r => r[this.chave] === (this.chave === 'user_id' ? USUARIO.id : o[this.chave]));
        if (atual) {
          if (this.t === 'pagamentos') { const e = checarPagamento({ ...atual, ...o }); if (e) return { data: null, error: e }; }
          if (this.t === 'fichas' && o.etapa && o.etapa !== atual.etapa) atual.etapa_em = agora();
          Object.assign(atual, o, { atualizado_em: agora() });
          linhas = [atual];
        } else {
          const n = { ...PADRAO[this.t](), ...o, user_id: USUARIO.id, criado_em: agora(), atualizado_em: agora() };
          if (this.t === 'fichas') { n.numero = ++banco.seq; n.etapa_em = n.criado_em; }
          if (this.t === 'clientes' && !String(n.nome || '').trim()) return { data: null, error: { message: 'violates check constraint' } };
          if (this.t === 'pagamentos') { const e = checarPagamento(n); if (e) return { data: null, error: e }; }
          tab.push(n); linhas = [n];
        }
        gravar();
      } else if (this.op === 'update') {
        linhas = meus.filter(r => this.f.every(fn => fn(r)));
        for (const r of linhas) {
          if (this.t === 'fichas' && this.dado.etapa && this.dado.etapa !== r.etapa) r.etapa_em = agora();
          Object.assign(r, this.dado, { atualizado_em: agora() });
        }
        gravar();
      } else if (this.op === 'delete') {
        const alvo = meus.filter(r => this.f.every(fn => fn(r)));
        if (this.t === 'clientes' && alvo.some(c => banco.t.fichas.some(f => f.cliente_id === c.id)))
          return { data: null, error: { message: 'update or delete on table "clientes" violates foreign key constraint' } };
        banco.t[this.t] = tab.filter(r => !alvo.includes(r));
        if (this.t === 'fichas') banco.t.pagamentos = banco.t.pagamentos.filter(p => !alvo.some(f => f.id === p.ficha_id));
        gravar(); linhas = [];
      }
      if (this.um) return linhas.length === 1 ? { data: JSON.parse(JSON.stringify(linhas[0])), error: null } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } };
      if (this.talvez) return { data: linhas[0] ? JSON.parse(JSON.stringify(linhas[0])) : null, error: null };
      return { data: linhas, error: null };
    }
  }

  window.supabase = {
    createClient() {
      return {
        from: t => new Consulta(t),
        rpc: async nome => {
          const erro = rede(); if (erro) return { data: null, error: erro };
          if (nome === 'limpa_lixeira') {
            const limite = Date.now() - 30 * 864e5;
            banco.t.fichas = banco.t.fichas.filter(f => !f.excluido_em || Date.parse(f.excluido_em) >= limite); gravar();
          }
          return { data: null, error: null };
        },
        auth: {
          async signInWithPassword({ email, password }) {
            const erro = rede(); if (erro) return { data: null, error: erro };
            if (email !== USUARIO.email || password !== SENHA) return { data: null, error: { message: 'Invalid login credentials' } };
            banco.sessao = { user: USUARIO }; gravar(); return { data: { session: banco.sessao }, error: null };
          },
          async getSession() { banco = carregar() || banco; return { data: { session: banco.sessao }, error: null }; },
          async signOut() { banco.sessao = null; gravar(); return { error: null }; }
        }
      };
    }
  };
})();
