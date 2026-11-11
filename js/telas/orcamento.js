// Orçamento rápido: nova ficha ou edição de ficha que ainda está em Orçamento.
import { listar, obter, salvar, atualizar, ConflitoError } from '../db.js';
import { calcularItem, calcularFicha, validarItem, somarDiasUteis, orcamentoVencido, emCentavos } from '../calc.js';
import { NOMES_CATEGORIA } from '../catalogo.js';
import { moeda, data, lerNumero, hojeISO, soDigitos } from '../formato.js';
import { mensagem, linkWa, detalheItem } from '../whatsapp.js';
import { esc, avisar, abrirModal, fecharModal, titulo, ICONE } from '../ui.js';
import { ir, protegerSaida } from '../rotas.js';
import { todosProdutos, aPartirDe, formExtra, extraParaProduto } from './produtos.js';
import { formClienteRapido } from './clientes.js';
import { carregarCfg } from './configuracoes.js';
import { registrarPagamento } from './receber.js';
import { escolherVersao } from '../conflito.js';
import { pdfOrcamento } from '../pdf.js';

const UUID = /^[0-9a-f-]{36}$/i;
const RASCUNHO = 'hub_rascunho:';

// Rascunhos abertos em outra aba ficam guardados no aparelho por 7 dias.
function limparRascunhosVelhos() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(RASCUNHO)) continue;
      const r = JSON.parse(localStorage.getItem(k) || 'null');
      if (!r || Date.now() - r.quando > 7 * 864e5) localStorage.removeItem(k);
    }
  } catch {}
}
const ICONE_ABA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const num = v => String(v ?? '').replace('.', ',');

