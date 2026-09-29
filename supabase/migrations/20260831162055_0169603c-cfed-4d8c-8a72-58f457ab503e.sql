DROP TABLE IF EXISTS public.device_push_tokens;

ALTER TABLE public.notification_preferences
  DROP COLUMN IF EXISTS push_prompt_snoozed_until,
  DROP COLUMN IF EXISTS push_permission;