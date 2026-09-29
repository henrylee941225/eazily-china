ALTER TABLE public.trip_passes
  ADD COLUMN IF NOT EXISTS stripe_env text
  CHECK (stripe_env IN ('sandbox', 'live'));