export async function montar(el, param, vivo) {
  titulo('Orçamento');
  const [cat, clientes, cfg] = await Promise.all([todosProdutos(), listar('clientes', { order: 'nome' }), carregarCfg()]);
  let ficha = { itens: [], desconto: { tipo: 'reais', valor: 0 }, prazo: '', observacoes: '', etapa: 'orcamento' };
  let virarAoSalvar = param === 'novo-pedido';
  let chaveRascunho = null, rascunho = null;
  limparRascunhosVelhos();
  if (param?.startsWith('rascunho:')) {
    chaveRascunho = param.slice(9);
    try { rascunho = JSON.parse(localStorage.getItem(RASCUNHO + chaveRascunho) || 'null'); } catch {}
    if (!rascunho) { el.innerHTML = '<div class="cartao"><p>Este orçamento já foi salvo ou não está mais guardado neste aparelho.</p><a class="btn" href="#pedidos/orcamento">Ver orçamentos</a></div>'; return; }
    ficha = rascunho.ficha; virarAoSalvar = !!rascunho.virarAoSalvar;
    if (ficha.id && ficha.etapa !== 'orcamento') { ir('pedido', ficha.id); return; }
  } else if (param && UUID.test(param)) {
    const f = await obter('fichas', param);
    if (!f) { el.innerHTML = '<p class="vazio">Orçamento não encontrado.</p>'; return; }
    if (f.etapa !== 'orcamento') { ir('pedido', f.id); return; }
    ficha = f;
  } else if (param?.startsWith('cliente:')) ficha.cliente_id = param.slice(8);
  if (!vivo()) return;

  let cliente = clientes.find(c => c.id === ficha.cliente_id) || null;
  let prazoManual = rascunho ? !!rascunho.prazoManual : !!ficha.id;
  let salvo = !!ficha.id && !rascunho;   // nada mudou desde a última gravação
  const produtos = cat.lista;

  // Cópia automática no aparelho a cada mudança: se o app fechar, a bateria acabar ou você sair sem querer,
  // o orçamento volta na próxima vez que abrir esta tela.
  const chaveAuto = () => RASCUNHO + 'auto-' + (ficha.id || 'novo');
  const temConteudo = () => ficha.itens.length > 0 || !!String(ficha.observacoes || '').trim() || Number(ficha.desconto?.valor) > 0;
  function guardarAuto() {
    if (chaveRascunho || !temConteudo()) return;
    try { localStorage.setItem(chaveAuto(), JSON.stringify({ ficha: { ...ficha, cliente_id: cliente?.id ?? ficha.cliente_id ?? null }, virarAoSalvar, prazoManual, quando: Date.now() })); } catch {}
  }
  function apagarAuto(chave = chaveAuto()) { try { localStorage.removeItem(chave); } catch {} }
  let recuperavel = null;
  if (!rascunho) {
    try {
      const r = JSON.parse(localStorage.getItem(chaveAuto()) || 'null');
      if (r && (!ficha.id || r.quando > Date.parse(ficha.atualizado_em || 0))) recuperavel = r;
      else if (r) apagarAuto();
    } catch {}
  }
  protegerSaida(() => !salvo && temConteudo());

  titulo(ficha.id ? `Orçamento nº ${ficha.numero ?? 'novo'}` : virarAoSalvar ? 'Novo pedido' : 'Novo orçamento');

  const prazoSugerido = () => {
    const dias = Math.max(0, ...ficha.itens.map(i => Number(i.prazo_dias) || 0));
    return ficha.itens.length ? somarDiasUteis(hojeISO(), dias) : '';
  };

  function desenhar() {
    const r = calcularFicha(ficha.itens, ficha.desconto);
    if (!prazoManual) ficha.prazo = prazoSugerido();
    const vencido = ficha.id && orcamentoVencido(ficha, cfg.validade_dias);
    el.innerHTML = `
      ${cat.offline ? `<p class="aviso">Sem internet: usando os preços guardados${cat.quando ? ' de ' + data(cat.quando) : ''}.</p>` : ''}
      ${vencido ? '<p class="aviso">Este orçamento passou da validade. Confira os preços antes de reenviar.</p>' : ''}
      ${recuperavel ? `<div class="aviso" id="o-recuperar"><p style="margin:0">Você tinha ${ficha.id ? 'mudanças neste orçamento' : 'um orçamento'} sem salvar (${esc(new Date(recuperavel.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}, ${recuperavel.ficha.itens.length} ${recuperavel.ficha.itens.length === 1 ? 'item' : 'itens'}).</p>
        <div class="botoes"><button class="btn" type="button" data-rec="nao">Descartar</button><button class="btn btn-primario" type="button" data-rec="sim">Recuperar</button></div></div>` : ''}
      <div class="o-barra"><button class="btn btn-peq" id="o-aba" type="button" title="Continua este orçamento numa aba nova e libera esta para outras coisas">${ICONE_ABA} Abrir em outra aba</button></div>
      <section class="cartao" id="o-cliente">
        <h3>Cliente</h3>
        ${cliente ? `
          <div class="campo-linha" style="align-items:center">
            <div style="flex:1;min-width:0"><b>${esc(cliente.nome)}</b><div class="sub">${esc(cliente.whatsapp || 'sem WhatsApp')}</div></div>
            <button class="btn btn-peq" id="o-trocar">Trocar</button></div>`
        : `
          <div class="campo-linha">
            <label class="campo"><span>Buscar cliente</span><input id="o-busca-cli" type="search" autocomplete="off" placeholder="Nome ou WhatsApp"></label>
            <button class="btn" id="o-novo-cli" style="flex:none">+ Novo</button></div>
          <ul class="sugestoes" id="o-sug" hidden></ul>`}
      </section>

      <section class="cartao">
        <div class="cabeca"><h3 style="flex:1">Itens</h3><span class="sub">${ficha.itens.length}</span></div>
        <div id="o-itens">${ficha.itens.length ? ficha.itens.map((it, i) => `
          <div class="linha-item">
            <div class="meio"><b>${esc(it.quantidade)}× ${esc(it.nome)}</b><div class="det">${esc(detalheItem(it))}</div>
              <div class="valor" style="margin-top:4px">${moeda(calcularItem(it).centavos)}</div></div>
            <button class="icone-btn" data-editar="${i}" aria-label="Editar item">${ICONE.editar}</button>
            <button class="icone-btn" data-remover="${i}" aria-label="Remover item">${ICONE.lixo}</button>
          </div>`).join('') : '<p class="sub">Nenhum item ainda.</p>'}</div>
        <button class="btn btn-bloco" id="o-add">${ICONE.mais.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"')}Adicionar item</button>
      </section>

      <section class="cartao">
        <h3>Desconto e total</h3>
        <div class="campo-linha">
          <div class="segmentado" id="o-desc-tipo" style="flex:none">
            <button type="button" data-t="reais" aria-pressed="${ficha.desconto.tipo !== 'pct'}">R$</button>
            <button type="button" data-t="pct" aria-pressed="${ficha.desconto.tipo === 'pct'}">%</button></div>
          <label class="campo"><span>Desconto</span><input id="o-desc" inputmode="decimal" value="${ficha.desconto.valor ? num(ficha.desconto.valor) : ''}" placeholder="0"></label>
        </div>
        <div class="resumo">
          <span>Subtotal</span><span class="valor" id="o-sub">${moeda(r.subtotal)}</span>
          <span>Desconto</span><span class="valor" id="o-dsc">− ${moeda(r.desconto)}</span>
          <span class="total">Total</span><span class="valor total" id="o-total">${moeda(r.total)}</span>
        </div>
      </section>

      <section class="cartao">
        <label class="campo"><span>Prazo de entrega</span><input id="o-prazo" type="date" value="${esc(ficha.prazo || '')}"></label>
        ${ficha.prazo && !prazoManual ? '<p class="sub" style="margin-top:6px">Sugerido pelo maior prazo dos itens (dias úteis).</p>' : ''}
        <label class="campo"><span>Observações</span><textarea id="o-obs" placeholder="Detalhes do pedido, cores, arte…">${esc(ficha.observacoes || '')}</textarea></label>
      </section>

      <button class="btn btn-primario btn-bloco" id="o-salvar">${virarAoSalvar ? 'Salvar e virar pedido' : ficha.id ? 'Salvar alterações' : 'Salvar orçamento'}</button>
      ${ficha.id ? `
      <section class="cartao" id="o-depois">
        <h3>Orçamento nº ${esc(ficha.numero ?? 'novo')}${ficha._pendente ? ' <span class="selo alerta">pendente de envio</span>' : ''}</h3>
        <div class="botoes">
          ${cliente?.whatsapp ? `<a class="btn btn-wpp" id="o-wpp" target="_blank" rel="noopener" href="#">Enviar no WhatsApp</a>` : '<span class="sub">Cadastre o WhatsApp do cliente para enviar.</span>'}
          <button class="btn" id="o-pdf">Gerar PDF</button>
        </div>
        <button class="btn btn-bloco" id="o-virar">Virar pedido</button>
      </section>` : ''}`;
    ligar();
  }

  function atualizarTotais() {
    const r = calcularFicha(ficha.itens, ficha.desconto);
    el.querySelector('#o-sub').textContent = moeda(r.subtotal);
    el.querySelector('#o-dsc').textContent = '− ' + moeda(r.desconto);
    el.querySelector('#o-total').textContent = moeda(r.total);
  }

  function mudou() { salvo = false; guardarAuto(); }

  function ligar() {
    const q = s => el.querySelector(s);
    q('#o-recuperar')?.addEventListener('click', e => {
      const b = e.target.closest('[data-rec]'); if (!b) return;
      if (b.dataset.rec === 'sim') {
        ficha = recuperavel.ficha; virarAoSalvar = !!recuperavel.virarAoSalvar; prazoManual = !!recuperavel.prazoManual;
        cliente = clientes.find(c => c.id === ficha.cliente_id) || null; salvo = false;
        avisar('Orçamento recuperado');
      } else apagarAuto();
      recuperavel = null; desenhar();
    });
    // cliente
    q('#o-trocar')?.addEventListener('click', () => { cliente = null; ficha.cliente_id = null; mudou(); desenhar(); q('#o-busca-cli')?.focus(); });
    const busca = q('#o-busca-cli'), sug = q('#o-sug');
    busca?.addEventListener('input', () => {
      const t = busca.value.trim().toLowerCase(), td = soDigitos(t);
      if (t.length < 2) { sug.hidden = true; return; }
      const achados = clientes.filter(c => !c.arquivado && (c.nome.toLowerCase().includes(t) || (td.length >= 2 && soDigitos(c.whatsapp).includes(td)))).slice(0, 8);
      sug.innerHTML = achados.length ? achados.map(c => `<li><button type="button" data-cli="${c.id}"><b>${esc(c.nome)}</b> <span class="sub">${esc(c.whatsapp)}</span></button></li>`).join('')
        : `<li><button type="button" data-novo-cli>Cadastrar "${esc(busca.value.trim())}"</button></li>`;
      sug.hidden = false;
    });
    sug?.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.cli) { cliente = clientes.find(c => c.id === b.dataset.cli); ficha.cliente_id = cliente.id; mudou(); desenhar(); }
      else novoCliente(busca.value.trim());
    });
    q('#o-novo-cli')?.addEventListener('click', () => novoCliente(''));

    // itens
    q('#o-add').addEventListener('click', async () => {
      let r = await editorItem(produtos, null);
      // "Criar produto novo" dentro da lista: cadastra e já volta configurando o item
      while (r?.criarProduto) {
        const reg = await new Promise(res => formExtra(null, s => res(s), { aoCancelar: () => res(null) }));
        if (!reg) { r = await editorItem(produtos, null); continue; }
        const novo = extraParaProduto(reg);
        produtos.push(novo);
        r = await editorItem(produtos, null, novo);
      }
      if (r) { ficha.itens.push(r); mudou(); desenhar(); }
    });
    q('#o-itens').addEventListener('click', async e => {
      const ed = e.target.closest('[data-editar]'), rm = e.target.closest('[data-remover]');
      if (ed) { const i = +ed.dataset.editar; const it = await editorItem(produtos, ficha.itens[i]); if (it) { ficha.itens[i] = it; mudou(); desenhar(); } }
      if (rm) { ficha.itens.splice(+rm.dataset.remover, 1); mudou(); desenhar(); }
    });

    // desconto, prazo, observações
    q('#o-desc-tipo').addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      ficha.desconto = { ...ficha.desconto, tipo: b.dataset.t };
      el.querySelectorAll('#o-desc-tipo [data-t]').forEach(x => x.setAttribute('aria-pressed', x === b));
      mudou(); atualizarTotais();
    });
    q('#o-desc').addEventListener('input', e => { ficha.desconto = { ...ficha.desconto, valor: lerNumero(e.target.value) || 0 }; mudou(); atualizarTotais(); });
    q('#o-prazo').addEventListener('change', e => { ficha.prazo = e.target.value; prazoManual = true; mudou(); });
    q('#o-obs').addEventListener('input', e => { ficha.observacoes = e.target.value; mudou(); });

    // ações
    q('#o-salvar').addEventListener('click', () => gravar());
    q('#o-aba').addEventListener('click', abrirEmOutraAba);
    q('#o-wpp')?.addEventListener('click', async e => {
      e.preventDefault();
      if (!salvo && !(await gravar({ silencioso: true }))) return;
      window.open(linkWa(cliente.whatsapp, mensagem('orcamento', { ficha, cliente, cfg })), '_blank', 'noopener');
    });
    q('#o-pdf')?.addEventListener('click', async e => {
      if (!salvo && !(await gravar({ silencioso: true }))) return;
      e.target.disabled = true;
      try { await pdfOrcamento(ficha, cliente, cfg); } catch (err) { avisar(err.message, 'erro'); }
      e.target.disabled = false;
    });
    q('#o-virar')?.addEventListener('click', async () => {
      if (!salvo && !(await gravar({ silencioso: true }))) return;
      virarPedido();
    });
  }

  function novoCliente(nome) {
    formClienteRapido(c => { clientes.push(c); cliente = c; ficha.cliente_id = c.id; mudou(); desenhar(); });
    const inp = document.querySelector('#f-cli [name=nome]'); if (inp && nome) inp.value = nome;
  }

  function abrirEmOutraAba() {
    const base = location.href.split('#')[0];
    let destino;
    if (ficha.id && salvo) destino = `#orcamento/${ficha.id}`;
    else {
      const chave = chaveRascunho || crypto.randomUUID().slice(0, 8);
      try { localStorage.setItem(RASCUNHO + chave, JSON.stringify({ ficha: { ...ficha, cliente_id: cliente?.id ?? ficha.cliente_id ?? null }, virarAoSalvar, prazoManual, quando: Date.now() })); }
      catch { avisar('Sem espaço no aparelho para guardar o rascunho', 'erro'); return; }
      destino = `#orcamento/rascunho:${chave}`;
    }
    const aba = window.open(base + destino, '_blank');
    if (!aba) { avisar('O navegador bloqueou a aba nova. Permita pop-ups para o hub e tente de novo.', 'erro'); return; }
    salvo = true; apagarAuto();   // a outra aba ficou com o orçamento; esta pode sair sem perder nada
    avisar('Orçamento aberto em outra aba');
    ir('inicio');
  }

  async function gravar({ silencioso = false, base = ficha.atualizado_em } = {}) {
    if (!cliente) { avisar('Escolha o cliente', 'erro'); return false; }
    if (!ficha.itens.length) { avisar('Adicione ao menos um item', 'erro'); return false; }
    for (const it of ficha.itens) { const e = validarItem(it); if (e) { avisar(`${it.nome}: ${e}`, 'erro'); return false; } }
    const total = calcularFicha(ficha.itens, ficha.desconto).total;
    const reg = { ...(ficha.id ? { id: ficha.id } : {}), cliente_id: cliente.id, itens: ficha.itens, desconto: ficha.desconto,
      total_centavos: total, etapa: 'orcamento', prazo: ficha.prazo || null, observacoes: ficha.observacoes || '' };
    const btn = el.querySelector('#o-salvar'); if (btn) btn.disabled = true;
    try {
      const r = await salvar('fichas', reg, base);
      apagarAuto();
      ficha = { ...ficha, ...reg, ...r };
      apagarAuto();
      salvo = true; prazoManual = true;
      if (chaveRascunho) { try { localStorage.removeItem(RASCUNHO + chaveRascunho); } catch {} chaveRascunho = null; rascunho = null; }
      history.replaceState(null, '', `#orcamento/${ficha.id}`);
      titulo(`Orçamento nº ${ficha.numero ?? 'novo'}`);
      if (!silencioso) avisar(r._pendente ? 'Salvo no aparelho — envia quando a internet voltar' : 'Orçamento salvo');
      desenhar();
      if (virarAoSalvar) { virarAoSalvar = false; virarPedido(); }
      return true;
    } catch (err) {
      if (btn) btn.disabled = false;
      if (err instanceof ConflitoError) {
        const v = await escolherVersao({ ...ficha, ...reg }, err.remoto);
        if (v === 'meu') return gravar({ silencioso, base: err.remoto.atualizado_em });
        if (err.remoto.etapa !== 'orcamento') { ir('pedido', ficha.id); return false; }
        ficha = err.remoto; cliente = clientes.find(c => c.id === ficha.cliente_id) || cliente; salvo = true; desenhar();
        return false;
      }
      avisar(err.message, 'erro');
      return false;
    }
  }

  function virarPedido() {
    const caixa = abrirModal(`
      <h2>Virar pedido</h2>
      <p>O cliente pagou sinal?</p>
      <div class="botoes">
        <button class="btn" data-r="nao">Não, ir para Arte</button>
        <button class="btn btn-primario" data-r="sim">Sim, registrar sinal</button>
      </div>`);
    caixa.addEventListener('click', async e => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      fecharModal();
      try {
        if (b.dataset.r === 'sim') {
          const ok = await registrarPagamento({ ...ficha, etapa: 'pedido-novo' }, { tipo: 'sinal' });
          if (!ok) return;
          await atualizar('fichas', ficha.id, { etapa: 'sinal' });
        } else {
          await atualizar('fichas', ficha.id, { etapa: 'arte' });
        }
        avisar('Virou pedido');
        ir('pedido', ficha.id);
      } catch (err) { avisar(err.message, 'erro'); }
    });
  }

  desenhar();
}

