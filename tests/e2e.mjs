// Teste de ponta a ponta no navegador, com o Supabase de mentira (tests/mock-supabase.js).
// Rodar: node tests/e2e.mjs   (CHROME=/caminho/do/chrome opcional)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRINTS = path.join(RAIZ, 'tests', 'prints');
fs.mkdirSync(PRINTS, { recursive: true });
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const servidor = http.createServer((req, res) => {
  const p = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/\/$/, '/index.html')));
  if (!p.startsWith(RAIZ) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const BASE = `http://localhost:${servidor.address().port}/`;

let falhas = 0, passos = 0;
const ok = (cond, nome) => { passos++; if (cond) console.log('  ok  ', nome); else { falhas++; console.log('  FALHA', nome); } };

const navegador = await chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined) });
const contexto = await navegador.newContext({ viewport: { width: 380, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const errosConsole = [];
await contexto.route('**/vendor/supabase.js', r => r.fulfill({ path: path.join(RAIZ, 'tests/mock-supabase.js'), contentType: 'text/javascript' }));
await contexto.route('https://johendesigner.github.io/Johen-site/novo/dados/produtos.json*', r => r.fulfill({ path: path.join(RAIZ, 'tests/fixtures/produtos.json'), contentType: 'application/json' }));
await contexto.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const pg = await contexto.newPage();
pg.on('pageerror', e => errosConsole.push(e.message));
pg.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_FAILED|Failed to load resource/.test(m.text())) errosConsole.push(m.text()); });
pg.on('dialog', d => d.dismiss());
const esperar = ms => pg.waitForTimeout(ms);
const texto = async sel => (await pg.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
const semRolagemLateral = () => pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
async function print(nome) { await esperar(250); await pg.screenshot({ path: path.join(PRINTS, `${nome}.png`), fullPage: true }); ok(await semRolagemLateral(), `sem rolagem lateral: ${nome}`); }
const clicarTexto = (t, sel = 'button, a') => pg.locator(sel, { hasText: t }).first().click();

try {
  console.log('Login');
  await pg.goto(BASE);
  await pg.waitForSelector('#login:not([hidden])');
  await print('01-login');
  await pg.click('#esqueci'); await esperar(200);
  ok((await texto('#login-erro')).includes('Digite seu e-mail'), 'esqueci a senha pede o e-mail');
  await pg.fill('[name=email]', 'teste@johen.com'); await pg.click('#esqueci'); await esperar(300);
  ok(await pg.evaluate(() => window.__resetPara === 'teste@johen.com'), 'esqueci a senha envia o link');
  await pg.fill('[name=email]', 'teste@johen.com'); await pg.fill('[name=senha]', 'errada');
  await pg.click('#form-login button'); await esperar(300);
  ok((await texto('#login-erro')) === 'E-mail ou senha incorretos', 'senha errada mostra aviso');
  await pg.fill('[name=senha]', 'senha123'); await pg.click('#form-login button');
  await pg.waitForSelector('#nav:not([hidden]) a.ativo[data-rota=inicio]');
  ok((await texto('#titulo')) === 'Início', 'entrou e abriu o Início');
  await print('02-inicio-vazio');

  console.log('Produtos');
  await pg.goto(BASE + '#produtos'); await pg.waitForSelector('#p-lista .lista');
  ok((await texto('#p-estado')).includes('76 produtos'), 'catálogo do site com 76 produtos');
  await pg.fill('#p-busca', 'Couché 250g — Couché Brilho (Frente)');
  ok((await texto('#p-lista')).includes('a partir de R$ 76,50'), 'cartão couché mostra a partir de R$ 76,50');
  await pg.fill('#p-busca', '');
  await print('03-produtos');
  await pg.click('#p-novo');
  await pg.fill('#f-extra [name=nome]', 'Envelopamento de frota');
  await pg.click('[data-tipo=m2]');
  await pg.fill('#f-extra [name=preco]', '90'); await pg.fill('#f-extra [name=minimo]', '150');
  await pg.click('#f-extra [type=submit]'); await esperar(400);
  await pg.fill('#p-busca', 'Envelopamento');
  ok((await texto('#p-lista')).includes('R$ 90,00 o m²'), 'produto extra cadastrado');

  console.log('Clientes');
  await pg.goto(BASE + '#clientes'); await pg.waitForSelector('#c-novo');
  await pg.click('#c-novo');
  await pg.fill('#f-cli [name=nome]', 'Ana Souza'); await pg.fill('#f-cli [name=whatsapp]', '(11) 98888-7777');
  await pg.click('#f-cli [type=submit]'); await pg.waitForURL(/#cliente\//); await pg.waitForSelector('main .resumo');
  ok((await texto('main')).includes('Ana Souza'), 'cliente criado e detalhe aberto');
  await print('04-cliente');

  console.log('Busca por CNPJ');
  await pg.route('https://brasilapi.com.br/api/cnpj/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ razao_social: 'PADARIA EXEMPLO LTDA', nome_fantasia: 'PADARIA DO BAIRRO', descricao_situacao_cadastral: 'ATIVA', ddd_telefone_1: '1133334444',
      email: 'OI@PADARIA.COM', descricao_tipo_de_logradouro: 'RUA', logradouro: 'DAS FLORES', numero: '120', complemento: '', bairro: 'CENTRO', municipio: 'SAO PAULO', uf: 'SP', cep: '01001000' }) }));
  await pg.goto(BASE + '#clientes'); await pg.waitForSelector('#c-novo');
  await pg.click('#c-novo');
  await pg.fill('#f-cli [name=documento]', '1234');
  await pg.fill('#f-cli [name=documento]', '00000000000192');
  ok((await texto('#f-cnpj')).includes('não existe'), 'CNPJ errado avisa');
  await pg.fill('#f-cli [name=documento]', '00000000000191');
  await pg.waitForFunction(() => document.querySelector('#f-cnpj').textContent.startsWith('✓'));
  ok(await pg.inputValue('#f-cli [name=nome]') === 'Padaria do Bairro', 'CNPJ preenche o nome');
  ok(await pg.inputValue('#f-cli [name=endereco]') === 'Rua das Flores, 120 - Centro - Sao Paulo/SP - CEP 01001-000', 'CNPJ preenche o endereço');
  ok(await pg.inputValue('#f-cli [name=documento]') === '00.000.000/0001-91', 'CNPJ fica formatado');
  ok(await pg.inputValue('#f-cli [name=whatsapp]') === '', 'telefone fixo não vai pro WhatsApp');
  ok((await pg.inputValue('#f-cli [name=observacoes]')).includes('Telefone: (11) 3333-4444'), 'telefone fixo vai pras observações');
  await print('04b-cliente-cnpj');
  await pg.click('[data-fechar]'); await esperar(300);

  console.log('Cadastro rápido no orçamento (CNPJ e CEP)');
  await pg.route('https://brasilapi.com.br/api/cep/v2/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ cep: '04431160', state: 'SP', city: 'São Paulo', neighborhood: 'Jardim Selma', street: 'Rua Pedro Fernandes Aragão' }) }));
  await pg.goto(BASE + '#orcamento'); await pg.waitForSelector('#o-novo-cli');
  await pg.click('#o-novo-cli'); await pg.waitForSelector('#f-mais');
  ok(await pg.locator('#f-extra').isHidden(), 'cadastro rápido começa só com nome e WhatsApp');
  await print('05a-rapido');
  await pg.click('#f-mais');
  ok(await pg.locator('#f-cli [name=documento]').isVisible(), 'botão Empresa mostra CNPJ e CEP');
  await pg.fill('#f-cli [name=cep]', '04431160');
  await pg.waitForFunction(() => document.querySelector('#f-cep').textContent.startsWith('✓'));
  await pg.fill('#f-cli [name=numero]', '45');
  ok(await pg.inputValue('#f-cli [name=endereco]') === 'Rua Pedro Fernandes Aragão, 45 - Jardim Selma - São Paulo/SP - CEP 04431-160', 'CEP + número montam o endereço');
  await pg.fill('#f-cli [name=documento]', '00000000000191');
  await pg.waitForFunction(() => document.querySelector('#f-cnpj').textContent.startsWith('✓'));
  ok(await pg.inputValue('#f-cli [name=nome]') === 'Padaria do Bairro', 'CNPJ no cadastro rápido preenche o nome');
  ok((await pg.inputValue('#f-cli [name=endereco]')).startsWith('Rua Pedro'), 'CNPJ não troca o endereço que veio do CEP');
  await print('05b-rapido-empresa');
  await pg.click('#f-cli [type=submit]'); await esperar(500);
  ok((await texto('main')).includes('Padaria do Bairro'), 'cliente empresa salvo e escolhido no orçamento');
  await pg.click('#o-trocar');   // deixa o orçamento sem cliente para o próximo bloco

  console.log('Orçamento');
  await pg.goto(BASE + '#orcamento'); await pg.waitForSelector('#o-busca-cli');
  await pg.fill('#o-busca-cli', 'ana'); await pg.click('#o-sug [data-cli]');
  await pg.click('#o-add'); await pg.fill('#ei-busca', 'lona 480g brilho');
  await pg.locator('#ei-lista [data-p]').first().click();
  await pg.locator('#ei-opcoes input[value=livre]').check();
  await pg.fill('#ei-l', '100'); await pg.fill('#ei-a', '60'); await pg.fill('#ei-q', '2'); await pg.dispatchEvent('#ei-q', 'input');
  ok((await pg.inputValue('#ei-valor')) === '144,00', 'banner outro tamanho 100×60 ×2 = R$ 144,00');
  await print('05-editor-item');
  await pg.click('#ei-ok');
  await pg.click('#o-add'); await pg.fill('#ei-busca', 'couché 250g brilho (frente)');
  await pg.locator('#ei-lista [data-p]').first().click();
  await pg.locator('#ei-opcoes input[value="0"]').check();
  ok((await pg.inputValue('#ei-valor')) === '76,50', 'pacote de 100 cartões = R$ 76,50');
  await pg.click('#ei-ok');
  await pg.click('#o-add'); await pg.fill('#ei-busca', 'adesivo com recorte vinil branco brilho');
  await pg.locator('#ei-lista [data-p]').first().click();
  await pg.fill('#ei-l', '10'); await pg.fill('#ei-a', '10'); await pg.dispatchEvent('#ei-a', 'input');
  ok((await pg.inputValue('#ei-valor')) === '85,00' && await pg.locator('#ei-min').isVisible(), 'adesivo pequeno cai no mínimo R$ 85,00 com aviso');
  await pg.click('#ei-ok');
  ok((await texto('#o-total')) === 'R$ 305,50', 'total do orçamento R$ 305,50');
  await pg.locator('#o-itens [data-remover="2"]').click();
  ok((await texto('#o-total')) === 'R$ 220,50', 'remover item recalcula: R$ 220,50 (igual ao site)');
  await pg.fill('#o-desc', '10'); await pg.dispatchEvent('#o-desc', 'input');
  ok((await texto('#o-total')) === 'R$ 210,50', 'desconto de R$ 10 → R$ 210,50');
  await pg.fill('#o-desc', ''); await pg.dispatchEvent('#o-desc', 'input');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(await pg.inputValue('#o-prazo')), 'prazo sugerido preenchido');
  await print('06-orcamento');
  await pg.click('#o-salvar'); await pg.waitForSelector('#o-depois');
  ok((await texto('#titulo')) === 'Orçamento nº 1', 'orçamento salvo como nº 1');
  const href = await pg.evaluate(() => {
    let url = ''; const original = window.open; window.open = u => { url = u; return null; };
    document.querySelector('#o-wpp').click(); return new Promise(r => setTimeout(() => { window.open = original; r(url); }, 300));
  });
  const msg = decodeURIComponent(href.split('text=')[1] || '');
  ok(href.startsWith('https://wa.me/5511988887777') && msg.includes('Olá, Ana!') && msg.includes('Total: R$ 220,50') && msg.includes('100×60 cm'), 'mensagem de WhatsApp montada certo');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#o-pdf')]);
  const arq = path.join(PRINTS, dl.suggestedFilename()); await dl.saveAs(arq);
  ok(dl.suggestedFilename() === 'orcamento-1-ana-souza.pdf' && fs.statSync(arq).size > 3000, 'PDF do orçamento gerado');

  console.log('Virar pedido com sinal');
  await pg.click('#o-virar'); await clicarTexto('Sim, registrar sinal');
  await pg.waitForSelector('#f-pag');
  await pg.fill('#f-pag [name=valor]', '100'); await pg.click('#f-pag [type=submit]');
  await pg.waitForURL(/#pedido\//); await pg.waitForSelector('.etapa');
  ok((await texto('main .etapa')) === 'Sinal pago', 'pedido na etapa Sinal pago');
  ok((await texto('main')).includes('Falta receber R$ 120,50'), 'falta receber R$ 120,50');
  await print('07-pedido');

  console.log('A receber');
  await pg.goto(BASE + '#receber'); await pg.waitForSelector('.numero-grande');
  ok((await texto('.numero-grande')) === 'R$ 120,50', 'A receber mostra R$ 120,50');
  await print('08-receber');
  await pg.click('[data-pagar]'); await pg.fill('#f-pag [name=valor]', '130'); await pg.click('#f-pag [type=submit]'); await esperar(200);
  ok((await texto('#toast')).includes('Valor maior que o que falta receber (R$ 120,50)'), 'bloqueia pagamento acima do saldo');
  await pg.fill('#f-pag [name=valor]', '120,50'); await pg.click('[data-forma=dinheiro]'); await pg.click('#f-pag [type=submit]');
  await pg.waitForSelector('text=Ninguém devendo');
  ok(true, 'pagou o resto e saiu da lista');

  console.log('Etapas');
  await pg.goto(BASE + '#pedidos'); await pg.waitForSelector('#pd-lista .lista-item');
  ok((await texto('#pd-lista')).includes('quitado'), 'lista mostra quitado');
  await print('09-pedidos');
  await pg.click('#pd-lista .lista-item');
  for (const e of ['Arte', 'Aprovação', 'Produção', 'Pronto', 'Entregue']) {
    await pg.waitForSelector(`button:has-text("Avançar para ${e}")`); await clicarTexto(`Avançar para ${e}`);
    await pg.waitForSelector(`main .etapa:has-text("${e}")`);
  }
  ok((await texto('main .etapa')) === 'Entregue', 'avançou até Entregue');
  await clicarTexto('◀ Pronto'); await pg.waitForSelector('main .etapa:has-text("Pronto")');
  ok(true, 'voltou uma etapa');
  ok(await pg.locator('a.btn-wpp', { hasText: 'Avisar que está pronto' }).count() === 1, 'botão "Avisar que está pronto" na etapa Pronto');

  console.log('Detalhes e conflito');
  await pg.fill('#pd-form [name=os_fpq]', '4521'); await pg.click('#pd-form [type=submit]'); await esperar(400);
  ok((await pg.inputValue('#pd-form [name=os_fpq]')) === '4521', 'nº da OS do FpqSystem salvo');
  await pg.evaluate(() => { const b = window.__mock.banco(); b.t.fichas[0].observacoes = 'mudado no PC'; b.t.fichas[0].atualizado_em = new Date(Date.now() + 99999).toISOString(); window.__mock.gravar(); });
  await pg.fill('#pd-form [name=observacoes]', 'mudado no celular'); await pg.click('#pd-form [type=submit]');
  await pg.waitForSelector('text=Esta ficha mudou em outro aparelho');
  ok(true, 'conflito entre aparelhos detectado');
  await print('10-conflito');
  await clicarTexto('Manter a minha'); await esperar(500);
  ok((await pg.inputValue('#pd-form [name=observacoes]')) === 'mudado no celular', 'escolheu manter a versão deste aparelho');

  console.log('Lixeira');
  await pg.click('#pd-excluir'); await clicarTexto('Excluir', '.modal button'); await pg.waitForURL(/#pedidos$/);
  ok((await texto('#pd-lista')).includes('Nenhum pedido'), 'pedido saiu da lista');
  await pg.goto(BASE + '#pedidos/lixeira'); await pg.waitForSelector('#pd-lista .lista-item');
  await pg.click('#pd-lista .lista-item'); await pg.click('#pd-restaurar'); await esperar(400);
  ok(!(await pg.locator('#pd-restaurar').count()), 'pedido restaurado da lixeira');

  console.log('Cliente com pedido');
  await pg.goto(BASE + '#clientes'); await pg.click('#c-lista .lista-item'); await pg.waitForSelector('#c-excluir');
  await pg.click('#c-excluir'); await esperar(200);
  ok((await texto('#toast')).includes('não pode ser excluído'), 'não exclui cliente com pedido');

  console.log('Offline');
  await contexto.setOffline(true);
  await pg.goto(BASE + '#clientes').catch(() => {});
  await pg.evaluate(() => { location.hash = '#inicio'; location.hash = '#clientes'; });
  await pg.waitForSelector('#c-novo');
  await pg.click('#c-novo'); await pg.fill('#f-cli [name=nome]', 'Bruno Offline'); await pg.click('#f-cli [type=submit]'); await esperar(500);
  ok((await texto('#pendentes')).includes('1 alteração pendente'), 'salvou offline com aviso amarelo');
  await print('11-offline');
  await contexto.setOffline(false); await pg.evaluate(() => dispatchEvent(new Event('online'))); await esperar(800);
  ok(await pg.locator('#pendentes').isHidden(), 'enviou ao voltar a internet');
  ok(await pg.evaluate(() => window.__mock.banco().t.clientes.some(c => c.nome === 'Bruno Offline')), 'cliente offline chegou no banco');

  console.log('Início, configurações e exportação');
  await pg.goto(BASE + '#inicio'); await pg.waitForSelector('.numero-grande');
  await print('12-inicio');
  await pg.goto(BASE + '#mais'); await pg.waitForSelector('.lista'); await print('13-mais');
  await pg.goto(BASE + '#configuracoes'); await pg.waitForSelector('#f-cfg');
  ok((await pg.inputValue('#f-cfg [name=cnpj]')) === '65.480.613/0001-19', 'configurações vêm preenchidas');
  await pg.fill('#f-cfg [name=horario]', 'seg a sáb, 11h–20h'); await pg.click('#f-cfg [type=submit]'); await esperar(400);
  ok(await pg.evaluate(() => window.__mock.banco().t.configuracoes[0]?.dados?.horario === 'seg a sáb, 11h–20h'), 'configurações salvas');
  await print('14-configuracoes');
  const [planilha] = await Promise.all([pg.waitForEvent('download'), pg.click('#cfg-exportar')]);
  ok(/^hub-grafica-\d{4}-\d{2}-\d{2}\.xlsx$/.test(planilha.suggestedFilename()), 'planilha de backup baixada');

  console.log('Conversas do WhatsApp');
  let enviado = null;
  await pg.route('**/functions/v1/whatsapp-enviar', async r => {
    enviado = JSON.parse(r.request().postData());
    const msg = await pg.evaluate(e => {
      const b = window.__mock.banco();
      const m = { id: crypto.randomUUID(), user_id: b.sessao?.user?.id || '11111111-1111-4111-8111-111111111111', direcao: 'enviada', tipo: 'text', texto: e.texto, cliente_id: e.cliente_id, telefone: '5511900000002', status: 'sent', lida: true, criado_em: new Date().toISOString() };
      b.t.whatsapp_mensagens.push(m); window.__mock.gravar(); return m;
    }, enviado);
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, mensagem: msg }) });
  });
  const cliWa = await pg.evaluate(() => {
    const b = window.__mock.banco(); const U = '11111111-1111-4111-8111-111111111111';
    const c = { id: crypto.randomUUID(), user_id: U, nome: 'Carla do Zap', whatsapp: '(11) 90000-0002', documento: '', endereco: '', observacoes: '', arquivado: false, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() };
    b.t.clientes.push(c);
    const f = { id: crypto.randomUUID(), user_id: U, numero: ++b.seq, cliente_id: c.id, itens: [], desconto: { tipo: 'reais', valor: 0 }, total_centavos: 0, etapa: 'orcamento', prazo: null, os_fpq: '', link_arte: '', observacoes: '[WhatsApp] Quero 500 panfletos', excluido_em: null, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(), etapa_em: new Date().toISOString() };
    b.t.fichas.push(f);
    const t0 = Date.now() - 60000;
    b.t.whatsapp_mensagens.push(
      { id: crypto.randomUUID(), user_id: U, direcao: 'recebida', tipo: 'text', texto: 'Oi! Quero 500 panfletos A5', cliente_id: c.id, ficha_id: f.id, telefone: '5511900000002', nome_contato: 'Carla', status: '', lida: false, criado_em: new Date(t0).toISOString() },
      { id: crypto.randomUUID(), user_id: U, direcao: 'enviada', tipo: 'auto', texto: 'Olá, Carla! 👋 Aqui é a *Johen Arte Gráfica*.', cliente_id: c.id, ficha_id: f.id, telefone: '5511900000002', status: 'read', lida: true, criado_em: new Date(t0 + 2000).toISOString() });
    window.__mock.gravar(); return c.id;
  });
  await pg.goto(BASE + '#conversas'); await pg.waitForSelector('#cv-lista .lista');
  ok((await texto('#cv-lista')).includes('Carla do Zap'), 'conversa aparece na lista');
  ok(await pg.locator('#cv-lista .conv-selo').count() === 1, 'mostra mensagem não lida');
  ok(await pg.locator('#nav a[data-rota=conversas].ativo').count() === 1, 'menu marca Conversas');
  await print('15-conversas');
  await pg.click('#cv-lista .lista-item'); await pg.waitForSelector('.conv-bolha');
  ok(await pg.locator('.conv-bolha.conv-ele').count() === 1 && await pg.locator('.conv-bolha.conv-eu').count() === 1, 'bolhas do cliente e da loja');
  ok(/resposta automática/i.test(await texto('.conv-eu')), 'resposta automática identificada');
  ok((await texto('#cv-ficha')).includes('Montar orçamento'), 'atalho para o orçamento da conversa');
  await esperar(300);
  ok(await pg.evaluate(id => window.__mock.banco().t.whatsapp_mensagens.filter(m => m.cliente_id === id && m.direcao === 'recebida').every(m => m.lida), cliWa), 'abrir a conversa marca como lida');
  ok(await pg.locator('#cv-janela').isHidden(), 'dentro das 24h não mostra aviso');
  await pg.fill('#cv-texto', 'Oi Carla! 500 panfletos A5 ficam R$ 120,00.'); await pg.click('.conv-enviar');
  await pg.waitForFunction(() => document.querySelectorAll('.conv-bolha.conv-eu').length === 2 && !document.querySelector('.conv-enviando'));
  ok(enviado?.cliente_id === cliWa && enviado.texto.includes('R$ 120,00'), 'resposta enviada pela função do WhatsApp');
  ok((await pg.inputValue('#cv-texto')) === '', 'campo limpo depois de enviar');
  await print('16-conversa');
  await pg.route('**/functions/v1/whatsapp-ia', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, texto: 'Claro, Carla! Você já tem a arte pronta?' }) }));
  await pg.click('[data-ia]'); await pg.waitForFunction(() => document.querySelector('#cv-texto').value.includes('arte pronta'));
  ok(true, 'IA sugere a resposta no campo, sem enviar');
  ok(await pg.locator('.conv-bolha.conv-eu').count() === 2, 'sugestão da IA não é enviada sozinha');
  await pg.fill('#cv-texto', '');
  ok(await pg.locator('.conv-rapida[data-r]').count() === 9, 'respostas prontas aparecem');
  await pg.locator('.conv-rapida', { hasText: 'Pix' }).click();
  ok((await pg.inputValue('#cv-texto')).includes('65.480.613/0001-19'), 'resposta pronta preenche o Pix');
  await pg.fill('#cv-texto', '');
  await pg.locator('.conv-rapida', { hasText: 'Pronto' }).click();
  ok((await pg.inputValue('#cv-texto')).startsWith('Carla, seu pedido está pronto'), 'resposta pronta usa o nome do cliente');
  await pg.fill('#cv-texto', '');
  await pg.click('[data-editar]'); await pg.waitForSelector('#rp-salvar');
  await pg.click('#rp-nova');
  await pg.locator('.rp-item').last().locator('input').fill('Frete');
  await pg.locator('.rp-item').last().locator('textarea').fill('Entregamos por motoboy, {cliente}.');
  await print('17-respostas-prontas');
  await pg.click('#rp-salvar'); await esperar(400);
  ok(await pg.locator('.conv-rapida[data-r]').count() === 10, 'nova resposta pronta salva');
  ok(await pg.evaluate(() => window.__mock.banco().t.configuracoes[0]?.dados?.respostas?.length === 10 && window.__mock.banco().t.configuracoes[0].dados.horario === 'seg a sáb, 11h–20h'), 'salvar respostas mantém as configurações');
  await pg.click('#cv-ficha .btn-primario'); await pg.waitForSelector('#o-cliente');
  ok((await texto('#o-cliente')).includes('Carla do Zap'), 'atalho abre o orçamento com o cliente');

  console.log('Balcão');
  await pg.goto(BASE + '#inicio'); await pg.waitForSelector('.atalho.escuro');
  await pg.click('.atalho.escuro'); await pg.waitForSelector('.bal-btn');
  ok(await pg.locator('.bal-btn').count() === 8, 'balcão mostra os botões de serviço');
  ok(await pg.locator('#b-caixa').isHidden(), 'caixa escondido sem itens');
  const btnPB = pg.locator('.bal-btn').nth(0), btnCor = pg.locator('.bal-btn').nth(1);
  for (let k = 0; k < 10; k++) await btnPB.click();
  await btnCor.click(); await btnCor.click();
  ok((await texto('.bal-btn >> nth=0')).includes('10'), 'contador no botão');
  ok((await pg.textContent('#b-registrar')).includes('14,00'), 'total soma 10×1 + 2×2');
  await pg.locator('[data-menos="1"]').click();
  ok((await pg.textContent('#b-registrar')).includes('12,00'), 'menos tira um');
  await pg.fill('#b-total', '10'); await pg.locator('#b-total').blur();
  ok((await pg.textContent('#b-registrar')).includes('10,00') && (await texto('.bal-desc')).includes('2,00'), 'total editável vira desconto');
  await pg.fill('#b-total', '50'); await pg.locator('#b-total').blur();
  ok((await pg.textContent('#b-registrar')).includes('10,00'), 'não deixa total maior que o valor cheio');
  await pg.click('[data-forma=dinheiro]');
  await print('19-balcao');
  await pg.click('#b-registrar'); await pg.waitForFunction(() => document.querySelector('#b-caixa').hidden);
  await esperar(300);
  const venda = await pg.evaluate(() => window.__mock.banco().t.vendas_balcao[0]);
  ok(venda && venda.total_centavos === 1000 && venda.subtotal_centavos === 1200 && venda.forma === 'dinheiro' && venda.itens.length === 2, 'venda salva com desconto e forma');
  ok((await texto('#b-hoje')).includes('10× Impressão P&B'), 'aparece em vendas de hoje');
  await pg.click('#b-editar'); await pg.waitForSelector('#be-salvar');
  ok(await pg.locator('#be-padrao').count() === 0, 'sem botão voltar ao padrão');
  { const h = pg.locator('[data-alca="0"]'); const b1 = await h.boundingBox(); const b3 = await pg.locator('.be-item').nth(2).boundingBox();
    await pg.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2); await pg.mouse.down();
    for (let k = 1; k <= 10; k++) await pg.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2 + (b3.y + b3.height / 2 - b1.y - b1.height / 2 + 30) * k / 10);
    await pg.mouse.up(); }
  ok((await pg.inputValue('.be-item >> nth=2 >> [data-c=nome]')) === 'Impressão P&B', 'arrastar muda a ordem');
  await pg.locator('[data-alca="2"]').focus(); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp');
  ok((await pg.inputValue('.be-item >> nth=0 >> [data-c=nome]')) === 'Impressão P&B', 'setas do teclado mudam a ordem');
  await pg.locator('.be-item').first().locator('[data-c=preco]').fill('1,20');
  await pg.click('#be-salvar'); await esperar(400);
  ok((await texto('.bal-btn >> nth=0')).includes('1,20'), 'preço do botão editável');
  ok(await pg.evaluate(() => { const d = window.__mock.banco().t.configuracoes[0].dados; return d.balcao?.[0]?.preco === 1.2 && d.respostas?.length === 10; }), 'botões salvos sem perder configurações');
  await pg.goto(BASE + '#inicio'); await pg.waitForSelector('#painel .kpi');
  ok((await texto('#painel')).includes('do balcão'), 'balcão entra no recebido do início');

  console.log('Balcão flutuante e orçamento em outra aba');
  await pg.goto(BASE + '#orcamento'); await pg.waitForSelector('#o-busca-cli');
  await pg.fill('#o-busca-cli', 'ana'); await pg.click('#o-sug [data-cli]');
  await pg.fill('#o-obs', 'Rascunho demorado');
  ok(await pg.isVisible('#fab-balcao'), 'botão flutuante do balcão aparece');
  await pg.click('#fab-balcao'); await pg.waitForSelector('#painel-balcao:not([hidden]) .bal-btn');
  ok(await pg.isHidden('#fab-balcao'), 'botão some com o painel aberto');
  await print('20-balcao-flutuante');
  await pg.locator('#painel-conteudo .bal-btn').nth(2).click();
  await pg.click('#painel-conteudo #b-registrar');
  await pg.waitForSelector('#painel-balcao', { state: 'hidden' });
  ok((await pg.inputValue('#o-obs')) === 'Rascunho demorado', 'orçamento continua igual depois do balcão');
  ok(await pg.evaluate(() => window.__mock.banco().t.vendas_balcao.length === 2), 'venda do painel registrada');
  await pg.click('#fab-balcao'); await pg.waitForSelector('#painel-balcao:not([hidden])');
  await pg.click('#painel-fechar'); ok(await pg.isHidden('#painel-balcao'), 'fecha o painel no X');
  const [aba] = await Promise.all([contexto.waitForEvent('page'), pg.click('#o-aba')]);
  await aba.waitForSelector('#o-obs');
  ok((await aba.inputValue('#o-obs')) === 'Rascunho demorado' && (await aba.textContent('#o-cliente')).includes('Ana Souza'), 'outra aba abre o mesmo orçamento');
  await pg.waitForFunction(() => location.hash === '#inicio');
  ok(true, 'aba atual volta para o início');
  await aba.close();
  await pg.goto(BASE + '#balcao'); await pg.waitForSelector('.bal-btn');
  ok(await pg.isHidden('#fab-balcao'), 'sem botão flutuante dentro da própria tela do balcão');

  console.log('Criar produto novo no orçamento');
  await pg.goto(BASE + '#orcamento'); await pg.waitForSelector('#o-add');
  await pg.click('#o-add'); await pg.waitForSelector('#ei-criar');
  await pg.click('#ei-criar'); await pg.waitForSelector('#f-extra');
  await pg.fill('#f-extra [name=nome]', 'Placa de PVC 3mm'); await pg.fill('#f-extra [name=preco]', '45');
  await pg.click('#f-extra [type=submit]');
  await pg.waitForFunction(() => document.querySelector('#modal .modal-topo h2')?.textContent.includes('Placa de PVC'));
  ok(true, 'depois de criar, já abre o item com o produto novo');
  ok(await pg.evaluate(() => window.__mock.banco().t.produtos.some(p => p.nome === 'Placa de PVC 3mm')), 'produto novo salvo em Produtos');
  await pg.click('#modal [data-fechar]');
  await pg.click('#o-add'); await pg.fill('#ei-busca', 'pvc');
  ok((await texto('#ei-lista')).includes('Placa de PVC 3mm'), 'produto novo aparece na busca');
  await pg.click('#modal [data-fechar]');
  await pg.click('#o-add'); await pg.click('#ei-criar'); await pg.waitForSelector('#f-extra');
  await pg.click('#f-extra ~ * [data-fechar], #modal .modal-topo [data-fechar]');
  await pg.waitForSelector('#ei-criar');
  ok(true, 'cancelar o cadastro volta para a lista de produtos');
  await pg.click('#modal [data-fechar]');

  console.log('Cadastro completo');
  await pg.goto(BASE + '#produtos'); await pg.waitForSelector('#p-novo');
  await pg.click('#p-novo'); await pg.waitForSelector('#f-extra [name=custo]');
  await pg.fill('#f-extra [name=nome]', 'Envelope ofício timbrado');
  await pg.fill('[name=referencia]', 'ENV-01'); await pg.fill('[name=grupo]', 'Papelaria'); await pg.fill('[name=formato]', '23×11 cm');
  await pg.fill('[name=complemento]', 'usar papel 90g da prateleira 2');
  await pg.fill('[name=custo]', '1'); await pg.locator('[name=custo]').blur();
  await pg.fill('[name=margem_vista]', '150'); await pg.locator('[name=margem_vista]').blur();
  ok((await pg.inputValue('[name=preco]')) === '2,50', 'custo + margem calcula o valor à vista');
  await pg.fill('[name=preco_atacado]', '2'); await pg.locator('[name=preco_atacado]').blur();
  ok((await pg.inputValue('[name=margem_atacado]')) === '100,00', 'valor digitado ajusta a margem');
  await pg.check('[name=controla_estoque]'); await pg.fill('[name=estoque_atual]', '40'); await pg.fill('[name=estoque_min]', '50');
  await pg.locator('#modal .modal-caixa').evaluate(e => { e.style.maxHeight = 'none'; }); await pg.locator('#modal .modal-caixa').screenshot({ path: 'tests/prints/23-cadastro.png' });
  await pg.setViewportSize({ width: 1280, height: 900 }); await pg.locator('#modal .modal-caixa').screenshot({ path: 'tests/prints/23-cadastro-pc.png' }); await pg.setViewportSize({ width: 380, height: 820 });
  await pg.click('#f-extra [type=submit]'); await esperar(400);
  const env = await pg.evaluate(() => window.__mock.banco().t.produtos.find(p => p.nome === 'Envelope ofício timbrado'));
  ok(env?.preco === 2.5 && env.detalhes?.referencia === 'ENV-01' && env.detalhes.custo === 1 && env.detalhes.estoque_atual === 40, 'salva cadastro completo');
  await pg.fill('#p-busca', 'ENV-01');
  ok((await texto('#p-lista')).includes('Envelope ofício') && (await texto('#p-lista')).includes('baixo'), 'busca pela referência e avisa estoque baixo');
  await pg.click('#p-novo'); await pg.click('[data-servico="1"]');
  ok(await pg.isHidden('#x-estoque'), 'serviço esconde o estoque');
  await pg.click('#modal .modal-topo [data-fechar]');

  console.log('Produto por quantidade e valor');
  await pg.goto(BASE + '#produtos'); await pg.waitForSelector('#p-novo');
  await pg.click('#p-novo'); await pg.waitForSelector('#f-extra'); await pg.click('[data-tipo=qtd]'); await pg.waitForSelector('#x-qtd:not([hidden])');
  ok(await pg.locator('[data-linha=qtd]').count() === 3, 'já vem com 100, 500 e 1000');
  await pg.fill('#f-extra [name=nome]', 'Adesivo redondo 5cm');
  const linhas = pg.locator('[data-linha=qtd]');
  await linhas.nth(0).locator('[data-k=preco]').fill('35'); await linhas.nth(1).locator('[data-k=preco]').fill('120');
  await linhas.nth(2).locator('[data-k=qtd]').fill(''); await linhas.nth(2).locator('[data-k=preco]').fill('200');
  await pg.click('#x-mais-qtd'); await linhas.nth(3).locator('[data-k=qtd]').fill('250'); await linhas.nth(3).locator('[data-k=preco]').fill('70');
  await pg.click('#f-extra [type=submit]');
  await esperar(200);
  ok(await pg.isVisible('#f-extra'), 'linha com valor e sem quantidade dá erro');
  await linhas.nth(2).locator('[data-k=preco]').fill('');
  await pg.click('#f-extra [type=submit]'); await esperar(400);
  const salvo = await pg.evaluate(() => window.__mock.banco().t.produtos.find(p => p.nome === 'Adesivo redondo 5cm'));
  ok(salvo?.tipo === 'opcoes' && salvo.opcoes.map(o => o.label).join(',') === '100 un.,250 un.,500 un.', 'salva em ordem como 100 un., 250 un., 500 un.');
  await pg.fill('#p-busca', 'Adesivo redondo');
  ok((await texto('#p-lista')).includes('Quantidade e valor') && (await texto('#p-lista')).includes('35,00'), 'lista mostra tipo e a partir de');
  await pg.goto(BASE + '#orcamento'); await pg.waitForSelector('#o-add'); await pg.click('#o-add');
  await pg.fill('#ei-busca', 'adesivo redondo'); await pg.click('#ei-lista [data-p]');
  ok((await texto('#ei-opcoes')).includes('250 un.') && (await texto('#ei-opcoes')).includes('70,00'), 'no orçamento escolhe a quantidade como no cartão');
  await pg.click('#ei-opcoes input[value=outra]');
  await pg.fill('#ei-o-q', '2000'); await pg.fill('#ei-o-v', '380');
  ok((await pg.inputValue('#ei-valor')).startsWith('380,00'), 'outra quantidade digitada vira o valor');
  await pg.fill('#ei-valor', '350'); await pg.locator('#ei-valor').press('Enter');
  ok((await texto('#ei-calc')).includes('calculado R$ 380,00'), 'valor ajustado mostra o calculado');
  await print('22-produto-quantidade');
  await pg.click('#ei-ok'); await pg.waitForSelector('#modal', { state: 'hidden' });
  ok((await texto('#o-itens')).includes('2000 un.') && (await texto('#o-total')).includes('350,00'), 'item entra com quantidade manual e valor ajustado');
  await pg.click('#o-itens [data-editar]'); await pg.waitForSelector('#ei-valor');
  ok((await pg.inputValue('#ei-valor')).startsWith('350,00') && await pg.isChecked('#ei-opcoes input[value=outra]'), 'editar mantém a quantidade e o valor ajustado');
  await pg.click('#ei-mais');
  ok((await pg.inputValue('#ei-valor')).startsWith('760,00'), 'mudar a quantidade volta ao valor calculado');
  await pg.click('#modal [data-fechar]');
  await pg.click('#o-add'); ok((await texto('#ei-lista li >> nth=0')).includes('Adesivo redondo') || (await texto('#ei-lista li >> nth=0')).includes('Placa de PVC'), 'meus produtos aparecem primeiro sem buscar');
  await pg.click('#modal [data-fechar]');

  console.log('Zerar resumo');
  await pg.goto(BASE + '#inicio'); await pg.waitForSelector('#painel .kpi');
  const antes = await texto('#painel .kpi >> nth=0');
  ok(!antes.includes('R$ 0,00'), 'resumo tem valores antes de zerar');
  await pg.click('#r-zerar'); await pg.click('#modal [data-ok]');
  await pg.waitForSelector('.resumo-desde');
  ok((await texto('#painel .kpi >> nth=0')).includes('R$ 0,00'), 'zerar deixa o recebido em zero');
  ok(await pg.evaluate(() => window.__mock.banco().t.pagamentos.length > 0 && window.__mock.banco().t.vendas_balcao.length > 0), 'zerar não apaga pagamentos nem vendas');
  await pg.click('#r-historico'); await pg.waitForSelector('#modal .hist-item');
  ok(await pg.locator('#modal .hist-item').count() === 2, 'histórico mostra agora + período zerado');
  ok(!(await texto('#modal .hist-item >> nth=1')).includes('R$ 0,00 '), 'período guardado tem os valores de antes');
  await print('21-historico');
  await pg.click('#modal [data-fechar]');

  console.log('IA e desempenho');
  await pg.goto(BASE + '#conversas'); await pg.waitForSelector('#cv-ia');
  await esperar(300);
  ok(await pg.isChecked('#cv-ia'), 'IA fora do horário vem ligada');
  await pg.click('#cv-ia'); await esperar(400);
  ok(await pg.evaluate(() => { const d = window.__mock.banco().t.configuracoes[0].dados; return d.ia_auto === false && d.respostas.length === 10 && d.horario === 'seg a sáb, 11h–20h'; }), 'desligar a IA salva sem perder configurações');
  await pg.click('#cv-ia'); await esperar(400);
  await pg.goto(BASE + '#desempenho'); await pg.waitForSelector('.gr');
  ok(await pg.locator('.gr').count() >= 4, 'gráficos de desempenho desenhados');
  ok(await pg.locator('.gr-legenda').count() === 1, 'gráfico de 2 séries tem legenda');
  await pg.locator('.gr').first().locator('.graf-col').last().click();
  ok((await texto('.gr .graf-dica')).includes('Vendido'), 'tocar na coluna mostra os valores');
  await print('18-desempenho');

  console.log('PC (1280 px)');
  await pg.setViewportSize({ width: 1280, height: 800 });
  for (const t of ['inicio', 'pedidos', 'orcamento', 'clientes', 'receber', 'produtos', 'conversas', 'conversa/' + cliWa, 'desempenho', 'balcao']) {
    await pg.goto(BASE + '#' + t); await esperar(500); await print(`pc-${t}`);
  }
  ok(await pg.evaluate(() => getComputedStyle(document.getElementById('nav')).width === '220px'), 'no PC a navegação vira lateral');
} catch (e) {
  falhas++; console.log('ERRO', e.message);
  await pg.screenshot({ path: path.join(PRINTS, 'erro.png'), fullPage: true }).catch(() => {});
}
ok(errosConsole.length === 0, 'sem erros no console' + (errosConsole.length ? ': ' + errosConsole.join(' | ') : ''));
console.log(`\n${passos - falhas}/${passos} verificações passaram`);
await navegador.close(); servidor.close();
process.exit(falhas ? 1 : 0);
