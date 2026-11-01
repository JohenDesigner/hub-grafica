# Hub da Gráfica — Plano de Execução

**Objetivo:** app leve da Johen Arte Grafica para orçamento, pedidos, clientes e valores a receber, no celular e no PC, usado junto com o FpqSystem.
**Como vai funcionar:** telas em HTML/CSS/JS puro (sem build), hospedadas no GitHub Pages. Os preços vêm sempre do catálogo do site novo (`novo/dados/produtos.json`); só os produtos extras ficam no banco. Dados e login no Supabase (plano grátis), com regras de acesso que só liberam a conta logada. Funciona offline com fila de envio e é instalável como app (PWA).
**Tecnologias:** HTML, CSS, JavaScript (módulos ES), Supabase JS v2 (CDN), jsPDF (CDN), SheetJS (CDN), Node `node --test` para os testes de cálculo, Playwright para teste visual.
**Especificação:** documento "Hub da Gráfica — Especificação" (Claude Docs).

## Regras gerais

- Celular primeiro: largura base 380 px, margem lateral 16 px, sem rolagem lateral, área de toque ≥ 44 px. No PC (≥ 900 px) a barra de baixo vira lateral.
- Identidade visual da Johen Arte Grafica (cores, logo e fonte do arquivo de marca). Nada de emoji roxo.
- Todo texto da interface em português do Brasil. Dinheiro sempre `R$ 1.234,56`. Datas `dd/mm/aaaa`.
- Valores calculados em centavos inteiros e arredondados uma vez, no fim de cada item.
- Medidas digitadas em centímetros.
- Nenhuma tela lê ou grava no Supabase direto: tudo passa por `js/db.js`.
- Nenhuma função de cálculo fica fora de `js/calc.js`, e o cálculo é igual ao do site novo (`novo/assets/site.js`).
- Commits em português, um por tarefa, no repositório `JohenDesigner/hub-grafica`.

## Mapa de arquivos

| Arquivo | Função |
| --- | --- |
| `index.html` | casca do app: cabeçalho, área das telas, navegação, tela de login |
| `manifest.json` | dados para instalar como app (nome, ícones, cores) |
| `sw.js` | service worker: guarda os arquivos do app para abrir offline |
| `icons/icon-192.png`, `icons/icon-512.png` | ícones do app |
| `css/app.css` | todo o visual, celular primeiro, tokens de cor da marca |
| `js/config.js` | URL e chave pública do Supabase |
| `js/calc.js` | cálculos puros: item, ficha, saldo, validações |
| `js/formato.js` | formatar moeda, data, telefone; ler número digitado com vírgula |
| `js/db.js` | cliente Supabase, login, leitura/gravação, fila offline, checagem de conflito |
| `js/ui.js` | aviso (toast), confirmação, modal, barra de "pendente de envio" |
| `js/rotas.js` | troca de tela pelo `#hash` da URL e marca o item ativo da navegação |
| `js/whatsapp.js` | monta as 4 mensagens e o link `wa.me` |
| `js/pdf.js` | gera o PDF do orçamento |
| `js/exportar.js` | gera a planilha Excel de backup |
| `js/telas/inicio.js` | tela Início |
| `js/telas/orcamento.js` | tela Orçamento (nova ficha e edição de ficha em Orçamento) |
| `js/telas/pedidos.js` | lista por etapa e detalhe da ficha |
| `js/telas/clientes.js` | lista, cadastro e histórico de clientes |
| `js/telas/receber.js` | lista do que falta receber e registro de pagamento |
| `js/catalogo.js` | lê o catálogo do site novo e converte para a forma de produto do hub |
| `js/telas/produtos.js` | produtos do site (leitura) e cadastro dos extras do hub |
| `js/telas/configuracoes.js` | dados da gráfica, textos, validade, exportar, sair |
| `js/app.js` | ponto de entrada: login, registra o service worker, liga as rotas |
| `supabase/schema.sql` | tabelas, regras de acesso, gatilhos |
| `tests/calc.test.mjs` | testes automáticos de `calc.js` |
| `tests/catalogo.test.mjs` | testes automáticos de `catalogo.js` |
| `tests/formato.test.mjs` | testes automáticos de `formato.js` |
| `tests/whatsapp.test.mjs` | testes automáticos de `whatsapp.js` |
| `tests/visual.mjs` | abre cada tela em 380 px e 1280 px, tira print e falha se houver rolagem lateral ou erro no console |

## Nomes compartilhados (contrato entre tarefas)

```
// js/calc.js
export const TIPOS = ['opcoes', 'm2', 'unidade'];
export const ETAPAS = ['orcamento','sinal','arte','aprovacao','producao','pronto','entregue'];
export const NOMES_ETAPA = { orcamento:'Orçamento', sinal:'Sinal pago', arte:'Arte', aprovacao:'Aprovação', producao:'Produção', pronto:'Pronto', entregue:'Entregue', cancelado:'Cancelado' };
export function emCentavos(reais)                  // número → inteiro de centavos
export function areaPeca(larguraCm, alturaCm)      // m² de uma peça
export function calcularItem(item)                 // → { area, precoAplicado, centavos }
export function calcularFicha(itens, desconto)     // → { subtotal, desconto, total } em centavos
export function saldoAberto(totalCentavos, pagamentos) // → centavos
export function validarItem(item)                  // → null ou mensagem
export function validarPagamento(valorCentavos, saldoCentavos) // → null ou mensagem
export function orcamentoVencido(ficha, validadeDias, hoje) // → boolean
export function somarDiasUteis(isoData, dias)      // "2026-11-06", 1 → "2026-11-09"

// js/catalogo.js
export const URL_CATALOGO                          // dados/produtos.json do site novo
export const NOMES_CATEGORIA                       // cartoes → 'Cartões de Visita' … extras → 'Extras do hub'
export function prazoDias(texto)                   // "3 a 5 dias úteis" → 5 ; vazio → 3
export function siteParaProduto(p, categoria)      // produto do site → forma de produto do hub
export function catalogoDoSite(json)               // json inteiro → lista
export async function carregarCatalogo({ forcar }) // → { lista, quando, offline }

// js/formato.js
export function moeda(centavos)        // 123456 → "R$ 1.234,56"
export function lerNumero(texto)       // "1.234,5" → 1234.5 ; "" → NaN
export function data(iso)              // "2026-11-01..." → "01/11/2026"
export function soDigitos(texto)       // "(11) 98287-7142" → "11982877142"
export function telefoneWa(texto)      // → "5511982877142"

// js/db.js
export const db                        // cliente Supabase
export async function entrar(email, senha)
export async function sair()
export async function usuarioAtual()
export async function listar(tabela, filtros)       // filtros: { eq:{}, ilike:{}, order:'campo', desc:true, semExcluidos:true }
export async function obter(tabela, id)
export async function salvar(tabela, registro)      // insere ou atualiza; checa conflito por atualizado_em
export async function excluir(tabela, id)           // fichas: marca excluido_em; outros: apaga
export async function restaurar(id)                 // fichas: limpa excluido_em
export function pendentes()                         // quantos itens na fila offline
export async function enviarPendentes()
export function aoMudarPendentes(fn)                // fn(n) sempre que a fila muda
export class ConflitoError extends Error { constructor(local, remoto) }

// js/ui.js
export function avisar(texto, tipo)    // tipo: 'ok' | 'erro' | 'alerta'
export async function confirmar(texto) // → boolean
export function abrirModal(html)       // → elemento do modal
export function fecharModal()
export function atualizarPendentes(n)

// js/rotas.js
export function registrar(nome, { montar })   // montar(elRaiz, params)
export function ir(nome, params)
export function iniciar()

// js/whatsapp.js
export function mensagem(tipo, { ficha, cliente, cfg, saldo }) // tipo: 'orcamento'|'arte'|'pronto'|'cobranca'
export function linkWa(telefone, texto)

// js/pdf.js
export async function pdfOrcamento(ficha, cliente, cfg)  // baixa o arquivo

// js/exportar.js
export async function exportarPlanilha()
```

