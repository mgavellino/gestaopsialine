import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format, addWeeks, isSameDay } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "./PatientFormSheet";
import { Trash2, MessageCircle, Search, X } from "lucide-react";
import { waLink, reminderMessage, confirmationMessage } from "@/lib/whatsapp";
import { parseMoneyToCents, centsToInput } from "@/lib/money";
import { generateReceivableForCompletedAppointment, type BillingMode } from "@/lib/receivables";

export type AppointmentKind = "consulta" | "reuniao" | "supervisao" | "pessoal" | "outro";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export type Appointment = {
  id: string;
  owner_id: string;
  patient_id: string | null;
  title: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  kind: AppointmentKind;
  custom_kind: string | null;
  notes: string | null;
  series_id?: string | null;
  billing_mode?: BillingMode | null;
  bill_amount_cents?: number | null;
  receivable_created?: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  initialDate: Date | null;
  ownerId: string | undefined;
  patients: Patient[];
  onSaved: (opts?: { keepOpen?: boolean }) => void;
  onDeleted: () => void;
};

const KIND_LABELS: Record<AppointmentKind, string> = {
  consulta: "Consulta",
  reuniao: "Reunião",
  supervisao: "Supervisão",
  pessoal: "Pessoal / Bloqueio",
  outro: "Outro",
};

