export const TIPOS = ['opcoes', 'm2', 'unidade'];
export const ETAPAS = ['orcamento','sinal','arte','aprovacao','producao','pronto','entregue'];
export const NOMES_ETAPA = { orcamento:'Orçamento', sinal:'Sinal pago', arte:'Arte', aprovacao:'Aprovação',
  producao:'Produção', pronto:'Pronto', entregue:'Entregue', cancelado:'Cancelado' };

const n = v => Number(v) || 0;

export function emCentavos(reais) {
  return Math.round((n(reais) + Number.EPSILON) * 100);
}

export function areaPeca(larguraCm, alturaCm) {
  return (n(larguraCm) * n(alturaCm)) / 10000;
}

const usaMedida = it => it.tipo === 'm2' || (it.tipo === 'opcoes' && it.livre);

export function calcularItem(item) {
  const q = n(item.quantidade);
  const area = usaMedida(item) ? areaPeca(item.largura_cm, item.altura_cm) : 0;
  let precoAplicado = 0, base = 0;
  if (item.tipo === 'opcoes' && item.livre) {
    // banner em outro tamanho: preço da peça arredondado em centavos, nunca abaixo do mínimo por peça
    precoAplicado = Math.max(n(item.minimo), emCentavos(area * n(item.m2_livre)) / 100);
    base = precoAplicado * q;
  } else if (item.tipo === 'opcoes') {
    precoAplicado = n(item.opcao?.preco);
    base = precoAplicado * q;
  } else if (item.tipo === 'm2') {
    precoAplicado = n(item.preco);
    let peca = area * precoAplicado;
    if (item.minimo_por === 'peca') peca = Math.max(n(item.minimo), peca);
    base = peca * q;
    if (item.minimo_por !== 'peca' && base > 0 && base < n(item.minimo)) base = n(item.minimo);
  } else {
    precoAplicado = n(item.preco);
    base = precoAplicado * q;
    if (item.minimo_por === 'peca') base = Math.max(n(item.minimo), precoAplicado) * q;
    else if (base > 0 && base < n(item.minimo)) base = n(item.minimo);
  }
  let extra = 0;
  for (const a of item.acabamentos || []) {
    if (a.cobranca === 'unidade') extra += n(a.valor) * q;
    else if (a.cobranca === 'm2') extra += n(a.valor) * area * q;
    else extra += n(a.valor);
  }
  const calculado = emCentavos(base + extra);
  // valor ajustado à mão pelo Johen depois do cálculo
  const manual = item.valor_manual === null || item.valor_manual === undefined || item.valor_manual === '' ? NaN : Number(item.valor_manual);
  return { area, precoAplicado, calculado, centavos: Number.isFinite(manual) && manual >= 0 ? emCentavos(manual) : calculado };
}

export function calcularFicha(itens, desconto) {
  const subtotal = (itens || []).reduce((s, it) => s + calcularItem(it).centavos, 0);
  const d = desconto || { tipo: 'reais', valor: 0 };
  let desc = d.tipo === 'pct' ? Math.round(subtotal * n(d.valor) / 100) : emCentavos(d.valor);
  desc = Math.min(Math.max(desc, 0), subtotal);
  return { subtotal, desconto: desc, total: subtotal - desc };
}

export function saldoAberto(totalCentavos, pagamentos) {
  const pago = (pagamentos || []).reduce((s, p) => s + n(p.valor_centavos), 0);
  return Math.max(n(totalCentavos) - pago, 0);
}

export function validarItem(item) {
  if (!TIPOS.includes(item.tipo)) return 'Tipo de cobrança inválido';
  if (!(n(item.quantidade) > 0)) return 'Quantidade precisa ser maior que zero';
  if (usaMedida(item) && !(n(item.largura_cm) > 0 && n(item.altura_cm) > 0)) return 'Informe largura e altura';
  if (item.tipo === 'opcoes' && !item.livre && !(n(item.opcao?.preco) > 0)) return 'Escolha uma opção';
  if (item.tipo === 'opcoes' && item.livre && !(n(item.m2_livre) > 0)) return 'Este produto não aceita outro tamanho';
  if (item.tipo !== 'opcoes' && !(n(item.preco) > 0)) return 'Preço precisa ser maior que zero';
  for (const a of item.acabamentos || []) {
    if (a.cobranca === 'm2' && !usaMedida(item)) return `O acabamento ${a.nome} é por m² e precisa de medida`;
  }
  return null;
}

export function validarPagamento(valorCentavos, saldoCentavos) {
  if (!(n(valorCentavos) > 0)) return 'Valor precisa ser maior que zero';
  if (n(valorCentavos) > n(saldoCentavos)) {
    const r = (n(saldoCentavos) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `Valor maior que o que falta receber (R$ ${r})`;
  }
  return null;
}

export function orcamentoVencido(ficha, validadeDias, hoje = new Date()) {
  if (ficha.etapa !== 'orcamento') return false;
  const limite = new Date(ficha.criado_em).getTime() + n(validadeDias) * 864e5;
  return hoje.getTime() > limite;
}

export function somarDiasUteis(isoData, dias) {
  const d = new Date(isoData.slice(0, 10) + 'T12:00:00Z');
  let falta = n(dias);
  while (falta > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6) falta--;
  }
  return d.toISOString().slice(0, 10);
}