Forma de um produto (vindo do site ou extra do hub):

```
{
  "id": "site:banners:p1",       // extras do hub: uuid
  "origem": "site",              // site | hub
  "categoria": "banners",        // cartoes | panfletos | banners | adesivos | camisetas | canecas | extras
  "nome": "Banner ou faixa - Lona 480g Brilho — Acabamento em Madeira",
  "tipo": "opcoes",              // opcoes | m2 | unidade
  "opcoes": [{"label":"60×40cm","preco":55}],   // só opcoes
  "preco": 0,                    // R$ por m² (m2) ou por unidade (unidade)
  "m2_livre": 120,               // opcoes que aceitam outro tamanho (banners); 0 = não aceita
  "minimo": 55,                  // R$; 0 = sem mínimo
  "minimo_por": "peca",          // total | peca
  "acabamentos": [{"nome":"Caixinha personalizada","valor":5,"cobranca":"unidade"}],
  "prazo_dias": 5,               // dias úteis
  "ativo": true
}
```

Forma de um item dentro de `fichas.itens` (JSON) — cópia dos dados do produto no momento do orçamento:

```
{
  "produto_id": "site:banners:p1",
  "nome": "Banner ou faixa - Lona 480g Brilho — Acabamento em Madeira",
  "tipo": "opcoes",
  "quantidade": 2,
  "opcao": {"label":"90×60cm","preco":64.8},   // opcoes; null quando livre
  "livre": false,                 // true = outro tamanho (usa largura, altura, m2_livre, minimo por peça)
  "largura_cm": 0, "altura_cm": 0, // m2 e livre
  "preco": 0, "m2_livre": 120, "minimo": 55, "minimo_por": "peca",
  "acabamentos": [],              // só os marcados
  "descricao": "texto livre opcional"
}
```

`desconto` da ficha: `{ "tipo": "reais" | "pct", "valor": 10 }`.

---

### Tarefa 1: Repositório, banco e regras de acesso

**Arquivos:** criar `supabase/schema.sql`, `js/config.js`, `README.md`
**Usa de tarefas anteriores:** nada
**Entrega pras próximas:** tabelas `clientes`, `produtos`, `fichas`, `pagamentos`, `configuracoes`; colunas citadas abaixo; `SUPABASE_URL`, `SUPABASE_ANON_KEY`

- [ ] Passo 1: Johen cria a conta grátis no Supabase, cria o projeto `hub-grafica` (região São Paulo), cria o usuário dele em Authentication → Users (e-mail e senha) e desliga "Allow new users to sign up". Me passa a Project URL e a chave `anon public`.
- [ ] Passo 2: criar o repositório `JohenDesigner/hub-grafica` (público, para o GitHub Pages grátis; os dados não ficam no repositório).
- [ ] Passo 3: escrever `supabase/schema.sql`:

```sql
create extension if not exists pgcrypto;

create or replace function toca_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

create table clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  whatsapp text not null default '',
  documento text not null default '',
  endereco text not null default '',
  observacoes text not null default '',
  arquivado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table produtos (            -- só os extras do hub; os do site vêm do catálogo
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  tipo text not null check (tipo in ('opcoes','m2','unidade')),
  opcoes jsonb not null default '[]',
  preco numeric(12,2) not null default 0 check (preco >= 0),
  m2_livre numeric(12,2) not null default 0 check (m2_livre >= 0),
  minimo numeric(12,2) not null default 0 check (minimo >= 0),
  minimo_por text not null default 'total' check (minimo_por in ('total','peca')),
  acabamentos jsonb not null default '[]',
  prazo_dias int not null default 3 check (prazo_dias >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table fichas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  cliente_id uuid not null references clientes on delete restrict,
  itens jsonb not null default '[]',
  desconto jsonb not null default '{"tipo":"reais","valor":0}',
  total_centavos bigint not null default 0 check (total_centavos >= 0),
  etapa text not null default 'orcamento'
    check (etapa in ('orcamento','sinal','arte','aprovacao','producao','pronto','entregue','cancelado')),
  prazo date,
  os_fpq text not null default '',
  link_arte text not null default '',
  observacoes text not null default '',
  etapa_em timestamptz not null default now(),
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  ficha_id uuid not null references fichas on delete cascade,
  valor_centavos bigint not null check (valor_centavos > 0),
  forma text not null check (forma in ('pix','debito','credito','dinheiro')),
  tipo text not null default 'pagamento' check (tipo in ('sinal','pagamento')),
  pago_em date not null default current_date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table configuracoes (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  dados jsonb not null default '{}',
  atualizado_em timestamptz not null default now()
);

create trigger t_cli before update on clientes for each row execute function toca_atualizado();
create trigger t_pro before update on produtos for each row execute function toca_atualizado();
create trigger t_fic before update on fichas for each row execute function toca_atualizado();
create trigger t_pag before update on pagamentos for each row execute function toca_atualizado();
create trigger t_cfg before update on configuracoes for each row execute function toca_atualizado();

create or replace function marca_etapa() returns trigger language plpgsql as $$
begin if new.etapa is distinct from old.etapa then new.etapa_em = now(); end if; return new; end $$;
create trigger t_fic_etapa before update on fichas for each row execute function marca_etapa();

-- pagamento não pode passar do total da ficha
create or replace function checa_pagamento() returns trigger language plpgsql as $$
declare tot bigint; pago bigint;
begin
  select total_centavos into tot from fichas where id = new.ficha_id;
  select coalesce(sum(valor_centavos),0) into pago from pagamentos
    where ficha_id = new.ficha_id and id <> new.id;
  if pago + new.valor_centavos > tot then
    raise exception 'Pagamento maior que o valor em aberto';
  end if;
  return new;
end $$;
create trigger t_pag_checa before insert or update on pagamentos for each row execute function checa_pagamento();

-- lixeira: fichas excluídas há mais de 30 dias somem (rodado ao abrir o app)
create or replace function limpa_lixeira() returns void language sql security invoker as $$
  delete from fichas where user_id = auth.uid() and excluido_em < now() - interval '30 days';
$$;

alter table clientes enable row level security;
alter table produtos enable row level security;
alter table fichas enable row level security;
alter table pagamentos enable row level security;
alter table configuracoes enable row level security;

create policy dono on clientes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dono on produtos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dono on fichas for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dono on pagamentos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dono on configuracoes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index on fichas (user_id, etapa) where excluido_em is null;
create index on pagamentos (ficha_id);
```

- [ ] Passo 4: Johen cola o SQL em SQL Editor → Run (eu guio pelo celular). Verificação: em Table Editor aparecem as 5 tabelas, cada uma com o selo "RLS enabled".
- [ ] Passo 5: verificação de acesso sem login, rodada por mim:
  `curl "$URL/rest/v1/fichas?select=id" -H "apikey: $ANON"` → deve voltar `[]` (nada vaza sem login).
- [ ] Passo 6: `js/config.js`:

```js
export const SUPABASE_URL = 'https://<projeto>.supabase.co';
export const SUPABASE_ANON_KEY = '<chave anon public>';
```

- [ ] Passo 7: commit "Banco, regras de acesso e configuração".

### Tarefa 2: Cálculos e catálogo do site, com testes

**Arquivos:** criar `js/calc.js`, `js/catalogo.js`, `tests/calc.test.mjs`, `tests/catalogo.test.mjs`, `package.json`
**Usa de tarefas anteriores:** forma do item, do produto e do desconto (contrato acima)
**Entrega pras próximas:** todas as funções de `js/calc.js` e `js/catalogo.js` do contrato

- [ ] Passo 1: `package.json`:

```json
{ "name": "hub-grafica", "private": true, "type": "module",
  "scripts": { "test": "node --test tests/*.test.mjs" } }
```

