// Backup: planilha Excel com clientes, pedidos e pagamentos.
import { listar } from './db.js';
import { NOMES_ETAPA, saldoAberto } from './calc.js';
import { data, hojeISO } from './formato.js';
import { carregarScript } from './ui.js';

const reais = c => Math.round(Number(c) || 0) / 100;

export async function exportarPlanilha() {
  await carregarScript('vendor/xlsx.full.min.js');
  const [clientes, fichas, pags] = await Promise.all([listar('clientes', { order: 'nome' }), listar('fichas', { order: 'numero' }), listar('pagamentos', { order: 'pago_em' })]);
  const cli = new Map(clientes.map(c => [c.id, c]));
  const num = new Map(fichas.map(f => [f.id, f.numero]));
  const pagosPor = new Map();
  pags.forEach(p => pagosPor.set(p.ficha_id, [...(pagosPor.get(p.ficha_id) || []), p]));

  const abaClientes = clientes.map(c => ({ Nome: c.nome, WhatsApp: c.whatsapp, 'CPF/CNPJ': c.documento, Endereço: c.endereco, Observações: c.observacoes, Arquivado: c.arquivado ? 'sim' : 'não' }));
  const abaPedidos = fichas.map(f => {
    const pg = pagosPor.get(f.id) || [];
    const pago = pg.reduce((s, p) => s + Number(p.valor_centavos), 0);
    return { 'Nº': f.numero, Cliente: cli.get(f.cliente_id)?.nome || '', Etapa: NOMES_ETAPA[f.etapa], 'Total (R$)': reais(f.total_centavos),
      'Pago (R$)': reais(pago), 'Falta (R$)': reais(saldoAberto(f.total_centavos, pg)), Prazo: f.prazo ? data(f.prazo) : '',
      'OS FpqSystem': f.os_fpq, Itens: (f.itens || []).map(i => `${i.quantidade}× ${i.nome}`).join('; '),
      'Criado em': data(f.criado_em), Excluído: f.excluido_em ? 'sim' : '' };
  });
  const abaPags = pags.map(p => ({ 'Pedido nº': num.get(p.ficha_id) ?? '', Data: data(p.pago_em), 'Valor (R$)': reais(p.valor_centavos), Forma: p.forma, Tipo: p.tipo }));

  const X = window.XLSX;
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(abaClientes.length ? abaClientes : [{ Nome: '' }]), 'Clientes');
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(abaPedidos.length ? abaPedidos : [{ 'Nº': '' }]), 'Pedidos');
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(abaPags.length ? abaPags : [{ 'Pedido nº': '' }]), 'Pagamentos');
  X.writeFile(wb, `hub-grafica-${hojeISO()}.xlsx`);
}
