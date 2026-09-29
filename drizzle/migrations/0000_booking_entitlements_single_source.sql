ALTER TABLE public.booking_entitlements
  ALTER COLUMN fee_task_id DROP NOT NULL,
  ADD COLUMN source text NOT NULL DEFAULT 'stripe',
  ADD COLUMN rc_transaction_id text,
  ADD COLUMN trip_dates_defaulted boolean NOT NULL DEFAULT false,
  ADD COLUMN release_reason text;

ALTER TABLE public.booking_entitlements
  ADD CONSTRAINT booking_entitlements_source_check CHECK (source IN ('stripe','apple','google')),
  ADD CONSTRAINT booking_entitlements_origin CHECK (
    (source = 'stripe' AND fee_task_id IS NOT NULL) OR
    (source IN ('apple','google') AND rc_transaction_id IS NOT NULL));

CREATE UNIQUE INDEX booking_entitlements_rc_tx
  ON public.booking_entitlements (rc_transaction_id) WHERE rc_transaction_id IS NOT NULL;

-- Backfill: no entitlement may be open-ended.
UPDATE public.booking_entitlements
   SET valid_from = COALESCE(valid_from, (created_at AT TIME ZONE 'utc')::date),
       valid_until = COALESCE(valid_from, (created_at AT TIME ZONE 'utc')::date) + 60,
       trip_dates_defaulted = true
 WHERE valid_until IS NULL;

COMMENT ON TABLE public.booking_entitlements IS
  'Single source of truth for restaurant booking access. Read via booking_entitlement_state().';
COMMENT ON TABLE public.trip_passes IS
  'Purchase log only. Nothing may gate on this table — access is booking_entitlements.';
COMMENT ON COLUMN public.profiles.trip_pass_active_until IS
  'Purchase log only (legacy). Nothing may gate on this — access is booking_entitlements.';

-- When a traveller adds trip dates later, realign any defaulted, still-open
-- entitlement: departure date, capped at valid_from + 60 days.
CREATE OR REPLACE FUNCTION public.realign_defaulted_entitlements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.departure_date IS NOT NULL
     AND NEW.departure_date IS DISTINCT FROM OLD.departure_date THEN
    UPDATE public.booking_entitlements e
       SET valid_until = LEAST(NEW.departure_date, e.valid_from + 60),
           trip_dates_defaulted = false
     WHERE e.user_id = NEW.user_id
       AND e.trip_dates_defaulted
       AND e.status IN ('authorised','captured');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_profiles_realign_entitlements
AFTER UPDATE OF departure_date ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.realign_defaulted_entitlements();

-- Expose the defaulted flag to the client state read.
DROP FUNCTION public.has_booking_allowance(uuid);
DROP FUNCTION public.booking_entitlement_state(uuid);
CREATE FUNCTION public.booking_entitlement_state(user_uuid uuid)
 RETURNS TABLE(id uuid, status text, confirmed_count integer, max_bookings integer, valid_from date, valid_until date, authorised_at timestamptz, captured_at timestamptz, source text, trip_dates_defaulted boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT e.id, e.status, e.confirmed_count, e.max_bookings,
         e.valid_from, e.valid_until, e.authorised_at, e.captured_at,
         e.source, e.trip_dates_defaulted
  FROM public.booking_entitlements e
  WHERE e.user_id = user_uuid
    AND e.status IN ('authorised','captured')
    AND e.confirmed_count < e.max_bookings
    AND e.valid_until IS NOT NULL
    AND e.valid_until >= (now() AT TIME ZONE 'utc')::date
  ORDER BY e.authorised_at DESC
  LIMIT 1;
$$;
CREATE FUNCTION public.has_booking_allowance(user_uuid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.booking_entitlement_state(user_uuid)); $$;
GRANT EXECUTE ON FUNCTION public.booking_entitlement_state(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_booking_allowance(uuid) TO authenticated, service_role;