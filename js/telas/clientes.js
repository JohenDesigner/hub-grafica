// Clientes: lista, cadastro, detalhe com histórico e cadastro rápido usado no orçamento.
import { listar, obter, salvar, atualizar, excluir } from '../db.js';
import { moeda, data, soDigitos } from '../formato.js';
import { NOMES_ETAPA } from '../calc.js';
import { linkWa } from '../whatsapp.js';
import { esc, avisar, confirmar, abrirModal, fecharModal, titulo, lerForm, ICONE } from '../ui.js';
import { ir } from '../rotas.js';

const iniciais = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const avatar = n => `<span aria-hidden="true" style="flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--t-turquesa);color:var(--turquesa-esc);font-weight:700;font-size:14px">${esc(iniciais(n))}</span>`;

export function itemCliente(c, href = `#cliente/${c.id}`) {
  return `<li><a class="lista-item" href="${href}">${avatar(c.nome)}
    <span class="meio"><span class="nome">${esc(c.nome)}</span><span class="det">${esc(c.whatsapp || 'sem WhatsApp')}${c.arquivado ? ' · arquivado' : ''}</span></span></a></li>`;
}

export async function montarLista(el, _p, vivo) {
  titulo('Clientes');
  const todos = await listar('clientes', { order: 'nome' });
  if (!vivo()) return;
  el.innerHTML = `
    <div class="cabeca"><h2>Clientes</h2><button class="btn btn-primario" id="c-novo">${ICONE.mais.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4"')}Novo</button></div>
    <label class="campo"><span>Buscar por nome ou WhatsApp</span><input id="c-busca" type="search" autocomplete="off"></label>
    <label class="check"><input type="checkbox" id="c-arq"> Mostrar arquivados</label>
    <div id="c-lista"></div>`;
  const desenhar = () => {
    const t = el.querySelector('#c-busca').value.trim().toLowerCase();
    const td = soDigitos(t);
    const arq = el.querySelector('#c-arq').checked;
    const vis = todos.filter(c => (arq || !c.arquivado) &&
      (!t || c.nome.toLowerCase().includes(t) || (td && soDigitos(c.whatsapp).includes(td))));
    el.querySelector('#c-lista').innerHTML = vis.length ? `<ul class="lista">${vis.map(c => itemCliente(c)).join('')}</ul>`
      : `<p class="vazio">${todos.length ? 'Nenhum cliente encontrado.' : 'Nenhum cliente ainda. Toque em Novo para cadastrar.'}</p>`;
  };
  desenhar();
  el.querySelector('#c-busca').addEventListener('input', desenhar);
  el.querySelector('#c-arq').addEventListener('change', desenhar);
  el.querySelector('#c-novo').addEventListener('click', () => formCliente(null, c => ir('cliente', c.id)));
}

export function formCliente(c, aoSalvar, { rapido = false } = {}) {
  const caixa = abrirModal(`
    <div class="modal-topo"><h2>${c ? 'Editar cliente' : 'Novo cliente'}</h2><button class="icone-btn" data-fechar aria-label="Fechar">${ICONE.fechar}</button></div>
    <form id="f-cli">
      <label class="campo"><span>Nome</span><input name="nome" value="${esc(c?.nome || '')}" autocomplete="off" required></label>
      <label class="campo" style="margin-top:12px"><span>WhatsApp</span><input name="whatsapp" value="${esc(c?.whatsapp || '')}" inputmode="tel" placeholder="(11) 90000-0000" autocomplete="off"></label>
      ${rapido ? '' : `
      <label class="campo" style="margin-top:12px"><span>CPF ou CNPJ</span><input name="documento" value="${esc(c?.documento || '')}" inputmode="numeric" autocomplete="off"></label>
      <label class="campo" style="margin-top:12px"><span>Endereço</span><input name="endereco" value="${esc(c?.endereco || '')}" autocomplete="off"></label>
      <label class="campo" style="margin-top:12px"><span>Observações</span><textarea name="observacoes">${esc(c?.observacoes || '')}</textarea></label>`}
      <button class="btn btn-primario btn-bloco" type="submit" style="margin-top:16px">Salvar cliente</button>
    </form>`);
  caixa.querySelector('#f-cli').addEventListener('submit', async e => {
    e.preventDefault();
    const d = lerForm(e.target);
    if (!d.nome) { avisar('Informe o nome', 'erro'); return; }
    const reg = { ...(c ? { id: c.id } : {}), nome: d.nome, whatsapp: d.whatsapp || '',
      ...(rapido ? {} : { documento: d.documento || '', endereco: d.endereco || '', observacoes: d.observacoes || '' }) };
    try {
      const salvo = c ? await atualizar('clientes', c.id, reg) : await salvar('clientes', reg);
      fecharModal(); avisar('Cliente salvo'); aoSalvar({ ...c, ...reg, ...salvo });
    } catch (err) { avisar(err.message, 'erro'); }
  });
}

