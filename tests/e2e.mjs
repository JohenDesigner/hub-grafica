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
  await pg.click('#f-cli [type=submit]'); await pg.waitForURL(/#cliente\//);
  ok((await texto('main')).includes('Ana Souza'), 'cliente criado e detalhe aberto');
  await print('04-cliente');

  console.log('Orçamento');
  await pg.goto(BASE + '#orcamento'); await pg.waitForSelector('#o-busca-cli');
  await pg.fill('#o-busca-cli', 'ana'); await pg.click('#o-sug [data-cli]');
  await pg.click('#o-add'); await pg.fill('#ei-busca', 'lona 480g brilho');
  await pg.locator('#ei-lista [data-p]').first().click();
  await pg.locator('#ei-opcoes input[value=livre]').check();
  await pg.fill('#ei-l', '100'); await pg.fill('#ei-a', '60'); await pg.fill('#ei-q', '2'); await pg.dispatchEvent('#ei-q', 'input');
  ok((await texto('#ei-valor')) === 'R$ 144,00', 'banner outro tamanho 100×60 ×2 = R$ 144,00');
  await print('05-editor-item');
  await pg.click('#ei-ok');
  await pg.click('#o-add'); await pg.fill('#ei-busca', 'couché 250g brilho (frente)');
  await pg.locator('#ei-lista [data-p]').first().click();
  await pg.locator('#ei-opcoes input[value="0"]').check();
  ok((await texto('#ei-valor')) === 'R$ 76,50', 'pacote de 100 cartões = R$ 76,50');
  await pg.click('#ei-ok');
  await pg.click('#o-add'); await pg.fill('#ei-busca', 'adesivo com recorte vinil branco brilho');
  await pg.locator('#ei-lista [data-p]').first().click();
  await pg.fill('#ei-l', '10'); await pg.fill('#ei-a', '10'); await pg.dispatchEvent('#ei-a', 'input');
  ok((await texto('#ei-valor')) === 'R$ 85,00' && await pg.locator('#ei-min').isVisible(), 'adesivo pequeno cai no mínimo R$ 85,00 com aviso');
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

  console.log('PC (1280 px)');
  await pg.setViewportSize({ width: 1280, height: 800 });
  for (const t of ['inicio', 'pedidos', 'orcamento', 'clientes', 'receber', 'produtos']) {
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
