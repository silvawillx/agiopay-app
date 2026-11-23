-- AGIOPAY — schema Supabase (Postgres) com Row Level Security
-- Versão 3: inclui parcelas, estorno de pagamentos, opções de cobrança,
-- CPF e endereço opcionais do cliente. Cada cliente pode ter VÁRIOS empréstimos (dossiê).
--
-- Use este arquivo para criar um projeto novo do zero. Num banco que já tem
-- dados, NÃO rode isto: use as migrações incrementais em
-- supabase_migration_security.sql.

create table clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  telefone text,
  observacoes text,
  created_at timestamptz not null default now(),
  cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),  -- opcional, só dígitos
  endereco text                                          -- opcional
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
  dias_cobranca smallint[],            -- null = empréstimo de pagamento único; 0=dom ... 6=sáb
  pular_feriados boolean not null default true,
  juros_diario boolean not null default false,  -- true: juro soma por dia de cobrança até o total (prazo_dias = dias com juros, taxa_juros = juro total %)
  parcelas_mensais boolean not null default false,  -- true: parcelado mensal (parcelas na tabela parcelas, juro do mês + juro opcional na parcela)
  juros_parcela numeric(6,2) check (juros_parcela is null or juros_parcela >= 0),  -- % extra em cada parcela (opcional)
  created_at timestamptz not null default now()
);

create table parcelas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emprestimo_id uuid not null references emprestimos(id) on delete cascade,
  vencimento date not null,
  valor numeric(12,2) not null check (valor > 0),
  created_at timestamptz not null default now()
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emprestimo_id uuid not null references emprestimos(id) on delete cascade,
  parcela_id uuid references parcelas(id) on delete set null,
  valor numeric(12,2) not null check (valor > 0),
  data date not null default current_date,
  registrado_por uuid default auth.uid() references auth.users(id) on delete set null,
  estornado_em timestamptz,            -- baixa cancelada: fica no histórico, não conta no saldo
  estornado_por uuid references auth.users(id) on delete set null,
  estornado_motivo text,
  created_at timestamptz not null default now()
);

-- ---- Row Level Security: cada usuário só acessa o que é dele ----
-- (select auth.uid()) evita reavaliar a função a cada linha.
alter table clientes enable row level security;
alter table emprestimos enable row level security;
alter table parcelas enable row level security;
alter table pagamentos enable row level security;

create policy "clientes select" on clientes for select using ((select auth.uid()) = user_id);
create policy "clientes insert" on clientes for insert with check ((select auth.uid()) = user_id);
create policy "clientes update" on clientes for update using ((select auth.uid()) = user_id);
create policy "clientes delete" on clientes for delete using ((select auth.uid()) = user_id);

create policy "emprestimos select" on emprestimos for select using ((select auth.uid()) = user_id);
create policy "emprestimos insert" on emprestimos for insert with check ((select auth.uid()) = user_id);
create policy "emprestimos update" on emprestimos for update using ((select auth.uid()) = user_id);
create policy "emprestimos delete" on emprestimos for delete using ((select auth.uid()) = user_id);

create policy "parcelas select" on parcelas for select using ((select auth.uid()) = user_id);
create policy "parcelas insert" on parcelas for insert with check (
  ((select auth.uid()) = user_id)
  and exists (select 1 from emprestimos e where e.id = parcelas.emprestimo_id and e.user_id = (select auth.uid()))
);
create policy "parcelas update" on parcelas for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "parcelas delete" on parcelas for delete using ((select auth.uid()) = user_id);

create policy "pagamentos select" on pagamentos for select using ((select auth.uid()) = user_id);
create policy "pagamentos insert" on pagamentos for insert with check ((select auth.uid()) = user_id);
create policy "pagamentos update" on pagamentos for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- sem policy de delete em pagamentos: baixa errada é estornada, nunca apagada

-- ---- Índices ----
create index idx_clientes_user on clientes(user_id);
create index idx_emprestimos_cliente on emprestimos(cliente_id);
create index idx_emprestimos_user on emprestimos(user_id);
create index idx_parcelas_emprestimo on parcelas(emprestimo_id);
create index idx_parcelas_user_venc on parcelas(user_id, vencimento);
create index idx_pagamentos_data on pagamentos(user_id, data);
create index idx_pagamentos_emprestimo on pagamentos(emprestimo_id);
create index idx_pagamentos_estornado_por on pagamentos(estornado_por);
create index idx_pagamentos_parcela on pagamentos(parcela_id);
create index idx_pagamentos_registrado_por on pagamentos(registrado_por);
create index idx_pagamentos_user on pagamentos(user_id);
