ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recently_recommended text[] NOT NULL DEFAULT '{}'::text[];