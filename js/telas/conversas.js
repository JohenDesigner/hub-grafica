// Conversas do WhatsApp do hub (número 94173-7345): lista, conversa, resposta e atalho para o orçamento.
import { db, listar, obter } from '../db.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { NOMES_ETAPA } from '../calc.js';
import { esc, avisar, titulo, ICONE, abrirModal, fecharModal, confirmar } from '../ui.js';
import { carregarCfg, salvarRespostas, RESPOSTAS_PADRAO } from './configuracoes.js';

const JANELA_MS = 24 * 3600e3;

// ---------- horário ----------
function quando(iso) {
  const d = new Date(iso), agora = new Date();
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === agora.toDateString()) return hora;
  const ontem = new Date(agora); ontem.setDate(agora.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
const diaTitulo = iso => {
  const d = new Date(iso), hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: d.getFullYear() === hoje.getFullYear() ? undefined : 'numeric' });
};
const formatar = t => esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const resumo = m => (m.direcao === 'enviada' ? (m.tipo === 'auto' ? 'Resposta automática: ' : 'Você: ') : '') +
  String(m.texto || (m.tipo === 'text' ? '' : `(${m.tipo})`)).replace(/\*([^*\n]+)\*/g, '$1').replace(/\s+/g, ' ');
const iniciais = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const avatar = n => `<span aria-hidden="true" class="conv-avatar">${esc(iniciais(n))}</span>`;
const preencher = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));

// Editor das respostas prontas (título curto + texto)
function editarRespostas(lista, aoSalvar) {
  let itens = lista.map(r => ({ ...r }));
  const caixa = abrirModal('<div id="rp"></div>');
  const area = caixa.querySelector('#rp');
  const desenhar = () => {
    area.innerHTML = `
      <div class="modal-topo"><h2>Respostas prontas</h2><button class="icone-btn" data-fechar-rp aria-label="Fechar">${ICONE.fechar}</button></div>
      <p class="sub">Marcadores que viram dado de verdade: {cliente} {pix} {endereco} {horario} {grafica}</p>
      ${itens.map((r, i) => `<div class="cartao rp-item">
        <div class="campo-linha"><label class="campo"><span>Nome do botão</span><input data-i="${i}" data-c="titulo" value="${esc(r.titulo)}" maxlength="24"></label>
        <button class="icone-btn" type="button" data-rem="${i}" aria-label="Apagar resposta">${ICONE.lixo}</button></div>
        <label class="campo"><span>Texto</span><textarea data-i="${i}" data-c="texto" rows="3">${esc(r.texto)}</textarea></label></div>`).join('')}
      <div class="botoes"><button class="btn" type="button" id="rp-nova">${ICONE.mais.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"')}Nova resposta</button>
      <button class="btn" type="button" id="rp-padrao">Voltar ao padrão</button></div>
      <button class="btn btn-primario btn-bloco rodape-fixo" type="button" id="rp-salvar">Salvar respostas</button>`;
    area.querySelector('[data-fechar-rp]').addEventListener('click', () => fecharModal());
    area.querySelectorAll('[data-c]').forEach(c => c.addEventListener('input', () => { itens[c.dataset.i][c.dataset.c] = c.value; }));
    area.querySelectorAll('[data-rem]').forEach(b => b.addEventListener('click', () => { itens.splice(+b.dataset.rem, 1); desenhar(); }));
    area.querySelector('#rp-nova').addEventListener('click', () => { itens.push({ titulo: '', texto: '' }); desenhar(); area.querySelector('.rp-item:last-of-type input')?.focus(); });
    area.querySelector('#rp-padrao').addEventListener('click', async () => {
      fecharModal();
      if (await confirmar('Trocar suas respostas pelas respostas padrão?', { ok: 'Trocar' })) { itens = RESPOSTAS_PADRAO.map(r => ({ ...r })); }
      editarRespostasReabrir();
    });
    area.querySelector('#rp-salvar').addEventListener('click', async e => {
      const limpas = itens.map(r => ({ titulo: r.titulo.trim(), texto: r.texto.trim() })).filter(r => r.titulo && r.texto);
      e.target.disabled = true;
      try { await salvarRespostas(limpas); fecharModal(); avisar('Respostas salvas'); aoSalvar(limpas); }
      catch (err) { avisar(err.message, 'erro'); e.target.disabled = false; }
    });
  };
  const editarRespostasReabrir = () => editarRespostas(itens, aoSalvar);
  desenhar();
}

