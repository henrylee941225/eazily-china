
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pretrip_tasks_done_valid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pretrip_tasks_done_valid
  CHECK (pretrip_tasks_done <@ ARRAY['payments','esim','vpn','visa','apps','transfer']::text[]);

COMMENT ON CONSTRAINT profiles_pretrip_tasks_done_valid ON public.profiles IS
  'Allowed slugs must match PRETRIP_TASKS in src/data/pretripTasks.ts. When adding a task there, update this constraint in the same change.';
