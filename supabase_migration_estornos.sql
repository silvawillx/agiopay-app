-- AGIOPAY — migração: histórico de baixas canceladas (estornos)
-- Rode no SQL Editor do Supabase DEPOIS da supabase_migration_parcelas.sql.
-- Não apaga nenhum dado.
--
-- Antes: cancelar uma baixa APAGAVA o pagamento — sumia sem deixar rastro.
-- Agora: o pagamento continua no banco, marcado como estornado (quando, por
-- quem e o motivo). Ele deixa de contar no saldo, mas aparece no histórico.

alter table pagamentos add column if not exists estornado_em timestamptz;
alter table pagamentos add column if not exists estornado_por uuid references auth.users(id) on delete set null;
alter table pagamentos add column if not exists estornado_motivo text;
-- quem registrou a baixa (prepara o terreno pra ter cobradores no futuro)
alter table pagamentos add column if not exists registrado_por uuid default auth.uid() references auth.users(id) on delete set null;

-- pagamento não pode mais ser apagado pelo app/API: só estornado.
-- (apagar um empréstimo ou cliente inteiro continua apagando os pagamentos
-- dele junto, porque isso é feito pelo próprio banco em cascata)
drop policy if exists "pagamentos delete" on pagamentos;

-- garante que o update de pagamento existe (já vem na migração de parcelas)
drop policy if exists "pagamentos update" on pagamentos;
create policy "pagamentos update" on pagamentos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_pagamentos_data on pagamentos(user_id, data);
