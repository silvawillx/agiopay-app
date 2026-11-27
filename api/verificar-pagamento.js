// AGIOPAY — POST /api/verificar-pagamento
// Confere direto no Asaas se a assinatura da pessoa foi paga e acerta o status da conta.
// É o "Já paguei, atualizar" e o plano B caso o aviso (webhook) do Asaas não chegue.
// Mesmas variáveis do /api/assinar.

import { createClient } from "@supabase/supabase-js";
import { criarAsaas } from "../server/asaas.js";
import { sincronizarAssinatura, ErroHttp } from "../server/assinatura.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chaveServico) return res.status(500).json({ erro: "Servidor sem configuração do banco." });
  if (!process.env.ASAAS_API_KEY) return res.status(503).json({ erro: "O pagamento ainda não está configurado." });

  const supa = createClient(url, chaveServico, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ erro: "Faça login." });
  const { data: quem, error: errQuem } = await supa.auth.getUser(token);
  if (errQuem || !quem?.user) return res.status(401).json({ erro: "Sessão expirada. Faça login de novo." });

  const asaas = criarAsaas({ apiKey: process.env.ASAAS_API_KEY, ambiente: process.env.ASAAS_AMBIENTE || "sandbox" });
  try {
    const r = await sincronizarAssinatura({ supa, asaas, usuario: { id: quem.user.id } });
    return res.status(200).json(r);
  } catch (e) {
    if (e instanceof ErroHttp) return res.status(e.http).json({ erro: e.message });
    // eslint-disable-next-line no-console
    console.error("AGIOPAY verificar-pagamento —", e.status || "", e.message, e.detalhes || "");
    return res.status(502).json({ erro: "Não deu para conferir o pagamento agora. Tente de novo." });
  }
}
