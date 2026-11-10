// Balcão: vendas rápidas de impressão/cópia, sem cliente. Toque nos botões, ajuste o total se der desconto e registre.
import { listar, salvar, excluir } from '../db.js';
import { moeda, lerNumero, hojeISO } from '../formato.js';
import { esc, avisar, titulo, confirmar, abrirModal, fecharModal, ICONE } from '../ui.js';
import { emCentavos } from '../calc.js';
import { carregarCfg, salvarCampoCfg } from './configuracoes.js';
import { NOMES_FORMA } from './receber.js';

// Botões de exemplo: o Johen ajusta nomes e preços em "Editar botões".
export const SERVICOS_PADRAO = [
  { nome: 'Impressão P&B', preco: 1 },
  { nome: 'Impressão colorida', preco: 2 },
  { nome: 'Xerox P&B', preco: 0.5 },
  { nome: 'Xerox colorida', preco: 2 },
  { nome: 'Frente e verso P&B', preco: 1.5 },
  { nome: 'Foto 10×15', preco: 3 },
  { nome: 'Digitalização', preco: 2 },
  { nome: 'Plastificação', preco: 5 }
];

let carrinho = [];          // [{ nome, preco, qtd }]
let totalManual = null;     // centavos digitados pelo Johen (desconto); null = automático
let forma = 'pix';

