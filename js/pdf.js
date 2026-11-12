// PDF do orçamento (A4), gerado no próprio aparelho.
import { calcularFicha, calcularItem } from './calc.js';
import { moeda, data, hojeISO } from './formato.js';
import { detalheItem } from './whatsapp.js';
import { carregarScript } from './ui.js';

const LARANJA = [232, 101, 10], TINTA = [34, 41, 44], CINZA = [98, 109, 113], LINHA = [235, 232, 227];

// Logo do topo. Reduz para no máximo 'alturaMax' px de altura: no PDF ela tem 16 mm,
// então 300 px dá ~475 dpi (nítida na impressão) e deixa o arquivo leve para o WhatsApp.
function imagemPng(src, alturaMax = 300) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, alturaMax / img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve({ url: c.toDataURL('image/png'), w: c.width, h: c.height });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Marca d'água: a imagem clarinha sobre fundo branco, em JPEG pequeno (deixa o PDF leve para o WhatsApp).
function imagemMarca(src, opacidade = 0.07, maximo = 700) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maximo / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalAlpha = opacidade;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve({ url: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Condições gerais impressas no pé do orçamento. Curtas de propósito: uma ideia por linha.
const CLAUSULAS = cfg => [
  ['Aprovação da arte', 'A produção só começa após sua aprovação. Confira com atenção nomes, telefones, datas, valores e ortografia: erros não apontados na aprovação são de responsabilidade do cliente e a correção depois de impresso é cobrada.'],
  ['Cores', 'Imprimimos em CMYK: as cores podem variar em relação à tela (RGB), entre materiais e entre tiragens.'],
  ['Artes com I.A.', 'Imagens criadas por inteligência artificial podem ter defeitos (textos, mãos, rostos) e baixa resolução. Não garantimos sua qualidade de impressão nem os direitos de uso.'],
  ['Arquivo do cliente', 'Arquivos enviados prontos são impressos como recebidos. Envie em PDF, 300 dpi, com textos em curvas e 3 mm de sangria.'],
  ['Prazo', 'Conta em dias úteis a partir da aprovação da arte e do pagamento do sinal.'],
  ['Corte e refile', 'Variações de até 2 mm são normais do processo.'],
  ['Retirada', `O produto fica guardado por até ${cfg.retirada_meses || 3} meses após o aviso de pronto. Depois disso pode ser descartado, sem reembolso.`],
  ['Cancelamento', 'Depois da aprovação da arte e do início da produção, o sinal não é devolvido.']
];

const limpo = t => String(t ?? '').replace(/−/g, '-').replace(/[^\u0000-ÿ–—•…]/g, '');

export async function pdfOrcamento(ficha, cliente, cfg) {
  await carregarScript('vendor/jspdf.umd.min.js');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 15, L = 210 - 2 * M;
  let y = M;

  // Marca d'água: a logo grande e bem clarinha no meio de cada página, desenhada antes de tudo para ficar no fundo.
  const marca = await imagemMarca(cfg.logo || 'img/logo-icone.webp');
  const desenharMarca = () => {
    if (!marca) return;
    const w = Math.min(130, 130 * marca.w / marca.h), h = w * marca.h / marca.w;
    doc.addImage(marca.url, 'JPEG', (210 - w) / 2, (297 - h) / 2 + 10, w, h, 'marca', 'FAST');
  };
  const novaPagina = () => { doc.addPage(); desenharMarca(); };
  desenharMarca();

  const logo = await imagemPng(cfg.logo || 'img/logo-wordmark.webp');
  if (logo) { const h = 16, w = Math.min(60, h * logo.w / logo.h); doc.addImage(logo.url, 'PNG', M, y, w, h, 'logo', 'FAST'); }
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
    if (y + altura > 270) { novaPagina(); y = M + 5; cabeca(); }
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
  if (y > 230) { novaPagina(); y = M + 5; }
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
    doc.splitTextToSize(limpo(ficha.observacoes), L).forEach(l => { if (y > 280) { novaPagina(); y = M + 5; } doc.text(l, M, y); y += 5; });
  }

  // condições gerais: letra pequena, presa ao pé da última página (ou numa página nova se não couber)
  const cl = CLAUSULAS(cfg), colT = 31, larg = L - colT;
  doc.setFontSize(7.5);
  const linhas = cl.map(([, t]) => doc.splitTextToSize(limpo(t), larg));
  const alturaCl = 9 + linhas.reduce((s, l) => s + l.length * 3.3 + 1.4, 0);
  if (y + 8 + alturaCl > 284) { novaPagina(); y = M + 5; }
  y = Math.max(y + 8, 284 - alturaCl);
  doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, y, 210 - M, y); y += 5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...TINTA);
  doc.text('CONDIÇÕES GERAIS', M, y); y += 4.5;
  doc.setFontSize(7.5);
  cl.forEach(([titulo], i) => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...TINTA); doc.text(limpo(titulo), M, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...CINZA);
    linhas[i].forEach((l, j) => doc.text(l, M + colT, y + j * 3.3));
    y += linhas[i].length * 3.3 + 1.4;
  });

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
