# AGIOPAY

Livro-caixa com juros, clientes e cobrança — feito em React + Vite, com banco de dados real no Supabase (Postgres + autenticação + Row Level Security).

---

## 1. Criar o banco de dados (Supabase)

1. Acesse **https://supabase.com** e crie uma conta grátis (dá pra entrar com GitHub).
2. Clique em **New Project**. Escolha um nome (ex: `agiopay`), uma senha forte para o banco (guarde essa senha em local seguro — não é a mesma coisa da chave que você vai usar no app) e a região mais próxima (São Paulo, se disponível).
3. Espere uns 2 minutos o projeto ser provisionado.
4. No menu lateral, clique em **SQL Editor** → **New query**.
5. Abra o arquivo `supabase_schema.sql` (que está na raiz deste projeto), copie tudo, cole no editor e clique em **Run**.
   - Isso cria as tabelas `clientes`, `emprestimos` e `pagamentos` — um cliente pode ter vários empréstimos ao longo do tempo (dossiê) — já com Row Level Security: cada usuário só enxerga os próprios dados, mesmo que tente forçar via código, o banco bloqueia.
6. Vá em **Authentication → Providers** e confirme que **Email** está habilitado (vem habilitado por padrão).
   - Opcional: em **Authentication → Settings**, você pode desligar "Confirm email" enquanto estiver testando, pra não precisar confirmar email a cada conta nova de teste. Religue antes de ir pra produção de verdade.
7. Para o **"Esqueci minha senha"** funcionar: vá em **Authentication → URL Configuration** e adicione, em **Redirect URLs**, o endereço onde o app vai rodar — por exemplo `http://localhost:5173` (pra testar local) e, depois, a URL da Vercel (ex: `https://agiopay.vercel.app`). Sem isso, o link do email de redefinição de senha não volta pro app corretamente.

## 2. Pegar as chaves do projeto

