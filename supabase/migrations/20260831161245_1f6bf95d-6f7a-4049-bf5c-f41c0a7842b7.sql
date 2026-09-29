ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_prompt_snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS push_permission text NOT NULL DEFAULT 'unknown'
    CHECK (push_permission IN ('unknown','granted','denied','declined_in_app'));