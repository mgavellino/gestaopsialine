ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS therapy_end_date date,
  ADD COLUMN IF NOT EXISTS receipt_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'sessao';