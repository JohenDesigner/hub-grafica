// Configurações da gráfica e tela "Mais".
import { obter, salvar, usuarioAtual, sair } from '../db.js';
import { PADRAO } from '../whatsapp.js';
import { esc, avisar, titulo, lerForm, confirmar, ICONE } from '../ui.js';
import { exportarPlanilha } from '../exportar.js';

export const PADRAO_CFG = {
  nome: 'Johen Arte Grafica',
  cnpj: '65.480.613/0001-19',
  endereco: 'R. Pedro Fernandes Aragão, 269 – Jardim Selma, São Paulo/SP',
  whatsapp: '(11) 98287-7142',
  instagram: '@johen_artgrafica',
  horario: 'segunda a sábado, das 11h às 20h',
  pix: '65.480.613/0001-19',
  logo: '',
  validade_dias: 7,
  textos: {},
  respostas: null   // respostas prontas das Conversas (null = usa as padrão)
};

// Respostas prontas da tela de Conversas. Marcadores: {cliente} {pix} {endereco} {horario} {grafica}
export const RESPOSTAS_PADRAO = [
  { titulo: 'Recebi', texto: 'Oi, {cliente}! Recebi sim, já estou vendo aqui e te mando o orçamento em instantes. 😊' },
  { titulo: 'Mandar a arte', texto: 'Pode me mandar a arte aqui mesmo (PDF, PNG ou CorelDRAW). Se não tiver arte, a gente cria pra você! 🎨' },
  { titulo: 'Sinal', texto: 'Pra começar a produção, trabalhamos com 50% de sinal e o restante na retirada. Pode ser?' },
  { titulo: 'Pix', texto: 'Segue a chave Pix (CNPJ): {pix}\n{grafica}\n\nDepois me manda o comprovante aqui, por favor! 🙏' },
  { titulo: 'Prazo', texto: 'O prazo de produção começa a contar depois da arte aprovada e do sinal. Assim que ficar pronto eu te aviso por aqui!' },
  { titulo: 'Arte pra aprovar', texto: '{cliente}, a arte está pronta! Confere com calma e me diz se posso mandar pra produção ou se quer mudar alguma coisa.' },
  { titulo: 'Pronto', texto: '{cliente}, seu pedido está pronto! 🎉 Pode retirar na loja: {endereco}, {horario}.' },
  { titulo: 'Endereço', texto: 'Estamos na {endereco}. 📍\nAtendimento: {horario}.' },
  { titulo: 'Obrigado', texto: 'Obrigado pela preferência, {cliente}! 💛 Se puder, deixa uma avaliação pra gente no Google, ajuda muito: https://g.page/r/CWKTHinBP02gEAI/review' }
];

// Grava um campo solto das configurações sem mexer nos outros (ex.: ia_auto).
export async function salvarCampoCfg(campo, valor) {
  const cfg = await carregarCfg();
  const u = await usuarioAtual();
  await salvar('configuracoes', { user_id: u.id, dados: { ...cfg, [campo]: valor } });
  cache = { ...cfg, [campo]: valor };
}

export async function salvarRespostas(lista) {
  const cfg = await carregarCfg();
  const u = await usuarioAtual();
  const { respostas, ...resto } = cfg;
  await salvar('configuracoes', { user_id: u.id, dados: { ...resto, respostas: lista } });
  cache = { ...cfg, respostas: lista };
}

let cache = null;
export async function carregarCfg() {
  if (cache) return cache;
  const u = await usuarioAtual();
  let r = null;
  try { r = await obter('configuracoes', u.id); } catch { /* usa o padrão */ }
  cache = { ...PADRAO_CFG, ...(r?.dados || {}), textos: { ...(r?.dados?.textos || {}) } };
  return cache;
}

const NOMES_TEXTO = { orcamento: 'Orçamento', arte: 'Arte para aprovar', pronto: 'Pedido pronto', cobranca: 'Cobrança' };
const MARCADORES = '{cliente} {numero} {itens} {total} {prazo} {validade} {pix} {endereco} {horario} {saldo} {grafica}';

