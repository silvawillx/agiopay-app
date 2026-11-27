// AGIOPAY — cliente mínimo da API do Asaas (roda só no SERVIDOR da Vercel).
// A chave (ASAAS_API_KEY) nunca vai pro navegador: ela só existe como variável
// de ambiente do servidor, SEM o prefixo VITE_.

const URLS = {
  sandbox: "https://api-sandbox.asaas.com/v3", // ambiente de testes: não cobra de verdade
  production: "https://api.asaas.com/v3",
};

export function criarAsaas({ apiKey, ambiente = "sandbox", fetchImpl = globalThis.fetch }) {
  const base = URLS[ambiente] || URLS.sandbox;

  async function chamar(metodo, caminho, corpo) {
    const r = await fetchImpl(base + caminho, {
      method: metodo,
      headers: { "Content-Type": "application/json", access_token: apiKey, "User-Agent": "AGIOPAY" },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(`Asaas respondeu ${r.status}`);
      e.status = r.status;
      // só as descrições dos erros (nunca o corpo da requisição, que tem CPF/CNPJ)
      e.detalhes = (j.errors || []).map((x) => x.description || x.code).filter(Boolean);
      throw e;
    }
    return j;
  }

  return {
    criarCliente: (dados) => chamar("POST", "/customers", dados),
    criarAssinatura: (dados) => chamar("POST", "/subscriptions", dados),
    obterAssinatura: (id) => chamar("GET", `/subscriptions/${encodeURIComponent(id)}`),
    cobrancasDaAssinatura: (id) => chamar("GET", `/subscriptions/${encodeURIComponent(id)}/payments`),
  };
}