const ICONE_ENVIAR = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>';

// ---------- não lidas (selo no menu) ----------
export async function contarNaoLidas() {
  try {
    const { count } = await db.from('whatsapp_mensagens').select('id', { count: 'exact', head: true })
      .eq('direcao', 'recebida').eq('lida', false);
    return count || 0;
  } catch { return 0; }
}
export async function atualizarSelo() {
  const n = await contarNaoLidas();
  document.querySelectorAll('[data-selo-conversas]').forEach(s => { s.hidden = !n; s.textContent = n > 99 ? '99+' : n; });
}

// Fica ouvindo mensagens novas enquanto o hub está aberto (Supabase Realtime).
let ouvindo = false;
export function ouvirMensagens() {
  if (ouvindo || typeof db.channel !== 'function') return;
  ouvindo = true;
  db.channel('wa-mensagens')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_mensagens' }, p => {
      atualizarSelo();
      dispatchEvent(new CustomEvent('wa-mensagem', { detail: p.new || p.old }));
    })
    .subscribe();
  atualizarSelo();
  // celular com a tela apagada perde a conexão: confere de novo ao voltar
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { atualizarSelo(); dispatchEvent(new CustomEvent('wa-mensagem')); } });
}

// ---------- envio ----------
async function enviar(clienteId, texto) {
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre de novo.');
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-enviar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: clienteId, texto })
    });
  } catch { throw new Error('Sem internet. A mensagem não foi enviada.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.mensagem || d.erro || 'Não foi possível enviar');
  return d.mensagem;
}

// ---------- lista ----------
export async function montarLista(el, _p, vivo) {
  titulo('Conversas');
  const desenhar = async () => {
    const [msgs, clientes] = await Promise.all([
      listar('whatsapp_mensagens', { order: 'criado_em', desc: true }), listar('clientes')]);
    if (!vivo()) return;
    const cli = new Map(clientes.map(c => [c.id, c]));
    const grupos = new Map();
    for (const m of msgs) {
      const k = m.cliente_id || 'tel:' + m.telefone;
      if (!grupos.has(k)) grupos.set(k, { ultima: m, naoLidas: 0, cliente: cli.get(m.cliente_id), m });
      if (m.direcao === 'recebida' && !m.lida) grupos.get(k).naoLidas++;
    }
    const lista = [...grupos.values()];
    const busca = el.querySelector('#cv-busca')?.value.trim().toLowerCase() || '';
    const vis = lista.filter(g => !busca || (g.cliente?.nome || g.m.nome_contato || g.m.telefone).toLowerCase().includes(busca));
    const html = vis.length ? `<ul class="lista">${vis.map(g => {
      const nome = g.cliente?.nome || g.m.nome_contato || g.m.telefone;
      const href = g.m.cliente_id ? `#conversa/${g.m.cliente_id}` : '#conversas';
      return `<li><a class="lista-item${g.naoLidas ? ' conv-nova' : ''}" href="${href}">${avatar(nome)}
        <span class="meio"><span class="nome">${esc(nome)}</span><span class="det">${esc(resumo(g.ultima))}</span></span>
        <span class="fim"><span class="det">${esc(quando(g.ultima.criado_em))}</span>${g.naoLidas ? `<span class="conv-selo">${g.naoLidas}</span>` : ''}</span></a></li>`;
    }).join('')}</ul>`
      : `<p class="vazio">${lista.length ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda. Quando um cliente mandar mensagem para o WhatsApp do hub, ela aparece aqui.'}</p>`;
    const alvo = el.querySelector('#cv-lista');
    if (alvo) alvo.innerHTML = html;
  };
  el.innerHTML = `
    <div class="cabeca"><h2>Conversas</h2></div>
    <p class="sub">WhatsApp do hub: (11) 94173-7345. Toda mensagem nova vira orçamento automaticamente.</p>
    <label class="campo"><span>Buscar por nome</span><input id="cv-busca" type="search" autocomplete="off"></label>
    <div id="cv-lista" class="conv-lista"><p class="vazio">Carregando…</p></div>`;
  el.querySelector('#cv-busca').addEventListener('input', desenhar);
  const aoChegar = () => { if (vivo()) desenhar(); else removeEventListener('wa-mensagem', aoChegar); };
  addEventListener('wa-mensagem', aoChegar);
  await desenhar();
}

