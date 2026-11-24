-- AGIOPAY — assinatura: teste grátis e depois mensalidade.
-- Já aplicado no projeto em produção. Rode isto só num projeto novo.
--
-- O bloqueio das escritas (criar/alterar dados sem assinatura ativa) ainda NÃO
-- está ligado no banco: a função tem_acesso() existe, mas as políticas de RLS
-- das tabelas de dados ainda não a usam. Isso entra junto com o pagamento.

-- e-mails que nunca pagam (contas de teste/administração)
create table if not exists public.contas_liberadas (
  email text primary key check (email = lower(email))
);
alter table public.contas_liberadas enable row level security; -- sem policies: só o servidor lê
insert into public.contas_liberadas (email) values ('teste1@email.com'), ('elder@email.com')
on conflict do nothing;

-- uma linha por usuário: situação da assinatura
create table if not exists public.assinaturas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'teste' check (status in ('teste','ativa','atrasada','cancelada','liberada')),
  teste_ate timestamptz,
  asaas_customer_id text,
  asaas_subscription_id text,
  atualizado_em timestamptz not null default now()
);
alter table public.assinaturas enable row level security;
create policy "assinaturas select" on public.assinaturas
  for select to authenticated using ((select auth.uid()) = user_id);
-- sem insert/update/delete para o usuário: só o servidor (chave de serviço) e a função abaixo mexem

-- dias de teste grátis
create or replace function public.dias_de_teste() returns int
language sql immutable set search_path = public as $$ select 3 $$;

-- toda conta nova ganha a linha de assinatura: liberada ou em teste
create or replace function public.criar_assinatura_ao_cadastrar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.assinaturas (user_id, status, teste_ate)
  values (
    new.id,
    case when exists (select 1 from public.contas_liberadas c where c.email = lower(new.email)) then 'liberada' else 'teste' end,
    now() + make_interval(days => public.dias_de_teste())
  )
  on conflict (user_id) do nothing;
  return new;
end $$;
revoke execute on function public.criar_assinatura_ao_cadastrar() from public, anon, authenticated;

drop trigger if exists criar_assinatura_trg on auth.users;
create trigger criar_assinatura_trg after insert on auth.users
  for each row execute function public.criar_assinatura_ao_cadastrar();

-- true se a conta pode criar/alterar dados
create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assinaturas a
    where a.user_id = (select auth.uid())
      and (a.status in ('liberada','ativa') or (a.status = 'teste' and a.teste_ate > now()))
  );
$$;
revoke execute on function public.tem_acesso() from public, anon;
grant execute on function public.tem_acesso() to authenticated;

-- contas que já existem e estão na lista de liberadas
insert into public.assinaturas (user_id, status)
select u.id, 'liberada' from auth.users u
where lower(u.email) in (select email from public.contas_liberadas)
on conflict (user_id) do update set status = 'liberada', atualizado_em = now();
