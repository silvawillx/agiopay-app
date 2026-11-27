// AGIOPAY — POST /api/webhook-asaas
// Recebe os avisos do Asaas (pagou, atrasou, cancelou) e libera ou bloqueia a conta.
// No painel do Asaas (Integrações → Webhooks) aponte para:
//   https://SEU-DOMINIO/api/webhook-asaas
// e use como "Token de autenticação" o mesmo valor da variável ASAAS_WEBHOOK_TOKEN.
// Eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED,
//          SUBSCRIPTION_DELETED, SUBSCRIPTION_INACTIVATED.

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { tratarEvento } from "../server/assinatura.js";

function iguais(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });

  // só aceita quem sabe a senha combinada com o Asaas
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN || "";
  const recebido = req.headers["asaas-access-token"] || "";
  if (!esperado || !iguais(esperado, recebido)) return res.status(401).json({ erro: "Não autorizado." });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chaveServico) return res.status(500).json({ erro: "Servidor sem configuração do banco." });
  const supa = createClient(url, chaveServico, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const corpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const r = await tratarEvento({ supa, corpo });
    // 200 mesmo quando ignora: o Asaas repete o aviso (e pausa o envio) se receber erro
    return res.status(200).json(r);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("AGIOPAY webhook —", e.message);
    return res.status(500).json({ erro: "Falha ao processar. O Asaas vai tentar de novo." });
  }
}
