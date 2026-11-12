// Histórico: todo dinheiro que entrou (sinal, pagamento e balcão), um por linha, cada um editável. A soma fica no rodapé.
import { listar, atualizar, excluir } from '../db.js';
import { saldoAberto, validarPagamento, emCentavos } from '../calc.js';
import { moeda, data, hojeISO, lerNumero } from '../formato.js';
import { esc, titulo, avisar, confirmar, abrirModal, fecharModal, ICONE } from '../ui.js';
import { montarRegistros, filtrarRegistros, somarRegistros } from '../registros.js';
import { NOMES_FORMA } from './receber.js';

const TIPOS = [['todos', 'Tudo'], ['sinal', 'Sinais'], ['pagamento', 'Pagamentos'], ['balcao', 'Balcão']];
const FORMAS = [['todas', 'Todas'], ...Object.entries(NOMES_FORMA)];
const PERIODOS = [['0', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['tudo', 'Tudo']];
const NOME_TIPO = { sinal: 'Sinal', pagamento: 'Pagamento', balcao: 'Balcão' };
const filtro = { tipo: 'todos', forma: 'todas', periodo: '30', busca: '' };   // fica lembrado enquanto o app está aberto

const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const nomeDia = dia => dia === hojeISO() ? 'Hoje' : dia === somaDias(hojeISO(), -1) ? 'Ontem' : data(dia);
const reais = c => (c / 100).toFixed(2).replace('.', ',');

export async function montar(el, _p, vivo) {
  titulo('Histórico');
  let fichas, pagamentos, vendas, clientes, todos;
  async function carregar() {
    [fichas, pagamentos, vendas, clientes] = await Promise.all([
      listar('fichas'), listar('pagamentos'), listar('vendas_balcao').catch(() => []), listar('clientes')]);
    todos = montarRegistros({ fichas, pagamentos, vendas, clientes });
  }
  await carregar();
  if (!vivo()) return;

  const chips = (id, opcoes, atual) => `<div class="segmentado" id="${id}" role="group">${opcoes.map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${k === atual}">${n}</button>`).join('')}</div>`;
  el.innerHTML = `
    <div class="cabeca"><h2>Histórico</h2></div>
    <p class="sub" style="margin-top:4px">Tudo que foi pago: sinais, pagamentos de pedidos e vendas do balcão. Toque numa linha para corrigir.</p>
    <label class="campo"><span>Buscar cliente, produto ou nº do pedido</span><input id="h-busca" type="search" autocomplete="off" value="${esc(filtro.busca)}"></label>
    <div style="display:grid;gap:8px;margin-top:12px">
      ${chips('h-per', PERIODOS, filtro.periodo)}
      ${chips('h-tipo', TIPOS, filtro.tipo)}
      ${chips('h-forma', FORMAS, filtro.forma)}
    </div>
    <div id="h-lista"></div>
    <div class="h-soma cartao" id="h-soma" aria-live="polite"></div>`;

  const desenhar = () => {
    const desde = filtro.periodo === 'tudo' ? null : somaDias(hojeISO(), -Number(filtro.periodo));
    const vis = filtrarRegistros(todos, { ...filtro, desde });
    const s = somarRegistros(vis);
    el.querySelector('#h-soma').innerHTML = `
      <div class="h-soma-linha"><span>Total <small class="sub">· ${s.quantidade} ${s.quantidade === 1 ? 'entrada' : 'entradas'}</small></span><b class="valor" id="h-total">${moeda(s.total)}</b></div>
      ${s.quantidade ? `<div class="sub h-soma-formas">${Object.entries(NOMES_FORMA).filter(([k]) => s.porForma[k]).map(([k, n]) => `${n} ${moeda(s.porForma[k])}`).join(' · ')}</div>` : ''}`;

    if (!vis.length) { el.querySelector('#h-lista').innerHTML = `<p class="vazio">${todos.length ? 'Nada encontrado com esses filtros.' : 'Nenhum pagamento registrado ainda.'}</p>`; return; }
    const grupos = new Map();
    for (const r of vis) { if (!grupos.has(r.dia)) grupos.set(r.dia, []); grupos.get(r.dia).push(r); }
    el.querySelector('#h-lista').innerHTML = [...grupos].map(([dia, rs]) => `
      <p class="grupo-titulo" style="display:flex;justify-content:space-between"><span>${esc(nomeDia(dia))}</span><span>${moeda(somarRegistros(rs).total)}</span></p>
      <ul class="lista">${rs.map(r => {
        const quem = r.tipo === 'balcao' ? 'Balcão' : `Pedido nº ${esc(r.numero ?? '?')} · ${esc(r.cliente)}`;
        const det = [r.tipo !== 'balcao' && NOME_TIPO[r.tipo], NOMES_FORMA[r.forma] || r.forma, r.resumo].filter(Boolean).map(esc).join(' · ');
        return `<li><button type="button" class="lista-item" data-reg="${r.tabela}:${r.id}">
          <span class="meio"><span class="nome" style="display:block">${quem}</span><span class="det" style="display:block">${det}${r.pendente ? ' · <span class="selo alerta">pendente de envio</span>' : ''}</span></span>
          <span class="fim valor" style="font-weight:700">${moeda(r.valor)}</span></button></li>`;
      }).join('')}</ul>`).join('');
  };

  // ---------- editar uma entrada ----------
  function editar(r) {
    const ehPag = r.tabela === 'pagamentos';
    const f = ehPag ? fichas.find(x => x.id === r.fichaId) : null;
    // quanto este pagamento pode valer no máximo: o que falta no pedido + o valor dele mesmo
    const limite = ehPag && f ? saldoAberto(f.total_centavos, pagamentos.filter(p => p.ficha_id === f.id && p.id !== r.id)) : Infinity;
    let forma = r.forma, tipo = r.tipo;
    const caixa = abrirModal(`
      <div class="modal-topo"><h2>${ehPag ? `${NOME_TIPO[r.tipo]} · Pedido nº ${esc(r.numero ?? '?')}` : 'Venda do balcão'}</h2><button class="icone-btn" data-fechar aria-label="Fechar">${ICONE.fechar}</button></div>
      <p class="sub">${esc(r.cliente)}${r.resumo ? ' · ' + esc(r.resumo) : ''}</p>
      <form id="f-reg">
        <label class="campo"><span>Valor R$</span><input name="valor" inputmode="decimal" value="${reais(r.valor)}" required></label>
        ${ehPag && f ? `<p class="sub" style="margin:6px 0 0;font-size:13px">Pedido de ${moeda(f.total_centavos)} · pode ser no máximo ${moeda(limite)}</p>` : ''}
        <div class="campo" style="margin-top:12px"><span>Forma</span><div class="segmentado" id="er-forma">
          ${Object.entries(NOMES_FORMA).map(([k, v]) => `<button type="button" data-forma="${k}" aria-pressed="${k === forma}">${v}</button>`).join('')}</div></div>
        ${ehPag ? `<div class="campo" style="margin-top:12px"><span>Tipo</span><div class="segmentado" id="er-tipo">
          <button type="button" data-tipo="sinal" aria-pressed="${tipo === 'sinal'}">Sinal</button>
          <button type="button" data-tipo="pagamento" aria-pressed="${tipo === 'pagamento'}">Pagamento</button></div></div>` : ''}
        <label class="campo" style="margin-top:12px"><span>Data</span><input name="dia" type="date" value="${esc(r.dia)}" required></label>
        <div class="botoes" style="margin-top:16px"><button type="button" class="btn btn-perigo" id="er-excluir">Excluir</button><button class="btn btn-primario" type="submit">Salvar</button></div>
        ${ehPag && r.fichaId && !r.excluida ? `<a class="btn btn-bloco" style="margin-top:8px" href="#pedido/${r.fichaId}">Abrir o pedido</a>` : ''}
      </form>`);
    const marcar = (sel, attr, valor) => caixa.querySelectorAll(`${sel} [${attr}]`).forEach(x => x.setAttribute('aria-pressed', x.getAttribute(attr) === valor));
    caixa.querySelector('#er-forma').addEventListener('click', e => { const b = e.target.closest('[data-forma]'); if (!b) return; forma = b.dataset.forma; marcar('#er-forma', 'data-forma', forma); caixa.querySelector('#f-reg').dispatchEvent(new Event('input', { bubbles: true })); });
    caixa.querySelector('#er-tipo')?.addEventListener('click', e => { const b = e.target.closest('[data-tipo]'); if (!b) return; tipo = b.dataset.tipo; marcar('#er-tipo', 'data-tipo', tipo); caixa.querySelector('#f-reg').dispatchEvent(new Event('input', { bubbles: true })); });

    caixa.querySelector('#f-reg').addEventListener('submit', async e => {
      e.preventDefault();
      const valor = emCentavos(lerNumero(e.target.valor.value));
      const dia = e.target.dia.value;
      const erro = ehPag ? validarPagamento(valor, limite) : (valor > 0 ? null : 'Valor precisa ser maior que zero');
      if (erro) { avisar(erro, 'erro'); return; }
      if (!dia) { avisar('Informe a data', 'erro'); return; }
      const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
      try {
        if (ehPag) await atualizar('pagamentos', r.id, { valor_centavos: valor, forma, tipo, pago_em: dia });
        else await atualizar('vendas_balcao', r.id, { total_centavos: valor, subtotal_centavos: Math.max(valor, r.original.subtotal_centavos || 0), forma, vendido_em: dia });
        fecharModal(); avisar('Entrada corrigida');
        await carregar(); if (vivo()) desenhar();
      } catch (err) { btn.disabled = false; avisar(err.message, 'erro'); }
    });
    caixa.querySelector('#er-excluir').addEventListener('click', async () => {
      const oQue = ehPag ? `o ${NOME_TIPO[r.tipo].toLowerCase()} de ${moeda(r.valor)} do pedido nº ${r.numero ?? '?'}` : `a venda do balcão de ${moeda(r.valor)}`;
      const aviso = ehPag ? ' O pedido volta a ficar com esse valor em aberto.' : '';
      if (!await confirmar(`Excluir ${oQue}?${aviso}`, { ok: 'Excluir', perigo: true })) { editar(r); return; }
      try { await excluir(r.tabela, r.id); avisar('Entrada excluída'); await carregar(); if (vivo()) desenhar(); }
      catch (err) { avisar(err.message, 'erro'); }
    });
  }

  el.querySelector('#h-lista').addEventListener('click', e => {
    const b = e.target.closest('[data-reg]'); if (!b) return;
    const [tabela, id] = b.dataset.reg.split(':');
    const r = todos.find(x => x.tabela === tabela && x.id === id);
    if (r) editar(r);
  });
  const ligarChips = (id, campo) => el.querySelector(id).addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    filtro[campo] = b.dataset.v;
    el.querySelectorAll(`${id} [data-v]`).forEach(x => x.setAttribute('aria-pressed', x === b));
    desenhar();
  });
  ligarChips('#h-per', 'periodo'); ligarChips('#h-tipo', 'tipo'); ligarChips('#h-forma', 'forma');
  el.querySelector('#h-busca').addEventListener('input', e => { filtro.busca = e.target.value; desenhar(); });
  desenhar();
}
