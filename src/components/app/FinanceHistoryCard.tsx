import { useMemo, useState } from "react";
import { History, ChevronRight } from "lucide-react";
import {
  inPeriod,
  periodLabel,
  recentPeriods,
  type Period,
  type PeriodMode,
} from "@/lib/finance-periods";

export type HistoryReceivable = {
  amount_cents: number;
  status: string;
  paid_at: string | null;
  due_at: string | null;
};
export type HistoryExpense = { amount_cents: number; paid_at: string };

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MODES: { id: PeriodMode; label: string; count: number }[] = [
  { id: "semana", label: "Semanas", count: 12 },
  { id: "mes", label: "Meses", count: 12 },
  { id: "ano", label: "Anos", count: 5 },
];

/** Histórico salvo de receitas/despesas/lucro por semana, mês e ano. */
export function FinanceHistoryCard({
  receivables,
  expenses,
  onSelect,
  activeLabel,
}: {
  receivables: HistoryReceivable[];
  expenses: HistoryExpense[];
  onSelect: (p: Period) => void;
  activeLabel?: string;
}) {
  const [mode, setMode] = useState<PeriodMode>("mes");
  const cfg = MODES.find((m) => m.id === mode)!;

  const rows = useMemo(() => {
    return recentPeriods(mode, cfg.count).map((p) => {
      let received = 0;
      let toReceive = 0;
      for (const r of receivables) {
        if (r.status === "paid") {
          if (inPeriod(r.paid_at, p)) received += r.amount_cents;
        } else if (r.status !== "waived" && inPeriod(r.due_at, p)) {
          toReceive += r.amount_cents;
        }
      }
      let spent = 0;
      for (const e of expenses) if (inPeriod(e.paid_at, p)) spent += e.amount_cents;
      return { period: p, label: periodLabel(p), received, spent, toReceive, profit: received - spent };
    });
  }, [receivables, expenses, mode, cfg.count]);

  const hasData = rows.some((r) => r.received || r.spent || r.toReceive);

  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-semibold">Histórico</h2>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-background/60 border border-border/60">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 h-8 rounded-lg text-xs font-medium transition-colors ${
                mode === m.id ? "bg-foreground text-background" : "text-muted-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Ainda sem movimento registrado nesse intervalo.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/50">
          {rows.map((row) => (
            <li key={row.label}>
              <button
                onClick={() => onSelect(row.period)}
                className={`w-full text-left py-3 px-2 -mx-2 rounded-xl hover:bg-surface transition-colors ${
                  activeLabel === row.label ? "bg-brand/5" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize flex-1 min-w-0 truncate">
                    {row.label}
                  </span>
                  <span
                    className={`text-sm font-semibold shrink-0 ${row.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {brl(row.profit)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Recebido {brl(row.received)} · Despesas {brl(row.spent)}
                  {row.toReceive ? ` · A receber ${brl(row.toReceive)}` : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Cada período fecha sozinho: os totais zeram no início de cada semana, mês e ano, e o histórico
        fica salvo aqui.
      </p>
    </div>
  );
}
