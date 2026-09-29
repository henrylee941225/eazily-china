ALTER TABLE public.concierge_tasks
  ADD COLUMN IF NOT EXISTS quoted_gbp_cents integer;

COMMENT ON COLUMN public.concierge_tasks.quoted_gbp_cents IS
  'Ops-entered canonical quote in GBP (minor units). Supersedes quoted_cny_cents, which is retained nullable for legacy tasks only.';