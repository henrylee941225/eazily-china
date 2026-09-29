ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_booking_used_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS free_booking_task_id uuid NULL;