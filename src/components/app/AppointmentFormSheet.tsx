import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, addWeeks } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "./PatientFormSheet";
import { Trash2, MessageCircle } from "lucide-react";
import { waLink, reminderMessage, confirmationMessage } from "@/lib/whatsapp";

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

  const allPatients = [...patients, ...localPatients.filter((lp) => !patients.some((p) => p.id === lp.id))];
  const currentAppt = appointment ?? savedAppt;

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
    }
  }, [open]);

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
    toast.success("Paciente criado — complete o cadastro depois em Pacientes");
  };

  const needsPatient = kind === "consulta";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsPatient && !patientId) return toast.error("Selecione um paciente");
    if (kind === "outro" && !customKind.trim()) return toast.error("Descreva o tipo de evento");
    if (!starts || !ends) return toast.error("Defina horário de início e fim");
    if (new Date(ends) <= new Date(starts))
      return toast.error("O término deve ser após o início");
    if (!ownerId) return;

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
    };

    if (appointment) {
      const { error } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", appointment.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Compromisso atualizado");
      onSaved();
    } else {
      const step = repeat === "weekly" ? 1 : repeat === "biweekly" ? 2 : 0;
      const times = repeat === "none" ? 1 : Math.max(1, Math.min(52, repeatCount));
      const rows = Array.from({ length: times }, (_, i) => ({
        ...payload,
        owner_id: ownerId,
        starts_at: addWeeks(new Date(starts), i * step).toISOString(),
        ends_at: addWeeks(new Date(ends), i * step).toISOString(),
      }));
      const { data, error } = await supabase
        .from("appointments")
        .insert(rows)
        .select("*");
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success(
        times > 1 ? `${times} compromissos agendados` : "Compromisso agendado",
      );
      const created = (data?.[0] ?? null) as unknown as Appointment | null;
      if (needsPatient && created) {
        setSavedAppt(created);
        onSaved({ keepOpen: true });
      } else {
        onSaved();
      }
    }
  };

  const handleDelete = async () => {
    if (!appointment) return;
    if (!confirm("Remover este compromisso?")) return;
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", appointment.id);
    if (error) return toast.error(error.message);
    toast.success("Compromisso removido");
    onDeleted();
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


          <div className="flex items-center justify-between gap-2 pt-2">
            {appointment ? (
              <button
                type="button"
                onClick={handleDelete}
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
