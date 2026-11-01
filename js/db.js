// Único ponto de acesso ao Supabase: login, leitura, gravação, fila offline e checagem de conflito.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'hub-johen-auth' } });

const FILA = 'hub_fila', CACHE = 'hub_cache_';
const lerFila = () => { try { return JSON.parse(localStorage.getItem(FILA)) || []; } catch { return []; } };
const gravarFila = f => { try { localStorage.setItem(FILA, JSON.stringify(f)); } catch {} };
const guardar = (k, v) => { try { localStorage.setItem(CACHE + k, JSON.stringify(v)); } catch {} };
const ler = k => { try { return JSON.parse(localStorage.getItem(CACHE + k)); } catch { return null; } };

export class ConflitoError extends Error {
  constructor(local, remoto) { super('Este registro foi alterado em outro aparelho'); this.local = local; this.remoto = remoto; }
}

const ehErroDeRede = e => !navigator.onLine ||
  /fetch|network|load failed|timeout|ECONN|Failed to fetch/i.test(String(e?.message || e || ''));

function traduzir(msg = '') {
  if (msg.includes('Pagamento maior')) return 'Pagamento maior que o valor em aberto';
  if (msg.includes('foreign key') || msg.includes('violates foreign')) return 'Este cliente tem pedidos e não pode ser excluído. Arquive em vez disso.';
  if (/JWT|jwt|token/.test(msg)) return 'Sessão expirada. Entre de novo.';
  return 'Não salvou. Toque para tentar de novo.';
}

// ---------- login ----------
export async function entrar(email, senha) {
  const { error } = await db.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(ehErroDeRede(error) ? 'Sem internet para entrar' : 'E-mail ou senha incorretos');
}
export async function sair() {
  await db.auth.signOut();
  Object.keys(localStorage).filter(k => k.startsWith('hub_')).forEach(k => localStorage.removeItem(k));
}
export async function usuarioAtual() {
  const { data } = await db.auth.getSession();   // funciona sem internet (sessão guardada no aparelho)
  return data.session?.user || null;
}

// ---------- leitura ----------
export async function listar(tabela, f = {}) {
  const chave = tabela + JSON.stringify(f);
  try {
    let q = db.from(tabela).select('*');
    for (const [c, v] of Object.entries(f.eq || {})) q = q.eq(c, v);
    for (const [c, v] of Object.entries(f.ilike || {})) q = q.ilike(c, `%${v}%`);
    if (f.semExcluidos) q = q.is('excluido_em', null);
    if (f.soExcluidos) q = q.not('excluido_em', 'is', null);
    if (f.order) q = q.order(f.order, { ascending: !f.desc });
    const { data, error } = await q;
    if (error) throw error;
    guardar(chave, data);
    return aplicarFila(tabela, data);
  } catch (e) {
    const c = ler(chave) || filtrarLocal(tabela, f);
    if (c) return aplicarFila(tabela, c);
    if (ehErroDeRede(e)) throw new Error('Sem internet e sem dados guardados para esta tela. Se o banco ficou 7 dias parado, reative em supabase.com (Restore project).');
    throw new Error(traduzir(e.message));
  }
}

// Sem internet e sem cópia desta consulta: usa a maior cópia guardada da tabela e filtra aqui.
function filtrarLocal(tabela, f) {
  let maior = null;
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(CACHE + tabela + '{')) continue;
    const filtros = JSON.parse(k.slice((CACHE + tabela).length));
    if (filtros.eq || filtros.ilike || filtros.soExcluidos) continue;   // só cópias da tabela inteira (ou sem excluídos)
    if (filtros.semExcluidos && !f.semExcluidos) continue;
    const v = ler(k.slice(CACHE.length));
    if (v && (!maior || v.length > maior.length)) maior = v;
  }
  if (!maior) return null;
  let l = maior.filter(r => Object.entries(f.eq || {}).every(([c, v]) => r[c] === v) &&
    Object.entries(f.ilike || {}).every(([c, v]) => String(r[c] || '').toLowerCase().includes(String(v).toLowerCase())) &&
    (!f.semExcluidos || !r.excluido_em) && (!f.soExcluidos || r.excluido_em));
  if (f.order) l = [...l].sort((a, b) => ((a[f.order] ?? '') > (b[f.order] ?? '') ? 1 : (a[f.order] ?? '') < (b[f.order] ?? '') ? -1 : 0) * (f.desc ? -1 : 1));
  return l;
}

