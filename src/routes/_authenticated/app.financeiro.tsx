import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FocusEvent, type TouchEvent } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FileDown,
  Filter,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { generateMonthlyReport, type ReportData } from "@/lib/pdf-report";
import { generateReceipt, shortReceiptNumber } from "@/lib/receipt-pdf";
import { exportIRYearCSV } from "@/lib/ir-export";
import { MonthlyGoalCard } from "@/components/app/MonthlyGoalCard";
import { ExpensesPieChart } from "@/components/app/ExpensesPieChart";
import { FinanceHistoryCard } from "@/components/app/FinanceHistoryCard";
import {
  currentPeriod,
  inPeriod,
  isCurrentPeriod,
  periodLabel,
  periodRange,
  shiftPeriod,
  withMode,
  type Period,
  type PeriodMode,
} from "@/lib/finance-periods";


export const Route = createFileRoute("/_authenticated/app/financeiro")({
  component: FinanceiroPage,
});

type Receivable = {
  id: string;
  appointment_id: string | null;
  patient_id: string | null;
  amount_cents: number;
  status: "pending" | "paid" | "overdue" | "waived";
  due_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  description: string | null;
  owner_id: string;
};

type AppointmentLite = {
  id: string;
  starts_at: string;
  ends_at: string;
  patient_id: string | null;
  status: string;
  kind: string;
  title: string | null;
};

type PatientLite = { id: string; full_name: string };
type StatusFilter = "all" | "pending" | "paid" | "overdue" | "waived";

type Expense = {
  id: string;
  description: string;
  amount_cents: number;
  category: string | null;
  payment_method: string | null;
  paid_at: string;
};

const PAYMENT_METHODS = [
  { id: "pix", label: "PIX" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "cartao_credito", label: "Crédito" },
  { id: "cartao_debito", label: "Débito" },
  { id: "transferencia", label: "Transferência" },
] as const;

const EXPENSE_CATEGORIES = [
  "Aluguel",
  "Material",
  "Supervisão",
  "Marketing",
  "Software",
  "Impostos",
  "Outros",
];

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function focusMoneyInput(e: FocusEvent<HTMLInputElement> | TouchEvent<HTMLInputElement>) {
  e.currentTarget.focus();
  if ("select" in e.currentTarget) e.currentTarget.select();
}

function methodLabel(id: string | null | undefined) {
  if (!id) return "—";
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;
}

