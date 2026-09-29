-- 1. Tables

CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.concierge_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_key text NOT NULL,
  from_status text,
  to_status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL UNIQUE,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notification events"
  ON public.notification_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'concierge_assistant'::app_role));

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','push','inapp')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  provider_message_id text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, channel)
);

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notification deliveries"
  ON public.notification_deliveries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.notification_events e
    WHERE e.id = event_id
      AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'concierge_assistant'::app_role))
  ));

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notification preferences"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users create their own notification preferences"
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update their own notification preferences"
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_notification_deliveries_updated
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_notification_preferences_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_notification_events_unprocessed
  ON public.notification_events (created_at) WHERE processed_at IS NULL;
CREATE INDEX idx_notification_events_task ON public.notification_events (task_id);

-- 2. Trigger on concierge_tasks

CREATE OR REPLACE FUNCTION public.concierge_tasks_notify_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_key text;
  v_changed boolean;
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
    NEW.id::text || ':' || v_event_key
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER concierge_tasks_notify_event
  AFTER UPDATE ON public.concierge_tasks
  FOR EACH ROW EXECUTE FUNCTION public.concierge_tasks_notify_event();

-- 3. Cron: dispatch pending notification events every minute
SELECT cron.schedule(
  'process-notification-events',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://jraltaobsyrnoaeugkho.supabase.co/functions/v1/process-notification-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);