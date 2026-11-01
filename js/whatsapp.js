import { moeda, data, telefoneWa } from './formato.js';
import { calcularItem } from './calc.js';

const linhaItem = it => {
  const medida = it.tipo === 'm2' ? ` ${it.largura_cm}×${it.altura_cm} cm` : '';
  const acab = (it.acabamentos || []).map(a => a.nome).join(', ');
  return `• ${it.quantidade}× ${it.nome}${medida}${acab ? ' (' + acab + ')' : ''}: ${moeda(calcularItem(it).centavos)}`;
};
const trocar = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

export const PADRAO = {
  orcamento: 'Olá, {cliente}! Segue o orçamento nº {numero} da {grafica}:\n\n{itens}\n\nTotal: {total}\nPrazo: {prazo}\nVálido até: {validade}\n\nPix: {pix}',
  arte: 'Olá, {cliente}! A arte do pedido nº {numero} está pronta. Pode conferir e me dizer se aprova?',
  pronto: 'Olá, {cliente}! Seu pedido nº {numero} está pronto para retirada na {grafica}, {endereco}. Horário: {horario}.{falta}',
  cobranca: 'Olá, {cliente}! Consta em aberto {saldo} do pedido nº {numero}. Pix: {pix}. Obrigado!'
};

export function mensagem(tipo, { ficha, cliente, cfg = {}, saldo = 0 }) {
  const modelo = (cfg.textos && cfg.textos[tipo]) || PADRAO[tipo];
  const validade = new Date(new Date(ficha.criado_em || Date.now()).getTime() + (cfg.validade_dias || 7) * 864e5);
  return trocar(modelo, {
    cliente: (cliente.nome || '').split(' ')[0],
    numero: ficha.numero ?? '',
    grafica: cfg.nome || 'Johen Arte Grafica',
    itens: (ficha.itens || []).map(linhaItem).join('\n'),
    total: moeda(ficha.total_centavos),
    prazo: ficha.prazo ? data(ficha.prazo) : 'a combinar',
    validade: data(validade.toISOString()),
    pix: cfg.pix || '',
    endereco: cfg.endereco || '',
    horario: cfg.horario || '',
    saldo: moeda(saldo),
    falta: saldo > 0 ? ` Falta pagar ${moeda(saldo)}.` : ''
  });
}

export function linkWa(telefone, texto) {
  return `https://wa.me/${telefoneWa(telefone)}?text=${encodeURIComponent(texto)}`;
}
