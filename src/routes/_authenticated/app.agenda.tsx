import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AppointmentFormSheet,
  type Appointment,
} from "@/components/app/AppointmentFormSheet";
import type { Patient } from "@/components/app/PatientFormSheet";
import { STATUS_STYLE, KIND_LABELS } from "@/lib/appointment-style";

export const Route = createFileRoute("/_authenticated/app/agenda")({
  component: AgendaPage,
});

const HOUR_START = 7;
const HOUR_END = 21;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

function AgendaPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [cursor, setCursor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);
  const [dayIndex, setDayIndex] = useState(0);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(cursor, i)),
    [cursor],
  );

  useEffect(() => {
    const idx = days.findIndex((d) => isSameDay(d, new Date()));
    setDayIndex(idx >= 0 ? idx : 0);
  }, [days]);

  const visibleDays = isMobile ? [days[Math.min(dayIndex, 6)]] : days;


  /** Consultas agendadas cujo horário já terminou passam a "Realizada" automaticamente. */
  const autoCompletePast = async () => {
    await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("kind", "consulta")
      .eq("status", "scheduled")
      .lt("ends_at", new Date().toISOString());
  };

  const load = async () => {
    await autoCompletePast();
    const from = days[0].toISOString();
    const to = addDays(days[6], 1).toISOString();
    const [a, p] = await Promise.all([
      supabase
        .from("appointments")
        .select("*")
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at"),
      supabase.from("patients").select("*").order("full_name"),
    ]);
    if (a.error) toast.error(a.error.message);
    else setAppointments((a.data ?? []) as unknown as Appointment[]);
    if (!p.error) setPatients((p.data ?? []) as Patient[]);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, cursor]);

  const handleSlot = (day: Date, hour: number) => {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    setEditing(null);
    setInitialDate(d);
    setOpen(true);
  };

  const handleAppointment = (a: Appointment) => {
    setEditing(a);
    setInitialDate(null);
    setOpen(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-24 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground capitalize">
            {format(days[0], "d 'de' MMMM", { locale: ptBR })} —{" "}
            {format(days[6], "d 'de' MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-border/60 bg-surface/40">
            <button
              onClick={() => setCursor(addWeeks(cursor, -1))}
              className="h-9 w-9 grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCursor(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              title="Voltar para hoje"
              className="px-3 h-9 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border-x border-border/60 min-w-[120px] md:min-w-[140px] capitalize"
            >
              {format(days[0], "d MMM", { locale: ptBR })} –{" "}
              {format(days[6], "d MMM", { locale: ptBR })}
            </button>
            <button
              onClick={() => setCursor(addWeeks(cursor, 1))}
              className="h-9 w-9 grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* Desktop button */}
          <button
            onClick={() => {
              setEditing(null);
              setInitialDate(new Date());
              setOpen(true);
            }}
            className="hidden md:inline-flex items-center gap-2 rounded-xl bg-foreground text-background text-sm font-medium px-4 h-9 hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Novo compromisso
          </button>
        </div>
      </div>

      {/* Mobile FAB — above bottom nav (no AI ball anymore) */}
      <button
        onClick={() => {
          setEditing(null);
          setInitialDate(new Date());
          setOpen(true);
        }}
        className="md:hidden fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-brand text-primary-foreground text-sm font-medium pl-4 pr-5 h-12 shadow-lg hover:opacity-90 transition-opacity"
        aria-label="Novo compromisso"
      >
        <Plus className="h-5 w-5" />
        Novo
      </button>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
        {(Object.keys(STATUS_STYLE) as Array<keyof typeof STATUS_STYLE>).map((s) => {
          const st = STATUS_STYLE[s];
          return (
            <span key={s} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className={`h-2.5 w-2.5 rounded-sm border ${st.bg} ${st.border}`} />
              {st.label}
            </span>
          );
        })}
      </div>

      {/* Mobile day picker */}
      {isMobile && (
        <div className="mb-3 grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const active = i === dayIndex;
            const isToday = isSameDay(d, new Date());
            return (
              <button
                key={d.toISOString()}
                onClick={() => setDayIndex(i)}
                className={`rounded-lg py-2 text-center border transition-colors ${
                  active
                    ? "bg-foreground text-background border-transparent"
                    : "bg-surface/40 border-border/60 text-muted-foreground"
                }`}
              >
                <div className="text-[9px] uppercase tracking-wider">
                  {format(d, "EEEEEE", { locale: ptBR })}
                </div>
                <div
                  className={`text-sm font-semibold ${!active && isToday ? "text-[oklch(0.68_0.20_245)]" : ""}`}
                >
                  {format(d, "d")}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-surface/30 overflow-hidden">
        <div
          className="grid border-b border-border/60 bg-surface/40 sticky top-0 z-10"
          style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, minmax(0,1fr))` }}
        >
          <div />
          {visibleDays.map((d) => {
            const isToday = isSameDay(d, new Date());
            return (
              <div
                key={d.toISOString()}
                className="px-3 py-3 border-l border-border/40 text-center"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {format(d, "EEE", { locale: ptBR })}
                </div>
                <div
                  className={`mt-1 text-lg font-semibold ${
                    isToday ? "text-[oklch(0.68_0.20_245)]" : "text-foreground"
                  }`}
                >
                  {format(d, "d")}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="grid relative"
          style={{ gridTemplateColumns: `60px repeat(${visibleDays.length}, minmax(0,1fr))` }}
        >
          <div>
            {HOURS.map((h) => (
              <div
                key={h}
                className="h-16 border-b border-border/30 text-[10px] text-muted-foreground pr-2 text-right pt-1"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {visibleDays.map((d) => {
            const dayApps = appointments.filter((a) =>
              isSameDay(parseISO(a.starts_at), d),
            );
            return (
              <div key={d.toISOString()} className="relative border-l border-border/40">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    onClick={() => handleSlot(d, h)}
                    className="block w-full h-16 border-b border-border/30 hover:bg-surface/60 transition-colors"
                  />
                ))}
                {dayApps.map((a) => {
                  const start = parseISO(a.starts_at);
                  const end = parseISO(a.ends_at);
                  const startMin = start.getHours() * 60 + start.getMinutes();
                  const offset = ((startMin - HOUR_START * 60) / 60) * 64;
                  const heightMin = (end.getTime() - start.getTime()) / 60000;
                  const height = Math.max((heightMin / 60) * 64 - 4, 30);
                  const patient = patients.find((p) => p.id === a.patient_id);
                  const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.scheduled;
                  const kindLabel =
                    a.kind === "outro" && a.custom_kind
                      ? a.custom_kind
                      : KIND_LABELS[a.kind ?? "consulta"];
                  const headline =
                    a.kind === "consulta"
                      ? patient?.full_name ?? a.title ?? "Consulta"
                      : a.title ?? kindLabel;
                  return (
                    <button
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAppointment(a);
                      }}
                      className={`absolute left-1 right-1 rounded-lg border backdrop-blur-sm px-2 py-1.5 text-left overflow-hidden transition-all hover:scale-[1.01] hover:shadow-[0_8px_24px_-8px_oklch(0.55_0.22_260/0.5)] ${st.bg} ${st.border} ${st.extra ?? ""}`}
                      style={{ top: offset + 2, height }}
                    >
                      <div className={`text-[10px] font-medium ${st.text}`}>
                        {format(start, "HH:mm")} — {format(end, "HH:mm")} · {kindLabel}
                      </div>
                      <div className="text-xs font-semibold text-foreground truncate mt-0.5">
                        {headline}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <AppointmentFormSheet
        open={open}
        onOpenChange={setOpen}
        appointment={editing}
        initialDate={initialDate}
        ownerId={user?.id}
        patients={patients}
        onSaved={(opts) => {
          if (!opts?.keepOpen) setOpen(false);
          load();
        }}
        onDeleted={() => {
          setOpen(false);
          load();
        }}
      />
    </div>
  );
}
