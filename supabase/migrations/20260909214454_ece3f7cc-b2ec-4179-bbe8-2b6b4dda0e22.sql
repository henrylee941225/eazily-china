-- Money-only records kept after an account is deleted. Deliberately excludes
-- every personal field (name, email, phone, addresses, chat, itineraries):
-- what remains is a pseudonymous reference plus the transaction facts we are
-- required to keep for accounting and to reconcile against Stripe, which
-- holds its own copy of payment records independently.
CREATE TABLE public.retained_transaction_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  former_user_id uuid NOT NULL,
  source_table text NOT NULL,
  source_id uuid,
  category text,
  status text,
  amount_cents integer,
  currency text,
  stripe_payment_intent_id text,
  stripe_session_id text,
  stripe_refund_id text,
  stripe_env text,
  occurred_at timestamptz,
  account_deleted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX retained_transaction_records_former_user_idx
  ON public.retained_transaction_records (former_user_id);

GRANT ALL ON public.retained_transaction_records TO service_role;
GRANT SELECT ON public.retained_transaction_records TO authenticated;

ALTER TABLE public.retained_transaction_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ops can view retained transaction records"
  ON public.retained_transaction_records
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'concierge_assistant'::app_role)
  );

-- Single place where account cleanup lives. Nothing else should delete user
-- rows piecemeal: the Google-account cleanup showed that no foreign key
-- cascades, so an auth delete on its own leaves orphans behind.
CREATE OR REPLACE FUNCTION public.delete_user_data(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb := '{}'::jsonb;
  n integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'delete_user_data: _user_id is required';
  END IF;

  -- 1. Retain the money facts (anonymised) before anything is removed.
  INSERT INTO public.retained_transaction_records (
    former_user_id, source_table, source_id, category, status,
    amount_cents, currency, stripe_payment_intent_id, stripe_session_id,
    stripe_refund_id, stripe_env, occurred_at
  )
  SELECT t.user_id, 'concierge_tasks', t.id, t.category::text, t.status::text,
         COALESCE(t.charge_amount_cents, t.amount_paid_cents, t.price_cents),
         COALESCE(t.charge_currency, t.currency),
         t.stripe_payment_intent_id, t.stripe_session_id, t.stripe_refund_id,
         t.stripe_env, COALESCE(t.paid_at, t.authorized_at, t.created_at)
    FROM public.concierge_tasks t
   WHERE t.user_id = _user_id
     AND (t.stripe_payment_intent_id IS NOT NULL OR t.stripe_session_id IS NOT NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('retained_task_payments', n);

  INSERT INTO public.retained_transaction_records (
    former_user_id, source_table, source_id, status, amount_cents, currency,
    stripe_payment_intent_id, stripe_session_id, stripe_env, occurred_at
  )
  SELECT p.user_id, 'trip_passes', p.id, p.status,
         COALESCE(p.charge_amount_cents, p.amount_paid_usd_cents),
         COALESCE(p.charge_currency, 'USD'),
         p.stripe_payment_id, p.stripe_session_id, p.stripe_env, p.purchased_at
    FROM public.trip_passes p
   WHERE p.user_id = _user_id
     AND (p.stripe_payment_id IS NOT NULL OR p.stripe_session_id IS NOT NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('retained_pass_payments', n);

  INSERT INTO public.retained_transaction_records (
    former_user_id, source_table, source_id, status, amount_cents, currency,
    stripe_payment_intent_id, occurred_at
  )
  SELECT e.user_id, 'booking_entitlements', e.id, e.status, NULL, NULL,
         e.stripe_payment_intent_id, COALESCE(e.captured_at, e.authorised_at)
    FROM public.booking_entitlements e
   WHERE e.user_id = _user_id
     AND e.stripe_payment_intent_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('retained_entitlement_payments', n);

  -- 2. Clear everything personal. Order matters: children before parents.
  DELETE FROM public.notification_deliveries d
   USING public.notification_events e
   WHERE d.event_id = e.id AND e.user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('notification_deliveries', n);

  DELETE FROM public.notification_events WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('notification_events', n);

  DELETE FROM public.concierge_messages m
   USING public.concierge_tasks t
   WHERE m.task_id = t.id AND t.user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('concierge_messages', n);

  DELETE FROM public.concierge_messages WHERE sender_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('concierge_messages_sent', n);

  -- Break the entitlement <-> task cycle before deleting either side.
  UPDATE public.concierge_tasks SET entitlement_id = NULL WHERE user_id = _user_id;
  UPDATE public.booking_entitlements e SET fee_task_id = NULL
   WHERE e.user_id = _user_id AND FALSE; -- fee_task_id is NOT NULL; handled by delete order

  DELETE FROM public.booking_entitlements WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('booking_entitlements', n);

  DELETE FROM public.concierge_tasks WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('concierge_tasks', n);

  UPDATE public.concierge_tasks SET assistant_id = NULL WHERE assistant_id = _user_id;

  DELETE FROM public.trip_passes WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('trip_passes', n);

  DELETE FROM public.subscriptions WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('subscriptions', n);

  DELETE FROM public.saved_plans WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('saved_plans', n);

  DELETE FROM public.notification_preferences WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('notification_preferences', n);

  DELETE FROM public.ai_usage_events WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('ai_usage_events', n);

  DELETE FROM public.assistant_profiles WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('assistant_profiles', n);

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('user_roles', n);

  DELETE FROM public.profiles WHERE user_id = _user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  v := v || jsonb_build_object('profiles', n);

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(uuid) TO service_role;