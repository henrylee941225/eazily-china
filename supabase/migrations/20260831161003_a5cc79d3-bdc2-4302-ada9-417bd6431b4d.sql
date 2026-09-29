CREATE OR REPLACE FUNCTION public.concierge_tasks_notify_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_key text;
  v_changed boolean;
  v_discriminator text;
  v_dedupe_key text;
BEGIN
  v_changed :=
       NEW.status           IS DISTINCT FROM OLD.status
    OR NEW.authorized_at    IS DISTINCT FROM OLD.authorized_at
    OR NEW.paid_at          IS DISTINCT FROM OLD.paid_at
    OR NEW.hold_released_at IS DISTINCT FROM OLD.hold_released_at
    OR NEW.refunded_at      IS DISTINCT FROM OLD.refunded_at;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  -- Mirrors the presentation phase logic (paymentPhase.ts) in precedence order.
  IF NEW.status IN ('confirmed','completed') THEN
    v_event_key := CASE WHEN OLD.status = 'change_pending'
                        THEN 'change_confirmed' ELSE 'driver_confirmed' END;
  ELSIF NEW.status = 'unavailable' THEN
    v_event_key := 'booking_unavailable';
  ELSIF NEW.status = 'cancelled' THEN
    v_event_key := 'booking_cancelled';
  ELSIF NEW.status = 'pay_to_confirm' THEN
    IF NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL THEN
      v_event_key := 'payment_received';
    ELSIF NEW.authorized_at IS NOT NULL AND OLD.authorized_at IS NULL
          AND NEW.paid_at IS NULL AND NEW.hold_released_at IS NULL THEN
      v_event_key := 'payment_authorised';
    END IF;
  END IF;

  IF v_event_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- One-shot events dedupe on task + event_key. Repeatable events add a
  -- discriminator so a genuinely new failure/change notifies, while a webhook
  -- retry of the same payment intent (or the same transition) is rejected.
  IF v_event_key = 'payment_failed' THEN
    v_discriminator := COALESCE(
      NULLIF(NEW.stripe_payment_intent_id, ''),
      extract(epoch from now())::bigint::text
    );
  ELSIF v_event_key = 'change_confirmed' THEN
    v_discriminator := to_char(
      COALESCE(NEW.updated_at, now()) AT TIME ZONE 'utc',
      'YYYY-MM-DD"T"HH24:MI:SS.USOF'
    );
  ELSE
    v_discriminator := NULL;
  END IF;

  v_dedupe_key := NEW.id::text || ':' || v_event_key
                  || COALESCE(':' || v_discriminator, '');

  INSERT INTO public.notification_events (
    task_id, user_id, event_key, from_status, to_status, payload, dedupe_key
  ) VALUES (
    NEW.id, NEW.user_id, v_event_key, OLD.status::text, NEW.status::text,
    jsonb_build_object(
      'category', NEW.category::text,
      'summary', NEW.summary,
      'city', NEW.city,
      'booking_reference', NEW.booking_reference,
      'amount_cents', COALESCE(NEW.charge_amount_cents, NEW.amount_paid_cents, NEW.price_cents),
      'currency', COALESCE(NEW.charge_currency, NEW.currency),
      'paid_at', NEW.paid_at,
      'authorized_at', NEW.authorized_at,
      'hold_released_at', NEW.hold_released_at,
      'refunded_at', NEW.refunded_at,
      'pickup_at', NEW.details_json ->> 'pickup_at',
      'timezone', COALESCE(NEW.details_json ->> 'timezone', 'Asia/Shanghai'),
      'pickup_location', NEW.details_json ->> 'pickup_location',
      'dropoff_location', NEW.details_json ->> 'dropoff_location',
      'driver_name', NEW.details_json ->> 'driver_name',
      'driver_phone', NEW.details_json ->> 'driver_phone',
      'vehicle', NEW.details_json ->> 'vehicle',
      'plate', NEW.details_json ->> 'plate'
    ),
    v_dedupe_key
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$function$;