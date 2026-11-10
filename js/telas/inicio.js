// Início: painel da gráfica — recebido, a receber, funil de pedidos, alertas, mais vendidos e melhores clientes.
import { listar } from '../db.js';
import { ETAPAS, NOMES_ETAPA, saldoAberto, calcularItem } from '../calc.js';
import { moeda, data, hojeISO } from '../formato.js';
import { esc, titulo } from '../ui.js';
import { contarNaoLidas } from './conversas.js';
import { NOMES_FORMA } from './receber.js';

const PERIODOS = [['7d', '7 dias'], ['30d', '30 dias'], ['12m', '12 meses']];
let periodo = '30d';

const DIA = 864e5;
const iso = d => new Date(d).toISOString().slice(0, 10);
const somaDias = (isoDia, n) => iso(Date.parse(isoDia + 'T12:00:00Z') + n * DIA);
const somaMeses = (isoDia, n) => { const d = new Date(isoDia + 'T12:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const compacto = c => { const v = c / 100; return v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : 'R$ ' + Math.round(v).toLocaleString('pt-BR'); };
const diaLocal = isoData => hojeISO(new Date(isoData));   // criado_em (UTC) → dia no fuso do aparelho

// Divide o período em colunas (dias ou meses) e diz onde começa o período anterior, para comparar.
function janela(hoje) {
  if (periodo === '12m') {
    const ini = somaMeses(hoje, -11);
    const cols = Array.from({ length: 12 }, (_, i) => { const d = somaMeses(ini, i); return { de: d, ate: somaDias(somaMeses(d, 1), -1), rotulo: MESES[+d.slice(5, 7) - 1], dica: `${MESES[+d.slice(5, 7) - 1]}/${d.slice(0, 4)}` }; });
    return { ini, fim: hoje, antIni: somaMeses(ini, -12), antFim: somaDias(ini, -1), cols, nome: 'últimos 12 meses', antes: 'os 12 meses anteriores' };
  }
  const n = periodo === '7d' ? 7 : 30;
  const ini = somaDias(hoje, -(n - 1));
  const cols = Array.from({ length: n }, (_, i) => { const d = somaDias(ini, i); return { de: d, ate: d, rotulo: `${d.slice(8, 10)}/${d.slice(5, 7)}`, dica: data(d) }; });
  return { ini, fim: hoje, antIni: somaDias(ini, -n), antFim: somaDias(ini, -1), cols, nome: `últimos ${n} dias`, antes: `os ${n} dias anteriores` };
}

const variacao = (agora, antes, nomeAntes) => {
  if (!antes) return agora ? '<span class="kpi-var">sem período anterior para comparar</span>' : '';
  const p = Math.round((agora - antes) / antes * 100);
  const cls = p > 0 ? 'sobe' : p < 0 ? 'desce' : '';
  return `<span class="kpi-var ${cls}">${p > 0 ? '▲' : p < 0 ? '▼' : '='} ${Math.abs(p)}% <span>contra ${esc(nomeAntes)}</span></span>`;
};

// Gráfico de colunas em SVG (uma série só). Toque ou passe o mouse para ver o valor.
function colunas(cols) {
  const W = 640, H = 170, pe = 22, topo = 14;
  const max = Math.max(...cols.map(c => c.valor), 1);
  const passo = W / cols.length, larg = Math.max(4, Math.min(34, passo - (cols.length > 14 ? 3 : 8)));
  const cada = cols.length > 14 ? Math.ceil(cols.length / 6) : cols.length > 8 ? 2 : 1;
  const iMax = cols.findIndex(c => c.valor === max);
  return `<div class="graf" role="img" aria-label="Recebido por ${periodo === '12m' ? 'mês' : 'dia'}">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <line class="graf-base" x1="0" x2="${W}" y1="${H - pe}" y2="${H - pe}"/>
      ${cols.map((c, i) => {
        const h = c.valor ? Math.max(3, (c.valor / max) * (H - pe - topo)) : 0;
        const x = i * passo + (passo - larg) / 2, y = H - pe - h, r = Math.min(4, larg / 2, h);
        const barra = h ? `<path class="graf-barra${i === cols.length - 1 ? ' atual' : ''}" d="M${x},${H - pe}V${y + r}Q${x},${y} ${x + r},${y}H${x + larg - r}Q${x + larg},${y} ${x + larg},${y + r}V${H - pe}Z"/>` : '';
        return `<g class="graf-col" data-i="${i}" tabindex="0">${barra}<rect class="graf-alvo" x="${i * passo}" y="0" width="${passo}" height="${H - pe}"/></g>`;
      }).join('')}
    </svg>
    <div class="graf-eixo">${cols.map((c, i) => `<span>${i % cada === 0 || i === cols.length - 1 ? esc(c.rotulo) : ''}</span>`).join('')}</div>
    ${max > 1 ? `<span class="graf-pico" style="left:${((iMax + .5) / cols.length) * 100}%">${esc(compacto(max))}</span>` : ''}
    <div class="graf-dica" hidden></div>
  </div>
  <details class="graf-tabela"><summary>Ver em tabela</summary><table><tbody>${cols.filter(c => c.valor).map(c => `<tr><td>${esc(c.dica)}</td><td class="valor">${moeda(c.valor)}</td></tr>`).join('') || '<tr><td>Nada recebido no período.</td></tr>'}</tbody></table></details>`;
}

const barraLinha = (rotulo, valorTxt, fracao, extra = '', href = '') => {
  const dentro = `<span class="rk-rotulo">${rotulo}</span><span class="valor">${valorTxt}</span><span class="rk-trilho"><span style="width:${fracao > 0 ? Math.max(2, Math.round(fracao * 100)) : 0}%"></span></span>${extra}`;
  return href ? `<a class="rk" href="${href}">${dentro}</a>` : `<div class="rk">${dentro}</div>`;
};

export async function montar(el, _p, vivo) {
  titulo('Início');
  const [fichas, pags, clientes, naoLidas] = await Promise.all([
    listar('fichas', { semExcluidos: true }), listar('pagamentos'), listar('clientes'), contarNaoLidas()]);
  if (!vivo()) return;
  const cli = new Map(clientes.map(c => [c.id, c]));
  const pagosPor = new Map();
  pags.forEach(p => pagosPor.set(p.ficha_id, [...(pagosPor.get(p.ficha_id) || []), p]));
  const hoje = hojeISO();
  const amanha = somaDias(hoje, 1);
  const saldo = f => saldoAberto(f.total_centavos, pagosPor.get(f.id));
  const pedidos = fichas.filter(f => !['orcamento', 'cancelado'].includes(f.etapa));
  const emAndamento = pedidos.filter(f => f.etapa !== 'entregue');
  const orcamentos = fichas.filter(f => f.etapa === 'orcamento');
  const aReceber = pedidos.reduce((s, f) => s + saldo(f), 0);
  const devendo = pedidos.filter(f => saldo(f) > 0).length;

  // alertas: o que precisa de ação agora
  const atrasados = emAndamento.filter(f => f.prazo && f.prazo < hoje);
  const venceLogo = emAndamento.filter(f => f.prazo && f.prazo >= hoje && f.prazo <= amanha);
  const prontosParados = pedidos.filter(f => f.etapa === 'pronto' && Date.now() - Date.parse(f.etapa_em || f.criado_em) > 3 * DIA);
  const orcParados = orcamentos.filter(f => f.total_centavos > 0 && Date.now() - Date.parse(f.atualizado_em || f.criado_em) > 2 * DIA);
  const orcSemValor = orcamentos.filter(f => !f.total_centavos);
  const alertas = [
    naoLidas && ['wpp', `${naoLidas} ${naoLidas === 1 ? 'mensagem não lida' : 'mensagens não lidas'} no WhatsApp`, '#conversas'],
    atrasados.length && ['erro', `${atrasados.length} ${atrasados.length === 1 ? 'pedido atrasado' : 'pedidos atrasados'}`, atrasados.length === 1 ? `#pedido/${atrasados[0].id}` : '#pedidos'],
    orcSemValor.length && ['alerta', `${orcSemValor.length} ${orcSemValor.length === 1 ? 'orçamento esperando' : 'orçamentos esperando'} você montar`, orcSemValor.length === 1 ? `#orcamento/${orcSemValor[0].id}` : '#pedidos/orcamento'],
    prontosParados.length && ['alerta', `${prontosParados.length} ${prontosParados.length === 1 ? 'pedido pronto' : 'pedidos prontos'} há mais de 3 dias sem retirada`, '#pedidos/pronto'],
    orcParados.length && ['info', `${orcParados.length} ${orcParados.length === 1 ? 'orçamento enviado' : 'orçamentos enviados'} há mais de 2 dias sem resposta`, '#pedidos/orcamento']
  ].filter(Boolean);

  const prazos = [...atrasados, ...venceLogo].sort((a, b) => a.prazo.localeCompare(b.prazo));
  const quando = p => p < hoje ? `<span style="color:var(--erro);font-weight:700">atrasado (${data(p)})</span>` : p === hoje ? '<b>hoje</b>' : 'amanhã';

  el.innerHTML = `
    <div class="atalhos">
      <a class="atalho laranja" href="#orcamento">Novo orçamento<small>calcula com os preços do site</small></a>
      <a class="atalho turquesa" href="#orcamento/novo-pedido">Novo pedido<small>já vira pedido ao salvar</small></a>
    </div>
    ${alertas.length ? `<section class="alertas" aria-label="Precisa de atenção">${alertas.map(([tipo, txt, href]) => `<a class="alerta-item ${tipo}" href="${href}"><span class="alerta-ponto" aria-hidden="true"></span><span>${esc(txt)}</span><span class="alerta-seta" aria-hidden="true">›</span></a>`).join('')}</section>` : ''}
    <div class="cabeca"><h2>Resumo</h2><div class="segmentado painel-periodo" role="group" aria-label="Período">${PERIODOS.map(([k, n]) => `<button type="button" data-per="${k}" aria-pressed="${k === periodo}">${n}</button>`).join('')}</div></div>
    <div id="painel"></div>
    <a class="btn btn-bloco" href="#desempenho">Ver gráficos de desempenho</a>
    <section class="cartao">
      <h3>Prazos de hoje e amanhã</h3>
      ${prazos.length ? `<ul class="lista">${prazos.map(f => `<li><a class="lista-item" href="#pedido/${f.id}">
        <span class="meio"><span class="nome">Nº ${esc(f.numero ?? 'novo')} · ${esc(cli.get(f.cliente_id)?.nome || '—')}</span>
        <span class="det"><span class="etapa etapa-${f.etapa}">${esc(NOMES_ETAPA[f.etapa])}</span> ${quando(f.prazo)}</span></span>
        <span class="fim valor">${moeda(f.total_centavos)}</span></a></li>`).join('')}</ul>` : '<p class="sub">Nada vencendo hoje ou amanhã.</p>'}
    </section>`;

  function painel() {
    const j = janela(hoje);
    const noPer = (d, a = j.ini, b = j.fim) => d >= a && d <= b;
    const pagosPer = pags.filter(p => noPer(p.pago_em));
    const recebido = pagosPer.reduce((s, p) => s + p.valor_centavos, 0);
    const recebidoAnt = pags.filter(p => noPer(p.pago_em, j.antIni, j.antFim)).reduce((s, p) => s + p.valor_centavos, 0);
    const cols = j.cols.map(c => ({ ...c, valor: pags.filter(p => p.pago_em >= c.de && p.pago_em <= c.ate).reduce((s, p) => s + p.valor_centavos, 0) }));

    const criadas = fichas.filter(f => noPer(diaLocal(f.criado_em)));
    const fechadas = criadas.filter(f => !['orcamento', 'cancelado'].includes(f.etapa));
    const vendido = fechadas.reduce((s, f) => s + f.total_centavos, 0);
    const criadasAnt = fichas.filter(f => noPer(diaLocal(f.criado_em), j.antIni, j.antFim));
    const fechadasAnt = criadasAnt.filter(f => !['orcamento', 'cancelado'].includes(f.etapa));
    const vendidoAnt = fechadasAnt.reduce((s, f) => s + f.total_centavos, 0);
    const conversao = criadas.length ? Math.round(fechadas.length / criadas.length * 100) : null;
    const ticket = fechadas.length ? Math.round(vendido / fechadas.length) : 0;

    // funil: quantos pedidos e quanto dinheiro parado em cada etapa (situação de agora)
    const funil = ETAPAS.filter(e => e !== 'entregue').map(e => { const l = fichas.filter(f => f.etapa === e); return { e, n: l.length, v: l.reduce((s, f) => s + f.total_centavos, 0) }; });
    const maxFunil = Math.max(...funil.map(x => x.n), 1);

    const porProduto = new Map(), porCliente = new Map(), porForma = new Map();
    for (const f of fechadas) {
      porCliente.set(f.cliente_id, (porCliente.get(f.cliente_id) || 0) + f.total_centavos);
      for (const it of f.itens || []) { const a = porProduto.get(it.nome) || { v: 0, q: 0 }; a.v += calcularItem(it).centavos; a.q += Number(it.quantidade) || 0; porProduto.set(it.nome, a); }
    }
    for (const p of pagosPer) porForma.set(p.forma, (porForma.get(p.forma) || 0) + p.valor_centavos);
    const topProd = [...porProduto].sort((a, b) => b[1].v - a[1].v).slice(0, 5);
    const topCli = [...porCliente].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const formas = [...porForma].sort((a, b) => b[1] - a[1]);

    el.querySelector('#painel').innerHTML = `
      <div class="kpis">
        <div class="cartao kpi"><span class="sub">Recebido · ${esc(j.nome)}</span><div class="kpi-num">${moeda(recebido)}</div>${variacao(recebido, recebidoAnt, j.antes)}</div>
        <a class="cartao kpi cartao-link" href="#receber"><span class="sub">A receber</span><div class="numero-grande kpi-num">${moeda(aReceber)}</div><span class="kpi-var">${devendo ? `${devendo} ${devendo === 1 ? 'pedido' : 'pedidos'} com valor em aberto` : 'nada em aberto'}</span></a>
        <div class="cartao kpi"><span class="sub">Vendido · ${esc(j.nome)}</span><div class="kpi-num">${moeda(vendido)}</div>${variacao(vendido, vendidoAnt, j.antes) || `<span class="kpi-var">${fechadas.length} ${fechadas.length === 1 ? 'pedido fechado' : 'pedidos fechados'}</span>`}</div>
        <a class="cartao kpi cartao-link" href="#pedidos"><span class="sub">Pedidos em andamento</span><div class="kpi-num">${emAndamento.length}</div><span class="kpi-var">${moeda(emAndamento.reduce((s, f) => s + f.total_centavos, 0))} em produção</span></a>
        <div class="cartao kpi"><span class="sub">Orçamentos que viraram pedido</span><div class="kpi-num">${conversao === null ? '—' : conversao + '%'}</div><span class="kpi-var">${criadas.length ? `${fechadas.length} de ${criadas.length} no período` : 'nenhum orçamento no período'}</span></div>
        <div class="cartao kpi"><span class="sub">Ticket médio</span><div class="kpi-num">${fechadas.length ? moeda(ticket) : '—'}</div><span class="kpi-var">${fechadas.length ? 'valor médio por pedido fechado' : 'sem pedidos no período'}</span></div>
      </div>
      <section class="cartao">
        <h3>Recebido por ${periodo === '12m' ? 'mês' : 'dia'}</h3>
        ${recebido ? colunas(cols) : '<p class="sub">Nenhum pagamento registrado neste período. Quando você registrar um sinal ou pagamento, ele aparece aqui.</p>'}
      </section>
      <section class="cartao">
        <h3>Onde estão os pedidos agora</h3>
        <div class="rks">${funil.map(x => barraLinha(`<span class="etapa etapa-${x.e}">${esc(NOMES_ETAPA[x.e])}</span> <b>${x.n}</b>`, x.n ? moeda(x.v) : '', x.n / maxFunil, '', `#pedidos/${x.e}`)).join('')}</div>
      </section>
      <div class="painel-2">
        <section class="cartao">
          <h3>Mais vendidos</h3>
          ${topProd.length ? `<div class="rks">${topProd.map(([nome, a]) => barraLinha(esc(nome), moeda(a.v), a.v / topProd[0][1].v, `<span class="rk-det">${a.q} un.</span>`)).join('')}</div>` : '<p class="sub">Sem pedidos fechados no período.</p>'}
        </section>
        <section class="cartao">
          <h3>Melhores clientes</h3>
          ${topCli.length ? `<div class="rks">${topCli.map(([id, v]) => barraLinha(esc(cli.get(id)?.nome || '—'), moeda(v), v / topCli[0][1], '', `#cliente/${id}`)).join('')}</div>` : '<p class="sub">Sem pedidos fechados no período.</p>'}
        </section>
      </div>
      <section class="cartao">
        <h3>Como os clientes pagaram</h3>
        ${formas.length ? `<div class="rks">${formas.map(([f, v]) => barraLinha(esc(NOMES_FORMA[f] || f), moeda(v), v / formas[0][1], `<span class="rk-det">${Math.round(v / recebido * 100)}%</span>`)).join('')}</div>` : '<p class="sub">Nenhum pagamento no período.</p>'}
      </section>`;

    // dica do gráfico (toque, mouse ou teclado)
    const graf = el.querySelector('.graf');
    if (graf) {
      const dica = graf.querySelector('.graf-dica');
      const mostrar = g => {
        const c = cols[+g.dataset.i];
        dica.innerHTML = `<b>${moeda(c.valor)}</b><span>${esc(c.dica)}</span>`;
        dica.hidden = false;
        const fr = (+g.dataset.i + .5) / cols.length;
        dica.style.left = `clamp(60px, ${fr * 100}%, calc(100% - 60px))`;
        graf.querySelectorAll('.graf-col').forEach(x => x.classList.toggle('foco', x === g));
      };
      const esconder = () => { dica.hidden = true; graf.querySelectorAll('.graf-col').forEach(x => x.classList.remove('foco')); };
      graf.querySelectorAll('.graf-col').forEach(g => {
        g.addEventListener('pointerenter', () => mostrar(g));
        g.addEventListener('click', () => mostrar(g));
        g.addEventListener('focus', () => mostrar(g));
      });
      graf.addEventListener('pointerleave', esconder);
    }
  }

  el.querySelector('.painel-periodo').addEventListener('click', e => {
    const b = e.target.closest('[data-per]'); if (!b) return;
    periodo = b.dataset.per;
    el.querySelectorAll('[data-per]').forEach(x => x.setAttribute('aria-pressed', x === b));
    painel();
  });
  painel();
}
