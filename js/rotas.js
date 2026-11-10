// Troca de tela pelo #hash da URL.
const rotas = {};
const SECAO = { desempenho: 'inicio', conversa: 'conversas', pedido: 'pedidos', cliente: 'clientes', receber: 'mais', produtos: 'mais', configuracoes: 'mais', lixeira: 'mais' };

export function registrar(nome, def) { rotas[nome] = def; }
export function ir(nome, params) { location.hash = params ? `${nome}/${params}` : nome; }
export function rotaAtual() { return (location.hash.slice(1) || 'inicio').split('/'); }

let versao = 0;
async function render() {
  const [nome, param] = rotaAtual();
  const r = rotas[nome] || rotas.inicio;
  const secao = SECAO[nome] || nome;
  document.querySelectorAll('#nav a').forEach(a => {
    const ativo = a.dataset.rota === secao;
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const el = document.getElementById('tela');
  const minha = ++versao;
  el.innerHTML = '<p class="vazio">Carregando…</p>';
  window.scrollTo(0, 0);
  try {
    await r.montar(el, param ? decodeURIComponent(param) : undefined, () => minha === versao);
  } catch (e) {
    console.error(e);
    if (minha === versao) el.innerHTML = `<div class="cartao"><p>Não foi possível abrir esta tela.</p><p class="sub">${String(e.message || e).replace(/</g, '&lt;')}</p><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`;
  }
}

export function recarregar() { render(); }
export function iniciar() { addEventListener('hashchange', render); render(); }
