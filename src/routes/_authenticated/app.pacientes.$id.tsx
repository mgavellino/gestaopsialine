import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Cake,
  DollarSign,
  FileText,
  Mail,
  Phone,
  Plus,
  Save,
  Search,
  Target,
  Trash2,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/app/pacientes/$id")({
  component: PatientDetailPage,
});

type Patient = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  notes: string | null;
  is_active: boolean;
  cpf: string | null;
  address: string | null;
  assessment_date: string | null;
  reassessment_date: string | null;
  therapy_end_date: string | null;
  financial_responsible_name: string | null;
  financial_responsible_cpf: string | null;
  session_price: number | null;
  billing_type: string | null;
  receipt_required: boolean | null;
  father_name: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  created_at: string;
  therapeutic_plan: TherapeuticPlan | null;
};

type TherapeuticPlan = {
  diagnosticHypothesis?: string;
  approach?: string;
  objectives?: { id: string; text: string; done?: boolean }[];
  lastReview?: string;
  nextReview?: string;
  notes?: string;
};

type GenoNode = { id: string; x: number; y: number; label: string; sex: "M" | "F" | "O"; deceased?: boolean };
type GenoEdge = { from: string; to: string; kind: "filho" | "casal" | "irmao" };
type Genogram = { nodes: GenoNode[]; edges: GenoEdge[] };

