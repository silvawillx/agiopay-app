import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus, X, TrendingUp, TrendingDown, Users, Wallet, Search, ChevronRight,
  Trash2, Check, Pencil, AlertTriangle, LogOut, Eye, EyeOff, FileDown, Sheet,
  ArrowLeft, Calendar, ShieldCheck, KeyRound, FileText, ChevronDown, ChevronUp, UserCircle, Upload, Bell,
  CheckCheck, CalendarClock, Undo2, Sun, WifiOff, RefreshCw, HardDriveDownload, LayoutDashboard,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
import { supabase } from "./supabaseClient";

// ---- design tokens ----
// Os nomes vêm da versão antiga (ink = fundo, paper = cartão, gold = destaque);
// os valores agora são da paleta nova: fundo claro (lê bem no sol, na rua),
// verde-petróleo como cor da marca e verde/vermelho/âmbar só para status.
const T = {
  ink: "#F2F5F3",        // fundo do app
  inkSoft: "#E4EAE7",    // trilhos e preenchimentos sobre o fundo
  paper: "#FFFFFF",      // cartões e modais
  paperSoft: "#F5F8F6",  // campos e blocos dentro de cartões
  line: "#DDE5E1",       // bordas
  textPaper: "#0F1B16",  // texto principal
  textInk: "#0F1B16",
  gold: "#0F766E",       // cor da marca: botões principais, aba ativa
  goldSoft: "#0B5E58",   // links e ícones da marca
  goldTint: "#E3F2F0",   // fundo de item selecionado
  red: "#C8372D",
  redSoft: "#E0796F",
  redTint: "#FBEAE8",
  green: "#15803D",
  greenSoft: "#15803D",
  greenTint: "#E5F4EA",
  amber: "#B45309",
  amberTint: "#FDF2E2",
  muted: "#5E6B66",
  onColor: "#FFFFFF",    // texto sobre botões coloridos
  shadow: "0 1px 2px rgba(15,27,22,0.04), 0 2px 8px rgba(15,27,22,0.05)",
  // menu lateral (desktop)
  nav: "#0C1D18",
  navSoft: "#16302A",
  navText: "#E3EEEA",
  navMuted: "#8FA79E",
  navAccent: "#5EEAD4",
};
const CARD = { background: T.paper, border: `1px solid ${T.line}`, boxShadow: T.shadow };
const OVERLAY = { background: "rgba(12,29,24,0.45)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" };
const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', sans-serif";

// abas do app (menu lateral no desktop, barra de baixo no celular)
const NAV = [
  ["hoje", "Hoje", Sun],
  ["caixa", "Caixa", Wallet],
  ["dashboard", "Resumo", LayoutDashboard],
  ["clientes", "Clientes", Users],
  ["agenda", "Agenda", CalendarClock],
];

function Logo({ escuro = false, grande = false }) {
  const s = grande ? 44 : 34;
  return (
    <div className="flex items-center gap-2.5">
      <span
        style={{ width: s, height: s, background: `linear-gradient(135deg, #14B8A6, ${T.gold})`, color: T.onColor, fontFamily: FONT_DISPLAY, boxShadow: "0 4px 12px rgba(15,118,110,0.25)" }}
        className={`flex items-center justify-center rounded-xl font-extrabold ${grande ? "text-xl" : "text-base"}`}
      >
        A
      </span>
      <span style={{ fontFamily: FONT_DISPLAY, color: escuro ? T.navText : T.textInk, letterSpacing: "-0.02em" }} className={`font-extrabold ${grande ? "text-2xl" : "text-lg"}`}>
        AGIO<span style={{ color: escuro ? T.navAccent : T.gold }}>PAY</span>
      </span>
    </div>
  );
}

function Avatar({ nome = "", claro = false }) {
  const iniciais = nome.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
  return (
    <span
      style={{ background: claro ? T.goldTint : T.navSoft, color: claro ? T.goldSoft : T.navAccent, fontFamily: FONT_DISPLAY }}
      className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm font-bold"
    >
      {iniciais}
    </span>
  );
}

const fmt = (n) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


// ---- datas sempre no horário LOCAL (toISOString usa UTC e, no Brasil,
// depois das 21h já "vira" o dia seguinte) ----
const pad2 = (n) => String(n).padStart(2, "0");
function isoLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function hojeISO() {
  return isoLocal(new Date());
}
function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDias(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}
function diasEntreISO(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const fmtData = (iso) => parseISO(iso).toLocaleDateString("pt-BR");
const fmtDataCurta = (iso) => {
  const d = parseISO(iso);
  return `${DIAS_SEMANA[d.getDay()]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};

// ---- feriados nacionais (fixos + os que dependem da Páscoa) ----
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${pad2(mes)}-${pad2(dia)}`;
}
const feriadosCache = {};
function feriadosDoAno(ano) {
  if (feriadosCache[ano]) return feriadosCache[ano];
  const p = pascoa(ano);
  const f = {
    [`${ano}-01-01`]: "Confraternização Universal",
    [addDias(p, -48)]: "Carnaval",
    [addDias(p, -47)]: "Carnaval",
    [addDias(p, -2)]: "Sexta-feira Santa",
    [`${ano}-04-21`]: "Tiradentes",
    [`${ano}-05-01`]: "Dia do Trabalho",
    [addDias(p, 60)]: "Corpus Christi",
    [`${ano}-09-07`]: "Independência",
    [`${ano}-10-12`]: "N. Sra. Aparecida",
    [`${ano}-11-02`]: "Finados",
    [`${ano}-11-15`]: "Proclamação da República",
    [`${ano}-11-20`]: "Consciência Negra",
    [`${ano}-12-25`]: "Natal",
  };
  feriadosCache[ano] = f;
  return f;
}
function nomeFeriado(iso) {
  return feriadosDoAno(Number(iso.slice(0, 4)))[iso] || null;
}

// gera as próximas `n` datas de cobrança a partir de `inicio` (inclusive),
// só nos dias da semana marcados, pulando feriados nacionais se pedido
function gerarDatasCobranca(inicio, n, dias, pularFeriados, excluir = new Set()) {
  const datas = [];
  const puladas = [];
  if (!inicio || !(n > 0) || !dias?.length) return { datas, puladas };
  let d = inicio;
  for (let guard = 0; datas.length < n && guard < 4000; guard++) {
    const wd = parseISO(d).getDay();
    if (dias.includes(wd) && !excluir.has(d)) {
      const fer = pularFeriados ? nomeFeriado(d) : null;
      if (fer) puladas.push({ data: d, nome: fer });
      else datas.push(d);
    }
    d = addDias(d, 1);
  }
  return { datas, puladas };
}

function primeiraCobrancaApos(dataEmprestimo, dias, pularFeriados) {
  if (!dataEmprestimo) return "";
  return gerarDatasCobranca(addDias(dataEmprestimo, 1), 1, dias, pularFeriados).datas[0] || "";
}

// empréstimo parcelado: o saldo é a soma das parcelas menos o que já foi pago;
// cada baixa (pagamento) aponta pra parcela que ela pagou
function calcularEmprestimoParcelado(l) {
  const hoje = hojeISO();
  const pagoPorParcela = {};
  (l.pagamentos || []).forEach((p) => {
    if (p.parcelaId) pagoPorParcela[p.parcelaId] = (pagoPorParcela[p.parcelaId] || 0) + p.valor;
  });
  const parcelas = (l.parcelas || []).map((p, idx) => {
    const pago = pagoPorParcela[p.id] || 0;
    const restante = Math.max(0, p.valor - pago);
    const quitada = restante <= 0.01;
    const pagamentos = (l.pagamentos || []).filter((pg) => pg.parcelaId === p.id);
    return {
      ...p,
      numero: idx + 1,
      pago,
      restante,
      quitada,
      pagamentos,
      atrasada: !quitada && p.vencimento < hoje,
      ehHoje: p.vencimento === hoje,
    };
  });
  const totalDevido = parcelas.reduce((s, p) => s + p.valor, 0);
  const totalPago = (l.pagamentos || []).reduce((s, p) => s + p.valor, 0);
  const saldo = Math.max(0, totalDevido - totalPago);
  const status = saldo <= 0.01 ? "positivo" : "negativo";
  const abertas = parcelas.filter((p) => !p.quitada);
  const atrasadas = parcelas.filter((p) => p.atrasada);
  const diasAtraso = atrasadas.length ? diasEntreISO(atrasadas[0].vencimento, hoje) : 0;
  const proxima = abertas[0] || parcelas[parcelas.length - 1];
  const vencimento = proxima ? parseISO(proxima.vencimento) : parseISO(l.dataEmprestimo);
  return {
    parcelado: true,
    parcelas,
    abertas,
    atrasadas,
    pagas: parcelas.length - abertas.length,
    periodos: 1,
    prazoDias: l.prazoDias,
    juros: Math.max(0, totalDevido - l.valor),
    totalDevido,
    totalPago,
    saldo,
    status,
    vencimento,
    diasAtraso,
    atrasado: status === "negativo" && atrasadas.length > 0,
  };
}

function calcularEmprestimo(l) {
  if (l.parcelado) return calcularEmprestimoParcelado(l);
  const hoje = hojeISO();
  const prazoDias = l.prazoDias || 30;
  const taxa = (l.taxaJuros || 0) / 100;
  // quantos períodos de juros já correram até a data `ate`, contando dias
  // inteiros de calendário: o dia do vencimento ainda é do período 1, o
  // período 2 começa no dia seguinte
  const periodosAte = (ate) => Math.max(1, Math.ceil(Math.max(0, diasEntreISO(l.dataEmprestimo, ate)) / prazoDias));
  const devidoAte = (ate) => l.valor * (1 + taxa * periodosAte(ate));

  // os juros param de correr no dia em que o empréstimo foi quitado: sem isso,
  // um empréstimo pago voltava a ficar "em aberto" quando virava o período
  const pagamentos = [...(l.pagamentos || [])].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  let acumulado = 0;
  let quitadoEm = null;
  for (const p of pagamentos) {
    acumulado += p.valor;
    if (acumulado >= devidoAte(p.data) - 0.01) {
      quitadoEm = p.data;
      break;
    }
  }

  const periodos = periodosAte(quitadoEm || hoje);
  const juros = l.valor * taxa * periodos;
  const totalDevido = l.valor + juros;
  const totalPago = pagamentos.reduce((s, p) => s + p.valor, 0);
  const saldo = Math.max(0, totalDevido - totalPago);
  const status = saldo <= 0.01 ? "positivo" : "negativo";

  const vencimentoISO = addDias(l.dataEmprestimo, prazoDias);
  const vencimento = parseISO(vencimentoISO);
  const diasAtraso = diasEntreISO(vencimentoISO, hoje);
  const atrasado = status === "negativo" && diasAtraso > 0;

  return { periodos, prazoDias, juros, totalDevido, totalPago, saldo, status, vencimento, diasAtraso, atrasado, quitadoEm };
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

const DIAS_SEG_SAB = [1, 2, 3, 4, 5, 6];

function novoEmprestimoForm() {
  const hoje = hojeISO();
  return {
    tipo: "parcelado", // parcelado | unico
    valor: "",
    taxaJuros: "30",
    prazoDias: "30",
    dataEmprestimo: hoje,
    garantia: "",
    valorParcela: "",
    qtdParcelas: "30",
    diasCobranca: DIAS_SEG_SAB,
    pularFeriados: true,
    primeiraCobranca: "",
    primeiraManual: false, // se false, a 1ª cobrança é o próximo dia de cobrança depois do empréstimo
    removidas: [], // datas que o usuário tirou da lista (ex.: feriado municipal)
    trocas: {}, // { dataGerada: dataEscolhida } — datas que o usuário trocou
  };
}

function primeiraDoForm(f) {
  if (f.primeiraManual && f.primeiraCobranca) return f.primeiraCobranca;
  return primeiraCobrancaApos(f.dataEmprestimo, f.diasCobranca, f.pularFeriados);
}

// lista final de datas das parcelas, a partir do que está no formulário
function datasDoForm(f) {
  const n = parseInt(f.qtdParcelas || "0", 10);
  if (!(n > 0) || n > 400) return { datas: [], geradas: [], puladas: [] };
  const r = gerarDatasCobranca(primeiraDoForm(f), n, f.diasCobranca, f.pularFeriados, new Set(f.removidas || []));
  const trocas = f.trocas || {};
  return { datas: r.datas.map((d) => trocas[d] || d).sort(), geradas: r.datas, puladas: r.puladas };
}

function rotuloDias(dias) {
  const k = [...(dias || [])].sort().join(",");
  if (k === "1,2,3,4,5") return "seg a sex";
  if (k === "1,2,3,4,5,6") return "seg a sáb";
  if (k === "0,1,2,3,4,5,6") return "todos os dias";
  return [...(dias || [])].sort().map((d) => DIAS_SEMANA[d]).join(", ");
}

// devolve a lista do que falta preencher no formulário de empréstimo
function validarEmprestimo(f, editando) {
  const falta = [];
  if (!(parseFloat(f.valor) > 0)) falta.push("valor emprestado");
  if (!f.dataEmprestimo) falta.push("data do empréstimo");
  if (f.tipo === "parcelado") {
    if (!f.diasCobranca?.length) falta.push("dias de cobrança");
    if (!editando) {
      const n = parseInt(f.qtdParcelas || "0", 10);
      if (!(parseFloat(f.valorParcela) > 0)) falta.push("valor da parcela");
      if (!(n > 0 && n <= 400)) falta.push("quantidade de parcelas (1 a 400)");
      else if (f.diasCobranca?.length && datasDoForm(f).datas.length !== n) falta.push("datas das parcelas");
    }
  } else {
    if (!(parseFloat(f.taxaJuros) >= 0)) falta.push("juros");
    if (!(parseInt(f.prazoDias || "0", 10) > 0)) falta.push("prazo");
  }
  return falta;
}

const novoClienteForm = () => ({ nome: "", telefone: "", observacoes: "", ...novoEmprestimoForm() });

function fromRow(row, parcelasPorEmprestimo = {}) {
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
        parcelado: Array.isArray(l.dias_cobranca),
        diasCobranca: l.dias_cobranca || [],
        pularFeriados: l.pular_feriados !== false,
        parcelas: (parcelasPorEmprestimo[l.id] || [])
          .map((p) => ({ id: p.id, vencimento: p.vencimento, valor: Number(p.valor) }))
          .sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : a.id < b.id ? -1 : 1)),
        // pagamentos ativos contam no saldo; os estornados (baixa cancelada)
        // ficam só no histórico
        pagamentos: (l.pagamentos || [])
          .filter((p) => !p.estornado_em)
          .map((p) => ({ id: p.id, emprestimoId: l.id, data: p.data, valor: Number(p.valor), parcelaId: p.parcela_id || null, pendente: !!p._pendente }))
          .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)),
        estornos: (l.pagamentos || [])
          .filter((p) => p.estornado_em)
          .map((p) => ({ id: p.id, data: p.data, valor: Number(p.valor), parcelaId: p.parcela_id || null, estornadoEm: p.estornado_em, motivo: p.estornado_motivo || "", pendente: !!p._pendente }))
          .sort((a, b) => (a.estornadoEm < b.estornadoEm ? 1 : -1)),
      }))
      .sort((a, b) => new Date(b.dataEmprestimo) - new Date(a.dataEmprestimo)),
  };
}

// ---------------- OFFLINE: cópia local + fila de baixas ----------------
// A última versão dos dados fica guardada no aparelho, pra o app abrir sem
// internet. Baixas, cancelamentos e quitações entram numa FILA: aparecem na
// hora na tela e são enviadas ao banco assim que a internet voltar.

const chaveCache = (uid) => `agiopay:cache:${uid}`;
const chaveFila = (uid) => `agiopay:fila:${uid}`;

function lerJSON(chave, padrao) {
  try {
    const v = localStorage.getItem(chave);
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
}
function gravarJSON(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}
function apagarChave(chave) {
  try {
    localStorage.removeItem(chave);
  } catch {
    // sem acesso ao armazenamento: nada a apagar
  }
}

// sem internet, o login guardado pelo Supabase "vence" depois de 1h e a
// biblioteca devolve sessão vazia (mesmo mantendo o login salvo). Aqui a
// gente lê o login salvo direto, só pra saber quem é o usuário enquanto
// estiver offline — quando a internet volta, o Supabase renova sozinho.
function sessaoGuardada() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^sb-.+-auth-token$/.test(k)) {
        const s = JSON.parse(localStorage.getItem(k));
        if (s?.user?.id) return s;
      }
    }
  } catch {
    // ignora
  }
  return null;
}

function ehErroDeRede(err) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return /failed to fetch|network|load failed|fetch failed|timeout/i.test(err?.message || "");
}

function novoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// aplica uma operação da fila nos dados "crus" (no formato do banco)
function aplicarOp(dados, op, pendente = true) {
  const marca = pendente ? { _pendente: true } : {};
  const clientes = dados.clientes.map((c) => ({
    ...c,
    emprestimos: (c.emprestimos || []).map((l) => {
      let pagamentos = l.pagamentos || [];
      if (op.tipo === "pagar") {
        const novos = op.rows.filter((r) => r.emprestimo_id === l.id && !pagamentos.some((p) => p.id === r.id));
        if (novos.length) pagamentos = [...pagamentos, ...novos.map((r) => ({ ...r, ...marca }))];
      } else if (op.tipo === "estornar") {
        if (pagamentos.some((p) => op.ids.includes(p.id) && !p.estornado_em)) {
          pagamentos = pagamentos.map((p) =>
            op.ids.includes(p.id) && !p.estornado_em ? { ...p, estornado_em: op.em, estornado_motivo: op.motivo || null, ...marca } : p
          );
        }
      }
      return pagamentos === l.pagamentos ? l : { ...l, pagamentos };
    }),
  }));
  return { ...dados, clientes };
}

function montarClientes(dados, fila) {
  const comFila = fila.reduce((d, op) => aplicarOp(d, op, true), dados);
  const parcelasPorEmprestimo = {};
  (comFila.parcelas || []).forEach((p) => {
    (parcelasPorEmprestimo[p.emprestimo_id] ||= []).push(p);
  });
  return (comFila.clientes || []).map((row) => fromRow(row, parcelasPorEmprestimo));
}

