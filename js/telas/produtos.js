// Produtos: catálogo do site (somente leitura) + produtos extras cadastrados no hub.
import { carregarCatalogo, NOMES_CATEGORIA } from '../catalogo.js';
import { listar, salvar, excluir } from '../db.js';
import { moeda, lerNumero } from '../formato.js';
import { emCentavos } from '../calc.js';
import { esc, avisar, confirmar, abrirModal, fecharModal, titulo, ICONE } from '../ui.js';

const NOME_TIPO = { opcoes: 'Opções', m2: 'Por m²', unidade: 'Por unidade' };
// "Quantidade e valor" (tipo cartão de visita): guardado como opções "100 un.", "500 un."…
const NOME_FORM = { qtd: 'Quantidade e valor', unidade: 'Por unidade', m2: 'Por m²', opcoes: 'Opções' };
const RX_QTD = /^(\d+)\s*un\.?$/i;
const ehQtd = opcoes => opcoes?.length > 0 && opcoes.every(o => RX_QTD.test(String(o.label).trim()));
const NOME_COBRANCA = { unidade: 'por unidade', m2: 'por m²', fixo: 'fixo' };

export function extraParaProduto(r) {
  return { id: r.id, origem: 'hub', categoria: 'extras', nome: r.nome, tipo: r.tipo,
    opcoes: (r.opcoes || []).map(o => ({ label: o.label, preco: Number(o.preco) })),
    preco: Number(r.preco), m2_livre: Number(r.m2_livre), minimo: Number(r.minimo), minimo_por: r.minimo_por,
    acabamentos: r.acabamentos || [], prazo_dias: r.prazo_dias, ativo: r.ativo, _registro: r };
}

export async function todosProdutos({ forcar = false, incluirInativos = false } = {}) {
  const [cat, extras] = await Promise.all([
    carregarCatalogo({ forcar }),
    listar('produtos', { order: 'nome' }).catch(() => [])
  ]);
  const ext = extras.map(extraParaProduto).filter(p => incluirInativos || p.ativo);
  return { lista: [...cat.lista, ...ext], quando: cat.quando, offline: cat.offline };
}

export function aPartirDe(p) {
  if (p.tipo === 'opcoes') {
    const v = Math.min(...p.opcoes.map(o => o.preco).filter(x => x > 0));
    return Number.isFinite(v) ? `a partir de ${moeda(emCentavos(v))}` : 'sem preço';
  }
  return `${moeda(emCentavos(p.preco))}${p.tipo === 'm2' ? ' o m²' : ' cada'}`;
}

const hora = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

export async function montar(el, _p, vivo, forcar = false) {
  titulo('Produtos e preços');
  const { lista, quando, offline } = await todosProdutos({ forcar, incluirInativos: true });
  if (!vivo()) return;
  const site = lista.filter(p => p.origem === 'site').length;
  el.innerHTML = `
    <div class="cabeca"><h2>Produtos</h2><button class="btn btn-primario" id="p-novo">${ICONE.mais.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"')}Novo produto</button></div>
    <div class="${offline ? 'aviso' : 'aviso info'}" id="p-estado">
      ${offline ? (quando ? `Sem internet: usando a cópia de ${hora(quando)}.` : 'Sem internet e sem cópia do catálogo do site.')
                : `Preços do site — ${site} produtos, atualizado ${hora(quando)}.`}
    </div>
    <button class="btn btn-bloco" id="p-atualizar">${ICONE.atualizar.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"')}Atualizar do site</button>
    <label class="campo"><span>Buscar</span><input id="p-busca" type="search" placeholder="Nome do produto" autocomplete="off"></label>
    <div id="p-lista"></div>`;

  const desenhar = () => {
    const t = el.querySelector('#p-busca').value.trim().toLowerCase();
    const vis = lista.filter(p => !t || p.nome.toLowerCase().includes(t));
    const grupos = Object.keys(NOMES_CATEGORIA).map(cat => [cat, vis.filter(p => p.categoria === cat)]).filter(([, l]) => l.length);
    el.querySelector('#p-lista').innerHTML = grupos.length ? grupos.map(([cat, l]) => `
      <p class="grupo-titulo">${esc(NOMES_CATEGORIA[cat])} (${l.length})</p>
      <ul class="lista">${l.map(p => `<li><button class="lista-item" data-id="${esc(p.id)}">
        <span class="meio"><span class="nome">${esc(p.nome)}</span><span class="det">${esc(p.tipo === 'opcoes' && ehQtd(p.opcoes) ? NOME_FORM.qtd : NOME_TIPO[p.tipo])} · prazo ${p.prazo_dias} dias úteis</span></span>
        <span class="fim"><span class="valor">${esc(aPartirDe(p))}</span><br>
          ${p.origem === 'site' ? '<span class="selo">do site</span>' : p.ativo ? '<span class="selo ok">extra</span>' : '<span class="selo alerta">inativo</span>'}</span>
      </button></li>`).join('')}</ul>`).join('') : '<p class="vazio">Nenhum produto encontrado.</p>';
  };
  desenhar();
  el.querySelector('#p-busca').addEventListener('input', desenhar);
  el.querySelector('#p-lista').addEventListener('click', e => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    const p = lista.find(x => x.id === b.dataset.id);
    if (p.origem === 'site') verProdutoSite(p); else formExtra(p, () => montar(el, _p, vivo));
  });
  el.querySelector('#p-novo').addEventListener('click', () => formExtra(null, () => montar(el, _p, vivo)));
  el.querySelector('#p-atualizar').addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    await montar(el, _p, vivo, true);
    avisar('Catálogo do site atualizado');
  });
}

