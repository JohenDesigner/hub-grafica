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

export function mensagem(tipo, { ficha, cliente, cfg = {}, saldo = 0 }) {
  const modelo = (cfg.textos && cfg.textos[tipo]) || PADRAO[tipo];
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

export function linkWa(telefone, texto) {
  return `https://wa.me/${telefoneWa(telefone)}?text=${encodeURIComponent(texto)}`;
}