// ---------- conversa ----------
export async function montarConversa(el, clienteId, vivo) {
  titulo('Conversa');
  const cliente = await obter('clientes', clienteId);
  if (!vivo()) return;
  if (!cliente) { el.innerHTML = '<p class="vazio">Conversa não encontrada.</p>'; return; }
  titulo(cliente.nome);
  let msgs = [];

  el.innerHTML = `
    <div class="conv-topo cartao">
      <a class="icone-btn" href="#conversas" aria-label="Voltar para as conversas">${ICONE.voltar}</a>
      ${avatar(cliente.nome)}
      <div class="meio"><b>${esc(cliente.nome)}</b><div class="sub">${esc(cliente.whatsapp || '')}</div></div>
      <a class="btn btn-peq" href="#cliente/${cliente.id}">Cliente</a>
    </div>
    <div id="cv-ficha"></div>
    <div id="cv-msgs" class="conv-msgs" aria-live="polite"><p class="vazio">Carregando…</p></div>
    <p id="cv-janela" class="aviso" hidden></p>
    <div class="conv-rapidas" id="cv-rapidas" aria-label="Respostas prontas"></div>
    <form id="cv-form" class="conv-form">
      <label class="sr" for="cv-texto">Mensagem</label>
      <textarea id="cv-texto" rows="1" placeholder="Escreva sua resposta…" autocomplete="off"></textarea>
      <button class="conv-enviar" type="submit" aria-label="Enviar">${ICONE_ENVIAR}</button>
    </form>`;

  const caixa = el.querySelector('#cv-msgs');
  const campo = el.querySelector('#cv-texto');
  const cfg = await carregarCfg();
  if (!vivo()) return;
  let respostas = Array.isArray(cfg.respostas) ? cfg.respostas : RESPOSTAS_PADRAO;
  const valores = () => ({ cliente: (cliente.nome || '').split(' ')[0], pix: cfg.pix || '', endereco: cfg.endereco || '', horario: cfg.horario || '', grafica: cfg.nome || 'Johen Arte Grafica' });

  function desenharRapidas() {
    el.querySelector('#cv-rapidas').innerHTML = respostas.map((r, i) => `<button type="button" class="conv-rapida" data-r="${i}">${esc(r.titulo)}</button>`).join('') +
      `<button type="button" class="conv-rapida conv-rapida-editar" data-editar aria-label="Editar respostas prontas">${ICONE.editar.replace('<svg', '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"')}Editar</button>`;
  }
  el.querySelector('#cv-rapidas').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-editar')) { editarRespostas(respostas, l => { respostas = l; desenharRapidas(); }); return; }
    const r = respostas[+b.dataset.r]; if (!r) return;
    const t = preencher(r.texto, valores());
    campo.value = campo.value.trim() ? campo.value.trimEnd() + '\n' + t : t;
    campo.dispatchEvent(new Event('input'));
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  });
  desenharRapidas();

  async function desenharFicha() {
    const fichas = await listar('fichas', { eq: { cliente_id: clienteId }, semExcluidos: true, order: 'criado_em', desc: true });
    if (!vivo()) return;
    const f = fichas[0];
    el.querySelector('#cv-ficha').innerHTML = `<div class="botoes">
      ${f ? `<a class="btn btn-primario" href="${f.etapa === 'orcamento' ? `#orcamento/${f.id}` : `#pedido/${f.id}`}">${f.etapa === 'orcamento' ? 'Montar orçamento' : 'Abrir pedido'} nº ${esc(f.numero ?? '')} <span class="etapa etapa-${f.etapa}" style="margin-left:4px">${esc(NOMES_ETAPA[f.etapa])}</span></a>` : ''}
      <a class="btn" href="#orcamento/cliente:${cliente.id}">Novo orçamento</a></div>`;
  }

  function desenhar() {
    let dia = '';
    caixa.innerHTML = msgs.length ? msgs.map(m => {
      const d = diaTitulo(m.criado_em);
      const sep = d !== dia ? `<div class="conv-dia"><span>${esc(d)}</span></div>` : '';
      dia = d;
      const lado = m.direcao === 'enviada' ? 'conv-eu' : 'conv-ele';
      const status = m.direcao === 'enviada' ? ({ sent: '✓', delivered: '✓✓', read: '<span class="conv-lido">✓✓</span>', failed: '<span style="color:var(--erro)">não entregue</span>' }[m.status] || '🕓') : '';
      const conteudo = m.texto ? formatar(m.texto) : `<i>(${esc(m.tipo)} — abra no celular do cliente ou peça para reenviar como texto)</i>`;
      return `${sep}<div class="conv-bolha ${lado}${m._enviando ? ' conv-enviando' : ''}">
        ${m.tipo === 'auto' ? '<span class="conv-rotulo">Resposta automática</span>' : ''}
        ${m.tipo !== 'text' && m.tipo !== 'auto' && m.texto ? `<span class="conv-rotulo">${esc(m.tipo)}</span>` : ''}
        <div>${conteudo}</div><span class="conv-hora">${esc(new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))} ${status}</span></div>`;
    }).join('') : '<p class="vazio">Nenhuma mensagem ainda.</p>';
    caixa.scrollTop = caixa.scrollHeight;
    requestAnimationFrame(() => el.querySelector('#cv-form')?.scrollIntoView({ block: 'end' }));

    const ultRec = [...msgs].reverse().find(m => m.direcao === 'recebida');
    const fora = !ultRec || Date.now() - new Date(ultRec.criado_em).getTime() > JANELA_MS;
    const aviso = el.querySelector('#cv-janela');
    aviso.hidden = !fora;
    aviso.textContent = ultRec
      ? 'Passaram 24 horas desde a última mensagem deste cliente. O WhatsApp só libera mensagem livre até 24h depois que o cliente fala; agora só os avisos automáticos (modelos aprovados) podem ser enviados.'
      : 'Este cliente ainda não mandou mensagem para o WhatsApp do hub. Para falar com ele, use o WhatsApp da loja.';
  }

  async function carregar() {
    const lista = await listar('whatsapp_mensagens', { eq: { cliente_id: clienteId }, order: 'criado_em' });
    if (!vivo()) return;
    msgs = lista;
    desenhar();
    const naoLidas = msgs.filter(m => m.direcao === 'recebida' && !m.lida).map(m => m.id);
    if (naoLidas.length) {
      try { await db.from('whatsapp_mensagens').update({ lida: true }).in('id', naoLidas); } catch {}
      atualizarSelo();
    }
  }

  campo.addEventListener('input', () => { campo.style.height = 'auto'; campo.style.height = Math.min(campo.scrollHeight, 160) + 'px'; });
  campo.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && matchMedia('(min-width: 900px)').matches) { e.preventDefault(); el.querySelector('#cv-form').requestSubmit(); }
  });
  el.querySelector('#cv-form').addEventListener('submit', async e => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (!texto) return;
    const btn = el.querySelector('.conv-enviar');
    btn.disabled = true;
    const tmp = { id: 'tmp', direcao: 'enviada', tipo: 'text', texto, criado_em: new Date().toISOString(), _enviando: true };
    msgs.push(tmp); desenhar();
    try {
      const salva = await enviar(clienteId, texto);
      msgs = msgs.filter(m => m !== tmp);
      if (salva && !msgs.some(m => m.id === salva.id)) msgs.push(salva);
      campo.value = ''; campo.style.height = 'auto';
      desenhar();
    } catch (err) {
      msgs = msgs.filter(m => m !== tmp); desenhar();
      avisar(err.message, 'erro');
    } finally { btn.disabled = false; }
  });

  const aoChegar = ev => {
    if (!vivo()) { removeEventListener('wa-mensagem', aoChegar); return; }
    const m = ev.detail;
    if (!m || m.cliente_id === clienteId) { carregar(); desenharFicha(); }
  };
  addEventListener('wa-mensagem', aoChegar);

  await Promise.all([carregar(), desenharFicha()]);
}

