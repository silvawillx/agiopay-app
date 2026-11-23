import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, X, TrendingUp, TrendingDown, Users, Wallet, Search, ChevronRight,
  Trash2, Check, Pencil, AlertTriangle, LogOut, Eye, EyeOff, FileDown, Sheet,
  ArrowLeft, Calendar, ShieldCheck, KeyRound, FileText, ChevronDown, ChevronUp, UserCircle, Upload, Bell,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
import { supabase } from "./supabaseClient";

// ---- design tokens ----
const T = {
  ink: "#14231C",
  inkSoft: "#1B2E24",
  paper: "#F1EAD6",
  paperSoft: "#E7DEC4",
  line: "#C8BA96",
  textPaper: "#241D12",
  textInk: "#EDE4CC",
  gold: "#BE9552",
  goldSoft: "#8C7343",
  red: "#9B3A2C",
  redSoft: "#C77361",
  green: "#3E6B4C",
  greenSoft: "#7FA98D",
  muted: "#8A7F63",
};

const fmt = (n) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function diasEntre(a, b) {
  return (b - a) / (1000 * 60 * 60 * 24);
}

function calcularEmprestimo(l) {
  const inicio = new Date(l.dataEmprestimo + "T00:00:00");
  const hoje = new Date();
  const prazoDias = l.prazoDias || 30;
  const diasDecorridos = Math.max(0, diasEntre(inicio, hoje));
  const periodos = Math.max(1, Math.ceil(diasDecorridos / prazoDias || 1));
  const juros = l.valor * (l.taxaJuros / 100) * periodos;
  const totalDevido = l.valor + juros;
  const totalPago = (l.pagamentos || []).reduce((s, p) => s + p.valor, 0);
  const saldo = Math.max(0, totalDevido - totalPago);
  const status = saldo <= 0.01 ? "positivo" : "negativo";

  const vencimento = new Date(inicio);
  vencimento.setDate(vencimento.getDate() + prazoDias);
  const diasAtraso = Math.floor(diasEntre(vencimento, hoje));
  const atrasado = status === "negativo" && diasAtraso > 0;

  return { periodos, prazoDias, juros, totalDevido, totalPago, saldo, status, vencimento, diasAtraso, atrasado };
}

function calcularCliente(cliente) {
  const emprestimos = (cliente.emprestimos || []).map((l) => ({ ...l, calc: calcularEmprestimo(l) }));
  const totalEmprestado = emprestimos.reduce((s, l) => s + l.valor, 0);
  const totalDevido = emprestimos.reduce((s, l) => s + l.calc.totalDevido, 0);
  const totalPago = emprestimos.reduce((s, l) => s + l.calc.totalPago, 0);
  const saldo = emprestimos.reduce((s, l) => s + l.calc.saldo, 0);
  const abertos = emprestimos.filter((l) => l.calc.status === "negativo");
  const atrasados = emprestimos.filter((l) => l.calc.atrasado);
  const status = saldo <= 0.01 ? "positivo" : "negativo";
  const diasAtraso = atrasados.length ? Math.max(...atrasados.map((l) => l.calc.diasAtraso)) : 0;
  return { emprestimos, totalEmprestado, totalDevido, totalPago, saldo, abertos, atrasados, status, atrasado: atrasados.length > 0, diasAtraso };
}

const emptyClientLoanForm = {
  nome: "",
  telefone: "",
  observacoes: "",
  valor: "",
  taxaJuros: "30",
  prazoDias: "30",
  dataEmprestimo: new Date().toISOString().slice(0, 10),
  garantia: "",
};

const emptyLoanForm = {
  valor: "",
  taxaJuros: "30",
  prazoDias: "30",
  dataEmprestimo: new Date().toISOString().slice(0, 10),
  garantia: "",
};

function fromRow(row) {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone || "",
    observacoes: row.observacoes || "",
    emprestimos: (row.emprestimos || [])
      .map((l) => ({
        id: l.id,
        valor: Number(l.valor),
        taxaJuros: Number(l.taxa_juros),
        prazoDias: l.prazo_dias,
        dataEmprestimo: l.data_emprestimo,
        garantia: l.garantia || "",
        pagamentos: (l.pagamentos || [])
          .map((p) => ({ id: p.id, data: p.data, valor: Number(p.valor) }))
          .sort((a, b) => new Date(a.data) - new Date(b.data)),
      }))
      .sort((a, b) => new Date(b.dataEmprestimo) - new Date(a.dataEmprestimo)),
  };
}

