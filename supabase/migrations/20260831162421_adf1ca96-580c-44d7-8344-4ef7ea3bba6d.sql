-- Pickup reminders for confirmed transfers.
--
-- Two one-shot reminders per booking:
--   pickup_reminder_24h  -> T-24h
--   pickup_reminder_2h   -> fired at T-3h (email is slower and easier to miss
--                           than push, so it gets an extra hour to land; the
--                           event key is kept for continuity)
--
-- Payload is fully self-contained: the reminder email must be readable on a
-- mainland network with no app access.
CREATE OR REPLACE FUNCTION public.enqueue_pickup_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t record;
  v_key text;
  v_pickup timestamptz;
BEGIN
  FOR t IN
    SELECT id, user_id, category, summary, city, booking_reference, details_json,
           charge_amount_cents, charge_currency, price_cents, currency
    FROM public.concierge_tasks
    WHERE category = 'transfer'
      AND status IN ('confirmed', 'completed')
      AND details_json ? 'pickup_at'
      AND (details_json ->> 'pickup_at') ~
          '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$'
      AND (details_json ->> 'pickup_at')::timestamptz > now()
      AND (details_json ->> 'pickup_at')::timestamptz <= now() + interval '24 hours'
  LOOP
    v_pickup := (t.details_json ->> 'pickup_at')::timestamptz;

    -- Both windows are "at or past the threshold, still in the future", so a
    -- missed cron run catches up on the next tick instead of skipping.
    FOREACH v_key IN ARRAY ARRAY['pickup_reminder_24h', 'pickup_reminder_2h'] LOOP
      CONTINUE WHEN v_key = 'pickup_reminder_2h'
                AND v_pickup > now() + interval '3 hours';

      INSERT INTO public.notification_events (
        task_id, user_id, event_key, from_status, to_status, payload, dedupe_key
      ) VALUES (
        t.id, t.user_id, v_key, NULL, 'confirmed',
        jsonb_build_object(
          'category', t.category::text,
          'summary', t.summary,
          'city', t.city,
          'booking_reference', t.booking_reference,
          'pickup_at', t.details_json ->> 'pickup_at',
          'timezone', COALESCE(t.details_json ->> 'timezone', 'Asia/Shanghai'),
          'pickup_location', COALESCE(
            t.details_json ->> 'pickup_address_full',
            t.details_json ->> 'pickup_address',
            NULLIF(concat_ws(' · ',
              t.details_json ->> 'airport_name',
              t.details_json ->> 'terminal'), '')
          ),
          'dropoff_location', COALESCE(
            t.details_json ->> 'dropoff_address_full',
            t.details_json ->> 'dropoff_address',
            NULLIF(concat_ws(' · ',
              t.details_json ->> 'airport_name',
              t.details_json ->> 'terminal'), '')
          ),
          'meeting_point', t.details_json #>> '{driver,meeting_point}',
          'driver_name', t.details_json #>> '{driver,name}',
          'driver_phone', COALESCE(t.details_json #>> '{driver,phone}',
                                   t.details_json ->> 'driver_phone'),
          'vehicle', t.details_json #>> '{driver,vehicle}',
          'plate', t.details_json #>> '{driver,plate}',
          'flight_number', t.details_json ->> 'flight_number',
          'pax', t.details_json ->> 'pax',
          'bags', t.details_json ->> 'bags',
          'amount_cents', COALESCE(t.charge_amount_cents, t.price_cents),
          'currency', COALESCE(t.charge_currency, t.currency)
        ),
        t.id::text || ':' || v_key
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_pickup_reminders() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'enqueue-pickup-reminders',
  '*/5 * * * *',
  $cron$ SELECT public.enqueue_pickup_reminders(); $cron$
);