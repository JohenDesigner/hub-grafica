// Peças de interface usadas por todas as telas.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let tToast;
export function avisar(texto, tipo = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = texto;
  t.className = `toast mostrar ${tipo === 'ok' ? '' : tipo}`;
  clearTimeout(tToast);
  tToast = setTimeout(() => { t.className = 'toast'; }, 3000);
}

let aoFechar = null, sujo = false, apertouFora = false;
// true quando a caixa aberta tem algo digitado/escolhido que ainda não foi salvo.
export function modalSujo() { return !document.getElementById('modal').hidden && sujo; }
// Avisa sem fechar: a caixa dá uma balançada e aparece a dica.
export function segurarModal() {
  const c = document.querySelector('#modal .modal-caixa');
  c?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 250 });
  avisar('Para fechar sem salvar, toque no X', 'erro');
}
export function abrirModal(html, { fechar } = {}) {
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="modal-caixa" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false;
  aoFechar = fechar || null;
  sujo = false;
  m.oninput = m.onchange = () => { sujo = true; };
  // Só fecha clicando fora se o clique COMEÇOU fora (selecionar texto e soltar fora não fecha mais)
  // e se não tiver nada digitado na caixa.
  m.onpointerdown = e => { apertouFora = e.target === m; };
  m.onclick = e => {
    if (e.target !== m || !apertouFora) return;
    apertouFora = false;
    if (sujo) segurarModal(); else fecharModal();
  };
  m.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', () => fecharModal()));
  const foco = m.querySelector('input,select,textarea,button:not([data-fechar])');
  if (foco && matchMedia('(min-width: 900px)').matches) foco.focus();
  return m.firstElementChild;
}

export function fecharModal() {
  const m = document.getElementById('modal');
  if (m.hidden) return;
  m.hidden = true;
  m.innerHTML = '';
  sujo = false;
  const f = aoFechar; aoFechar = null;
  if (f) f();
}

export function confirmar(texto, { ok = 'Confirmar', perigo = false, cancelar = 'Cancelar' } = {}) {
  return new Promise(resolve => {
    let resposta = false;
    const caixa = abrirModal(`
      <p style="font-size:17px;margin:0">${esc(texto)}</p>
      <div class="botoes">
        <button class="btn" data-fechar>${esc(cancelar)}</button>
        <button class="btn ${perigo ? 'btn-perigo' : 'btn-primario'}" data-ok>${esc(ok)}</button>
      </div>`, { fechar: () => resolve(resposta) });
    caixa.querySelector('[data-ok]').addEventListener('click', () => { resposta = true; fecharModal(); });
  });
}

export function atualizarPendentes(n) {
  const el = document.getElementById('pendentes');
  if (!el) return;
  el.hidden = !(n > 0);
  el.textContent = n === 1 ? '1 alteração pendente de envio' : `${n} alterações pendentes de envio`;
}

export function titulo(t) {
  document.getElementById('titulo').textContent = t;
  document.title = `${t} · Hub Johen`;
}

const carregados = {};
export function carregarScript(src) {
  if (!carregados[src]) carregados[src] = new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => falha(new Error('Não carregou ' + src));
    document.head.appendChild(s);
  });
  return carregados[src];
}

export const ICONE = {
  voltar: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  fechar: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  mais: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  lixo: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
  editar: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  seta: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  atualizar: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>'
};

// Lê um formulário como objeto simples.
export function lerForm(form) {
  const d = {};
  new FormData(form).forEach((v, k) => { d[k] = typeof v === 'string' ? v.trim() : v; });
  return d;
}