export function formClienteRapido(aoSalvar) { formCliente(null, aoSalvar, { rapido: true }); }

export async function montarDetalhe(el, id, vivo) {
  titulo('Cliente');
  const [c, fichas] = await Promise.all([obter('clientes', id), listar('fichas', { eq: { cliente_id: id }, semExcluidos: true, order: 'criado_em', desc: true })]);
  if (!vivo()) return;
  if (!c) { el.innerHTML = '<p class="vazio">Cliente não encontrado.</p>'; return; }
  titulo(c.nome);
  el.innerHTML = `
    <div class="cartao">
      <div class="campo-linha" style="align-items:center">${avatar(c.nome)}<div style="flex:1;min-width:0"><h2 style="font-size:20px">${esc(c.nome)}</h2>
        ${c.arquivado ? '<span class="selo alerta">arquivado</span>' : ''}</div></div>
      <div class="resumo">
        <span class="sub">WhatsApp</span><span>${esc(c.whatsapp || '—')}</span>
        <span class="sub">CPF/CNPJ</span><span>${esc(c.documento || '—')}</span>
        <span class="sub">Endereço</span><span>${esc(c.endereco || '—')}</span>
      </div>
      ${c.observacoes ? `<p class="sub" style="white-space:pre-wrap">${esc(c.observacoes)}</p>` : ''}
      <div class="botoes">
        ${c.whatsapp ? `<a class="btn btn-wpp" href="${linkWa(c.whatsapp, `Olá, ${c.nome.split(' ')[0]}!`)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        <a class="btn btn-primario" href="#orcamento/cliente:${c.id}">Novo orçamento</a>
        <button class="btn" id="c-editar">Editar</button>
      </div>
      <div class="botoes">
        <button class="btn" id="c-arquivar">${c.arquivado ? 'Desarquivar' : 'Arquivar'}</button>
        <button class="btn btn-perigo" id="c-excluir">Excluir</button>
      </div>
    </div>
    <p class="grupo-titulo">Histórico (${fichas.length})</p>
    ${fichas.length ? `<ul class="lista">${fichas.map(f => `<li><a class="lista-item" href="#pedido/${f.id}">
      <span class="meio"><span class="nome">Nº ${esc(f.numero ?? 'novo')} · ${esc(data(f.criado_em || new Date().toISOString()))}</span>
      <span class="det"><span class="etapa etapa-${f.etapa}">${esc(NOMES_ETAPA[f.etapa])}</span></span></span>
      <span class="fim valor">${moeda(f.total_centavos)}</span></a></li>`).join('')}</ul>` : '<p class="vazio">Sem orçamentos ou pedidos ainda.</p>'}`;

  el.querySelector('#c-editar').addEventListener('click', () => formCliente(c, () => montarDetalhe(el, id, vivo)));
  el.querySelector('#c-arquivar').addEventListener('click', async () => {
    try { await atualizar('clientes', id, { arquivado: !c.arquivado }); avisar(c.arquivado ? 'Cliente desarquivado' : 'Cliente arquivado'); montarDetalhe(el, id, vivo); }
    catch (err) { avisar(err.message, 'erro'); }
  });
  el.querySelector('#c-excluir').addEventListener('click', async () => {
    if (fichas.length) { avisar('Este cliente tem pedidos e não pode ser excluído. Arquive em vez disso.', 'erro'); return; }
    if (!await confirmar(`Excluir ${c.nome}?`, { ok: 'Excluir', perigo: true })) return;
    try { await excluir('clientes', id); avisar('Cliente excluído'); ir('clientes'); }
    catch (err) { avisar(err.message, 'erro'); }
  });
}