- [ ] Passo 2: escrever `tests/calc.test.mjs` (valores conferidos com os preços do site novo em 01/11/2026):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emCentavos, areaPeca, calcularItem, calcularFicha, saldoAberto, validarItem,
  validarPagamento, orcamentoVencido, somarDiasUteis } from '../js/calc.js';

test('emCentavos arredonda', () => {
  assert.equal(emCentavos(1.005), 101);
  assert.equal(emCentavos(45), 4500);
});
test('area de banner 100x60', () => assert.equal(areaPeca(100, 60), 0.6));
test('opção: 2 pacotes de 100 cartões couché 250g', () => {
  assert.equal(calcularItem({ tipo: 'opcoes', quantidade: 2, opcao: { label: '100 un.', preco: 76.5 }, acabamentos: [] }).centavos, 15300);
});
test('opção com caixinha: 2 canecas brancas', () => {
  assert.equal(calcularItem({ tipo: 'opcoes', quantidade: 2, opcao: { label: 'cada', preco: 35 },
    acabamentos: [{ nome: 'Caixinha personalizada', valor: 5, cobranca: 'unidade' }] }).centavos, 8000);
});
test('m²: adesivo pequeno cai no mínimo do total', () => {
  const it = { tipo: 'm2', quantidade: 3, largura_cm: 20, altura_cm: 10, preco: 100, minimo: 85, minimo_por: 'total', acabamentos: [] };
  assert.equal(calcularItem(it).centavos, 8500);
  assert.equal(calcularItem({ ...it, quantidade: 1, largura_cm: 100, altura_cm: 100 }).centavos, 10000);
});
test('m² com acabamentos', () => {
  const r = calcularItem({ tipo: 'm2', quantidade: 2, largura_cm: 100, altura_cm: 60, preco: 45, minimo: 0,
    acabamentos: [{ nome: 'Ilhós', valor: 2, cobranca: 'unidade' },
                  { nome: 'Laminação', valor: 10, cobranca: 'm2' },
                  { nome: 'Arte', valor: 30, cobranca: 'fixo' }] });
  // 0,6 × 2 × 45 = 54 ; ilhós 2×2 = 4 ; laminação 0,6×2×10 = 12 ; arte 30 → 100
  assert.equal(r.area, 0.6);
  assert.equal(r.centavos, 10000);
});
test('banner em outro tamanho: mínimo por peça', () => {
  const it = { tipo: 'opcoes', livre: true, quantidade: 2, largura_cm: 50, altura_cm: 50, m2_livre: 120, minimo: 55, acabamentos: [] };
  assert.equal(calcularItem(it).centavos, 11000);              // 0,25 m² × 120 = 30 → 55 por peça × 2
  assert.equal(calcularItem({ ...it, quantidade: 1, largura_cm: 150, altura_cm: 100 }).centavos, 18000);
});
test('unidade', () => {
  assert.equal(calcularItem({ tipo: 'unidade', quantidade: 3, preco: 12.5, acabamentos: [] }).centavos, 3750);
});
test('ficha com desconto em reais e em %', () => {
  const itens = [{ tipo: 'unidade', quantidade: 1, preco: 100, acabamentos: [] }];
  assert.deepEqual(calcularFicha(itens, { tipo: 'reais', valor: 10 }), { subtotal: 10000, desconto: 1000, total: 9000 });
  assert.deepEqual(calcularFicha(itens, { tipo: 'pct', valor: 15 }), { subtotal: 10000, desconto: 1500, total: 8500 });
  assert.equal(calcularFicha(itens, { tipo: 'reais', valor: 500 }).total, 0);
});
test('saldo', () => {
  assert.equal(saldoAberto(10000, [{ valor_centavos: 3000 }, { valor_centavos: 2000 }]), 5000);
  assert.equal(saldoAberto(10000, []), 10000);
});
test('validações', () => {
  assert.equal(validarItem({ tipo: 'unidade', quantidade: 0, preco: 5, acabamentos: [] }), 'Quantidade precisa ser maior que zero');
  assert.equal(validarItem({ tipo: 'm2', quantidade: 1, largura_cm: 0, altura_cm: 50, preco: 5, acabamentos: [] }), 'Informe largura e altura');
  assert.equal(validarItem({ tipo: 'opcoes', quantidade: 1, acabamentos: [] }), 'Escolha uma opção');
  assert.equal(validarItem({ tipo: 'opcoes', livre: true, quantidade: 1, largura_cm: 50, altura_cm: 0, m2_livre: 120, acabamentos: [] }), 'Informe largura e altura');
  assert.equal(validarItem({ tipo: 'unidade', quantidade: 1, preco: 0, acabamentos: [] }), 'Preço precisa ser maior que zero');
  assert.equal(validarItem({ tipo: 'unidade', quantidade: 1, preco: 5, acabamentos: [{ nome: 'Lam', valor: 1, cobranca: 'm2' }] }), 'O acabamento Lam é por m² e precisa de medida');
  assert.equal(validarItem({ tipo: 'unidade', quantidade: 1, preco: 5, acabamentos: [] }), null);
  assert.equal(validarPagamento(6000, 5000), 'Valor maior que o que falta receber (R$ 50,00)');
  assert.equal(validarPagamento(0, 5000), 'Valor precisa ser maior que zero');
  assert.equal(validarPagamento(5000, 5000), null);
});
test('orçamento vencido', () => {
  const f = { etapa: 'orcamento', criado_em: '2026-11-01T12:00:00Z' };
  assert.equal(orcamentoVencido(f, 7, new Date('2026-11-08T11:00:00Z')), false);
  assert.equal(orcamentoVencido(f, 7, new Date('2026-11-09T13:00:00Z')), true);
  assert.equal(orcamentoVencido({ ...f, etapa: 'arte' }, 7, new Date('2026-12-01')), false);
});
test('dias úteis pulam sábado e domingo', () => {
  assert.equal(somarDiasUteis('2026-11-06', 1), '2026-11-09');   // sexta + 1 = segunda
  assert.equal(somarDiasUteis('2026-11-02', 5), '2026-11-09');   // segunda + 5 = segunda seguinte
});
```

- [ ] Passo 3: escrever `tests/catalogo.test.mjs` (usa produtos copiados do `dados/produtos.json` do site):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prazoDias, siteParaProduto, catalogoDoSite } from '../js/catalogo.js';

test('prazo do texto do site', () => {
  assert.equal(prazoDias('3 a 5 dias úteis'), 5);
  assert.equal(prazoDias('7 dias úteis'), 7);
  assert.equal(prazoDias(''), 3);
});
test('cartão vira produto por opção', () => {
  const p = siteParaProduto({ id: 'p1', nome: 'Couché 250g — Couché Brilho (Frente)', prazo: '3 a 5 dias úteis',
    unidade: '', opcoes: [{ label: '100 un.', preco: 76.5 }, { label: '500 un.', preco: 85 }] }, 'cartoes');
  assert.equal(p.id, 'site:cartoes:p1');
  assert.equal(p.origem, 'site');
  assert.equal(p.tipo, 'opcoes');
  assert.equal(p.opcoes.length, 2);
  assert.equal(p.prazo_dias, 5);
});
test('adesivo vira m² com mínimo no total', () => {
  const p = siteParaProduto({ id: 'p11', nome: 'Adesivo com Recorte', prazo: '', unidade: 'por m²', opcoes: [], m2: 100, minimo: 85 }, 'adesivos');
  assert.deepEqual([p.tipo, p.preco, p.minimo, p.minimo_por], ['m2', 100, 85, 'total']);
});
test('banner tem tamanhos prontos e outro tamanho com mínimo por peça', () => {
  const p = siteParaProduto({ id: 'p1', nome: 'Banner', prazo: '', unidade: '',
    opcoes: [{ label: '60×40cm', preco: 55 }], m2livre: 120, minimo: 55 }, 'banners');
  assert.deepEqual([p.tipo, p.m2_livre, p.minimo, p.minimo_por], ['opcoes', 120, 55, 'peca']);
});
test('caneca ganha caixinha como acabamento', () => {
  const p = siteParaProduto({ id: 'p1', nome: 'Caneca', prazo: '', unidade: 'cada', opcoes: [{ label: 'cada', preco: 35 }], caixinha: 5 }, 'canecas');
  assert.deepEqual(p.acabamentos, [{ nome: 'Caixinha personalizada', valor: 5, cobranca: 'unidade' }]);
});
test('catálogo inteiro', () => {
  const lista = catalogoDoSite({ cartoes: [{ id: 'p1', nome: 'A', prazo: '', unidade: '', opcoes: [{ label: 'cada', preco: 1 }] }],
    adesivos: [{ id: 'p2', nome: 'B', prazo: '', unidade: 'por m²', opcoes: [], m2: 10, minimo: 5 }] });
  assert.deepEqual(lista.map(p => [p.categoria, p.nome]), [['cartoes', 'A'], ['adesivos', 'B']]);
});
```