const subtotal = () => carrinho.reduce((s, x) => s + emCentavos(x.preco * x.qtd), 0);
const precoTxt = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function montar(el, _p, vivo, { painel = false, aoRegistrar } = {}) {
  if (!painel) titulo('Balcão');
  const cfg = await carregarCfg();
  if (!vivo()) return;
  let servicos = Array.isArray(cfg.balcao) && cfg.balcao.length ? cfg.balcao : SERVICOS_PADRAO;

  el.innerHTML = `
    <div class="cabeca">${painel ? '<span style="flex:1"></span>' : '<h2>Balcão</h2>'}<button class="btn btn-peq" id="b-editar">${ICONE.editar.replace('<svg', '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"')} Editar botões</button></div>
    <p class="sub">Impressões e cópias rápidas, sem cliente. Toque para somar; toque e segure para tirar um.</p>
    <div class="bal-grade" id="b-grade"></div>
    <section class="cartao bal-caixa" id="b-caixa"></section>
    <section class="cartao"><div class="cabeca"><h3 style="flex:1">Vendas de hoje</h3><span class="valor" id="b-hoje-total"></span></div><div id="b-hoje"><p class="sub">Carregando…</p></div></section>`;

  const grade = el.querySelector('#b-grade');
  const caixa = el.querySelector('#b-caixa');

  function desenharGrade() {
    grade.innerHTML = servicos.map((s, i) => {
      const q = carrinho.find(x => x.nome === s.nome)?.qtd || 0;
      return `<button type="button" class="bal-btn${q ? ' tem' : ''}" data-s="${i}" aria-label="${esc(s.nome)}, ${esc(precoTxt(s.preco))}${q ? `, ${q} no caixa` : ''}">
        <span class="bal-nome">${esc(s.nome)}</span><span class="bal-preco">${esc(precoTxt(s.preco))}</span>${q ? `<span class="bal-qtd">${q}</span>` : ''}</button>`;
    }).join('');
  }

  function desenharCaixa() {
    const sub = subtotal();
    if (totalManual !== null && totalManual > sub) totalManual = null;
    const total = totalManual ?? sub;
    caixa.hidden = !carrinho.length;
    if (!carrinho.length) return;
    caixa.innerHTML = `
      ${carrinho.map((x, i) => `<div class="bal-linha">
        <span class="bal-l-nome">${esc(x.nome)}</span>
        <span class="bal-passo"><button type="button" class="icone-btn" data-menos="${i}" aria-label="Tirar 1 ${esc(x.nome)}">−</button>
        <input class="bal-q" data-q="${i}" inputmode="numeric" value="${x.qtd}" aria-label="Quantidade de ${esc(x.nome)}">
        <button type="button" class="icone-btn" data-mais="${i}" aria-label="Somar 1 ${esc(x.nome)}">+</button></span>
        <span class="valor">${moeda(emCentavos(x.preco * x.qtd))}</span></div>`).join('')}
      ${totalManual !== null ? `<div class="bal-linha bal-desc"><span>Desconto</span><span class="valor">− ${moeda(sub - total)}</span></div>` : ''}
      <label class="campo bal-total"><span>Total cobrado ${totalManual !== null ? '<button type="button" class="link" id="b-volta">voltar ao valor cheio</button>' : '<span class="sub">(toque para dar desconto)</span>'}</span>
        <input id="b-total" inputmode="decimal" value="${(total / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}" aria-label="Total cobrado em reais"></label>
      <div class="segmentado" role="group" aria-label="Forma de pagamento">${Object.entries(NOMES_FORMA).map(([k, v]) => `<button type="button" data-forma="${k}" aria-pressed="${k === forma}">${v}</button>`).join('')}</div>
      <div class="bal-acoes"><button type="button" class="btn" id="b-limpar">Limpar</button>
        <button type="button" class="btn btn-primario" id="b-registrar">Registrar ${moeda(total)}</button></div>`;
  }

  const desenhar = () => { desenharGrade(); desenharCaixa(); };

  function somar(i, n) {
    const s = servicos[i];
    const it = carrinho.find(x => x.nome === s.nome);
    if (it) it.qtd = Math.max(0, it.qtd + n);
    else if (n > 0) carrinho.push({ nome: s.nome, preco: Number(s.preco) || 0, qtd: n });
    carrinho = carrinho.filter(x => x.qtd > 0);
    totalManual = null;
    desenhar();
  }

  // toque soma; toque e segure tira um (sem menu do navegador)
  let segurou = false, timer = null;
  grade.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    segurou = false;
    timer = setTimeout(() => { segurou = true; somar(+b.dataset.s, -1); navigator.vibrate?.(20); }, 550);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => grade.addEventListener(t, () => clearTimeout(timer)));
  grade.addEventListener('contextmenu', e => e.preventDefault());
  grade.addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    if (segurou) { segurou = false; return; }
    somar(+b.dataset.s, 1);
  });

  caixa.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.menos) { carrinho[+b.dataset.menos].qtd--; carrinho = carrinho.filter(x => x.qtd > 0); totalManual = null; desenhar(); }
    else if (b.dataset.mais) { carrinho[+b.dataset.mais].qtd++; totalManual = null; desenhar(); }
    else if (b.dataset.forma) { forma = b.dataset.forma; caixa.querySelectorAll('[data-forma]').forEach(x => x.setAttribute('aria-pressed', x === b)); }
    else if (b.id === 'b-volta') { totalManual = null; desenharCaixa(); }
    else if (b.id === 'b-limpar') { carrinho = []; totalManual = null; desenhar(); }
    else if (b.id === 'b-registrar') registrar(b);
  });
  caixa.addEventListener('change', e => {
    if (e.target.dataset.q !== undefined) {
      const n = Math.floor(lerNumero(e.target.value));
      carrinho[+e.target.dataset.q].qtd = n > 0 ? Math.min(n, 9999) : 0;
      carrinho = carrinho.filter(x => x.qtd > 0); totalManual = null; desenhar();
    } else if (e.target.id === 'b-total') {
      const v = lerNumero(e.target.value);
      const sub = subtotal();
      if (!(v >= 0)) { avisar('Valor inválido', 'erro'); desenharCaixa(); return; }
      const c = emCentavos(v);
      if (c > sub) { avisar('O total não pode passar do valor cheio. Para cobrar mais, aumente a quantidade.', 'erro'); desenharCaixa(); return; }
      totalManual = c === sub ? null : c;
      desenharCaixa();
    }
  });
  caixa.addEventListener('focusin', e => { if (e.target.id === 'b-total' || e.target.dataset.q !== undefined) e.target.select(); });
  caixa.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur(); });

  async function registrar(btn) {
    // aplica um total digitado que ainda não saiu do campo
    const campo = caixa.querySelector('#b-total');
    if (document.activeElement === campo) campo.blur();
    const sub = subtotal(), total = totalManual ?? sub;
    if (!carrinho.length) return;
    btn.disabled = true;
    try {
      await salvar('vendas_balcao', { itens: carrinho.map(x => ({ ...x })), subtotal_centavos: sub, total_centavos: total, forma, vendido_em: hojeISO() });
      avisar(`Venda de ${moeda(total)} registrada (${NOMES_FORMA[forma]})`);
      carrinho = []; totalManual = null;
      desenhar(); carregarHoje();
      aoRegistrar?.();
    } catch (err) { avisar(err.message, 'erro'); btn.disabled = false; }
  }

  async function carregarHoje() {
    const vendas = await listar('vendas_balcao', { eq: { vendido_em: hojeISO() }, order: 'criado_em', desc: true });
    if (!vivo()) return;
    const total = vendas.reduce((s, v) => s + v.total_centavos, 0);
    el.querySelector('#b-hoje-total').textContent = vendas.length ? moeda(total) : '';
    const porForma = Object.entries(NOMES_FORMA).map(([k, n]) => [n, vendas.filter(v => v.forma === k).reduce((s, v) => s + v.total_centavos, 0)]).filter(x => x[1]);
    el.querySelector('#b-hoje').innerHTML = vendas.length ? `
      <p class="sub">${vendas.length} ${vendas.length === 1 ? 'venda' : 'vendas'} · ${porForma.map(([n, v]) => `${n} ${moeda(v)}`).join(' · ')}</p>
      <ul class="lista">${vendas.map(v => `<li class="lista-item bal-venda">
        <span class="meio"><span class="nome">${esc(v.itens.map(i => `${i.qtd}× ${i.nome}`).join(', '))}</span>
        <span class="det">${new Date(v.criado_em || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${esc(NOMES_FORMA[v.forma])}${v.total_centavos < v.subtotal_centavos ? ` · desconto de ${moeda(v.subtotal_centavos - v.total_centavos)}` : ''}${v._pendente ? ' · <span class="selo alerta">pendente de envio</span>' : ''}</span></span>
        <span class="fim valor">${moeda(v.total_centavos)}</span>
        <button class="icone-btn" data-apagar="${v.id}" aria-label="Apagar venda">${ICONE.lixo}</button></li>`).join('')}</ul>`
      : '<p class="sub">Nenhuma venda de balcão hoje.</p>';
  }
  el.querySelector('#b-hoje').addEventListener('click', async e => {
    const b = e.target.closest('[data-apagar]'); if (!b) return;
    if (!await confirmar('Apagar esta venda do balcão?', { ok: 'Apagar', perigo: true })) return;
    try { await excluir('vendas_balcao', b.dataset.apagar); avisar('Venda apagada'); carregarHoje(); } catch (err) { avisar(err.message, 'erro'); }
  });

  el.querySelector('#b-editar').addEventListener('click', () => editarBotoes(servicos, async lista => {
    await salvarCampoCfg('balcao', lista);
    servicos = lista;
    carrinho = carrinho.filter(x => servicos.some(s => s.nome === x.nome));
    desenhar();
  }));

  desenhar();
  carregarHoje().catch(err => { el.querySelector('#b-hoje').innerHTML = `<p class="sub">${esc(err.message)}</p>`; });
}

function editarBotoes(lista, aoSalvar) {
  let itens = lista.map(s => ({ nome: s.nome, preco: s.preco }));
  const caixa = abrirModal('<div id="be"></div>');
  const area = caixa.querySelector('#be');
  const desenhar = () => {
    area.innerHTML = `
      <div class="modal-topo"><h2>Botões do balcão</h2><button class="icone-btn" data-fechar-be aria-label="Fechar">${ICONE.fechar}</button></div>
      <p class="sub">Nome curto e preço por unidade (por folha, cópia ou foto). Arraste pelo <b>⠿</b> para mudar a ordem.</p>
      <div class="be-lista">${itens.map((s, i) => `<div class="campo-linha be-item" data-pos="${i}">
        <button class="be-alca" type="button" data-alca="${i}" aria-label="Arrastar ${esc(s.nome || 'botão')} (ou use as setas para cima e para baixo)">⠿</button>
        <label class="campo" style="flex:2"><span>Serviço</span><input data-i="${i}" data-c="nome" value="${esc(s.nome)}" maxlength="28"></label>
        <label class="campo" style="flex:1"><span>Preço (R$)</span><input data-i="${i}" data-c="preco" inputmode="decimal" value="${esc(Number(s.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))}"></label>
        <button class="icone-btn" type="button" data-rem="${i}" aria-label="Apagar botão">${ICONE.lixo}</button></div>`).join('')}</div>
      <div class="botoes"><button class="btn" type="button" id="be-novo">+ Novo botão</button></div>
      <button class="btn btn-primario btn-bloco rodape-fixo" type="button" id="be-salvar">Salvar botões</button>`;
    area.querySelector('[data-fechar-be]').addEventListener('click', () => fecharModal());
    area.querySelectorAll('[data-c]').forEach(c => c.addEventListener('input', () => { itens[c.dataset.i][c.dataset.c] = c.value; }));
    area.querySelectorAll('[data-rem]').forEach(b => b.addEventListener('click', () => { itens.splice(+b.dataset.rem, 1); desenhar(); }));
    area.querySelector('#be-novo').addEventListener('click', () => { itens.push({ nome: '', preco: '' }); desenhar(); area.querySelectorAll('.be-item input')[itens.length * 2 - 2]?.focus(); });
    ligarArrastar();
    area.querySelector('#be-salvar').addEventListener('click', async e => {
      const limpos = [];
      for (const s of itens) {
        const nome = String(s.nome || '').trim(), preco = typeof s.preco === 'number' ? s.preco : lerNumero(s.preco);
        if (!nome && !String(s.preco ?? '').trim()) continue;
        if (!nome) return avisar('Dê um nome para cada botão', 'erro');
        if (!(preco >= 0)) return avisar(`Preço inválido em "${nome}"`, 'erro');
        if (limpos.some(x => x.nome.toLowerCase() === nome.toLowerCase())) return avisar(`"${nome}" está repetido`, 'erro');
        limpos.push({ nome, preco: Math.round(preco * 100) / 100 });
      }
      if (!limpos.length) return avisar('Deixe pelo menos um botão', 'erro');
      e.target.disabled = true;
      try { await aoSalvar(limpos); fecharModal(); avisar('Botões salvos'); }
      catch (err) { avisar(err.message, 'erro'); e.target.disabled = false; }
    });
  };
  // arrastar pela alça (toque ou mouse); setas do teclado também mudam a ordem
  function ligarArrastar() {
    const lista = area.querySelector('.be-lista');
    const mover = (de, para) => {
      if (para < 0 || para >= itens.length || de === para) return;
      const [x] = itens.splice(de, 1); itens.splice(para, 0, x);
      desenhar(); area.querySelector(`[data-alca="${para}"]`)?.focus();
    };
    lista.querySelectorAll('[data-alca]').forEach(h => {
      h.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp') { e.preventDefault(); mover(+h.dataset.alca, +h.dataset.alca - 1); }
        if (e.key === 'ArrowDown') { e.preventDefault(); mover(+h.dataset.alca, +h.dataset.alca + 1); }
      });
      h.addEventListener('pointerdown', e => {
        e.preventDefault();
        const linha = h.closest('.be-item');
        const origem = +h.dataset.alca;
        const inicioY = e.clientY;
        let alvo = origem;
        const linhas = [...lista.querySelectorAll('.be-item')];
        const alturas = linhas.map(l => l.getBoundingClientRect());
        linha.classList.add('arrastando');
        h.setPointerCapture(e.pointerId);
        const aoMover = ev => {
          const dy = ev.clientY - inicioY;
          linha.style.transform = `translateY(${dy}px)`;
          const meio = alturas[origem].top + alturas[origem].height / 2 + dy;
          alvo = alturas.reduce((m, r, k) => (meio > r.top + r.height / 2 ? k : m), 0);
          if (meio < alturas[0].top + alturas[0].height / 2) alvo = 0;
          linhas.forEach((l, k) => {
            if (k === origem) return;
            const desloc = alturas[origem].height + 10;
            l.style.transform = k > origem && k <= alvo ? `translateY(-${desloc}px)` : k < origem && k >= alvo ? `translateY(${desloc}px)` : '';
          });
          // rola a janela quando chega perto da borda
          const caixa = area.closest('.modal-caixa');
          if (caixa) { const r = caixa.getBoundingClientRect(); if (ev.clientY < r.top + 60) caixa.scrollTop -= 8; else if (ev.clientY > r.bottom - 60) caixa.scrollTop += 8; }
        };
        const soltar = () => {
          h.removeEventListener('pointermove', aoMover);
          linhas.forEach(l => { l.style.transform = ''; });
          linha.classList.remove('arrastando');
          if (alvo !== origem) mover(origem, alvo);
        };
        h.addEventListener('pointermove', aoMover);
        h.addEventListener('pointerup', soltar, { once: true });
        h.addEventListener('pointercancel', soltar, { once: true });
      });
    });
  }
  desenhar();
}
