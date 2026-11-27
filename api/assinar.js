// AGIOPAY — POST /api/assinar
// Cria a assinatura no Asaas e devolve o link de pagamento ({ url }).
// Roda no SERVIDOR da Vercel. Variáveis de ambiente (todas SEM o prefixo VITE_):
//   ASAAS_API_KEY            chave do Asaas (segredo)
//   ASAAS_AMBIENTE           "sandbox" (testes, padrão) ou "production"
//   ASAAS_VALOR_MENSAL       valor da mensalidade em R$ (padrão 15)
//   SUPABASE_SERVICE_ROLE_KEY  chave de serviço do Supabase (segredo)
//   SUPABASE_URL             (ou VITE_SUPABASE_URL)

import { createClient } from "@supabase/supabase-js";
import { criarAsaas } from "../server/asaas.js";
import { iniciarAssinatura, ErroHttp, PRECO_PADRAO } from "../server/assinatura.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chaveServico) return res.status(500).json({ erro: "Servidor sem configuração do banco." });
  if (!process.env.ASAAS_API_KEY) return res.status(503).json({ erro: "O pagamento ainda não está configurado." });

  const supa = createClient(url, chaveServico, { auth: { autoRefreshToken: false, persistSession: false } });

  // quem está chamando: pelo token de login dele
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ erro: "Faça login." });
  const { data: quem, error: errQuem } = await supa.auth.getUser(token);
  if (errQuem || !quem?.user) return res.status(401).json({ erro: "Sessão expirada. Faça login de novo." });

  const corpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const asaas = criarAsaas({ apiKey: process.env.ASAAS_API_KEY, ambiente: process.env.ASAAS_AMBIENTE || "sandbox" });
  const valor = Number(process.env.ASAAS_VALOR_MENSAL) || PRECO_PADRAO;

  try {
    const r = await iniciarAssinatura({
      supa,
      asaas,
      usuario: { id: quem.user.id, email: quem.user.email, nome: quem.user.user_metadata?.nome || "" },
      cpfCnpj: corpo.cpfCnpj,
      valor,
    });
    return res.status(200).json(r);
  } catch (e) {
    if (e instanceof ErroHttp) return res.status(e.http).json({ erro: e.message });
    // eslint-disable-next-line no-console
    console.error("AGIOPAY assinar —", e.status || "", e.message, e.detalhes || "");
    const detalhe = Array.isArray(e.detalhes) && e.detalhes.length ? ` (${e.detalhes[0]})` : "";
    return res.status(502).json({ erro: `Não deu para gerar o pagamento agora${detalhe}. Tente de novo.` });
  }
}