- [ ] Passo 4: `npm test` → falha (arquivos `calc.js` e `catalogo.js` não existem).
- [ ] Passo 5: escrever `js/calc.js`:

```js
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
  return { area, precoAplicado, centavos: emCentavos(base + extra) };
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
```

- [ ] Passo 6: escrever `js/catalogo.js`:

```js
export const URL_CATALOGO = 'https://johendesigner.github.io/Johen-site/novo/dados/produtos.json';
export const NOMES_CATEGORIA = { cartoes: 'Cartões de Visita', panfletos: 'Panfletos', banners: 'Banners e Placas',
  adesivos: 'Adesivos e Etiquetas', camisetas: 'Camisetas', canecas: 'Canecas e Térmicos', extras: 'Extras do hub' };
const CACHE = 'hub_catalogo';

export function prazoDias(texto) {
  const nums = String(texto || '').match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : 3;
}

export function siteParaProduto(p, categoria) {
  const base = { id: `site:${categoria}:${p.id}`, origem: 'site', categoria, nome: p.nome,
    prazo_dias: prazoDias(p.prazo), acabamentos: [], opcoes: [], preco: 0, minimo: 0, minimo_por: 'total', m2_livre: 0, ativo: true };
  if (p.caixinha) base.acabamentos.push({ nome: 'Caixinha personalizada', valor: p.caixinha, cobranca: 'unidade' });
  if (p.m2) return { ...base, tipo: 'm2', preco: p.m2, minimo: p.minimo || 0, minimo_por: 'total' };
  const opcoes = (p.opcoes || []).map(o => ({ label: o.label, preco: o.preco }));
  if (p.m2livre) return { ...base, tipo: 'opcoes', opcoes, m2_livre: p.m2livre, minimo: p.minimo || 0, minimo_por: 'peca' };
  return { ...base, tipo: 'opcoes', opcoes };
}

export function catalogoDoSite(json) {
  return Object.entries(json || {}).flatMap(([cat, lista]) => (lista || []).map(p => siteParaProduto(p, cat)));
}

// Lê o catálogo do site; sem internet usa a última cópia guardada.
export async function carregarCatalogo({ forcar = false } = {}) {
  try {
    const r = await fetch(URL_CATALOGO + (forcar ? `?t=${Date.now()}` : ''), { cache: forcar ? 'no-store' : 'default' });
    if (!r.ok) throw new Error(r.status);
    const lista = catalogoDoSite(await r.json());
    try { localStorage.setItem(CACHE, JSON.stringify({ quando: new Date().toISOString(), lista })); } catch {}
    return { lista, quando: new Date().toISOString(), offline: false };
  } catch {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE));
      if (c) return { ...c, offline: true };
    } catch {}
    return { lista: [], quando: null, offline: true };
  }
}
```

- [ ] Passo 7: `npm test` → todos passam.
- [ ] Passo 8: verificação com o site real, no console do navegador com o app aberto (Tarefa 4 em diante): `(await import('./js/catalogo.js')).carregarCatalogo()` → `offline: false` e `lista` com 76 produtos (27 por m², 3 com outro tamanho), conferido em 01/11/2026.
- [ ] Passo 9: commit "Cálculos iguais ao site e leitura do catálogo, com testes".

### Tarefa 3: Formatação com testes

**Arquivos:** criar `js/formato.js`, `tests/formato.test.mjs`
**Usa de tarefas anteriores:** nada
**Entrega pras próximas:** `moeda`, `lerNumero`, `data`, `soDigitos`, `telefoneWa`

- [ ] Passo 1: `tests/formato.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moeda, lerNumero, data, soDigitos, telefoneWa } from '../js/formato.js';

test('moeda', () => {
  assert.equal(moeda(123456), 'R$ 1.234,56');
  assert.equal(moeda(0), 'R$ 0,00');
});
test('lerNumero', () => {
  assert.equal(lerNumero('1.234,5'), 1234.5);
  assert.equal(lerNumero('45'), 45);
  assert.equal(lerNumero('0,6'), 0.6);
  assert.ok(Number.isNaN(lerNumero('')));
});
test('data', () => assert.equal(data('2026-11-01'), '01/11/2026'));
test('telefone', () => {
  assert.equal(soDigitos('(11) 98287-7142'), '11982877142');
  assert.equal(telefoneWa('(11) 98287-7142'), '5511982877142');
  assert.equal(telefoneWa('+55 11 98287-7142'), '5511982877142');
});
```

- [ ] Passo 2: `npm test` → falha.
- [ ] Passo 3: `js/formato.js`:

```js
export function moeda(centavos) {
  const v = (Number(centavos) || 0) / 100;
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function lerNumero(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return NaN;
  const limpo = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(limpo);
}
export function data(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
export function soDigitos(texto) { return String(texto ?? '').replace(/\D/g, ''); }
export function telefoneWa(texto) {
  const d = soDigitos(texto);
  return d.startsWith('55') && d.length >= 12 ? d : '55' + d;
}
```

- [ ] Passo 4: `npm test` → passa.
- [ ] Passo 5: commit "Formatação de moeda, número, data e telefone".

### Tarefa 4: Casca do app, visual e navegação

**Arquivos:** criar `index.html`, `css/app.css`, `js/rotas.js`, `js/ui.js`, `js/app.js`
**Usa de tarefas anteriores:** nada
**Entrega pras próximas:** `registrar`, `ir`, `iniciar`, `avisar`, `confirmar`, `abrirModal`, `fecharModal`, `atualizarPendentes`; elementos `#tela`, `#nav`, `#login`, `#pendentes`

- [ ] Passo 1: checklist de verificação (vira `tests/visual.mjs` na Tarefa 13):
  - em 380 px a navegação fica embaixo com 5 itens (Início, Orçamento, Pedidos, Clientes, Mais) e cada um tem pelo menos 44 px de altura;
  - em 1280 px a navegação vira lateral à esquerda com 220 px;
  - `#tela` muda conforme o `#hash` (`#inicio`, `#orcamento`, `#pedidos`, `#clientes`, `#mais`, `#receber`, `#produtos`, `#configuracoes`, `#pedido/<id>`, `#cliente/<id>`);
  - o item ativo da navegação fica destacado;
  - `avisar('Salvo', 'ok')` aparece embaixo por 3 s; `confirmar` abre um modal com Cancelar e Confirmar.
