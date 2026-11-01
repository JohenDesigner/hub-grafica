// A receber: quem deve e quanto. Também o registro de pagamento usado no orçamento e no pedido.
import { listar, salvar, atualizar } from '../db.js';
import { saldoAberto, validarPagamento, emCentavos, NOMES_ETAPA } from '../calc.js';
import { moeda, data, lerNumero, hojeISO } from '../formato.js';
import { mensagem, linkWa } from '../whatsapp.js';
import { esc, avisar, confirmar, abrirModal, fecharModal, titulo } from '../ui.js';
import { carregarCfg } from './configuracoes.js';

export const NOMES_FORMA = { pix: 'Pix', debito: 'Débito', credito: 'Crédito', dinheiro: 'Dinheiro' };

// Abre o modal de pagamento. Resolve true se gravou.
export async function registrarPagamento(ficha, { tipo } = {}) {
  const pags = await listar('pagamentos', { eq: { ficha_id: ficha.id } });
  const saldo = saldoAberto(ficha.total_centavos, pags);
  if (saldo <= 0) { avisar('Este pedido já está quitado'); return false; }
  let forma = 'pix';
  let tipoPag = tipo || (ficha.etapa === 'orcamento' ? 'sinal' : 'pagamento');
  return new Promise(resolve => {
    let gravou = false;
    const caixa = abrirModal(`
      <div class="modal-topo"><h2>Registrar pagamento</h2></div>
      <p class="sub">Pedido nº ${esc(ficha.numero ?? 'novo')} · falta receber <b class="valor">${moeda(saldo)}</b></p>
      <form id="f-pag">
        <label class="campo"><span>Valor R$</span><input name="valor" inputmode="decimal" value="${(saldo / 100).toFixed(2).replace('.', ',')}" required></label>
        <div class="campo" style="margin-top:12px"><span>Forma</span><div class="segmentado" id="pg-forma">
          ${Object.entries(NOMES_FORMA).map(([k, v]) => `<button type="button" data-forma="${k}" aria-pressed="${k === forma}">${v}</button>`).join('')}</div></div>
        <div class="campo" style="margin-top:12px"><span>Tipo</span><div class="segmentado" id="pg-tipo">
          <button type="button" data-tipo="sinal" aria-pressed="${tipoPag === 'sinal'}">Sinal</button>
          <button type="button" data-tipo="pagamento" aria-pressed="${tipoPag === 'pagamento'}">Pagamento</button></div></div>
        <label class="campo" style="margin-top:12px"><span>Data</span><input name="pago_em" type="date" value="${hojeISO()}" required></label>
        <div class="botoes" style="margin-top:16px"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn btn-primario" type="submit">Registrar</button></div>
      </form>`, { fechar: () => { if (!gravou) resolve(false); } });
    caixa.querySelector('#pg-forma').addEventListener('click', e => { const b = e.target.closest('[data-forma]'); if (!b) return; forma = b.dataset.forma; caixa.querySelectorAll('[data-forma]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    caixa.querySelector('#pg-tipo').addEventListener('click', e => { const b = e.target.closest('[data-tipo]'); if (!b) return; tipoPag = b.dataset.tipo; caixa.querySelectorAll('[data-tipo]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    caixa.querySelector('#f-pag').addEventListener('submit', async e => {
      e.preventDefault();
      const valor = emCentavos(lerNumero(e.target.valor.value));
      const erro = validarPagamento(valor, saldo);
      if (erro) { avisar(erro, 'erro'); return; }
      const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
      try {
        await salvar('pagamentos', { ficha_id: ficha.id, valor_centavos: valor, forma, tipo: tipoPag, pago_em: e.target.pago_em.value });
        gravou = true;
        fecharModal();
        avisar(valor === saldo ? 'Pagamento registrado — pedido quitado' : 'Pagamento registrado');
        if (ficha.etapa === 'orcamento' && await confirmar('Mudar este orçamento para Sinal pago?', { ok: 'Mudar para Sinal pago', cancelar: 'Deixar em Orçamento' })) {
          await atualizar('fichas', ficha.id, { etapa: 'sinal' });
          ficha.etapa = 'sinal';
        }
        resolve(true);
      } catch (err) {
        if (gravou) { avisar(err.message, 'erro'); resolve(true); return; }
        btn.disabled = false; avisar(err.message, 'erro');
      }
    });
  });
}

// Fichas com valor em aberto (não conta orçamento, cancelado nem excluído).
export async function emAberto() {
  const [fichas, pags, clientes] = await Promise.all([
    listar('fichas', { semExcluidos: true }), listar('pagamentos'), listar('clientes')]);
  const porFicha = new Map();
  pags.forEach(p => { if (!porFicha.has(p.ficha_id)) porFicha.set(p.ficha_id, []); porFicha.get(p.ficha_id).push(p); });
  const cli = new Map(clientes.map(c => [c.id, c]));
  return fichas.filter(f => !['orcamento', 'cancelado'].includes(f.etapa))
    .map(f => ({ ficha: f, cliente: cli.get(f.cliente_id) || { nome: '—' }, saldo: saldoAberto(f.total_centavos, porFicha.get(f.id)) }))
    .filter(x => x.saldo > 0)
    .sort((a, b) => (a.ficha.prazo || '9999').localeCompare(b.ficha.prazo || '9999'));
}

export async function montar(el, _p, vivo) {
  titulo('A receber');
  const [lista, cfg] = await Promise.all([emAberto(), carregarCfg()]);
  if (!vivo()) return;
  const total = lista.reduce((s, x) => s + x.saldo, 0);
  const hoje = hojeISO();
  el.innerHTML = `
    <div class="cartao"><span class="sub">Total a receber</span><div class="numero-grande">${moeda(total)}</div>
      <span class="sub">${lista.length} ${lista.length === 1 ? 'pedido' : 'pedidos'} em aberto</span></div>
    ${lista.length ? `<ul class="lista">${lista.map(({ ficha: f, cliente: c, saldo }) => `<li>
      <div class="lista-item" style="flex-wrap:wrap;cursor:default">
        <a class="meio" href="#pedido/${f.id}" style="text-decoration:none;color:inherit">
          <span class="nome">${esc(c.nome)} · nº ${esc(f.numero ?? 'novo')}</span>
          <span class="det"><span class="etapa etapa-${f.etapa}">${esc(NOMES_ETAPA[f.etapa])}</span>
            ${f.prazo ? ` prazo <span style="${f.prazo < hoje ? 'color:var(--erro);font-weight:700' : ''}">${data(f.prazo)}</span>` : ''}</span></a>
        <span class="fim valor">${moeda(saldo)}</span>
        <div class="botoes" style="width:100%">
          <button class="btn btn-peq" data-pagar="${f.id}">Registrar pagamento</button>
          ${c.whatsapp ? `<a class="btn btn-peq btn-wpp" target="_blank" rel="noopener" href="${linkWa(c.whatsapp, mensagem('cobranca', { ficha: f, cliente: c, cfg, saldo }))}">Cobrar</a>` : ''}
        </div></div></li>`).join('')}</ul>`
    : '<p class="vazio">Ninguém devendo. Tudo quitado!</p>'}`;
  el.querySelector('.lista')?.addEventListener('click', async e => {
    const b = e.target.closest('[data-pagar]'); if (!b) return;
    const item = lista.find(x => x.ficha.id === b.dataset.pagar);
    if (await registrarPagamento(item.ficha)) montar(el, _p, vivo);
  });
}
