CREATE TABLE public.booking_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fee_task_id uuid NOT NULL UNIQUE REFERENCES public.concierge_tasks(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'authorised',
  authorised_at timestamptz NOT NULL DEFAULT now(),
  captured_at timestamptz,
  released_at timestamptz,
  confirmed_count integer NOT NULL DEFAULT 0,
  max_bookings integer NOT NULL DEFAULT 5,
  valid_from date,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_entitlements_status_check CHECK (status IN ('authorised','captured','released'))
);

GRANT SELECT ON public.booking_entitlements TO authenticated;
GRANT ALL ON public.booking_entitlements TO service_role;

ALTER TABLE public.booking_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own booking entitlements"
  ON public.booking_entitlements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "No client inserts"
  ON public.booking_entitlements FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "No client updates"
  ON public.booking_entitlements FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY "No client deletes"
  ON public.booking_entitlements FOR DELETE TO authenticated, anon USING (false);

CREATE INDEX idx_booking_entitlements_user ON public.booking_entitlements(user_id);

CREATE TRIGGER trg_booking_entitlements_updated
  BEFORE UPDATE ON public.booking_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.concierge_tasks ADD COLUMN entitlement_id uuid REFERENCES public.booking_entitlements(id) ON DELETE SET NULL;
CREATE INDEX idx_concierge_tasks_entitlement ON public.concierge_tasks(entitlement_id);

CREATE OR REPLACE FUNCTION public.booking_entitlement_state(user_uuid uuid)
RETURNS TABLE(
  id uuid,
  status text,
  confirmed_count integer,
  max_bookings integer,
  valid_from date,
  valid_until date,
  authorised_at timestamptz,
  captured_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.status, e.confirmed_count, e.max_bookings,
         e.valid_from, e.valid_until, e.authorised_at, e.captured_at
  FROM public.booking_entitlements e
  WHERE e.user_id = user_uuid
    AND e.status IN ('authorised','captured')
    AND e.confirmed_count < e.max_bookings
    AND (e.valid_until IS NULL OR e.valid_until >= (now() AT TIME ZONE 'utc')::date)
  ORDER BY e.authorised_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_booking_allowance(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.booking_entitlement_state(user_uuid));
$$;