- [ ] Passo 2: abrir `index.html` antes do código → tela em branco (falha esperada).
- [ ] Passo 3: código.
  - `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<link rel="manifest">`, `<header>` com logo e título da tela, `<main id="tela">`, `<nav id="nav">` com 5 links `<a href="#inicio" data-rota="inicio">` (ícone SVG + texto), `<div id="pendentes" hidden>`, `<section id="login" hidden>` com e-mail, senha e botão Entrar, `<div id="toast">`, `<div id="modal" hidden>`, `<script type="module" src="js/app.js">`. Supabase, jsPDF e SheetJS carregados de `cdn.jsdelivr.net` com `defer`.
  - `css/app.css`: tokens em `:root` (`--cor-marca`, `--cor-marca-2`, `--fundo`, `--texto`, `--texto-2`, `--borda`, `--ok`, `--alerta`, `--erro`, `--raio: 12px`), tirados do arquivo de marca da Johen; modo escuro com `@media (prefers-color-scheme: dark)`; `body` com `padding-bottom: calc(64px + env(safe-area-inset-bottom))` no celular; `#nav` fixo embaixo, grid de 5 colunas; `@media (min-width: 900px)` → `#nav` fixo à esquerda, 220 px, em coluna, e `main` com `margin-left: 220px`; botões `.btn` com `min-height: 44px`; classes `.cartao`, `.lista`, `.campo`, `.etiqueta-etapa` (uma cor por etapa), `.valor`, `.vazio`.
  - `js/rotas.js`:

```js
const rotas = {};
export function registrar(nome, def) { rotas[nome] = def; }
export function ir(nome, params) { location.hash = params ? `${nome}/${params}` : nome; }
async function render() {
  const [nome, param] = (location.hash.slice(1) || 'inicio').split('/');
  const r = rotas[nome] || rotas.inicio;
  document.querySelectorAll('#nav a').forEach(a =>
    a.classList.toggle('ativo', a.dataset.rota === nome || (nome === 'pedido' && a.dataset.rota === 'pedidos')
      || (nome === 'cliente' && a.dataset.rota === 'clientes')
      || (['receber','produtos','configuracoes'].includes(nome) && a.dataset.rota === 'mais')));
  const el = document.getElementById('tela');
  el.innerHTML = '<p class="vazio">Carregando…</p>';
  try { await r.montar(el, param); } catch (e) { el.innerHTML = `<p class="vazio">Erro ao abrir: ${e.message}</p>`; }
  window.scrollTo(0, 0);
}
export function iniciar() { addEventListener('hashchange', render); render(); }
```

  - `js/ui.js`: `avisar` coloca o texto em `#toast` com a classe do tipo e some em 3000 ms; `confirmar` usa `abrirModal` com dois botões e devolve uma Promise resolvida com `true`/`false`; `abrirModal(html)` mostra `#modal`, fecha ao tocar fora; `fecharModal` esconde; `atualizarPendentes(n)` mostra `#pendentes` com "n alteração(ões) pendente(s) de envio" em amarelo quando `n > 0`.
  - `js/app.js` nesta tarefa: registra rotas de teste que escrevem o nome da tela e chama `iniciar()`.
- [ ] Passo 4: abrir com `npx serve .` no celular simulado (380 px) e no PC (1280 px); conferir o checklist do Passo 1.
- [ ] Passo 5: commit "Casca do app, visual e navegação".

### Tarefa 5: Acesso a dados, login e fila offline

**Arquivos:** criar `js/db.js` · alterar `js/app.js`
**Usa de tarefas anteriores:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `avisar`, `atualizarPendentes`, `iniciar`
**Entrega pras próximas:** todo o contrato de `js/db.js`

- [ ] Passo 1: checklist de verificação:
  - sem login aparece só `#login`; senha errada → aviso "E-mail ou senha incorretos";
  - logado, recarregar a página continua logado;
  - `salvar('clientes', {nome:'Teste'})` grava e devolve o registro com `id`;
  - com a rede desligada (DevTools offline), `salvar` guarda na fila, devolve o registro com `id` gerado no aparelho e `pendentes()` = 1; ao religar, `enviarPendentes()` sobe e `pendentes()` = 0;
  - editar a mesma ficha em duas abas: a segunda a salvar recebe `ConflitoError`.
- [ ] Passo 2: rodar o checklist antes do código → falha.
- [ ] Passo 3: código de `js/db.js`:

```js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
export const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } });

const FILA = 'hub_fila', CACHE = 'hub_cache_';
const lerFila = () => { try { return JSON.parse(localStorage.getItem(FILA)) || []; } catch { return []; } };
const gravarFila = f => { try { localStorage.setItem(FILA, JSON.stringify(f)); } catch {} };
const guardar = (k, v) => { try { localStorage.setItem(CACHE + k, JSON.stringify(v)); } catch {} };
const ler = k => { try { return JSON.parse(localStorage.getItem(CACHE + k)); } catch { return null; } };

export class ConflitoError extends Error {
  constructor(local, remoto) { super('Esta ficha foi alterada em outro aparelho'); this.local = local; this.remoto = remoto; }
}

export async function entrar(email, senha) {
  const { error } = await db.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error('E-mail ou senha incorretos');
}
export async function sair() { await db.auth.signOut(); localStorage.clear(); }
export async function usuarioAtual() { return (await db.auth.getUser()).data.user; }

export async function listar(tabela, f = {}) {
  const chave = tabela + JSON.stringify(f);
  try {
    let q = db.from(tabela).select('*');
    for (const [c, v] of Object.entries(f.eq || {})) q = q.eq(c, v);
    for (const [c, v] of Object.entries(f.ilike || {})) q = q.ilike(c, `%${v}%`);
    if (f.semExcluidos) q = q.is('excluido_em', null);
    if (f.soExcluidos) q = q.not('excluido_em', 'is', null);
    if (f.order) q = q.order(f.order, { ascending: !f.desc });
    const { data, error } = await q;
    if (error) throw error;
    guardar(chave, data);
    return data;
  } catch (e) {
    const c = ler(chave);
    if (c) return c;
    throw new Error('Sem internet e sem dados guardados para esta tela');
  }
}

export async function obter(tabela, id) {
  const { data, error } = await db.from(tabela).select('*').eq(tabela === 'configuracoes' ? 'user_id' : 'id', id).maybeSingle();
  if (error) { const c = ler(tabela + id); if (c) return c; throw new Error('Não foi possível abrir'); }
  guardar(tabela + id, data);
  return data;
}

async function enviar(tabela, reg) {
  if (reg.atualizado_em && tabela !== 'configuracoes') {
    const { data: atual } = await db.from(tabela).select('*').eq('id', reg.id).maybeSingle();
    if (atual && atual.atualizado_em !== reg.atualizado_em) throw new ConflitoError(reg, atual);
  }
  const { atualizado_em, numero, ...limpo } = reg;
  const chave = tabela === 'configuracoes' ? 'user_id' : 'id';
  const { data, error } = await db.from(tabela).upsert(limpo, { onConflict: chave }).select().single();
  if (error) throw error;
  return data;
}

export async function salvar(tabela, registro) {
  const reg = { ...registro };
  if (tabela !== 'configuracoes' && !reg.id) reg.id = crypto.randomUUID();
  try {
    return await enviar(tabela, reg);
  } catch (e) {
    if (e instanceof ConflitoError) throw e;
    if (!navigator.onLine || e.message?.includes('fetch')) {
      const f = lerFila(); f.push({ tabela, reg }); gravarFila(f);
      notificar();
      return reg;
    }
    throw new Error(traduzir(e.message));
  }
}

export async function excluir(tabela, id) {
  if (tabela === 'fichas') return salvar('fichas', { id, excluido_em: new Date().toISOString() });
  const { error } = await db.from(tabela).delete().eq('id', id);
  if (error) throw new Error(traduzir(error.message));
}
export async function restaurar(id) { return salvar('fichas', { id, excluido_em: null }); }

export function pendentes() { return lerFila().length; }
let ouvinte = () => {};
export function aoMudarPendentes(fn) { ouvinte = fn; }
function notificar() { ouvinte(pendentes()); }

export async function enviarPendentes() {
  let f = lerFila();
  while (f.length) {
    const { tabela, reg } = f[0];
    try { await enviar(tabela, { ...reg, atualizado_em: undefined }); }
    catch (e) { if (!navigator.onLine) break; console.error(e); }
    f.shift(); gravarFila(f); notificar();
  }
}

function traduzir(msg = '') {
  if (msg.includes('Pagamento maior')) return 'Pagamento maior que o valor em aberto';
  if (msg.includes('violates foreign key')) return 'Este cliente tem pedidos e não pode ser excluído. Arquive em vez disso.';
  if (msg.includes('JWT')) return 'Sessão expirada. Entre de novo.';
  return 'Não salvou. Toque para tentar de novo.';
}
```

  Observação: `aoMudarPendentes` entra no contrato (usado em `js/app.js`).
  - `js/app.js`: ao abrir, `usuarioAtual()`; sem usuário mostra `#login` e esconde `#nav`/`#tela`; o formulário chama `entrar` e recarrega; com usuário chama `db.rpc('limpa_lixeira')` (ignora erro), `aoMudarPendentes(atualizarPendentes)`, `atualizarPendentes(pendentes())`, `addEventListener('online', enviarPendentes)`, `enviarPendentes()`, depois `iniciar()`.