// captura qualquer erro inesperado de renderização e mostra uma tela
// amigável em vez de deixar a página em branco
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("AGIOPAY — erro inesperado:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: T.ink, fontFamily: "'IBM Plex Sans', sans-serif" }} className="min-h-[100dvh] w-full flex items-center justify-center px-4">
          <div style={{ background: T.paper }} className="w-full max-w-sm rounded-3xl p-7 text-center">
            <AlertTriangle size={28} style={{ color: T.red, margin: "0 auto 10px" }} />
            <h1 style={{ fontFamily: "'Fraunces', serif", color: T.textPaper }} className="text-xl font-semibold mb-1.5">
              Algo deu errado
            </h1>
            <p style={{ color: T.muted }} className="text-sm mb-5">
              Aconteceu um erro inesperado. Seus dados estão salvos no banco — não foram perdidos. Tente recarregar a página.
            </p>
            <button onClick={() => window.location.reload()} style={{ background: T.gold, color: T.ink }} className="w-full rounded-full py-3 text-sm font-medium">
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState("dashboard"); // dashboard | clientes | agenda
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos"); // todos | atrasados | abertos | quitados
  const [sortBy, setSortBy] = useState("recentes"); // recentes | nome | saldo | atraso
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState(null); // cliente aberto no dossiê
  const [printMode, setPrintMode] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [taxaPresets, setTaxaPresets] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setNomeUsuario(data.session?.user?.user_metadata?.nome || "");
      setTaxaPresets(data.session?.user?.user_metadata?.taxas_modelo || []);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setNomeUsuario(s?.user?.user_metadata?.nome || "");
      setTaxaPresets(s?.user?.user_metadata?.taxas_modelo || []);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const user = session?.user || null;
  const isOwner = useMemo(() => new URLSearchParams(window.location.search).get("dono") === "1", []);

  const salvarPreset = async (taxaJuros, prazoDias) => {
    const jaExiste = taxaPresets.some((p) => p.taxaJuros === taxaJuros && p.prazoDias === prazoDias);
    if (jaExiste) return;
    const next = [...taxaPresets, { taxaJuros, prazoDias }].slice(-6);
    setTaxaPresets(next);
    await supabase.auth.updateUser({ data: { taxas_modelo: next } });
  };

  const removerPreset = async (idx) => {
    const next = taxaPresets.filter((_, i) => i !== idx);
    setTaxaPresets(next);
    await supabase.auth.updateUser({ data: { taxas_modelo: next } });
  };

  useEffect(() => {
    if (!printMode) return;
    const onAfterPrint = () => setPrintMode(null);
    window.addEventListener("afterprint", onAfterPrint);
    const t = setTimeout(() => window.print(), 150);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printMode]);

  const loadClients = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("clientes")
      .select("*, emprestimos(*, pagamentos(*))")
      .order("created_at", { ascending: false });
    if (err) {
      // eslint-disable-next-line no-console
      console.error("AGIOPAY — erro ao carregar clientes:", err);
      setError("Não deu para carregar seus clientes agora. Tenta recarregar a página.");
    } else setClients((data || []).map(fromRow));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadClients();
    else setClients([]);
  }, [user, loadClients]);

  // traduz erros comuns do banco (violação de regra) em mensagens
  // compreensíveis; qualquer outro erro vira mensagem genérica — o
  // detalhe técnico completo fica só no console, não na tela do usuário
  const mensagemErroBanco = (err) => {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("emprestimos_valor_positivo")) return "O valor emprestado precisa ser maior que zero.";
    if (msg.includes("emprestimos_taxa_nao_negativa")) return "A taxa de juros não pode ser negativa.";
    if (msg.includes("emprestimos_prazo_positivo")) return "O prazo precisa ser maior que zero dias.";
    if (msg.includes("pagamentos_valor_positivo")) return "O valor do pagamento precisa ser maior que zero.";
    if (msg.includes("clientes_nome_nao_vazio")) return "O nome do cliente não pode ficar vazio.";
    return null;
  };

  const flashError = (acao, err) => {
    // eslint-disable-next-line no-console
    console.error(`AGIOPAY — erro ao ${acao}:`, err);
    setError(mensagemErroBanco(err) || `Não deu para ${acao}. Tenta de novo em instantes.`);
    setTimeout(() => setError(null), 4500);
  };

  // cria cliente + primeiro empréstimo juntos
  const addClientWithLoan = async (data) => {
    const { data: cliente, error: err1 } = await supabase
      .from("clientes")
      .insert({ user_id: user.id, nome: data.nome, telefone: data.telefone || null, observacoes: data.observacoes || null })
      .select()
      .single();
    if (err1) return flashError("salvar o cliente", err1);

    const { error: err2 } = await supabase.from("emprestimos").insert({
      user_id: user.id,
      cliente_id: cliente.id,
      valor: parseFloat(data.valor),
      taxa_juros: parseFloat(data.taxaJuros),
      prazo_dias: parseInt(data.prazoDias || "30", 10),
      data_emprestimo: data.dataEmprestimo,
      garantia: data.garantia || null,
    });
    if (err2) return flashError("salvar o empréstimo (o cliente já foi criado)", err2);

    setShowAdd(false);
    loadClients();
  };

  const addLoan = async (clienteId, data) => {
    const { error: err } = await supabase.from("emprestimos").insert({
      user_id: user.id,
      cliente_id: clienteId,
      valor: parseFloat(data.valor),
      taxa_juros: parseFloat(data.taxaJuros),
      prazo_dias: parseInt(data.prazoDias || "30", 10),
      data_emprestimo: data.dataEmprestimo,
      garantia: data.garantia || null,
    });
    if (err) return flashError("salvar o empréstimo", err);
    loadClients();
  };

  const editLoan = async (id, data) => {
    const { error: err } = await supabase
      .from("emprestimos")
      .update({
        valor: parseFloat(data.valor),
        taxa_juros: parseFloat(data.taxaJuros),
        prazo_dias: parseInt(data.prazoDias || "30", 10),
        data_emprestimo: data.dataEmprestimo,
        garantia: data.garantia || null,
      })
      .eq("id", id);
    if (err) return flashError("editar o empréstimo", err);
    loadClients();
  };

  const removeLoan = async (id) => {
    const { error: err } = await supabase.from("emprestimos").delete().eq("id", id);
    if (err) return flashError("remover o empréstimo", err);
    loadClients();
  };

  const editClient = async (id, data) => {
    const { error: err } = await supabase
      .from("clientes")
      .update({ nome: data.nome, telefone: data.telefone || null, observacoes: data.observacoes || null })
      .eq("id", id);
    if (err) return flashError("editar o cliente", err);
    loadClients();
  };

  const addPayment = async (emprestimoId, valor) => {
    const { error: err } = await supabase.from("pagamentos").insert({
      emprestimo_id: emprestimoId,
      user_id: user.id,
      valor,
      data: new Date().toISOString().slice(0, 10),
    });
    if (err) return flashError("registrar o pagamento", err);
    loadClients();
  };

  const editPayment = async (paymentId, valor) => {
    const { error: err } = await supabase.from("pagamentos").update({ valor }).eq("id", paymentId);
    if (err) return flashError("editar o pagamento", err);
    loadClients();
  };

  const removePayment = async (paymentId) => {
    const { data: removidos, error: err } = await supabase.from("pagamentos").delete().eq("id", paymentId).select("id");
    if (err) return flashError("remover o pagamento", err);
    if (!removidos || removidos.length === 0) return flashError("remover o pagamento", new Error("O pagamento não foi removido (sem permissão ou já não existe)."));
    loadClients();
  };

  const removeClient = async (id) => {
    const { error: err } = await supabase.from("clientes").delete().eq("id", id);
    if (err) return flashError("remover o cliente", err);
    setSelectedId(null);
    loadClients();
  };

  const enriched = useMemo(() => clients.map((c) => ({ ...c, calc: calcularCliente(c) })), [clients]);

  const filtered = useMemo(() => {
    let list = enriched.filter((c) => c.nome.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus === "atrasados") list = list.filter((c) => c.calc.atrasado);
    else if (filterStatus === "abertos") list = list.filter((c) => c.calc.status === "negativo");
    else if (filterStatus === "quitados") list = list.filter((c) => c.calc.status === "positivo");

    const sorted = [...list];
    if (sortBy === "nome") sorted.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    else if (sortBy === "saldo") sorted.sort((a, b) => b.calc.saldo - a.calc.saldo);
    else if (sortBy === "atraso") sorted.sort((a, b) => b.calc.diasAtraso - a.calc.diasAtraso);
    return sorted;
  }, [enriched, search, filterStatus, sortBy]);

  const totals = enriched.reduce(
    (acc, c) => {
      acc.emprestado += c.calc.totalEmprestado;
      acc.aReceber += c.calc.saldo;
      acc.jaPago += c.calc.totalPago;
      if (c.calc.status === "negativo") acc.negativos += 1;
      if (c.calc.atrasado) acc.atrasados += 1;
      return acc;
    },
    { emprestado: 0, aReceber: 0, jaPago: 0, negativos: 0, atrasados: 0 }
  );

  const atrasadosList = enriched.filter((c) => c.calc.atrasado).sort((a, b) => b.calc.diasAtraso - a.calc.diasAtraso);
  const selected = enriched.find((c) => c.id === selectedId);

  const agendaItens = useMemo(() => {
    const itens = [];
    enriched.forEach((c) => {
      c.calc.abertos.forEach((l) => {
        itens.push({ clienteNome: c.nome, clienteId: c.id, loanId: l.id, vencimento: l.calc.vencimento, saldo: l.calc.saldo, atrasado: l.calc.atrasado, diasAtraso: l.calc.diasAtraso });
      });
    });
    return itens.sort((a, b) => a.vencimento - b.vencimento);
  }, [enriched]);

  const notifItens = useMemo(() => {
    const hojeStr = new Date().toDateString();
    return agendaItens
      .filter((i) => i.atrasado || i.vencimento.toDateString() === hojeStr)
      .sort((a, b) => (b.atrasado - a.atrasado) || (a.vencimento - b.vencimento));
  }, [agendaItens]);

  const exportarCSV = () => {
    const linhas = [
      ["Cliente", "Telefone", "Data do empréstimo", "Valor emprestado", "Taxa de juros (%)", "Prazo (dias)",
        "Garantia", "Juros acumulados", "Total devido", "Total pago", "Saldo em aberto", "Status", "Dias de atraso", "Observações do cliente"],
    ];
    enriched.forEach((c) => {
      if (c.calc.emprestimos.length === 0) return;
      c.calc.emprestimos.forEach((l) => {
        linhas.push([
          c.nome, c.telefone || "", l.dataEmprestimo, l.valor.toFixed(2), l.taxaJuros, l.prazoDias,
          l.garantia || "", l.calc.juros.toFixed(2), l.calc.totalDevido.toFixed(2), l.calc.totalPago.toFixed(2),
          l.calc.saldo.toFixed(2), l.calc.status, l.calc.atrasado ? l.calc.diasAtraso : 0, (c.observacoes || "").replace(/\n/g, " "),
        ]);
      });
    });
    const csv = linhas.map((linha) => linha.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agiopay-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const baixarModeloCSV = () => {
    const linhas = [
      ["Nome", "Telefone", "Valor", "Taxa (%)", "Prazo (dias)", "Data (dd/mm/aaaa)", "Garantia", "Observacoes"],
      ["João Silva", "11999998888", "1000", "30", "30", "20/08/2026", "moto", "cliente antigo"],
    ];
    const csv = linhas.map((linha) => linha.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agiopay-modelo-importacao.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // parser simples de CSV (aceita ; ou , como separador, campos entre aspas)
  const parseCSV = (text) => {
    const primeiraLinha = text.split(/\r?\n/)[0] || "";
    const delim = (primeiraLinha.match(/;/g) || []).length >= (primeiraLinha.match(/,/g) || []).length ? ";" : ",";
    const linhas = [];
    let campo = "", linha = [], dentroAspas = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (dentroAspas) {
        if (c === '"' && text[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') dentroAspas = false;
        else campo += c;
      } else {
        if (c === '"') dentroAspas = true;
        else if (c === delim) { linha.push(campo); campo = ""; }
        else if (c === "\n" || c === "\r") {
          if (c === "\r" && text[i + 1] === "\n") i++;
          linha.push(campo); campo = "";
          if (linha.some((f) => f.trim() !== "")) linhas.push(linha);
          linha = [];
        } else campo += c;
      }
    }
    if (campo !== "" || linha.length > 0) { linha.push(campo); linhas.push(linha); }
    return linhas;
  };

  const normalizarCabecalho = (h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const parseDataBr = (s) => {
    const m = (s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };

  const importarCSV = async (file) => {
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      const linhas = parseCSV(text);
      if (linhas.length < 2) {
        setImportMsg({ tipo: "erro", texto: "Arquivo vazio ou sem linhas de dados." });
        setImporting(false);
        return;
      }
      const cabecalho = linhas[0].map(normalizarCabecalho);
      const idx = (nomes) => cabecalho.findIndex((h) => nomes.includes(h));
      const iNome = idx(["nome", "cliente"]);
      const iTelefone = idx(["telefone"]);
      const iValor = idx(["valor", "valor emprestado"]);
      const iTaxa = idx(["taxa (%)", "taxa", "taxa de juros (%)", "taxa de juros"]);
      const iPrazo = idx(["prazo (dias)", "prazo"]);
      const iData = idx(["data (dd/mm/aaaa)", "data", "data do emprestimo"]);
      const iGarantia = idx(["garantia"]);
      const iObs = idx(["observacoes", "observacoes do cliente", "observações"]);

      if (iNome === -1 || iValor === -1 || iTaxa === -1 || iData === -1) {
        setImportMsg({ tipo: "erro", texto: "O arquivo precisa ter pelo menos as colunas Nome, Valor, Taxa e Data. Baixe o modelo pra conferir o formato certo." });
        setImporting(false);
        return;
      }

      let sucesso = 0;
      const erros = [];
      for (let i = 1; i < linhas.length; i++) {
        const row = linhas[i];
        const nome = (row[iNome] || "").trim();
        const valor = parseFloat((row[iValor] || "").replace(",", "."));
        const taxa = parseFloat((row[iTaxa] || "").replace(",", "."));
        const prazo = iPrazo >= 0 ? parseInt(row[iPrazo] || "30", 10) : 30;
        const dataIso = parseDataBr(row[iData]);

        if (!nome || !(valor > 0) || !(taxa >= 0) || !dataIso) {
          erros.push(`Linha ${i + 1}: dados inválidos ou incompletos (confira nome, valor, taxa e data no formato dd/mm/aaaa).`);
          continue;
        }

        const { data: cliente, error: err1 } = await supabase
          .from("clientes")
          .insert({
            user_id: user.id,
            nome,
            telefone: iTelefone >= 0 ? (row[iTelefone] || "").trim() || null : null,
            observacoes: iObs >= 0 ? (row[iObs] || "").trim() || null : null,
          })
          .select()
          .single();

        if (err1) { erros.push(`Linha ${i + 1} (${nome}): ${err1.message}`); continue; }

        const { error: err2 } = await supabase.from("emprestimos").insert({
          user_id: user.id,
          cliente_id: cliente.id,
          valor,
          taxa_juros: taxa,
          prazo_dias: prazo > 0 ? prazo : 30,
          data_emprestimo: dataIso,
          garantia: iGarantia >= 0 ? (row[iGarantia] || "").trim() || null : null,
        });

        if (err2) erros.push(`Linha ${i + 1} (${nome}): cliente criado, mas empréstimo falhou — ${err2.message}`);
        else sucesso++;
      }

      setImportMsg({
        tipo: erros.length > 0 ? "parcial" : "sucesso",
        texto: `${sucesso} cliente${sucesso !== 1 ? "s" : ""} importado${sucesso !== 1 ? "s" : ""} com sucesso.` + (erros.length > 0 ? ` ${erros.length} linha${erros.length !== 1 ? "s" : ""} com problema.` : ""),
        detalhes: erros,
      });
      if (sucesso > 0) loadClients();
    } catch (e) {
      setImportMsg({ tipo: "erro", texto: "Não deu para ler o arquivo. Confirme que é um .csv válido." });
    }
    setImporting(false);
  };

  if (authLoading) {
    return <CenteredMsg>Carregando…</CenteredMsg>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (recoveryMode) {
    return <NovaSenhaScreen onDone={() => setRecoveryMode(false)} />;
  }

  if (!user.user_metadata?.termos_aceitos_em) {
    return (
      <AceitarTermosScreen
        onAccept={async () => {
          await supabase.auth.updateUser({ data: { nome: nomeUsuario, termos_aceitos_em: new Date().toISOString() } });
          const { data } = await supabase.auth.getSession();
          setSession(data.session);
        }}
      />
    );
  }

  if (printMode) {
    return <PrintReport mode={printMode} allClients={enriched} userNome={nomeUsuario} onClose={() => setPrintMode(null)} />;
  }

  if (loading) {
    return <CenteredMsg>Carregando o livro-caixa…</CenteredMsg>;
  }

  return (
    <div style={{ background: T.ink, fontFamily: "'IBM Plex Sans', sans-serif" }} className="min-h-[100dvh] w-full">
      <div className="max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
          <div className="min-w-0">
            <h1 style={{ fontFamily: "'Fraunces', serif", color: T.textInk, letterSpacing: "-0.01em" }} className="text-2xl sm:text-3xl font-semibold">
              AGIOPAY
            </h1>
            <p
              onClick={() => setShowAccount(true)}
              style={{ color: T.muted }}
              className="text-xs sm:text-sm mt-0.5 truncate cursor-pointer hover:underline w-fit"
            >
              {nomeUsuario || user.email} · seu livro-caixa, sem caderno
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <div className="relative">
              <button onClick={() => setShowNotif((s) => !s)} title="Notificações" style={{ background: T.inkSoft, color: T.textInk }} className="flex items-center justify-center rounded-full w-10 h-10 active:scale-95 transition-transform relative">
                <Bell size={16} />
                {notifItens.length > 0 && (
                  <span style={{ background: T.red, color: T.textInk }} className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1">
                    {notifItens.length}
                  </span>
                )}
              </button>
              {showNotif && (
                <NotifDropdown
                  itens={notifItens}
                  onClose={() => setShowNotif(false)}
                  onClickItem={(clienteId) => { setSelectedId(clienteId); setShowNotif(false); }}
                  onVerAgenda={() => { setView("agenda"); setShowNotif(false); }}
                />
              )}
            </div>
            <button onClick={exportarCSV} title="Exportar todos em CSV" style={{ background: T.inkSoft, color: T.textInk }} className="hidden sm:flex items-center justify-center rounded-full w-10 h-10 active:scale-95 transition-transform">
              <Sheet size={16} />
            </button>
            <button onClick={() => setPrintMode({ type: "todos" })} title="Exportar todos em PDF" style={{ background: T.inkSoft, color: T.textInk }} className="hidden sm:flex items-center justify-center rounded-full w-10 h-10 active:scale-95 transition-transform">
              <FileDown size={16} />
            </button>
            <button onClick={() => setShowAdd(true)} style={{ background: T.gold, color: T.ink }} className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium active:scale-95 transition-transform">
              <Plus size={16} strokeWidth={2.5} />
              Cliente
            </button>
            <button onClick={() => setShowAccount(true)} title="Minha conta" style={{ background: T.inkSoft, color: T.textInk }} className="flex items-center justify-center rounded-full w-10 h-10 active:scale-95 transition-transform">
              <UserCircle size={16} />
            </button>
            <button onClick={() => supabase.auth.signOut()} title="Sair" style={{ background: T.inkSoft, color: T.textInk }} className="flex items-center justify-center rounded-full w-10 h-10 active:scale-95 transition-transform">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {!selected && (
          <div className="flex gap-1 mb-6 p-1 rounded-full max-w-full sm:max-w-md" style={{ background: T.inkSoft }}>
            {[["dashboard", "Resumo"], ["clientes", "Clientes"], ["agenda", "Agenda"]].map(([key, label]) => (
              <button key={key} onClick={() => setView(key)} style={{ background: view === key ? T.gold : "transparent", color: view === key ? T.ink : T.textInk }} className="flex-1 rounded-full py-2 text-sm font-medium transition-colors">
                {label}
              </button>
            ))}
          </div>
        )}

        {selected ? (
          <ClientDossie
            client={selected}
            onBack={() => setSelectedId(null)}
            onEditClient={(data) => editClient(selected.id, data)}
            onDeleteClient={() => removeClient(selected.id)}
            onAddLoan={(data) => addLoan(selected.id, data)}
            onEditLoan={editLoan}
            onRemoveLoan={removeLoan}
            onPay={addPayment}
            onEditPayment={editPayment}
            onRemovePayment={removePayment}
            onExportPDF={() => setPrintMode({ type: "cliente", client: selected })}
            presets={taxaPresets}
            onSavePreset={salvarPreset}
            onRemovePreset={removerPreset}
          />
        ) : (
          <>
            {view === "dashboard" && (
              <Dashboard totals={totals} count={clients.length} atrasadosList={atrasadosList} evolucao={buildEvolucaoMensal(clients)} onVerClientes={() => setView("clientes")} onAddClient={() => setShowAdd(true)} nomeUsuario={nomeUsuario} />
            )}

            {view === "clientes" && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search size={16} style={{ color: T.muted }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…" style={{ background: T.inkSoft, color: T.textInk, fontFamily: "'IBM Plex Sans', sans-serif" }} className="w-full rounded-full pl-9 pr-4 py-2.5 text-sm outline-none placeholder:opacity-50" />
                  </div>
                  <button onClick={() => setPrintMode({ type: "todos" })} title="Exportar todos em PDF" style={{ background: T.inkSoft, color: T.textInk }} className="sm:hidden flex items-center justify-center rounded-full w-10 h-10 shrink-0 active:scale-95 transition-transform">
                    <FileDown size={16} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-2.5">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ background: T.inkSoft, color: T.textInk, fontFamily: "'IBM Plex Sans', sans-serif" }}
                    className="rounded-full px-3 py-1.5 text-xs outline-none border-0"
                  >
                    <option value="todos">Todos</option>
                    <option value="atrasados">Atrasados</option>
                    <option value="abertos">Em aberto</option>
                    <option value="quitados">Quitados</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{ background: T.inkSoft, color: T.textInk, fontFamily: "'IBM Plex Sans', sans-serif" }}
                    className="rounded-full px-3 py-1.5 text-xs outline-none border-0"
                  >
                    <option value="recentes">Mais recentes</option>
                    <option value="nome">Nome (A-Z)</option>
                    <option value="saldo">Maior saldo</option>
                    <option value="atraso">Mais atrasados</option>
                  </select>
                  {(filterStatus !== "todos" || sortBy !== "recentes") && (
                    <button onClick={() => { setFilterStatus("todos"); setSortBy("recentes"); }} className="text-xs underline" style={{ color: T.muted }}>
                      limpar
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4">
                  <label style={{ background: T.inkSoft, color: T.textInk }} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs cursor-pointer">
                    {importing ? "Importando…" : <><Upload size={12} /> Importar CSV</>}
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      disabled={importing}
                      onChange={(e) => { if (e.target.files?.[0]) importarCSV(e.target.files[0]); e.target.value = ""; }}
                    />
                  </label>
                  <button onClick={baixarModeloCSV} className="text-xs underline" style={{ color: T.goldSoft }}>
                    baixar modelo
                  </button>
                </div>

                {importMsg && (
                  <div
                    style={{
                      background: importMsg.tipo === "erro" ? T.red : importMsg.tipo === "parcial" ? T.paperSoft : T.green,
                      color: importMsg.tipo === "parcial" ? T.textPaper : T.textInk,
                      border: importMsg.tipo === "parcial" ? `1px solid ${T.line}` : "none",
                    }}
                    className="rounded-xl px-4 py-3 text-sm mb-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p>{importMsg.texto}</p>
                      <button onClick={() => setImportMsg(null)}><X size={14} /></button>
                    </div>
                    {importMsg.detalhes?.length > 0 && (
                      <ul className="mt-2 text-xs opacity-90 list-disc pl-4 space-y-0.5">
                        {importMsg.detalhes.slice(0, 8).map((d, i) => (<li key={i}>{d}</li>))}
                      </ul>
                    )}
                  </div>
                )}

                {filtered.length === 0 ? (
                  <EmptyState onAdd={() => setShowAdd(true)} hasSearch={!!search || filterStatus !== "todos"} />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                    {filtered.map((c) => (
                      <LedgerRow key={c.id} client={c} onClick={() => setSelectedId(c.id)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === "agenda" && <Agenda itens={agendaItens} onClickItem={(clienteId) => setSelectedId(clienteId)} />}
          </>
        )}
      </div>

      {showAdd && <ClientLoanForm title="Novo cliente" initial={emptyClientLoanForm} onClose={() => setShowAdd(false)} onSave={addClientWithLoan} presets={taxaPresets} onSavePreset={salvarPreset} onRemovePreset={removerPreset} />}

      {showAccount && (
        <AccountModal
          user={user}
          nomeUsuario={nomeUsuario}
          isOwner={isOwner}
          onClose={() => setShowAccount(false)}
          onUpdated={(novoNome) => setNomeUsuario(novoNome)}
        />
      )}

      {error && (
        <div style={{ background: T.red, color: T.textInk }} className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto rounded-xl px-4 py-3 text-sm text-center z-50">
          {error}
        </div>
      )}
    </div>
  );
}

function CenteredMsg({ children }) {
  return (
    <div style={{ background: T.ink, color: T.textInk, fontFamily: "'IBM Plex Sans', sans-serif" }} className="min-h-[100dvh] flex items-center justify-center">
      {children}
    </div>
  );
}

// ---------------- DOSSIÊ DO CLIENTE ----------------

function ClientDossie({ client, onBack, onEditClient, onDeleteClient, onAddLoan, onEditLoan, onRemoveLoan, onPay, onEditPayment, onRemovePayment, onExportPDF, presets, onSavePreset, onRemovePreset }) {
  const { calc } = client;
  const positivo = calc.status === "positivo";
  const [editingClient, setEditingClient] = useState(false);
  const [addingLoan, setAddingLoan] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null); // loan object
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState(calc.emprestimos[0]?.id || null);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 mb-4 text-sm" style={{ color: T.textInk }}>
        <ArrowLeft size={15} /> Voltar
      </button>

      <div style={{ background: T.paper }} className="rounded-2xl p-4 sm:p-5 mb-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-xl sm:text-2xl font-semibold truncate">{client.nome}</h2>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onExportPDF} title="Exportar PDF"><FileDown size={17} style={{ color: T.muted }} /></button>
            <button onClick={() => setEditingClient(true)} title="Editar cliente"><Pencil size={17} style={{ color: T.muted }} /></button>
          </div>
        </div>
        {client.telefone && <p style={{ color: T.muted }} className="text-sm mb-2">{client.telefone}</p>}

        <div className="grid grid-cols-3 gap-2 mt-3">
          <MiniStat label="Emprestado" value={fmt(calc.totalEmprestado)} />
          <MiniStat label="Saldo aberto" value={positivo ? "Quitado" : fmt(calc.saldo)} color={positivo ? T.green : T.red} />
          <MiniStat label="Empréstimos" value={String(calc.emprestimos.length)} />
        </div>

        {calc.atrasado && (
          <div style={{ background: T.red, color: T.textInk }} className="rounded-xl px-3 py-2 flex items-center gap-2 text-sm mt-3">
            <AlertTriangle size={14} />
            {calc.atrasados.length} empréstimo{calc.atrasados.length > 1 ? "s" : ""} atrasado{calc.atrasados.length > 1 ? "s" : ""} — até {calc.diasAtraso}d
          </div>
        )}

        {client.observacoes && (
          <div style={{ background: T.paperSoft, border: `1px solid ${T.line}` }} className="rounded-xl p-3 mt-3">
            <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1">Observações</p>
            <p style={{ color: T.textPaper }} className="text-sm whitespace-pre-wrap">{client.observacoes}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <p style={{ color: T.textInk }} className="text-sm font-medium">Histórico de empréstimos</p>
        <button onClick={() => setAddingLoan(true)} style={{ background: T.gold, color: T.ink }} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0">
          <Plus size={13} strokeWidth={2.5} /> Novo empréstimo
        </button>
      </div>

      <div className="space-y-2.5 mb-4">
        {calc.emprestimos.map((l) => (
          <LoanCard
            key={l.id}
            loan={l}
            expanded={expandedLoan === l.id}
            onToggle={() => setExpandedLoan(expandedLoan === l.id ? null : l.id)}
            onPay={(valor) => onPay(l.id, valor)}
            onEditPayment={onEditPayment}
            onRemovePayment={onRemovePayment}
            onEdit={() => setEditingLoan(l)}
            onRemove={() => onRemoveLoan(l.id)}
          />
        ))}
      </div>

      <button onClick={() => setConfirmDelete(true)} style={{ color: T.red }} className="w-full flex items-center justify-center gap-1.5 text-sm py-2">
        <Trash2 size={14} />
        Remover cliente (e todo o histórico)
      </button>

      {editingClient && (
        <EditClientForm
          initial={{ nome: client.nome, telefone: client.telefone, observacoes: client.observacoes }}
          onClose={() => setEditingClient(false)}
          onSave={async (data) => { await onEditClient(data); setEditingClient(false); }}
        />
      )}

      {addingLoan && (
        <LoanForm title="Novo empréstimo" initial={emptyLoanForm} onClose={() => setAddingLoan(false)} onSave={async (data) => { await onAddLoan(data); setAddingLoan(false); }} presets={presets} onSavePreset={onSavePreset} onRemovePreset={onRemovePreset} />
      )}

      {editingLoan && (
        <LoanForm
          title="Editar empréstimo"
          initial={{ valor: String(editingLoan.valor), taxaJuros: String(editingLoan.taxaJuros), prazoDias: String(editingLoan.prazoDias), dataEmprestimo: editingLoan.dataEmprestimo, garantia: editingLoan.garantia }}
          onClose={() => setEditingLoan(null)}
          onSave={async (data) => { await onEditLoan(editingLoan.id, data); setEditingLoan(null); }}
          presets={presets}
          onSavePreset={onSavePreset}
          onRemovePreset={onRemovePreset}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Remover ${client.nome}?`}
          message="Isso apaga o cadastro, todos os empréstimos e todo o histórico de pagamentos dele. Não tem como desfazer."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={onDeleteClient}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: T.paperSoft }} className="rounded-lg p-2.5">
      <div style={{ color: T.muted }} className="text-[10px] uppercase tracking-wide mb-0.5">{label}</div>
      <div style={{ color: color || T.textPaper, fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm font-semibold tabular-nums truncate">{value}</div>
    </div>
  );
}

function LoanCard({ loan, expanded, onToggle, onPay, onEditPayment, onRemovePayment, onEdit, onRemove }) {
  const { calc } = loan;
  const positivo = calc.status === "positivo";
  const [payAmount, setPayAmount] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div style={{ background: T.paper }} className="rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
        <div className="min-w-0">
          <div style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="font-medium truncate flex items-center gap-1.5">
            {fmt(loan.valor)} emprestado
            {calc.atrasado && <AlertTriangle size={12} style={{ color: T.red }} />}
          </div>
          <div style={{ color: T.muted, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs mt-0.5">
            {new Date(loan.dataEmprestimo + "T00:00:00").toLocaleDateString("pt-BR")} · {loan.taxaJuros}% a.m.
            {calc.atrasado ? ` · ${calc.diasAtraso}d de atraso` : ` · ${calc.periodos} período${calc.periodos > 1 ? "s" : ""}`}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-3">
          <div className="text-right">
            <div style={{ color: positivo ? T.green : T.red, fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm font-semibold tabular-nums">
              {positivo ? "quitado" : fmt(calc.saldo)}
            </div>
          </div>
          {expanded ? <ChevronUp size={16} style={{ color: T.muted }} /> : <ChevronDown size={16} style={{ color: T.muted }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <div style={{ borderTop: `1px solid ${T.line}` }} className="pt-3 space-y-2">
            <Row label="Valor emprestado" value={fmt(loan.valor)} />
            <Row label={`Juros (${loan.taxaJuros}% × ${calc.periodos} período${calc.periodos > 1 ? "s" : ""} de ${calc.prazoDias}d)`} value={fmt(calc.juros)} />
            <Row label="Total devido" value={fmt(calc.totalDevido)} bold />
            <Row label="Já pago" value={fmt(calc.totalPago)} color={T.greenSoft} />
            <Row label="Saldo em aberto" value={positivo ? "Quitado" : fmt(calc.saldo)} color={positivo ? T.green : T.red} bold />
            {loan.garantia && <Row label="Garantia" value={loan.garantia} />}
          </div>

          {!positivo && (
            <div className="mt-3">
              <div className="flex gap-2">
                <DecimalField value={payAmount} onChange={setPayAmount} placeholder="Valor recebido" className="flex-1" />
                <button
                  disabled={!(parseFloat(payAmount) > 0)}
                  onClick={() => { const v = parseFloat(payAmount); if (v > 0) { onPay(v); setPayAmount(""); } }}
                  style={{ background: parseFloat(payAmount) > 0 ? T.green : T.line, color: parseFloat(payAmount) > 0 ? T.textInk : T.muted }}
                  className="rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed"
                >
                  Registrar
                </button>
              </div>
              {payAmount && !(parseFloat(payAmount) > 0) && (
                <p style={{ color: T.red }} className="text-xs mt-1.5 px-1">Digite um valor maior que zero</p>
              )}
              {parseFloat(payAmount) > 0 && (
                <p style={{ color: T.muted, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs mt-1.5 px-1">
                  Saldo depois: <span style={{ color: Math.max(0, calc.saldo - parseFloat(payAmount)) <= 0.01 ? T.green : T.red, fontWeight: 600 }}>{fmt(Math.max(0, calc.saldo - parseFloat(payAmount)))}</span>
                </p>
              )}
            </div>
          )}

          {loan.pagamentos.length > 0 && (
            <div className="mt-3">
              <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1.5">Pagamentos</p>
              <div className="space-y-1">
                {loan.pagamentos.map((p) => (
                  <PaymentRow key={p.id} payment={p} onEdit={(valor) => onEditPayment(p.id, valor)} onRemove={() => onRemovePayment(p.id)} />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
            <button onClick={onEdit} className="flex items-center gap-1 text-xs" style={{ color: T.muted }}>
              <Pencil size={12} /> Editar
            </button>
            <button onClick={() => setConfirmRemove(true)} className="flex items-center gap-1 text-xs" style={{ color: T.red }}>
              <Trash2 size={12} /> Remover empréstimo
            </button>
          </div>
        </div>
      )}

      {confirmRemove && (
        <ConfirmModal
          title="Remover este empréstimo?"
          message="Isso apaga esse empréstimo específico e os pagamentos ligados a ele. O resto do histórico do cliente continua."
          onCancel={() => setConfirmRemove(false)}
          onConfirm={onRemove}
        />
      )}
    </div>
  );
}

function PaymentRow({ payment, onEdit, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(String(payment.valor));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const valorValido = parseFloat(valor) > 0;

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span style={{ color: T.muted, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs shrink-0">
          {new Date(payment.data + "T00:00:00").toLocaleDateString("pt-BR")}
        </span>
        <DecimalField value={valor} onChange={setValor} className="flex-1" />
        <button
          disabled={!valorValido}
          onClick={() => { const v = parseFloat(valor); if (v > 0) { onEdit(v); setEditing(false); } }}
          style={{ color: valorValido ? T.green : T.muted }}
          className="disabled:cursor-not-allowed"
          title={valorValido ? "Salvar" : "Digite um valor maior que zero"}
        >
          <Check size={14} />
        </button>
        <button onClick={() => { setValor(String(payment.valor)); setEditing(false); }} style={{ color: T.muted }} title="Cancelar">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center text-sm group">
      <span style={{ color: T.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{new Date(payment.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
      <div className="flex items-center gap-2">
        <span style={{ color: T.textPaper, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(payment.valor)}</span>
        <button onClick={() => setEditing(true)} style={{ color: T.muted }} title="Editar pagamento"><Pencil size={11} /></button>
        <button onClick={() => setConfirmRemove(true)} style={{ color: T.red }} title="Remover pagamento"><Trash2 size={11} /></button>
      </div>
      {confirmRemove && (
        <ConfirmModal
          title="Remover este pagamento?"
          message={`Isso apaga o registro de ${fmt(payment.valor)} recebido em ${new Date(payment.data + "T00:00:00").toLocaleDateString("pt-BR")}. O saldo do empréstimo volta a incluir esse valor.`}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => { setConfirmRemove(false); onRemove(); }}
        />
      )}
    </div>
  );
}


function ConfirmModal({ title, message, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div onClick={onCancel} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
      <div style={{ background: T.paper }} className="relative w-full max-w-sm rounded-2xl p-5">
        <p style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-lg font-semibold mb-1.5">{title}</p>
        <p style={{ color: T.muted }} className="text-sm mb-4">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} style={{ background: T.paperSoft, color: T.textPaper, border: `1px solid ${T.line}` }} className="flex-1 rounded-full py-2.5 text-sm font-medium">Cancelar</button>
          <button onClick={onConfirm} style={{ background: T.red, color: T.textInk }} className="flex-1 rounded-full py-2.5 text-sm font-medium">Remover</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- AGENDA ----------------

function NotifDropdown({ itens, onClose, onClickItem, onVerAgenda }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" />
      <div style={{ background: T.paper, border: `1px solid ${T.line}` }} className="absolute right-0 top-12 z-50 w-72 rounded-2xl overflow-hidden shadow-xl">
        <div style={{ borderBottom: `1px solid ${T.line}` }} className="px-4 py-3">
          <p style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="font-medium text-sm">Vencimentos de hoje e atrasados</p>
        </div>
        {itens.length === 0 ? (
          <p style={{ color: T.muted }} className="text-sm px-4 py-6 text-center">Nada pra hoje. 🎉</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {itens.slice(0, 8).map((it) => (
              <button key={it.loanId} onClick={() => onClickItem(it.clienteId)} style={{ borderBottom: `1px solid ${T.line}` }} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
                <div className="min-w-0">
                  <div style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-sm truncate">{it.clienteNome}</div>
                  <div style={{ color: it.atrasado ? T.red : T.muted }} className="text-[11px]">
                    {it.atrasado ? `${it.diasAtraso}d atrasado` : "vence hoje"}
                  </div>
                </div>
                <span style={{ color: T.textPaper, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs font-medium shrink-0 pl-2">{fmt(it.saldo)}</span>
              </button>
            ))}
          </div>
        )}
        <button onClick={onVerAgenda} style={{ color: T.goldSoft }} className="w-full text-center text-xs py-3">
          Ver agenda completa
        </button>
      </div>
    </>
  );
}

function Agenda({ itens, onClickItem }) {
  if (itens.length === 0) {
    return (
      <div style={{ background: T.paper }} className="rounded-2xl p-8 text-center">
        <p style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-lg mb-1">Nada por vir</p>
        <p style={{ color: T.muted }} className="text-sm">Quando tiver empréstimo em aberto, os vencimentos aparecem aqui em ordem.</p>
      </div>
    );
  }

  const atrasados = itens.filter((i) => i.atrasado);
  const aVencer = itens.filter((i) => !i.atrasado);

  return (
    <div className="space-y-5">
      {atrasados.length > 0 && (
        <div>
          <p style={{ color: T.red }} className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Atrasados ({atrasados.length})
          </p>
          <div style={{ background: T.paper }} className="rounded-2xl overflow-hidden">
            {atrasados.map((it, i) => (
              <AgendaRow key={it.loanId} item={it} isLast={i === atrasados.length - 1} onClick={() => onClickItem(it.clienteId)} />
            ))}
          </div>
        </div>
      )}
      {aVencer.length > 0 && (
        <div>
          <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-2">A vencer</p>
          <div style={{ background: T.paper }} className="rounded-2xl overflow-hidden">
            {aVencer.map((it, i) => (
              <AgendaRow key={it.loanId} item={it} isLast={i === aVencer.length - 1} onClick={() => onClickItem(it.clienteId)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgendaRow({ item, isLast, onClick }) {
  return (
    <button onClick={onClick} style={{ borderBottom: isLast ? "none" : `1px solid ${T.line}` }} className="w-full flex items-center justify-between px-4 py-3.5 text-left active:opacity-70 transition-opacity">
      <div className="min-w-0">
        <div style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="font-medium truncate">{item.clienteNome}</div>
        <div style={{ color: item.atrasado ? T.red : T.muted, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs mt-0.5">
          {item.atrasado ? `venceu em ${item.vencimento.toLocaleDateString("pt-BR")} · ${item.diasAtraso}d atrasado` : `vence em ${item.vencimento.toLocaleDateString("pt-BR")}`}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pl-3">
        <span style={{ color: T.textPaper, fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm font-semibold tabular-nums">{fmt(item.saldo)}</span>
        <ChevronRight size={16} style={{ color: T.muted }} />
      </div>
    </button>
  );
}

// ---------------- AUTENTICAÇÃO ----------------

const TERMOS_TEXTO = `AGIOPAY — Termos de Uso (resumo)

1. O que é o AGIOPAY
O AGIOPAY é uma ferramenta de gestão financeira e de clientes: controle de recebíveis, cálculo de juros e acompanhamento de inadimplência. O aplicativo não é parte de nenhuma relação de empréstimo, não intermedia pagamentos e não presta serviço financeiro regulado.

2. Responsabilidade sobre o uso
Você é o único responsável pelas relações financeiras, contratos e cobranças que registra dentro do aplicativo, incluindo a legalidade das taxas de juros praticadas nas suas próprias operações com terceiros. O AGIOPAY apenas organiza informações que você mesmo insere.

3. Dados e privacidade
Seus dados ficam armazenados de forma isolada por conta (cada usuário só acessa os próprios registros). Não compartilhamos esses dados com terceiros. Você pode excluir sua conta e seus dados a qualquer momento.

4. Sem garantias
A ferramenta é fornecida "como está". Cálculos de juros e vencimentos são auxiliares — confira sempre os valores antes de tomar decisões financeiras importantes.

5. Alterações
Estes termos podem ser atualizados conforme o produto evolui.

Este é um resumo funcional, não um parecer jurídico. Se você usa o AGIOPAY para fins comerciais, vale consultar um advogado sobre a legislação aplicável às suas operações.`;

function TermsModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center px-4">
      <div onClick={onClose} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
      <div style={{ background: T.paper }} className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-lg font-semibold flex items-center gap-2">
            <FileText size={18} /> Termos de Uso
          </h2>
          <button onClick={onClose}><X size={20} style={{ color: T.muted }} /></button>
        </div>
        <pre style={{ color: T.textPaper, fontFamily: "'IBM Plex Sans', sans-serif", whiteSpace: "pre-wrap" }} className="text-sm leading-relaxed">
          {TERMOS_TEXTO}
        </pre>
        <button onClick={onClose} style={{ background: T.gold, color: T.ink }} className="w-full rounded-full py-3 text-sm font-medium mt-5">
          Fechar
        </button>
      </div>
    </div>
  );
}

// tela obrigatória de aceite dos termos — aparece pra qualquer conta que
// ainda não aceitou, seja ela criada pelo cadastro público ou por você
// direto no painel do Supabase (Authentication -> Users -> Invite user)
function AceitarTermosScreen({ onAccept }) {
  const [aceitou, setAceitou] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirmar = async () => {
    if (!aceitou || busy) return;
    setBusy(true);
    await onAccept();
    setBusy(false);
  };

  return (
    <div style={{ background: T.ink, fontFamily: "'IBM Plex Sans', sans-serif" }} className="min-h-[100dvh] w-full flex items-center justify-center px-4">
      <div style={{ background: T.paper }} className="w-full max-w-lg rounded-3xl p-6 sm:p-7 max-h-[90dvh] overflow-y-auto">
        <h1 style={{ fontFamily: "'Fraunces', serif", color: T.textPaper }} className="text-2xl font-semibold text-center mb-1">
          Antes de continuar
        </h1>
        <p style={{ color: T.muted }} className="text-sm text-center mb-5">
          Pra usar o AGIOPAY, você precisa ler e aceitar os Termos de Uso.
        </p>

        <pre style={{ color: T.textPaper, fontFamily: "'IBM Plex Sans', sans-serif", whiteSpace: "pre-wrap", background: T.paperSoft, border: `1px solid ${T.line}` }} className="text-sm leading-relaxed rounded-xl p-4 mb-5">
          {TERMOS_TEXTO}
        </pre>

        <label className="flex items-start gap-2 mb-5 select-none cursor-pointer">
          <input type="checkbox" checked={aceitou} onChange={(e) => setAceitou(e.target.checked)} className="mt-0.5" />
          <span style={{ color: T.textPaper }} className="text-sm">Li e aceito os Termos de Uso do AGIOPAY</span>
        </label>

        <button disabled={!aceitou || busy} onClick={confirmar} style={{ background: aceitou ? T.gold : T.line, color: T.ink }} className="w-full rounded-full py-3 text-sm font-medium disabled:opacity-60">
          {busy ? "Aguarda…" : "Aceitar e continuar"}
        </button>
      </div>
    </div>
  );
}

function AuthScreen() {
  // "modo dono": só aparece pra quem acessa com ?dono=1 na URL — clientes
  // comuns só veem o login puro, sem opção de criar conta ou esqueci senha
  const isOwner = useMemo(() => new URLSearchParams(window.location.search).get("dono") === "1", []);

  const [mode, setMode] = useState("login"); // login | cadastro | esqueci
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const emailValido = /\S+@\S+\.\S+/.test(email);

  const faltando = [];
  if (mode === "login") {
    if (!emailValido) faltando.push("email válido");
    if (senha.length < 6) faltando.push("senha com pelo menos 6 caracteres");
  } else if (mode === "cadastro") {
    if (nome.trim().length < 2) faltando.push("nome");
    if (!emailValido) faltando.push("email válido");
    if (senha.length < 6) faltando.push("senha com pelo menos 6 caracteres");
    if (!aceitouTermos) faltando.push("aceitar os termos de uso");
  } else {
    if (!emailValido) faltando.push("email válido");
  }
  const valid = faltando.length === 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr("");
    setInfo("");
    try {
      if (mode === "cadastro") {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: senha,
          options: { data: { nome: nome.trim(), termos_aceitos_em: new Date().toISOString() } },
        });
        if (error) setErr(traduzErro(error.message));
        else setInfo("Conta criada! Se o seu projeto exigir confirmação por email, verifique a caixa de entrada antes de entrar.");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
        if (error) setErr(traduzErro(error.message));
      } else if (mode === "esqueci") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: window.location.origin,
        });
        if (error) setErr(traduzErro(error.message));
        else setInfo("Se esse email tiver uma conta, enviamos um link pra redefinir a senha. Confira a caixa de entrada (e o spam).");
      }
    } catch (e) {
      setErr("Não deu para conectar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: T.ink, fontFamily: "'IBM Plex Sans', sans-serif" }} className="min-h-[100dvh] w-full flex items-center justify-center px-4">
      <div style={{ background: T.paper }} className="w-full max-w-sm rounded-3xl p-7">
        <h1 style={{ fontFamily: "'Fraunces', serif", color: T.textPaper, letterSpacing: "-0.01em" }} className="text-3xl font-semibold text-center">
          AGIOPAY
        </h1>
        <p style={{ color: T.muted }} className="text-sm text-center mt-1 mb-6">
          {mode === "login" ? "Entre na sua conta" : mode === "cadastro" ? "Crie sua conta" : "Recuperar senha"}
        </p>

        {mode === "cadastro" && (
          <Field label="Nome de usuário">
            <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como te chamam" autoComplete="username" />
          </Field>
        )}

        <Field label="Email">
          <input style={inputStyle} type="email" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" onKeyDown={(e) => e.key === "Enter" && mode === "esqueci" && submit()} />
        </Field>

        {mode !== "esqueci" && (
          <Field label="Senha">
            <div className="relative">
              <input
                style={inputStyle}
                type={showSenha ? "text" : "password"}
                className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm outline-none"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="mínimo 6 caracteres"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button type="button" onClick={() => setShowSenha((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }}>
                {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
        )}

        {mode === "login" && isOwner && (
          <button onClick={() => { setMode("esqueci"); setErr(""); setInfo(""); }} className="text-xs mb-4 -mt-2 block" style={{ color: T.goldSoft }}>
            Esqueci minha senha
          </button>
        )}

        {mode === "cadastro" && (
          <label className="flex items-start gap-2 mb-4 select-none cursor-pointer">
            <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} className="mt-0.5" />
            <span style={{ color: T.muted }} className="text-xs">
              Li e aceito os{" "}
              <button type="button" onClick={(e) => { e.preventDefault(); setShowTermos(true); }} className="underline" style={{ color: T.goldSoft }}>
                Termos de Uso
              </button>{" "}
              do AGIOPAY
            </span>
          </label>
        )}

        {err && <p style={{ color: T.red }} className="text-xs mb-3 text-center">{err}</p>}
        {info && <p style={{ color: T.green }} className="text-xs mb-3 text-center">{info}</p>}

        <SubmitButton
          valid={valid}
          busy={busy}
          label={mode === "login" ? "Entrar" : mode === "cadastro" ? "Criar conta" : "Enviar link de redefinição"}
          busyLabel="Aguarda…"
          missing={faltando.join(", ")}
          onClick={submit}
        />

        {mode === "esqueci" ? (
          <button onClick={() => { setMode("login"); setErr(""); setInfo(""); }} className="w-full text-center text-xs mt-4" style={{ color: T.goldSoft }}>
            Voltar para o login
          </button>
        ) : isOwner ? (
          <button onClick={() => { setMode(mode === "login" ? "cadastro" : "login"); setErr(""); setInfo(""); }} className="w-full text-center text-xs mt-4" style={{ color: T.goldSoft }}>
            {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
          </button>
        ) : null}

        <button onClick={() => setShowTermos(true)} className="w-full text-center text-[11px] mt-3 flex items-center justify-center gap-1" style={{ color: T.muted }}>
          <FileText size={11} /> Ver Termos de Uso
        </button>
      </div>

      {showTermos && <TermsModal onClose={() => setShowTermos(false)} />}
    </div>
  );
}

function AccountModal({ user, nomeUsuario, isOwner, onClose, onUpdated }) {
  const [nome, setNome] = useState(nomeUsuario || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [busyNome, setBusyNome] = useState(false);
  const [busySenha, setBusySenha] = useState(false);
  const [msgNome, setMsgNome] = useState("");
  const [msgSenha, setMsgSenha] = useState("");
  const [errNome, setErrNome] = useState("");
  const [errSenha, setErrSenha] = useState("");

  const nomeValido = nome.trim().length > 0;

  const senhaFaltando = [];
  if (novaSenha.length < 6) senhaFaltando.push("senha com pelo menos 6 caracteres");
  else if (novaSenha !== confirmSenha) senhaFaltando.push("confirmação igual à nova senha");
  const senhaValida = senhaFaltando.length === 0;

  const salvarNome = async () => {
    if (!nomeValido || busyNome) return;
    setBusyNome(true);
    setErrNome("");
    setMsgNome("");
    const { error } = await supabase.auth.updateUser({ data: { nome: nome.trim() } });
    setBusyNome(false);
    if (error) setErrNome(traduzErro(error.message));
    else {
      setMsgNome("Nome atualizado!");
      onUpdated(nome.trim());
    }
  };

  const salvarSenha = async () => {
    if (!senhaValida || busySenha) return;
    setBusySenha(true);
    setErrSenha("");
    setMsgSenha("");
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setBusySenha(false);
    if (error) setErrSenha(traduzErro(error.message));
    else {
      setMsgSenha("Senha alterada!");
      setNovaSenha("");
      setConfirmSenha("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div onClick={onClose} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />
      <div style={{ background: T.paper }} className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-xl font-semibold flex items-center gap-2">
            <UserCircle size={20} /> Minha conta
          </h2>
          <button onClick={onClose}><X size={20} style={{ color: T.muted }} /></button>
        </div>

        <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1">Email</p>
        <p style={{ color: T.textPaper, fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm mb-5">{user.email}</p>

        <Field label="Nome de usuário">
          <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        {errNome && <p style={{ color: T.red }} className="text-xs mb-2">{errNome}</p>}
        {msgNome && <p style={{ color: T.green }} className="text-xs mb-2">{msgNome}</p>}
        <div className="mb-6">
          <SubmitButton valid={nomeValido} busy={busyNome} label="Salvar nome" busyLabel="Salvando…" missing="nome" onClick={salvarNome} />
        </div>

        {isOwner ? (
          <div style={{ borderTop: `1px solid ${T.line}` }} className="pt-5">
            <p style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="font-medium mb-3">Trocar senha</p>
            <Field label="Nova senha">
              <div className="relative">
                <input
                  style={inputStyle}
                  type={showSenha ? "text" : "password"}
                  className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm outline-none"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                />
                <button type="button" onClick={() => setShowSenha((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }}>
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <Field label="Confirmar nova senha">
              <input style={inputStyle} type={showSenha ? "text" : "password"} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={confirmSenha} onChange={(e) => setConfirmSenha(e.target.value)} placeholder="repita a senha" />
            </Field>
            {errSenha && <p style={{ color: T.red }} className="text-xs mb-2">{errSenha}</p>}
            {msgSenha && <p style={{ color: T.green }} className="text-xs mb-2">{msgSenha}</p>}
            <SubmitButton valid={senhaValida} busy={busySenha} label="Salvar nova senha" busyLabel="Salvando…" missing={senhaFaltando.join(", ")} onClick={salvarSenha} />
          </div>
        ) : (
          <div style={{ borderTop: `1px solid ${T.line}`, color: T.muted }} className="pt-5 text-xs">
            Pra trocar de senha, fale com quem te deu acesso ao AGIOPAY.
          </div>
        )}
      </div>
    </div>
  );
}

function NovaSenhaScreen({ onDone }) {
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const faltando = [];
  if (senha.length < 6) faltando.push("senha com pelo menos 6 caracteres");
  else if (senha !== senha2) faltando.push("confirmação igual à nova senha");
  const valid = faltando.length === 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.updateUser({ password: senha });
    setBusy(false);
    if (error) setErr(traduzErro(error.message));
    else setOk(true);
  };

  return (
    <div style={{ background: T.ink, fontFamily: "'IBM Plex Sans', sans-serif" }} className="min-h-[100dvh] w-full flex items-center justify-center px-4">
      <div style={{ background: T.paper }} className="w-full max-w-sm rounded-3xl p-7">
        <div className="flex justify-center mb-3"><KeyRound size={28} style={{ color: T.goldSoft }} /></div>
        <h1 style={{ fontFamily: "'Fraunces', serif", color: T.textPaper }} className="text-2xl font-semibold text-center mb-1">
          Nova senha
        </h1>

        {ok ? (
          <>
            <p style={{ color: T.green }} className="text-sm text-center mb-5">Senha alterada com sucesso!</p>
            <button onClick={onDone} style={{ background: T.gold, color: T.ink }} className="w-full rounded-full py-3 text-sm font-medium">
              Continuar
            </button>
          </>
        ) : (
          <>
            <p style={{ color: T.muted }} className="text-sm text-center mb-5">Escolha uma senha nova pra sua conta.</p>
            <Field label="Nova senha">
              <div className="relative">
                <input style={inputStyle} type={showSenha ? "text" : "password"} className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm outline-none" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 6 caracteres" />
                <button type="button" onClick={() => setShowSenha((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }}>
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <Field label="Confirmar nova senha">
              <input style={inputStyle} type={showSenha ? "text" : "password"} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={senha2} onChange={(e) => setSenha2(e.target.value)} placeholder="repita a senha" onKeyDown={(e) => e.key === "Enter" && submit()} />
            </Field>
            {err && <p style={{ color: T.red }} className="text-xs mb-3 text-center">{err}</p>}
            <SubmitButton valid={valid} busy={busy} label="Salvar nova senha" busyLabel="Aguarda…" missing={faltando.join(", ")} onClick={submit} />
          </>
        )}
      </div>
    </div>
  );
}

function traduzErro(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou senha incorretos.";
  if (m.includes("user already registered")) return "Já existe uma conta com esse email.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("email not confirmed")) return "Confirme seu email antes de entrar (verifique a caixa de entrada).";
  if (m.includes("same password")) return "A nova senha precisa ser diferente da atual.";
  return msg || "Algo deu errado. Tente de novo.";
}

// ---------------- COMPONENTES GERAIS ----------------

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div style={{ background: T.paper }} className="rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} style={{ color: accent || T.goldSoft }} />
        <span style={{ color: T.muted }} className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div style={{ color: T.textPaper, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xl font-medium tabular-nums">{value}</div>
    </div>
  );
}

function buildEvolucaoMensal(clients) {
  const pagamentos = [];
  clients.forEach((c) => (c.emprestimos || []).forEach((l) => (l.pagamentos || []).forEach((p) => pagamentos.push(p))));
  if (pagamentos.length === 0) return [];
  pagamentos.sort((a, b) => new Date(a.data) - new Date(b.data));
  const porMes = {};
  pagamentos.forEach((p) => { const mes = p.data.slice(0, 7); porMes[mes] = (porMes[mes] || 0) + p.valor; });
  let acumulado = 0;
  return Object.keys(porMes).sort().map((mes) => {
    acumulado += porMes[mes];
    const [ano, m] = mes.split("-");
    const label = new Date(ano, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" });
    return { mes: label, recebido: Math.round(acumulado * 100) / 100 };
  });
}

function Dashboard({ totals, count, atrasadosList, evolucao, onVerClientes, onAddClient, nomeUsuario }) {
  const donutData = [
    { name: "Já recebido", value: totals.jaPago, color: T.green },
    { name: "Em aberto", value: totals.aReceber, color: T.red },
  ].filter((d) => d.value > 0);

  if (count === 0) {
    return <DashboardOnboarding nomeUsuario={nomeUsuario} onAddClient={onAddClient} />;
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatCard icon={Wallet} label="Emprestado" value={fmt(totals.emprestado)} />
        <StatCard icon={TrendingUp} label="A receber" value={fmt(totals.aReceber)} accent={T.green} />
        <StatCard icon={Check} label="Já recebido" value={fmt(totals.jaPago)} accent={T.greenSoft} />
        <StatCard icon={Users} label="Clientes" value={String(count)} />
      </div>

      <div style={{ background: totals.atrasados > 0 ? T.red : T.green, color: T.textInk }} className="rounded-2xl p-4 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {totals.atrasados > 0 ? <AlertTriangle size={16} /> : <TrendingDown size={16} />}
          <span className="text-sm font-medium">
            {totals.atrasados === 0
              ? totals.negativos === 0 ? "Ninguém em aberto agora" : `${totals.negativos} cliente${totals.negativos > 1 ? "s" : ""} em aberto, nenhum atrasado`
              : `${totals.atrasados} cliente${totals.atrasados > 1 ? "s" : ""} atrasado${totals.atrasados > 1 ? "s" : ""}`}
          </span>
        </div>
        <button onClick={onVerClientes} className="text-xs underline opacity-90">ver todos</button>
      </div>

      {atrasadosList.length > 0 && (
        <div style={{ background: T.paper }} className="rounded-2xl p-4 mb-3">
          <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-2.5">Mais atrasados</p>
          <div className="space-y-2">
            {atrasadosList.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }}>{c.nome}</span>
                <span style={{ color: T.red, fontFamily: "'IBM Plex Mono', monospace" }} className="font-medium">{c.calc.diasAtraso}d de atraso</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {donutData.length > 0 && (
          <div style={{ background: T.paper }} className="rounded-2xl p-4">
            <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1">Recebido x em aberto</p>
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={32} outerRadius={52} paddingAngle={3}>
                    {donutData.map((d, i) => (<Cell key={i} fill={d.color} stroke="none" />))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-3 -mt-2">
              {donutData.map((d, i) => (
                <span key={i} style={{ color: T.muted }} className="text-[11px] flex items-center gap-1">
                  <span style={{ background: d.color, width: 6, height: 6, borderRadius: 999, display: "inline-block" }} />
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {evolucao.length > 0 ? <EvolucaoChartWithData data={evolucao} /> : <EvolucaoChart />}
      </div>

      <p style={{ color: T.muted, fontFamily: "'IBM Plex Sans', sans-serif" }} className="text-xs text-center mt-2">
        Os juros correm sozinhos aqui — nada de fazer conta de cabeça.
      </p>
    </div>
  );
}

function DashboardOnboarding({ nomeUsuario, onAddClient }) {
  const dicas = [
    { icon: Users, texto: "Cada cliente pode ter vários empréstimos ao longo do tempo — tudo fica junto no dossiê dele." },
    { icon: Calendar, texto: "A aba Agenda mostra sozinha quem vence e quem já atrasou, sem você ter que ficar de olho no caderno." },
    { icon: FileDown, texto: "Quando precisar, exporta um PDF ou CSV completo — de um cliente só ou de todos de uma vez." },
  ];

  return (
    <div style={{ background: T.paper }} className="rounded-2xl p-6 sm:p-10 text-center">
      <div
        style={{ background: T.paperSoft, border: `1px solid ${T.line}` }}
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
      >
        <Wallet size={24} style={{ color: T.goldSoft }} />
      </div>

      <h2 style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-xl sm:text-2xl font-semibold mb-1.5">
        {nomeUsuario ? `Bem-vindo, ${nomeUsuario}!` : "Bem-vindo ao AGIOPAY!"}
      </h2>
      <p style={{ color: T.muted }} className="text-sm mb-6 max-w-sm mx-auto">
        Seu livro-caixa está vazio por enquanto. Cadastre o primeiro cliente pra começar a ver os juros, vencimentos e recebimentos organizados sozinhos.
      </p>

      <button
        onClick={onAddClient}
        style={{ background: T.gold, color: T.ink }}
        className="inline-flex items-center gap-1.5 rounded-full px-5 py-3 text-sm font-medium active:scale-95 transition-transform mb-8"
      >
        <Plus size={16} strokeWidth={2.5} />
        Cadastrar primeiro cliente
      </button>

      <div style={{ borderTop: `1px solid ${T.line}` }} className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
        {dicas.map((d, i) => (
          <div key={i} className="flex gap-2.5">
            <d.icon size={16} style={{ color: T.goldSoft }} className="shrink-0 mt-0.5" />
            <p style={{ color: T.textPaper }} className="text-xs leading-relaxed">{d.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvolucaoChart() {
  return (
    <div style={{ background: T.paper }} className="rounded-2xl p-4">
      <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1">Evolução do recebido</p>
      <p style={{ color: T.textPaper, fontFamily: "'IBM Plex Mono', monospace" }} className="text-[11px] leading-snug mt-6 text-center opacity-70">
        Aparece assim que você registrar pagamentos ao longo dos meses.
      </p>
    </div>
  );
}

function EvolucaoChartWithData({ data }) {
  return (
    <div style={{ background: T.paper }} className="rounded-2xl p-4">
      <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1">Evolução do recebido</p>
      <div style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={T.line} vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: T.muted }} axisLine={{ stroke: T.line }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12 }} />
            <Line type="monotone" dataKey="recebido" stroke={T.green} strokeWidth={2} dot={{ r: 3, fill: T.green }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LedgerRow({ client, onClick }) {
  const { calc } = client;
  const positivo = calc.status === "positivo";
  return (
    <button
      onClick={onClick}
      style={{ background: T.paper }}
      className="w-full flex items-center justify-between rounded-2xl px-4 py-3.5 text-left active:opacity-70 transition-opacity"
    >
      <div className="min-w-0">
        <div style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="font-medium truncate flex items-center gap-1.5">
          {client.nome}
          {calc.atrasado && <AlertTriangle size={12} style={{ color: T.red }} />}
        </div>
        <div style={{ color: T.muted, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs mt-0.5">
          {calc.emprestimos.length} empréstimo{calc.emprestimos.length !== 1 ? "s" : ""}
          {calc.atrasado ? ` · ${calc.diasAtraso}d de atraso` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pl-3">
        <div className="text-right">
          <div style={{ color: positivo ? T.green : T.red, fontFamily: "'IBM Plex Mono', monospace" }} className="text-sm font-semibold tabular-nums">
            {positivo ? "quitado" : fmt(calc.saldo)}
          </div>
          <div style={{ color: T.muted }} className="text-[11px]">{positivo ? "em dia" : calc.atrasado ? "atrasado" : "em aberto"}</div>
        </div>
        <ChevronRight size={16} style={{ color: T.muted }} />
      </div>
    </button>
  );
}

function EmptyState({ onAdd, hasSearch }) {
  return (
    <div style={{ background: T.paper }} className="rounded-2xl p-8 text-center">
      <p style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-lg mb-1">{hasSearch ? "Ninguém com esse nome" : "Nenhum cliente ainda"}</p>
      <p style={{ color: T.muted }} className="text-sm mb-4">{hasSearch ? "Tenta buscar outro nome." : "Cadastre o primeiro empréstimo pra começar."}</p>
      {!hasSearch && (
        <button onClick={onAdd} style={{ background: T.gold, color: T.ink }} className="rounded-full px-5 py-2 text-sm font-medium">Adicionar cliente</button>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3.5">
      <span style={{ color: T.muted, fontFamily: "'IBM Plex Sans', sans-serif" }} className="text-xs uppercase tracking-wide block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputStyle = { background: T.paperSoft, color: T.textPaper, fontFamily: "'IBM Plex Mono', monospace", border: `1px solid ${T.line}` };

// botão de ação principal que muda de cor conforme o formulário está
// pronto ou não pra enviar, e explica o que falta preencher
function SubmitButton({ valid, busy, label, busyLabel, missing, onClick, className = "" }) {
  return (
    <div>
      <button
        disabled={!valid || busy}
        onClick={onClick}
        style={{
          background: busy ? T.line : valid ? T.green : T.line,
          color: valid && !busy ? T.textInk : T.muted,
        }}
        className={`w-full rounded-full py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed ${className}`}
      >
        {busy ? (busyLabel || "Aguarda…") : label}
      </button>
      {!valid && !busy && missing && (
        <p style={{ color: T.red }} className="text-xs text-center mt-2">
          Falta: {missing}
        </p>
      )}
    </div>
  );
}

// campo numérico que só aceita dígitos e (opcionalmente) um ponto decimal —
// bloqueia letras de verdade, em vez de confiar só no type="number" do navegador
function DecimalField({ value, onChange, placeholder, className = "" }) {
  const handleChange = (e) => {
    let v = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
    const partes = v.split(".");
    if (partes.length > 2) v = partes[0] + "." + partes.slice(1).join("");
    onChange(v);
  };
  return (
    <input
      style={inputStyle}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={`w-full rounded-lg px-3 py-2.5 text-sm outline-none ${className}`}
      value={value}
      onChange={handleChange}
    />
  );
}

function IntegerField({ value, onChange, placeholder, className = "" }) {
  const handleChange = (e) => onChange(e.target.value.replace(/[^0-9]/g, ""));
  return (
    <input
      style={inputStyle}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      className={`w-full rounded-lg px-3 py-2.5 text-sm outline-none ${className}`}
      value={value}
      onChange={handleChange}
    />
  );
}

// telefone celular brasileiro: DDD (2 dígitos) + 9 + 8 dígitos = 11 no total,
// formata sozinho enquanto digita e não deixa passar de 11 números
function PhoneField({ value, onChange, className = "" }) {
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
    let out = "";
    if (digits.length > 0) out = "(" + digits.slice(0, 2);
    if (digits.length >= 2) out += ") ";
    if (digits.length > 2) out += digits.slice(2, 7);
    if (digits.length > 7) out += "-" + digits.slice(7, 11);
    onChange(out);
  };
  return (
    <input
      style={inputStyle}
      type="text"
      inputMode="numeric"
      placeholder="(00) 90000-0000"
      className={`w-full rounded-lg px-3 py-2.5 text-sm outline-none ${className}`}
      value={value}
      onChange={handleChange}
    />
  );
}


// campo de data no formato dia/mês/ano, sempre — independente da
// configuração regional do navegador (o <input type="date"> nativo
// varia o formato mostrado conforme o idioma do sistema do usuário)
function DateField({ value, onChange }) {
  const isoToBr = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  const [text, setText] = useState(isoToBr(value));

  useEffect(() => {
    setText(isoToBr(value));
  }, [value]);

  const handleChange = (e) => {
    let digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);

    if (digits.length === 8) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const y = digits.slice(4, 8);
      const iso = `${y}-${m}-${d}`;
      const check = new Date(iso + "T00:00:00");
      const valido = !isNaN(check) && check.getDate() === parseInt(d, 10) && check.getMonth() + 1 === parseInt(m, 10);
      if (valido) onChange(iso);
    }
  };

  return (
    <input
      style={inputStyle}
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
      value={text}
      onChange={handleChange}
    />
  );
}


// formulário de cadastro: cliente + primeiro empréstimo juntos
// chips de combinações de taxa/prazo salvas, pra não digitar toda vez
function PresetChips({ presets, onPick, onSave, onRemove, podeSalvar }) {
  return (
    <div className="mb-3.5">
      <span style={{ color: T.muted, fontFamily: "'IBM Plex Sans', sans-serif" }} className="text-xs uppercase tracking-wide block mb-1.5">
        Modelos salvos
      </span>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p, i) => (
          <div
            key={i}
            style={{ background: T.paperSoft, border: `1px solid ${T.line}` }}
            className="flex items-center gap-1 rounded-full pl-3 pr-1.5 py-1"
          >
            <button onClick={() => onPick(p)} style={{ color: T.textPaper, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs">
              {p.taxaJuros}% / {p.prazoDias}d
            </button>
            <button onClick={() => onRemove(i)} style={{ color: T.muted }} title="Remover modelo">
              <X size={11} />
            </button>
          </div>
        ))}
        {presets.length < 6 && (
          <button
            onClick={onSave}
            disabled={!podeSalvar}
            style={{ background: "transparent", border: `1px dashed ${T.line}`, color: T.goldSoft }}
            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs disabled:opacity-40"
          >
            <Plus size={11} /> salvar atual
          </button>
        )}
      </div>
    </div>
  );
}

function ClientLoanForm({ title, initial, onClose, onSave, presets = [], onSavePreset, onRemovePreset }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const faltando = [];
  if (!form.nome.trim()) faltando.push("nome");
  if (!(parseFloat(form.valor) > 0)) faltando.push("valor emprestado");
  if (!(parseFloat(form.taxaJuros) >= 0)) faltando.push("juros");
  if (!(parseInt(form.prazoDias || "0", 10) > 0)) faltando.push("prazo");
  if (!form.dataEmprestimo) faltando.push("data do empréstimo");
  const valid = faltando.length === 0;

  const preview = useMemo(() => {
    const valor = parseFloat(form.valor);
    const taxa = parseFloat(form.taxaJuros);
    if (!valor || !taxa || !form.dataEmprestimo) return null;
    const prazoDias = parseInt(form.prazoDias || "30", 10) || 30;
    const inicio = new Date(form.dataEmprestimo + "T00:00:00");
    const hoje = new Date();
    const diasDecorridos = Math.max(0, diasEntre(inicio, hoje));
    const periodos = Math.max(1, Math.ceil(diasDecorridos / prazoDias || 1));
    const juros = valor * (taxa / 100) * periodos;
    return { periodos, prazoDias, juros, total: valor + juros };
  }, [form.valor, form.taxaJuros, form.dataEmprestimo, form.prazoDias]);

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div onClick={onClose} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />
      <div style={{ background: T.paper }} className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose}><X size={20} style={{ color: T.muted }} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Field label="Nome">
            <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do cliente" />
          </Field>
          <Field label="Telefone (opcional)">
            <PhoneField value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Field label="Valor emprestado">
            <DecimalField value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} placeholder="0,00" />
          </Field>
          <Field label="Juros % a.m.">
            <DecimalField value={form.taxaJuros} onChange={(v) => setForm({ ...form, taxaJuros: v })} placeholder="30" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Field label="Data do empréstimo">
            <DateField value={form.dataEmprestimo} onChange={(iso) => setForm({ ...form, dataEmprestimo: iso })} />
          </Field>
          <Field label="Prazo (dias)">
            <IntegerField value={form.prazoDias} onChange={(v) => setForm({ ...form, prazoDias: v })} placeholder="30" />
          </Field>
        </div>

        <PresetChips
          presets={presets}
          onPick={(p) => setForm({ ...form, taxaJuros: String(p.taxaJuros), prazoDias: String(p.prazoDias) })}
          onSave={() => onSavePreset(parseFloat(form.taxaJuros), parseInt(form.prazoDias || "0", 10))}
          onRemove={onRemovePreset}
          podeSalvar={parseFloat(form.taxaJuros) >= 0 && parseInt(form.prazoDias || "0", 10) > 0}
        />

        <Field label="Deixou alguma garantia? (opcional)">
          <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={form.garantia} onChange={(e) => setForm({ ...form, garantia: e.target.value })} placeholder="Ex: moto, TV, nenhuma" />
        </Field>

        <Field label="Observações (opcional)">
          <textarea style={inputStyle} rows={3} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none" value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Ex: prometeu pagar dia 5…" />
        </Field>

        {preview && (
          <div style={{ background: T.paperSoft, border: `1px solid ${T.line}` }} className="rounded-xl p-3 mb-4 space-y-1.5">
            <Row label={`Juros (${preview.periodos} período${preview.periodos > 1 ? "s" : ""} de ${preview.prazoDias}d)`} value={fmt(preview.juros)} color={T.greenSoft} />
            <Row label="Total devido hoje" value={fmt(preview.total)} bold />
          </div>
        )}

        <SubmitButton valid={valid} busy={saving} label="Salvar" busyLabel="Salvando…" missing={faltando.join(", ")} onClick={handleSave} className="mt-2" />
      </div>
    </div>
  );
}

// formulário de um empréstimo isolado (novo ou edição, dentro do dossiê)
function LoanForm({ title, initial, onClose, onSave, presets = [], onSavePreset, onRemovePreset }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const faltando = [];
  if (!(parseFloat(form.valor) > 0)) faltando.push("valor emprestado");
  if (!(parseFloat(form.taxaJuros) >= 0)) faltando.push("juros");
  if (!(parseInt(form.prazoDias || "0", 10) > 0)) faltando.push("prazo");
  if (!form.dataEmprestimo) faltando.push("data do empréstimo");
  const valid = faltando.length === 0;

  const preview = useMemo(() => {
    const valor = parseFloat(form.valor);
    const taxa = parseFloat(form.taxaJuros);
    if (!valor || !taxa || !form.dataEmprestimo) return null;
    const prazoDias = parseInt(form.prazoDias || "30", 10) || 30;
    const inicio = new Date(form.dataEmprestimo + "T00:00:00");
    const hoje = new Date();
    const diasDecorridos = Math.max(0, diasEntre(inicio, hoje));
    const periodos = Math.max(1, Math.ceil(diasDecorridos / prazoDias || 1));
    const juros = valor * (taxa / 100) * periodos;
    return { periodos, prazoDias, juros, total: valor + juros };
  }, [form.valor, form.taxaJuros, form.dataEmprestimo, form.prazoDias]);

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div onClick={onClose} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />
      <div style={{ background: T.paper }} className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose}><X size={20} style={{ color: T.muted }} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Field label="Valor emprestado">
            <DecimalField value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} placeholder="0,00" />
          </Field>
          <Field label="Juros % a.m.">
            <DecimalField value={form.taxaJuros} onChange={(v) => setForm({ ...form, taxaJuros: v })} placeholder="30" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          <Field label="Data do empréstimo">
            <DateField value={form.dataEmprestimo} onChange={(iso) => setForm({ ...form, dataEmprestimo: iso })} />
          </Field>
          <Field label="Prazo (dias)">
            <IntegerField value={form.prazoDias} onChange={(v) => setForm({ ...form, prazoDias: v })} placeholder="30" />
          </Field>
        </div>

        <PresetChips
          presets={presets}
          onPick={(p) => setForm({ ...form, taxaJuros: String(p.taxaJuros), prazoDias: String(p.prazoDias) })}
          onSave={() => onSavePreset(parseFloat(form.taxaJuros), parseInt(form.prazoDias || "0", 10))}
          onRemove={onRemovePreset}
          podeSalvar={parseFloat(form.taxaJuros) >= 0 && parseInt(form.prazoDias || "0", 10) > 0}
        />

        <Field label="Deixou alguma garantia? (opcional)">
          <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={form.garantia} onChange={(e) => setForm({ ...form, garantia: e.target.value })} placeholder="Ex: moto, TV, nenhuma" />
        </Field>

        {preview && (
          <div style={{ background: T.paperSoft, border: `1px solid ${T.line}` }} className="rounded-xl p-3 mb-4 space-y-1.5">
            <Row label={`Juros (${preview.periodos} período${preview.periodos > 1 ? "s" : ""} de ${preview.prazoDias}d)`} value={fmt(preview.juros)} color={T.greenSoft} />
            <Row label="Total devido hoje" value={fmt(preview.total)} bold />
          </div>
        )}

        <SubmitButton valid={valid} busy={saving} label="Salvar" busyLabel="Salvando…" missing={faltando.join(", ")} onClick={handleSave} className="mt-2" />
      </div>
    </div>
  );
}

function EditClientForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const valid = form.nome.trim().length > 0;
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div onClick={onClose} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />
      <div style={{ background: T.paper }} className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: T.textPaper, fontFamily: "'Fraunces', serif" }} className="text-xl font-semibold">Editar cliente</h2>
          <button onClick={onClose}><X size={20} style={{ color: T.muted }} /></button>
        </div>
        <Field label="Nome">
          <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </Field>
        <Field label="Telefone (opcional)">
          <PhoneField value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
        </Field>
        <Field label="Observações (opcional)">
          <textarea style={inputStyle} rows={3} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none" value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </Field>
        <SubmitButton valid={valid} busy={saving} label="Salvar" busyLabel="Salvando…" missing="nome" onClick={handleSave} className="mt-2" />
      </div>
    </div>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: T.muted, fontFamily: "'IBM Plex Sans', sans-serif" }}>{label}</span>
      <span style={{ color: color || T.textPaper, fontFamily: "'IBM Plex Mono', monospace", fontWeight: bold ? 600 : 400 }} className="tabular-nums">{value}</span>
    </div>
  );
}

// ---------------- RELATÓRIO / EXPORTAÇÃO EM PDF ----------------

function ReportClientBlock({ client }) {
  const { calc } = client;
  const positivo = calc.status === "positivo";
  return (
    <div style={{ pageBreakInside: "avoid", marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "2px solid #14231C", paddingBottom: 6, marginBottom: 10 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, margin: 0, color: "#14231C" }}>{client.nome}</h2>
        <span style={{ fontSize: 11, color: "#5c5540" }}>
          {positivo ? "TUDO QUITADO" : `SALDO ${fmt(calc.saldo)}${calc.atrasado ? ` · ${calc.diasAtraso}d atraso` : ""}`}
        </span>
      </div>
      {client.telefone && <p style={{ fontSize: 11, color: "#5c5540", margin: "0 0 4px" }}>{client.telefone}</p>}
      {client.observacoes && (
        <div style={{ background: "#F1EAD6", borderRadius: 6, padding: "6px 10px", margin: "6px 0 10px" }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "#5c5540", margin: "0 0 2px", textTransform: "uppercase" }}>Observações</p>
          <p style={{ fontSize: 11, margin: 0, whiteSpace: "pre-wrap" }}>{client.observacoes}</p>
        </div>
      )}

      {calc.emprestimos.map((l, idx) => {
        const lp = l.calc.status === "positivo";
        return (
          <div key={l.id} style={{ marginTop: idx > 0 ? 14 : 6, marginBottom: 8, pageBreakInside: "avoid" }}>
            <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 4px" }}>
              Empréstimo de {new Date(l.dataEmprestimo + "T00:00:00").toLocaleDateString("pt-BR")} — {lp ? "quitado" : "em aberto"}
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 6 }}>
              <tbody>
                <ReportRow label="Valor emprestado" value={fmt(l.valor)} />
                <ReportRow label={`Juros (${l.taxaJuros}% a cada ${l.calc.prazoDias}d)`} value={`${l.calc.periodos} período${l.calc.periodos > 1 ? "s" : ""} — ${fmt(l.calc.juros)}`} />
                <ReportRow label="Total devido" value={fmt(l.calc.totalDevido)} bold />
                <ReportRow label="Total pago" value={fmt(l.calc.totalPago)} />
                <ReportRow label="Saldo em aberto" value={lp ? "R$ 0,00" : fmt(l.calc.saldo)} bold />
                {l.garantia && <ReportRow label="Garantia" value={l.garantia} />}
              </tbody>
            </table>
            {l.pagamentos.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #C8BA96", padding: "2px 0", fontWeight: 600 }}>Pagamento</th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #C8BA96", padding: "2px 0", fontWeight: 600 }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {l.pagamentos.map((p, i) => (
                    <tr key={i}>
                      <td style={{ padding: "2px 0", borderBottom: "1px solid #ECE5D0" }}>{new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td style={{ padding: "2px 0", borderBottom: "1px solid #ECE5D0", textAlign: "right" }}>{fmt(p.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReportRow({ label, value, bold }) {
  return (
    <tr>
      <td style={{ padding: "3px 0", color: "#5c5540" }}>{label}</td>
      <td style={{ padding: "3px 0", textAlign: "right", fontWeight: bold ? 700 : 400 }}>{value}</td>
    </tr>
  );
}

function PrintReport({ mode, allClients, userNome, onClose }) {
  const isTodos = mode.type === "todos";
  const lista = isTodos ? allClients : allClients.filter((c) => c.id === mode.client.id);

  const totalEmprestado = lista.reduce((s, c) => s + c.calc.totalEmprestado, 0);
  const totalReceber = lista.reduce((s, c) => s + c.calc.saldo, 0);
  const totalRecebido = lista.reduce((s, c) => s + c.calc.totalPago, 0);

  return (
    <div style={{ background: "#fff", minHeight: "100dvh", fontFamily: "'IBM Plex Sans', sans-serif", color: "#14231C" }}>
      <div className="no-print" style={{ position: "sticky", top: 0, background: "#14231C", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
        <span style={{ color: "#EDE4CC", fontSize: 13 }}>Pré-visualização do PDF — use Cmd/Ctrl+P se a impressão não abrir sozinha</span>
        <button onClick={onClose} style={{ background: "#BE9552", color: "#14231C", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 500 }}>Voltar</button>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "3px solid #14231C", paddingBottom: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, margin: 0 }}>AGIOPAY</h1>
            <p style={{ fontSize: 12, color: "#5c5540", margin: "4px 0 0" }}>
              {isTodos ? "Relatório geral de clientes" : `Dossiê completo — ${mode.client.nome}`}
            </p>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#5c5540" }}>
            <div>{userNome}</div>
            <div>{new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        </div>

        {isTodos && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
            <SummaryBox label="Clientes" value={String(lista.length)} />
            <SummaryBox label="Emprestado" value={fmt(totalEmprestado)} />
            <SummaryBox label="A receber" value={fmt(totalReceber)} />
            <SummaryBox label="Já recebido" value={fmt(totalRecebido)} />
          </div>
        )}

        {lista.length === 0 ? (
          <p style={{ fontSize: 13, color: "#8A7F63" }}>Nenhum cliente cadastrado ainda.</p>
        ) : (
          lista.map((c) => <ReportClientBlock key={c.id} client={c} />)
        )}

        <p style={{ fontSize: 10, color: "#8A7F63", marginTop: 24, borderTop: "1px solid #C8BA96", paddingTop: 10 }}>
          Gerado automaticamente pelo AGIOPAY. Documento de controle interno, sem valor fiscal.
        </p>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 16mm; }
        }
      `}</style>
    </div>
  );
}

function SummaryBox({ label, value }) {
  return (
    <div style={{ border: "1px solid #C8BA96", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", color: "#8A7F63", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
