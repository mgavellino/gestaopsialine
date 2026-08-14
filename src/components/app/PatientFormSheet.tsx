import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { AvatarUpload } from "@/components/app/AvatarUpload";

export type Patient = {
  id: string;
  owner_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  address: string | null;
  notes: string | null;
  avatar_url: string | null;
  is_active: boolean;
  assessment_date: string | null;
  reassessment_date: string | null;
  financial_responsible_name: string | null;
  financial_responsible_cpf: string | null;
  session_price: number | null;
  therapy_end_date: string | null;
  receipt_required: boolean | null;
  billing_type: string | null;
  father_name: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient | null;
  ownerId: string | undefined;
  onSaved: (patient: Patient, isNew: boolean) => void;
};

const empty = {
  full_name: "",
  email: "",
  phone: "",
  cpf: "",
  birth_date: "",
  address: "",
  notes: "",
  avatar_url: "" as string | null | "",
  is_active: true,
  assessment_date: "",
  reassessment_date: "",
  financial_responsible_name: "",
  financial_responsible_cpf: "",
  session_price: "",
  therapy_end_date: "",
  receipt_required: false,
  billing_type: "sessao",
  father_name: "",
  father_phone: "",
  mother_name: "",
  mother_phone: "",
};

function calcAge(birth: string): string {
  if (!birth) return "";
  const b = new Date(birth);
  if (isNaN(b.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 150 ? `${age} anos` : "";
}

export function PatientFormSheet({ open, onOpenChange, patient, ownerId, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (patient) {
      setForm({
        full_name: patient.full_name ?? "",
        email: patient.email ?? "",
        phone: patient.phone ?? "",
        cpf: patient.cpf ?? "",
        birth_date: patient.birth_date ?? "",
        address: patient.address ?? "",
        notes: patient.notes ?? "",
        avatar_url: patient.avatar_url ?? "",
        is_active: patient.is_active,
        assessment_date: patient.assessment_date ?? "",
        reassessment_date: patient.reassessment_date ?? "",
        financial_responsible_name: patient.financial_responsible_name ?? "",
        financial_responsible_cpf: patient.financial_responsible_cpf ?? "",
        session_price: patient.session_price != null ? String(patient.session_price) : "",
        therapy_end_date: patient.therapy_end_date ?? "",
        receipt_required: patient.receipt_required ?? false,
        billing_type: patient.billing_type ?? "sessao",
        father_name: patient.father_name ?? "",
        father_phone: patient.father_phone ?? "",
        mother_name: patient.mother_name ?? "",
        mother_phone: patient.mother_phone ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [patient, open]);

  const age = useMemo(() => calcAge(form.birth_date), [form.birth_date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Informe o nome do paciente");
      return;
    }
    if (!ownerId) return;

    setSaving(true);
    const price = form.session_price.trim()
      ? Number(form.session_price.replace(",", "."))
      : null;
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      cpf: form.cpf.trim() || null,
      birth_date: form.birth_date || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      avatar_url: form.avatar_url || null,
      is_active: form.is_active,
      assessment_date: form.assessment_date || null,
      reassessment_date: form.reassessment_date || null,
      financial_responsible_name: form.financial_responsible_name.trim() || null,
      financial_responsible_cpf: form.financial_responsible_cpf.trim() || null,
      session_price: price != null && !isNaN(price) ? price : null,
      therapy_end_date: form.therapy_end_date || null,
      receipt_required: form.receipt_required,
      billing_type: form.billing_type,
      father_name: form.father_name.trim() || null,
      father_phone: form.father_phone.trim() || null,
      mother_name: form.mother_name.trim() || null,
      mother_phone: form.mother_phone.trim() || null,
    };

    if (patient) {
      const { data, error } = await supabase
        .from("patients")
        .update(payload)
        .eq("id", patient.id)
        .select()
        .single();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Paciente atualizado");
      onSaved(data as Patient, false);
    } else {
      const { data, error } = await supabase
        .from("patients")
        .insert({ ...payload, owner_id: ownerId })
        .select()
        .single();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Paciente cadastrado");
      onSaved(data as Patient, true);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-background border-l border-border/60">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl font-semibold tracking-tight">
            {patient ? "Editar paciente" : "Novo paciente"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Informações pessoais e clínicas — armazenadas com criptografia.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {ownerId && (
            <div>
              <label className="text-xs text-muted-foreground">Foto</label>
              <div className="mt-2">
                <AvatarUpload
                  value={form.avatar_url || null}
                  onChange={(url) => setForm({ ...form, avatar_url: url ?? "" })}
                  ownerId={ownerId}
                  pathPrefix={`patients/${patient?.id ?? "new"}`}
                  fallback={form.full_name || "?"}
                  size={72}
                />
              </div>
            </div>
          )}

          <Field label="Nome do paciente *">
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={inputCls}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de nascimento">
              <input
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Idade">
              <input value={age} readOnly className={`${inputCls} bg-muted/40`} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF">
              <input
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Telefone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="E-mail">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
            />
          </Field>

          <Field label="Endereço">
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de avaliação">
              <input
                type="date"
                value={form.assessment_date}
                onChange={(e) => setForm({ ...form, assessment_date: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Data de reavaliação">
              <input
                type="date"
                value={form.reassessment_date}
                onChange={(e) => setForm({ ...form, reassessment_date: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Data de saída da terapia">
            <input
              type="date"
              value={form.therapy_end_date}
              onChange={(e) => setForm({ ...form, therapy_end_date: e.target.value })}
              className={inputCls}
            />
          </Field>

          <div className="pt-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Financeiro
            </div>
            <div className="space-y-3">
              <Field label="Responsável financeiro">
                <input
                  value={form.financial_responsible_name}
                  onChange={(e) =>
                    setForm({ ...form, financial_responsible_name: e.target.value })
                  }
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CPF do responsável">
                  <input
                    value={form.financial_responsible_cpf}
                    onChange={(e) =>
                      setForm({ ...form, financial_responsible_cpf: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Valor da sessão (R$)">
                  <input
                    inputMode="decimal"
                    value={form.session_price}
                    onChange={(e) => setForm({ ...form, session_price: e.target.value })}
                    className={inputCls}
                    placeholder="0,00"
                  />
                </Field>
              </div>
              <Field label="Forma de cobrança">
                <select
                  value={form.billing_type}
                  onChange={(e) => setForm({ ...form, billing_type: e.target.value })}
                  className={inputCls}
                >
                  <option value="sessao">Por sessão</option>
                  <option value="mensal">Mensal (mensalidade)</option>
                </select>
              </Field>
              <label className="flex items-center gap-2.5 text-sm text-muted-foreground select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.receipt_required}
                  onChange={(e) => setForm({ ...form, receipt_required: e.target.checked })}
                  className="h-4 w-4 rounded border-border/80 bg-background accent-foreground"
                />
                Emitir recibo de pagamento
              </label>
            </div>
          </div>

          <div className="pt-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Filiação
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome do pai">
                <input
                  value={form.father_name}
                  onChange={(e) => setForm({ ...form, father_name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Telefone do pai">
                <input
                  type="tel"
                  value={form.father_phone}
                  onChange={(e) => setForm({ ...form, father_phone: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Nome da mãe">
                <input
                  value={form.mother_name}
                  onChange={(e) => setForm({ ...form, mother_name: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Telefone da mãe">
                <input
                  type="tel"
                  value={form.mother_phone}
                  onChange={(e) => setForm({ ...form, mother_phone: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          <Field label="Observação">
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={`${inputCls} resize-none py-2`}
            />
          </Field>

          <label className="flex items-center gap-2.5 text-sm text-muted-foreground select-none cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-border/80 bg-background accent-foreground"
            />
            Paciente ativo
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
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
              {saving ? "Salvando..." : patient ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

const inputCls =
  "w-full h-11 px-3 rounded-lg bg-surface border border-border/60 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
