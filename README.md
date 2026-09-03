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

Como o plano é você mesmo criar o login (email + senha) de cada pessoa depois que ela te mandar o pagamento, a tela de login pública **só mostra o campo de entrar** — sem botão de "criar conta" nem "esqueci minha senha". Isso evita que qualquer um tente se cadastrar sozinho ou fique clicando em opções que não deveriam usar.

**Acesso especial só pra você:** pra ver as opções de criar conta e recuperar senha, acesse o app com `?dono=1` no final do link — por exemplo:

```
https://agiopay.vercel.app/?dono=1
```

Só quem tiver esse link exato vê os botões extras. Guarde esse link só pra você (ex: salvo nos favoritos do navegador). Se um dia quiser trocar `dono` por outra palavra secreta, é só pedir que eu ajusto no código.

Passo a passo pra criar a conta de cada cliente:

1. **Desative o cadastro público no Supabase também** (reforça a proteção, mesmo já estando escondido no app): vá em **Authentication → Sign In / Providers → Email** e desligue a opção de permitir novos cadastros (o nome exato varia um pouco conforme a versão do painel, mas é nessa seção).
2. **Crie a conta da pessoa manualmente**: vá em **Authentication → Users → Add user → Create new user**. Preencha o email dela, defina uma senha temporária (ou marque para enviar um convite por email, se preferir que ela mesma defina a senha). Ou, se preferir usar a tela do próprio app, acesse com `?dono=1` e cadastre por lá.
3. Mande pra ela o email e a senha (ou deixe o Supabase mandar o convite por email).
4. **Sobre os Termos de Uso**: não importa se a conta foi criada pela tela `?dono=1` ou por você direto no painel do Supabase — na primeira vez que a pessoa entrar, o AGIOPAY mostra uma tela obrigatória com os Termos de Uso, e ela só consegue usar o app depois de marcar que aceita. Você não precisa fazer nada a mais pra isso acontecer.
5. **Se a pessoa esquecer a senha**, como o botão fica escondido pra ela, o caminho é ela te avisar e você resetar a senha manualmente: no Supabase, vá em **Authentication → Users**, clique nos "..." ao lado do usuário dela e escolha a opção de redefinir/enviar link de redefinição de senha. Se preferir deixar ela resetar sozinha, é só usar o link `?dono=1` você mesmo, clicar em "Esqueci minha senha" com o email dela, ou compartilhar esse link especial com ela.

## 5. Reforço de segurança (rode antes de divulgar pra alguém)

Se você já criou o banco antes desta atualização, rode o arquivo `supabase_migration_security.sql` no SQL Editor do Supabase — ele adiciona travas direto no banco (valor não pode ser negativo, nome não pode ficar vazio, etc.), então mesmo que alguém tente burlar o site chamando o Supabase diretamente, o banco recusa. Não apaga nenhum dado existente.

Se for uma instalação nova, essas travas já vêm incluídas no `supabase_schema.sql` normal — não precisa rodar o arquivo de migração separado.

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
- [ ] Registrar um pagamento errado de propósito e testar **editar** e **apagar** esse pagamento — o saldo deve voltar a ficar correto
- [ ] Tentar cadastrar um empréstimo com valor negativo ou zero — o botão de salvar deve continuar desabilitado
- [ ] Testar os filtros da lista de clientes (Atrasados / Em aberto / Quitados) e as opções de ordenar (Nome, Maior saldo, Mais atrasados)
- [ ] Clicar no seu nome no topo do app pra abrir "Minha conta", trocar o nome e trocar a senha
- [ ] Acessar com `?dono=1` e confirmar que só ali aparecem as opções de criar conta e esqueci senha
- [ ] Salvar uma combinação de taxa/prazo como "modelo" e usá-la num novo empréstimo com um clique
- [ ] Baixar o modelo de CSV, preencher com 2-3 clientes de teste, e importar — conferir se os clientes e empréstimos apareceram certos
- [ ] Deixar um empréstimo vencendo hoje (ou já atrasado) e conferir se o sino no topo mostra a notificação

**Pra testar no celular sem publicar ainda:** rode `npm run dev -- --host`, isso mostra um endereço tipo `http://192.168.x.x:5173` que funciona em qualquer aparelho conectado no mesmo Wi-Fi.

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
