// Pedidos: lista por etapa e detalhe da ficha.
import { db, listar, obter, atualizar, excluir, restaurar, ConflitoError } from '../db.js';
import { ETAPAS, NOMES_ETAPA, saldoAberto, calcularFicha, calcularItem, orcamentoVencido } from '../calc.js';
import { moeda, data, soDigitos, hojeISO } from '../formato.js';
import { mensagem, linkWa, detalheItem } from '../whatsapp.js';
import { esc, avisar, confirmar, titulo, ICONE } from '../ui.js';
import { ir } from '../rotas.js';
import { carregarCfg } from './configuracoes.js';
import { registrarPagamento, NOMES_FORMA } from './receber.js';
import { escolherVersao } from '../conflito.js';
import { pdfOrcamento } from '../pdf.js';

const ABAS = [['todos', 'Todos'], ...ETAPAS.map(e => [e, NOMES_ETAPA[e]]), ['cancelado', 'Cancelados'], ['lixeira', 'Lixeira']];

export async function montarLista(el, aba = 'todos', vivo) {
  titulo('Pedidos');
  const lixeira = aba === 'lixeira';
  const [fichas, pags, clientes, cfg] = await Promise.all([
    listar('fichas', lixeira ? { soExcluidos: true, order: 'excluido_em', desc: true } : { semExcluidos: true, order: 'criado_em', desc: true }),
    listar('pagamentos'), listar('clientes'), carregarCfg()]);
  if (!vivo()) return;
  const cli = new Map(clientes.map(c => [c.id, c]));
  const pagosPor = new Map();
  pags.forEach(p => pagosPor.set(p.ficha_id, [...(pagosPor.get(p.ficha_id) || []), p]));
  const conta = k => k === 'todos' ? fichas.filter(f => f.etapa !== 'cancelado').length : fichas.filter(f => f.etapa === k).length;
  const hoje = hojeISO();

  el.innerHTML = `
    <div class="cabeca"><h2>${lixeira ? 'Lixeira' : 'Pedidos'}</h2><a class="btn btn-primario" href="#orcamento">${ICONE.mais.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"')}Novo</a></div>
    <div class="abas" id="pd-abas">${ABAS.map(([k, n]) => `<button type="button" data-aba="${k}" aria-pressed="${k === aba}">${esc(n)}${k !== 'lixeira' && !lixeira ? ` (${conta(k)})` : ''}</button>`).join('')}</div>
    <label class="campo"><span>Buscar por nº, cliente ou OS do FpqSystem</span><input id="pd-busca" type="search" autocomplete="off"></label>
    ${lixeira ? '<p class="sub">Pedidos excluídos ficam aqui por 30 dias e depois somem.</p>' : ''}
    <div id="pd-lista"></div>`;

  el.querySelector('#pd-abas').addEventListener('click', e => { const b = e.target.closest('[data-aba]'); if (b) ir('pedidos', b.dataset.aba); });
  el.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });

  const desenhar = () => {
    const t = el.querySelector('#pd-busca').value.trim().toLowerCase();
    const td = soDigitos(t);
    const vis = fichas.filter(f => {
      if (!lixeira) {
        if (aba === 'todos' && f.etapa === 'cancelado') return false;
        if (aba !== 'todos' && f.etapa !== aba) return false;
      }
      if (!t) return true;
      const c = cli.get(f.cliente_id);
      return String(f.numero) === t.replace(/^n[ºo°]?\s*/, '') || (c && c.nome.toLowerCase().includes(t)) ||
        (td && f.os_fpq && soDigitos(f.os_fpq).includes(td)) || (f.os_fpq || '').toLowerCase().includes(t);
    });
    el.querySelector('#pd-lista').innerHTML = vis.length ? `<ul class="lista">${vis.map(f => {
      const c = cli.get(f.cliente_id) || { nome: '—' };
      const falta = saldoAberto(f.total_centavos, pagosPor.get(f.id));
      const atrasado = f.prazo && f.prazo < hoje && !['entregue', 'cancelado', 'orcamento'].includes(f.etapa);
      return `<li><a class="lista-item" href="#pedido/${f.id}">
        <span class="meio"><span class="nome">Nº ${esc(f.numero ?? 'novo')} · ${esc(c.nome)}</span>
          <span class="det"><span class="etapa etapa-${f.etapa}">${esc(NOMES_ETAPA[f.etapa])}</span>
          ${orcamentoVencido(f, cfg.validade_dias) ? '<span class="selo alerta">vencido</span>' : ''}
          ${f.prazo ? ` <span style="${atrasado ? 'color:var(--erro);font-weight:700' : ''}">prazo ${data(f.prazo)}</span>` : ''}
          ${f.os_fpq ? ` · OS ${esc(f.os_fpq)}` : ''}</span></span>
        <span class="fim"><span class="valor">${moeda(f.total_centavos)}</span>
          ${f.etapa !== 'orcamento' && f.etapa !== 'cancelado' ? `<br><span class="det" style="font-size:13px;color:${falta ? 'var(--alerta)' : 'var(--ok)'}">${falta ? 'falta ' + moeda(falta) : 'quitado'}</span>` : ''}</span>
      </a></li>`; }).join('')}</ul>`
      : `<p class="vazio">${lixeira ? 'A lixeira está vazia.' : 'Nenhum pedido aqui.'}</p>`;
  };
  desenhar();
  el.querySelector('#pd-busca').addEventListener('input', desenhar);
}