// ---------- editor de item ----------
function produtoDoItem(it) {
  return { id: it.produto_id, nome: it.nome, tipo: it.tipo, opcoes: it.opcoes || (it.opcao ? [it.opcao] : []), preco: it.preco,
    m2_livre: it.m2_livre, minimo: it.minimo, minimo_por: it.minimo_por, acabamentos: it.acabamentos_produto || it.acabamentos || [],
    prazo_dias: it.prazo_dias };
}

export function editorItem(produtos, existente, preProd = null) {
  return new Promise(resolve => {
    let pronto = null;
    let prod = existente ? produtoDoItem(existente) : preProd;
    const caixa = abrirModal('<div id="ei"></div>', { fechar: () => resolve(pronto) });
    const raiz = caixa.querySelector('#ei');

    const escolher = () => {
      let cat = '';
      raiz.innerHTML = `
        <div class="modal-topo"><h2>Escolha o produto</h2><button class="icone-btn" data-fechar aria-label="Fechar">${ICONE.fechar}</button></div>
        <label class="campo"><span>Buscar</span><input id="ei-busca" type="search" autocomplete="off" placeholder="banner, cartão, caneca…"></label>
        <div class="abas" id="ei-cats" style="margin-top:12px"><button type="button" data-cat="" aria-pressed="true">Todos</button>
          ${Object.entries(NOMES_CATEGORIA).sort(([a], [b]) => (b === 'extras') - (a === 'extras')).filter(([k]) => produtos.some(p => p.categoria === k)).map(([k, v]) => `<button type="button" data-cat="${k}" aria-pressed="false">${esc(v)}</button>`).join('')}</div>
        <ul class="lista" id="ei-lista" style="margin-top:12px"></ul>
        <button type="button" class="btn btn-bloco" id="ei-criar" style="margin-top:12px">${ICONE.mais.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"')}Criar produto novo</button>`;
      raiz.querySelector('#ei-criar').addEventListener('click', () => { pronto = { criarProduto: true }; fecharModal(); });
      raiz.querySelector('[data-fechar]').addEventListener('click', () => fecharModal());
      const desenhar = () => {
        const t = raiz.querySelector('#ei-busca').value.trim().toLowerCase();
        const termos = t.split(/\s+/).filter(Boolean);
        // os produtos criados no hub vêm primeiro (antes ficavam cortados no fim da lista)
        const vis = produtos.filter(p => (!cat || p.categoria === cat) && termos.every(w => p.nome.toLowerCase().includes(w)))
          .sort((a, b) => (b.origem === 'hub') - (a.origem === 'hub')).slice(0, 80);
        raiz.querySelector('#ei-lista').innerHTML = vis.length ? vis.map(p => `<li><button class="lista-item" data-p="${esc(p.id)}">
          <span class="meio"><span class="nome">${esc(p.nome)}</span><span class="det">${esc(NOMES_CATEGORIA[p.categoria] || '')}</span></span>
          <span class="fim valor" style="font-size:14px">${esc(aPartirDe(p))}</span></button></li>`).join('')
          : '<li><p class="vazio">Nenhum produto encontrado. Use "Criar produto novo" aqui embaixo.</p></li>';
      };
      desenhar();
      raiz.querySelector('#ei-busca').addEventListener('input', desenhar);
      raiz.querySelector('#ei-cats').addEventListener('click', e => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        cat = b.dataset.cat; raiz.querySelectorAll('#ei-cats button').forEach(x => x.setAttribute('aria-pressed', x === b)); desenhar();
      });
      raiz.querySelector('#ei-lista').addEventListener('click', e => {
        const b = e.target.closest('[data-p]'); if (!b) return;
        prod = produtos.find(p => p.id === b.dataset.p); configurar(null);
      });
      if (matchMedia('(min-width: 900px)').matches) raiz.querySelector('#ei-busca').focus();
    };

    const configurar = base => {
      const it = {
        produto_id: prod.id, nome: prod.nome, tipo: prod.tipo, prazo_dias: prod.prazo_dias,
        quantidade: base?.quantidade ?? 1, opcao: base?.opcao ?? (prod.tipo === 'opcoes' && prod.opcoes.length === 1 ? prod.opcoes[0] : null),
        opcoes: prod.opcoes, livre: base?.livre ?? false, largura_cm: base?.largura_cm ?? '', altura_cm: base?.altura_cm ?? '',
        preco: prod.preco, m2_livre: prod.m2_livre, minimo: prod.minimo, minimo_por: prod.minimo_por,
        acabamentos_produto: prod.acabamentos, acabamentos: base?.acabamentos ?? [], descricao: base?.descricao ?? '',
        valor_manual: base?.valor_manual ?? null,
        ...(prod.detalhes?.complemento ? { complemento: prod.detalhes.complemento } : base?.complemento ? { complemento: base.complemento } : {})
      };
      const porUn = it.tipo === 'opcoes' && it.opcoes.some(o => /\bun\.?\s*$/i.test(o.label));
      const outra = it.opcao?.manual ? it.opcao : null;
      const qOutra = outra && porUn ? (String(outra.label).match(/\d+/) || [''])[0] : '';
      const medida = () => it.tipo === 'm2' || it.livre;
      raiz.innerHTML = `
        <div class="modal-topo"><h2>${esc(prod.nome)}</h2><button class="icone-btn" data-fechar aria-label="Fechar">${ICONE.fechar}</button></div>
        ${existente ? '' : '<button type="button" class="btn btn-peq" id="ei-trocar">← Trocar produto</button>'}
        ${it.tipo === 'opcoes' ? `
          <div class="campo"><span>Opção</span>
            <ul class="lista" id="ei-opcoes">
              ${it.opcoes.map((o, i) => `<li><label class="lista-item" style="min-height:52px"><input type="radio" name="ei-op" value="${i}" ${!it.livre && it.opcao && o.label === it.opcao.label ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--laranja)">
                <span class="meio">${esc(o.label)}</span><span class="valor">${moeda(emCentavos(o.preco))}</span></label></li>`).join('')}
              <li><label class="lista-item" style="min-height:52px"><input type="radio" name="ei-op" value="outra" ${outra ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--laranja)">
                <span class="meio">${porUn ? 'Outra quantidade' : 'Outra opção'}<span class="det" style="display:block">digite ${porUn ? 'a quantidade' : 'o nome'} e o valor</span></span></label></li>
              <li id="ei-outra" ${outra ? '' : 'hidden'} class="ei-outra"><div class="grade-2">
                ${porUn ? `<label class="campo"><span>Quantidade (un.)</span><input id="ei-o-q" inputmode="numeric" value="${esc(qOutra)}" placeholder="ex.: 2000"></label>`
                        : `<label class="campo"><span>Nome da opção</span><input id="ei-o-n" value="${esc(outra?.label || '')}" placeholder="ex.: A3"></label>`}
                <label class="campo"><span>Valor R$</span><input id="ei-o-v" inputmode="decimal" value="${outra ? esc(num(outra.preco)) : ''}" placeholder="ex.: 180,00"></label></div></li>
              ${it.m2_livre ? `<li><label class="lista-item" style="min-height:52px"><input type="radio" name="ei-op" value="livre" ${it.livre ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--laranja)">
                <span class="meio">Outro tamanho<span class="det" style="display:block">${moeda(emCentavos(it.m2_livre))} o m²${it.minimo ? ` · mínimo ${moeda(emCentavos(it.minimo))} por peça` : ''}</span></span></label></li>` : ''}
            </ul></div>` : ''}
        <div class="grade-2" id="ei-medidas" ${medida() ? '' : 'hidden'}>
          <label class="campo"><span>Largura (cm)</span><input id="ei-l" inputmode="decimal" value="${esc(num(it.largura_cm))}"></label>
          <label class="campo"><span>Altura (cm)</span><input id="ei-a" inputmode="decimal" value="${esc(num(it.altura_cm))}"></label>
        </div>
        ${it.tipo === 'm2' ? `<p class="sub">${moeda(emCentavos(it.preco))} o m²${it.minimo ? ` · mínimo ${moeda(emCentavos(it.minimo))}${it.minimo_por === 'peca' ? ' por peça' : ' no total'}` : ''}</p>` : ''}
        ${it.tipo === 'unidade' ? `<p class="sub">${moeda(emCentavos(it.preco))} cada</p>` : ''}
        <div class="campo"><span>Quantidade${it.tipo === 'opcoes' && !it.livre && /\bun\./.test(it.opcao?.label || it.opcoes[0]?.label || '') ? ' (de pacotes)' : ''}</span>
          <div class="campo-linha" style="align-items:center">
            <button type="button" class="icone-btn" id="ei-menos" aria-label="Menos">−</button>
            <input id="ei-q" inputmode="numeric" value="${esc(it.quantidade)}" style="text-align:center;min-height:44px;width:100%;border:1px solid var(--linha);border-radius:var(--raio-p);background:var(--campo);font-size:18px">
            <button type="button" class="icone-btn" id="ei-mais" aria-label="Mais">+</button></div></div>
        ${it.acabamentos_produto.length ? `<div class="campo"><span>Acabamentos</span>${it.acabamentos_produto.map((a, i) => `
          <label class="check"><input type="checkbox" data-acab="${i}" ${it.acabamentos.some(x => x.nome === a.nome) ? 'checked' : ''}>
          ${esc(a.nome)} <span class="sub">+${moeda(emCentavos(a.valor))} ${a.cobranca === 'unidade' ? 'cada' : a.cobranca === 'm2' ? 'o m²' : ''}</span></label>`).join('')}</div>` : ''}
        <label class="campo"><span>Descrição (opcional)</span><input id="ei-desc" value="${esc(it.descricao)}" placeholder="ex.: logo frente, fundo azul" autocomplete="off"></label>
        <div class="cartao rodape-fixo" style="display:flex;align-items:center;gap:12px">
          <div style="flex:1;min-width:0"><label class="sub" for="ei-valor">Valor do item <span id="ei-calc"></span></label>
            <input id="ei-valor" class="ei-valor" inputmode="decimal" aria-describedby="ei-calc" placeholder="—">
            <span class="selo alerta" id="ei-min" hidden>valor mínimo aplicado</span></div>
          <button class="btn btn-primario" id="ei-ok">${existente ? 'Salvar item' : 'Adicionar'}</button>
        </div>`;
      raiz.querySelector('[data-fechar]').addEventListener('click', () => fecharModal());
      raiz.querySelector('#ei-trocar')?.addEventListener('click', escolher);

      const ler = () => {
        it.quantidade = Math.max(0, Math.floor(lerNumero(raiz.querySelector('#ei-q').value) || 0));
        it.largura_cm = lerNumero(raiz.querySelector('#ei-l').value) || 0;
        it.altura_cm = lerNumero(raiz.querySelector('#ei-a').value) || 0;
        it.descricao = raiz.querySelector('#ei-desc').value.trim();
        it.acabamentos = [...raiz.querySelectorAll('[data-acab]')].filter(c => c.checked).map(c => it.acabamentos_produto[+c.dataset.acab]);
        const op = raiz.querySelector('[name=ei-op]:checked');
        if (op) {
          it.livre = op.value === 'livre';
          raiz.querySelector('#ei-outra').hidden = op.value !== 'outra';
          if (op.value === 'outra') {
            const q = parseInt((raiz.querySelector('#ei-o-q')?.value || '').replace(/\D/g, ''), 10);
            const nomeOp = porUn ? (q > 0 ? `${q} un.` : '') : (raiz.querySelector('#ei-o-n')?.value || '').trim();
            it.opcao = { label: nomeOp, preco: lerNumero(raiz.querySelector('#ei-o-v').value) || 0, manual: true };
          } else it.opcao = it.livre ? null : it.opcoes[+op.value];
        }
        raiz.querySelector('#ei-medidas').hidden = !medida();
        let erro = validarItem(it);
        if (!erro && it.opcao?.manual && !it.opcao.label) erro = porUn ? 'Digite a quantidade' : 'Digite o nome da opção';
        const v = raiz.querySelector('#ei-valor'), dica = raiz.querySelector('#ei-calc');
        if (erro) { if (document.activeElement !== v) v.value = ''; v.title = erro; dica.textContent = ''; raiz.querySelector('#ei-min').hidden = true; return erro; }
        const r = calcularItem(it);
        if (document.activeElement !== v) v.value = (r.centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        dica.innerHTML = r.centavos !== r.calculado ? `· ajustado (calculado ${moeda(r.calculado)}) <button type="button" class="link" id="ei-volta">voltar</button>` : '';
        raiz.querySelector('#ei-min').hidden = !(it.minimo > 0 && it.valor_manual == null && calcularItem({ ...it, minimo: 0 }).centavos !== r.centavos);
        return null;
      };
      // mudou quantidade/opção: o valor volta a ser o calculado
      raiz.addEventListener('input', e => { if (e.target.id !== 'ei-valor' && e.target.id !== 'ei-desc') it.valor_manual = null; ler(); });
      raiz.addEventListener('change', e => { if (e.target.id === 'ei-valor') return; if (e.target.id !== 'ei-desc') it.valor_manual = null; ler(); });
      const valorCampo = raiz.querySelector('#ei-valor');
      valorCampo.addEventListener('focus', () => valorCampo.select());
      valorCampo.addEventListener('change', () => {
        const x = lerNumero(valorCampo.value);
        const calc = calcularItem({ ...it, valor_manual: null }).centavos;
        it.valor_manual = Number.isFinite(x) && x >= 0 && emCentavos(x) !== calc ? x : null;
        valorCampo.blur(); ler();
      });
      valorCampo.addEventListener('keydown', e => { if (e.key === 'Enter') valorCampo.blur(); });
      raiz.addEventListener('click', e => { if (e.target.id === 'ei-volta') { it.valor_manual = null; ler(); } });
      raiz.querySelector('#ei-menos').addEventListener('click', () => { const q = raiz.querySelector('#ei-q'); q.value = Math.max(1, (parseInt(q.value, 10) || 1) - 1); it.valor_manual = null; ler(); });
      raiz.querySelector('#ei-mais').addEventListener('click', () => { const q = raiz.querySelector('#ei-q'); q.value = (parseInt(q.value, 10) || 0) + 1; it.valor_manual = null; ler(); });
      raiz.querySelector('#ei-ok').addEventListener('click', () => {
        const erro = ler();
        if (erro) { avisar(erro, 'erro'); return; }
        if (!medida()) { it.largura_cm = 0; it.altura_cm = 0; }
        pronto = { ...it };
        fecharModal();
      });
      ler();
    };

    if (prod) configurar(existente); else escolher();
  });
}
