ALTER TABLE public.booking_entitlements
  ADD COLUMN rc_transaction_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN extended_at timestamptz,
  ADD COLUMN extension_seen_at timestamptz;
UPDATE public.booking_entitlements
   SET rc_transaction_ids = ARRAY[rc_transaction_id]
 WHERE rc_transaction_id IS NOT NULL;
CREATE INDEX booking_entitlements_rc_tx_ids ON public.booking_entitlements USING gin (rc_transaction_ids);

CREATE FUNCTION public.ack_entitlement_extension(_id uuid) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.booking_entitlements SET extension_seen_at = now()
   WHERE id = _id AND user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.ack_entitlement_extension(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ack_entitlement_extension(uuid) TO authenticated;

DROP FUNCTION public.has_booking_allowance(uuid);
DROP FUNCTION public.booking_entitlement_state(uuid);
CREATE FUNCTION public.booking_entitlement_state(user_uuid uuid)
 RETURNS TABLE(id uuid, status text, confirmed_count integer, max_bookings integer, valid_from date, valid_until date, authorised_at timestamptz, captured_at timestamptz, source text, trip_dates_defaulted boolean, extended_at timestamptz, extension_seen_at timestamptz, rc_transaction_ids text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT e.id, e.status, e.confirmed_count, e.max_bookings,
         e.valid_from, e.valid_until, e.authorised_at, e.captured_at,
         e.source, e.trip_dates_defaulted, e.extended_at, e.extension_seen_at, e.rc_transaction_ids
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

CREATE TABLE public.revenuecat_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text NOT NULL,
  event_type text,
  app_user_id text,
  transaction_id text,
  raw_event jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  replayed_at timestamptz,
  replay_result text
);
GRANT ALL ON public.revenuecat_dead_letters TO service_role;
GRANT SELECT ON public.revenuecat_dead_letters TO authenticated;
ALTER TABLE public.revenuecat_dead_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ops can read dead letters" ON public.revenuecat_dead_letters
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'concierge_assistant'));