type TimelineItem = {
  date: string;
  kind: "consulta" | "falta" | "prontuario" | "pagamento" | "criada";
  title: string;
  detail?: string;
  href?: string;
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PatientDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"dados" | "consultas" | "timeline" | "plan" | "geno">("consultas");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<{ id: string; starts_at: string; status: string; kind: string; title: string | null }[]>([]);
  const [records, setRecords] = useState<{ id: string; title: string; created_at: string }[]>([]);
  const [receivables, setReceivables] = useState<{ id: string; amount_cents: number; status: string; paid_at: string | null; payment_method: string | null }[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("patients").select("*").eq("id", id).maybeSingle(),
      supabase.from("appointments").select("id, starts_at, status, kind, title").eq("patient_id", id).order("starts_at", { ascending: false }),
      supabase.from("medical_records").select("id, title, created_at").eq("patient_id", id).order("created_at", { ascending: false }),
      supabase.from("appointment_receivables").select("id, amount_cents, status, paid_at, payment_method").eq("patient_id", id).order("paid_at", { ascending: false, nullsFirst: false }),
    ]).then(([p, a, r, rc]) => {
      if (!p.data) {
        toast.error("Paciente não encontrada");
        navigate({ to: "/app/pacientes" });
        return;
      }
      setPatient(p.data as unknown as Patient);
      setAppointments((a.data ?? []) as never);
      setRecords((r.data ?? []) as never);
      setReceivables((rc.data ?? []) as never);
    });
  }, [id, user, navigate]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const a of appointments) {
      if (a.status === "no_show" || a.status === "cancelled") {
        items.push({
          date: a.starts_at,
          kind: "falta",
          title: a.status === "no_show" ? "Faltou" : "Cancelado",
          detail: a.title ?? a.kind,
        });
      } else {
        items.push({
          date: a.starts_at,
          kind: "consulta",
          title: a.status === "completed" ? "Sessão realizada" : "Sessão agendada",
          detail: a.title ?? a.kind,
        });
      }
    }
    for (const r of records) {
      items.push({ date: r.created_at, kind: "prontuario", title: r.title || "Prontuário", href: `/app/prontuarios/${r.id}` });
    }
    for (const rc of receivables) {
      if (rc.paid_at && rc.status === "paid") {
        items.push({
          date: rc.paid_at,
          kind: "pagamento",
          title: `Pagamento ${brl(rc.amount_cents)}`,
          detail: rc.payment_method ?? undefined,
        });
      }
    }
    items.sort((a, b) => (a.date < b.date ? 1 : -1));
    return items;
  }, [appointments, records, receivables]);

  const totalReceived = receivables.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount_cents, 0);
  const sessionsCount = appointments.filter((a) => a.status === "completed").length;
  const noShows = appointments.filter((a) => a.status === "no_show").length;

  if (!patient) {
    return <div className="text-center py-20 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/app/pacientes" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Pacientes
      </Link>

      <div className="rounded-2xl border border-border/60 bg-surface/40 p-5 md:p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-brand grid place-items-center text-xl font-semibold text-white">
            {patient.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{patient.full_name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {patient.phone && (
                <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span>
              )}
              {patient.email && (
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{patient.email}</span>
              )}
              {patient.birth_date && (
                <span className="inline-flex items-center gap-1">
                  <Cake className="h-3 w-3" />
                  {format(parseISO(patient.birth_date), "dd/MM/yyyy")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat icon={CheckCircle2} label="Sessões" value={String(sessionsCount)} />
          <Stat icon={DollarSign} label="Recebido" value={brl(totalReceived)} />
          <Stat icon={Calendar} label="Faltas" value={String(noShows)} />
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 p-1 rounded-xl bg-surface/40 border border-border/60 flex-wrap">
        <TabBtn active={tab === "dados"} onClick={() => setTab("dados")}>Dados</TabBtn>
        <TabBtn active={tab === "consultas"} onClick={() => setTab("consultas")}>Consultas</TabBtn>
        <TabBtn active={tab === "timeline"} onClick={() => setTab("timeline")}>Linha do tempo</TabBtn>
        <TabBtn active={tab === "plan"} onClick={() => setTab("plan")}>Plano terapêutico</TabBtn>
        <TabBtn active={tab === "geno"} onClick={() => setTab("geno")}>Genograma</TabBtn>
      </div>

      {tab === "dados" && <PatientDataView patient={patient} />}
      {tab === "consultas" && <ConsultationsView appointments={appointments} />}
      {tab === "timeline" && <TimelineView items={timeline} />}
      {tab === "plan" && <TherapeuticPlanEditor patient={patient} onSaved={setPatient} />}
      {tab === "geno" && <GenogramEditor patient={patient} onSaved={setPatient} />}
    </div>
  );
}

function calcAge(birth: string | null): string | null {
  if (!birth) return null;
  const b = parseISO(birth);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 150 ? `${age} anos` : null;
}

const fmtDate = (d: string | null) => (d ? format(parseISO(d), "dd/MM/yyyy") : null);

function PatientDataView({ patient }: { patient: Patient }) {
  const groups: { title: string; rows: [string, string | null][] }[] = [
    {
      title: "Identificação",
      rows: [
        ["Nome do paciente", patient.full_name],
        ["Idade", calcAge(patient.birth_date)],
        ["Data de nascimento", fmtDate(patient.birth_date)],
        ["CPF", patient.cpf],
        ["Endereço", patient.address],
        ["Telefone", patient.phone],
        ["E-mail", patient.email],
        ["Situação", patient.is_active ? "Ativo" : "Inativo"],
      ],
    },
    {
      title: "Acompanhamento",
      rows: [
        ["Data de avaliação", fmtDate(patient.assessment_date)],
        ["Data de reavaliação", fmtDate(patient.reassessment_date)],
        ["Saída da terapia", fmtDate(patient.therapy_end_date)],
      ],
    },
    {
      title: "Financeiro",
      rows: [
        ["Responsável financeiro", patient.financial_responsible_name],
        ["CPF do responsável", patient.financial_responsible_cpf],
        [
          "Valor da sessão",
          patient.session_price != null
            ? patient.session_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : null,
        ],
        ["Forma de cobrança", patient.billing_type === "mensal" ? "Mensal" : "Por sessão"],
        ["Recibo de pagamento", patient.receipt_required ? "Sim" : "Não"],
      ],
    },
    {
      title: "Filiação",
      rows: [
        ["Nome do pai", patient.father_name],
        ["Telefone do pai", patient.father_phone],
        ["Nome da mãe", patient.mother_name],
        ["Telefone da mãe", patient.mother_phone],
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const rows = g.rows.filter(([, v]) => v);
        if (!rows.length) return null;
        return (
          <div key={g.title} className="rounded-2xl border border-border/60 bg-surface/40 p-4 md:p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {g.title}
            </div>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="text-sm break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
      {patient.notes && (
        <div className="rounded-2xl border border-border/60 bg-surface/40 p-4 md:p-5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Observação
          </div>
          <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 h-9 rounded-lg text-sm font-medium whitespace-nowrap ${active ? "bg-background shadow-sm" : "text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/60 border border-border/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}

const ICONS = {
  consulta: CheckCircle2,
  falta: User,
  prontuario: FileText,
  pagamento: DollarSign,
  criada: Plus,
};

function TimelineView({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">Sem eventos ainda.</div>;
  }
  return (
    <ol className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
      {items.map((it, i) => {
        const Icon = ICONS[it.kind];
        const node = (
          <div className="rounded-xl border border-border/60 bg-surface/40 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground capitalize">
              {format(parseISO(it.date), "d 'de' MMM yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
            <div className="text-sm font-medium mt-0.5">{it.title}</div>
            {it.detail && <div className="text-xs text-muted-foreground capitalize mt-0.5">{it.detail}</div>}
          </div>
        );
        return (
          <li key={i} className="relative">
            <span className="absolute -left-[18px] top-3 h-5 w-5 rounded-full bg-background border-2 border-brand grid place-items-center">
              <Icon className="h-2.5 w-2.5 text-brand" />
            </span>
            {it.href ? <Link to={it.href}>{node}</Link> : node}
          </li>
        );
      })}
    </ol>
  );
}

type Apt = { id: string; starts_at: string; status: string; kind: string; title: string | null };

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  completed: { label: "Compareceu", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
  scheduled: { label: "Agendada", color: "text-sky-600 bg-sky-500/10 border-sky-500/30", icon: Calendar },
  no_show: { label: "Faltou", color: "text-rose-600 bg-rose-500/10 border-rose-500/30", icon: XCircle },
  cancelled: { label: "Cancelada", color: "text-muted-foreground bg-muted/40 border-border/40", icon: XCircle },
};

function ConsultationsView({ appointments }: { appointments: Apt[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "completed" | "scheduled" | "no_show" | "cancelled">("all");

  const sessions = useMemo(
    () => appointments.filter((a) => a.kind === "consulta" || a.kind === "sessao" || !a.kind),
    [appointments],
  );

  const stats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter((a) => a.status === "completed").length;
    const noShow = sessions.filter((a) => a.status === "no_show").length;
    const scheduled = sessions.filter((a) => a.status === "scheduled").length;
    const cancelled = sessions.filter((a) => a.status === "cancelled").length;
    const past = completed + noShow;
    const attendanceRate = past > 0 ? Math.round((completed / past) * 100) : 0;
    return { total, completed, noShow, scheduled, cancelled, attendanceRate };
  }, [sessions]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return sessions.filter((a) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (!term) return true;
      const dateStr = format(parseISO(a.starts_at), "dd/MM/yyyy EEEE", { locale: ptBR }).toLowerCase();
      return dateStr.includes(term) || (a.title ?? "").toLowerCase().includes(term);
    });
  }, [sessions, q, filter]);

  const filters: { key: typeof filter; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: stats.total },
    { key: "completed", label: "Compareceu", count: stats.completed },
    { key: "no_show", label: "Faltou", count: stats.noShow },
    { key: "scheduled", label: "Agendada", count: stats.scheduled },
    { key: "cancelled", label: "Cancelada", count: stats.cancelled },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniStat label="Total marcadas" value={String(stats.total)} />
        <MiniStat label="Compareceu" value={String(stats.completed)} tone="ok" />
        <MiniStat label="Faltou" value={String(stats.noShow)} tone="bad" />
        <MiniStat label="Taxa de presença" value={`${stats.attendanceRate}%`} tone="ok" />
      </div>

      <div className="rounded-2xl border border-border/60 bg-surface/40 p-3 md:p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por data ou título..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border border-border/60 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 h-8 rounded-full border text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label} <span className="opacity-60">· {f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          Nenhuma consulta encontrada.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const meta = STATUS_META[a.status] ?? STATUS_META.scheduled;
            const Icon = meta.icon;
            const d = parseISO(a.starts_at);
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/40 px-3 md:px-4 py-3"
              >
                <div className="text-center w-12 shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(d, "MMM", { locale: ptBR })}
                  </div>
                  <div className="text-lg font-semibold leading-none mt-0.5">{format(d, "dd")}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium capitalize truncate">
                    {format(d, "EEEE · HH:mm", { locale: ptBR })}
                  </div>
                  {a.title && (
                    <div className="text-xs text-muted-foreground truncate">{a.title}</div>
                  )}
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium ${meta.color}`}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  const toneCls =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "bad"
      ? "text-rose-600"
      : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg md:text-xl font-semibold mt-0.5 ${toneCls}`}>{value}</div>
    </div>
  );
}



function TherapeuticPlanEditor({ patient, onSaved }: { patient: Patient; onSaved: (p: Patient) => void }) {
  const [plan, setPlan] = useState<TherapeuticPlan>(patient.therapeutic_plan ?? {});
  const [newObj, setNewObj] = useState("");

  const save = async () => {
    const { error } = await supabase.from("patients").update({ therapeutic_plan: plan as never }).eq("id", patient.id);
    if (error) return toast.error(error.message);
    onSaved({ ...patient, therapeutic_plan: plan });
    toast.success("Plano salvo");
  };

  const addObjective = () => {
    if (!newObj.trim()) return;
    setPlan({
      ...plan,
      objectives: [...(plan.objectives ?? []), { id: crypto.randomUUID(), text: newObj.trim() }],
    });
    setNewObj("");
  };

  const toggleObj = (id: string) =>
    setPlan({ ...plan, objectives: (plan.objectives ?? []).map((o) => (o.id === id ? { ...o, done: !o.done } : o)) });
  const removeObj = (id: string) =>
    setPlan({ ...plan, objectives: (plan.objectives ?? []).filter((o) => o.id !== id) });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-surface/40 p-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">Hipótese diagnóstica</label>
          <input
            value={plan.diagnosticHypothesis ?? ""}
            onChange={(e) => setPlan({ ...plan, diagnosticHypothesis: e.target.value })}
            placeholder="ex: TAG + traços depressivos"
            className="mt-1 w-full h-10 px-3 rounded-lg bg-background border border-border/60 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Abordagem</label>
          <input
            value={plan.approach ?? ""}
            onChange={(e) => setPlan({ ...plan, approach: e.target.value })}
            placeholder="TCC · ACT · Esquemas..."
            className="mt-1 w-full h-10 px-3 rounded-lg bg-background border border-border/60 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Próxima revisão</label>
          <input
            type="date"
            value={plan.nextReview ?? ""}
            onChange={(e) => setPlan({ ...plan, nextReview: e.target.value })}
            className="mt-1 w-full h-10 px-3 rounded-lg bg-background border border-border/60 text-sm"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-surface/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-medium">Objetivos terapêuticos</h3>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            value={newObj}
            onChange={(e) => setNewObj(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addObjective()}
            placeholder="Novo objetivo..."
            className="flex-1 h-10 px-3 rounded-lg bg-background border border-border/60 text-sm"
          />
          <button onClick={addObjective} className="h-10 px-4 rounded-lg bg-foreground text-background text-sm">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-1.5">
          {(plan.objectives ?? []).map((o) => (
            <li key={o.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2">
              <button
                onClick={() => toggleObj(o.id)}
                className={`h-5 w-5 rounded border grid place-items-center shrink-0 ${o.done ? "bg-brand border-brand" : "border-border/60"}`}
              >
                {o.done && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
              </button>
              <span className={`flex-1 text-sm ${o.done ? "line-through text-muted-foreground" : ""}`}>{o.text}</span>
              <button onClick={() => removeObj(o.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {(plan.objectives ?? []).length === 0 && (
            <li className="text-xs text-muted-foreground text-center py-4">Nenhum objetivo ainda.</li>
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-border/60 bg-surface/40 p-5">
        <label className="text-xs text-muted-foreground">Anotações do plano</label>
        <textarea
          value={plan.notes ?? ""}
          onChange={(e) => setPlan({ ...plan, notes: e.target.value })}
          rows={4}
          className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border/60 text-sm resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button onClick={save} className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-brand text-primary-foreground text-sm font-medium">
          <Save className="h-4 w-4" /> Salvar plano
        </button>
      </div>
    </div>
  );
}

function GenogramEditor({ patient, onSaved }: { patient: Patient; onSaved: (p: Patient) => void }) {
  // Genogram lives inside therapeutic_plan under .genogram for simplicity
  const initial: Genogram = ((patient.therapeutic_plan as unknown as { genogram?: Genogram } | null)?.genogram) ?? {
    nodes: [{ id: "p", x: 200, y: 220, label: patient.full_name.split(" ")[0], sex: "F" }],
    edges: [],
  };
  const [g, setG] = useState<Genogram>(initial);
  const [linking, setLinking] = useState<string | null>(null);
  const [linkKind, setLinkKind] = useState<GenoEdge["kind"]>("filho");

  const addNode = (sex: GenoNode["sex"]) => {
    const id = crypto.randomUUID().slice(0, 6);
    setG({ ...g, nodes: [...g.nodes, { id, x: 60 + g.nodes.length * 30, y: 80, label: "Novo", sex }] });
  };

  const updateNode = (id: string, patch: Partial<GenoNode>) =>
    setG({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });

  const removeNode = (id: string) =>
    setG({
      nodes: g.nodes.filter((n) => n.id !== id),
      edges: g.edges.filter((e) => e.from !== id && e.to !== id),
    });

  const handleNodeClick = (id: string) => {
    if (!linking) {
      setLinking(id);
    } else if (linking === id) {
      setLinking(null);
    } else {
      const exists = g.edges.find((e) => (e.from === linking && e.to === id) || (e.from === id && e.to === linking));
      if (!exists) {
        setG({ ...g, edges: [...g.edges, { from: linking, to: id, kind: linkKind }] });
      }
      setLinking(null);
    }
  };

  const save = async () => {
    const merged = { ...(patient.therapeutic_plan ?? {}), genogram: g };
    const { error } = await supabase.from("patients").update({ therapeutic_plan: merged as never }).eq("id", patient.id);
    if (error) return toast.error(error.message);
    onSaved({ ...patient, therapeutic_plan: merged as TherapeuticPlan });
    toast.success("Genograma salvo");
  };

  const onDrag = (id: string, e: React.MouseEvent<SVGGElement>) => {
    e.preventDefault();
    const svg = (e.currentTarget.ownerSVGElement) as SVGSVGElement;
    const startX = e.clientX;
    const startY = e.clientY;
    const node = g.nodes.find((n) => n.id === id)!;
    const origX = node.x;
    const origY = node.y;
    const rect = svg.getBoundingClientRect();
    const scale = svg.viewBox.baseVal.width / rect.width;

    const move = (ev: MouseEvent) => {
      updateNode(id, { x: origX + (ev.clientX - startX) * scale, y: origY + (ev.clientY - startY) * scale });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/60 bg-surface/40 p-3 flex items-center gap-2 flex-wrap text-xs">
        <button onClick={() => addNode("M")} className="h-8 px-3 rounded-md border border-border/60 hover:bg-surface inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Homem
        </button>
        <button onClick={() => addNode("F")} className="h-8 px-3 rounded-md border border-border/60 hover:bg-surface inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Mulher
        </button>
        <button onClick={() => addNode("O")} className="h-8 px-3 rounded-md border border-border/60 hover:bg-surface inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Outro
        </button>
        <div className="h-5 w-px bg-border/60 mx-1" />
        <span className="text-muted-foreground">Vincular como:</span>
        <select value={linkKind} onChange={(e) => setLinkKind(e.target.value as GenoEdge["kind"])} className="h-8 px-2 rounded-md bg-background border border-border/60 text-xs">
          <option value="filho">filho/a</option>
          <option value="casal">casal</option>
          <option value="irmao">irmão/ã</option>
        </select>
        {linking && (
          <span className="text-brand">→ clique em outro nó para conectar (ou no mesmo p/ cancelar)</span>
        )}
        <div className="flex-1" />
        <button onClick={save} className="h-8 px-4 rounded-md bg-brand text-primary-foreground inline-flex items-center gap-1">
          <Save className="h-3 w-3" /> Salvar
        </button>
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Clique num nó para começar uma conexão. Arraste pra mover. Duplo clique pra editar nome.
      </p>

      <div className="rounded-2xl border border-border/60 bg-background overflow-hidden">
        <svg viewBox="0 0 600 400" className="w-full h-[420px]" style={{ touchAction: "none" }}>
          {g.edges.map((e, i) => {
            const a = g.nodes.find((n) => n.id === e.from);
            const b = g.nodes.find((n) => n.id === e.to);
            if (!a || !b) return null;
            const stroke = e.kind === "casal" ? "oklch(0.65 0.20 25)" : e.kind === "irmao" ? "oklch(0.65 0.16 180)" : "oklch(0.55 0.04 250)";
            const dash = e.kind === "irmao" ? "4 4" : undefined;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} strokeDasharray={dash} />;
          })}
          {g.nodes.map((n) => {
            const isLinking = linking === n.id;
            const fill = n.sex === "M" ? "oklch(0.95 0.02 250)" : n.sex === "F" ? "oklch(0.95 0.03 25)" : "oklch(0.95 0.02 140)";
            return (
              <g
                key={n.id}
                onMouseDown={(e) => onDrag(n.id, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(n.id);
                }}
                onDoubleClick={() => {
                  const v = prompt("Nome do membro:", n.label);
                  if (v !== null) updateNode(n.id, { label: v });
                }}
                style={{ cursor: "move" }}
              >
                {n.sex === "M" ? (
                  <rect x={n.x - 24} y={n.y - 24} width={48} height={48} fill={fill} stroke={isLinking ? "oklch(0.55 0.22 260)" : "oklch(0.4 0.04 250)"} strokeWidth={isLinking ? 3 : 1.5} />
                ) : n.sex === "F" ? (
                  <circle cx={n.x} cy={n.y} r={24} fill={fill} stroke={isLinking ? "oklch(0.55 0.22 260)" : "oklch(0.4 0.04 250)"} strokeWidth={isLinking ? 3 : 1.5} />
                ) : (
                  <polygon points={`${n.x},${n.y - 28} ${n.x + 24},${n.y} ${n.x},${n.y + 28} ${n.x - 24},${n.y}`} fill={fill} stroke="oklch(0.4 0.04 250)" strokeWidth={1.5} />
                )}
                {n.deceased && (
                  <line x1={n.x - 28} y1={n.y - 28} x2={n.x + 28} y2={n.y + 28} stroke="red" strokeWidth={2} />
                )}
                <text x={n.x} y={n.y + 40} textAnchor="middle" fontSize={10} fill="oklch(0.4 0.04 250)">
                  {n.label}
                </text>
                <g
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNode(n.id);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={n.x + 20} cy={n.y - 20} r={7} fill="white" stroke="red" />
                  <text x={n.x + 20} y={n.y - 17} textAnchor="middle" fontSize={10} fill="red">×</text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="text-xs text-muted-foreground px-1 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 border border-foreground/60" /> Homem</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-foreground/60" /> Mulher</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-6" style={{ background: "oklch(0.65 0.20 25)" }} /> casal</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-6" style={{ background: "oklch(0.65 0.16 180)" }} /> irmãos</span>
        <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3" /> linha contínua = filho</span>
      </div>
    </div>
  );
}
