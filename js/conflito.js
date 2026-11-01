// Quando a mesma ficha foi mudada em outro aparelho: mostra as duas versões e deixa escolher.
import { moeda, data } from './formato.js';
import { NOMES_ETAPA } from './calc.js';
import { esc, abrirModal, fecharModal } from './ui.js';

const linha = f => `
  <div class="resumo">
    <span class="sub">Etapa</span><span>${esc(NOMES_ETAPA[f.etapa] || '—')}</span>
    <span class="sub">Itens</span><span>${(f.itens || []).length}</span>
    <span class="sub">Total</span><span class="valor">${moeda(f.total_centavos)}</span>
    <span class="sub">Prazo</span><span>${f.prazo ? data(f.prazo) : '—'}</span>
    <span class="sub">Observações</span><span>${esc(f.observacoes || '—')}</span>
  </div>`;

// Devolve 'meu' (salvar por cima) ou 'outro' (descartar o que foi feito aqui).
export function escolherVersao(minha, outra) {
  return new Promise(resolve => {
    let r = 'outro';
    const caixa = abrirModal(`
      <h2>Esta ficha mudou em outro aparelho</h2>
      <p class="sub">Escolha qual versão fica.</p>
      <div class="cartao"><h3>No outro aparelho</h3>${linha(outra)}</div>
      <div class="cartao"><h3>Neste aparelho</h3>${linha(minha)}</div>
      <div class="botoes">
        <button class="btn" data-v="outro">Manter a do outro aparelho</button>
        <button class="btn btn-primario" data-v="meu">Manter a minha</button>
      </div>`, { fechar: () => resolve(r) });
    caixa.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { r = b.dataset.v; fecharModal(); } });
  });
}
