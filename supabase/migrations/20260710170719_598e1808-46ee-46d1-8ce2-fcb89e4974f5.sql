ALTER TABLE public.concierge_tasks
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_concierge_tasks_stripe_session
  ON public.concierge_tasks(stripe_session_id);