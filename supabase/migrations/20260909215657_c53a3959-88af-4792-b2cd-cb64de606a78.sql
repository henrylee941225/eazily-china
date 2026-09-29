-- Backfill: every existing payment record predates the live cutover.
UPDATE public.concierge_tasks
   SET stripe_env = 'sandbox'
 WHERE stripe_env IS NULL
   AND (stripe_payment_intent_id IS NOT NULL OR stripe_session_id IS NOT NULL);

UPDATE public.trip_passes
   SET stripe_env = 'sandbox'
 WHERE stripe_env IS NULL
   AND (stripe_session_id IS NOT NULL OR stripe_payment_id IS NOT NULL);

-- Any row that touched Stripe must say which mode it touched. Rows with no
-- payment attached may keep a NULL env.
ALTER TABLE public.concierge_tasks
  ADD CONSTRAINT concierge_tasks_stripe_env_required
  CHECK (
    (stripe_payment_intent_id IS NULL AND stripe_session_id IS NULL)
    OR stripe_env IN ('sandbox', 'live')
  );

ALTER TABLE public.trip_passes
  ADD CONSTRAINT trip_passes_stripe_env_required
  CHECK (
    (stripe_session_id IS NULL AND stripe_payment_id IS NULL)
    OR stripe_env IN ('sandbox', 'live')
  );