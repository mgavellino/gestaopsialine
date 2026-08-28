ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS series_id uuid;

CREATE INDEX IF NOT EXISTS appointments_series_idx
  ON public.appointments (owner_id, series_id);

ALTER TABLE public.appointment_receivables
  ADD COLUMN IF NOT EXISTS is_monthly boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS appointment_receivables_monthly_idx
  ON public.appointment_receivables (owner_id, is_monthly);