- [ ] Passo 4: rodar o checklist do Passo 1 com o usuário real do Johen → passa.
- [ ] Passo 5: commit "Login, acesso a dados e fila offline".

### Tarefa 6: Produtos (do site + extras do hub)

**Arquivos:** criar `js/telas/produtos.js` · alterar `js/app.js` (registrar a rota)
**Usa de tarefas anteriores:** `carregarCatalogo`, `NOMES_CATEGORIA`, `listar`, `salvar`, `excluir`, `registrar`, `ir`, `avisar`, `confirmar`, `abrirModal`, `fecharModal`, `moeda`, `lerNumero`, `TIPOS`
**Entrega pras próximas:** `todosProdutos()` exportada de `js/telas/produtos.js` → `{ lista, quando, offline }` com os produtos do site + extras ativos do hub (extras com `categoria: 'extras'`, `origem: 'hub'`), ordenados por categoria e nome

- [ ] Passo 1: checklist:
  - `#produtos` mostra no topo "Preços do site — atualizado às hh:mm" e botão "Atualizar do site" (`carregarCatalogo({ forcar: true })`); offline mostra "Sem internet: usando a cópia de dd/mm hh:mm" em amarelo;
  - lista agrupada por categoria (Cartões, Panfletos, Banners e Placas, Adesivos, Camisetas, Canecas e Térmicos, Extras do hub), com busca por nome;
  - produto do site: nome, "a partir de R$ X" (menor opção ou preço do m² com "o m²"), selo "do site"; tocar abre os detalhes em modo leitura (opções e preços, mínimo, outro tamanho, acabamentos, prazo) com o aviso "Para mudar este preço, mude no site";
  - "Novo produto extra": nome, tipo (Opções, Por m², Por unidade), opções (linhas nome + preço, botão "+ opção") só em Opções, preço só em m²/unidade, valor mínimo em R$ e se vale "no total" ou "por peça", acabamentos (nome / valor / cobrança unidade·m²·fixo), prazo em dias úteis, ativo;
  - salvar extra com nome vazio → "Informe o nome"; Opções sem nenhuma opção com preço > 0 → "Cadastre ao menos uma opção"; preço ≤ 0 em m²/unidade → "Preço precisa ser maior que zero"; acabamento por m² em produto que não é m² → "Acabamento por m² só em produto por m²";
  - extras podem ser editados, desativados e excluídos (com confirmação); fichas antigas não mudam porque o item guarda cópia dos dados.
- [ ] Passo 2: abrir `#produtos` → tela vazia (falha).
- [ ] Passo 3: código da tela seguindo o checklist. A tabela `produtos` do Supabase guarda só os extras; `todosProdutos()` junta `carregarCatalogo()` com `listar('produtos', { eq: { ativo: true } })` convertidos para a mesma forma (`id`, `origem: 'hub'`, `categoria: 'extras'`).
- [ ] Passo 4: conferir 5 produtos do site contra a página de cada um no site novo (Cartão Couché 250g Frente, Panfleto 10x14 90g Frente, Banner Lona 480g Brilho, Adesivo com Recorte Vinil Branco Brilho, Caneca de Alça Branca) → mesmos preços; cadastrar o extra "Envelopamento de frota" (por m², R$ 90, mínimo R$ 150 no total) → aparece em Extras do hub.
- [ ] Passo 5: commit "Produtos do site e extras do hub".

### Tarefa 7: Clientes

**Arquivos:** criar `js/telas/clientes.js` · alterar `js/app.js`
**Usa de tarefas anteriores:** `listar`, `obter`, `salvar`, `excluir`, `registrar`, `ir`, `avisar`, `confirmar`, `moeda`, `data`, `soDigitos`, `NOMES_ETAPA`
**Entrega pras próximas:** `formClienteRapido(aoSalvar)` exportada de `js/telas/clientes.js` (modal com nome e WhatsApp, chama `aoSalvar(cliente)`)

- [ ] Passo 1: checklist:
  - `#clientes`: busca por nome ou WhatsApp (filtra ao digitar), lista em ordem alfabética sem arquivados; chave "mostrar arquivados";
  - "Novo cliente": nome (obrigatório), WhatsApp, CPF/CNPJ, endereço, observações;
  - `#cliente/<id>`: dados, botão WhatsApp (abre conversa), Editar, Arquivar/Desarquivar, Excluir;
  - histórico: fichas do cliente (número, etapa, total, data) mais recentes primeiro, tocando abre `#pedido/<id>`;
  - Excluir cliente com fichas → aviso "Este cliente tem pedidos e não pode ser excluído. Arquive em vez disso.";
  - `formClienteRapido` abre modal pequeno e devolve o cliente salvo.
- [ ] Passo 2: abrir `#clientes` → vazio (falha).
- [ ] Passo 3: código.
- [ ] Passo 4: cadastrar 2 clientes, buscar "11 98", arquivar um, conferir histórico vazio → passa.
- [ ] Passo 5: commit "Cadastro de clientes".

### Tarefa 8: Orçamento rápido

**Arquivos:** criar `js/telas/orcamento.js`, `js/whatsapp.js` · alterar `js/app.js`
**Usa de tarefas anteriores:** `calcularItem`, `calcularFicha`, `validarItem`, `somarDiasUteis`, `todosProdutos`, `listar`, `obter`, `salvar`, `formClienteRapido`, `moeda`, `lerNumero`, `telefoneWa`, `avisar`, `ir`
**Entrega pras próximas:** `mensagem`, `linkWa`; fichas gravadas com `itens`, `desconto`, `total_centavos`, `prazo`

- [ ] Passo 1: checklist:
  - `#orcamento` abre ficha nova; `#orcamento/<id>` edita ficha que está na etapa Orçamento;
  - campo cliente com busca (digita 2 letras → sugestões) e botão "+ novo" (`formClienteRapido`);
  - "Adicionar item": busca por nome entre `todosProdutos()` (site + extras), com filtro por categoria; aparecem só os campos do tipo: Opções → lista de opções com preço (e, se o produto tem `m2_livre`, o botão "Outro tamanho" que troca para largura × altura); Por m² → largura × altura em cm; quantidade sempre; acabamentos do produto como caixas de marcar (ex.: caixinha da caneca); descrição livre; o valor do item atualiza a cada tecla e mostra o aviso "valor mínimo aplicado" quando o mínimo entrar;
  - o item copia `nome`, `tipo`, `opcao`, `livre`, `preco`, `m2_livre`, `minimo`, `minimo_por` e os acabamentos marcados (preço congelado: mudar o site depois não altera a ficha);
  - lista de itens com valor, tocar edita, botão remover;
  - desconto em R$ ou %; resumo com subtotal, desconto e total (`calcularFicha`);
  - prazo: data sugerida = `somarDiasUteis(hoje, maior prazo_dias dos itens)`, editável;
  - Salvar sem cliente → "Escolha o cliente"; sem itens → "Adicione ao menos um item"; item inválido → mensagem de `validarItem`;
  - botões depois de salvo: "Enviar no WhatsApp" (abre `linkWa` com `mensagem('orcamento', …)`), "Gerar PDF" (liga na Tarefa 11), "Virar pedido" (pergunta se houve sinal: sim → abre registro de pagamento da Tarefa 10 e muda a etapa para `sinal`; não → muda para `arte`).
