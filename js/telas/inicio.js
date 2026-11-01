// Início: a receber, pedidos por etapa e prazos de hoje e amanhã.
import { listar } from '../db.js';
import { ETAPAS, NOMES_ETAPA, saldoAberto } from '../calc.js';
import { moeda, data, hojeISO } from '../formato.js';
import { esc, titulo } from '../ui.js';

export async function montar(el, _p, vivo) {
  titulo('Início');
  const [fichas, pags, clientes] = await Promise.all([
    listar('fichas', { semExcluidos: true }), listar('pagamentos'), listar('clientes')]);
  if (!vivo()) return;
  const cli = new Map(clientes.map(c => [c.id, c]));
  const pagosPor = new Map();
  pags.forEach(p => pagosPor.set(p.ficha_id, [...(pagosPor.get(p.ficha_id) || []), p]));
  const ativos = fichas.filter(f => !['orcamento', 'cancelado'].includes(f.etapa));
  const aReceber = ativos.reduce((s, f) => s + saldoAberto(f.total_centavos, pagosPor.get(f.id)), 0);
  const devendo = ativos.filter(f => saldoAberto(f.total_centavos, pagosPor.get(f.id)) > 0).length;
  const hoje = hojeISO();
  const amanha = new Date(Date.parse(hoje + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
  const prazos = fichas.filter(f => f.prazo && f.prazo <= amanha && !['entregue', 'cancelado', 'orcamento'].includes(f.etapa))
    .sort((a, b) => a.prazo.localeCompare(b.prazo));
  const quando = p => p < hoje ? `<span style="color:var(--erro);font-weight:700">atrasado (${data(p)})</span>` : p === hoje ? '<b>hoje</b>' : 'amanhã';

  el.innerHTML = `
    <div class="atalhos">
      <a class="atalho laranja" href="#orcamento">Novo orçamento<small>calcula com os preços do site</small></a>
      <a class="atalho turquesa" href="#orcamento/novo-pedido">Novo pedido<small>já vira pedido ao salvar</small></a>
    </div>
    <a class="cartao cartao-link" href="#receber">
      <span class="sub">A receber</span>
      <div class="numero-grande">${moeda(aReceber)}</div>
      <span class="sub">${devendo ? `${devendo} ${devendo === 1 ? 'pedido' : 'pedidos'} com valor em aberto` : 'nada em aberto'}</span>
    </a>
    <section class="cartao">
      <h3>Pedidos por etapa</h3>
      <div class="botoes">${ETAPAS.map(e => {
        const n = fichas.filter(f => f.etapa === e).length;
        return `<a class="btn btn-peq" href="#pedidos/${e}" style="flex:0 0 auto"><span class="etapa etapa-${e}">${esc(NOMES_ETAPA[e])}</span> <b>${n}</b></a>`;
      }).join('')}</div>
    </section>
    <section class="cartao">
      <h3>Prazos de hoje e amanhã</h3>
      ${prazos.length ? `<ul class="lista">${prazos.map(f => `<li><a class="lista-item" href="#pedido/${f.id}">
        <span class="meio"><span class="nome">Nº ${esc(f.numero ?? 'novo')} · ${esc(cli.get(f.cliente_id)?.nome || '—')}</span>
        <span class="det"><span class="etapa etapa-${f.etapa}">${esc(NOMES_ETAPA[f.etapa])}</span> ${quando(f.prazo)}</span></span>
        <span class="fim valor">${moeda(f.total_centavos)}</span></a></li>`).join('')}</ul>` : '<p class="sub">Nada vencendo hoje ou amanhã.</p>'}
    </section>`;
}
