ALTER TABLE public.concierge_tasks
  ADD COLUMN IF NOT EXISTS stripe_env text
  CHECK (stripe_env IN ('sandbox', 'live'));