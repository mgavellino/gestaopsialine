-- Adia a criação de recebíveis para o momento em que a consulta é marcada "Realizada",
-- em vez de criá-los no momento do agendamento.
-- Também prepara o agrupamento de mensalidades por período (mês).

-- 1) Guarda a intenção de cobrança na própria consulta, para ser processada só quando
--    o status virar 'completed'.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS billing_mode text CHECK (billing_mode IN ('sessao', 'mensal')),
  ADD COLUMN IF NOT EXISTS bill_amount_cents integer,
  ADD COLUMN IF NOT EXISTS receivable_created boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.appointments.billing_mode IS
  'Forma de cobrança escolhida ao agendar (sessao|mensal). O recebível só é gerado quando status = completed.';
COMMENT ON COLUMN public.appointments.bill_amount_cents IS
  'Valor da sessão definido ao agendar, usado para gerar o recebível quando a consulta for marcada como realizada.';
COMMENT ON COLUMN public.appointments.receivable_created IS
  'Evita gerar o recebível mais de uma vez para a mesma consulta.';

-- 2) Consultas já concluídas antes desta migration não devem tentar gerar recebível
--    retroativamente (evita cobrança duplicada de sessões antigas).
UPDATE public.appointments
  SET receivable_created = true
  WHERE status = 'completed';

-- 3) Chave de período (ex: "2026-09") para agrupar mensalidades por paciente/mês
--    sem depender de um único appointment_id.
ALTER TABLE public.appointment_receivables
  ADD COLUMN IF NOT EXISTS period_key text;

COMMENT ON COLUMN public.appointment_receivables.period_key IS
  'Usado para recebíveis mensais (is_monthly=true): agrupa sessões do mesmo paciente/mês (formato YYYY-MM) num único recebível.';

CREATE INDEX IF NOT EXISTS appointment_receivables_period_key_idx
  ON public.appointment_receivables (owner_id, patient_id, period_key)
  WHERE is_monthly = true;
