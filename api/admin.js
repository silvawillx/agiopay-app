// AGIOPAY — API do painel /admin (roda no SERVIDOR da Vercel, nunca no navegador)
//
// Usa a chave service_role do Supabase, que tem poder total sobre o banco.
// Por isso ela só existe aqui, como variável de ambiente do servidor
// (SUPABASE_SERVICE_ROLE_KEY, SEM o prefixo VITE_). Se ela tiver o prefixo
// VITE_, vai parar no código do navegador e qualquer pessoa consegue pegar.
//
// Quem pode usar: só quem estiver logado com um email listado em ADMIN_EMAILS
// (separados por vírgula). A conferência é feita aqui no servidor — esconder a
// tela no navegador não basta.
//
// Esse mesmo padrão (função no servidor + service_role) é o que vai receber o
// aviso do gateway de pagamento no futuro e criar/liberar a conta sozinho.

import { createClient } from "@supabase/supabase-js";

const BLOQUEIO = "876000h"; // ~100 anos

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function resumoUsuario(u, admins) {
  return {
    id: u.id,
    email: u.email,
    nome: u.user_metadata?.nome || "",
    criadoEm: u.created_at,
    ultimoAcesso: u.last_sign_in_at || null,
    aceitouTermos: !!u.user_metadata?.termos_aceitos_em,
    bloqueado: !!u.banned_until && new Date(u.banned_until) > new Date(),
    admin: admins.includes((u.email || "").toLowerCase()),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });

  const supa = adminClient();
  if (!supa) {
    return res.status(500).json({ erro: "Servidor sem configuração: faltam SUPABASE_SERVICE_ROLE_KEY e/ou SUPABASE_URL nas variáveis de ambiente." });
  }
  const admins = adminEmails();
  if (admins.length === 0) {
    return res.status(500).json({ erro: "Servidor sem configuração: falta ADMIN_EMAILS nas variáveis de ambiente." });
  }

  // confere quem está chamando pelo token de login dele
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ erro: "Faça login." });
  const { data: quem, error: errQuem } = await supa.auth.getUser(token);
  if (errQuem || !quem?.user) return res.status(401).json({ erro: "Sessão expirada. Faça login de novo." });
  const emailQuem = (quem.user.email || "").toLowerCase();
  if (!admins.includes(emailQuem)) return res.status(403).json({ erro: "Essa conta não tem acesso ao painel admin." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { acao } = body;

  try {
    if (acao === "listar") {
      const todos = [];
      for (let page = 1; page <= 50; page++) {
        const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        todos.push(...data.users);
        if (data.users.length < 200) break;
      }
      todos.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return res.status(200).json({ usuarios: todos.map((u) => resumoUsuario(u, admins)) });
    }

    if (acao === "criar") {
      const email = String(body.email || "").trim().toLowerCase();
      const senha = String(body.senha || "");
      const nome = String(body.nome || "").trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ erro: "Email inválido." });
      if (senha.length < 6) return res.status(400).json({ erro: "A senha precisa ter pelo menos 6 caracteres." });
      if (nome.length < 2) return res.status(400).json({ erro: "Preencha o nome." });

      const { data, error } = await supa.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true, // já entra sem precisar confirmar email
        user_metadata: { nome }, // sem termos_aceitos_em: ele aceita os termos no 1º acesso
        app_metadata: { origem: "admin", criado_por: emailQuem },
      });
      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          return res.status(409).json({ erro: "Já existe uma conta com esse email." });
        }
        throw error;
      }
      return res.status(200).json({ usuario: resumoUsuario(data.user, admins) });
    }

    if (acao === "redefinir_senha") {
      const senha = String(body.senha || "");
      if (!body.id) return res.status(400).json({ erro: "Usuário não informado." });
      if (senha.length < 6) return res.status(400).json({ erro: "A senha precisa ter pelo menos 6 caracteres." });
      const { error } = await supa.auth.admin.updateUserById(body.id, { password: senha });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (acao === "bloquear" || acao === "desbloquear") {
      if (!body.id) return res.status(400).json({ erro: "Usuário não informado." });
      if (body.id === quem.user.id) return res.status(400).json({ erro: "Você não pode bloquear a sua própria conta." });
      const { data, error } = await supa.auth.admin.updateUserById(body.id, {
        ban_duration: acao === "bloquear" ? BLOQUEIO : "none",
      });
      if (error) throw error;
      return res.status(200).json({ usuario: resumoUsuario(data.user, admins) });
    }

    return res.status(400).json({ erro: "Ação desconhecida." });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("AGIOPAY admin —", acao, e);
    return res.status(500).json({ erro: "Não deu para concluir agora. Tente de novo." });
  }
}
