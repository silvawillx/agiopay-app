// AGIOPAY — regras da assinatura (criar a cobrança no Asaas e reagir aos avisos de pagamento).
// Fica separado dos arquivos de /api para poder ser testado sem internet.

export const PRECO_PADRAO = 15; // R$ por mês (valor de teste; o definitivo vai em ASAAS_VALOR_MENSAL)

export class ErroHttp extends Error {
  constructor(http, mensagem) {
    super(mensagem);
    this.http = http;
  }
}

const so = (v) => String(v || "").replace(/\D/g, "");

// datas no fuso de Brasília (o Asaas trabalha com dia, não com hora)
const dataSP = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(d);

// Cria (ou reaproveita) o cliente e a assinatura no Asaas e devolve o link de pagamento.
// usuario: { id, email, nome }
export async function iniciarAssinatura({ supa, asaas, usuario, cpfCnpj, valor = PRECO_PADRAO, agora = new Date() }) {
  const { data: ass, error } = await supa.from("assinaturas").select("*").eq("user_id", usuario.id).maybeSingle();
  if (error) throw error;
  if (!ass) throw new ErroHttp(404, "Sua conta ainda não tem assinatura registrada. Saia e entre de novo.");
  if (ass.status === "liberada" || ass.status === "ativa") throw new ErroHttp(409, "Sua conta já está liberada.");

  // 1) cliente no Asaas (guarda o id pra não criar de novo)
  let clienteId = ass.asaas_customer_id;
  if (!clienteId) {
    const doc = so(cpfCnpj);
    if (doc.length !== 11 && doc.length !== 14) throw new ErroHttp(400, "Informe um CPF ou CNPJ válido.");
    const c = await asaas.criarCliente({ name: usuario.nome || usuario.email, email: usuario.email, cpfCnpj: doc, externalReference: usuario.id });
    clienteId = c.id;
    const { error: e1 } = await supa.from("assinaturas").update({ asaas_customer_id: clienteId, atualizado_em: new Date().toISOString() }).eq("user_id", usuario.id);
    if (e1) throw e1;
  }

  // 2) assinatura mensal: se ainda está no teste grátis, a 1ª cobrança vence só no fim do teste
  let assinaturaId = ass.asaas_subscription_id;
  if (assinaturaId) {
    try {
      const s = await asaas.obterAssinatura(assinaturaId);
      if (s.status !== "ACTIVE" || s.deleted) assinaturaId = null;
    } catch (e) {
      if (e.status === 404) assinaturaId = null;
      else throw e;
    }
  }
  if (!assinaturaId) {
    const noTeste = ass.status === "teste" && ass.teste_ate && new Date(ass.teste_ate) > agora;
    const vencimento = noTeste ? dataSP(new Date(ass.teste_ate)) : dataSP(agora);
    const s = await asaas.criarAssinatura({
      customer: clienteId,
      billingType: "UNDEFINED", // quem paga escolhe PIX, boleto ou cartão
      value: valor,
      nextDueDate: vencimento,
      cycle: "MONTHLY",
      description: "Assinatura AGIOPAY",
      externalReference: usuario.id,
    });
    assinaturaId = s.id;
    const { error: e2 } = await supa.from("assinaturas").update({ asaas_subscription_id: assinaturaId, atualizado_em: new Date().toISOString() }).eq("user_id", usuario.id);
    if (e2) throw e2;
  }

  // 3) link da cobrança em aberto
  const lista = await asaas.cobrancasDaAssinatura(assinaturaId);
  const aberta = (lista.data || []).find((p) => (p.status === "PENDING" || p.status === "OVERDUE") && p.invoiceUrl);
  if (!aberta) throw new ErroHttp(409, "Não há cobrança em aberto agora. Se você acabou de pagar, aguarde um instante e toque em “Já paguei, atualizar”.");
  return { url: aberta.invoiceUrl };
}

// ---- avisos (webhook) do Asaas ----
const STATUS_POR_EVENTO = {
  PAYMENT_CONFIRMED: "ativa",
  PAYMENT_RECEIVED: "ativa",
  PAYMENT_OVERDUE: "atrasada",
  PAYMENT_REFUNDED: "atrasada",
  SUBSCRIPTION_DELETED: "cancelada",
  SUBSCRIPTION_INACTIVATED: "cancelada",
};

export async function tratarEvento({ supa, corpo, agora = new Date() }) {
  const novo = STATUS_POR_EVENTO[corpo?.event];
  if (!novo) return { ok: true, ignorado: "evento sem ação" };

  const pg = corpo.payment || {};
  const sub = corpo.subscription || {};
  const assinaturaId = pg.subscription || sub.id || null;
  const clienteId = pg.customer || sub.customer || null;
  const ref = pg.externalReference || sub.externalReference || null;

  // acha de quem é: pela assinatura, senão pelo cliente, senão pela referência (id do usuário)
  const procurar = async (coluna, valor) => {
    const { data, error } = await supa.from("assinaturas").select("user_id, status").eq(coluna, valor).maybeSingle();
    if (error) throw error;
    return data;
  };
  let linha = null;
  if (assinaturaId) linha = await procurar("asaas_subscription_id", assinaturaId);
  if (!linha && clienteId) linha = await procurar("asaas_customer_id", clienteId);
  if (!linha && ref) linha = await procurar("user_id", ref);
  if (!linha) return { ok: true, ignorado: "assinatura não encontrada" };
  if (linha.status === "liberada") return { ok: true, ignorado: "conta liberada nunca muda" };

  const { error } = await supa.from("assinaturas").update({ status: novo, atualizado_em: agora.toISOString() }).eq("user_id", linha.user_id);
  if (error) throw error;
  return { ok: true, status: novo };
}