const STATUS_META: Record<Receivable["status"], { label: string; cls: string }> = {
  pending: { label: "A receber", cls: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  paid: { label: "Recebido", cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" },
  overdue: { label: "Atrasado", cls: "text-red-600 bg-red-500/10 border-red-500/30" },
  waived: { label: "Isento", cls: "text-muted-foreground bg-surface border-border/60" },
};

/** Status real: um "a receber" com vencimento no passado conta como atrasado. */
function effStatus(r: Receivable): Receivable["status"] {
  if (r.status === "pending" && r.due_at && new Date(r.due_at) < new Date()) return "overdue";
  return r.status;
}

function FinanceiroPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"receitas" | "despesas">("receitas");
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [appts, setAppts] = useState<Record<string, AppointmentLite>>({});
  const [patients, setPatients] = useState<Record<string, PatientLite>>({});
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<Period>(() => currentPeriod("mes"));
  const [defaultPrice, setDefaultPrice] = useState<string>("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    category: "Aluguel",
    payment_method: "pix",
  });
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    description: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    received: true,
    payment_method: "pix",
  });

  const addIncome = async () => {
    if (!user) return;
    const cents = Math.round(parseFloat(incomeForm.amount.replace(",", ".")) * 100);
    if (!incomeForm.description.trim() || Number.isNaN(cents) || cents <= 0) {
      return toast.error("Preencha descrição e valor");
    }
    const when = new Date(incomeForm.date + "T12:00:00").toISOString();
    const { error } = await supabase.from("appointment_receivables").insert({
      owner_id: user.id,
      appointment_id: null,
      patient_id: null,
      description: incomeForm.description.trim(),
      amount_cents: cents,
      status: incomeForm.received ? "paid" : "pending",
      due_at: when,
      paid_at: incomeForm.received ? when : null,
      payment_method: incomeForm.received ? incomeForm.payment_method : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Receita registrada");
    setIncomeForm({
      description: "",
      amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      received: true,
      payment_method: "pix",
    });
    setIncomeOpen(false);
    loadReceivables();
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("default_session_price_cents")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const v = (data as { default_session_price_cents?: number } | null)
          ?.default_session_price_cents;
        if (typeof v === "number" && v > 0) setDefaultPrice(String(v / 100));
      });
    loadAll();
  }, [user]);

  const loadAll = async () => {
    await Promise.all([loadReceivables(), loadExpenses()]);
  };

  const loadReceivables = async () => {
    if (!user) return;
    const { data: recs } = await supabase
      .from("appointment_receivables")
      .select("*")
      .order("due_at", { ascending: false })
      .limit(3000);
    const list = (recs as unknown as Receivable[]) ?? [];
    setReceivables(list);

    const apptIds = Array.from(
      new Set(list.map((r) => r.appointment_id).filter(Boolean) as string[]),
    );
    const patIds = Array.from(new Set(list.map((r) => r.patient_id).filter(Boolean) as string[]));
    if (apptIds.length) {
      const { data: a } = await supabase
        .from("appointments")
        .select("id, starts_at, ends_at, patient_id, status, kind, title")
        .in("id", apptIds);
      const m: Record<string, AppointmentLite> = {};
      for (const row of (a as unknown as AppointmentLite[]) ?? []) m[row.id] = row;
      setAppts(m);
    }
    if (patIds.length) {
      const { data: p } = await supabase
        .from("patients")
        .select("id, full_name")
        .in("id", patIds);
      const m: Record<string, PatientLite> = {};
      for (const row of (p as unknown as PatientLite[]) ?? []) m[row.id] = row;
      setPatients(m);
    }
  };

  const loadExpenses = async () => {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("paid_at", { ascending: false })
      .limit(3000);
    setExpenses((data as unknown as Expense[]) ?? []);
  };

  /** Recebíveis do período selecionado (data de pagamento, ou vencimento se ainda não pago). */
  const periodReceivables = useMemo(
    () => receivables.filter((r) => inPeriod(r.paid_at ?? r.due_at, period)),
    [receivables, period],
  );
  const periodExpenses = useMemo(
    () => expenses.filter((e) => inPeriod(e.paid_at, period)),
    [expenses, period],
  );

  const filtered = useMemo(
    () =>
      filter === "all"
        ? periodReceivables
        : periodReceivables.filter((r) => effStatus(r) === filter),
    [periodReceivables, filter],
  );

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: periodReceivables.length,
      pending: 0,
      paid: 0,
      overdue: 0,
      waived: 0,
    };
    for (const r of periodReceivables) c[effStatus(r)] += 1;
    return c;
  }, [periodReceivables]);

  const stats = useMemo(() => {
    let received = 0;
    let pending = 0;
    let overdue = 0;
    let spent = 0;
    for (const r of periodReceivables) {
      const st = effStatus(r);
      if (st === "paid") received += r.amount_cents;
      if (st === "pending") pending += r.amount_cents;
      if (st === "overdue") overdue += r.amount_cents;
    }
    for (const e of periodExpenses) spent += e.amount_cents;
    return { received, pending, overdue, expenses: spent, profit: received - spent };
  }, [periodReceivables, periodExpenses]);


  const updateReceivable = async (id: string, patch: Partial<Receivable>) => {
    const { error } = await supabase.from("appointment_receivables").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    loadReceivables();
  };

  const markPaid = (r: Receivable, method: string) => {
    updateReceivable(r.id, {
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_method: method,
    });
    setPayingId(null);
  };

  const setAmount = (r: Receivable, value: string) => {
    const cents = Math.round(parseFloat(value.replace(",", ".")) * 100);
    if (Number.isNaN(cents) || cents < 0) return;
    updateReceivable(r.id, { amount_cents: cents });
  };

  const saveDefaultPrice = async () => {
    if (!user) return;
    const cents = Math.round(parseFloat(defaultPrice.replace(",", ".")) * 100);
    if (Number.isNaN(cents) || cents < 0) return toast.error("Valor inválido");
    const { error } = await supabase
      .from("profiles")
      .update({ default_session_price_cents: cents })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Valor padrão salvo");
  };

  const addExpense = async () => {
    if (!user) return;
    const cents = Math.round(parseFloat(expenseForm.amount.replace(",", ".")) * 100);
    if (!expenseForm.description.trim() || Number.isNaN(cents) || cents <= 0) {
      return toast.error("Preencha descrição e valor");
    }
    const { error } = await supabase.from("expenses").insert({
      owner_id: user.id,
      description: expenseForm.description.trim(),
      amount_cents: cents,
      category: expenseForm.category,
      payment_method: expenseForm.payment_method,
      paid_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Despesa registrada");
    setExpenseForm({ description: "", amount: "", category: "Aluguel", payment_method: "pix" });
    setExpenseOpen(false);
    loadExpenses();
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Despesa removida");
    loadExpenses();
  };

  const deleteReceivable = async (id: string) => {
    if (!confirm("Excluir este recebível? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("appointment_receivables").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Recebível excluído");
    loadReceivables();
  };

  const downloadReport = async () => {
    if (!user) return;
    const range = periodRange(period);
    const prevRange = periodRange(shiftPeriod(period, -1));
    const monthStart = range.start.toISOString();
    const monthEnd = range.end.toISOString();
    const prevStart = prevRange.start.toISOString();
    const prevEnd = prevRange.end.toISOString();


    const [{ data: paidRecs }, { data: prevPaidRecs }, { data: prevExp }, { data: profile }, { data: doneAppts }] =
      await Promise.all([
        supabase
          .from("appointment_receivables")
          .select("amount_cents, payment_method, patient_id")
          .eq("status", "paid")
          .gte("paid_at", monthStart)
          .lte("paid_at", monthEnd),
        supabase
          .from("appointment_receivables")
          .select("amount_cents")
          .eq("status", "paid")
          .gte("paid_at", prevStart)
          .lte("paid_at", prevEnd),
        supabase
          .from("expenses")
          .select("amount_cents")
          .gte("paid_at", prevStart)
          .lte("paid_at", prevEnd),
        supabase.from("profiles").select("full_name, crp").eq("id", user.id).maybeSingle(),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("starts_at", monthStart)
          .lte("starts_at", monthEnd),
      ]);

    const paid = (paidRecs ?? []) as { amount_cents: number; payment_method: string | null; patient_id: string | null }[];
    const methodTotals: Record<string, number> = {};
    const patientTotals: Record<string, number> = {};
    for (const r of paid) {
      const m = r.payment_method ?? "outro";
      methodTotals[m] = (methodTotals[m] ?? 0) + r.amount_cents;
      if (r.patient_id) patientTotals[r.patient_id] = (patientTotals[r.patient_id] ?? 0) + r.amount_cents;
    }
    const monthExp = expenses.filter((e) => e.paid_at >= monthStart && e.paid_at <= monthEnd);
    const catTotals: Record<string, number> = {};
    for (const e of monthExp) {
      const c = e.category ?? "Outros";
      catTotals[c] = (catTotals[c] ?? 0) + e.amount_cents;
    }

    const topPatientIds = Object.entries(patientTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    const topPatients: { name: string; total: number }[] = [];
    if (topPatientIds.length) {
      const { data: pats } = await supabase
        .from("patients")
        .select("id, full_name")
        .in("id", topPatientIds);
      const map: Record<string, string> = {};
      for (const p of (pats ?? []) as { id: string; full_name: string }[]) map[p.id] = p.full_name;
      for (const id of topPatientIds) {
        topPatients.push({ name: map[id] ?? "Paciente", total: patientTotals[id] });
      }
    }

    const prevPaid = ((prevPaidRecs ?? []) as { amount_cents: number }[]).reduce((s, r) => s + r.amount_cents, 0);
    const prevExpenses = ((prevExp ?? []) as { amount_cents: number }[]).reduce((s, r) => s + r.amount_cents, 0);
    const prevProfit = prevPaid - prevExpenses;

    const prof = profile as { full_name?: string; crp?: string } | null;

    const data: ReportData = {
      monthLabel: periodLabel(period),
      professional: prof?.full_name ?? "Aline Dias",
      crp: prof?.crp ?? undefined,
      receivedCents: stats.received,
      expensesCents: stats.expenses,
      profitCents: stats.profit,
      toReceiveCents: stats.pending + stats.overdue,
      appointmentsCount: doneAppts?.length ?? 0,
      byMethod: Object.entries(methodTotals)
        .map(([method, total]) => ({ method, total }))
        .sort((a, b) => b.total - a.total),
      expensesByCategory: Object.entries(catTotals)
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
      topPatients,
      previousProfitCents: prevProfit,
    };
    const doc = generateMonthlyReport(data);
    doc.save(`relatorio-${format(range.start, "yyyy-MM-dd")}.pdf`);
    toast.success("Relatório baixado");
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Receitas, despesas e lucro do consultório.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:flex-wrap">
          <button
            onClick={() => {
              const year = periodRange(period).start.getFullYear();
              exportIRYearCSV(year, receivables as never, expenses as never, patients as never);
              toast.success(`Exportado IR ${year} (receitas + despesas)`);
            }}
            className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-3 rounded-lg border border-border/60 text-sm hover:bg-surface"
          >
            <FileDown className="h-4 w-4" /> IR (CSV)
          </button>
          <button
            onClick={downloadReport}
            className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-4 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90"
          >
            <FileDown className="h-4 w-4" />
            Relatório
          </button>
        </div>
      </div>

      {/* Seletor de período: semana / mês / ano, com histórico navegável */}
      <div className="mb-6 rounded-2xl border border-border/60 bg-surface/40 p-3 md:p-4 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-background/60 border border-border/60 w-fit">
          {([
            { id: "semana", label: "Semana" },
            { id: "mes", label: "Mês" },
            { id: "ano", label: "Ano" },
          ] as { id: PeriodMode; label: string }[]).map((m) => (
            <button
              key={m.id}
              onClick={() => setPeriod((p) => withMode(p, m.id))}
              className={`px-3 h-9 rounded-lg text-xs font-medium transition-colors ${
                period.mode === m.id ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <button
            onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
            className="h-9 w-9 grid place-items-center rounded-lg border border-border/60 hover:bg-surface"
            aria-label="Período anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-medium capitalize text-center min-w-0 truncate">
            {periodLabel(period)}
          </div>
          <button
            onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
            className="h-9 w-9 grid place-items-center rounded-lg border border-border/60 hover:bg-surface"
            aria-label="Período seguinte"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentPeriod(period) && (
            <button
              onClick={() => setPeriod((p) => currentPeriod(p.mode))}
              className="h-9 px-3 rounded-lg border border-border/60 text-xs hover:bg-surface"
            >
              Atual
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <MonthlyGoalCard receivedCents={stats.received} pendingCents={stats.pending + stats.overdue} />
        <ExpensesPieChart expenses={periodExpenses as never} />
      </div>


      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Recebido" value={brl(stats.received)} tone="emerald" />
        <StatCard label="Despesas" value={brl(stats.expenses)} tone="red" icon="down" />
        <StatCard
          label="Lucro do período"
          value={brl(stats.profit)}
          tone={stats.profit >= 0 ? "emerald" : "red"}
          icon="up"
          highlight
        />
        <StatCard label="A receber" value={brl(stats.pending + stats.overdue)} tone="amber" />
      </div>

      <div className="rounded-2xl border border-border/60 bg-surface/40 p-4 md:p-5 mb-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Valor padrão da consulta</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Aplicado em novos recebíveis automaticamente.
          </div>
        </div>
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:w-auto">
          <span className="text-sm text-muted-foreground">R$</span>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            pattern="[0-9]*[,.]?[0-9]*"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            onFocus={focusMoneyInput}
            onTouchStart={focusMoneyInput}
            placeholder="200,00"
            className="h-11 min-w-0 w-full sm:w-32 px-3 rounded-lg bg-background border border-border/60 text-base sm:text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <button
            onClick={saveDefaultPrice}
            className="h-11 px-4 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90"
          >
            Salvar
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 p-1 rounded-xl bg-surface/40 border border-border/60 w-fit">
        <button
          onClick={() => setTab("receitas")}
          className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors ${tab === "receitas" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >
          Receitas
        </button>
        <button
          onClick={() => setTab("despesas")}
          className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors ${tab === "despesas" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
        >
          Despesas
        </button>
      </div>

      {tab === "receitas" && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {(["all", "pending", "paid", "overdue", "waived"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 h-8 rounded-full text-xs whitespace-nowrap border transition-colors ${
                    filter === s
                      ? "bg-foreground text-background border-foreground"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "all" ? "Todos" : STATUS_META[s].label} ({counts[s]})
                </button>
              ))}
            </div>
            <button
              onClick={() => setIncomeOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova receita
            </button>
          </div>

          {incomeOpen && (
            <div className="rounded-2xl border border-border/60 bg-surface/40 p-4 mb-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Descrição</label>
                <input
                  value={incomeForm.description}
                  onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                  placeholder="Ex: Palestra na escola X"
                  className="mt-1 w-full h-11 px-3 rounded-lg bg-background border border-border/60 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  pattern="[0-9]*[,.]?[0-9]*"
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                  onFocus={focusMoneyInput}
                  onTouchStart={focusMoneyInput}
                  placeholder="500,00"
                  className="mt-1 w-full h-11 px-3 rounded-lg bg-background border border-border/60 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data</label>
                <input
                  type="date"
                  value={incomeForm.date}
                  onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
                  className="mt-1 w-full h-11 px-3 rounded-lg bg-background border border-border/60 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Situação</label>
                <div className="mt-1 flex gap-1 flex-wrap">
                  <button
                    onClick={() => setIncomeForm({ ...incomeForm, received: true })}
                    className={`h-9 px-3 rounded-lg text-xs border transition-colors ${incomeForm.received ? "bg-foreground text-background border-foreground" : "border-border/60 hover:bg-surface"}`}
                  >
                    Já recebido
                  </button>
                  <button
                    onClick={() => setIncomeForm({ ...incomeForm, received: false })}
                    className={`h-9 px-3 rounded-lg text-xs border transition-colors ${!incomeForm.received ? "bg-foreground text-background border-foreground" : "border-border/60 hover:bg-surface"}`}
                  >
                    A receber
                  </button>
                </div>
              </div>
              {incomeForm.received && (
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground">Forma de pagamento</label>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setIncomeForm({ ...incomeForm, payment_method: m.id })}
                        className={`h-9 px-3 rounded-lg text-xs border transition-colors ${
                          incomeForm.payment_method === m.id
                            ? "bg-foreground text-background border-foreground"
                            : "border-border/60 hover:bg-surface"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  onClick={() => setIncomeOpen(false)}
                  className="h-10 px-4 rounded-lg text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={addIncome}
                  className="h-10 px-5 rounded-lg bg-brand text-primary-foreground text-sm font-medium hover:opacity-90"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/60 bg-surface/40 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhum recebível neste período.
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {filtered.map((r) => {
                  const ap = r.appointment_id ? appts[r.appointment_id] : undefined;
                  const patient = r.patient_id ? patients[r.patient_id] : undefined;
                  const meta = STATUS_META[effStatus(r)];
                  const isPicking = payingId === r.id;
                  return (
                    <li key={r.id} className="p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {patient?.full_name ?? r.description ?? "Sem paciente"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {ap
                              ? format(parseISO(ap.starts_at), "dd 'de' MMM, HH:mm", { locale: ptBR })
                              : r.description
                                ? "Receita avulsa"
                                : "Consulta"}
                            {r.payment_method ? ` · ${methodLabel(r.payment_method)}` : ""}
                          </div>
                        </div>
                        <span className={`text-[11px] px-2 py-1 rounded-full border shrink-0 ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <button
                          onClick={() => deleteReceivable(r.id)}
                          className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          aria-label="Excluir recebível"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            enterKeyHint="done"
                            autoComplete="off"
                            pattern="[0-9]*[,.]?[0-9]*"
                            defaultValue={(r.amount_cents / 100).toFixed(2).replace(".", ",")}
                            onFocus={focusMoneyInput}
                            onTouchStart={focusMoneyInput}
                            onBlur={(e) => {
                              const cents = Math.round(parseFloat(e.target.value.replace(",", ".")) * 100);
                              if (!Number.isNaN(cents) && cents !== r.amount_cents) setAmount(r, e.target.value);
                            }}
                            className="h-10 w-28 px-2 rounded-lg bg-background border border-border/60 text-base sm:text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring/40"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarClock className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Vence</span>
                          <input
                            type="date"
                            defaultValue={r.due_at ? r.due_at.slice(0, 10) : ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              updateReceivable(r.id, { due_at: new Date(v + "T12:00:00").toISOString() });
                            }}
                            className="h-9 px-2 rounded-lg bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
                          />
                        </label>
                        {r.status !== "paid" && !isPicking && (
                          <>
                            <button
                              onClick={() => setPayingId(r.id)}
                              className="h-9 px-3 rounded-lg text-xs bg-emerald-600 text-white hover:opacity-90 inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Recebido
                            </button>
                            {r.status !== "overdue" && (
                              <button
                                onClick={() => updateReceivable(r.id, { status: "overdue" })}
                                className="h-9 px-3 rounded-lg text-xs border border-red-500/40 bg-red-500/10 text-red-600 hover:bg-red-500/20 inline-flex items-center gap-1"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Atrasado
                              </button>
                            )}
                            {r.status === "overdue" && (
                              <button
                                onClick={() => updateReceivable(r.id, { status: "pending" })}
                                className="h-9 px-3 rounded-lg text-xs border border-border/60 hover:bg-surface text-muted-foreground inline-flex items-center gap-1"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                A receber
                              </button>
                            )}
                            {r.status !== "waived" && (
                              <button
                                onClick={() => updateReceivable(r.id, { status: "waived" })}
                                className="h-9 px-3 rounded-lg text-xs border border-border/60 hover:bg-surface text-muted-foreground inline-flex items-center gap-1"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Isento
                              </button>
                            )}
                          </>
                        )}
                        {isPicking && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {PAYMENT_METHODS.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => markPaid(r, m.id)}
                                className="h-9 px-3 rounded-lg text-xs border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                              >
                                {m.label}
                              </button>
                            ))}
                            <button
                              onClick={() => setPayingId(null)}
                              className="h-9 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                            >
                              cancelar
                            </button>
                          </div>
                        )}
                        {r.status === "paid" && (
                          <button
                            onClick={() =>
                              updateReceivable(r.id, { status: "pending", paid_at: null, payment_method: null })
                            }
                            className="h-9 px-3 rounded-lg text-xs border border-border/60 hover:bg-surface text-muted-foreground"
                          >
                            desfazer
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === "despesas" && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Aluguel, materiais, supervisão, marketing — tudo entra no cálculo do lucro.
            </p>
            <button
              onClick={() => setExpenseOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova despesa
            </button>
          </div>

          {expenseOpen && (
            <div className="rounded-2xl border border-border/60 bg-surface/40 p-4 mb-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Descrição</label>
                <input
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Ex: Aluguel da sala — junho"
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-background border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  pattern="[0-9]*[,.]?[0-9]*"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  onFocus={focusMoneyInput}
                  onTouchStart={focusMoneyInput}
                  placeholder="1500,00"
                  className="mt-1 w-full h-11 px-3 rounded-lg bg-background border border-border/60 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Categoria</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="mt-1 w-full h-10 px-2 rounded-lg bg-background border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Forma de pagamento</label>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setExpenseForm({ ...expenseForm, payment_method: m.id })}
                      className={`h-9 px-3 rounded-lg text-xs border transition-colors ${
                        expenseForm.payment_method === m.id
                          ? "bg-foreground text-background border-foreground"
                          : "border-border/60 hover:bg-surface"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  onClick={() => setExpenseOpen(false)}
                  className="h-10 px-4 rounded-lg text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={addExpense}
                  className="h-10 px-5 rounded-lg bg-brand text-primary-foreground text-sm font-medium hover:opacity-90"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/60 bg-surface/40 overflow-hidden">
            {periodExpenses.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhuma despesa neste período.
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {periodExpenses.map((e) => (
                  <li key={e.id} className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.description}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(e.paid_at), "dd 'de' MMM", { locale: ptBR })}
                        {e.category ? ` · ${e.category}` : ""}
                        {e.payment_method ? ` · ${methodLabel(e.payment_method)}` : ""}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-red-600 shrink-0">
                      − {brl(e.amount_cents)}
                    </div>
                    <button
                      onClick={() => deleteExpense(e.id)}
                      className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="mt-6">
        <FinanceHistoryCard
          receivables={receivables as never}
          expenses={expenses as never}
          activeLabel={periodLabel(period)}
          onSelect={(p) => setPeriod(p)}
        />
      </div>
    </div>

  );
}

function StatCard({
  label,
  value,
  tone,
  icon = "up",
  highlight = false,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "red";
  icon?: "up" | "down";
  highlight?: boolean;
}) {
  const tones = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  } as const;
  const Icon = icon === "down" ? TrendingDown : icon === "up" ? TrendingUp : DollarSign;
  void Clock; // keep import for tree-shake safety
  return (
    <div
      className={`rounded-2xl border p-4 md:p-5 ${highlight ? "border-brand/40 bg-brand/5" : "border-border/60 bg-surface/40"}`}
    >
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${tones[tone]}`} />
        {label}
      </div>
      <div className={`text-xl md:text-2xl font-semibold tracking-tight mt-2 ${tones[tone]}`}>
        {value}
      </div>
    </div>
  );
}