function verProdutoSite(p) {
  const linhas = [];
  if (p.tipo === 'opcoes') p.opcoes.forEach(o => linhas.push([o.label, moeda(emCentavos(o.preco))]));
  if (p.tipo === 'm2') linhas.push(['Preço do m²', moeda(emCentavos(p.preco))]);
  if (p.m2_livre) linhas.push(['Outro tamanho (m²)', moeda(emCentavos(p.m2_livre))]);
  if (p.minimo) linhas.push([p.minimo_por === 'peca' ? 'Mínimo por peça' : 'Mínimo do pedido', moeda(emCentavos(p.minimo))]);
  p.acabamentos.forEach(a => linhas.push([`${a.nome} (${NOME_COBRANCA[a.cobranca]})`, '+' + moeda(emCentavos(a.valor))]));
  linhas.push(['Prazo', `${p.prazo_dias} dias úteis`]);
  abrirModal(`
    <div class="modal-topo"><h2>${esc(p.nome)}</h2><button class="icone-btn" data-fechar aria-label="Fechar">${ICONE.fechar}</button></div>
    <div class="resumo">${linhas.map(([a, b]) => `<span>${esc(a)}</span><span class="valor">${esc(b)}</span>`).join('')}</div>
    <p class="aviso info">Este preço vem do site. Para mudar, mude no site novo.</p>`);
}

function linhaQtd(o = { label: '', preco: '' }) {
  const q = String(o.label).match(RX_QTD)?.[1] ?? '';
  return `<div class="campo-linha" data-linha="qtd">
    <label class="campo"><span>Quantidade</span><input data-k="qtd" value="${esc(q)}" inputmode="numeric" placeholder="ex.: 100"></label>
    <label class="campo"><span>Valor R$</span><input data-k="preco" value="${esc(o.preco === '' ? '' : String(o.preco).replace('.', ','))}" inputmode="decimal" placeholder="ex.: 45,00"></label>
    <button type="button" class="icone-btn" data-remover aria-label="Remover">${ICONE.lixo}</button></div>`;
}

