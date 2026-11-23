import { moeda, data, telefoneWa } from './formato.js';
import { calcularItem } from './calc.js';

// "100 un.", "100×60 cm", "Gravação 1 lado + Caixinha personalizada" — usado na tela, no WhatsApp e no PDF.
export function detalheItem(it) {
  const partes = [];
  if (it.tipo === 'm2' || it.livre) partes.push(`${it.largura_cm}×${it.altura_cm} cm`);
  else if (it.tipo === 'opcoes' && it.opcao?.label && !/^cada/i.test(it.opcao.label)) partes.push(it.opcao.label.replace(/\s*\(\+R\$\s*\d+\)/, ''));
  for (const a of it.acabamentos || []) partes.push(a.nome);
  if (it.descricao) partes.push(it.descricao);
  return partes.join(' · ');
}

const linhaItem = it => {
  const det = detalheItem(it);
  return `• ${it.quantidade}× ${it.nome}${det ? ' — ' + det : ''}: ${moeda(calcularItem(it).centavos)}`;
};
const trocar = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

// Cada linha com texto vira citação do WhatsApp ("> "), com a barrinha do lado — parece aviso do sistema.
// Linha em branco fica fora da citação e separa os blocos. Linha que já começa com ">" não é mexida.
export function citar(texto) {
  return texto.split('\n').map(l => {
    const t = l.trim();
    return !t || t.startsWith('>') ? t : `> ${t}`;
  }).join('\n');
}

export const PADRAO = {
  orcamento: '🧾 *ORÇAMENTO Nº {numero}* — {grafica}\nOlá, {cliente}!\n\n{itens}\n\n💰 Total: *{total}*\n💳 Sinal (50%): *{sinal}*\n📅 Prazo: {prazo}\n⏳ Válido até: {validade}\n\n🔑 Pix (e-mail): {pix}\n👤 Recebedor: {recebedor} — confira o nome antes de pagar.\n\n📎 Pra começar a produção, me mande aqui o comprovante do sinal de 50%.',
  arte: '🎨 *ARTE PRONTA — PEDIDO Nº {numero}*\nOlá, {cliente}!\nPode conferir e me dizer se aprova?',
  pronto: '✅ *PEDIDO Nº {numero} — PRONTO PARA RETIRADA*\nOlá, {cliente}!\n🏪 {grafica}\n📍 {endereco}\n🕐 {horario}{falta}',
  cobranca: '⚠️ *PAGAMENTO EM ABERTO — PEDIDO Nº {numero}*\nOlá, {cliente}!\n💰 Saldo: *{saldo}*\n🔑 Pix (e-mail): {pix}\n👤 Recebedor: {recebedor} — confira o nome antes de pagar.\n📎 Depois me mande o comprovante aqui. Obrigado!'
};

// Pedido de "de acordo" no fim de todo orçamento (mesmo com texto personalizado nas Configurações).
// A resposta escrita do cliente no WhatsApp fica como prova de que ele leu e aceitou as condições do PDF.
export const ACEITE = '📄 As condições gerais (arte, cores, prazo, retirada e cancelamento) estão no PDF do orçamento.\n✍️ Pra confirmar, me responde aqui: *Li e concordo com o orçamento nº {numero} e as condições.*';

export function mensagem(tipo, { ficha, cliente, cfg = {}, saldo = 0 }) {
  let modelo = (cfg.textos && cfg.textos[tipo]) || PADRAO[tipo];
  if (tipo === 'orcamento' && !/Li e concordo/i.test(modelo)) modelo += '\n\n' + ACEITE;
  const validade = new Date(new Date(ficha.criado_em || Date.now()).getTime() + (cfg.validade_dias || 7) * 864e5);
  return citar(trocar(modelo, {
    cliente: (cliente.nome || '').split(' ')[0],
    numero: ficha.numero ?? '',
    grafica: cfg.nome || 'Johen Arte Grafica',
    itens: (ficha.itens || []).map(linhaItem).join('\n'),
    total: moeda(ficha.total_centavos),
    sinal: moeda(Math.round((ficha.total_centavos || 0) / 2)),
    prazo: ficha.prazo ? data(ficha.prazo) : 'a combinar',
    validade: data(validade.toISOString()),
    pix: cfg.pix || '',
    recebedor: cfg.recebedor || 'JOSÉ HENRIQUE',
    endereco: cfg.endereco || '',
    horario: cfg.horario || '',
    saldo: moeda(saldo),
    falta: saldo > 0 ? `\n💰 Falta pagar: *${moeda(saldo)}*` : ''
  }));
}

// No computador abre direto o aplicativo do WhatsApp (whatsapp://); no celular, api.whatsapp.com (abre o app).
// Nada de wa.me: ao redirecionar, ele estraga os emojis (viram �).
const ehComputador = () => typeof window !== 'undefined' && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export function linkWa(telefone, texto, app = ehComputador()) {
  const base = app ? 'whatsapp://send' : 'https://api.whatsapp.com/send';
  return `${base}?phone=${telefoneWa(telefone)}&text=${encodeURIComponent(texto)}`;
}

// Abre o WhatsApp (copiando a mensagem antes). O whatsapp:// abre na mesma aba, sem deixar aba vazia pra trás.
export function abrirWa(link) {
  copiarDoLink(link);
  if (link.startsWith('whatsapp://')) location.href = link;
  else window.open(link, '_blank', 'noopener');
}

// Garantia: ao abrir o WhatsApp, a mensagem também vai pra área de transferência.
// Se o WhatsApp mostrar algo estragado, é só apagar e colar (Ctrl+V).
export function copiarDoLink(url) {
  try {
    const texto = new URL(url).searchParams.get('text');
    if (texto) navigator.clipboard?.writeText(texto).catch(() => {});
  } catch { /* link sem texto */ }
}