1. No Supabase, vá em **Project Settings** (ícone de engrenagem) → **API**.
2. Copie dois valores:
   - **Project URL** (algo como `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key (uma chave longa)

Essas duas informações são públicas por design (são feitas pra ficar no código do navegador) — quem protege os dados de verdade é o Row Level Security que você já criou no passo 1, não o sigilo dessa chave.

## 3. Rodar o projeto na sua máquina

Pré-requisito: ter o **Node.js** instalado (baixe em nodejs.org, versão LTS).

```bash
# dentro da pasta do projeto
npm install
cp .env.example .env
```

Abra o arquivo `.env` que acabou de ser criado e cole suas chaves:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

Agora rode:

```bash
npm run dev
```

Vai aparecer um link tipo `http://localhost:5173` — abra no navegador. Essa é a versão local do AGIOPAY, já conectada ao banco de dados de verdade.

## 4. Como você vai criar a conta de cada cliente

Não existe cadastro público: a tela de login só tem o campo de entrar. As contas são criadas por você no painel **/admin** (abaixo). O antigo link `?dono=1` não existe mais.

1. **Desative o cadastro público no Supabase** (obrigatório): vá em **Authentication → Sign In / Providers → Email** e desligue a opção de permitir novos cadastros. Sem isso, alguém que conheça o Supabase ainda conseguiria criar conta direto pela API, mesmo sem botão no app. As contas criadas pelo /admin continuam funcionando normalmente.
2. **Termos de Uso**: na primeira vez que a pessoa entrar, o AGIOPAY mostra os Termos de Uso e ela só usa o app depois de aceitar.
3. **Senha**: dentro do app, em "Minha conta", cada pessoa pode trocar a própria senha (recomendado logo no primeiro acesso, já que a senha inicial foi mandada por WhatsApp). Se ela esquecer, você define uma nova pelo /admin.

### Painel /admin (jeito recomendado de cadastrar clientes)

Acesse `https://seu-site.vercel.app/admin`, entre com a sua conta e cadastre nome, email e senha da pessoa. O painel já gera uma senha e um texto pronto pra copiar e mandar no WhatsApp. Pelo mesmo painel dá pra **trocar a senha** de alguém e **bloquear/desbloquear** uma conta (bloquear não apaga os dados).

Configuração (uma vez só):

1. No Supabase: **Project Settings → API** → copie a chave **service_role** (é secreta).
2. Na Vercel: **Settings → Environment Variables**, adicione:
   - `SUPABASE_SERVICE_ROLE_KEY` = a chave service_role (**sem** `VITE_` na frente — com `VITE_` ela vai parar no navegador e qualquer pessoa pega)
   - `ADMIN_EMAILS` = o seu email de login (se forem vários, separe por vírgula)
3. Faça um novo deploy (ou `git push`).
4. Pra testar no seu computador, coloque as mesmas duas linhas no seu `.env` e rode `npm run dev` → `http://localhost:5173/admin`.

Quem não estiver em `ADMIN_EMAILS` vê "Sem acesso", e a conferência é feita no servidor (`api/admin.js`), não só na tela. Na tela de login do /admin aparece "Esqueci minha senha", pra você mesmo recuperar o acesso.

## 5. Reforço de segurança (rode antes de divulgar pra alguém)

Se você já criou o banco antes desta atualização, rode o arquivo `supabase_migration_security.sql` no SQL Editor do Supabase — ele adiciona travas direto no banco (valor não pode ser negativo, nome não pode ficar vazio, etc.), então mesmo que alguém tente burlar o site chamando o Supabase diretamente, o banco recusa. Não apaga nenhum dado existente.

Se for uma instalação nova, essas travas já vêm incluídas no `supabase_schema.sql` normal — não precisa rodar o arquivo de migração separado.

### Migrações do banco (rode na ordem, se seu banco é anterior a essas versões)

1. `supabase_migration_parcelas.sql`
2. `supabase_migration_estornos.sql`: cancelar baixa passa a **marcar** o pagamento como cancelado (com data, hora e motivo) em vez de apagar. Também tira do app a permissão de apagar pagamento.

O app mostra um aviso no topo dizendo qual arquivo ainda falta rodar.

### Parcelas, baixas e aba Hoje

Rode o arquivo `supabase_migration_parcelas.sql` no SQL Editor do Supabase. Ele cria a tabela `parcelas`, adiciona os dias de cobrança no empréstimo e liga cada pagamento (baixa) à parcela que ele pagou. Também corrige a permissão que faltava para **editar** pagamento. Não apaga nenhum dado — os empréstimos antigos continuam funcionando como "pagamento único". Enquanto essa migração não for rodada, o app mostra um aviso no topo.

Instalação nova: já vem tudo no `supabase_schema.sql`.

## 6. Teste de produção (antes de divulgar pra alguém)

Faça esse checklist com pelo menos 2 contas diferentes (a sua e a de um amigo, ou duas abas anônimas do navegador):

- [ ] Criar conta (nome, email, senha) e aceitar os termos de uso
- [ ] Cadastrar um cliente com o primeiro empréstimo (valor, juros, prazo, garantia, observação)
- [ ] Conferir se o cálculo de juros bate com o esperado
- [ ] Adicionar um **segundo empréstimo** pro mesmo cliente e ver os dois aparecerem separados no dossiê
- [ ] Registrar um pagamento parcial num empréstimo específico e ver o saldo dele atualizar (sem afetar o outro empréstimo do mesmo cliente)
- [ ] Editar um cliente e editar um empréstimo já cadastrado
- [ ] Ver o vencimento aparecer na aba **Agenda**, e sumir de lá quando o empréstimo for quitado
- [ ] Testar "Esqueci minha senha": sair da conta, clicar em esqueci a senha, checar se o email chega e se o link volta pro app pedindo a nova senha
- [ ] Exportar PDF de um cliente (deve mostrar todos os empréstimos dele) e de todos
- [ ] Exportar CSV e abrir no Excel/Sheets pra conferir os dados
- [ ] **O mais importante**: logar com uma segunda conta e confirmar que ela **não vê** os clientes da primeira conta (isso testa se o Row Level Security está funcionando)
- [ ] Testar no celular (o navegador do celular acessando o mesmo link, ou o localhost pela rede — veja abaixo)
- [ ] Apagar um empréstimo (deve manter o resto do dossiê) e apagar um cliente inteiro (deve pedir confirmação antes)
- [ ] Registrar um pagamento errado de propósito e testar **corrigir** e **cancelar** esse pagamento — o saldo deve voltar a ficar correto e o histórico mostrar o cancelamento
- [ ] Tentar cadastrar um empréstimo com valor negativo ou zero — o botão de salvar deve continuar desabilitado
- [ ] Testar os filtros da lista de clientes (Atrasados / Em aberto / Quitados) e as opções de ordenar (Nome, Maior saldo, Mais atrasados)
- [ ] Clicar no seu nome no topo do app pra abrir "Minha conta", trocar o nome e trocar a senha
- [ ] Abrir o link normal e confirmar que não tem opção de criar conta; abrir `/admin` com uma conta que não está em `ADMIN_EMAILS` e ver "Sem acesso"
- [ ] Salvar uma combinação de taxa/prazo como "modelo" e usá-la num novo empréstimo com um clique
- [ ] Baixar o modelo de CSV, preencher com 2-3 clientes de teste, e importar — conferir se os clientes e empréstimos apareceram certos
- [ ] Deixar um empréstimo vencendo hoje (ou já atrasado) e conferir se o sino no topo mostra a notificação
- [ ] Criar um empréstimo **parcelado** (ex.: 30 parcelas, Seg–Sáb, pulando feriados), tirar uma data da lista e trocar outra antes de salvar — conferir que continuam 30 parcelas
- [ ] Na aba **Hoje**, conferir previsto / recebido / falta receber; dar baixa numa parcela e ver os números mudarem; depois **cancelar a baixa** e ver voltar
- [ ] Dar baixa parcial (valor menor que a parcela) e ver "falta R$ X"
- [ ] Com parcelas atrasadas, usar **Reagendar atrasadas**: as datas vêm sugeridas pro fim; mudar o valor de uma (multa) e salvar
- [ ] Editar a data de uma parcela só (lápis ao lado dela)
- [ ] **Quitar empréstimo** de uma vez e conferir que todas as parcelas ficaram pagas
- [ ] Cancelar uma baixa escrevendo um motivo e conferir que ela aparece em "Baixas canceladas" no empréstimo e na aba **Caixa**
- [ ] Aba **Caixa**: conferir Hoje / Semana / Mês com os valores que você lembra; exportar o CSV do período
- [ ] **Offline**: com o app publicado (não funciona no `npm run dev`), abrir uma vez com internet, ligar o modo avião, fechar e abrir o app de novo — tem que abrir com os dados. Dar baixa em 2 parcelas, ver "2 operações esperando", desligar o modo avião e ver enviar sozinho
- [ ] Offline, tentar sair da conta com baixa na fila: tem que aparecer o aviso
- [ ] **Backup**: em "Minha conta", baixar o backup; apagar um cliente de teste; restaurar o arquivo e ver o cliente voltar

**Pra testar no celular sem publicar ainda:** rode `npm run dev -- --host`, isso mostra um endereço tipo `http://192.168.x.x:5173` que funciona em qualquer aparelho conectado no mesmo Wi-Fi.

### Backup

O plano grátis do Supabase **não tem backup que você consiga baixar e restaurar**. Por isso o app tem o próprio: em **Minha conta → Backup → Baixar backup** sai um arquivo `.json` com tudo (clientes, empréstimos, parcelas, pagamentos e baixas canceladas). Guarde fora do celular (Google Drive, email). Se passar 7 dias sem backup, a aba Hoje avisa.

**Restaurar** recoloca no banco tudo que está no arquivo, inclusive o que tinha sido apagado, e não apaga o que foi cadastrado depois do backup.

## 7. Publicar de graça (Vercel)

1. Crie uma conta grátis em **https://vercel.com** (dá pra entrar com GitHub).
2. Suba este projeto pro GitHub:
   ```bash
   git init
   git add .
   git commit -m "AGIOPAY inicial"
   ```
   Crie um repositório novo no GitHub (github.com/new) e siga as instruções que ele mostra pra conectar (`git remote add origin ...` e `git push`).
3. Na Vercel, clique em **Add New → Project**, escolha o repositório que você acabou de subir.
4. Antes de clicar em "Deploy", abra **Environment Variables** e adicione as duas mesmas do seu `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Clique em **Deploy**. Em 1-2 minutos você tem uma URL de verdade tipo `agiopay.vercel.app` — é essa que você manda pros seus amigos/clientes testarem.
6. Toda vez que você der `git push`, a Vercel atualiza o site sozinha.

## 8. Transformar em "app"

Existem dois níveis, do mais simples pro mais trabalhoso:

**Nível 1 — PWA (já está pronto no código, só falta publicar)**
O ícone, o manifest.json e o nome já estão configurados — quando você publicar na Vercel (próximo passo), qualquer pessoa que acessar pelo celular e escolher **"Adicionar à tela inicial"** vai ver o ícone do AGIOPAY (fundo verde-escuro, "A" dourado) e o nome certo, abrindo em tela cheia, sem barra de navegador, como se fosse um app de verdade.
- No Android, o Chrome costuma até sugerir sozinho "Instalar app" quando você visita o site algumas vezes.
- No iPhone, a pessoa precisa abrir pelo **Safari** (não funciona pelo Chrome no iOS) → tocar no ícone de compartilhar → "Adicionar à Tela de Início".
- Se quiser trocar o ícone por um logo seu de verdade no futuro, é só me mandar a imagem que eu gero os tamanhos certos de novo.

**Nível 2 — App de verdade na Play Store / App Store**
Usa uma ferramenta chamada **Capacitor**, que empacota esse mesmo site dentro de um app nativo, sem reescrever o código. Isso já dá pra publicar nas lojas oficiais. É mais trabalhoso (precisa de conta de desenvolvedor: US$25 único na Google Play, US$99/ano na Apple) e só vale a pena quando o produto já estiver validado com usuários reais — não é o passo certo agora.

Quando você tiver feito os testes de produção e quiser seguir pro deploy, é só avisar que eu te guio no próximo passo.
