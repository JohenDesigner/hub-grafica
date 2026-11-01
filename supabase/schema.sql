create extension if not exists pgcrypto;

create or replace function toca_atualizado() returns trigger language plpgsql set search_path = public as $$
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

create or replace function marca_etapa() returns trigger language plpgsql set search_path = public as $$
begin if new.etapa is distinct from old.etapa then new.etapa_em = now(); end if; return new; end $$;
create trigger t_fic_etapa before update on fichas for each row execute function marca_etapa();

-- pagamento não pode passar do total da ficha
create or replace function checa_pagamento() returns trigger language plpgsql set search_path = public as $$
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
create or replace function limpa_lixeira() returns void language sql security invoker set search_path = public as $$
  delete from fichas where user_id = auth.uid() and excluido_em < now() - interval '30 days';
$$;

alter table clientes enable row level security;
alter table produtos enable row level security;
alter table fichas enable row level security;
alter table pagamentos enable row level security;
alter table configuracoes enable row level security;

create policy dono on clientes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dono on produtos for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dono on fichas for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dono on pagamentos for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dono on configuracoes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index on fichas (user_id, etapa) where excluido_em is null;
create index on pagamentos (ficha_id);
create index on pagamentos (user_id);
create index on fichas (cliente_id);
create index on clientes (user_id);
create index on produtos (user_id);

-- visitante sem login não acessa nada (além do RLS)
revoke all on clientes, produtos, fichas, pagamentos, configuracoes from anon;
revoke execute on function limpa_lixeira() from anon, public;
grant execute on function limpa_lixeira() to authenticated;
