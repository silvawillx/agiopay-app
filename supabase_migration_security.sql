-- AGIOPAY — migração de segurança: validação de dados direto no banco
-- Rode isso no SQL Editor do Supabase. Não apaga nenhum dado existente,
-- só adiciona regras que impedem valores inválidos de entrarem no banco
-- mesmo que alguém tente burlar as validações do site chamando a API
-- do Supabase diretamente.

alter table emprestimos
  add constraint emprestimos_valor_positivo check (valor > 0),
  add constraint emprestimos_taxa_nao_negativa check (taxa_juros >= 0),
  add constraint emprestimos_prazo_positivo check (prazo_dias > 0);

alter table pagamentos
  add constraint pagamentos_valor_positivo check (valor > 0);

alter table clientes
  add constraint clientes_nome_nao_vazio check (length(trim(nome)) > 0);

-- Permite que o usuário apague os próprios pagamentos (o app pede confirmação antes).
create policy "pagamentos delete" on public.pagamentos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Desempenho: (select auth.uid()) nas políticas de RLS e índices em chaves
-- estrangeiras de pagamentos. Já aplicado no projeto em produção.
-- alter policy "<nome>" on <tabela> using/with check ((select auth.uid()) = user_id);
-- (veja as expressões finais de cada política em supabase_schema.sql)
create index if not exists idx_pagamentos_estornado_por on pagamentos (estornado_por);
create index if not exists idx_pagamentos_registrado_por on pagamentos (registrado_por);

-- Cadastro de cliente: CPF (só 11 dígitos) e endereço, ambos opcionais.
alter table clientes add column if not exists cpf text, add column if not exists endereco text;
alter table clientes add constraint clientes_cpf_formato check (cpf is null or cpf ~ '^[0-9]{11}$');
