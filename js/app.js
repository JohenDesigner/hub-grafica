// Ponto de entrada: login, fila offline, service worker e rotas.
import { usuarioAtual, entrar, chamar, aoMudarPendentes, pendentes, enviarPendentes, pedirTrocaDeSenha, trocarSenha, aoPedirNovaSenha } from './db.js';
import { atualizarPendentes, abrirModal, fecharModal, avisar } from './ui.js';
import { iniciar, registrar } from './rotas.js';
import * as inicio from './telas/inicio.js';
import * as orcamento from './telas/orcamento.js';
import * as pedidos from './telas/pedidos.js';
import * as clientes from './telas/clientes.js';
import * as receber from './telas/receber.js';
import * as produtos from './telas/produtos.js';
import * as configuracoes from './telas/configuracoes.js';
import * as conversas from './telas/conversas.js';
import * as desempenho from './telas/desempenho.js';
import * as balcao from './telas/balcao.js';

registrar('inicio', { montar: inicio.montar });
registrar('orcamento', { montar: orcamento.montar });
registrar('pedidos', { montar: pedidos.montarLista });
registrar('pedido', { montar: pedidos.montarDetalhe });
registrar('clientes', { montar: clientes.montarLista });
registrar('cliente', { montar: clientes.montarDetalhe });
registrar('receber', { montar: receber.montar });
registrar('produtos', { montar: produtos.montar });
registrar('mais', { montar: configuracoes.montarMais });
registrar('configuracoes', { montar: configuracoes.montar });
registrar('balcao', { montar: balcao.montar });
registrar('desempenho', { montar: desempenho.montar });
registrar('conversas', { montar: conversas.montarLista });
registrar('conversa', { montar: conversas.montarConversa });

// Botão flutuante do Balcão: abre por cima da tela atual (o orçamento aberto não se perde).
let painelVersao = 0;
function abrirPainelBalcao() {
  const p = document.getElementById('painel-balcao');
  const minha = ++painelVersao;
  p.hidden = false; document.body.classList.add('com-painel');
  document.getElementById('fab-balcao').hidden = true;
  balcao.montar(document.getElementById('painel-conteudo'), undefined, () => minha === painelVersao && !p.hidden,
    { painel: true, aoRegistrar: () => setTimeout(fecharPainelBalcao, 900) })
    .catch(e => { document.getElementById('painel-conteudo').innerHTML = `<p class="vazio">${String(e.message || e).replace(/</g, '&lt;')}</p>`; });
}
function fecharPainelBalcao() {
  const p = document.getElementById('painel-balcao');
  if (p.hidden) return;
  painelVersao++; p.hidden = true; document.body.classList.remove('com-painel');
  document.getElementById('painel-conteudo').innerHTML = '';
  ajustarFab();
}
function ajustarFab() {
  const rota = (location.hash.slice(1) || 'inicio').split('/')[0];
  document.getElementById('fab-balcao').hidden = rota === 'balcao' || !document.getElementById('painel-balcao').hidden;
}
function ligarBalcao() {
  document.getElementById('fab-balcao').addEventListener('click', abrirPainelBalcao);
  document.getElementById('painel-fechar').addEventListener('click', fecharPainelBalcao);
  document.getElementById('painel-balcao').addEventListener('click', e => { if (e.target.id === 'painel-balcao') fecharPainelBalcao(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('modal').hidden) fecharPainelBalcao(); });
  addEventListener('hashchange', () => { fecharPainelBalcao(); ajustarFab(); });
  ajustarFab();
}

function mostrarRede() {
  document.getElementById('estado-rede').hidden = navigator.onLine;
}

function pedirNovaSenha() {
  const caixa = abrirModal(`
    <h2>Criar nova senha</h2>
    <form id="f-senha">
      <label class="campo"><span>Nova senha (mínimo 6 caracteres)</span><input type="password" name="senha" minlength="6" autocomplete="new-password" required></label>
      <button class="btn btn-primario btn-bloco" type="submit" style="margin-top:14px">Salvar nova senha</button>
    </form>`);
  caixa.querySelector('#f-senha').addEventListener('submit', async e => {
    e.preventDefault();
    try { await trocarSenha(e.target.senha.value); fecharModal(); avisar('Senha trocada'); history.replaceState(null, '', location.pathname + '#inicio'); location.reload(); }
    catch (err) { avisar(err.message, 'erro'); }
  });
}

async function começar() {
  aoPedirNovaSenha(pedirNovaSenha);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  mostrarRede();
  addEventListener('online', () => { mostrarRede(); enviarPendentes(); });
  addEventListener('offline', mostrarRede);

  const usuario = await usuarioAtual();
  if (!usuario) {
    document.getElementById('login').hidden = false;
    document.getElementById('nav').hidden = true;
    const form = document.getElementById('form-login');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('button');
      const erro = document.getElementById('login-erro');
      btn.disabled = true; erro.textContent = '';
      try {
        await entrar(form.email.value.trim(), form.senha.value);
        location.reload();
      } catch (err) { erro.textContent = err.message; btn.disabled = false; }
    });
    document.getElementById('esqueci').addEventListener('click', async () => {
      const erro = document.getElementById('login-erro');
      const email = form.email.value.trim();
      if (!email) { erro.textContent = 'Digite seu e-mail acima e toque de novo em "Esqueci a senha".'; form.email.focus(); return; }
      try { await pedirTrocaDeSenha(email); erro.textContent = ''; avisar('Enviamos um link de troca de senha para o seu e-mail'); }
      catch (err) { erro.textContent = err.message; }
    });
    return;
  }
  aoMudarPendentes(atualizarPendentes);
  atualizarPendentes(pendentes());
  enviarPendentes();
  chamar('limpa_lixeira');
  iniciar();
  ligarBalcao();
  conversas.ouvirMensagens();
}

começar();
