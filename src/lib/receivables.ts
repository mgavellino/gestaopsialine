import { endOfMonth, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export type BillingMode = "sessao" | "mensal";

export type CompletableAppointment = {
  id: string;
  owner_id: string;
  patient_id: string | null;
  starts_at: string;
  billing_mode: string | null;
  bill_amount_cents: number | null;
  receivable_created: boolean;
};

/** Chave de período mensal no formato "yyyy-MM", usada para agrupar mensalidades. */
export function monthPeriodKey(date: Date): string {
  return format(date, "yyyy-MM");
}

/**
 * Gera o(s) recebível(is) de uma consulta no momento em que ela é marcada como "Realizada".
 * Idempotente: não faz nada se a consulta não tiver cobrança configurada ou já tiver
 * gerado o recebível antes.
 *
 * - "sessao": cria um recebível avulso vinculado à consulta.
 * - "mensal": soma o valor a um recebível mensal existente (mesmo paciente + mês) ou
 *   cria um novo, com vencimento no fim do mês.
 */
export async function generateReceivableForCompletedAppointment(
  appt: CompletableAppointment,
  patientName?: string,
): Promise<void> {
  if (appt.receivable_created) return;
  if (!appt.billing_mode || !appt.bill_amount_cents || appt.bill_amount_cents <= 0) return;

  const mode = appt.billing_mode as BillingMode;
  const starts = new Date(appt.starts_at);

  if (mode === "sessao") {
    const { error } = await supabase.from("appointment_receivables").insert({
      owner_id: appt.owner_id,
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      description: patientName ? `Sessão ${format(starts, "dd/MM/yyyy")} — ${patientName}` : null,
      amount_cents: appt.bill_amount_cents,
      status: "pending",
      due_at: appt.starts_at,
      is_monthly: false,
    });
    if (error) throw error;
  } else {
    // Mensalidade sempre pertence a um paciente; sem isso não há como agrupar.
    if (!appt.patient_id) return;
    const patientId = appt.patient_id;
    const periodKey = monthPeriodKey(starts);
    const { data: existing, error: findError } = await supabase
      .from("appointment_receivables")
      .select("id, amount_cents")
      .eq("owner_id", appt.owner_id)
      .eq("patient_id", patientId)
      .eq("is_monthly", true)
      .eq("period_key", periodKey)
      .eq("status", "pending")
      .maybeSingle();
    if (findError) throw findError;

    if (existing) {
      const { error } = await supabase
        .from("appointment_receivables")
        .update({ amount_cents: existing.amount_cents + appt.bill_amount_cents })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const due = endOfMonth(starts);
      due.setHours(12, 0, 0, 0);
      const { error } = await supabase.from("appointment_receivables").insert({
        owner_id: appt.owner_id,
        appointment_id: null,
        patient_id: appt.patient_id,
        description: `Mensalidade ${format(starts, "MMMM/yyyy")}${patientName ? ` — ${patientName}` : ""}`,
        amount_cents: appt.bill_amount_cents,
        status: "pending",
        due_at: due.toISOString(),
        is_monthly: true,
        period_key: periodKey,
      });
      if (error) throw error;
    }
  }

  const { error: flagError } = await supabase
    .from("appointments")
    .update({ receivable_created: true })
    .eq("id", appt.id);
  if (flagError) throw flagError;
}
