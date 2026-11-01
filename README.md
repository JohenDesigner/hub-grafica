# Hub da Gráfica — Johen Arte Grafica

App de orçamento, pedidos, clientes e valores a receber, para usar no celular e no PC junto com o FpqSystem.

**Endereço:** https://johendesigner.github.io/hub-grafica/

## Como usar
- Entre com o e-mail e a senha criados no Supabase (Authentication → Users).
- No celular: abra o endereço no Chrome → menu → **Adicionar à tela inicial**. No PC: ícone de instalar na barra de endereço.
- Preços: vêm sempre do site novo (`Johen-site/novo/dados/produtos.json`). Mudou no site, o próximo orçamento já usa. Produtos que não estão no site (envelopamento, criação de arte…) são cadastrados em **Mais → Produtos → Extra**.
- Sem internet: o app abre com a última cópia; o que for salvo fica "pendente de envio" e sobe sozinho quando a internet volta.

## Backup
**Mais → Configurações → Exportar planilha** baixa um Excel com clientes, pedidos e pagamentos.

## Se o banco pausar
O plano grátis do Supabase pausa o projeto depois de 7 dias sem uso. Para reativar: supabase.com → projeto → **Restore project**. Os dados não se perdem.

## Para quem for mexer no código
- Sem build: HTML, CSS e JavaScript (módulos). Bibliotecas em `vendor/` (Supabase JS 2.118, jsPDF 2.5, SheetJS 0.18).
- Banco: `supabase/schema.sql` (aplicado no projeto `arbebltdznrmgnqchctw`, região São Paulo).
- Testes: `npm test` (cálculos) e `node tests/e2e.mjs` (app inteiro no navegador com um Supabase de mentira; prints em `tests/prints/`).
- Plano de construção: `docs/plano.md`.
