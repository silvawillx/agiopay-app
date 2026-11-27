-- AGIOPAY — bloqueio de escrita no BANCO para quem está sem assinatura.
--
-- Sem isto, o bloqueio existe só na tela e qualquer pessoa técnica conseguiria
-- criar e alterar dados mesmo com o teste vencido. Com isto, o banco recusa
-- INSERT e UPDATE nas 4 tabelas de dados quando tem_acesso() é falso
-- (conta liberada, assinatura ativa ou teste grátis ainda dentro do prazo).
--
-- O que NÃO muda: quem está bloqueado continua LENDO e BAIXANDO os próprios dados
-- (select) e pode apagar (delete). O servidor (webhook) usa a chave de serviço e
-- ignora o RLS, então liberar/bloquear contas continua funcionando.
--
-- Pré-requisito: supabase_migration_assinaturas.sql (tabela assinaturas e tem_acesso()).
-- Rode DEPOIS de testar o pagamento no sandbox do Asaas.

-- clientes
alter policy "clientes insert" on public.clientes
  with check ((select auth.uid()) = user_id and (select public.tem_acesso()));
alter policy "clientes update" on public.clientes
  using ((select auth.uid()) = user_id and (select public.tem_acesso()));

-- emprestimos
alter policy "emprestimos insert" on public.emprestimos
  with check ((select auth.uid()) = user_id and (select public.tem_acesso()));
alter policy "emprestimos update" on public.emprestimos
  using ((select auth.uid()) = user_id and (select public.tem_acesso()));

-- parcelas
alter policy "parcelas insert" on public.parcelas
  with check (
    (select auth.uid()) = user_id
    and (select public.tem_acesso())
    and exists (select 1 from public.emprestimos e where e.id = parcelas.emprestimo_id and e.user_id = (select auth.uid()))
  );
alter policy "parcelas update" on public.parcelas
  using ((select auth.uid()) = user_id and (select public.tem_acesso()))
  with check ((select auth.uid()) = user_id and (select public.tem_acesso()));

-- pagamentos (inclui dar baixa e estornar)
alter policy "pagamentos insert" on public.pagamentos
  with check ((select auth.uid()) = user_id and (select public.tem_acesso()));
alter policy "pagamentos update" on public.pagamentos
  using ((select auth.uid()) = user_id and (select public.tem_acesso()))
  with check ((select auth.uid()) = user_id and (select public.tem_acesso()));