// busca tudo do usuário no banco (usado pra carregar a tela e pro backup)
async function buscarTudo() {
  const { data: clientes, error } = await supabase
    .from("clientes")
    .select("*, emprestimos(*, pagamentos(*))")
    .order("created_at", { ascending: false });
  if (error) return { error };

  // parcelas vêm à parte, paginadas (o Supabase devolve no máximo 1000 por vez)
  const parcelas = [];
  let semParcelas = false;
  for (let from = 0; ; from += 1000) {
    const { data: pg, error: errP } = await supabase.from("parcelas").select("*").order("id").range(from, from + 999);
    if (errP) {
      if (ehErroDeRede(errP)) return { error: errP };
      semParcelas = true;
      break;
    }
    parcelas.push(...(pg || []));
    if (!pg || pg.length < 1000) break;
  }

  // confere se a migração de estornos já foi rodada
  const { error: errE } = await supabase.from("pagamentos").select("estornado_em").limit(1);
  const semEstornos = !!errE && !ehErroDeRede(errE);

  return { dados: { clientes: clientes || [], parcelas, salvoEm: new Date().toISOString() }, semParcelas, semEstornos };
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
        <div style={{ background: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-[100dvh] w-full flex items-center justify-center px-4">
          <div style={CARD} className="w-full max-w-sm rounded-3xl p-7 text-center">
            <AlertTriangle size={28} style={{ color: T.red, margin: "0 auto 10px" }} />
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", color: T.textPaper }} className="text-xl font-semibold mb-1.5">
              Algo deu errado
            </h1>
            <p style={{ color: T.muted }} className="text-sm mb-5">
              Aconteceu um erro inesperado. Seus dados estão salvos no banco — não foram perdidos. Tente recarregar a página.
            </p>
            <button onClick={() => window.location.reload()} style={{ background: T.gold, color: T.onColor }} className="w-full rounded-full py-3 text-sm font-medium">
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

  // dados como vieram do banco (ou da cópia salva no aparelho) + fila de
  // baixas/cancelamentos ainda não enviados. A tela mostra os dois juntos.
  const [dadosServidor, setDadosServidor] = useState({ clientes: [], parcelas: [] });
  const [fila, setFila] = useState([]);
  const filaRef = useRef([]);
  const sincronizandoRef = useRef(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);
  const [copiaDe, setCopiaDe] = useState(null); // data da cópia local, quando estiver usando ela
  const clients = useMemo(() => montarClientes(dadosServidor, fila), [dadosServidor, fila]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState("hoje"); // hoje | caixa | dashboard | clientes | agenda
  const [faltaMigracao, setFaltaMigracao] = useState([]); // arquivos .sql que ainda faltam rodar
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
  const [confirmSair, setConfirmSair] = useState(false);

  useEffect(() => {
    const aplicarSessao = (s) => {
      setSession(s);
      setNomeUsuario(s?.user?.user_metadata?.nome || "");
      setTaxaPresets(s?.user?.user_metadata?.taxas_modelo || []);
    };
    // sem internet: entra direto com o login guardado no aparelho (sem isso,
    // depois de 1h offline o app mostraria a tela de login)
    const guardada = !navigator.onLine ? sessaoGuardada() : null;
    if (guardada) {
      aplicarSessao(guardada);
      setAuthLoading(false);
    } else {
      supabase.auth.getSession().then(({ data }) => {
        aplicarSessao(data.session || (!navigator.onLine ? sessaoGuardada() : null));
        setAuthLoading(false);
      });
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (!s && event !== "SIGNED_OUT" && !navigator.onLine && sessaoGuardada()) return;
      if (event === "SIGNED_OUT") {
        // saiu (ou a conta foi bloqueada): apaga a cópia dos dados do aparelho.
        // A fila de baixas não enviadas fica, pra não perder nada se a mesma
        // pessoa entrar de novo.
        try {
          Object.keys(localStorage).filter((k) => k.startsWith("agiopay:cache:")).forEach((k) => localStorage.removeItem(k));
        } catch {
          // sem acesso ao armazenamento
        }
      }
      aplicarSessao(s);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const user = session?.user || null;
  const userId = user?.id || null;

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

  const flashError = useCallback((acao, err) => {
    // eslint-disable-next-line no-console
    console.error(`AGIOPAY — erro ao ${acao}:`, err);
    if (ehErroDeRede(err)) {
      setError(`Sem internet: não deu para ${acao}. Isso precisa de internet — dar baixa, cancelar baixa e quitar funcionam offline.`);
    } else {
      setError(mensagemErroBanco(err) || `Não deu para ${acao}. Tenta de novo em instantes.`);
    }
    setTimeout(() => setError(null), 6000);
  }, []);

  // ---- fila offline ----
  const definirFila = useCallback((nova) => {
    filaRef.current = nova;
    if (userId) gravarJSON(chaveFila(userId), nova);
    setFila(nova);
  }, [userId]);

  useEffect(() => {
    const f = userId ? lerJSON(chaveFila(userId), []) : [];
    filaRef.current = f;
    setFila(f);
  }, [userId]);

  const loadClients = useCallback(async () => {
    if (!userId) return;
    const usarCopia = () => {
      const copia = lerJSON(chaveCache(userId), null);
      if (copia) {
        setDadosServidor(copia);
        setCopiaDe(copia.salvoEm || null);
      } else {
        setError("Sem internet e sem cópia dos dados neste aparelho. Conecte na internet uma vez pra carregar.");
      }
      setLoading(false);
    };
    if (!navigator.onLine) return usarCopia();

    const r = await buscarTudo();
    if (r.error) {
      // eslint-disable-next-line no-console
      console.error("AGIOPAY — erro ao carregar dados:", r.error);
      if (ehErroDeRede(r.error)) return usarCopia();
      setError("Não deu para carregar seus clientes agora. Tenta recarregar a página.");
      setLoading(false);
      return;
    }
    const faltam = [];
    if (r.semParcelas) faltam.push("supabase_migration_parcelas.sql");
    if (r.semEstornos) faltam.push("supabase_migration_estornos.sql");
    setFaltaMigracao(faltam);
    gravarJSON(chaveCache(userId), r.dados);
    setDadosServidor(r.dados);
    setCopiaDe(null);
    setLoading(false);
  }, [userId]);

  // envia a fila pro banco, uma operação por vez, na ordem em que foram feitas.
  // Devolve true se enviou alguma coisa.
  const sincronizar = useCallback(async () => {
    if (!userId || sincronizandoRef.current || !navigator.onLine || filaRef.current.length === 0) return false;
    sincronizandoRef.current = true;
    setSincronizando(true);
    let enviou = false;
    let op;
    while ((op = filaRef.current[0])) {
      let res;
      if (op.tipo === "pagar") {
        // o id é gerado no aparelho: se a internet cair no meio e reenviar,
        // o banco ignora a repetição em vez de duplicar a baixa
        res = await supabase.from("pagamentos").upsert(op.rows, { onConflict: "id", ignoreDuplicates: true });
      } else {
        res = await supabase
          .from("pagamentos")
          .update({ estornado_em: op.em, estornado_por: userId, estornado_motivo: op.motivo || null })
          .in("id", op.ids)
          .is("estornado_em", null);
      }
      if (res.error && ehErroDeRede(res.error)) break; // caiu a internet: tenta de novo depois
      if (res.error) flashError(op.tipo === "pagar" ? "enviar uma baixa" : "enviar um cancelamento de baixa", res.error);
      else {
        const feita = op;
        setDadosServidor((d) => aplicarOp(d, feita, false));
      }
      const id = op.id;
      definirFila(filaRef.current.filter((o) => o.id !== id));
      enviou = true;
    }
    sincronizandoRef.current = false;
    setSincronizando(false);
    return enviou;
  }, [userId, definirFila, flashError]);

  // a tela cheia de "carregando" só aparece na primeira carga; depois de
  // cada baixa/edição a lista atualiza em silêncio, sem piscar nem perder
  // a posição da tela
  useEffect(() => {
    if (!userId) {
      setDadosServidor({ clientes: [], parcelas: [] });
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      await sincronizar();
      await loadClients();
    })();
  }, [userId, loadClients, sincronizar]);

  // internet caiu / voltou
  useEffect(() => {
    const aoVoltar = async () => {
      setOnline(true);
      await supabase.auth.getSession(); // renova o login se tiver vencido
      await sincronizar();
      loadClients();
    };
    const aoCair = () => setOnline(false);
    window.addEventListener("online", aoVoltar);
    window.addEventListener("offline", aoCair);
    return () => {
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("offline", aoCair);
    };
  }, [sincronizar, loadClients]);

  // sinal fraco: o aparelho diz que está online, mas o envio falha. Enquanto
  // tiver coisa na fila, tenta de novo a cada 30 segundos.
  useEffect(() => {
    if (fila.length === 0) return;
    const t = setInterval(async () => {
      if (await sincronizar()) loadClients();
    }, 30000);
    return () => clearInterval(t);
  }, [fila.length, sincronizar, loadClients]);

  const enfileirar = async (...ops) => {
    definirFila([...filaRef.current, ...ops.map((o) => ({ id: novoId(), ...o }))]);
    if (navigator.onLine && (await sincronizar())) loadClients();
  };

  const novoPagamento = (emprestimoId, parcelaId, valor, data = hojeISO()) => {
    const row = { id: novoId(), emprestimo_id: emprestimoId, user_id: userId, valor: Math.round(valor * 100) / 100, data };
    if (parcelaId) row.parcela_id = parcelaId;
    return row;
  };

  const sair = async (forcar = false) => {
    if (!forcar && filaRef.current.length > 0) {
      setConfirmSair(true);
      return;
    }
    setConfirmSair(false);
    if (userId) {
      // apaga a cópia dos dados deste aparelho (importante em celular emprestado)
      apagarChave(chaveCache(userId));
      apagarChave(chaveFila(userId));
    }
    await supabase.auth.signOut({ scope: navigator.onLine ? "global" : "local" });
  };

  // grava um empréstimo (de valor único ou parcelado) para um cliente;
  // devolve true se deu certo
  const inserirEmprestimo = async (clienteId, data) => {
    const valor = parseFloat(data.valor);
    if (data.tipo !== "parcelado") {
      const { error: err } = await supabase.from("emprestimos").insert({
        user_id: user.id,
        cliente_id: clienteId,
        valor,
        taxa_juros: parseFloat(data.taxaJuros),
        prazo_dias: parseInt(data.prazoDias || "30", 10),
        data_emprestimo: data.dataEmprestimo,
        garantia: data.garantia || null,
      });
      if (err) { flashError("salvar o empréstimo", err); return false; }
      return true;
    }

    // parcelado: a "taxa" e o "prazo" ficam só como informação
    // (lucro em % e dias corridos até a última parcela)
    const valorParcela = parseFloat(data.valorParcela);
    const { datas } = datasDoForm(data);
    const total = valorParcela * datas.length;
    const taxa = Math.min(9999.99, Math.max(0, Math.round((total / valor - 1) * 10000) / 100));
    const prazo = Math.max(1, diasEntreISO(data.dataEmprestimo, datas[datas.length - 1]));

    const { data: emp, error: err } = await supabase
      .from("emprestimos")
      .insert({
        user_id: user.id,
        cliente_id: clienteId,
        valor,
        taxa_juros: taxa,
        prazo_dias: prazo,
        data_emprestimo: data.dataEmprestimo,
        garantia: data.garantia || null,
        dias_cobranca: data.diasCobranca,
        pular_feriados: data.pularFeriados,
      })
      .select()
      .single();
    if (err) { flashError("salvar o empréstimo", err); return false; }

    const { error: errP } = await supabase.from("parcelas").insert(
      datas.map((d) => ({ user_id: user.id, emprestimo_id: emp.id, vencimento: d, valor: valorParcela }))
    );
    if (errP) {
      // desfaz o empréstimo pra não ficar um empréstimo sem parcelas
      await supabase.from("emprestimos").delete().eq("id", emp.id);
      flashError("gerar as parcelas", errP);
      return false;
    }
    return true;
  };

  // cria cliente + primeiro empréstimo juntos
  const addClientWithLoan = async (data) => {
    const { data: cliente, error: err1 } = await supabase
      .from("clientes")
      .insert({ user_id: user.id, nome: data.nome, telefone: data.telefone || null, observacoes: data.observacoes || null })
      .select()
      .single();
    if (err1) return flashError("salvar o cliente", err1);

    await inserirEmprestimo(cliente.id, data);
    setShowAdd(false);
    loadClients();
  };

  const addLoan = async (clienteId, data) => {
    await inserirEmprestimo(clienteId, data);
    loadClients();
  };

  const editLoan = async (id, data) => {
    const update = {
      valor: parseFloat(data.valor),
      data_emprestimo: data.dataEmprestimo,
      garantia: data.garantia || null,
    };
    if (data.tipo === "parcelado") {
      // nos parcelados, datas e valores das parcelas são editados parcela por parcela
      update.dias_cobranca = data.diasCobranca;
      update.pular_feriados = data.pularFeriados;
    } else {
      update.taxa_juros = parseFloat(data.taxaJuros);
      update.prazo_dias = parseInt(data.prazoDias || "30", 10);
    }
    const { error: err } = await supabase.from("emprestimos").update(update).eq("id", id);
    if (err) return flashError("editar o empréstimo", err);
    loadClients();
  };

  // ---- baixas: passam pela fila, então funcionam com ou sem internet ----

  // dar baixa numa parcela (valor cheio ou parcial)
  const baixarParcela = (emprestimoId, parcelaId, valor) =>
    enfileirar({ tipo: "pagar", rows: [novoPagamento(emprestimoId, parcelaId, valor)] });

  // cancelar a baixa: os pagamentos NÃO são apagados — ficam marcados como
  // estornados (com data, hora e motivo) e deixam de contar no saldo
  const cancelarBaixa = (pagamentoIds, motivo) => {
    if (!pagamentoIds.length) return;
    return enfileirar({ tipo: "estornar", ids: pagamentoIds, em: new Date().toISOString(), motivo: (motivo || "").trim() || null });
  };

  // quitar o empréstimo inteiro: dá baixa no que falta de cada parcela em aberto
  const quitarEmprestimo = (loan) => {
    const rows = loan.calc.parcelado
      ? loan.calc.abertas.map((p) => novoPagamento(loan.id, p.id, p.restante))
      : [novoPagamento(loan.id, null, loan.calc.saldo)];
    const validas = rows.filter((r) => r.valor > 0);
    if (validas.length === 0) return;
    return enfileirar({ tipo: "pagar", rows: validas });
  };

  const addPayment = (emprestimoId, valor) => enfileirar({ tipo: "pagar", rows: [novoPagamento(emprestimoId, null, valor)] });

  // corrigir o valor de um pagamento = estornar o antigo e lançar o novo
  // (assim fica registrado que houve correção)
  const editPayment = (pagamento, valor) =>
    enfileirar(
      { tipo: "estornar", ids: [pagamento.id], em: new Date().toISOString(), motivo: `valor corrigido para ${fmt(valor)}` },
      { tipo: "pagar", rows: [novoPagamento(pagamento.emprestimoId, pagamento.parcelaId, valor, pagamento.data)] }
    );

  const removePayment = (pagamentoId, motivo) => cancelarBaixa([pagamentoId], motivo);

  // muda data e/ou valor de uma ou várias parcelas (editar / reagendar atrasadas)
  const atualizarParcelas = async (mudancas) => {
    const resultados = await Promise.all(
      mudancas.map((m) => supabase.from("parcelas").update({ vencimento: m.vencimento, valor: m.valor }).eq("id", m.id))
    );
    const falha = resultados.find((r) => r.error);
    if (falha) flashError("salvar as parcelas", falha.error);
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

  // ---- backup ----
  const [backupBusy, setBackupBusy] = useState(false);
  const [ultimoBackupLocal, setUltimoBackupLocal] = useState(null);
  const ultimoBackup = ultimoBackupLocal || user?.user_metadata?.ultimo_backup_em || null;
  const diasSemBackup = ultimoBackup ? Math.floor((Date.now() - new Date(ultimoBackup).getTime()) / 86400000) : Infinity;

  // baixa um arquivo .json com TUDO da conta: clientes, empréstimos,
  // parcelas e pagamentos (inclusive os estornados)
  const baixarBackup = async () => {
    if (!userId || backupBusy) return;
    setBackupBusy(true);
    await sincronizar(); // manda antes as baixas que estiverem na fila
    const r = await buscarTudo();
    if (r.error) {
      setBackupBusy(false);
      return flashError("gerar o backup", r.error);
    }
    const clientes = [];
    const emprestimos = [];
    const pagamentos = [];
    r.dados.clientes.forEach((c) => {
      const { emprestimos: es, ...cli } = c;
      clientes.push(cli);
      (es || []).forEach((e) => {
        const { pagamentos: ps, ...emp } = e;
        emprestimos.push(emp);
        (ps || []).forEach((pg) => pagamentos.push(pg));
      });
    });
    const agora = new Date().toISOString();
    const backup = {
      app: "AGIOPAY",
      tipo: "backup",
      versao: 1,
      geradoEm: agora,
      conta: user.email,
      totais: { clientes: clientes.length, emprestimos: emprestimos.length, parcelas: r.dados.parcelas.length, pagamentos: pagamentos.length },
      clientes,
      emprestimos,
      parcelas: r.dados.parcelas,
      pagamentos,
    };
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agiopay-backup-${hojeISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setUltimoBackupLocal(agora);
    supabase.auth.updateUser({ data: { ultimo_backup_em: agora } });
    setBackupBusy(false);
  };

  // recoloca no banco tudo que está no arquivo de backup. Não apaga nada:
  // o que existe hoje e não está no arquivo continua; o que tem o mesmo id
  // volta a ficar como estava no backup.
  const restaurarBackup = async (file) => {
    let b;
    try {
      b = JSON.parse(await file.text());
    } catch {
      return { erro: "Esse arquivo não é um backup do AGIOPAY." };
    }
    if (b?.app !== "AGIOPAY" || b?.tipo !== "backup" || !Array.isArray(b.clientes)) {
      return { erro: "Esse arquivo não é um backup do AGIOPAY." };
    }
    setBackupBusy(true);
    const etapas = [["clientes", b.clientes], ["emprestimos", b.emprestimos], ["parcelas", b.parcelas], ["pagamentos", b.pagamentos]];
    for (const [tabela, rows] of etapas) {
      const lista = (rows || []).map((row) => ({ ...row, user_id: userId }));
      for (let i = 0; i < lista.length; i += 500) {
        const { error: err } = await supabase.from(tabela).upsert(lista.slice(i, i + 500), { onConflict: "id" });
        if (err) {
          // eslint-disable-next-line no-console
          console.error(`AGIOPAY — erro ao restaurar ${tabela}:`, err);
          setBackupBusy(false);
          await loadClients();
          return {
            erro: ehErroDeRede(err)
              ? "A internet caiu no meio da restauração. O que já foi restaurado continua lá — pode rodar de novo com o mesmo arquivo."
              : `Parou ao restaurar ${tabela}. O que já foi restaurado continua lá. Confira se as migrações do banco foram rodadas e tente de novo.`,
          };
        }
      }
    }
    await loadClients();
    setBackupBusy(false);
    const t = b.totais || {};
    return { ok: `Backup de ${new Date(b.geradoEm).toLocaleDateString("pt-BR")} restaurado: ${t.clientes ?? b.clientes.length} clientes, ${t.emprestimos ?? 0} empréstimos, ${t.pagamentos ?? 0} pagamentos.` };
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

  // aba "Hoje": o que está previsto pra receber hoje, o que já entrou e o que falta
  const hojeDados = useMemo(() => {
    const hoje = hojeISO();
    const itens = [];
    const atrasados = [];
    let caixaHoje = 0;
    enriched.forEach((c) => {
      c.calc.emprestimos.forEach((l) => {
        const pagoHoje = l.pagamentos.filter((p) => p.data === hoje).reduce((s, p) => s + p.valor, 0);
        caixaHoje += pagoHoje;
        if (l.calc.parcelado) {
          l.calc.parcelas.forEach((p) => {
            if (p.vencimento !== hoje) return;
            itens.push({
              key: p.id, cliente: c, loan: l, parcela: p,
              rotulo: `parcela ${p.numero}/${l.calc.parcelas.length}`,
              previsto: p.valor, recebido: Math.min(p.pago, p.valor),
            });
          });
          if (l.calc.atrasadas.length > 0) {
            atrasados.push({
              key: l.id, cliente: c, loan: l,
              qtd: l.calc.atrasadas.length,
              valor: l.calc.atrasadas.reduce((s, p) => s + p.restante, 0),
              desde: l.calc.atrasadas[0].vencimento,
            });
          }
        } else {
          if (isoLocal(l.calc.vencimento) === hoje && (l.calc.saldo > 0.01 || pagoHoje > 0)) {
            itens.push({
              key: l.id, cliente: c, loan: l, parcela: null,
              rotulo: "pagamento único",
              previsto: l.calc.saldo + pagoHoje, recebido: pagoHoje,
            });
          }
          if (l.calc.atrasado) {
            atrasados.push({
              key: l.id, cliente: c, loan: l, qtd: null, valor: l.calc.saldo,
              desde: isoLocal(l.calc.vencimento),
            });
          }
        }
      });
    });
    // em aberto primeiro, depois os já pagos; dentro de cada grupo, por nome
    itens.sort((a, b) => {
      const pa = a.previsto - a.recebido <= 0.01, pb = b.previsto - b.recebido <= 0.01;
      if (pa !== pb) return pa ? 1 : -1;
      return a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR");
    });
    atrasados.sort((a, b) => (a.desde < b.desde ? -1 : 1));
    const previsto = itens.reduce((s, i) => s + i.previsto, 0);
    const recebido = itens.reduce((s, i) => s + i.recebido, 0);
    return { itens, atrasados, previsto, recebido, falta: Math.max(0, previsto - recebido), caixaHoje };
  }, [enriched]);

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

  const tituloTela = selected ? "Cliente" : (NAV.find(([k]) => k === view)?.[1] || "");
  const irPara = (key) => { setView(key); setSelectedId(null); setShowNotif(false); window.scrollTo({ top: 0 }); };
  const sino = (
    <div className="relative">
      <button onClick={() => setShowNotif((s) => !s)} title="Notificações" aria-label="Notificações" style={{ ...CARD, color: T.textInk }} className="flex items-center justify-center rounded-full w-10 h-10 active:scale-95 transition-transform relative">
        <Bell size={17} />
        {notifItens.length > 0 && (
          <span style={{ background: T.red, color: T.onColor, boxShadow: `0 0 0 2px ${T.ink}` }} className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1">
            {notifItens.length}
          </span>
        )}
      </button>
      {showNotif && (
        <NotifDropdown
          itens={notifItens}
          onClose={() => setShowNotif(false)}
          onClickItem={(clienteId) => { setSelectedId(clienteId); setShowNotif(false); }}
          onVerAgenda={() => irPara("agenda")}
        />
      )}
    </div>
  );

  return (
    <div style={{ background: T.ink, color: T.textInk, fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-[100dvh] w-full">
      {/* ---- menu lateral (desktop) ---- */}
      <aside style={{ background: T.nav }} className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col px-4 py-6 z-30">
        <div className="px-2"><Logo escuro /></div>

        <button onClick={() => setShowAdd(true)} style={{ background: T.gold, color: T.onColor }} className="mt-7 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold hover:brightness-110 active:scale-[0.98] transition">
          <Plus size={17} strokeWidth={2.5} /> Novo cliente
        </button>

        <nav className="mt-6 space-y-1">
          {NAV.map(([key, label, Icon]) => {
            const ativo = !selected && view === key;
            return (
              <button
                key={key}
                onClick={() => irPara(key)}
                style={{ background: ativo ? T.navSoft : "transparent", color: ativo ? T.navText : T.navMuted }}
                className="relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:text-white transition-colors"
              >
                {ativo && <span style={{ background: T.navAccent }} className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" />}
                <Icon size={18} style={{ color: ativo ? T.navAccent : undefined }} />
                {label}
                {key === "agenda" && notifItens.length > 0 && (
                  <span style={{ background: T.red, color: T.onColor }} className="ml-auto min-w-[20px] h-5 rounded-full text-[11px] font-semibold flex items-center justify-center px-1.5">{notifItens.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1">
          <p style={{ color: T.navMuted }} className="px-3 pb-1 text-[11px] uppercase tracking-wider font-semibold">Exportar</p>
          <button onClick={exportarCSV} style={{ color: T.navMuted }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:text-white transition-colors">
            <Sheet size={17} /> Planilha (CSV)
          </button>
          <button onClick={() => setPrintMode({ type: "todos" })} style={{ color: T.navMuted }} className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:text-white transition-colors">
            <FileDown size={17} /> Relatório (PDF)
          </button>

          <div style={{ borderTop: `1px solid ${T.navSoft}` }} className="!mt-4 pt-4 flex items-center gap-2">
            <button onClick={() => setShowAccount(true)} title="Minha conta" className="flex-1 min-w-0 flex items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/5 transition-colors">
              <Avatar nome={nomeUsuario || user.email} />
              <span className="min-w-0">
                <span style={{ color: T.navText }} className="block text-sm font-medium truncate">{nomeUsuario || "Minha conta"}</span>
                <span style={{ color: T.navMuted }} className="block text-xs truncate">{user.email}</span>
              </span>
            </button>
            <button onClick={() => sair()} title="Sair" aria-label="Sair" style={{ color: T.navMuted }} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 hover:text-white transition-colors">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* ---- topo ---- */}
        <header style={{ background: T.ink, borderBottom: `1px solid ${T.line}`, paddingTop: "env(safe-area-inset-top)" }} className="sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            <div className="lg:hidden"><Logo /></div>
            <div className="hidden lg:block min-w-0">
              <h1 style={{ fontFamily: FONT_DISPLAY, color: T.textInk }} className="text-xl font-bold tracking-tight truncate">{tituloTela}</h1>
              <p style={{ color: T.muted }} className="text-xs first-letter:uppercase">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {sino}
              <button onClick={() => setShowAdd(true)} title="Novo cliente" aria-label="Novo cliente" style={{ background: T.gold, color: T.onColor }} className="lg:hidden flex items-center justify-center gap-1.5 rounded-full h-10 w-10 sm:w-auto sm:px-4 text-sm font-semibold active:scale-95 transition-transform">
                <Plus size={17} strokeWidth={2.5} />
                <span className="hidden sm:inline">Cliente</span>
              </button>
              <button onClick={() => setShowAccount(true)} title="Minha conta" aria-label="Minha conta" className="lg:hidden rounded-full active:scale-95 transition-transform">
                <Avatar nome={nomeUsuario || user.email} claro />
              </button>
              <button onClick={() => sair()} title="Sair" aria-label="Sair" style={{ ...CARD, color: T.muted }} className="lg:hidden flex items-center justify-center rounded-full w-10 h-10 active:scale-95 transition-transform">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 lg:pt-8 pb-28 lg:pb-12">
        <StatusConexao online={online} pendentes={fila.length} sincronizando={sincronizando} copiaDe={copiaDe} onEnviar={async () => { if (await sincronizar()) loadClients(); }} />

        {faltaMigracao.length > 0 && (
          <div style={{ background: T.amberTint, color: T.textPaper, border: "1px solid #F3D9B1" }} className="rounded-xl px-4 py-3 text-sm mb-4">
            <b>Falta atualizar o banco de dados.</b> Rode no SQL Editor do Supabase, nesta ordem: {faltaMigracao.map((f, i) => <span key={f}>{i > 0 && ", "}<code>{f}</code></span>)}. Depois recarregue a página.
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
            onBaixarParcela={baixarParcela}
            onCancelarBaixa={cancelarBaixa}
            onQuitar={quitarEmprestimo}
            onAtualizarParcelas={atualizarParcelas}
            onExportPDF={() => setPrintMode({ type: "cliente", client: selected })}
            presets={taxaPresets}
            onSavePreset={salvarPreset}
            onRemovePreset={removerPreset}
          />
        ) : (
          <>
            {view === "hoje" && clients.length > 0 && diasSemBackup !== null && diasSemBackup >= 7 && (
              <div style={{ background: T.amberTint, color: T.textPaper, border: "1px solid #F3D9B1" }} className="rounded-xl px-4 py-3 text-sm mb-4 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <HardDriveDownload size={15} style={{ color: T.amber }} className="shrink-0" />
                  {diasSemBackup === Infinity ? "Você ainda não fez nenhum backup." : `Seu último backup foi há ${diasSemBackup} dias.`}
                </span>
                <button onClick={baixarBackup} disabled={!online || backupBusy} style={{ background: T.gold, color: T.onColor }} className="rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50">
                  {backupBusy ? "Gerando…" : "Baixar backup agora"}
                </button>
              </div>
            )}

            {view === "hoje" && (
              <Hoje
                dados={hojeDados}
                onAbrirCliente={(clienteId) => setSelectedId(clienteId)}
                onBaixarParcela={baixarParcela}
                onCancelarBaixa={cancelarBaixa}
              />
            )}

            {view === "caixa" && <Caixa clients={enriched} onAbrirCliente={(clienteId) => setSelectedId(clienteId)} />}

            {view === "dashboard" && (
              <Dashboard totals={totals} count={clients.length} atrasadosList={atrasadosList} evolucao={buildEvolucaoMensal(clients)} onVerClientes={() => setView("clientes")} onAddClient={() => setShowAdd(true)} nomeUsuario={nomeUsuario} />
            )}

            {view === "clientes" && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search size={16} style={{ color: T.muted }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…" style={{ ...CARD, color: T.textInk, border: `1px solid ${T.line}`, fontFamily: "'Inter', system-ui, sans-serif" }} className="w-full rounded-full pl-9 pr-4 py-2.5 text-sm outline-none placeholder:opacity-50" />
                  </div>
                  <button onClick={() => setPrintMode({ type: "todos" })} title="Exportar todos em PDF" style={{ ...CARD, color: T.textInk, border: `1px solid ${T.line}` }} className="sm:hidden flex items-center justify-center rounded-full w-10 h-10 shrink-0 active:scale-95 transition-transform">
                    <FileDown size={16} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-2.5">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ ...CARD, color: T.textInk, border: `1px solid ${T.line}`, fontFamily: "'Inter', system-ui, sans-serif" }}
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
                    style={{ ...CARD, color: T.textInk, border: `1px solid ${T.line}`, fontFamily: "'Inter', system-ui, sans-serif" }}
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
                  <label style={{ ...CARD, color: T.textInk, border: `1px solid ${T.line}` }} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs cursor-pointer">
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
                      background: importMsg.tipo === "erro" ? T.redTint : importMsg.tipo === "parcial" ? T.amberTint : T.greenTint,
                      color: importMsg.tipo === "erro" ? T.red : importMsg.tipo === "parcial" ? T.textPaper : T.green,
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
        </main>
      </div>

      {/* ---- abas (celular) ---- */}
      <nav style={{ background: T.paper, borderTop: `1px solid ${T.line}`, paddingBottom: "env(safe-area-inset-bottom)" }} className="lg:hidden fixed bottom-0 inset-x-0 z-30">
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {NAV.map(([key, label, Icon]) => {
            const ativo = !selected && view === key;
            return (
              <button key={key} onClick={() => irPara(key)} style={{ color: ativo ? T.goldSoft : T.muted }} className="relative flex flex-col items-center gap-0.5 pt-2 pb-2 text-[11px] font-medium">
                <span style={{ background: ativo ? T.goldTint : "transparent" }} className="flex items-center justify-center w-12 h-7 rounded-full transition-colors">
                  <Icon size={19} strokeWidth={ativo ? 2.4 : 2} />
                </span>
                {label}
                {key === "agenda" && notifItens.length > 0 && (
                  <span style={{ background: T.red }} className="absolute top-1.5 left-1/2 ml-3 w-2 h-2 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {showAdd && <ClientLoanForm title="Novo cliente" initial={novoClienteForm()} onClose={() => setShowAdd(false)} onSave={addClientWithLoan} presets={taxaPresets} onSavePreset={salvarPreset} onRemovePreset={removerPreset} />}

      {showAccount && (
        <AccountModal
          user={user}
          nomeUsuario={nomeUsuario}
          online={online}
          backupBusy={backupBusy}
          ultimoBackup={ultimoBackup}
          onBaixarBackup={baixarBackup}
          onRestaurarBackup={restaurarBackup}
          onClose={() => setShowAccount(false)}
          onUpdated={(novoNome) => setNomeUsuario(novoNome)}
        />
      )}

      {confirmSair && (
        <ConfirmModal
          title="Sair com baixas não enviadas?"
          message={`Tem ${fila.length} operação${fila.length > 1 ? "ões" : ""} (baixa ou cancelamento) que ainda não chegou ao banco, porque estava sem internet. Se sair agora, ela${fila.length > 1 ? "s" : ""} se perde${fila.length > 1 ? "m" : ""}. O melhor é conectar na internet e esperar enviar.`}
          confirmLabel="Sair mesmo assim"
          cancelLabel="Ficar"
          onCancel={() => setConfirmSair(false)}
          onConfirm={() => sair(true)}
        />
      )}

      {error && (
        <div style={{ background: T.red, color: T.onColor }} className="fixed bottom-24 lg:bottom-6 left-4 right-4 lg:left-72 max-w-xl mx-auto rounded-xl px-4 py-3 text-sm text-center z-50 shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

function CenteredMsg({ children }) {
  return (
    <div style={{ background: T.ink, color: T.textInk, fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-[100dvh] flex items-center justify-center">
      {children}
    </div>
  );
}

// ---------------- DOSSIÊ DO CLIENTE ----------------

function ClientDossie({ client, onBack, onEditClient, onDeleteClient, onAddLoan, onEditLoan, onRemoveLoan, onPay, onEditPayment, onRemovePayment, onBaixarParcela, onCancelarBaixa, onQuitar, onAtualizarParcelas, onExportPDF, presets, onSavePreset, onRemovePreset }) {
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

      <div style={CARD} className="rounded-2xl p-4 sm:p-5 mb-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xl sm:text-2xl font-semibold truncate">{client.nome}</h2>
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
          <div style={{ background: T.redTint, color: T.red, border: "1px solid #F4C7C2" }} className="rounded-xl px-3 py-2 flex items-center gap-2 text-sm font-medium mt-3">
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
        <button onClick={() => setAddingLoan(true)} style={{ background: T.gold, color: T.onColor }} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0">
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
            onBaixarParcela={(parcelaId, valor) => onBaixarParcela(l.id, parcelaId, valor)}
            onCancelarBaixa={onCancelarBaixa}
            onQuitar={() => onQuitar(l)}
            onAtualizarParcelas={onAtualizarParcelas}
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
        <LoanForm title="Novo empréstimo" initial={novoEmprestimoForm()} onClose={() => setAddingLoan(false)} onSave={async (data) => { await onAddLoan(data); setAddingLoan(false); }} presets={presets} onSavePreset={onSavePreset} onRemovePreset={onRemovePreset} />
      )}

      {editingLoan && (
        <LoanForm
          title="Editar empréstimo"
          editando
          initial={{
            ...novoEmprestimoForm(),
            tipo: editingLoan.parcelado ? "parcelado" : "unico",
            valor: String(editingLoan.valor),
            taxaJuros: String(editingLoan.taxaJuros),
            prazoDias: String(editingLoan.prazoDias),
            dataEmprestimo: editingLoan.dataEmprestimo,
            garantia: editingLoan.garantia,
            diasCobranca: editingLoan.parcelado ? editingLoan.diasCobranca : DIAS_SEG_SAB,
            pularFeriados: editingLoan.pularFeriados,
          }}
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
      <div style={{ color: color || T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-sm font-semibold tabular-nums truncate">{value}</div>
    </div>
  );
}

function LoanCard({ loan, expanded, onToggle, onPay, onEditPayment, onRemovePayment, onBaixarParcela, onCancelarBaixa, onQuitar, onAtualizarParcelas, onEdit, onRemove }) {
  const { calc } = loan;
  const positivo = calc.status === "positivo";
  const [payAmount, setPayAmount] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmQuitar, setConfirmQuitar] = useState(false);
  const [editParcelas, setEditParcelas] = useState(null); // { titulo, descricao, linhas }

  const faltaQuitar = calc.parcelado ? calc.abertas.reduce((s, p) => s + p.restante, 0) : calc.saldo;

  const subtitulo = calc.parcelado
    ? `${calc.pagas}/${calc.parcelas.length} parcelas pagas` + (calc.atrasado ? ` · ${calc.atrasadas.length} atrasada${calc.atrasadas.length > 1 ? "s" : ""}` : "")
    : `${loan.taxaJuros}% a.m.` + (calc.atrasado ? ` · ${calc.diasAtraso}d de atraso` : ` · ${calc.periodos} período${calc.periodos > 1 ? "s" : ""}`);

  // joga as parcelas atrasadas pra depois da última parcela, nos mesmos dias
  // de cobrança; datas e valores ficam editáveis (multa/juros é manual)
  const abrirReagendar = () => {
    const atrasadas = calc.atrasadas;
    const idsAtrasadas = new Set(atrasadas.map((p) => p.id));
    const outras = calc.parcelas.filter((p) => !idsAtrasadas.has(p.id));
    const ultima = outras.length ? outras[outras.length - 1].vencimento : atrasadas[atrasadas.length - 1].vencimento;
    const ontem = addDias(hojeISO(), -1);
    const base = ultima > ontem ? ultima : ontem;
    const dias = loan.diasCobranca.length ? loan.diasCobranca : DIAS_SEG_SAB;
    const { datas } = gerarDatasCobranca(addDias(base, 1), atrasadas.length, dias, loan.pularFeriados);
    setEditParcelas({
      titulo: `Reagendar ${atrasadas.length} parcela${atrasadas.length > 1 ? "s" : ""} atrasada${atrasadas.length > 1 ? "s" : ""}`,
      descricao: `As novas datas já vêm sugeridas pra depois da última parcela (${rotuloDias(dias)}). Você pode mudar qualquer data, e mudar o valor se quiser somar multa ou juros.`,
      linhas: atrasadas.map((p, i) => ({ id: p.id, numero: p.numero, original: p.vencimento, vencimento: datas[i] || p.vencimento, valor: String(p.valor) })),
    });
  };

  const abrirEditarParcela = (p) => {
    setEditParcelas({
      titulo: `Editar parcela ${p.numero}`,
      descricao: "Mude a data (ex.: caiu num feriado) ou o valor (ex.: somar multa).",
      linhas: [{ id: p.id, numero: p.numero, original: p.vencimento, vencimento: p.vencimento, valor: String(p.valor) }],
    });
  };

  return (
    <div style={CARD} className="rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
        <div className="min-w-0">
          <div style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="font-medium truncate flex items-center gap-1.5">
            {fmt(loan.valor)} emprestado
            {calc.atrasado && <AlertTriangle size={12} style={{ color: T.red }} />}
          </div>
          <div style={{ color: calc.atrasado ? T.red : T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs mt-0.5">
            {fmtData(loan.dataEmprestimo)} · {subtitulo}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-3">
          <div className="text-right">
            <div style={{ color: positivo ? T.green : T.red, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-sm font-semibold tabular-nums">
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
            {calc.parcelado ? (
              <>
                <Row label={`Total a receber (${calc.parcelas.length} parcelas)`} value={fmt(calc.totalDevido)} bold />
                <Row label={`Lucro (${loan.valor > 0 ? Math.round((calc.juros / loan.valor) * 100) : 0}%)`} value={fmt(calc.juros)} color={T.greenSoft} />
              </>
            ) : (
              <>
                <Row label={`Juros (${loan.taxaJuros}% × ${calc.periodos} período${calc.periodos > 1 ? "s" : ""} de ${calc.prazoDias}d)`} value={fmt(calc.juros)} />
                <Row label="Total devido" value={fmt(calc.totalDevido)} bold />
              </>
            )}
            <Row label="Já pago" value={fmt(calc.totalPago)} color={T.greenSoft} />
            <Row label="Saldo em aberto" value={positivo ? "Quitado" : fmt(calc.saldo)} color={positivo ? T.green : T.red} bold />
            {calc.parcelado && <Row label="Cobrança" value={rotuloDias(loan.diasCobranca) + (loan.pularFeriados ? ", sem feriados" : "")} />}
            {loan.garantia && <Row label="Garantia" value={loan.garantia} />}
          </div>

          {!positivo && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => setConfirmQuitar(true)} style={{ background: T.green, color: T.onColor }} className="flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-medium">
                <CheckCheck size={13} /> Quitar empréstimo
              </button>
              {calc.parcelado && calc.atrasadas.length > 0 && (
                <button onClick={abrirReagendar} style={{ background: T.red, color: T.onColor }} className="flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-medium">
                  <CalendarClock size={13} /> Reagendar atrasadas ({calc.atrasadas.length})
                </button>
              )}
            </div>
          )}

          {!calc.parcelado && !positivo && (
            <div className="mt-3">
              <div className="flex gap-2">
                <DecimalField value={payAmount} onChange={setPayAmount} placeholder="Valor recebido" className="flex-1" />
                <button
                  disabled={!(parseFloat(payAmount) > 0)}
                  onClick={() => { const v = parseFloat(payAmount); if (v > 0) { onPay(v); setPayAmount(""); } }}
                  style={{ background: parseFloat(payAmount) > 0 ? T.green : T.line, color: parseFloat(payAmount) > 0 ? T.onColor : T.muted }}
                  className="rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed"
                >
                  Registrar
                </button>
              </div>
              {payAmount && !(parseFloat(payAmount) > 0) && (
                <p style={{ color: T.red }} className="text-xs mt-1.5 px-1">Digite um valor maior que zero</p>
              )}
              {parseFloat(payAmount) > 0 && (
                <p style={{ color: T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs mt-1.5 px-1">
                  Saldo depois: <span style={{ color: Math.max(0, calc.saldo - parseFloat(payAmount)) <= 0.01 ? T.green : T.red, fontWeight: 600 }}>{fmt(Math.max(0, calc.saldo - parseFloat(payAmount)))}</span>
                </p>
              )}
            </div>
          )}

          {calc.parcelado && (
            <div className="mt-3">
              <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1.5">Parcelas</p>
              <div style={{ border: `1px solid ${T.line}` }} className="rounded-xl max-h-[28rem] overflow-y-auto">
                {calc.parcelas.map((p, i) => (
                  <ParcelaRow
                    key={p.id}
                    parcela={p}
                    isLast={i === calc.parcelas.length - 1}
                    onBaixar={(valor) => onBaixarParcela(p.id, valor)}
                    onCancelar={(motivo) => onCancelarBaixa(p.pagamentos.map((x) => x.id), motivo)}
                    onEditar={() => abrirEditarParcela(p)}
                  />
                ))}
              </div>
            </div>
          )}

          {!calc.parcelado && loan.pagamentos.length > 0 && (
            <div className="mt-3">
              <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1.5">Pagamentos</p>
              <div className="space-y-1">
                {loan.pagamentos.map((p) => (
                  <PaymentRow key={p.id} payment={p} onEdit={(valor) => onEditPayment(p, valor)} onRemove={(motivo) => onRemovePayment(p.id, motivo)} />
                ))}
              </div>
            </div>
          )}

          {loan.estornos.length > 0 && (
            <details className="mt-3">
              <summary style={{ color: T.muted }} className="text-xs uppercase tracking-wide cursor-pointer select-none">
                Baixas canceladas ({loan.estornos.length})
              </summary>
              <div className="space-y-1.5 mt-2">
                {loan.estornos.map((e) => {
                  const parc = e.parcelaId ? calc.parcelas?.find((p) => p.id === e.parcelaId) : null;
                  return (
                    <div key={e.id} className="text-xs flex justify-between gap-2">
                      <span style={{ color: T.muted }} className="min-w-0">
                        {parc ? `Parcela ${parc.numero}` : "Pagamento"} de {fmtData(e.data)} · cancelada em {new Date(e.estornadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {e.motivo ? ` · “${e.motivo}”` : ""}
                        {e.pendente ? " · a enviar" : ""}
                      </span>
                      <span style={{ color: T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", textDecoration: "line-through" }} className="shrink-0">{fmt(e.valor)}</span>
                    </div>
                  );
                })}
              </div>
            </details>
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
          message="Isso apaga de vez esse empréstimo, as parcelas e TODOS os pagamentos dele (inclusive o histórico de baixas canceladas). O resto do histórico do cliente continua. Se foi só uma baixa errada, use “Cancelar baixa” em vez disso."
          onCancel={() => setConfirmRemove(false)}
          onConfirm={onRemove}
        />
      )}

      {confirmQuitar && (
        <ConfirmModal
          title="Quitar este empréstimo?"
          message={calc.parcelado
            ? `Isso dá baixa hoje em ${calc.abertas.length} parcela${calc.abertas.length > 1 ? "s" : ""} em aberto, total de ${fmt(faltaQuitar)}. Dá pra cancelar a baixa de cada parcela depois, se precisar.`
            : `Isso registra hoje um pagamento de ${fmt(faltaQuitar)} e o empréstimo fica quitado. Dá pra apagar esse pagamento depois, se precisar.`}
          confirmLabel="Quitar"
          confirmColor={T.green}
          onCancel={() => setConfirmQuitar(false)}
          onConfirm={() => { setConfirmQuitar(false); onQuitar(); }}
        />
      )}

      {editParcelas && (
        <ParcelasModal
          {...editParcelas}
          onClose={() => setEditParcelas(null)}
          onSave={async (mudancas) => { await onAtualizarParcelas(mudancas); setEditParcelas(null); }}
        />
      )}
    </div>
  );
}

// uma linha da lista de parcelas dentro do empréstimo
function ParcelaRow({ parcela: p, isLast, onBaixar, onCancelar, onEditar }) {
  const ultimoPg = p.pagamentos[p.pagamentos.length - 1];
  let detalhe = null;
  if (p.quitada && ultimoPg) detalhe = `pago em ${fmtData(ultimoPg.data)}`;
  else if (p.pago > 0) detalhe = `pago ${fmt(p.pago)} · falta ${fmt(p.restante)}`;

  return (
    <div
      style={{ borderBottom: isLast ? "none" : `1px solid ${T.line}`, background: p.ehHoje ? T.paperSoft : "transparent" }}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2.5"
    >
      <div className="min-w-0">
        <div style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-sm flex items-center gap-1.5 flex-wrap">
          <span style={{ color: T.muted }}>{p.numero}.</span>
          <span style={{ textDecoration: p.quitada ? "line-through" : "none", opacity: p.quitada ? 0.6 : 1 }}>{fmtDataCurta(p.vencimento)}</span>
          <span className="tabular-nums">{fmt(p.valor)}</span>
          {p.ehHoje && !p.quitada && <Tag cor={T.goldSoft}>hoje</Tag>}
          {p.atrasada && <Tag cor={T.red}>atrasada</Tag>}
          {p.quitada && <Tag cor={T.green}>paga</Tag>}
          {p.pagamentos.some((x) => x.pendente) && <Tag cor={T.goldSoft}>a enviar</Tag>}
        </div>
        {detalhe && <div style={{ color: T.muted }} className="text-[11px] mt-0.5">{detalhe}</div>}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <BaixaControls parcela={p} onBaixar={onBaixar} onCancelar={onCancelar} />
        <button onClick={onEditar} title="Editar data/valor" style={{ color: T.muted }}><Pencil size={12} /></button>
      </div>
    </div>
  );
}

function Tag({ cor, children }) {
  return (
    <span style={{ color: cor, border: `1px solid ${cor}`, fontFamily: "'Inter', system-ui, sans-serif" }} className="text-[10px] uppercase tracking-wide rounded-full px-1.5 leading-4">
      {children}
    </span>
  );
}

// botões "Baixar" / "Cancelar baixa" de uma parcela. Baixar abre um campo já
// preenchido com o que falta da parcela — dá pra mudar pra baixa parcial
function BaixaControls({ parcela: p, onBaixar, onCancelar }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const v = parseFloat(valor);

  const confirmar = async () => {
    if (!(v > 0) || enviando) return;
    setEnviando(true);
    await onBaixar(Math.round(v * 100) / 100);
    setEnviando(false);
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="flex items-center gap-1.5">
        <DecimalField value={valor} onChange={setValor} className="w-24! py-1.5!" />
        <button onClick={confirmar} disabled={!(v > 0) || enviando} title="Confirmar baixa" style={{ background: v > 0 ? T.green : T.line, color: v > 0 ? T.onColor : T.muted }} className="rounded-full w-8 h-8 flex items-center justify-center shrink-0 disabled:cursor-not-allowed">
          <Check size={14} />
        </button>
        <button onClick={() => setEditando(false)} title="Desistir" style={{ color: T.muted }} className="shrink-0"><X size={14} /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {p.pago > 0 && (
        <button onClick={() => setConfirmCancelar(true)} style={{ color: T.red }} className="flex items-center gap-1 text-xs whitespace-nowrap">
          <Undo2 size={12} /> Cancelar baixa
        </button>
      )}
      {!p.quitada && (
        <button
          onClick={() => { setValor(String(Math.round(p.restante * 100) / 100)); setEditando(true); }}
          style={{ background: T.green, color: T.onColor }}
          className="rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap"
        >
          Baixar
        </button>
      )}
      {confirmCancelar && (
        <ConfirmModal
          title="Cancelar esta baixa?"
          message={`A baixa de ${fmt(p.pago)} desta parcela (vencimento ${fmtData(p.vencimento)}) deixa de contar e a parcela volta a ficar em aberto. Ela não é apagada: fica no histórico como cancelada, com data, hora e motivo.`}
          confirmLabel="Cancelar baixa"
          cancelLabel="Voltar"
          onCancel={() => setConfirmCancelar(false)}
          onConfirm={() => { setConfirmCancelar(false); onCancelar(motivo); setMotivo(""); }}
        >
          <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional) — ex.: lancei no cliente errado" />
        </ConfirmModal>
      )}
    </div>
  );
}

// editar data/valor de uma ou mais parcelas (usado pra editar uma parcela e
// pra reagendar as atrasadas)
function ParcelasModal({ titulo, descricao, linhas: iniciais, onClose, onSave }) {
  const [linhas, setLinhas] = useState(iniciais);
  const [salvando, setSalvando] = useState(false);
  const set = (i, campo, valor) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  const valido = linhas.every((l) => l.vencimento && parseFloat(l.valor) > 0);

  const salvar = async () => {
    setSalvando(true);
    await onSave(linhas.map((l) => ({ id: l.id, vencimento: l.vencimento, valor: Math.round(parseFloat(l.valor) * 100) / 100 })));
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div onClick={onClose} className="absolute inset-0" style={OVERLAY} />
      <div style={CARD} className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xl font-semibold">{titulo}</h2>
          <button onClick={onClose}><X size={20} style={{ color: T.muted }} /></button>
        </div>
        {descricao && <p style={{ color: T.muted }} className="text-sm mb-4">{descricao}</p>}

        <div className="space-y-3 mb-4">
          {linhas.map((l, i) => {
            const fer = l.vencimento ? nomeFeriado(l.vencimento) : null;
            return (
              <div key={l.id} style={{ background: T.paperSoft, border: `1px solid ${T.line}` }} className="rounded-xl p-3">
                <p style={{ color: T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs mb-2">
                  Parcela {l.numero} · era {fmtDataCurta(l.original)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span style={{ color: T.muted }} className="text-[10px] uppercase tracking-wide block mb-1">Nova data</span>
                    <DateField value={l.vencimento} onChange={(iso) => set(i, "vencimento", iso)} />
                  </div>
                  <div>
                    <span style={{ color: T.muted }} className="text-[10px] uppercase tracking-wide block mb-1">Valor</span>
                    <DecimalField value={l.valor} onChange={(v) => set(i, "valor", v)} />
                  </div>
                </div>
                {l.vencimento && (
                  <p style={{ color: fer ? T.red : T.muted }} className="text-[11px] mt-1.5">
                    {fmtDataCurta(l.vencimento)}{fer ? ` · feriado: ${fer}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <SubmitButton valid={valido} busy={salvando} label="Salvar" busyLabel="Salvando…" missing="data e valor maior que zero em todas" onClick={salvar} />
      </div>
    </div>
  );
}

function PaymentRow({ payment, onEdit, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(String(payment.valor));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [motivo, setMotivo] = useState("");
  const valorValido = parseFloat(valor) > 0;

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span style={{ color: T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs shrink-0">
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
      <span style={{ color: T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>{new Date(payment.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
      <div className="flex items-center gap-2">
        {payment.pendente && <Tag cor={T.goldSoft}>a enviar</Tag>}
        <span style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>{fmt(payment.valor)}</span>
        <button onClick={() => setEditing(true)} style={{ color: T.muted }} title="Corrigir valor"><Pencil size={11} /></button>
        <button onClick={() => setConfirmRemove(true)} style={{ color: T.red }} title="Cancelar este pagamento"><Undo2 size={12} /></button>
      </div>
      {confirmRemove && (
        <ConfirmModal
          title="Cancelar este pagamento?"
          message={`O pagamento de ${fmt(payment.valor)} recebido em ${fmtData(payment.data)} deixa de contar e o saldo volta a incluir esse valor. Ele não é apagado: fica no histórico como cancelado.`}
          confirmLabel="Cancelar pagamento"
          cancelLabel="Voltar"
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => { setConfirmRemove(false); onRemove(motivo); setMotivo(""); }}
        >
          <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-4" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" />
        </ConfirmModal>
      )}
    </div>
  );
}


function ConfirmModal({ title, message, onCancel, onConfirm, confirmLabel = "Remover", confirmColor = T.red, cancelLabel = "Cancelar", children }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div onClick={onCancel} className="absolute inset-0" style={OVERLAY} />
      <div style={CARD} className="relative w-full max-w-sm rounded-2xl p-5">
        <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-lg font-semibold mb-1.5">{title}</p>
        <p style={{ color: T.muted }} className="text-sm mb-4">{message}</p>
        {children}
        <div className="flex gap-2">
          <button onClick={onCancel} style={{ background: T.paperSoft, color: T.textPaper, border: `1px solid ${T.line}` }} className="flex-1 rounded-full py-2.5 text-sm font-medium">{cancelLabel}</button>
          <button onClick={onConfirm} style={{ background: confirmColor, color: T.onColor }} className="flex-1 rounded-full py-2.5 text-sm font-medium">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- HOJE (previsão do dia) ----------------

function Hoje({ dados, onAbrirCliente, onBaixarParcela, onCancelarBaixa }) {
  const { itens, atrasados, previsto, recebido, falta, caixaHoje } = dados;
  const pct = previsto > 0 ? Math.min(100, (recebido / previsto) * 100) : 0;
  const pagos = itens.filter((i) => i.previsto - i.recebido <= 0.01).length;
  const dataExtenso = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Sun size={12} /> {dataExtenso}
      </p>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <HojeStat label="Previsto hoje" value={fmt(previsto)} />
        <HojeStat label="Recebido" value={fmt(recebido)} color={T.green} />
        <HojeStat label="Falta receber" value={fmt(falta)} color={falta > 0.01 ? T.red : T.green} />
      </div>

      <div style={{ background: T.inkSoft }} className="h-2 rounded-full overflow-hidden mb-2">
        <div style={{ width: `${pct}%`, background: T.green }} className="h-full rounded-full transition-all" />
      </div>
      <p style={{ color: T.muted }} className="text-xs mb-5">
        {itens.length > 0 ? `${pagos} de ${itens.length} cobrança${itens.length > 1 ? "s" : ""} de hoje já paga${pagos !== 1 ? "s" : ""} · ` : ""}
        Entrou no caixa hoje (contando atrasadas): <span style={{ color: T.textInk, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>{fmt(caixaHoje)}</span>
      </p>

      <p style={{ color: T.textInk }} className="text-sm font-medium mb-2">Para receber hoje</p>
      {itens.length === 0 ? (
        <div style={CARD} className="rounded-2xl p-6 text-center mb-5">
          <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-lg mb-1">Nenhuma cobrança pra hoje</p>
          <p style={{ color: T.muted }} className="text-sm">As parcelas que vencem hoje aparecem aqui, com o botão de dar baixa.</p>
        </div>
      ) : (
        <div style={CARD} className="rounded-2xl overflow-hidden mb-5">
          {itens.map((it, i) => (
            <HojeRow
              key={it.key}
              item={it}
              isLast={i === itens.length - 1}
              onAbrir={() => onAbrirCliente(it.cliente.id)}
              onBaixar={(valor) => onBaixarParcela(it.loan.id, it.parcela.id, valor)}
              onCancelar={(motivo) => onCancelarBaixa(it.parcela.pagamentos.map((x) => x.id), motivo)}
            />
          ))}
        </div>
      )}

      {atrasados.length > 0 && (
        <div>
          <p style={{ color: T.red }} className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Atrasados de outros dias ({atrasados.length}) · {fmt(atrasados.reduce((s, a) => s + a.valor, 0))}
          </p>
          <div style={CARD} className="rounded-2xl overflow-hidden">
            {atrasados.map((a, i) => (
              <button
                key={a.key}
                onClick={() => onAbrirCliente(a.cliente.id)}
                style={{ borderBottom: i === atrasados.length - 1 ? "none" : `1px solid ${T.line}` }}
                className="w-full flex items-center justify-between px-4 py-3 text-left active:opacity-70"
              >
                <div className="min-w-0">
                  <div style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="font-medium truncate">{a.cliente.nome}</div>
                  <div style={{ color: T.red, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs mt-0.5">
                    {a.qtd ? `${a.qtd} parcela${a.qtd > 1 ? "s" : ""} atrasada${a.qtd > 1 ? "s" : ""}` : "pagamento único"} · desde {fmtData(a.desde)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-3">
                  <span style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-sm font-semibold tabular-nums">{fmt(a.valor)}</span>
                  <ChevronRight size={16} style={{ color: T.muted }} />
                </div>
              </button>
            ))}
          </div>
          <p style={{ color: T.muted }} className="text-xs mt-2">Abra o cliente pra dar baixa ou reagendar as parcelas atrasadas.</p>
        </div>
      )}
    </div>
  );
}

function HojeStat({ label, value, color }) {
  return (
    <div style={CARD} className="rounded-2xl p-3">
      <div style={{ color: T.muted }} className="text-[10px] uppercase tracking-wide mb-1">{label}</div>
      <div style={{ color: color || T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-sm sm:text-lg font-semibold tabular-nums truncate">{value}</div>
    </div>
  );
}

function HojeRow({ item, isLast, onAbrir, onBaixar, onCancelar }) {
  const pago = item.previsto - item.recebido <= 0.01;
  const parcial = !pago && item.recebido > 0;
  return (
    <div style={{ borderBottom: isLast ? "none" : `1px solid ${T.line}` }} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
      <button onClick={onAbrir} className="min-w-0 text-left flex-1">
        <div style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", opacity: pago ? 0.6 : 1 }} className="font-medium truncate flex items-center gap-1.5">
          {item.cliente.nome}
          {pago && <Check size={14} style={{ color: T.green }} />}
        </div>
        <div style={{ color: T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs mt-0.5">
          {item.rotulo} · <span style={{ color: pago ? T.green : T.textPaper }}>{fmt(item.previsto)}</span>
          {parcial && <span style={{ color: T.red }}> · falta {fmt(item.previsto - item.recebido)}</span>}
        </div>
      </button>
      <div className="ml-auto">
        {item.parcela ? (
          <BaixaControls parcela={item.parcela} onBaixar={onBaixar} onCancelar={onCancelar} />
        ) : (
          <button onClick={onAbrir} style={{ color: T.goldSoft }} className="text-xs flex items-center gap-0.5">abrir <ChevronRight size={12} /></button>
        )}
      </div>
    </div>
  );
}

// ---------------- CONEXÃO (offline / fila) ----------------

function StatusConexao({ online, pendentes, sincronizando, copiaDe, onEnviar }) {
  if (online && pendentes === 0 && !copiaDe) return null;
  const offline = !online;
  return (
    <div
      style={{ background: offline ? T.amberTint : T.goldTint, color: T.textPaper, border: `1px solid ${offline ? "#F3D9B1" : "#BFE3DE"}` }}
      className="rounded-xl px-4 py-2.5 text-xs mb-4 flex flex-wrap items-center justify-between gap-2"
    >
      <span className="flex items-start gap-2 leading-relaxed">
        {offline ? <WifiOff size={15} style={{ color: T.amber }} className="shrink-0 mt-px" /> : <RefreshCw size={15} style={{ color: T.goldSoft }} className={`shrink-0 mt-px ${sincronizando ? "animate-spin" : ""}`} />}
        <span>
        {offline ? "Sem internet. " : ""}
        {pendentes > 0
          ? `${pendentes} operação${pendentes > 1 ? "ões" : ""} esperando pra enviar${offline ? " — vão sozinhas quando a internet voltar" : sincronizando ? " — enviando…" : ""}.`
          : offline
            ? "Você pode dar baixa e cancelar baixa normalmente; o resto precisa de internet."
            : ""}
        {copiaDe && ` Mostrando os dados salvos no aparelho em ${new Date(copiaDe).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.`}
        </span>
      </span>
      {online && pendentes > 0 && !sincronizando && (
        <button onClick={onEnviar} style={{ background: T.gold, color: T.onColor }} className="rounded-full px-3 py-1 text-xs font-medium">Enviar agora</button>
      )}
    </div>
  );
}

// ---------------- CAIXA (fechamento por período) ----------------

function intervaloDoPeriodo(periodo, de, ate) {
  const hoje = hojeISO();
  const d = parseISO(hoje);
  if (periodo === "hoje") return [hoje, hoje];
  if (periodo === "ontem") return [addDias(hoje, -1), addDias(hoje, -1)];
  if (periodo === "semana") return [addDias(hoje, -((d.getDay() + 6) % 7)), hoje]; // desde segunda
  if (periodo === "mes") return [`${hoje.slice(0, 7)}-01`, hoje];
  if (periodo === "mesPassado") {
    return [isoLocal(new Date(d.getFullYear(), d.getMonth() - 1, 1)), isoLocal(new Date(d.getFullYear(), d.getMonth(), 0))];
  }
  const a = de || hoje, b = ate || hoje;
  return a <= b ? [a, b] : [b, a];
}

function Caixa({ clients, onAbrirCliente }) {
  const [periodo, setPeriodo] = useState("hoje");
  const [de, setDe] = useState(hojeISO());
  const [ate, setAte] = useState(hojeISO());
  const [diaAberto, setDiaAberto] = useState(null);
  const [ini, fim] = intervaloDoPeriodo(periodo, de, ate);

  const dados = useMemo(() => {
    const entradas = [];
    const saidas = [];
    const estornos = [];
    let previsto = 0;
    clients.forEach((c) => {
      c.calc.emprestimos.forEach((l) => {
        const numero = {};
        if (l.calc.parcelado) l.calc.parcelas.forEach((p) => { numero[p.id] = `parcela ${p.numero}/${l.calc.parcelas.length}`; });
        l.pagamentos.forEach((p) => {
          if (p.data >= ini && p.data <= fim) {
            entradas.push({ id: p.id, data: p.data, valor: p.valor, cliente: c, ref: p.parcelaId ? numero[p.parcelaId] || "parcela" : "pagamento", pendente: p.pendente });
          }
        });
        if (l.dataEmprestimo >= ini && l.dataEmprestimo <= fim) {
          saidas.push({ id: l.id, data: l.dataEmprestimo, valor: l.valor, cliente: c });
        }
        l.estornos.forEach((e) => {
          const dia = isoLocal(new Date(e.estornadoEm));
          if (dia >= ini && dia <= fim) estornos.push({ ...e, dia, cliente: c, ref: e.parcelaId ? numero[e.parcelaId] || "parcela" : "pagamento" });
        });
        if (l.calc.parcelado) {
          l.calc.parcelas.forEach((p) => { if (p.vencimento >= ini && p.vencimento <= fim) previsto += p.valor; });
        }
      });
    });
    const porDia = {};
    const dia = (d) => (porDia[d] ||= { data: d, entradas: [], saidas: [], recebido: 0, emprestado: 0 });
    entradas.forEach((e) => { const x = dia(e.data); x.entradas.push(e); x.recebido += e.valor; });
    saidas.forEach((s) => { const x = dia(s.data); x.saidas.push(s); x.emprestado += s.valor; });
    const dias = Object.values(porDia).sort((a, b) => (a.data < b.data ? 1 : -1));
    dias.forEach((x) => x.entradas.sort((a, b) => a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR")));
    const recebido = entradas.reduce((s, e) => s + e.valor, 0);
    const emprestado = saidas.reduce((s, e) => s + e.valor, 0);
    estornos.sort((a, b) => (a.estornadoEm < b.estornadoEm ? 1 : -1));
    return { dias, entradas, saidas, estornos, recebido, emprestado, previsto };
  }, [clients, ini, fim]);

  const exportar = () => {
    const linhas = [["Data", "Tipo", "Cliente", "Referência", "Valor", "Observação"]];
    dados.dias.slice().reverse().forEach((d) => {
      d.entradas.forEach((e) => linhas.push([fmtData(e.data), "Recebimento", e.cliente.nome, e.ref, e.valor.toFixed(2), e.pendente ? "ainda não enviado ao banco" : ""]));
      d.saidas.forEach((s) => linhas.push([fmtData(s.data), "Empréstimo (saída)", s.cliente.nome, "", (-s.valor).toFixed(2), ""]));
    });
    dados.estornos.forEach((e) => linhas.push([fmtData(e.dia), "Baixa cancelada", e.cliente.nome, `${e.ref} de ${fmtData(e.data)}`, e.valor.toFixed(2), e.motivo]));
    linhas.push([]);
    linhas.push(["", "TOTAL RECEBIDO", "", "", dados.recebido.toFixed(2), ""]);
    linhas.push(["", "TOTAL EMPRESTADO", "", "", (-dados.emprestado).toFixed(2), ""]);
    linhas.push(["", "SALDO DO CAIXA", "", "", (dados.recebido - dados.emprestado).toFixed(2), ""]);
    const csv = linhas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agiopay-caixa-${ini}${ini !== fim ? `-a-${fim}` : ""}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saldo = dados.recebido - dados.emprestado;
  const opcoes = [["hoje", "Hoje"], ["ontem", "Ontem"], ["semana", "Semana"], ["mes", "Mês"], ["mesPassado", "Mês passado"], ["outro", "Escolher"]];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {opcoes.map(([k, label]) => (
          <button key={k} onClick={() => { setPeriodo(k); setDiaAberto(null); }} style={{ background: periodo === k ? T.gold : T.paper, color: periodo === k ? T.onColor : T.textInk, border: `1px solid ${periodo === k ? T.gold : T.line}` }} className="rounded-full px-3 py-1.5 text-xs font-medium">
            {label}
          </button>
        ))}
      </div>
      {periodo === "outro" && (
        <div style={CARD} className="rounded-2xl p-3 mb-3 grid grid-cols-2 gap-2">
          <div>
            <span style={{ color: T.muted }} className="text-[10px] uppercase tracking-wide block mb-1">De</span>
            <DateField value={de} onChange={setDe} />
          </div>
          <div>
            <span style={{ color: T.muted }} className="text-[10px] uppercase tracking-wide block mb-1">Até</span>
            <DateField value={ate} onChange={setAte} />
          </div>
        </div>
      )}
      <p style={{ color: T.muted }} className="text-xs mb-2">
        {ini === fim ? fmtData(ini) : `${fmtData(ini)} a ${fmtData(fim)}`}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
        <HojeStat label="Recebido" value={fmt(dados.recebido)} color={T.green} />
        <HojeStat label="Emprestado (saiu)" value={fmt(dados.emprestado)} color={T.red} />
        <HojeStat label="Saldo do caixa" value={fmt(saldo)} color={saldo >= 0 ? T.green : T.red} />
        <HojeStat label="Previsto (parcelas)" value={fmt(dados.previsto)} />
      </div>
      <p style={{ color: T.muted }} className="text-xs mb-4">
        {dados.entradas.length} baixa{dados.entradas.length !== 1 ? "s" : ""} · {dados.saidas.length} empréstimo{dados.saidas.length !== 1 ? "s" : ""} novo{dados.saidas.length !== 1 ? "s" : ""}
        {dados.estornos.length > 0 && ` · ${dados.estornos.length} baixa${dados.estornos.length > 1 ? "s" : ""} cancelada${dados.estornos.length > 1 ? "s" : ""}`}
        {" · "}
        <button onClick={exportar} style={{ color: T.goldSoft }} className="underline">exportar CSV</button>
      </p>

      {dados.dias.length === 0 ? (
        <div style={CARD} className="rounded-2xl p-6 text-center mb-4">
          <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-lg mb-1">Nada nesse período</p>
          <p style={{ color: T.muted }} className="text-sm">Nenhuma baixa e nenhum empréstimo novo entre essas datas.</p>
        </div>
      ) : (
        <div style={CARD} className="rounded-2xl overflow-hidden mb-4">
          {dados.dias.map((d, i) => {
            const aberto = diaAberto === d.data || dados.dias.length === 1;
            return (
              <div key={d.data} style={{ borderBottom: i === dados.dias.length - 1 ? "none" : `1px solid ${T.line}` }}>
                <button onClick={() => setDiaAberto(aberto ? null : d.data)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
                  <span style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-sm">{fmtDataCurta(d.data)}</span>
                  <span className="flex items-center gap-3 text-xs tabular-nums" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
                    <span style={{ color: T.green }}>+{fmt(d.recebido)}</span>
                    {d.emprestado > 0 && <span style={{ color: T.red }}>−{fmt(d.emprestado)}</span>}
                    {aberto ? <ChevronUp size={14} style={{ color: T.muted }} /> : <ChevronDown size={14} style={{ color: T.muted }} />}
                  </span>
                </button>
                {aberto && (
                  <div className="px-4 pb-3 space-y-1">
                    {d.entradas.map((e) => (
                      <button key={e.id} onClick={() => onAbrirCliente(e.cliente.id)} className="w-full flex justify-between gap-2 text-xs text-left">
                        <span style={{ color: T.textPaper }} className="truncate">
                          {e.cliente.nome} <span style={{ color: T.muted }}>· {e.ref}</span>
                          {e.pendente && <span style={{ color: T.goldSoft }}> · a enviar</span>}
                        </span>
                        <span style={{ color: T.green, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="shrink-0">+{fmt(e.valor)}</span>
                      </button>
                    ))}
                    {d.saidas.map((s) => (
                      <button key={s.id} onClick={() => onAbrirCliente(s.cliente.id)} className="w-full flex justify-between gap-2 text-xs text-left">
                        <span style={{ color: T.textPaper }} className="truncate">Empréstimo para {s.cliente.nome}</span>
                        <span style={{ color: T.red, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="shrink-0">−{fmt(s.valor)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dados.estornos.length > 0 && (
        <div>
          <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5"><Undo2 size={12} /> Baixas canceladas no período</p>
          <div style={CARD} className="rounded-2xl px-4 py-2 space-y-1.5">
            {dados.estornos.map((e) => (
              <div key={e.id} className="text-xs flex justify-between gap-2">
                <span style={{ color: T.textPaper }} className="min-w-0">
                  {e.cliente.nome} <span style={{ color: T.muted }}>· {e.ref} de {fmtData(e.data)} · cancelada {new Date(e.estornadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{e.motivo ? ` · “${e.motivo}”` : ""}</span>
                </span>
                <span style={{ color: T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", textDecoration: "line-through" }} className="shrink-0">{fmt(e.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- AGENDA ----------------

function NotifDropdown({ itens, onClose, onClickItem, onVerAgenda }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" />
      <div style={{ ...CARD, border: `1px solid ${T.line}` }} className="absolute right-0 top-12 z-50 w-72 rounded-2xl overflow-hidden shadow-xl">
        <div style={{ borderBottom: `1px solid ${T.line}` }} className="px-4 py-3">
          <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="font-medium text-sm">Vencimentos de hoje e atrasados</p>
        </div>
        {itens.length === 0 ? (
          <p style={{ color: T.muted }} className="text-sm px-4 py-6 text-center">Nada pra hoje. 🎉</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {itens.slice(0, 8).map((it) => (
              <button key={it.loanId} onClick={() => onClickItem(it.clienteId)} style={{ borderBottom: `1px solid ${T.line}` }} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
                <div className="min-w-0">
                  <div style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-sm truncate">{it.clienteNome}</div>
                  <div style={{ color: it.atrasado ? T.red : T.muted }} className="text-[11px]">
                    {it.atrasado ? `${it.diasAtraso}d atrasado` : "vence hoje"}
                  </div>
                </div>
                <span style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs font-medium shrink-0 pl-2">{fmt(it.saldo)}</span>
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
      <div style={CARD} className="rounded-2xl p-8 text-center">
        <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-lg mb-1">Nada por vir</p>
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
          <div style={CARD} className="rounded-2xl overflow-hidden">
            {atrasados.map((it, i) => (
              <AgendaRow key={it.loanId} item={it} isLast={i === atrasados.length - 1} onClick={() => onClickItem(it.clienteId)} />
            ))}
          </div>
        </div>
      )}
      {aVencer.length > 0 && (
        <div>
          <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-2">A vencer</p>
          <div style={CARD} className="rounded-2xl overflow-hidden">
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
        <div style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="font-medium truncate">{item.clienteNome}</div>
        <div style={{ color: item.atrasado ? T.red : T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs mt-0.5">
          {item.atrasado ? `venceu em ${item.vencimento.toLocaleDateString("pt-BR")} · ${item.diasAtraso}d atrasado` : `vence em ${item.vencimento.toLocaleDateString("pt-BR")}`}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pl-3">
        <span style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-sm font-semibold tabular-nums">{fmt(item.saldo)}</span>
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
      <div onClick={onClose} className="absolute inset-0" style={OVERLAY} />
      <div style={CARD} className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-lg font-semibold flex items-center gap-2">
            <FileText size={18} /> Termos de Uso
          </h2>
          <button onClick={onClose}><X size={20} style={{ color: T.muted }} /></button>
        </div>
        <pre style={{ color: T.textPaper, fontFamily: "'Inter', system-ui, sans-serif", whiteSpace: "pre-wrap" }} className="text-sm leading-relaxed">
          {TERMOS_TEXTO}
        </pre>
        <button onClick={onClose} style={{ background: T.gold, color: T.onColor }} className="w-full rounded-full py-3 text-sm font-medium mt-5">
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
    <div style={{ background: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-[100dvh] w-full flex items-center justify-center px-4">
      <div style={CARD} className="w-full max-w-lg rounded-3xl p-6 sm:p-7 max-h-[90dvh] overflow-y-auto">
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", color: T.textPaper }} className="text-2xl font-semibold text-center mb-1">
          Antes de continuar
        </h1>
        <p style={{ color: T.muted }} className="text-sm text-center mb-5">
          Pra usar o AGIOPAY, você precisa ler e aceitar os Termos de Uso.
        </p>

        <pre style={{ color: T.textPaper, fontFamily: "'Inter', system-ui, sans-serif", whiteSpace: "pre-wrap", background: T.paperSoft, border: `1px solid ${T.line}` }} className="text-sm leading-relaxed rounded-xl p-4 mb-5">
          {TERMOS_TEXTO}
        </pre>

        <label className="flex items-start gap-2 mb-5 select-none cursor-pointer">
          <input type="checkbox" checked={aceitou} onChange={(e) => setAceitou(e.target.checked)} className="mt-0.5" />
          <span style={{ color: T.textPaper }} className="text-sm">Li e aceito os Termos de Uso do AGIOPAY</span>
        </label>

        <button disabled={!aceitou || busy} onClick={confirmar} style={{ background: aceitou ? T.gold : T.line, color: aceitou ? T.onColor : T.muted }} className="w-full rounded-full py-3 text-sm font-medium disabled:opacity-60">
          {busy ? "Aguarda…" : "Aceitar e continuar"}
        </button>
      </div>
    </div>
  );
}

// Tela de login. Não existe cadastro público: as contas são criadas pelo
// painel /admin. O "esqueci minha senha" só aparece na tela de login do
// /admin (pra você, dono); quem usa o app pede uma senha nova pra você.
function AuthScreen({ permitirEsqueci = false }) {
  const [mode, setMode] = useState("login"); // login | esqueci
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showTermos, setShowTermos] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const emailValido = /\S+@\S+\.\S+/.test(email);

  const faltando = [];
  if (mode === "login") {
    if (!emailValido) faltando.push("email válido");
    if (senha.length < 6) faltando.push("senha com pelo menos 6 caracteres");
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
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
        if (error) setErr(traduzErro(error.message));
      } else if (mode === "esqueci") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: window.location.origin + window.location.pathname,
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
    <div style={{ background: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-[100dvh] w-full lg:grid lg:grid-cols-2">
      {/* painel da marca (desktop) */}
      <div style={{ background: `radial-gradient(circle at 20% 10%, #134E48 0%, ${T.nav} 55%)` }} className="hidden lg:flex flex-col justify-between p-12 xl:p-16">
        <Logo escuro grande />
        <div className="max-w-md">
          <h2 style={{ fontFamily: FONT_DISPLAY, color: T.navText, letterSpacing: "-0.02em" }} className="text-4xl xl:text-5xl font-extrabold leading-tight">
            Seu livro-caixa,<br /><span style={{ color: T.navAccent }}>sem caderno.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {[
              [Sun, "Saiba quem cobrar hoje e quanto falta entrar"],
              [CalendarClock, "Parcelas, juros e atrasos calculados sozinhos"],
              [WifiOff, "Dá baixa mesmo sem internet, na rua"],
            ].map(([Icon, txt]) => (
              <li key={txt} style={{ color: T.navText }} className="flex items-center gap-3 text-[15px]">
                <span style={{ background: T.navSoft, color: T.navAccent }} className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"><Icon size={18} /></span>
                {txt}
              </li>
            ))}
          </ul>
        </div>
        <p style={{ color: T.navMuted }} className="text-xs">© {new Date().getFullYear()} AGIOPAY</p>
      </div>

      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10">
      <div className="lg:hidden mb-7"><Logo grande /></div>
      <div style={CARD} className="w-full max-w-sm rounded-3xl p-7 sm:p-8">
        <h1 style={{ fontFamily: FONT_DISPLAY, color: T.textPaper, letterSpacing: "-0.02em" }} className="text-2xl font-bold">
          {mode === "login" ? "Entrar" : "Recuperar senha"}
        </h1>
        <p style={{ color: T.muted }} className="text-sm mt-1 mb-6">
          {mode === "login" ? "Use o email e a senha que você recebeu." : "Mandamos um link pro seu email."}
        </p>

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
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button type="button" onClick={() => setShowSenha((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }}>
                {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
        )}

        {mode === "login" && permitirEsqueci && (
          <button onClick={() => { setMode("esqueci"); setErr(""); setInfo(""); }} className="text-xs mb-4 -mt-2 block" style={{ color: T.goldSoft }}>
            Esqueci minha senha
          </button>
        )}

        {err && <p style={{ color: T.red }} className="text-xs mb-3 text-center">{err}</p>}
        {info && <p style={{ color: T.green }} className="text-xs mb-3 text-center">{info}</p>}

        <SubmitButton
          valid={valid}
          busy={busy}
          label={mode === "login" ? "Entrar" : "Enviar link de redefinição"}
          busyLabel="Aguarda…"
          missing={faltando.join(", ")}
          onClick={submit}
        />

        {mode === "esqueci" ? (
          <button onClick={() => { setMode("login"); setErr(""); setInfo(""); }} className="w-full text-center text-xs mt-4" style={{ color: T.goldSoft }}>
            Voltar para o login
          </button>
        ) : (
          <p style={{ color: T.muted }} className="text-center text-xs mt-4">Esqueceu a senha? Fale com quem te deu acesso ao AGIOPAY.</p>
        )}

        <button onClick={() => setShowTermos(true)} className="w-full text-center text-[11px] mt-3 flex items-center justify-center gap-1" style={{ color: T.muted }}>
          <FileText size={11} /> Ver Termos de Uso
        </button>
      </div>
      </div>

      {showTermos && <TermsModal onClose={() => setShowTermos(false)} />}
    </div>
  );
}

function AccountModal({ user, nomeUsuario, online, backupBusy, ultimoBackup, onBaixarBackup, onRestaurarBackup, onClose, onUpdated }) {
  const [arquivoRestaurar, setArquivoRestaurar] = useState(null);
  const [msgBackup, setMsgBackup] = useState(null); // { ok } | { erro }
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
      <div onClick={onClose} className="absolute inset-0" style={OVERLAY} />
      <div style={CARD} className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xl font-semibold flex items-center gap-2">
            <UserCircle size={20} /> Minha conta
          </h2>
          <button onClick={onClose}><X size={20} style={{ color: T.muted }} /></button>
        </div>

        <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1">Email</p>
        <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-sm mb-5">{user.email}</p>

        <Field label="Nome de usuário">
          <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        {errNome && <p style={{ color: T.red }} className="text-xs mb-2">{errNome}</p>}
        {msgNome && <p style={{ color: T.green }} className="text-xs mb-2">{msgNome}</p>}
        <div className="mb-6">
          <SubmitButton valid={nomeValido} busy={busyNome} label="Salvar nome" busyLabel="Salvando…" missing="nome" onClick={salvarNome} />
        </div>

        <div style={{ borderTop: `1px solid ${T.line}` }} className="pt-5 mb-6">
          <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="font-medium mb-1 flex items-center gap-2"><HardDriveDownload size={16} /> Backup</p>
          <p style={{ color: T.muted }} className="text-xs mb-3">
            Baixa um arquivo com tudo da sua conta: clientes, empréstimos, parcelas e pagamentos. Guarde fora do celular (Google Drive, email pra você mesmo).
            {" "}Último backup: <b>{ultimoBackup ? new Date(ultimoBackup).toLocaleDateString("pt-BR") : "nunca"}</b>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={onBaixarBackup} disabled={!online || backupBusy} style={{ background: T.green, color: T.onColor }} className="rounded-full px-4 py-2 text-xs font-medium disabled:opacity-50">
              {backupBusy ? "Aguarde…" : "Baixar backup"}
            </button>
            <label style={{ background: T.paperSoft, color: T.textPaper, border: `1px solid ${T.line}`, opacity: !online || backupBusy ? 0.5 : 1 }} className="rounded-full px-4 py-2 text-xs font-medium cursor-pointer">
              Restaurar de um backup
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                disabled={!online || backupBusy}
                onChange={(e) => { if (e.target.files?.[0]) { setArquivoRestaurar(e.target.files[0]); setMsgBackup(null); } e.target.value = ""; }}
              />
            </label>
          </div>
          {!online && <p style={{ color: T.muted }} className="text-xs mt-2">Backup precisa de internet.</p>}
          {msgBackup?.ok && <p style={{ color: T.green }} className="text-xs mt-2">{msgBackup.ok}</p>}
          {msgBackup?.erro && <p style={{ color: T.red }} className="text-xs mt-2">{msgBackup.erro}</p>}
        </div>

        {arquivoRestaurar && (
          <ConfirmModal
            title="Restaurar este backup?"
            message={`Arquivo: ${arquivoRestaurar.name}. Tudo que está no arquivo volta pro banco como estava no dia do backup (inclusive clientes e empréstimos que tinham sido apagados). O que você cadastrou depois do backup NÃO é apagado.`}
            confirmLabel="Restaurar"
            confirmColor={T.green}
            cancelLabel="Voltar"
            onCancel={() => setArquivoRestaurar(null)}
            onConfirm={async () => { const f = arquivoRestaurar; setArquivoRestaurar(null); setMsgBackup(await onRestaurarBackup(f)); }}
          />
        )}

        <div style={{ borderTop: `1px solid ${T.line}` }} className="pt-5">
            <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="font-medium mb-3">Trocar senha</p>
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
    <div style={{ background: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-[100dvh] w-full flex items-center justify-center px-4">
      <div style={CARD} className="w-full max-w-sm rounded-3xl p-7">
        <div className="flex justify-center mb-3"><KeyRound size={28} style={{ color: T.goldSoft }} /></div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", color: T.textPaper }} className="text-2xl font-semibold text-center mb-1">
          Nova senha
        </h1>

        {ok ? (
          <>
            <p style={{ color: T.green }} className="text-sm text-center mb-5">Senha alterada com sucesso!</p>
            <button onClick={onDone} style={{ background: T.gold, color: T.onColor }} className="w-full rounded-full py-3 text-sm font-medium">
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
    <div style={CARD} className="rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} style={{ color: accent || T.goldSoft }} />
        <span style={{ color: T.muted }} className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xl font-medium tabular-nums">{value}</div>
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

      <div style={{ background: totals.atrasados > 0 ? T.redTint : T.greenTint, color: totals.atrasados > 0 ? T.red : T.green, border: `1px solid ${totals.atrasados > 0 ? "#F4C7C2" : "#BFE3CB"}` }} className="rounded-2xl p-4 flex items-center justify-between mb-3 font-medium">
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
        <div style={CARD} className="rounded-2xl p-4 mb-3">
          <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-2.5">Mais atrasados</p>
          <div className="space-y-2">
            {atrasadosList.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>{c.nome}</span>
                <span style={{ color: T.red, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="font-medium">{c.calc.diasAtraso}d de atraso</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {donutData.length > 0 && (
          <div style={CARD} className="rounded-2xl p-4">
            <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1">Recebido x em aberto</p>
            <div style={{ height: 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={32} outerRadius={52} paddingAngle={3}>
                    {donutData.map((d, i) => (<Cell key={i} fill={d.color} stroke="none" />))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12 }} />
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

      <p style={{ color: T.muted, fontFamily: "'Inter', system-ui, sans-serif" }} className="text-xs text-center mt-2">
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
    <div style={CARD} className="rounded-2xl p-6 sm:p-10 text-center">
      <div
        style={{ background: T.paperSoft, border: `1px solid ${T.line}` }}
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
      >
        <Wallet size={24} style={{ color: T.goldSoft }} />
      </div>

      <h2 style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xl sm:text-2xl font-semibold mb-1.5">
        {nomeUsuario ? `Bem-vindo, ${nomeUsuario}!` : "Bem-vindo ao AGIOPAY!"}
      </h2>
      <p style={{ color: T.muted }} className="text-sm mb-6 max-w-sm mx-auto">
        Seu livro-caixa está vazio por enquanto. Cadastre o primeiro cliente pra começar a ver os juros, vencimentos e recebimentos organizados sozinhos.
      </p>

      <button
        onClick={onAddClient}
        style={{ background: T.gold, color: T.onColor }}
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
    <div style={CARD} className="rounded-2xl p-4">
      <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1">Evolução do recebido</p>
      <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-[11px] leading-snug mt-6 text-center opacity-70">
        Aparece assim que você registrar pagamentos ao longo dos meses.
      </p>
    </div>
  );
}

function EvolucaoChartWithData({ data }) {
  return (
    <div style={CARD} className="rounded-2xl p-4">
      <p style={{ color: T.muted }} className="text-xs uppercase tracking-wide mb-1">Evolução do recebido</p>
      <div style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={T.line} vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: T.muted }} axisLine={{ stroke: T.line }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : v)} />
            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 12 }} />
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
      style={CARD}
      className="w-full flex items-center justify-between rounded-2xl px-4 py-3.5 text-left active:opacity-70 transition-opacity"
    >
      <div className="min-w-0">
        <div style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="font-medium truncate flex items-center gap-1.5">
          {client.nome}
          {calc.atrasado && <AlertTriangle size={12} style={{ color: T.red }} />}
        </div>
        <div style={{ color: T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs mt-0.5">
          {calc.emprestimos.length} empréstimo{calc.emprestimos.length !== 1 ? "s" : ""}
          {calc.atrasado ? ` · ${calc.diasAtraso}d de atraso` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pl-3">
        <div className="text-right">
          <div style={{ color: positivo ? T.green : T.red, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-sm font-semibold tabular-nums">
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
    <div style={CARD} className="rounded-2xl p-8 text-center">
      <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-lg mb-1">{hasSearch ? "Ninguém com esse nome" : "Nenhum cliente ainda"}</p>
      <p style={{ color: T.muted }} className="text-sm mb-4">{hasSearch ? "Tenta buscar outro nome." : "Cadastre o primeiro empréstimo pra começar."}</p>
      {!hasSearch && (
        <button onClick={onAdd} style={{ background: T.gold, color: T.onColor }} className="rounded-full px-5 py-2 text-sm font-medium">Adicionar cliente</button>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3.5">
      <span style={{ color: T.muted, fontFamily: "'Inter', system-ui, sans-serif" }} className="text-xs uppercase tracking-wide block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputStyle = { background: T.paperSoft, color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", border: `1px solid ${T.line}` };

// botão de ação principal que muda de cor conforme o formulário está
// pronto ou não pra enviar, e explica o que falta preencher
function SubmitButton({ valid, busy, label, busyLabel, missing, onClick, className = "" }) {
  return (
    <div>
      <button
        disabled={!valid || busy}
        onClick={onClick}
        style={{
          background: busy ? T.line : valid ? T.gold : T.line,
          color: valid && !busy ? T.onColor : T.muted,
        }}
        className={`w-full rounded-full py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed ${className}`}
      >
        {busy ? (busyLabel || "Aguarda…") : label}
      </button>
      {!valid && !busy && missing && (
        <p style={{ color: T.muted }} className="text-xs text-center mt-2">
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
      <span style={{ color: T.muted, fontFamily: "'Inter', system-ui, sans-serif" }} className="text-xs uppercase tracking-wide block mb-1.5">
        Modelos salvos
      </span>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p, i) => (
          <div
            key={i}
            style={{ background: T.paperSoft, border: `1px solid ${T.line}` }}
            className="flex items-center gap-1 rounded-full pl-3 pr-1.5 py-1"
          >
            <button onClick={() => onPick(p)} style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs">
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

// escolha dos dias da semana em que a cobrança corre
function DiasCobrancaPicker({ dias, onChange }) {
  const atalhos = [["Seg–Sex", [1, 2, 3, 4, 5]], ["Seg–Sáb", [1, 2, 3, 4, 5, 6]], ["Todos", [0, 1, 2, 3, 4, 5, 6]]];
  const chave = [...dias].sort().join(",");
  const toggle = (d) => onChange(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort());
  return (
    <div className="mb-3.5">
      <span style={{ color: T.muted, fontFamily: "'Inter', system-ui, sans-serif" }} className="text-xs uppercase tracking-wide block mb-1.5">Dias de cobrança</span>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {atalhos.map(([label, ds]) => {
          const ativo = ds.join(",") === chave;
          return (
            <button key={label} type="button" onClick={() => onChange(ds)} style={{ background: ativo ? T.goldTint : T.paperSoft, color: ativo ? T.goldSoft : T.textPaper, border: `1px solid ${ativo ? T.gold : T.line}` }} className="rounded-full px-3 py-1 text-xs">
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((nome, d) => {
          const ativo = dias.includes(d);
          return (
            <button key={d} type="button" onClick={() => toggle(d)} style={{ background: ativo ? T.gold : T.paperSoft, color: ativo ? T.onColor : T.muted, border: `1px solid ${ativo ? T.gold : T.line}` }} className="rounded-lg py-1.5 text-xs font-medium">
              {nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// lista de datas geradas — dá pra trocar ou tirar qualquer uma (quando tira,
// o app coloca outra no final pra manter a quantidade de parcelas)
function DatasParcelasEditor({ form, setForm, geradas, puladas }) {
  const [editando, setEditando] = useState(null); // data gerada sendo trocada
  const trocas = form.trocas || {};
  const linhas = geradas.map((g) => ({ gerada: g, data: trocas[g] || g })).sort((a, b) => (a.data < b.data ? -1 : 1));
  const temAjustes = (form.removidas || []).length > 0 || Object.keys(trocas).length > 0;

  const remover = (g) => setForm((f) => {
    const t = { ...(f.trocas || {}) };
    delete t[g];
    return { ...f, trocas: t, removidas: [...(f.removidas || []), g] };
  });
  const trocar = (g, iso) => {
    setForm((f) => ({ ...f, trocas: { ...(f.trocas || {}), [g]: iso } }));
    setEditando(null);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ color: T.muted }} className="text-xs uppercase tracking-wide">Datas das parcelas ({linhas.length})</span>
        {temAjustes && (
          <button type="button" onClick={() => setForm((f) => ({ ...f, removidas: [], trocas: {} }))} style={{ color: T.goldSoft }} className="text-xs underline">desfazer ajustes</button>
        )}
      </div>
      <div style={{ background: T.paperSoft, border: `1px solid ${T.line}` }} className="rounded-xl p-2 max-h-56 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {linhas.map(({ gerada, data }, i) => (
            editando === gerada ? (
              <div key={gerada} className="col-span-2 sm:col-span-3 flex items-center gap-1.5">
                <span style={{ color: T.muted }} className="text-xs shrink-0">{i + 1}.</span>
                <DateField value={data} onChange={(iso) => trocar(gerada, iso)} />
                <button type="button" onClick={() => setEditando(null)} style={{ color: T.muted }}><X size={14} /></button>
              </div>
            ) : (
              <div key={gerada} style={{ ...CARD, border: `1px solid ${trocas[gerada] ? T.gold : T.line}` }} className="flex items-center justify-between rounded-lg pl-2 pr-1 py-1">
                <button type="button" onClick={() => setEditando(gerada)} title="Trocar data" style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs text-left">
                  <span style={{ color: T.muted }}>{i + 1}.</span> {fmtDataCurta(data)}
                </button>
                <button type="button" onClick={() => remover(gerada)} title="Tirar esta data" style={{ color: T.muted }}><X size={12} /></button>
              </div>
            )
          ))}
        </div>
      </div>
      <p style={{ color: T.muted }} className="text-[11px] mt-1.5">
        Toque numa data pra trocar; no × pra tirar (ex.: feriado da sua cidade). Tirando uma, outra entra no final.
        {puladas.length > 0 && ` Feriados pulados: ${puladas.map((p) => `${fmtDataCurta(p.data)} (${p.nome})`).join(", ")}.`}
      </p>
    </div>
  );
}

// campos do empréstimo, usados no cadastro de cliente e no "novo empréstimo"
function LoanFields({ form, setForm, editando, presets = [], onSavePreset, onRemovePreset }) {
  const set = (campo) => (v) => setForm((f) => ({ ...f, [campo]: v }));
  const parcelado = form.tipo === "parcelado";
  const { datas, geradas, puladas } = useMemo(() => (parcelado && !editando ? datasDoForm(form) : { datas: [], geradas: [], puladas: [] }), [form, parcelado, editando]);

  const previewUnico = useMemo(() => {
    if (parcelado) return null;
    const valor = parseFloat(form.valor);
    const taxa = parseFloat(form.taxaJuros);
    if (!valor || !taxa || !form.dataEmprestimo) return null;
    const prazoDias = parseInt(form.prazoDias || "30", 10) || 30;
    // mesma contagem do calcularEmprestimo: dias inteiros de calendário
    const diasDecorridos = Math.max(0, diasEntreISO(form.dataEmprestimo, hojeISO()));
    const periodos = Math.max(1, Math.ceil(diasDecorridos / prazoDias));
    const juros = valor * (taxa / 100) * periodos;
    return { periodos, prazoDias, juros, total: valor + juros };
  }, [parcelado, form.valor, form.taxaJuros, form.dataEmprestimo, form.prazoDias]);

  const valor = parseFloat(form.valor) || 0;
  const valorParcela = parseFloat(form.valorParcela) || 0;
  const totalParcelado = valorParcela * datas.length;

  return (
    <>
      {!editando && (
        <div className="flex gap-1 mb-4 p-1 rounded-full" style={{ background: T.paperSoft, border: `1px solid ${T.line}` }}>
          {[["parcelado", "Parcelado (diário)"], ["unico", "Pagamento único"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => set("tipo")(k)} style={{ background: form.tipo === k ? T.paper : "transparent", color: form.tipo === k ? T.goldSoft : T.muted, boxShadow: form.tipo === k ? T.shadow : "none" }} className="flex-1 rounded-full py-1.5 text-xs font-medium">
              {label}
            </button>
          ))}
        </div>
      )}

      {parcelado ? (
        <>
          <div className="grid grid-cols-2 gap-x-3">
            <Field label="Valor emprestado">
              <DecimalField value={form.valor} onChange={set("valor")} placeholder="0,00" />
            </Field>
            <Field label="Data do empréstimo">
              <DateField value={form.dataEmprestimo} onChange={set("dataEmprestimo")} />
            </Field>
          </div>

          {!editando && (
            <div className="grid grid-cols-2 gap-x-3">
              <Field label="Valor da parcela">
                <DecimalField value={form.valorParcela} onChange={set("valorParcela")} placeholder="0,00" />
              </Field>
              <Field label="Qtd. de parcelas">
                <IntegerField value={form.qtdParcelas} onChange={set("qtdParcelas")} placeholder="30" />
              </Field>
            </div>
          )}

          <DiasCobrancaPicker dias={form.diasCobranca} onChange={set("diasCobranca")} />

          <label className="flex items-center gap-2 mb-3.5 text-sm cursor-pointer" style={{ color: T.textPaper }}>
            <input type="checkbox" checked={form.pularFeriados} onChange={(e) => set("pularFeriados")(e.target.checked)} className="w-4 h-4 accent-[#3E6B4C]" />
            Pular feriados nacionais
          </label>

          {editando ? (
            <p style={{ color: T.muted }} className="text-xs mb-4">
              Os dias de cobrança e os feriados valem para as próximas vezes que você reagendar parcelas. Pra mudar a data ou o valor de uma parcela, use o lápis ao lado dela.
            </p>
          ) : (
            <>
              <Field label="Primeira cobrança">
                <DateField value={primeiraDoForm(form)} onChange={(iso) => setForm((f) => ({ ...f, primeiraCobranca: iso, primeiraManual: true }))} />
              </Field>

              {datas.length > 0 && <DatasParcelasEditor form={form} setForm={setForm} geradas={geradas} puladas={puladas} />}

              {valorParcela > 0 && datas.length > 0 && (
                <div style={{ background: T.paperSoft, border: `1px solid ${T.line}` }} className="rounded-xl p-3 mb-4 space-y-1.5">
                  <Row label={`Total a receber (${datas.length} × ${fmt(valorParcela)})`} value={fmt(totalParcelado)} bold />
                  {valor > 0 && <Row label={`Lucro (${Math.round((totalParcelado / valor - 1) * 100)}%)`} value={fmt(totalParcelado - valor)} color={totalParcelado >= valor ? T.greenSoft : T.red} />}
                  <Row label="Última parcela" value={fmtData(datas[datas.length - 1])} />
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <Field label="Valor emprestado">
              <DecimalField value={form.valor} onChange={set("valor")} placeholder="0,00" />
            </Field>
            <Field label="Juros % a.m.">
              <DecimalField value={form.taxaJuros} onChange={set("taxaJuros")} placeholder="30" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <Field label="Data do empréstimo">
              <DateField value={form.dataEmprestimo} onChange={set("dataEmprestimo")} />
            </Field>
            <Field label="Prazo (dias)">
              <IntegerField value={form.prazoDias} onChange={set("prazoDias")} placeholder="30" />
            </Field>
          </div>

          <PresetChips
            presets={presets}
            onPick={(p) => setForm((f) => ({ ...f, taxaJuros: String(p.taxaJuros), prazoDias: String(p.prazoDias) }))}
            onSave={() => onSavePreset(parseFloat(form.taxaJuros), parseInt(form.prazoDias || "0", 10))}
            onRemove={onRemovePreset}
            podeSalvar={parseFloat(form.taxaJuros) >= 0 && parseInt(form.prazoDias || "0", 10) > 0}
          />

          {previewUnico && (
            <div style={{ background: T.paperSoft, border: `1px solid ${T.line}` }} className="rounded-xl p-3 mb-4 space-y-1.5">
              <Row label={`Juros (${previewUnico.periodos} período${previewUnico.periodos > 1 ? "s" : ""} de ${previewUnico.prazoDias}d)`} value={fmt(previewUnico.juros)} color={T.greenSoft} />
              <Row label="Total devido hoje" value={fmt(previewUnico.total)} bold />
            </div>
          )}
        </>
      )}

      <Field label="Deixou alguma garantia? (opcional)">
        <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={form.garantia} onChange={(e) => set("garantia")(e.target.value)} placeholder="Ex: moto, TV, nenhuma" />
      </Field>
    </>
  );
}

function ClientLoanForm({ title, initial, onClose, onSave, presets = [], onSavePreset, onRemovePreset }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const faltando = [];
  if (!form.nome.trim()) faltando.push("nome");
  faltando.push(...validarEmprestimo(form, false));
  const valid = faltando.length === 0;

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div onClick={onClose} className="absolute inset-0" style={OVERLAY} />
      <div style={CARD} className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xl font-semibold">{title}</h2>
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

        <LoanFields form={form} setForm={setForm} presets={presets} onSavePreset={onSavePreset} onRemovePreset={onRemovePreset} />

        <Field label="Observações (opcional)">
          <textarea style={inputStyle} rows={3} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none" value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Ex: prometeu pagar dia 5…" />
        </Field>

        <SubmitButton valid={valid} busy={saving} label="Salvar" busyLabel="Salvando…" missing={faltando.join(", ")} onClick={handleSave} className="mt-2" />
      </div>
    </div>
  );
}

// formulário de um empréstimo isolado (novo ou edição, dentro do dossiê)
function LoanForm({ title, initial, editando = false, onClose, onSave, presets = [], onSavePreset, onRemovePreset }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const faltando = validarEmprestimo(form, editando);
  const valid = faltando.length === 0;

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div onClick={onClose} className="absolute inset-0" style={OVERLAY} />
      <div style={CARD} className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose}><X size={20} style={{ color: T.muted }} /></button>
        </div>

        <LoanFields form={form} setForm={setForm} editando={editando} presets={presets} onSavePreset={onSavePreset} onRemovePreset={onRemovePreset} />

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
      <div onClick={onClose} className="absolute inset-0" style={OVERLAY} />
      <div style={CARD} className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xl font-semibold">Editar cliente</h2>
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
      <span style={{ color: T.muted, fontFamily: "'Inter', system-ui, sans-serif" }}>{label}</span>
      <span style={{ color: color || T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontWeight: bold ? 600 : 400 }} className="tabular-nums">{value}</span>
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
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontSize: 18, margin: 0, color: "#14231C" }}>{client.nome}</h2>
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
                {l.calc.parcelado ? (
                  <ReportRow label={`Parcelas (${rotuloDias(l.diasCobranca)})`} value={`${l.calc.pagas}/${l.calc.parcelas.length} pagas${l.calc.atrasadas.length ? ` · ${l.calc.atrasadas.length} atrasada${l.calc.atrasadas.length > 1 ? "s" : ""}` : ""}`} />
                ) : (
                  <ReportRow label={`Juros (${l.taxaJuros}% a cada ${l.calc.prazoDias}d)`} value={`${l.calc.periodos} período${l.calc.periodos > 1 ? "s" : ""} — ${fmt(l.calc.juros)}`} />
                )}
                <ReportRow label="Total devido" value={fmt(l.calc.totalDevido)} bold />
                <ReportRow label="Total pago" value={fmt(l.calc.totalPago)} />
                <ReportRow label="Saldo em aberto" value={lp ? "R$ 0,00" : fmt(l.calc.saldo)} bold />
                {l.garantia && <ReportRow label="Garantia" value={l.garantia} />}
              </tbody>
            </table>
            {l.calc.parcelado && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #C8BA96", padding: "2px 0", fontWeight: 600 }}>Parcela</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #C8BA96", padding: "2px 0", fontWeight: 600 }}>Vencimento</th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #C8BA96", padding: "2px 0", fontWeight: 600 }}>Valor</th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #C8BA96", padding: "2px 0", fontWeight: 600 }}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {l.calc.parcelas.map((p) => (
                    <tr key={p.id}>
                      <td style={{ padding: "2px 0", borderBottom: "1px solid #ECE5D0" }}>{p.numero}</td>
                      <td style={{ padding: "2px 0", borderBottom: "1px solid #ECE5D0" }}>{fmtDataCurta(p.vencimento)}/{p.vencimento.slice(0, 4)}</td>
                      <td style={{ padding: "2px 0", borderBottom: "1px solid #ECE5D0", textAlign: "right" }}>{fmt(p.valor)}</td>
                      <td style={{ padding: "2px 0", borderBottom: "1px solid #ECE5D0", textAlign: "right" }}>
                        {p.quitada ? "paga" : p.pago > 0 ? `falta ${fmt(p.restante)}` : p.atrasada ? "atrasada" : "em aberto"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!l.calc.parcelado && l.pagamentos.length > 0 && (
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
    <div style={{ background: "#fff", minHeight: "100dvh", fontFamily: "'Inter', system-ui, sans-serif", color: "#14231C" }}>
      <div className="no-print" style={{ position: "sticky", top: 0, background: "#14231C", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
        <span style={{ color: "#EDE4CC", fontSize: 13 }}>Pré-visualização do PDF — use Cmd/Ctrl+P se a impressão não abrir sozinha</span>
        <button onClick={onClose} style={{ background: "#BE9552", color: "#14231C", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 500 }}>Voltar</button>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "3px solid #14231C", paddingBottom: 12, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", fontSize: 28, margin: 0 }}>AGIOPAY</h1>
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
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>{value}</div>
    </div>
  );
}

// ---------------- PAINEL ADMIN (/admin) ----------------
// Cadastro das contas de quem usa o AGIOPAY. A tela é só a interface: quem
// decide se a pessoa é admin e quem cria a conta é o servidor (api/admin.js).

async function chamarAdmin(acao, dados = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ acao, ...dados }),
  });
  let json = {};
  try {
    json = await r.json();
  } catch {
    json = { erro: "O servidor do painel não respondeu. Confira se a API está publicada e as variáveis de ambiente configuradas." };
  }
  if (!r.ok || json.erro) {
    const e = new Error(json.erro || "Erro inesperado.");
    e.status = r.status;
    throw e;
  }
  return json;
}

function gerarSenha() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

const fmtDataHora = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

function AdminPage() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [semAcesso, setSemAcesso] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await chamarAdmin("listar");
      setUsuarios(r.usuarios);
      setSemAcesso(false);
    } catch (e) {
      if (e.status === 403) setSemAcesso(true);
      else setErro(e.message);
    }
    setCarregando(false);
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (userId) carregar();
  }, [userId, carregar]);

  if (authLoading) return <CenteredMsg>Carregando…</CenteredMsg>;
  if (!session) return <AuthScreen permitirEsqueci />;

  if (semAcesso) {
    return (
      <div style={{ background: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-[100dvh] w-full flex items-center justify-center px-4">
        <div style={CARD} className="w-full max-w-sm rounded-3xl p-7 text-center">
          <ShieldCheck size={28} style={{ color: T.red, margin: "0 auto 10px" }} />
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", color: T.textPaper }} className="text-xl font-semibold mb-1.5">Sem acesso</h1>
          <p style={{ color: T.muted }} className="text-sm mb-5">A conta {session.user.email} não é administradora.</p>
          <div className="flex gap-2">
            <a href="/" style={{ background: T.paperSoft, color: T.textPaper, border: `1px solid ${T.line}` }} className="flex-1 rounded-full py-2.5 text-sm font-medium">Ir pro app</a>
            <button onClick={() => supabase.auth.signOut()} style={{ background: T.gold, color: T.onColor }} className="flex-1 rounded-full py-2.5 text-sm font-medium">Trocar conta</button>
          </div>
        </div>
      </div>
    );
  }

  const q = busca.trim().toLowerCase();
  const lista = q ? usuarios.filter((u) => u.email.toLowerCase().includes(q) || u.nome.toLowerCase().includes(q)) : usuarios;
  const atualizarUsuario = (u) => setUsuarios((us) => us.map((x) => (x.id === u.id ? u : x)));

  return (
    <div style={{ background: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }} className="min-h-[100dvh] w-full">
      <div className="max-w-3xl mx-auto px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", color: T.textInk }} className="text-base flex items-center gap-2">
              <Logo /> <span style={{ background: T.gold, color: T.onColor }} className="text-xs font-sans font-semibold rounded-full px-2 py-0.5 uppercase tracking-wide">admin</span>
            </h1>
            <p style={{ color: T.muted }} className="text-xs sm:text-sm mt-0.5 truncate">{session.user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" style={{ ...CARD, color: T.textInk, border: `1px solid ${T.line}` }} className="rounded-full px-4 py-2.5 text-sm">Ir pro app</a>
            <button onClick={() => supabase.auth.signOut()} title="Sair" style={{ ...CARD, color: T.textInk, border: `1px solid ${T.line}` }} className="flex items-center justify-center rounded-full w-10 h-10">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <AdminNovoUsuario onCriado={(u) => setUsuarios((us) => [u, ...us])} />

        <div className="flex items-center justify-between gap-2 mb-3 mt-6">
          <p style={{ color: T.textInk }} className="text-sm font-medium">Contas ({usuarios.length})</p>
          <button onClick={carregar} style={{ color: T.goldSoft }} className="text-xs underline">{carregando ? "atualizando…" : "atualizar"}</button>
        </div>
        <div className="relative mb-3">
          <Search size={16} style={{ color: T.muted }} className="absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou email…" style={{ ...CARD, color: T.textInk, border: `1px solid ${T.line}` }} className="w-full rounded-full pl-9 pr-4 py-2.5 text-sm outline-none placeholder:opacity-50" />
        </div>

        {erro && <div style={{ background: T.redTint, color: T.red, border: "1px solid #F4C7C2" }} className="rounded-xl px-4 py-3 text-sm mb-3">{erro}</div>}

        <div className="space-y-2">
          {lista.map((u) => (
            <AdminUsuarioRow key={u.id} usuario={u} euMesmo={u.id === session.user.id} onAtualizado={atualizarUsuario} />
          ))}
          {!carregando && lista.length === 0 && (
            <div style={{ ...CARD, color: T.muted }} className="rounded-2xl p-6 text-center text-sm">Nenhuma conta encontrada.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminNovoUsuario({ onCriado }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState(() => gerarSenha());
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [criado, setCriado] = useState(null); // { email, senha }
  const [copiado, setCopiado] = useState(false);

  const faltando = [];
  if (nome.trim().length < 2) faltando.push("nome");
  if (!/\S+@\S+\.\S+/.test(email)) faltando.push("email válido");
  if (senha.length < 6) faltando.push("senha com pelo menos 6 caracteres");

  const criar = async () => {
    setBusy(true);
    setErro("");
    try {
      const r = await chamarAdmin("criar", { nome: nome.trim(), email: email.trim().toLowerCase(), senha });
      onCriado(r.usuario);
      setCriado({ email: r.usuario.email, senha });
      setCopiado(false);
      setNome("");
      setEmail("");
      setSenha(gerarSenha());
    } catch (e) {
      setErro(e.message);
    }
    setBusy(false);
  };

  const textoAcesso = criado ? `Seu acesso ao AGIOPAY:\n${window.location.origin}\nEmail: ${criado.email}\nSenha: ${criado.senha}\n\nNo primeiro acesso, aceite os termos de uso. Depois é só usar.` : "";
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoAcesso);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div style={CARD} className="rounded-2xl p-4 sm:p-5">
      <p style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Plus size={18} /> Cadastrar cliente
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
        <Field label="Nome">
          <input style={inputStyle} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da pessoa" />
        </Field>
        <Field label="Email">
          <input style={inputStyle} type="email" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@email.com" />
        </Field>
      </div>
      <Field label="Senha inicial">
        <div className="flex gap-2">
          <input style={inputStyle} className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button type="button" onClick={() => setSenha(gerarSenha())} style={{ background: T.paperSoft, color: T.textPaper, border: `1px solid ${T.line}` }} className="rounded-lg px-3 text-xs whitespace-nowrap">Gerar outra</button>
        </div>
      </Field>
      {erro && <p style={{ color: T.red }} className="text-xs mb-3">{erro}</p>}
      <SubmitButton valid={faltando.length === 0} busy={busy} label="Criar conta" busyLabel="Criando…" missing={faltando.join(", ")} onClick={criar} />

      {criado && (
        <div style={{ background: T.paperSoft, border: `1px solid ${T.green}` }} className="rounded-xl p-3 mt-4">
          <p style={{ color: T.green }} className="text-sm font-medium mb-1.5 flex items-center gap-1.5"><Check size={14} /> Conta criada</p>
          <pre style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs whitespace-pre-wrap mb-2">{textoAcesso}</pre>
          <button onClick={copiar} style={{ background: T.green, color: T.onColor }} className="rounded-full px-4 py-1.5 text-xs font-medium">
            {copiado ? "Copiado!" : "Copiar pra mandar no WhatsApp"}
          </button>
        </div>
      )}
    </div>
  );
}

function AdminUsuarioRow({ usuario: u, euMesmo, onAtualizado }) {
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [confirmBloqueio, setConfirmBloqueio] = useState(false);

  const salvarSenha = async () => {
    setBusy(true);
    setErro("");
    setMsg("");
    try {
      await chamarAdmin("redefinir_senha", { id: u.id, senha: novaSenha });
      setMsg(`Senha nova: ${novaSenha}`);
      setTrocandoSenha(false);
    } catch (e) {
      setErro(e.message);
    }
    setBusy(false);
  };

  const alternarBloqueio = async () => {
    setConfirmBloqueio(false);
    setBusy(true);
    setErro("");
    setMsg("");
    try {
      const r = await chamarAdmin(u.bloqueado ? "desbloquear" : "bloquear", { id: u.id });
      onAtualizado(r.usuario);
    } catch (e) {
      setErro(e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{ ...CARD, opacity: u.bloqueado ? 0.75 : 1 }} className="rounded-2xl px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div style={{ color: T.textPaper, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="font-medium truncate flex items-center gap-1.5 flex-wrap">
            {u.nome || "(sem nome)"}
            {u.admin && <Tag cor={T.goldSoft}>admin</Tag>}
            {u.bloqueado && <Tag cor={T.red}>bloqueado</Tag>}
            {!u.ultimoAcesso && <Tag cor={T.muted}>nunca entrou</Tag>}
          </div>
          <div style={{ color: T.muted, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs mt-0.5 break-all">{u.email}</div>
          <div style={{ color: T.muted }} className="text-[11px] mt-0.5">criado {fmtDataHora(u.criadoEm)} · último acesso {fmtDataHora(u.ultimoAcesso)}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => { setTrocandoSenha((t) => !t); setNovaSenha(gerarSenha()); setMsg(""); }} style={{ color: T.goldSoft }} className="text-xs flex items-center gap-1">
            <KeyRound size={12} /> Nova senha
          </button>
          {!euMesmo && (
            <button onClick={() => setConfirmBloqueio(true)} disabled={busy} style={{ color: u.bloqueado ? T.green : T.red }} className="text-xs">
              {u.bloqueado ? "Desbloquear" : "Bloquear"}
            </button>
          )}
        </div>
      </div>

      {trocandoSenha && (
        <div className="flex gap-2 mt-2.5">
          <input style={inputStyle} className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          <button onClick={salvarSenha} disabled={busy || novaSenha.length < 6} style={{ background: novaSenha.length >= 6 ? T.green : T.line, color: novaSenha.length >= 6 ? T.onColor : T.muted }} className="rounded-lg px-3 text-xs font-medium disabled:cursor-not-allowed">
            {busy ? "…" : "Salvar"}
          </button>
        </div>
      )}
      {msg && <p style={{ color: T.green, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }} className="text-xs mt-2">{msg}</p>}
      {erro && <p style={{ color: T.red }} className="text-xs mt-2">{erro}</p>}

      {confirmBloqueio && (
        <ConfirmModal
          title={u.bloqueado ? `Desbloquear ${u.nome || u.email}?` : `Bloquear ${u.nome || u.email}?`}
          message={u.bloqueado
            ? "A pessoa volta a conseguir entrar no app. Os dados dela continuam como estavam."
            : "A pessoa não consegue mais entrar no app (em até 1 hora ela é desconectada). Os dados dela NÃO são apagados — dá pra desbloquear depois."}
          confirmLabel={u.bloqueado ? "Desbloquear" : "Bloquear"}
          confirmColor={u.bloqueado ? T.green : T.red}
          cancelLabel="Voltar"
          onCancel={() => setConfirmBloqueio(false)}
          onConfirm={alternarBloqueio}
        />
      )}
    </div>
  );
}

export default function App() {
  const ehAdmin = typeof window !== "undefined" && /^\/admin\/?$/.test(window.location.pathname);
  return <ErrorBoundary>{ehAdmin ? <AdminPage /> : <AppInner />}</ErrorBoundary>;
}
