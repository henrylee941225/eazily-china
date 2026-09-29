
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hidden_from_home text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.profiles.hidden_from_home IS
  'Namespaced IDs the user has dismissed from the Home hub (e.g. booking:<uuid>, plan:<uuid>). Home read/write only; Bookings tab and saved plans ignore this. Safety valve: bookings in pay_to_confirm/unavailable/change_pending reappear on Home regardless of this list.';