export async function montarDetalhe(el, id, vivo) {
  titulo('Pedido');
  const ficha = await obter('fichas', id);
  if (!vivo()) return;
  if (!ficha) { el.innerHTML = '<p class="vazio">Pedido não encontrado.</p>'; return; }
  const [cliente, pags, cfg] = await Promise.all([obter('clientes', ficha.cliente_id).catch(() => null), listar('pagamentos', { eq: { ficha_id: id }, order: 'pago_em' }), carregarCfg()]);
  if (!vivo()) return;
  const c = cliente || { nome: '—', whatsapp: '' };
  const r = calcularFicha(ficha.itens, ficha.desconto);
  const pago = pags.reduce((s, p) => s + Number(p.valor_centavos), 0);
  const falta = saldoAberto(ficha.total_centavos, pags);
  const idx = ETAPAS.indexOf(ficha.etapa);
  const cancelado = ficha.etapa === 'cancelado', excluido = !!ficha.excluido_em;
  const recarregar = () => montarDetalhe(el, id, vivo);
  titulo(`${ficha.etapa === 'orcamento' ? 'Orçamento' : 'Pedido'} nº ${ficha.numero ?? 'novo'}`);

  const wpp = (tipo, rotulo) => c.whatsapp ? `<a class="btn btn-wpp" target="_blank" rel="noopener" href="${linkWa(c.whatsapp, mensagem(tipo, { ficha, cliente: c, cfg, saldo: falta }))}">${rotulo}</a>` : '';
  const botoesWpp = [
    ficha.etapa === 'orcamento' && wpp('orcamento', 'Enviar orçamento'),
    ['arte', 'aprovacao'].includes(ficha.etapa) && wpp('arte', 'Pedir aprovação da arte'),
    ficha.etapa === 'pronto' && wpp('pronto', 'Avisar que está pronto'),
    falta > 0 && !['orcamento', 'cancelado'].includes(ficha.etapa) && wpp('cobranca', 'Cobrar')
  ].filter(Boolean).join('');

  el.innerHTML = `
    ${excluido ? `<div class="aviso">Este pedido está na lixeira. <button class="btn btn-peq" id="pd-restaurar" style="margin-left:8px">Restaurar</button></div>` : ''}
    <section class="cartao">
      <div class="cabeca">
        <div style="flex:1;min-width:0">
          <a href="#cliente/${esc(ficha.cliente_id)}" style="font-family:var(--display);font-size:20px;font-weight:600;color:inherit;text-decoration:none">${esc(c.nome)}</a>
          <div class="sub">${ficha._pendente ? '<span class="selo alerta">pendente de envio</span> ' : ''}criado em ${data(ficha.criado_em || new Date().toISOString())}</div>
        </div>
        <span class="etapa etapa-${ficha.etapa}">${esc(NOMES_ETAPA[ficha.etapa])}</span>
      </div>
      ${cancelado ? '' : `<div class="trilha" aria-hidden="true">${ETAPAS.map((e, i) => `<span class="${i < idx ? 'feita' : i === idx ? 'atual' : ''}" title="${NOMES_ETAPA[e]}"></span>`).join('')}</div>
      <p class="sub" style="margin-top:6px">${ETAPAS.map((e, i) => i === idx ? `<b style="color:var(--texto)">${NOMES_ETAPA[e]}</b>` : NOMES_ETAPA[e]).join(' › ')}</p>`}
      ${orcamentoVencido(ficha, cfg.validade_dias) ? '<p class="aviso">Orçamento vencido: passou da validade.</p>' : ''}
      ${excluido ? '' : `<div class="botoes">
        ${cancelado ? '<button class="btn" data-etapa="orcamento">Reabrir como orçamento</button>' : `
          ${idx > 0 ? `<button class="btn" data-etapa="${ETAPAS[idx - 1]}">◀ ${NOMES_ETAPA[ETAPAS[idx - 1]]}</button>` : ''}
          ${idx < ETAPAS.length - 1 ? `<button class="btn btn-primario" data-etapa="${ETAPAS[idx + 1]}">Avançar para ${NOMES_ETAPA[ETAPAS[idx + 1]]} ▶</button>` : ''}`}
      </div>`}
      ${botoesWpp ? `<div class="botoes">${botoesWpp}</div>` : ''}
    </section>

    <section class="cartao">
      <div class="cabeca"><h3 style="flex:1">Itens</h3>${ficha.etapa === 'orcamento' && !excluido ? `<a class="btn btn-peq" href="#orcamento/${ficha.id}">Editar orçamento</a>` : ''}</div>
      ${(ficha.itens || []).map(it => `<div class="linha-item"><div class="meio"><b>${esc(it.quantidade)}× ${esc(it.nome)}</b><div class="det">${esc(detalheItem(it))}</div>${it.complemento ? `<div class="det complemento">Complemento: ${esc(it.complemento)}</div>` : ''}</div>
        <span class="valor">${moeda(calcularItem(it).centavos)}</span></div>`).join('')}
      <div class="resumo">
        ${r.desconto ? `<span>Subtotal</span><span class="valor">${moeda(r.subtotal)}</span><span>Desconto</span><span class="valor">− ${moeda(r.desconto)}</span>` : ''}
        <span class="total">Total</span><span class="valor total">${moeda(ficha.total_centavos)}</span>
      </div>
      <button class="btn btn-bloco" id="pd-pdf">Gerar PDF do orçamento</button>
    </section>

    <section class="cartao">
      <div class="cabeca"><h3 style="flex:1">Pagamentos</h3>${falta === 0 && ficha.total_centavos > 0 ? '<span class="selo ok">Quitado</span>' : ''}</div>
      ${pags.length ? pags.map(p => `<div class="linha-item"><div class="meio"><b>${moeda(p.valor_centavos)}</b> <span class="sub">${p.tipo === 'sinal' ? 'sinal' : 'pagamento'} · ${NOMES_FORMA[p.forma]} · ${data(p.pago_em)}</span></div>
        ${excluido ? '' : `<button class="icone-btn" data-excluir-pag="${p.id}" aria-label="Excluir pagamento">${ICONE.lixo}</button>`}</div>`).join('') : '<p class="sub">Nenhum pagamento ainda.</p>'}
      <div id="pd-comprovantes"></div>
      <div class="resumo"><span>Pago</span><span class="valor">${moeda(pago)}</span><span><b>Falta receber</b></span><span class="valor" style="color:${falta ? 'var(--alerta)' : 'var(--ok)'}">${moeda(falta)}</span></div>
      ${falta > 0 && !excluido && !cancelado ? '<button class="btn btn-bloco btn-primario" id="pd-pagar">Registrar pagamento</button>' : ''}
    </section>

    <form class="cartao" id="pd-form">
      <h3>Detalhes</h3>
      <div class="grade-2">
        <label class="campo"><span>Prazo</span><input type="date" name="prazo" value="${esc(ficha.prazo || '')}"></label>
        <label class="campo"><span>Nº da OS no FpqSystem</span><input name="os_fpq" value="${esc(ficha.os_fpq || '')}" autocomplete="off"></label>
      </div>
      <label class="campo"><span>Link da arte (Drive, WhatsApp…)</span>
        <div class="campo-linha"><input name="link_arte" type="url" value="${esc(ficha.link_arte || '')}" placeholder="https://" style="flex:1">
        ${ficha.link_arte ? `<a class="btn btn-peq" href="${esc(ficha.link_arte)}" target="_blank" rel="noopener">Abrir</a>` : ''}</div></label>
      <label class="campo"><span>Observações</span><textarea name="observacoes">${esc(ficha.observacoes || '')}</textarea></label>
      ${excluido ? '' : '<button class="btn btn-bloco" type="submit">Salvar detalhes</button>'}
    </form>

    ${excluido ? '' : `<div class="botoes">
      ${cancelado ? '' : '<button class="btn btn-perigo" data-etapa="cancelado">Cancelar pedido</button>'}
      <button class="btn btn-perigo" id="pd-excluir">Excluir</button></div>`}`;

  // mudanças com checagem de conflito
  const mudar = async (campos, base = ficha.atualizado_em) => {
    try { await atualizar('fichas', id, campos, base); return true; }
    catch (err) {
      if (err instanceof ConflitoError) {
        const v = await escolherVersao({ ...ficha, ...campos }, err.remoto);
        if (v === 'meu') return mudar(campos, err.remoto.atualizado_em);
        recarregar(); return false;
      }
      avisar(err.message, 'erro'); return false;
    }
  };

  el.querySelectorAll('[data-etapa]').forEach(b => b.addEventListener('click', async () => {
    const nova = b.dataset.etapa;
    if (nova === 'cancelado' && !await confirmar('Cancelar este pedido?', { ok: 'Cancelar pedido', perigo: true, cancelar: 'Voltar' })) return;
    if (await mudar({ etapa: nova })) { avisar(`Etapa: ${NOMES_ETAPA[nova]}`); recarregar(); }
  }));
  el.querySelector('#pd-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const link = f.link_arte.value.trim();
    if (link && !/^https?:\/\//i.test(link)) { avisar('O link precisa começar com https://', 'erro'); return; }
    if (await mudar({ prazo: f.prazo.value || null, os_fpq: f.os_fpq.value.trim(), link_arte: link, observacoes: f.observacoes.value })) { avisar('Detalhes salvos'); recarregar(); }
  });
  mostrarComprovantes(el.querySelector('#pd-comprovantes'), ficha.id, vivo);
  el.querySelector('#pd-pagar')?.addEventListener('click', async () => { if (await registrarPagamento(ficha)) recarregar(); });
  el.querySelectorAll('[data-excluir-pag]').forEach(b => b.addEventListener('click', async () => {
    if (!await confirmar('Excluir este pagamento? Use só se foi lançado errado.', { ok: 'Excluir', perigo: true })) return;
    try { await excluir('pagamentos', b.dataset.excluirPag); avisar('Pagamento excluído'); recarregar(); }
    catch (err) { avisar(err.message, 'erro'); }
  }));
  el.querySelector('#pd-pdf').addEventListener('click', async e => {
    e.target.disabled = true;
    try { await pdfOrcamento(ficha, c, cfg); } catch (err) { avisar(err.message, 'erro'); }
    e.target.disabled = false;
  });
  el.querySelector('#pd-excluir')?.addEventListener('click', async () => {
    if (!await confirmar('Mandar este pedido para a lixeira? Dá para restaurar por 30 dias.', { ok: 'Excluir', perigo: true })) return;
    try { await excluir('fichas', id); avisar('Pedido na lixeira'); ir('pedidos'); }
    catch (err) { avisar(err.message, 'erro'); }
  });
  el.querySelector('#pd-restaurar')?.addEventListener('click', async () => {
    try { await restaurar(id); avisar('Pedido restaurado'); recarregar(); }
    catch (err) { avisar(err.message, 'erro'); }
  });
}

