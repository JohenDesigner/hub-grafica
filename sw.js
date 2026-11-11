// Guarda os arquivos do app para abrir sem internet. Dados (Supabase) e catálogo do site não passam por aqui.
const VERSAO = 'hub-v15';
const ARQUIVOS = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'img/logo-icone.webp', 'img/logo-wordmark.webp', 'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/supabase.js', 'vendor/jspdf.umd.min.js', 'vendor/xlsx.full.min.js',
  'js/app.js', 'js/calc.js', 'js/catalogo.js', 'js/cnpj.js', 'js/config.js', 'js/conflito.js', 'js/db.js', 'js/exportar.js',
  'js/formato.js', 'js/grafico.js', 'js/pdf.js', 'js/rotas.js', 'js/ui.js', 'js/whatsapp.js',
  'js/telas/clientes.js', 'js/telas/conversas.js', 'js/telas/desempenho.js', 'js/telas/balcao.js', 'js/telas/configuracoes.js', 'js/telas/inicio.js', 'js/telas/orcamento.js',
  'js/telas/pedidos.js', 'js/telas/produtos.js', 'js/telas/receber.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // Supabase, catálogo e fontes vão direto
  // rede primeiro (pega versão nova), cache se estiver sem internet
  e.respondWith(
    fetch(req).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
