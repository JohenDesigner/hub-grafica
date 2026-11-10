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
    acabamentos: r.acabamentos || [], prazo_dias: r.prazo_dias, ativo: r.ativo, codigo: r.codigo, detalhes: r.detalhes || {}, _registro: r };
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
    const vis = lista.filter(p => !t || [p.nome, p.codigo, p.detalhes?.referencia, p.detalhes?.codigo_barras, p.detalhes?.grupo].some(x => String(x ?? '').toLowerCase().includes(t)));
    const grupos = ['extras', ...Object.keys(NOMES_CATEGORIA).filter(k => k !== 'extras')].map(cat => [cat, vis.filter(p => p.categoria === cat)]).filter(([, l]) => l.length);
    el.querySelector('#p-lista').innerHTML = grupos.length ? grupos.map(([cat, l]) => `
      <p class="grupo-titulo">${esc(NOMES_CATEGORIA[cat])} (${l.length})</p>
      <ul class="lista">${l.map(p => `<li><button class="lista-item" data-id="${esc(p.id)}">
        <span class="meio"><span class="nome">${p.codigo ? `<span class="cod">${esc(p.codigo)}</span> ` : ''}${esc(p.nome)}</span><span class="det">${p.detalhes?.servico ? 'Serviço · ' : ''}${p.detalhes?.grupo ? esc(p.detalhes.grupo) + ' · ' : ''}${esc(p.tipo === 'opcoes' && ehQtd(p.opcoes) ? NOME_FORM.qtd : NOME_TIPO[p.tipo])} · prazo ${p.prazo_dias} dias úteis${p.detalhes?.controla_estoque && p.detalhes.estoque_atual != null ? ` · estoque ${esc(String(p.detalhes.estoque_atual).replace('.', ','))} ${esc(p.detalhes.unidade || '')}${p.detalhes.estoque_min != null && p.detalhes.estoque_atual <= p.detalhes.estoque_min ? ' <b style="color:var(--erro)">baixo</b>' : ''}` : ''}</span></span>
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

// Cadastro de produto ou serviço, no estilo do FpqSystem: identificação, estoque e preços com margem.
const UNIDADES = ['un', 'pct', 'cx', 'cento', 'milheiro', 'folha', 'm²', 'm', 'kg', 'hr', 'serviço'];
const dinheiroTxt = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctTxt = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let gruposConhecidos = [];

export function formExtra(p, depois, { aoCancelar } = {}) {
  const r = p?._registro;
  const d = r?.detalhes || {};
  let tipo = r?.tipo === 'opcoes' && ehQtd(r.opcoes) ? 'qtd' : r?.tipo || 'unidade';
  let salvouReg = null;
  listar('produtos').then(l => { gruposConhecidos = [...new Set(l.map(x => x.detalhes?.grupo).filter(Boolean))].sort(); const dl = document.getElementById('x-grupos'); if (dl) dl.innerHTML = gruposConhecidos.map(g => `<option value="${esc(g)}">`).join(''); }).catch(() => {});
  const campo = (rotulo, nome, valor = '', extra = '') => `<label class="campo"><span>${rotulo}</span><input name="${nome}" value="${esc(valor ?? '')}" autocomplete="off" ${extra}></label>`;
  const caixa = abrirModal(`
    <div class="modal-topo"><h2>${r ? 'Editar cadastro' : 'Cadastro de produto ou serviço'}</h2><button class="icone-btn" data-fechar aria-label="Fechar">${ICONE.fechar}</button></div>
    <form id="f-extra" class="cad" novalidate>
      <fieldset class="cad-bloco">
        <div class="cad-topo">
          <div class="segmentado" id="x-servico" role="group" aria-label="Tipo de cadastro">
            <button type="button" data-servico="0" aria-pressed="${!d.servico}">Produto</button>
            <button type="button" data-servico="1" aria-pressed="${!!d.servico}">Serviço</button></div>
          <div class="cad-codigos">
            <label class="campo cad-cod"><span>Código</span><input value="${esc(r?.codigo ?? 'novo')}" readonly tabindex="-1"></label>
            ${campo('Referência', 'referencia', d.referencia)}
            ${campo('Código de barras', 'codigo_barras', d.codigo_barras, 'inputmode="numeric"')}
          </div>
        </div>
        <div class="cad-linha cad-desc">
          <label class="campo cad-grande"><span>Descrição do produto ou serviço</span><input name="nome" value="${esc(r?.nome || '')}" placeholder="ex.: Cartão de visita couché 300g" autocomplete="off"></label>
          <label class="campo"><span>Unidade</span><select name="unidade">${UNIDADES.map(u => `<option ${(d.unidade || 'un') === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        </div>
        <div class="cad-g3">${campo('Formato', 'formato', d.formato, 'placeholder="ex.: 9×5 cm"')}${campo('Vias', 'vias', d.vias, 'placeholder="ex.: 4×4"')}${campo('Cores', 'cores', d.cores, 'placeholder="ex.: colorido"')}</div>
        <div class="cad-g2">${campo('Marca / material', 'marca', d.marca, 'placeholder="ex.: Couché 300g"')}${campo('Grupo / categoria', 'grupo', d.grupo, 'list="x-grupos" placeholder="ex.: Cartões"')}<datalist id="x-grupos"></datalist></div>
        <label class="campo"><span>Complemento <span class="sub">(aparece só no pedido, não vai para o cliente)</span></span><textarea name="complemento" rows="2" placeholder="ex.: refilar 2mm, usar papel da caixa azul">${esc(d.complemento || '')}</textarea></label>
      </fieldset>

      <div class="cad-cols">
        <fieldset class="cad-bloco" id="x-estoque">
          <legend>Estoque</legend>
          <label class="check"><input type="checkbox" name="controla_estoque" ${d.controla_estoque ? 'checked' : ''}> Controlar o estoque</label>
          <label class="check"><input type="checkbox" name="vender_zerado" ${d.vender_zerado !== false ? 'checked' : ''}> Vender com estoque zerado</label>
          <div class="cad-g2 cad-estq">${campo('Estoque mínimo', 'estoque_min', d.estoque_min ? String(d.estoque_min).replace('.', ',') : '', 'inputmode="decimal" placeholder="0"')}
            ${campo('Estoque atual', 'estoque_atual', d.estoque_atual ? String(d.estoque_atual).replace('.', ',') : '', 'inputmode="decimal" placeholder="0"')}</div>
          <p class="sub" id="x-estq-data">${d.estoque_em ? `Atualizado em ${esc(new Date(d.estoque_em + 'T12:00:00').toLocaleDateString('pt-BR'))}` : ''}</p>
        </fieldset>

        <fieldset class="cad-bloco cad-precos">
          <legend>Preços</legend>
          <div class="campo"><span>Como cobra no orçamento</span>
            <div class="segmentado segmentado-quebra" id="x-tipo">${Object.entries(NOME_FORM).map(([k, v]) => `<button type="button" data-tipo="${k}" aria-pressed="${k === tipo}">${v}</button>`).join('')}</div></div>
          <div class="cad-margem"><span>Valor custo R$</span><input name="custo" inputmode="decimal" value="${d.custo ? dinheiroTxt(d.custo) : ''}" placeholder="0,00"></div>
          <div id="x-preco-bloco">
            <div class="cad-margem"><span>Margem à vista %</span><input name="margem_vista" data-par="preco" inputmode="decimal" value="${d.margem_vista != null ? pctTxt(d.margem_vista) : ''}" placeholder="0,00"></div>
            <div class="cad-margem cad-forte"><span id="x-preco-nome">VALOR À VISTA R$</span><input name="preco" data-margem="margem_vista" inputmode="decimal" value="${r && tipo !== 'qtd' && tipo !== 'opcoes' ? dinheiroTxt(r.preco) : ''}" placeholder="0,00"></div>
          </div>
          <div class="cad-margem"><span>Margem a prazo %</span><input name="margem_prazo" data-par="preco_prazo" inputmode="decimal" value="${d.margem_prazo != null ? pctTxt(d.margem_prazo) : ''}" placeholder="0,00"></div>
          <div class="cad-margem cad-forte"><span>VALOR A PRAZO R$</span><input name="preco_prazo" data-margem="margem_prazo" inputmode="decimal" value="${d.preco_prazo ? dinheiroTxt(d.preco_prazo) : ''}" placeholder="0,00"></div>
          <div class="cad-margem"><span>Margem atacado %</span><input name="margem_atacado" data-par="preco_atacado" inputmode="decimal" value="${d.margem_atacado != null ? pctTxt(d.margem_atacado) : ''}" placeholder="0,00"></div>
          <div class="cad-margem cad-forte"><span>VALOR ATACADO R$</span><input name="preco_atacado" data-margem="margem_atacado" inputmode="decimal" value="${d.preco_atacado ? dinheiroTxt(d.preco_atacado) : ''}" placeholder="0,00"></div>
          <p class="sub">Coloque o custo e a margem que o valor é calculado, ou digite o valor que a margem se ajusta.</p>

          <div id="x-qtd">
            <p class="sub">Igual aos cartões de visita: cada quantidade tem um valor fechado. Linha sem valor é ignorada.</p>
            <div data-lista="qtd">${(tipo === 'qtd' && r?.opcoes?.length ? [...r.opcoes].sort((a, b) => parseInt(a.label) - parseInt(b.label)) : [{ label: '100 un.', preco: '' }, { label: '500 un.', preco: '' }, { label: '1000 un.', preco: '' }]).map(linhaQtd).join('')}</div>
            <button type="button" class="btn btn-peq" id="x-mais-qtd" style="margin-top:8px">+ quantidade</button>
          </div>
          <div id="x-opcoes">
            <div data-lista="opcao">${(tipo === 'opcoes' && r?.opcoes?.length ? r.opcoes : [{ label: '', preco: '' }]).map(linhaOpcao).join('')}</div>
            <button type="button" class="btn btn-peq" id="x-mais-opcao" style="margin-top:8px">+ opção</button>
          </div>
          <div class="cad-g2" id="x-minimo">
            <label class="campo"><span>Valor mínimo R$</span><input name="minimo" value="${r && Number(r.minimo) ? dinheiroTxt(r.minimo) : ''}" inputmode="decimal" placeholder="0,00"></label>
            <label class="campo"><span>Mínimo vale</span><select name="minimo_por">
              <option value="total" ${r?.minimo_por !== 'peca' ? 'selected' : ''}>no total</option>
              <option value="peca" ${r?.minimo_por === 'peca' ? 'selected' : ''}>por peça</option></select></label>
          </div>
        </fieldset>
      </div>

      <fieldset class="cad-bloco">
        <legend>Acabamentos e prazo</legend>
        <div data-lista="acab">${(r?.acabamentos || []).map(linhaAcab).join('')}</div>
        <button type="button" class="btn btn-peq" id="x-mais-acab">+ acabamento</button>
        <div class="cad-g2">
          <label class="campo"><span>Prazo (dias úteis)</span><input name="prazo_dias" type="number" min="0" value="${r?.prazo_dias ?? 3}" inputmode="numeric"></label>
          <label class="check" style="align-self:end"><input type="checkbox" name="ativo" ${r?.ativo === false ? '' : 'checked'}> Ativo (aparece no orçamento)</label>
        </div>
      </fieldset>

      <p class="form-erro" id="x-erro" role="alert"></p>
      <div class="cad-acoes">
        ${r ? `<button type="button" class="btn btn-perigo" id="x-excluir">Excluir</button>` : ''}
        <button type="button" class="btn" data-fechar>Sair</button>
        <button class="btn btn-primario" type="submit">Salvar</button>
      </div>
    </form>`, { fechar: () => { if (!salvouReg) aoCancelar?.(); } });
  caixa.classList.add('modal-grande');
  const f = caixa.querySelector('#f-extra');
  let servico = !!d.servico;

  const mostrarTipo = () => {
    caixa.querySelectorAll('[data-tipo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tipo === tipo));
    caixa.querySelector('#x-opcoes').hidden = tipo !== 'opcoes';
    caixa.querySelector('#x-qtd').hidden = tipo !== 'qtd';
    caixa.querySelector('#x-preco-bloco').hidden = tipo === 'opcoes' || tipo === 'qtd';
    caixa.querySelector('#x-minimo').hidden = tipo === 'qtd' || tipo === 'opcoes';
    caixa.querySelector('#x-preco-nome').textContent = tipo === 'm2' ? 'VALOR DO m² À VISTA R$' : 'VALOR À VISTA R$';
    if (tipo === 'm2' && f.unidade.value === 'un') f.unidade.value = 'm²';
  };
  const mostrarServico = () => {
    caixa.querySelectorAll('[data-servico]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.servico === '1') === servico));
    caixa.querySelector('#x-estoque').hidden = servico;
  };
  mostrarTipo(); mostrarServico();
  caixa.querySelector('#x-tipo').addEventListener('click', e => { const b = e.target.closest('[data-tipo]'); if (b) { tipo = b.dataset.tipo; mostrarTipo(); } });
  caixa.querySelector('#x-servico').addEventListener('click', e => { const b = e.target.closest('[data-servico]'); if (b) { servico = b.dataset.servico === '1'; mostrarServico(); } });
  caixa.querySelector('#x-mais-qtd').addEventListener('click', () => { caixa.querySelector('[data-lista="qtd"]').insertAdjacentHTML('beforeend', linhaQtd()); caixa.querySelector('[data-lista="qtd"] .campo-linha:last-child input')?.focus(); });
  caixa.querySelector('#x-mais-opcao').addEventListener('click', () => caixa.querySelector('[data-lista="opcao"]').insertAdjacentHTML('beforeend', linhaOpcao()));
  caixa.querySelector('#x-mais-acab').addEventListener('click', () => caixa.querySelector('[data-lista="acab"]').insertAdjacentHTML('beforeend', linhaAcab()));
  caixa.addEventListener('click', e => { const b = e.target.closest('[data-remover]'); if (b) b.parentElement.remove(); });
  caixa.querySelectorAll('.cad-acoes [data-fechar]').forEach(b => b.addEventListener('click', () => fecharModal()));

  // custo × margem ⇄ valor (como no FpqSystem)
  const custo = () => lerNumero(f.custo.value) || 0;
  const recalcularValor = m => {
    const c = custo(), pct = lerNumero(m.value);
    if (c > 0 && Number.isFinite(pct)) f[m.dataset.par].value = dinheiroTxt(Math.round(c * (1 + pct / 100) * 100) / 100);
  };
  const recalcularMargem = v => {
    const c = custo(), val = lerNumero(v.value);
    if (c > 0 && val > 0) f[v.dataset.margem].value = pctTxt(Math.round((val / c - 1) * 10000) / 100);
  };
  caixa.querySelectorAll('[data-par]').forEach(m => m.addEventListener('change', () => { if (Number.isFinite(lerNumero(m.value))) m.value = pctTxt(lerNumero(m.value)); recalcularValor(m); }));
  caixa.querySelectorAll('[data-margem]').forEach(v => v.addEventListener('change', () => { if (lerNumero(v.value) > 0) v.value = dinheiroTxt(lerNumero(v.value)); recalcularMargem(v); }));
  f.custo.addEventListener('change', () => {
    if (lerNumero(f.custo.value) > 0) f.custo.value = dinheiroTxt(lerNumero(f.custo.value));
    caixa.querySelectorAll('[data-par]').forEach(m => { if (m.value.trim()) recalcularValor(m); else { const v = f[m.dataset.par]; if (lerNumero(v.value) > 0) recalcularMargem(v); } });
  });
  const estoqueAntes = d.estoque_atual ?? null;

  caixa.querySelector('#x-excluir')?.addEventListener('click', async () => {
    if (!await confirmar(`Excluir "${r.nome}"? Orçamentos antigos não mudam.`, { ok: 'Excluir', perigo: true })) return;
    try { await excluir('produtos', r.id); avisar('Produto excluído'); depois(); }
    catch (err) { avisar(err.message, 'erro'); }
  });

  f.addEventListener('submit', async e => {
    e.preventDefault();
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
      vazio: !l.querySelector('[data-k=preco]').value.trim() })).filter(x => !x.vazio);
    const num = k => { const v = lerNumero(f[k].value); return Number.isFinite(v) ? v : null; };
    let erro = '';
    if (!nome) erro = 'Escreva a descrição do produto ou serviço';
    else if (tipo === 'qtd' && !qtds.length) erro = 'Coloque o valor de pelo menos uma quantidade';
    else if (tipo === 'qtd' && qtds.some(x => !(x.q > 0))) erro = 'Tem valor sem quantidade';
    else if (tipo === 'qtd' && qtds.some(x => !(x.preco > 0))) erro = 'Valor precisa ser maior que zero';
    else if (tipo === 'qtd' && new Set(qtds.map(x => x.q)).size !== qtds.length) erro = 'Tem quantidade repetida';
    else if (tipo === 'opcoes' && !opcoes.some(o => o.label && o.preco > 0)) erro = 'Cadastre ao menos uma opção';
    else if (tipo === 'opcoes' && opcoes.some(o => !o.label || !(o.preco > 0))) erro = 'Cada opção precisa de nome e preço';
    else if (tipo !== 'opcoes' && tipo !== 'qtd' && !(preco > 0)) erro = 'Coloque o VALOR À VISTA (ou custo + margem)';
    else if (acabamentos.some(a => !(a.valor >= 0))) erro = 'Valor do acabamento inválido';
    else if (tipo !== 'm2' && acabamentos.some(a => a.cobranca === 'm2')) erro = 'Acabamento por m² só em produto por m²';
    const caixaErro = caixa.querySelector('#x-erro');
    caixaErro.textContent = erro;
    if (erro) { avisar(erro, 'erro'); caixaErro.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const tipoBanco = tipo === 'qtd' ? 'opcoes' : tipo;
    const opcoesBanco = tipo === 'qtd' ? qtds.sort((a, b) => a.q - b.q).map(x => ({ label: `${x.q} un.`, preco: x.preco })) : tipo === 'opcoes' ? opcoes : [];
    const estoqueAtual = num('estoque_atual');
    const detalhes = {
      servico, referencia: f.referencia.value.trim(), codigo_barras: f.codigo_barras.value.trim(), unidade: f.unidade.value,
      formato: f.formato.value.trim(), vias: f.vias.value.trim(), cores: f.cores.value.trim(), marca: f.marca.value.trim(), grupo: f.grupo.value.trim(),
      complemento: f.complemento.value.trim(),
      controla_estoque: !servico && f.controla_estoque.checked, vender_zerado: f.vender_zerado.checked,
      estoque_min: num('estoque_min'), estoque_atual: estoqueAtual,
      estoque_em: estoqueAtual !== estoqueAntes ? hojeLocal() : d.estoque_em || null,
      custo: num('custo'), margem_vista: num('margem_vista'), margem_prazo: num('margem_prazo'), preco_prazo: num('preco_prazo'),
      margem_atacado: num('margem_atacado'), preco_atacado: num('preco_atacado')
    };
    const reg = { ...(r ? { id: r.id } : {}), nome, tipo: tipoBanco, opcoes: opcoesBanco, preco: tipoBanco === 'opcoes' ? 0 : preco,
      m2_livre: 0, minimo: tipo === 'qtd' || tipo === 'opcoes' ? 0 : minimo, minimo_por: f.minimo_por.value, acabamentos,
      prazo_dias: Math.max(0, parseInt(f.prazo_dias.value, 10) || 0), ativo: f.ativo.checked, detalhes };
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try { const s = await salvar('produtos', reg); salvouReg = { ...reg, ...s }; fecharModal(); avisar(s?._pendente ? 'Produto salvo no aparelho — envia quando a internet voltar' : `"${nome}" salvo em Meus produtos`); depois(salvouReg); }
    catch (err) { btn.disabled = false; caixaErro.textContent = err.message; avisar(err.message, 'erro'); }
  });
  if (!r && matchMedia('(min-width: 900px)').matches) f.nome.focus();
}
const hojeLocal = () => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
