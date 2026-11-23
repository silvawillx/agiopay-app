-- AGIOPAY — migração: parcelas com dias de cobrança
-- Rode isso no SQL Editor do Supabase (uma vez só). NÃO apaga nenhum dado:
-- empréstimos antigos continuam funcionando como antes (valor único com
-- juros por período); só os empréstimos novos criados como "parcelado"
-- passam a usar a tabela de parcelas.

-- 1) empréstimo ganha os dias de cobrança (0=dom, 1=seg ... 6=sáb) e se pula
--    feriados nacionais. Se dias_cobranca for null, é um empréstimo antigo
--    (pagamento único).
alter table emprestimos add column if not exists dias_cobranca smallint[];
alter table emprestimos add column if not exists pular_feriados boolean not null default true;

-- 2) parcelas de cada empréstimo
create table if not exists parcelas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emprestimo_id uuid not null references emprestimos(id) on delete cascade,
  vencimento date not null,
  valor numeric(12,2) not null check (valor > 0),
  created_at timestamptz not null default now()
);

alter table parcelas enable row level security;

drop policy if exists "parcelas select" on parcelas;
drop policy if exists "parcelas insert" on parcelas;
drop policy if exists "parcelas update" on parcelas;
drop policy if exists "parcelas delete" on parcelas;

create policy "parcelas select" on parcelas for select using (auth.uid() = user_id);
create policy "parcelas insert" on parcelas for insert with check (
  auth.uid() = user_id
  and exists (select 1 from emprestimos e where e.id = emprestimo_id and e.user_id = auth.uid())
);
create policy "parcelas update" on parcelas for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "parcelas delete" on parcelas for delete using (auth.uid() = user_id);

create index if not exists idx_parcelas_emprestimo on parcelas(emprestimo_id);
create index if not exists idx_parcelas_user_venc on parcelas(user_id, vencimento);

-- 3) cada pagamento (baixa) pode apontar pra parcela que ele pagou.
--    Cancelar a baixa = apagar o pagamento; a parcela volta a ficar em aberto.
alter table pagamentos add column if not exists parcela_id uuid references parcelas(id) on delete set null;
create index if not exists idx_pagamentos_parcela on pagamentos(parcela_id);

-- 4) correção: faltava permissão de EDITAR pagamento (o botão de editar
--    pagamento não salvava nada por causa disso)
drop policy if exists "pagamentos update" on pagamentos;
create policy "pagamentos update" on pagamentos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