function linhaOpcao(o = { label: '', preco: '' }) {
  return `<div class="campo-linha" data-linha="opcao">
    <label class="campo"><span>Opção</span><input data-k="label" value="${esc(o.label)}" placeholder="ex.: 100 un."></label>
    <label class="campo" style="max-width:120px"><span>Preço R$</span><input data-k="preco" value="${esc(o.preco === '' ? '' : String(o.preco).replace('.', ','))}" inputmode="decimal"></label>
    <button type="button" class="icone-btn" data-remover aria-label="Remover">${ICONE.lixo}</button></div>`;
}
function linhaAcab(a = { nome: '', valor: '', cobranca: 'unidade' }) {
  return `<div class="campo-linha" data-linha="acab">
    <label class="campo"><span>Acabamento</span><input data-k="nome" value="${esc(a.nome)}" placeholder="ex.: Ilhós"></label>
    <label class="campo" style="max-width:96px"><span>R$</span><input data-k="valor" value="${esc(a.valor === '' ? '' : String(a.valor).replace('.', ','))}" inputmode="decimal"></label>
    <label class="campo" style="max-width:110px"><span>Cobra</span><select data-k="cobranca">
      ${Object.entries(NOME_COBRANCA).map(([k, v]) => `<option value="${k}" ${a.cobranca === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <button type="button" class="icone-btn" data-remover aria-label="Remover">${ICONE.lixo}</button></div>`;
}

export function formExtra(p, depois, { aoCancelar } = {}) {
  const r = p?._registro;
  let tipo = r?.tipo === 'opcoes' && ehQtd(r.opcoes) ? 'qtd' : r?.tipo || 'qtd';
  let salvouReg = null;
  const caixa = abrirModal(`
    <div class="modal-topo"><h2>${r ? 'Editar produto' : 'Novo produto'}</h2><button class="icone-btn" data-fechar aria-label="Fechar">${ICONE.fechar}</button></div>
    <form id="f-extra">
      <label class="campo"><span>Nome</span><input name="nome" value="${esc(r?.nome || '')}" placeholder="ex.: Envelopamento de frota"></label>
      <div class="campo" style="margin-top:12px"><span>Tipo de cobrança</span>
        <div class="segmentado segmentado-quebra" id="x-tipo">${Object.entries(NOME_FORM).map(([k, v]) => `<button type="button" data-tipo="${k}" aria-pressed="${k === tipo}">${v}</button>`).join('')}</div></div>
      <div id="x-qtd" style="margin-top:12px">
        <p class="sub">Igual aos cartões de visita: cada quantidade tem um valor fechado (ex.: 100 un. = R$ 45,00).</p>
        <div data-lista="qtd">${(tipo === 'qtd' && r?.opcoes?.length ? [...r.opcoes].sort((a, b) => parseInt(a.label) - parseInt(b.label)) : [{ label: '100 un.', preco: '' }, { label: '500 un.', preco: '' }, { label: '1000 un.', preco: '' }]).map(linhaQtd).join('')}</div>
        <button type="button" class="btn btn-peq" id="x-mais-qtd" style="margin-top:8px">+ quantidade</button>
      </div>
      <div id="x-opcoes" style="margin-top:12px">
        <div data-lista="opcao">${(r?.opcoes?.length ? r.opcoes : [{ label: '', preco: '' }]).map(linhaOpcao).join('')}</div>
        <button type="button" class="btn btn-peq" id="x-mais-opcao" style="margin-top:8px">+ opção</button>
      </div>
      <label class="campo" id="x-preco" style="margin-top:12px"><span id="x-preco-nome">Preço R$</span><input name="preco" value="${r ? String(r.preco).replace('.', ',') : ''}" inputmode="decimal"></label>
      <div class="grade-2" style="margin-top:12px">
        <label class="campo"><span>Valor mínimo R$</span><input name="minimo" value="${r && Number(r.minimo) ? String(r.minimo).replace('.', ',') : ''}" inputmode="decimal" placeholder="0"></label>
        <label class="campo"><span>Mínimo vale</span><select name="minimo_por">
          <option value="total" ${r?.minimo_por !== 'peca' ? 'selected' : ''}>no total</option>
          <option value="peca" ${r?.minimo_por === 'peca' ? 'selected' : ''}>por peça</option></select></label>
      </div>
      <div style="margin-top:12px"><div data-lista="acab">${(r?.acabamentos || []).map(linhaAcab).join('')}</div>
        <button type="button" class="btn btn-peq" id="x-mais-acab" style="margin-top:8px">+ acabamento</button></div>
      <div class="grade-2" style="margin-top:12px">
        <label class="campo"><span>Prazo (dias úteis)</span><input name="prazo_dias" type="number" min="0" value="${r?.prazo_dias ?? 3}" inputmode="numeric"></label>
        <label class="check" style="align-self:end"><input type="checkbox" name="ativo" ${r?.ativo === false ? '' : 'checked'}> Ativo</label>
      </div>
      <div class="botoes" style="margin-top:16px">
        ${r ? `<button type="button" class="btn btn-perigo" id="x-excluir">Excluir</button>` : ''}
        <button class="btn btn-primario" type="submit">Salvar</button>
      </div>
    </form>`, { fechar: () => { if (!salvouReg) aoCancelar?.(); } });

  const mostrarTipo = () => {
    caixa.querySelectorAll('[data-tipo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tipo === tipo));
    caixa.querySelector('#x-opcoes').hidden = tipo !== 'opcoes';
    caixa.querySelector('#x-qtd').hidden = tipo !== 'qtd';
    caixa.querySelector('#x-preco').hidden = tipo === 'opcoes' || tipo === 'qtd';
    caixa.querySelector('#x-preco-nome').textContent = tipo === 'm2' ? 'Preço do m² R$' : 'Preço por unidade R$';
  };
  mostrarTipo();
  caixa.querySelector('#x-tipo').addEventListener('click', e => { const b = e.target.closest('[data-tipo]'); if (b) { tipo = b.dataset.tipo; mostrarTipo(); } });
  caixa.querySelector('#x-mais-qtd').addEventListener('click', () => { caixa.querySelector('[data-lista="qtd"]').insertAdjacentHTML('beforeend', linhaQtd()); caixa.querySelector('[data-lista="qtd"] .campo-linha:last-child input')?.focus(); });
  caixa.querySelector('#x-mais-opcao').addEventListener('click', () => caixa.querySelector('[data-lista="opcao"]').insertAdjacentHTML('beforeend', linhaOpcao()));
  caixa.querySelector('#x-mais-acab').addEventListener('click', () => caixa.querySelector('[data-lista="acab"]').insertAdjacentHTML('beforeend', linhaAcab()));
  caixa.addEventListener('click', e => { const b = e.target.closest('[data-remover]'); if (b) b.parentElement.remove(); });

  caixa.querySelector('#x-excluir')?.addEventListener('click', async () => {
    if (!await confirmar(`Excluir "${r.nome}"? Orçamentos antigos não mudam.`, { ok: 'Excluir', perigo: true })) return;
    try { await excluir('produtos', r.id); avisar('Produto excluído'); depois(); }
    catch (err) { avisar(err.message, 'erro'); }
  });

  caixa.querySelector('#f-extra').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const nome = f.nome.value.trim();
    const opcoes = [...caixa.querySelectorAll('[data-linha="opcao"]')].map(l => ({
      label: l.querySelector('[data-k=label]').value.trim(), preco: lerNumero(l.querySelector('[data-k=preco]').value) }))
      .filter(o => o.label || Number.isFinite(o.preco));
    const acabamentos = [...caixa.querySelectorAll('[data-linha="acab"]')].map(l => ({
      nome: l.querySelector('[data-k=nome]').value.trim(), valor: lerNumero(l.querySelector('[data-k=valor]').value),
      cobranca: l.querySelector('[data-k=cobranca]').value })).filter(a => a.nome);
    const preco = lerNumero(f.preco.value), minimo = lerNumero(f.minimo.value) || 0;
    const qtds = [...caixa.querySelectorAll('[data-linha="qtd"]')].map(l => ({
      q: parseInt(l.querySelector('[data-k=qtd]').value.replace(/\D/g, ''), 10), preco: lerNumero(l.querySelector('[data-k=preco]').value),
      vazio: !l.querySelector('[data-k=qtd]').value.trim() && !l.querySelector('[data-k=preco]').value.trim() })).filter(x => !x.vazio);
    let erro = '';
    if (!nome) erro = 'Informe o nome';
    else if (tipo === 'qtd' && !qtds.length) erro = 'Coloque ao menos uma quantidade com valor';
    else if (tipo === 'qtd' && qtds.some(x => !(x.q > 0) || !(x.preco > 0))) erro = 'Cada linha precisa de quantidade e valor';
    else if (tipo === 'qtd' && new Set(qtds.map(x => x.q)).size !== qtds.length) erro = 'Tem quantidade repetida';
    else if (tipo === 'opcoes' && !opcoes.some(o => o.label && o.preco > 0)) erro = 'Cadastre ao menos uma opção';
    else if (tipo === 'opcoes' && opcoes.some(o => !o.label || !(o.preco > 0))) erro = 'Cada opção precisa de nome e preço';
    else if (tipo !== 'opcoes' && tipo !== 'qtd' && !(preco > 0)) erro = 'Preço precisa ser maior que zero';
    else if (acabamentos.some(a => !(a.valor >= 0))) erro = 'Valor do acabamento inválido';
    else if (tipo !== 'm2' && acabamentos.some(a => a.cobranca === 'm2')) erro = 'Acabamento por m² só em produto por m²';
    if (erro) { avisar(erro, 'erro'); return; }
    const tipoBanco = tipo === 'qtd' ? 'opcoes' : tipo;
    const opcoesBanco = tipo === 'qtd' ? qtds.sort((a, b) => a.q - b.q).map(x => ({ label: `${x.q} un.`, preco: x.preco })) : tipo === 'opcoes' ? opcoes : [];
    const reg = { ...(r ? { id: r.id } : {}), nome, tipo: tipoBanco, opcoes: opcoesBanco, preco: tipoBanco === 'opcoes' ? 0 : preco,
      m2_livre: 0, minimo, minimo_por: f.minimo_por.value, acabamentos,
      prazo_dias: Math.max(0, parseInt(f.prazo_dias.value, 10) || 0), ativo: f.ativo.checked };
    try { const s = await salvar('produtos', reg); salvouReg = { ...reg, ...s }; fecharModal(); avisar('Produto salvo'); depois(salvouReg); }
    catch (err) { avisar(err.message, 'erro'); }
  });
}