function toLocalInput(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function AppointmentFormSheet({
  open,
  onOpenChange,
  appointment,
  initialDate,
  ownerId,
  patients,
  onSaved,
  onDeleted,
}: Props) {
  const [kind, setKind] = useState<AppointmentKind>("consulta");
  const [customKind, setCustomKind] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [title, setTitle] = useState("Sessão");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("scheduled");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAppt, setSavedAppt] = useState<Appointment | null>(null);
  const [localPatients, setLocalPatients] = useState<Patient[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [repeat, setRepeat] = useState<"none" | "weekly" | "biweekly">("none");
  const [repeatCount, setRepeatCount] = useState(8);
  const [billing, setBilling] = useState<"none" | "sessao" | "mensal">("none");
  const [billAmount, setBillAmount] = useState("");
  const [defaultPriceCents, setDefaultPriceCents] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const allPatients = useMemo(
    () => [...patients, ...localPatients.filter((lp) => !patients.some((p) => p.id === lp.id))],
    [patients, localPatients],
  );
  const currentAppt = appointment ?? savedAppt;
  const selectedPatient = allPatients.find((p) => p.id === patientId) ?? null;

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return allPatients;
    return allPatients.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [allPatients, patientSearch]);

  useEffect(() => {
    if (appointment) {
      setKind(appointment.kind ?? "consulta");
      setCustomKind(appointment.custom_kind ?? "");
      setPatientId(appointment.patient_id ?? "");
      setTitle(appointment.title ?? "Sessão");
      setStarts(toLocalInput(new Date(appointment.starts_at)));
      setEnds(toLocalInput(new Date(appointment.ends_at)));
      setStatus(appointment.status);
      setNotes(appointment.notes ?? "");
      setSavedAppt(null);
    } else if (initialDate) {
      const end = new Date(initialDate);
      end.setMinutes(end.getMinutes() + 50);
      setKind("consulta");
      setCustomKind("");
      setPatientId(patients[0]?.id ?? "");
      setTitle("Sessão");
      setStarts(toLocalInput(initialDate));
      setEnds(toLocalInput(end));
      setStatus("scheduled");
      setNotes("");
      setSavedAppt(null);
    }
  }, [appointment, initialDate, open, patients]);

  useEffect(() => {
    if (!open) {
      setSavedAppt(null);
      setQuickOpen(false);
      setQuickName("");
      setQuickPhone("");
      setRepeat("none");
      setRepeatCount(8);
      setBilling("none");
      setPatientSearch("");
      setDeleteOpen(false);
    }
  }, [open]);

  // Valor padrão da consulta (perfil) para pré-preencher a cobrança
  useEffect(() => {
    if (!open || !ownerId) return;
    supabase
      .from("profiles")
      .select("default_session_price_cents")
      .eq("id", ownerId)
      .maybeSingle()
      .then(({ data }) => {
        const v = (data as { default_session_price_cents?: number } | null)
          ?.default_session_price_cents;
        if (typeof v === "number" && v > 0) setDefaultPriceCents(v);
      });
  }, [open, ownerId]);

  // Preenche o valor conforme o paciente selecionado
  useEffect(() => {
    const fromPatient =
      selectedPatient?.session_price != null
        ? Math.round(Number(selectedPatient.session_price) * 100)
        : null;
    const cents = fromPatient && fromPatient > 0 ? fromPatient : defaultPriceCents;
    if (cents && cents > 0) setBillAmount(centsToInput(cents));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, defaultPriceCents]);

  // Sugere a forma de cobrança do cadastro do paciente
  useEffect(() => {
    if (appointment) return;
    if (selectedPatient?.billing_type === "mensal") setBilling("mensal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const createQuickPatient = async () => {
    if (!ownerId) return;
    if (!quickName.trim()) return toast.error("Informe o nome");
    setCreatingPatient(true);
    const { data, error } = await supabase
      .from("patients")
      .insert({ owner_id: ownerId, full_name: quickName.trim(), phone: quickPhone.trim() || null })
      .select("*")
      .single();
    setCreatingPatient(false);
    if (error) return toast.error(error.message);
    const p = data as unknown as Patient;
    setLocalPatients((prev) => [...prev, p]);
    setPatientId(p.id);
    setQuickOpen(false);
    setQuickName("");
    setQuickPhone("");
    setPatientSearch("");
    toast.success("Paciente criado — complete o cadastro depois em Pacientes");
  };

  const needsPatient = kind === "consulta";

  /**
   * Gera o recebível de uma consulta específica quando ela já nasce (ou passa a ser)
   * "Realizada" — nunca no momento do agendamento. Ver src/lib/receivables.ts.
   */
  const generateReceivableIfCompleted = async (a: Appointment, pid: string | null) => {
    if (a.status !== "completed") return;
    const patientName = pid ? allPatients.find((p) => p.id === pid)?.full_name : undefined;
    try {
      await generateReceivableForCompletedAppointment(
        {
          id: a.id,
          owner_id: a.owner_id,
          patient_id: a.patient_id,
          starts_at: a.starts_at,
          billing_mode: a.billing_mode ?? null,
          bill_amount_cents: a.bill_amount_cents ?? null,
          receivable_created: a.receivable_created ?? false,
        },
        patientName,
      );
    } catch (err) {
      toast.error(err instanceof Error ? `Erro ao gerar cobrança: ${err.message}` : "Erro ao gerar cobrança");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsPatient && !patientId) return toast.error("Selecione um paciente");
    if (kind === "outro" && !customKind.trim()) return toast.error("Descreva o tipo de evento");
    if (!starts || !ends) return toast.error("Defina horário de início e fim");
    if (new Date(ends) <= new Date(starts))
      return toast.error("O término deve ser após o início");
    if (!ownerId) return;

    const wantsBilling = !appointment && needsPatient && billing !== "none";
    const amountCents = wantsBilling ? parseMoneyToCents(billAmount) : 0;
    if (wantsBilling && (Number.isNaN(amountCents) || amountCents <= 0))
      return toast.error("Informe o valor da sessão para gerar a cobrança");

    setSaving(true);
    const payload = {
      kind,
      custom_kind: kind === "outro" ? customKind.trim() : null,
      patient_id: needsPatient ? patientId : null,
      title: title.trim() || null,
      starts_at: new Date(starts).toISOString(),
      ends_at: new Date(ends).toISOString(),
      status,
      notes: notes.trim() || null,
      // A cobrança só é guardada aqui; o recebível em si só é criado quando a consulta
      // for marcada como "Realizada" (ver generateReceivableIfCompleted / src/lib/receivables.ts).
      ...(wantsBilling
        ? {
            billing_mode: (billing === "mensal" ? "mensal" : "sessao") as BillingMode,
            bill_amount_cents: amountCents,
          }
        : {}),
    };

    if (appointment) {
      const wasCompleted = appointment.status === "completed";
      const { error } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", appointment.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Compromisso atualizado");
      // Consulta acabou de virar "Realizada" agora: gera o recebível (se houver cobrança configurada).
      if (!wasCompleted && status === "completed") {
        await generateReceivableIfCompleted(
          { ...appointment, status: "completed" },
          appointment.patient_id,
        );
      }
      onSaved();
    } else {
      const step = repeat === "weekly" ? 1 : repeat === "biweekly" ? 2 : 0;
      const times = repeat === "none" ? 1 : Math.max(1, Math.min(52, repeatCount));
      const seriesId = times > 1 ? crypto.randomUUID() : null;
      const rows = Array.from({ length: times }, (_, i) => ({
        ...payload,
        owner_id: ownerId,
        series_id: seriesId,
        starts_at: addWeeks(new Date(starts), i * step).toISOString(),
        ends_at: addWeeks(new Date(ends), i * step).toISOString(),
      }));
      const { data, error } = await supabase
        .from("appointments")
        .insert(rows)
        .select("*");
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      const createdList = ((data ?? []) as unknown as Appointment[]).sort(
        (a, b) => +new Date(a.starts_at) - +new Date(b.starts_at),
      );
      // Normalmente a consulta nasce "Agendada" e a cobrança só será gerada quando virar
      // "Realizada" (manualmente ou pelo auto-complete da agenda). Cobre o caso raro de já
      // criar direto como "Realizada" (ex: lançar uma sessão passada).
      for (const a of createdList) {
        if (a.status === "completed") await generateReceivableIfCompleted(a, patientId);
      }
      setSaving(false);
      toast.success(
        times > 1 ? `${times} compromissos agendados` : "Compromisso agendado",
      );
      const created = createdList[0] ?? null;
      if (needsPatient && created) {
        setSavedAppt(created);
        onSaved({ keepOpen: true });
      } else {
        onSaved();
      }
    }
  };

  /** Remove só este, ou este e todos os próximos do mesmo horário fixo. */
  const runDelete = async (scope: "one" | "future") => {
    if (!appointment) return;
    setDeleting(true);
    try {
      if (scope === "one") {
        if (!confirm("Remover este compromisso?")) return;
        const { error } = await supabase.from("appointments").delete().eq("id", appointment.id);
        if (error) throw new Error(error.message);
        toast.success("Compromisso removido");
        onDeleted();
        return;
      }

      let ids: string[] = [];
      if (appointment.series_id) {
        const { data, error } = await supabase
          .from("appointments")
          .select("id")
          .eq("series_id", appointment.series_id)
          .gte("starts_at", appointment.starts_at);
        if (error) throw new Error(error.message);
        ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
      } else {
        // Sem série: pega os próximos do mesmo paciente, mesmo dia da semana e mesma hora.
        const ref = new Date(appointment.starts_at);
        const q = supabase
          .from("appointments")
          .select("id, starts_at, patient_id, title")
          .gte("starts_at", appointment.starts_at);
        const { data, error } = appointment.patient_id
          ? await q.eq("patient_id", appointment.patient_id)
          : await q.is("patient_id", null);
        if (error) throw new Error(error.message);
        ids = ((data ?? []) as { id: string; starts_at: string }[])
          .filter((r) => {
            const d = new Date(r.starts_at);
            return (
              d.getDay() === ref.getDay() &&
              d.getHours() === ref.getHours() &&
              d.getMinutes() === ref.getMinutes()
            );
          })
          .map((r) => r.id);
      }

      if (!ids.length) return toast.error("Nenhum compromisso encontrado");
      if (
        !confirm(
          `Remover ${ids.length} compromisso${ids.length > 1 ? "s" : ""} (este e os próximos)? Isso também remove as cobranças ainda não pagas ligadas a eles.`,
        )
      )
        return;

      // Remove cobranças pendentes ligadas a essas sessões (não mexe no que já foi pago)
      await supabase
        .from("appointment_receivables")
        .delete()
        .in("appointment_id", ids)
        .neq("status", "paid");

      const { error: delErr } = await supabase.from("appointments").delete().in("id", ids);
      if (delErr) throw new Error(delErr.message);
      toast.success(`${ids.length} compromissos removidos`);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-background border-l border-border/60">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl font-semibold tracking-tight">
            {appointment ? "Editar compromisso" : "Novo compromisso"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Escolha o tipo, defina horário e adicione observações.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Tipo *">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as AppointmentKind)}
              className={inputCls}
            >
              {(Object.keys(KIND_LABELS) as AppointmentKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>

          {kind === "outro" && (
            <Field label="Descrição do tipo *">
              <input
                value={customKind}
                onChange={(e) => setCustomKind(e.target.value)}
                placeholder="ex: workshop, treinamento..."
                className={inputCls}
              />
            </Field>
          )}

          {needsPatient && (
            <Field label="Paciente *">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Buscar paciente pelo nome"
                  className={`${inputCls} pl-9 pr-9`}
                />
                {patientSearch && (
                  <button
                    type="button"
                    onClick={() => setPatientSearch("")}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {patientSearch.trim() ? (
                <div className="max-h-44 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40">
                  {filteredPatients.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhum paciente encontrado
                    </div>
                  )}
                  {filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPatientId(p.id);
                        setPatientSearch("");
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm hover:bg-surface ${
                        p.id === patientId ? "bg-surface font-medium" : ""
                      }`}
                    >
                      {p.full_name}
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecione...</option>
                  {allPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              )}

              {selectedPatient && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Selecionado: <span className="text-foreground">{selectedPatient.full_name}</span>
                </p>
              )}

              {!quickOpen ? (
                <button
                  type="button"
                  onClick={() => setQuickOpen(true)}
                  className="mt-2 text-xs text-brand hover:underline"
                >
                  + Agendar alguém novo (só nome e telefone)
                </button>
              ) : (
                <div className="mt-2 rounded-xl border border-border/60 bg-surface/60 p-3 space-y-2">
                  <input
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="Nome do paciente"
                    className={inputCls}
                  />
                  <input
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="Telefone (opcional)"
                    className={inputCls}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickOpen(false)}
                      className="h-9 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={createQuickPatient}
                      disabled={creatingPatient}
                      className="h-9 px-3 rounded-lg text-xs bg-foreground text-background disabled:opacity-60"
                    >
                      {creatingPatient ? "Criando..." : "Criar e selecionar"}
                    </button>
                  </div>
                </div>
              )}
            </Field>
          )}

          <Field label="Título">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Início *">
              <input
                type="datetime-local"
                value={starts}
                onChange={(e) => setStarts(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Término *">
              <input
                type="datetime-local"
                value={ends}
                onChange={(e) => setEnds(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
              className={inputCls}
            >
              <option value="scheduled">Agendada</option>
              <option value="completed">Realizada</option>
              <option value="no_show">Faltou</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </Field>

          {!appointment && (
            <div className="rounded-xl border border-border/60 bg-surface/40 p-3 space-y-3">
              <Field label="Repetir (horário fixo)">
                <select
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as typeof repeat)}
                  className={inputCls}
                >
                  <option value="none">Não repetir</option>
                  <option value="weekly">Toda semana (mesmo dia e hora)</option>
                  <option value="biweekly">A cada 15 dias</option>
                </select>
              </Field>
              {repeat !== "none" && (
                <Field label="Quantas vezes (incluindo a primeira)">
                  <input
                    type="number"
                    min={2}
                    max={52}
                    inputMode="numeric"
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Number(e.target.value))}
                    className={inputCls}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {repeat === "weekly"
                      ? `Serão criados ${Math.max(1, Math.min(52, repeatCount))} encontros semanais.`
                      : `Serão criados ${Math.max(1, Math.min(52, repeatCount))} encontros quinzenais.`}
                  </p>
                </Field>
              )}
            </div>
          )}

          {!appointment && needsPatient && (
            <div className="rounded-xl border border-border/60 bg-surface/40 p-3 space-y-3">
              <Field label="Cobrança">
                <select
                  value={billing}
                  onChange={(e) => setBilling(e.target.value as typeof billing)}
                  className={inputCls}
                >
                  <option value="none">Não gerar cobrança agora</option>
                  <option value="sessao">Por sessão (vence no dia da sessão)</option>
                  <option value="mensal">Mensal (paga todas as sessões no fim do mês)</option>
                </select>
              </Field>
              {billing !== "none" && (
                <Field label="Valor da sessão (R$)">
                  <input
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    autoComplete="off"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    placeholder="200,00"
                    className={inputCls}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {billing === "mensal"
                      ? "A mensalidade só entra no Financeiro conforme cada sessão for marcada como Realizada — as sessões do mês vão sendo somadas num único recebível, com vencimento no último dia do mês."
                      : "A cobrança só entra no Financeiro quando a sessão for marcada como Realizada, com vencimento no dia da sessão."}
                  </p>
                </Field>
              )}
            </div>
          )}

          <Field label="Observações">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputCls} resize-none py-2`}
            />
          </Field>

          {currentAppt && needsPatient && (() => {
            const pat = allPatients.find((p) => p.id === patientId);
            if (!pat?.phone) return null;
            const remLink = waLink(pat.phone, reminderMessage({ patientName: pat.full_name, startsAt: currentAppt.starts_at }));
            const confLink = waLink(pat.phone, confirmationMessage({ patientName: pat.full_name, startsAt: currentAppt.starts_at }));
            return (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <MessageCircle className="h-3.5 w-3.5" /> Enviar lembrete por WhatsApp
                </div>
                <div className="flex gap-2 flex-wrap">
                  {remLink && (
                    <a href={remLink} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-md text-xs bg-emerald-600 text-white inline-flex items-center">
                      Lembrete 24h
                    </a>
                  )}
                  {confLink && (
                    <a href={confLink} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-md text-xs border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 inline-flex items-center">
                      Pedir confirmação
                    </a>
                  )}
                </div>
              </div>
            );
          })()}

          {appointment && deleteOpen && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="text-xs font-medium text-destructive">O que você quer remover?</div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => runDelete("one")}
                className="w-full h-10 rounded-lg border border-border/60 text-sm hover:bg-surface disabled:opacity-60"
              >
                Só este compromisso
                {isSameDay(new Date(appointment.starts_at), new Date()) ? " (hoje)" : ""}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => runDelete("future")}
                className="w-full h-10 rounded-lg bg-destructive text-white text-sm font-medium disabled:opacity-60"
              >
                Este e todos os próximos deste horário
              </button>
              <p className="text-[11px] text-muted-foreground">
                A segunda opção apaga de uma vez as próximas semanas
                {appointment.patient_id ? " deste paciente" : ""} no mesmo dia da semana e horário.
                Cobranças já recebidas não são apagadas.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            {appointment ? (
              <button
                type="button"
                onClick={() => setDeleteOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remover
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-10 px-4 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {saving ? "Salvando..." : appointment ? "Salvar" : "Agendar"}
              </button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const inputCls =
  "w-full h-10 px-3 rounded-lg bg-surface border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