export async function montar(el) {
  titulo('Configurações');
  const cfg = await carregarCfg();
  el.innerHTML = `
    <form id="f-cfg" class="cartao">
      <h3>Dados da gráfica</h3>
      <p class="sub">Aparecem no PDF do orçamento e nas mensagens de WhatsApp.</p>
      <label class="campo"><span>Nome</span><input name="nome" value="${esc(cfg.nome)}" required></label>
      <div class="grade-2">
        <label class="campo"><span>CNPJ</span><input name="cnpj" value="${esc(cfg.cnpj)}"></label>
        <label class="campo"><span>WhatsApp</span><input name="whatsapp" value="${esc(cfg.whatsapp)}" inputmode="tel"></label>
      </div>
      <label class="campo"><span>Endereço</span><input name="endereco" value="${esc(cfg.endereco)}"></label>
      <div class="grade-2">
        <label class="campo"><span>Instagram</span><input name="instagram" value="${esc(cfg.instagram)}"></label>
        <label class="campo"><span>Chave Pix</span><input name="pix" value="${esc(cfg.pix)}"></label>
      </div>
      <label class="campo"><span>Horário</span><input name="horario" value="${esc(cfg.horario)}"></label>
      <label class="campo"><span>Validade do orçamento (dias)</span><input name="validade_dias" type="number" min="1" max="90" value="${esc(cfg.validade_dias)}" inputmode="numeric"></label>
      <div class="campo"><span>Logo do PDF</span>
        <div class="campo-linha" style="align-items:center">
          <img id="cfg-logo" src="${esc(cfg.logo || 'img/logo-wordmark.webp')}" alt="" style="height:40px;max-width:160px;object-fit:contain;background:#fff;border-radius:8px;padding:4px">
          <input type="file" id="cfg-logo-arq" accept="image/png,image/jpeg,image/webp" style="flex:1;min-width:0">
        </div>
        <button type="button" class="btn btn-peq" id="cfg-logo-padrao" ${cfg.logo ? '' : 'hidden'}>Usar a logo da Johen</button>
      </div>
      <h3 style="margin-top:20px">Mensagens de WhatsApp</h3>
      <p class="sub">Marcadores que viram dados: ${esc(MARCADORES)}</p>
      ${Object.keys(NOMES_TEXTO).map(k => `
        <label class="campo"><span>${NOMES_TEXTO[k]}</span>
          <textarea name="texto_${k}" rows="5">${esc(cfg.textos[k] || PADRAO[k])}</textarea></label>
        <button type="button" class="btn btn-peq" data-padrao="${k}">Voltar ao padrão</button>`).join('')}
      <button class="btn btn-primario btn-bloco" type="submit">Salvar configurações</button>
    </form>
    <div class="cartao">
      <h3>Backup</h3>
      <p class="sub">Baixa uma planilha Excel com clientes, pedidos e pagamentos.</p>
      <button class="btn btn-bloco" id="cfg-exportar">Exportar planilha</button>
    </div>
    <button class="btn btn-perigo btn-bloco" id="cfg-sair">Sair da conta</button>`;

  let logo = cfg.logo;
  const img = el.querySelector('#cfg-logo');
  el.querySelector('#cfg-logo-arq').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 300 * 1024) { avisar('Logo muito grande (máximo 300 KB)', 'erro'); e.target.value = ''; return; }
    const r = new FileReader();
    r.onload = () => { logo = r.result; img.src = logo; el.querySelector('#cfg-logo-padrao').hidden = false; };
    r.readAsDataURL(f);
  });
  el.querySelector('#cfg-logo-padrao').addEventListener('click', e => { logo = ''; img.src = 'img/logo-wordmark.webp'; e.target.hidden = true; });
  el.querySelectorAll('[data-padrao]').forEach(b => b.addEventListener('click', () => {
    el.querySelector(`[name="texto_${b.dataset.padrao}"]`).value = PADRAO[b.dataset.padrao];
  }));

  el.querySelector('#f-cfg').addEventListener('submit', async e => {
    e.preventDefault();
    const d = lerForm(e.target);
    const textos = {};
    for (const k of Object.keys(NOMES_TEXTO)) {
      const v = e.target[`texto_${k}`].value;
      if (v.trim() && v.trim() !== PADRAO[k].trim()) textos[k] = v;
    }
    const anterior = await carregarCfg();
    const { respostas, ia_auto, balcao } = anterior;
    const dados = { ...(respostas ? { respostas } : {}), ...(ia_auto === false ? { ia_auto } : {}), ...(balcao ? { balcao } : {}), nome: d.nome, cnpj: d.cnpj, whatsapp: d.whatsapp, endereco: d.endereco, instagram: d.instagram,
      pix: d.pix, horario: d.horario, validade_dias: Math.max(1, parseInt(d.validade_dias, 10) || 7), logo, textos };
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const u = await usuarioAtual();
      await salvar('configuracoes', { user_id: u.id, dados });
      cache = { ...PADRAO_CFG, ...dados, textos: { ...dados.textos } };
      avisar('Configurações salvas');
    } catch (err) { avisar(err.message, 'erro'); }
    btn.disabled = false;
  });

  el.querySelector('#cfg-exportar').addEventListener('click', async e => {
    e.target.disabled = true;
    try { await exportarPlanilha(); avisar('Planilha baixada'); }
    catch (err) { avisar(err.message, 'erro'); }
    e.target.disabled = false;
  });
  el.querySelector('#cfg-sair').addEventListener('click', async () => {
    if (await confirmar('Sair da conta neste aparelho?', { ok: 'Sair', perigo: true })) { await sair(); location.hash = ''; location.reload(); }
  });
}

export async function montarMais(el) {
  titulo('Mais');
  const item = (href, nome, det) => `<li><a class="lista-item" href="${href}"><span class="meio"><span class="nome">${nome}</span><span class="det">${det}</span></span>${ICONE.seta.replace('<svg', '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"')}</a></li>`;
  el.innerHTML = `<ul class="lista">
    ${item('#balcao', 'Balcão', 'Impressões e cópias rápidas, sem cliente')}
    ${item('#desempenho', 'Desempenho', 'Gráficos de vendas, pedidos, clientes e WhatsApp')}
    ${item('#historico', 'Histórico', 'Tudo que foi pago: sinais, pagamentos e balcão')}
    ${item('#receber', 'A receber', 'Quem deve e quanto, registrar pagamento')}
    ${item('#produtos', 'Produtos e preços', 'Catálogo do site e criar produto novo')}
    ${item('#pedidos/lixeira', 'Lixeira', 'Pedidos excluídos nos últimos 30 dias')}
    ${item('#configuracoes', 'Configurações', 'Dados da gráfica, mensagens, backup, sair')}
  </ul>`;
}
