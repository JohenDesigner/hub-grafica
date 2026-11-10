// Desempenho: gráficos de vendas, pedidos, clientes e atendimento no WhatsApp.
import { listar } from '../db.js';
import { moeda, hojeISO } from '../formato.js';
import { esc, titulo } from '../ui.js';
import { colunas, ligarDicas } from '../grafico.js';

const DIA = 864e5;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const iso = d => new Date(d).toISOString().slice(0, 10);
const diaLocal = isoData => hojeISO(new Date(isoData));
const mesDe = d => d.slice(0, 7);
const compacto = c => { const v = c / 100; return v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : 'R$ ' + Math.round(v).toLocaleString('pt-BR'); };
const duracao = min => min < 1 ? 'menos de 1 min' : min < 60 ? `${Math.round(min)} min` : min < 1440 ? `${(min / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` : `${(min / 1440).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`;
const fechada = f => !['orcamento', 'cancelado'].includes(f.etapa);
const tile = (rotulo, valor, det) => `<div class="cartao kpi"><span class="sub">${esc(rotulo)}</span><div class="kpi-num">${valor}</div><span class="kpi-var">${det}</span></div>`;

export async function montar(el, _p, vivo) {
  titulo('Desempenho');
  const [fichas, pagsPedidos, clientes, msgs, balcao] = await Promise.all([
    listar('fichas', { semExcluidos: true }), listar('pagamentos'), listar('clientes'),
    listar('whatsapp_mensagens', { order: 'criado_em' }), listar('vendas_balcao').catch(() => [])]);
  const pags = [...pagsPedidos, ...balcao.map(v => ({ pago_em: v.vendido_em, valor_centavos: v.total_centavos }))];
  if (!vivo()) return;
  const hoje = hojeISO();

  // últimos 12 meses
  const meses = Array.from({ length: 12 }, (_, i) => { const d = new Date(hoje + 'T12:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 11 + i); const k = iso(d).slice(0, 7); return { k, rotulo: MESES[+k.slice(5) - 1], dica: `${MESES[+k.slice(5) - 1]}/${k.slice(0, 4)}` }; });
  const soma = (lista, fn) => lista.reduce((s, x) => s + fn(x), 0);
  const fech = fichas.filter(fechada);
  const porMes = meses.map(m => {
    const criadas = fichas.filter(f => mesDe(diaLocal(f.criado_em)) === m.k);
    const fe = criadas.filter(fechada);
    return { ...m, vendido: soma(fe, f => f.total_centavos), recebido: soma(pags.filter(p => mesDe(p.pago_em) === m.k), p => p.valor_centavos),
      pedidos: fe.length, orcamentos: criadas.length, novos: clientes.filter(c => mesDe(diaLocal(c.criado_em)) === m.k).length };
  });
  const mesAtual = porMes[11], mesPassado = porMes[10];
  const comp = (a, b) => !b ? 'sem mês anterior para comparar' : `${a >= b ? '▲' : '▼'} ${Math.abs(Math.round((a - b) / b * 100))}% contra ${mesPassado.rotulo} (${compacto(b)})`;

  // dia da semana (últimos 90 dias)
  const ini90 = iso(Date.parse(hoje + 'T12:00:00Z') - 89 * DIA);
  const semana = SEMANA.map((n, i) => ({ rotulo: n, dica: n, valores: [fichas.filter(f => { const d = diaLocal(f.criado_em); return d >= ini90 && new Date(d + 'T12:00:00').getDay() === i; }).length] }));

  // tempo até a entrega
  const entregues = fichas.filter(f => f.etapa === 'entregue' && f.etapa_em);
  const diasEntrega = entregues.length ? soma(entregues, f => Date.parse(f.etapa_em) - Date.parse(f.criado_em)) / entregues.length / DIA : null;
  const conv12 = soma(porMes, m => m.orcamentos) ? Math.round(soma(porMes, m => m.pedidos) / soma(porMes, m => m.orcamentos) * 100) : null;
  const recorrentes = new Map(); fech.forEach(f => recorrentes.set(f.cliente_id, (recorrentes.get(f.cliente_id) || 0) + 1));
  const voltaram = [...recorrentes.values()].filter(n => n > 1).length;

  // WhatsApp (últimos 30 dias)
  const ini30 = Date.parse(hoje + 'T00:00:00') - 29 * DIA;
  const m30 = msgs.filter(m => Date.parse(m.criado_em) >= ini30);
  const dias30 = Array.from({ length: 30 }, (_, i) => { const d = hojeISO(new Date(ini30 + i * DIA + 12 * 3600e3)); return { d, rotulo: `${d.slice(8, 10)}/${d.slice(5, 7)}`, dica: `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` }; });
  const waDia = dias30.map(x => ({ ...x, valores: [m30.filter(m => m.direcao === 'recebida' && diaLocal(m.criado_em) === x.d).length] }));
  const recebidas = m30.filter(m => m.direcao === 'recebida');
  const pessoas = new Set(recebidas.map(m => m.telefone)).size;
  const daIA = m30.filter(m => m.tipo === 'ia').length, suas = m30.filter(m => m.direcao === 'enviada' && m.tipo === 'text').length;
  // tempo da sua primeira resposta (humana) depois de uma mensagem do cliente
  const esperas = [];
  const porTel = new Map(); m30.forEach(m => porTel.set(m.telefone, [...(porTel.get(m.telefone) || []), m]));
  for (const lista of porTel.values()) {
    let pendente = null;
    for (const m of lista) {
      if (m.direcao === 'recebida') { pendente ??= Date.parse(m.criado_em); }
      else if (m.tipo === 'text' && pendente) { esperas.push((Date.parse(m.criado_em) - pendente) / 60000); pendente = null; }
    }
  }
  const esperaMedia = esperas.length ? esperas.reduce((a, b) => a + b, 0) / esperas.length : null;

  el.innerHTML = `
    <div class="cabeca"><h2>Desempenho</h2><a class="btn btn-peq" href="#inicio">Voltar ao início</a></div>
    <div class="kpis">
      ${tile(`Vendido em ${mesAtual.rotulo}`, moeda(mesAtual.vendido), comp(mesAtual.vendido, mesPassado.vendido))}
      ${tile(`Recebido em ${mesAtual.rotulo}`, moeda(mesAtual.recebido), comp(mesAtual.recebido, mesPassado.recebido))}
      ${tile('Orçamentos que viram pedido', conv12 === null ? '—' : conv12 + '%', 'nos últimos 12 meses')}
      ${tile('Tempo até a entrega', diasEntrega === null ? '—' : `${diasEntrega.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`, entregues.length ? `média de ${entregues.length} ${entregues.length === 1 ? 'pedido entregue' : 'pedidos entregues'}` : 'nenhum pedido entregue ainda')}
      ${tile('Clientes que voltaram', recorrentes.size ? `${Math.round(voltaram / recorrentes.size * 100)}%` : '—', recorrentes.size ? `${voltaram} de ${recorrentes.size} compraram mais de uma vez` : 'sem pedidos fechados')}
      ${tile('Total de clientes', clientes.filter(c => !c.arquivado).length, `${mesAtual.novos} ${mesAtual.novos === 1 ? 'novo' : 'novos'} em ${mesAtual.rotulo}`)}
    </div>
    <section class="cartao"><h3>Vendido e recebido por mês</h3>
      <p class="sub">Vendido = pedidos fechados no mês. Recebido = dinheiro que entrou (pedidos e balcão).</p>
      ${colunas(porMes.map(m => ({ rotulo: m.rotulo, dica: m.dica, valores: [m.vendido, m.recebido] })), { series: [{ nome: 'Vendido', cor: 'a' }, { nome: 'Recebido', cor: 'b' }], formato: moeda, aria: 'Vendido e recebido por mês' })}</section>
    <div class="painel-2">
      <section class="cartao"><h3>Pedidos fechados por mês</h3>
        ${colunas(porMes.map(m => ({ rotulo: m.rotulo, dica: m.dica, valores: [m.pedidos] })), { series: [{ nome: 'Pedidos', cor: 'a' }], aria: 'Pedidos fechados por mês' })}</section>
      <section class="cartao"><h3>Clientes novos por mês</h3>
        ${colunas(porMes.map(m => ({ rotulo: m.rotulo, dica: m.dica, valores: [m.novos] })), { series: [{ nome: 'Clientes novos', cor: 'a' }], aria: 'Clientes novos por mês' })}</section>
    </div>
    <section class="cartao"><h3>Dias da semana com mais pedidos</h3>
      <p class="sub">Orçamentos e pedidos criados nos últimos 90 dias.</p>
      ${colunas(semana, { series: [{ nome: 'Pedidos', cor: 'a' }], aria: 'Pedidos por dia da semana' })}</section>
    <h2 style="font-size:20px">Atendimento no WhatsApp · últimos 30 dias</h2>
    <div class="kpis">
      ${tile('Pessoas que chamaram', pessoas, `${recebidas.length} ${recebidas.length === 1 ? 'mensagem recebida' : 'mensagens recebidas'}`)}
      ${tile('Seu tempo de resposta', esperaMedia === null ? '—' : duracao(esperaMedia), esperas.length ? `média de ${esperas.length} ${esperas.length === 1 ? 'resposta sua' : 'respostas suas'}` : 'você ainda não respondeu pelo hub')}
      ${tile('Respostas da IA', daIA, `${suas} ${suas === 1 ? 'resposta sua' : 'respostas suas'} no mesmo período`)}
    </div>
    <section class="cartao"><h3>Mensagens recebidas por dia</h3>
      ${colunas(waDia, { series: [{ nome: 'Mensagens', cor: 'a' }], aria: 'Mensagens recebidas por dia' })}</section>`;
  ligarDicas(el);
}
