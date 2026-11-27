// AGIOPAY — GET /api/diagnostico-cobranca
// Mostra o que o SERVIDOR está enxergando da configuração da cobrança, para achar
// "falta variável" sem adivinhar. Só diz SE está preenchido, nunca o valor.
// Só responde para contas LIBERADAS (as de administração).

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido." });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chaveServico) {
    return res.status(500).json({ erro: "Servidor sem configuração do banco.", supabaseUrl: !!url, supabaseServiceRoleKey: !!chaveServico });
  }
  const supa = createClient(url, chaveServico, { auth: { autoRefreshToken: false, persistSession: false } });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ erro: "Faça login." });
  const { data: quem, error: errQuem } = await supa.auth.getUser(token);
  if (errQuem || !quem?.user) return res.status(401).json({ erro: "Sessão expirada. Faça login de novo." });

  const { data: ass } = await supa.from("assinaturas").select("status").eq("user_id", quem.user.id).maybeSingle();
  if (ass?.status !== "liberada") return res.status(403).json({ erro: "Só contas liberadas veem o diagnóstico." });

  const amb = process.env.ASAAS_AMBIENTE;
  const valor = Number(process.env.ASAAS_VALOR_MENSAL);
  return res.status(200).json({
    ambienteVercel: process.env.VERCEL_ENV || "desconhecido", // production | preview | development
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
    ASAAS_API_KEY: process.env.ASAAS_API_KEY ? `preenchida (${process.env.ASAAS_API_KEY.length} caracteres)` : "NÃO ENCONTRADA",
    ASAAS_AMBIENTE: amb === "sandbox" || amb === "production" ? amb : amb ? `valor estranho (use sandbox ou production)` : "NÃO ENCONTRADA (vale sandbox)",
    ASAAS_VALOR_MENSAL: valor > 0 ? valor : "NÃO ENCONTRADA (vale 15)",
    ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN ? "preenchida" : "NÃO ENCONTRADA",
    SUPABASE_SERVICE_ROLE_KEY: "preenchida",
  });
}
