ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pretrip_tasks_done text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS pretrip_hidden_until date,
  ADD COLUMN IF NOT EXISTS pretrip_dismissed boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_pretrip_tasks_done_valid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pretrip_tasks_done_valid
  CHECK (pretrip_tasks_done <@ ARRAY['payments','esim','vpn','visa']::text[]);