// Comprovantes que o cliente enviou pela página do pedido no site (Supabase Storage, pasta = id da ficha).
async function mostrarComprovantes(alvo, fichaId, vivo) {
  if (!alvo || !db.storage) return;
  try {
    const { data: arqs } = await db.storage.from('comprovantes').list(fichaId, { sortBy: { column: 'created_at', order: 'desc' } });
    const lista = (arqs || []).filter(a => a.name && !a.name.startsWith('.'));
    if (!lista.length || !vivo()) return;
    const { data: urls } = await db.storage.from('comprovantes').createSignedUrls(lista.map(a => `${fichaId}/${a.name}`), 3600);
    if (!vivo()) return;
    alvo.innerHTML = `<div class="comprovantes"><b>Comprovante enviado pelo cliente</b><div class="comp-lista">${lista.map((a, i) => {
      const u = urls?.[i]?.signedUrl; if (!u) return '';
      const quando = a.created_at ? new Date(a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      return /\.pdf$/i.test(a.name)
        ? `<a class="comp-item comp-pdf" href="${esc(u)}" target="_blank" rel="noopener"><span>PDF</span><small>${esc(quando)}</small></a>`
        : `<a class="comp-item" href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Comprovante enviado em ${esc(quando)}" loading="lazy"><small>${esc(quando)}</small></a>`;
    }).join('')}</div><p class="sub">Confira no app do banco antes de registrar o pagamento.</p></div>`;
  } catch {}
}
