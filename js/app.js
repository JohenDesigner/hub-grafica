// Ponto de entrada: login, fila offline, service worker e rotas.
import { usuarioAtual, entrar, chamar, aoMudarPendentes, pendentes, enviarPendentes } from './db.js';
import { atualizarPendentes } from './ui.js';
import { iniciar, registrar } from './rotas.js';
import * as inicio from './telas/inicio.js';
import * as orcamento from './telas/orcamento.js';
import * as pedidos from './telas/pedidos.js';
import * as clientes from './telas/clientes.js';
import * as receber from './telas/receber.js';
import * as produtos from './telas/produtos.js';
import * as configuracoes from './telas/configuracoes.js';

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

function mostrarRede() {
  document.getElementById('estado-rede').hidden = navigator.onLine;
}

async function começar() {
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
    return;
  }
  aoMudarPendentes(atualizarPendentes);
  atualizarPendentes(pendentes());
  enviarPendentes();
  chamar('limpa_lixeira');
  iniciar();
}

começar();
