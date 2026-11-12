// Troca de tela pelo #hash da URL.
import { modalSujo, segurarModal, fecharModal, confirmar } from './ui.js';

const rotas = {};
const SECAO = { balcao: 'inicio', desempenho: 'inicio', conversa: 'conversas', pedido: 'pedidos', cliente: 'clientes', receber: 'mais', historico: 'mais', produtos: 'mais', configuracoes: 'mais', lixeira: 'mais' };

export function registrar(nome, def) { rotas[nome] = def; }
export function ir(nome, params) {
  const h = '#' + (params ? `${nome}/${params}` : nome);
  if (h !== location.hash) pulaGuarda = true;   // navegação pedida pelo próprio app não pergunta nada
  location.hash = h;
}
export function rotaAtual() { return (location.hash.slice(1) || 'inicio').split('/'); }

// Proteção contra sair sem salvar: a tela aberta diz se tem coisa pendente.
// Vale para o botão voltar (celular e mouse), links do menu e fechar/recarregar a aba.
let guarda = null, pulaGuarda = false, desfazendo = false;
export function protegerSaida(temPendente) { guarda = temPendente; }
const pendente = () => { try { return !!guarda?.(); } catch { return false; } };

function desfazer(e) { desfazendo = true; location.hash = new URL(e.oldURL).hash || '#inicio'; }

async function aoTrocarHash(e) {
  if (desfazendo) { desfazendo = false; return; }
  if (pulaGuarda) { pulaGuarda = false; render(); return; }
  const destino = location.hash;
  // Caixa aberta com coisa digitada: não sai, avisa. Caixa vazia: fecha e segue.
  if (modalSujo()) { desfazer(e); segurarModal(); return; }
  fecharModal();
  if (pendente()) {
    desfazer(e);
    if (!await confirmar('Você tem um orçamento sem salvar. Sair mesmo assim?', { ok: 'Sair sem salvar', cancelar: 'Continuar aqui', perigo: true })) return;
    guarda = null;
    pulaGuarda = true; location.hash = destino;
    return;
  }

  render();
}

let versao = 0;
async function render() {
  guarda = null;
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
export function iniciar() {
  addEventListener('hashchange', aoTrocarHash);
  addEventListener('beforeunload', e => { if (modalSujo() || pendente()) { e.preventDefault(); e.returnValue = ''; } });
  render();
}