- [ ] Passo 2: `tests/calc.test.mjs` já cobre os valores; abrir `#orcamento` → vazio (falha).
- [ ] Passo 3: `js/whatsapp.js`:

```js
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
```

  Teste novo em `tests/whatsapp.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensagem, linkWa } from '../js/whatsapp.js';
test('mensagem de orçamento', () => {
  const t = mensagem('orcamento', { ficha: { numero: 12, criado_em: '2026-11-01T12:00:00Z', prazo: '2026-11-05',
    total_centavos: 5400, itens: [{ tipo: 'm2', quantidade: 2, largura_cm: 100, altura_cm: 60, preco: 45, nome: 'Banner', acabamentos: [] }] },
    cliente: { nome: 'Ana Souza' }, cfg: { pix: '65.480.613/0001-19', validade_dias: 7 } });
  assert.match(t, /Olá, Ana!/);
  assert.match(t, /2× Banner 100×60 cm: R\$\s54,00/);
  assert.match(t, /Válido até: 08\/11\/2026/);
});
test('link', () => assert.equal(linkWa('(11) 98287-7142', 'oi'), 'https://wa.me/5511982877142?text=oi'));
```

  Depois, código de `js/telas/orcamento.js` seguindo o checklist; ao salvar grava `total_centavos = calcularFicha(itens, desconto).total`.
- [ ] Passo 4: `npm test` passa; fazer o orçamento de 2 banners Lona 480g Brilho em outro tamanho 100 × 60 cm → R$ 144,00 (0,6 m² × R$ 120 = R$ 72 por peça × 2), mais 1 pacote de 100 cartões Couché 250g Frente → R$ 76,50; total R$ 220,50, igual ao site; WhatsApp abre com o texto certo.
- [ ] Passo 5: commit "Orçamento rápido e mensagens de WhatsApp".

### Tarefa 9: Pedidos (lista e detalhe)

**Arquivos:** criar `js/telas/pedidos.js` · alterar `js/app.js`
**Usa de tarefas anteriores:** `ETAPAS`, `NOMES_ETAPA`, `saldoAberto`, `orcamentoVencido`, `listar`, `obter`, `salvar`, `excluir`, `restaurar`, `ConflitoError`, `mensagem`, `linkWa`, `moeda`, `data`, `confirmar`, `abrirModal`, `avisar`
**Entrega pras próximas:** `abrirFicha(id)` (vai para `#pedido/<id>`)

- [ ] Passo 1: checklist:
  - `#pedidos`: abas roláveis com cada etapa e a contagem (`Arte (3)`), mais "Todos", "Cancelados" e "Lixeira"; busca por número, cliente ou nº da OS FpqSystem;
  - cada cartão: nº, cliente, total, falta receber, prazo (vermelho se passou), selo "vencido" para orçamento vencido (`orcamentoVencido`);
  - `#pedido/<id>`: cliente (toque abre o cliente), etapa atual com os 7 passos em linha e o atual destacado, botões "◀ voltar etapa" e "Avançar para <próxima> ▶", "Cancelar pedido";
  - itens (somente leitura se a etapa não for Orçamento; em Orçamento, botão "Editar orçamento" → `#orcamento/<id>`);
  - pagamentos da ficha com total pago e falta receber, botão "Registrar pagamento" (Tarefa 10);
  - campos editáveis: prazo, nº OS FpqSystem, link da arte (abre em nova aba), observações; botão Salvar;
  - botões WhatsApp conforme a etapa: Orçamento → "Enviar orçamento"; Arte/Aprovação → "Pedir aprovação da arte"; Pronto → "Avisar que está pronto"; qualquer etapa com saldo > 0 → "Cobrar";
  - Excluir → confirmação → vai para a Lixeira; na Lixeira, "Restaurar";
  - `ConflitoError` ao salvar → modal mostrando "No outro aparelho" × "Neste aparelho" (etapa, prazo, observações, total) com botões "Manter a do outro aparelho" (recarrega) e "Manter a minha" (salva de novo com `atualizado_em` do remoto).
- [ ] Passo 2: abrir `#pedidos` → vazio (falha).
- [ ] Passo 3: código.
- [ ] Passo 4: com o orçamento da Tarefa 8: virar pedido, avançar até Entregue, voltar uma etapa, cancelar, excluir e restaurar; abrir em duas abas e forçar conflito → modal aparece.
- [ ] Passo 5: commit "Pedidos por etapa e detalhe".

### Tarefa 10: Pagamentos e A receber

**Arquivos:** criar `js/telas/receber.js` · alterar `js/telas/pedidos.js` (botão Registrar pagamento) e `js/telas/orcamento.js` (Virar pedido com sinal) e `js/app.js`
**Usa de tarefas anteriores:** `saldoAberto`, `validarPagamento`, `emCentavos`, `listar`, `salvar`, `excluir`, `moeda`, `lerNumero`, `mensagem`, `linkWa`, `abrirModal`, `avisar`, `confirmar`
**Entrega pras próximas:** `registrarPagamento(ficha, { sugerirSinal })` exportada de `js/telas/receber.js`

- [ ] Passo 1: checklist:
  - modal de pagamento: valor (sugere o saldo inteiro), forma (Pix, débito, crédito, dinheiro), data (hoje), tipo (sinal ou pagamento); valor acima do saldo → mensagem de `validarPagamento`;
  - pagamento em ficha na etapa Orçamento → pergunta "Mudar para Sinal pago?";
  - pagamento lançado errado pode ser excluído (com confirmação) no detalhe da ficha;
  - `#receber`: total a receber no topo; lista de fichas não canceladas, não excluídas, com saldo > 0, prazo mais antigo primeiro; cada linha com cliente, nº, saldo, prazo, botões "Registrar pagamento" e "Cobrar no WhatsApp";
  - quando o saldo zera, a ficha some da lista e mostra "Quitado" no detalhe.
- [ ] Passo 2: abrir `#receber` → vazio (falha).
- [ ] Passo 3: código.
- [ ] Passo 4: ficha de R$ 220,50 → sinal Pix R$ 100,00 → aparece em A receber com R$ 120,50 → tentar R$ 130,00 (bloqueia) → pagar R$ 120,50 → some da lista.
- [ ] Passo 5: commit "Pagamentos e A receber".

### Tarefa 11: PDF do orçamento

**Arquivos:** criar `js/pdf.js` · alterar `js/telas/orcamento.js` e `js/telas/pedidos.js` (botão Gerar PDF)
**Usa de tarefas anteriores:** `calcularItem`, `calcularFicha`, `moeda`, `data`, `obter('configuracoes', …)`
**Entrega pras próximas:** `pdfOrcamento`

- [ ] Passo 1: checklist do PDF (A4, retrato):
  - topo: logo (de `cfg.logo`, imagem em base64) e dados da gráfica (nome, CNPJ, endereço, WhatsApp, Instagram);
  - "Orçamento nº X" e data; dados do cliente (nome, WhatsApp, CPF/CNPJ se houver);
  - tabela: qtd, descrição (nome + medida + acabamentos + descrição livre), valor; quebra de página automática;
  - subtotal, desconto (se houver), total em destaque;
  - prazo, validade, formas de pagamento (dinheiro, Pix, débito, crédito) e chave Pix;
  - arquivo baixado como `orcamento-<numero>-<cliente>.pdf`, abre no celular e no PC.
