import {
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type PeriodMode = "semana" | "mes" | "ano";

/** Período selecionado: modo + uma data âncora (qualquer dia dentro do período). */
export type Period = { mode: PeriodMode; anchor: string };

export function currentPeriod(mode: PeriodMode = "mes"): Period {
  return { mode, anchor: new Date().toISOString() };
}

export function periodRange(p: Period): { start: Date; end: Date } {
  const d = new Date(p.anchor);
  if (p.mode === "semana") {
    return { start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }) };
  }
  if (p.mode === "ano") return { start: startOfYear(d), end: endOfYear(d) };
  return { start: startOfMonth(d), end: endOfMonth(d) };
}

export function periodLabel(p: Period): string {
  const { start, end } = periodRange(p);
  if (p.mode === "semana") {
    return `${format(start, "dd MMM", { locale: ptBR })} – ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
  }
  if (p.mode === "ano") return format(start, "yyyy");
  return format(start, "MMMM 'de' yyyy", { locale: ptBR });
}

export function shiftPeriod(p: Period, delta: number): Period {
  const d = new Date(p.anchor);
  const next =
    p.mode === "semana" ? addWeeks(d, delta) : p.mode === "ano" ? addYears(d, delta) : addMonths(d, delta);
  return { mode: p.mode, anchor: next.toISOString() };
}

/** Muda o modo mantendo a data âncora (mês atual → semana atual etc.). */
export function withMode(p: Period, mode: PeriodMode): Period {
  return { mode, anchor: p.anchor };
}

export function isCurrentPeriod(p: Period): boolean {
  const { start, end } = periodRange(p);
  const now = new Date();
  return now >= start && now <= end;
}

export function inPeriod(iso: string | null | undefined, p: Period): boolean {
  if (!iso) return false;
  const { start, end } = periodRange(p);
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/** Lista de períodos anteriores (incluindo o atual), do mais recente ao mais antigo. */
export function recentPeriods(mode: PeriodMode, count: number): Period[] {
  const base = currentPeriod(mode);
  return Array.from({ length: count }, (_, i) => shiftPeriod(base, -i));
}
