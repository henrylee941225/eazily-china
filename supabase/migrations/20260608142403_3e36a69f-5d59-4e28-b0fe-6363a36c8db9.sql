CREATE TABLE public.saved_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  city TEXT,
  mood TEXT,
  time_budget_hours NUMERIC,
  plan JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_plans TO authenticated;
GRANT ALL ON public.saved_plans TO service_role;

ALTER TABLE public.saved_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved plans"
  ON public.saved_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved plans"
  ON public.saved_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved plans"
  ON public.saved_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved plans"
  ON public.saved_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX saved_plans_user_id_idx ON public.saved_plans(user_id);

CREATE TRIGGER update_saved_plans_updated_at
  BEFORE UPDATE ON public.saved_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();