- [ ] Passo 2: botão sem código → nada acontece (falha).
- [ ] Passo 3: código com `window.jspdf.jsPDF`, fonte Helvetica, margens 15 mm, cor da marca no título e na linha do total.
- [ ] Passo 4: gerar o PDF do orçamento da Tarefa 8, conferir o checklist e valores iguais aos da tela.
- [ ] Passo 5: commit "PDF do orçamento".

### Tarefa 12: Início, Configurações e exportação

**Arquivos:** criar `js/telas/inicio.js`, `js/telas/configuracoes.js`, `js/exportar.js` · alterar `js/app.js` (rotas `inicio`, `mais`, `configuracoes`)
**Usa de tarefas anteriores:** `listar`, `obter`, `salvar`, `sair`, `saldoAberto`, `NOMES_ETAPA`, `ETAPAS`, `PADRAO`, `moeda`, `data`, `ir`, `avisar`
**Entrega pras próximas:** `exportarPlanilha`; configuração gravada em `configuracoes.dados` com `nome`, `cnpj`, `endereco`, `whatsapp`, `instagram`, `horario`, `pix`, `logo`, `validade_dias`, `textos`

- [ ] Passo 1: checklist:
  - Início: cartão "A receber" (soma dos saldos, toque abre `#receber`); contagem por etapa (toque abre a aba da etapa); "Prazos de hoje e amanhã" (fichas não entregues/canceladas com prazo ≤ amanhã); botões grandes "Novo orçamento" e "Novo pedido" (os dois abrem `#orcamento`; "Novo pedido" já marca que vai virar pedido ao salvar);
  - Mais: atalhos para A receber, Produtos, Configurações e Lixeira;
  - Configurações já vêm preenchidas com: Johen Arte Grafica, CNPJ 65.480.613/0001-19, R. Pedro Fernandes Aragão 269, Jardim Selma, São Paulo/SP, WhatsApp 11 98287-7142, Instagram @johen_artgrafica, horário "segunda a sábado, 11h às 20h", validade 7 dias; logo enviada pelo Johen (arquivo de imagem convertido para base64, até 300 KB);
  - os 4 textos de mensagem editáveis, com botão "Voltar ao padrão" e a lista de marcadores `{cliente} {numero} {itens} {total} {prazo} {validade} {pix} {endereco} {horario} {saldo}`;
  - "Exportar planilha" baixa `hub-grafica-<aaaa-mm-dd>.xlsx` com abas Clientes, Pedidos (nº, cliente, etapa, total, pago, falta, prazo, OS FpqSystem, criado em) e Pagamentos;
  - "Sair" desloga e volta ao login.
- [ ] Passo 2: abrir `#inicio` → texto de teste da Tarefa 4 (falha).
- [ ] Passo 3: código; `exportarPlanilha` usa `XLSX.utils.json_to_sheet` e `XLSX.writeFile`.
- [ ] Passo 4: conferir os números do Início com os dados das Tarefas 8–10; abrir a planilha exportada no Excel.
- [ ] Passo 5: commit "Início, configurações e exportação".

### Tarefa 13: App instalável, offline e teste visual

**Arquivos:** criar `manifest.json`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`, `tests/visual.mjs` · alterar `js/app.js` (registrar o service worker)
**Usa de tarefas anteriores:** todas as telas
**Entrega pras próximas:** app instalável

- [ ] Passo 1: `tests/visual.mjs` (Playwright, Chrome):

```js
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3000';
const EMAIL = process.env.HUB_EMAIL, SENHA = process.env.HUB_SENHA;
const telas = ['inicio','orcamento','pedidos','clientes','mais','receber','produtos','configuracoes'];
const b = await chromium.launch();
let falhas = 0;
for (const [nome, w, h] of [['celular', 380, 820], ['pc', 1280, 800]]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } });
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  pg.on('console', m => m.type() === 'error' && erros.push(m.text()));
  await pg.goto(BASE); await pg.fill('#login input[type=email]', EMAIL); await pg.fill('#login input[type=password]', SENHA);
  await pg.click('#login button'); await pg.waitForSelector('#nav');
  for (const t of telas) {
    await pg.goto(`${BASE}/#${t}`); await pg.waitForTimeout(800);
    const lateral = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await pg.screenshot({ path: `tests/prints/${nome}-${t}.png`, fullPage: true });
    if (lateral) { falhas++; console.log(`FALHA rolagem lateral: ${nome} ${t}`); }
  }
  if (erros.length) { falhas++; console.log(`FALHA console ${nome}:`, erros); }
}
await b.close();
process.exit(falhas ? 1 : 0);
```

- [ ] Passo 2: rodar → falha (sem manifest e sem service worker o Lighthouse/instalação não aparece; o script já roda e mostra os prints).
- [ ] Passo 3: código.
  - `manifest.json`: `name` "Hub Johen Arte Grafica", `short_name` "Hub Johen", `start_url` "./#inicio", `display` "standalone", `background_color` e `theme_color` da marca, ícones 192 e 512.
  - `sw.js`: no `install` guarda em cache `index.html`, `css/app.css`, todos os `js/*.js` e `js/telas/*.js`, `manifest.json`, ícones e as 3 bibliotecas do CDN; no `fetch`, para arquivos do app usa "cache primeiro, rede depois"; chamadas ao Supabase passam direto (sem cache); versão do cache em `const VERSAO = 'hub-v1'`, apaga caches antigos no `activate`.
  - `js/app.js`: `if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js')`.
- [ ] Passo 4: `node tests/visual.mjs` → 0 falhas; Chrome mostra "Instalar app" no PC e "Adicionar à tela inicial" no celular; em modo avião o app abre e mostra os dados guardados.
- [ ] Passo 5: commit "App instalável, offline e teste visual".

### Tarefa 14: Publicação e teste de uso real

**Arquivos:** alterar `README.md` (como usar, como fazer backup, como reativar o banco)
**Usa de tarefas anteriores:** tudo
**Entrega pras próximas:** app no ar em `https://johendesigner.github.io/hub-grafica/`

- [ ] Passo 1: checklist final = seção "Como testar" da especificação, inteira.
- [ ] Passo 2: ativar GitHub Pages (branch `main`, pasta raiz).
- [ ] Passo 3: `npm test` e `node tests/visual.mjs` contra o endereço publicado → passam.
- [ ] Passo 4: Johen faz o teste de uso real no celular e no PC (orçamento em menos de 1 minuto, pedido até Entregue, sinal e quitação, modo avião, lixeira, planilha).
- [ ] Passo 5: commit "Publicação da versão 1" e marcar a versão `v1.0`.

---

## Cobertura da especificação

| Requisito da especificação | Tarefa |
| --- | --- |
| Login só do Johen, sem cadastro aberto | 1, 5 |
| Orçamento por opção, m² com mínimo, outro tamanho, unidade, acabamentos, desconto — igual ao site | 2, 8 |
| Preços sempre do site novo, com cópia offline | 2, 6 |
| Preço congelado no item | 8 |
| WhatsApp (4 mensagens, editáveis) | 8, 9, 10, 12 |
| PDF do orçamento | 11 |
| Etapas, pular/voltar, cancelar, orçamento vencido | 9 |
| Nº da OS FpqSystem, link da arte | 1, 9 |
| Clientes com histórico, arquivar | 7 |
| Pagamentos, a receber, bloqueio de valor acima do saldo | 1, 2, 10 |
| Produtos extras do hub com opções, m², mínimo, acabamentos, prazo em dias úteis | 1, 6 |
| Início com a receber, etapas e prazos | 12 |
| Configurações e exportar planilha | 12 |
| Offline com fila e aviso amarelo | 5, 13 |
| Conflito entre aparelhos | 5, 9 |
| Lixeira de 30 dias | 1, 5, 9 |
| Banco pausado: aviso | 5 (mensagem em `listar` sem dados) e README (passo para reativar) |
| Celular primeiro, PC com navegação lateral | 4, 13 |
| Custo zero | 1, 14 |