export async function obter(tabela, id) {
  const col = tabela === 'configuracoes' ? 'user_id' : 'id';
  try {
    const { data, error } = await db.from(tabela).select('*').eq(col, id).maybeSingle();
    if (error) throw error;
    guardar(tabela + ':' + id, data);
    return aplicarFila(tabela, data ? [data] : [], id)[0] || null;
  } catch (e) {
    const c = ler(tabela + ':' + id) || (filtrarLocal(tabela, { eq: { [col]: id } }) || [])[0];
    const comFila = aplicarFila(tabela, c ? [c] : [], id)[0];
    if (comFila) return comFila;
    throw new Error(ehErroDeRede(e) ? 'Sem internet e sem cópia guardada deste registro' : 'Não foi possível abrir');
  }
}

// Mostra na leitura o que ainda está na fila (salvo offline), para a tela não "voltar no tempo".
function aplicarFila(tabela, lista, soId) {
  const fila = lerFila().filter(a => a.tabela === tabela);
  if (!fila.length) return lista;
  const mapa = new Map(lista.map(r => [r.id ?? r.user_id, { ...r }]));
  for (const a of fila) {
    const id = a.reg?.id ?? a.id;
    if (soId && id !== soId) continue;
    if (a.op === 'upsert') mapa.set(id, { ...(mapa.get(id) || {}), ...a.reg, _pendente: true });
    else if (a.op === 'update' && mapa.has(id)) mapa.set(id, { ...mapa.get(id), ...a.campos, _pendente: true });
    else if (a.op === 'delete') mapa.delete(id);
  }
  return [...mapa.values()];
}

// ---------- gravação ----------
const limpar = r => { const { atualizado_em, numero, criado_em, _pendente, ...resto } = r; return resto; };

async function conferirConflito(tabela, id, base) {
  if (!base || tabela === 'configuracoes') return;
  const { data: atual, error } = await db.from(tabela).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (atual && atual.atualizado_em !== base) throw new ConflitoError(null, atual);
}

async function executar(a) {
  if (a.op === 'upsert') {
    await conferirConflito(a.tabela, a.reg.id, a.base);
    const chave = a.tabela === 'configuracoes' ? 'user_id' : 'id';
    const { data, error } = await db.from(a.tabela).upsert(limpar(a.reg), { onConflict: chave }).select().single();
    if (error) throw error;
    return data;
  }
  if (a.op === 'update') {
    await conferirConflito(a.tabela, a.id, a.base);
    const { data, error } = await db.from(a.tabela).update(limpar(a.campos)).eq('id', a.id).select().single();
    if (error) throw error;
    return data;
  }
  if (a.op === 'delete') {
    const { error } = await db.from(a.tabela).delete().eq('id', a.id);
    if (error) throw error;
    return null;
  }
}

async function rodar(a, otimista) {
  try {
    return await executar(a);
  } catch (e) {
    if (e instanceof ConflitoError) { e.local = otimista; throw e; }
    if (ehErroDeRede(e)) {
      const f = lerFila(); f.push({ ...a, base: undefined }); gravarFila(f); notificar();
      return otimista;
    }
    throw new Error(traduzir(e.message));
  }
}

// Insere ou substitui o registro inteiro. `base` = atualizado_em lido antes de editar (checa conflito).
export async function salvar(tabela, registro, base) {
  const reg = { ...registro };
  if (tabela !== 'configuracoes' && !reg.id) reg.id = crypto.randomUUID();
  return rodar({ op: 'upsert', tabela, reg, base }, { ...reg, _pendente: true });
}

// Muda só alguns campos de um registro que já existe.
export async function atualizar(tabela, id, campos, base) {
  return rodar({ op: 'update', tabela, id, campos, base }, { id, ...campos, _pendente: true });
}

export async function excluir(tabela, id) {
  if (tabela === 'fichas') return atualizar('fichas', id, { excluido_em: new Date().toISOString() });
  return rodar({ op: 'delete', tabela, id }, null);
}
export async function restaurar(id) { return atualizar('fichas', id, { excluido_em: null }); }

export async function chamar(funcao) {
  try { await db.rpc(funcao); } catch { /* sem internet: tenta na próxima abertura */ }
}

// ---------- fila offline ----------
let ouvinte = () => {};
export function aoMudarPendentes(fn) { ouvinte = fn; }
function notificar() { ouvinte(pendentes()); }
export function pendentes() { return lerFila().length; }

let enviando = false;
export async function enviarPendentes() {
  if (enviando || !navigator.onLine) return;
  enviando = true;
  try {
    let f = lerFila();
    while (f.length) {
      try { await executar(f[0]); }
      catch (e) {
        if (ehErroDeRede(e)) break;
        console.error('Item da fila descartado:', f[0], e);
      }
      f = lerFila(); f.shift(); gravarFila(f); notificar();
    }
  } finally { enviando = false; }
}
