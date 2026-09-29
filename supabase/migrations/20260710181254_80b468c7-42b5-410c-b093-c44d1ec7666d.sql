ALTER TABLE public.concierge_tasks
  ADD COLUMN IF NOT EXISTS charge_amount_cents integer,
  ADD COLUMN IF NOT EXISTS charge_currency text,
  ADD COLUMN IF NOT EXISTS fx_rate_used numeric(18,8),
  ADD COLUMN IF NOT EXISTS quoted_cny_cents integer;

ALTER TABLE public.concierge_tasks
  DROP CONSTRAINT IF EXISTS concierge_tasks_charge_currency_check;
ALTER TABLE public.concierge_tasks
  ADD CONSTRAINT concierge_tasks_charge_currency_check
  CHECK (charge_currency IS NULL OR charge_currency ~ '^[A-Z]{3}$');