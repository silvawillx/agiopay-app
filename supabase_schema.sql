-- AGIOPAY — schema Supabase (Postgres) com Row Level Security
-- Versão 2: cada cliente pode ter VÁRIOS empréstimos ao longo do tempo (dossiê).
--
-- Se você já rodou a versão 1 deste schema antes (tabelas clientes/pagamentos
-- antigas, com o empréstimo dentro da própria tabela clientes), rode primeiro:
--
--   drop table if exists pagamentos cascade;
--   drop table if exists clientes cascade;
--
-- e depois cole e rode tudo abaixo. Isso apaga dados de teste antigos —
-- normal nessa fase, não faça isso depois que tiver dados reais sem backup.

create table clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  telefone text,
  observacoes text,
  created_at timestamptz not null default now()
);

create table emprestimos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  taxa_juros numeric(6,2) not null check (taxa_juros >= 0),
  prazo_dias int not null default 30 check (prazo_dias > 0),
  data_emprestimo date not null,
  garantia text,
  created_at timestamptz not null default now()
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emprestimo_id uuid not null references emprestimos(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  data date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---- Row Level Security: cada usuário só acessa o que é dele ----
alter table clientes enable row level security;
alter table emprestimos enable row level security;
alter table pagamentos enable row level security;

create policy "clientes select" on clientes for select using (auth.uid() = user_id);
create policy "clientes insert" on clientes for insert with check (auth.uid() = user_id);
create policy "clientes update" on clientes for update using (auth.uid() = user_id);
create policy "clientes delete" on clientes for delete using (auth.uid() = user_id);

create policy "emprestimos select" on emprestimos for select using (auth.uid() = user_id);
create policy "emprestimos insert" on emprestimos for insert with check (auth.uid() = user_id);
create policy "emprestimos update" on emprestimos for update using (auth.uid() = user_id);
create policy "emprestimos delete" on emprestimos for delete using (auth.uid() = user_id);

create policy "pagamentos select" on pagamentos for select using (auth.uid() = user_id);
create policy "pagamentos insert" on pagamentos for insert with check (auth.uid() = user_id);
create policy "pagamentos delete" on pagamentos for delete using (auth.uid() = user_id);

-- índices
create index idx_emprestimos_cliente on emprestimos(cliente_id);
create index idx_emprestimos_user on emprestimos(user_id);
create index idx_pagamentos_emprestimo on pagamentos(emprestimo_id);
create index idx_pagamentos_user on pagamentos(user_id);
create index idx_clientes_user on clientes(user_id);
