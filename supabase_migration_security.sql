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
