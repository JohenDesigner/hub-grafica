// PDF do orçamento (A4), gerado no próprio aparelho.
import { calcularFicha, calcularItem } from './calc.js';
import { moeda, data, hojeISO } from './formato.js';
import { detalheItem } from './whatsapp.js';
import { carregarScript } from './ui.js';

const LARANJA = [232, 101, 10], TINTA = [34, 41, 44], CINZA = [98, 109, 113], LINHA = [235, 232, 227];

function imagemPng(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve({ url: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const limpo = t => String(t ?? '').replace(/−/g, '-').replace(/[^\u0000-ÿ–—•…]/g, '');

export async function pdfOrcamento(ficha, cliente, cfg) {
  await carregarScript('vendor/jspdf.umd.min.js');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 15, L = 210 - 2 * M;
  let y = M;

  const logo = await imagemPng(cfg.logo || 'img/logo-wordmark.webp');
  if (logo) { const h = 16, w = Math.min(60, h * logo.w / logo.h); doc.addImage(logo.url, 'PNG', M, y, w, h); }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...CINZA);
  const dados = [cfg.nome, cfg.cnpj && `CNPJ ${cfg.cnpj}`, cfg.endereco, [cfg.whatsapp && `WhatsApp ${cfg.whatsapp}`, cfg.instagram].filter(Boolean).join(' · ')].filter(Boolean);
  dados.forEach((t, i) => doc.text(limpo(t), 210 - M, y + 3 + i * 4.2, { align: 'right' }));
  y += 24;

  doc.setDrawColor(...LARANJA); doc.setLineWidth(0.8); doc.line(M, y, 210 - M, y); y += 9;
  doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(limpo(`Orçamento nº ${ficha.numero ?? ''}`), M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...CINZA);
  doc.text(`Emitido em ${data(ficha.criado_em || hojeISO())}`, 210 - M, y, { align: 'right' });
  y += 9;

  doc.setFontSize(9); doc.text('CLIENTE', M, y); y += 5;
  doc.setTextColor(...TINTA); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(limpo(cliente.nome), M, y); doc.setFont('helvetica', 'normal'); y += 5;
  const extra = [cliente.whatsapp, cliente.documento && `CPF/CNPJ ${cliente.documento}`, cliente.endereco].filter(Boolean).join(' · ');
  if (extra) { doc.setFontSize(9.5); doc.setTextColor(...CINZA); doc.splitTextToSize(limpo(extra), L).forEach(l => { doc.text(l, M, y); y += 4.5; }); }
  y += 5;

  // tabela
  const cQtd = M, cDesc = M + 16, cVal = 210 - M;
  const cabeca = () => {
    doc.setFillColor(251, 239, 230); doc.rect(M, y - 5, L, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TINTA);
    doc.text('QTD', cQtd + 2, y); doc.text('DESCRIÇÃO', cDesc, y); doc.text('VALOR', cVal - 2, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); y += 7;
  };
  cabeca();
  for (const it of ficha.itens || []) {
    const desc = doc.splitTextToSize(limpo(it.nome), L - 16 - 32);
    const det = detalheItem(it) ? doc.splitTextToSize(limpo(detalheItem(it)), L - 16 - 32) : [];
    const altura = desc.length * 4.8 + det.length * 4.2 + 4;
    if (y + altura > 270) { doc.addPage(); y = M + 5; cabeca(); }
    doc.setFontSize(10.5); doc.setTextColor(...TINTA);
    doc.text(String(it.quantidade), cQtd + 2, y);
    desc.forEach((l, i) => doc.text(l, cDesc, y + i * 4.8));
    doc.text(moeda(calcularItem(it).centavos), cVal - 2, y, { align: 'right' });
    doc.setFontSize(9); doc.setTextColor(...CINZA);
    det.forEach((l, i) => doc.text(l, cDesc, y + desc.length * 4.8 + i * 4.2));
    y += altura;
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.2); doc.line(M, y - 2.5, 210 - M, y - 2.5);
    y += 2;
  }

  // totais
  if (y > 230) { doc.addPage(); y = M + 5; }
  const r = calcularFicha(ficha.itens, ficha.desconto);
  y += 2; doc.setFontSize(10.5); doc.setTextColor(...CINZA);
  if (r.desconto) {
    doc.text('Subtotal', 140, y); doc.text(moeda(r.subtotal), cVal - 2, y, { align: 'right' }); y += 6;
    doc.text('Desconto', 140, y); doc.text('- ' + moeda(r.desconto), cVal - 2, y, { align: 'right' }); y += 6;
  }
  doc.setFillColor(...LARANJA); doc.roundedRect(118, y - 6, 210 - M - 118, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('TOTAL', 122, y + 1.5); doc.text(moeda(r.total), cVal - 4, y + 1.5, { align: 'right' });
  y += 16;

  // condições
  const validade = new Date(new Date(ficha.criado_em || Date.now()).getTime() + (cfg.validade_dias || 7) * 864e5).toISOString();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...TINTA);
  const cond = [
    ['Prazo de entrega', ficha.prazo ? data(ficha.prazo) : 'a combinar'],
    ['Válido até', data(validade)],
    ['Formas de pagamento', 'Pix, cartão de débito, cartão de crédito ou dinheiro'],
    cfg.pix && ['Chave Pix', cfg.pix]
  ].filter(Boolean);
  cond.forEach(([a, b]) => { doc.setFont('helvetica', 'bold'); doc.text(limpo(a + ':'), M, y); doc.setFont('helvetica', 'normal'); doc.text(limpo(b), M + 42, y); y += 6; });
  if (ficha.observacoes) {
    y += 2; doc.setFont('helvetica', 'bold'); doc.text('Observações:', M, y); y += 5; doc.setFont('helvetica', 'normal');
    doc.splitTextToSize(limpo(ficha.observacoes), L).forEach(l => { if (y > 280) { doc.addPage(); y = M + 5; } doc.text(l, M, y); y += 5; });
  }

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
    doc.text(limpo(`${cfg.nome} · ${cfg.horario || ''}`), M, 290);
    if (paginas > 1) doc.text(`${p}/${paginas}`, 210 - M, 290, { align: 'right' });
  }

  const nomeArq = `orcamento-${ficha.numero ?? 'novo'}-${String(cliente.nome).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}.pdf`;
  doc.save(nomeArq);
  return nomeArq;
}
