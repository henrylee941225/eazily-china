CREATE TABLE public.device_push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios','android')),
  app_version text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX device_push_tokens_user_id_idx ON public.device_push_tokens (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT ALL ON public.device_push_tokens TO service_role;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own device tokens"
  ON public.device_push_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);