
ALTER TABLE public.concierge_tasks
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer;

CREATE OR REPLACE FUNCTION public.expire_unpaid_transfers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_id uuid;
BEGIN
  FOR expired_id IN
    SELECT id FROM public.concierge_tasks
    WHERE category = 'transfer'
      AND status = 'pay_to_confirm'
      AND paid_at IS NULL
      AND created_at < now() - interval '24 hours'
  LOOP
    UPDATE public.concierge_tasks SET status = 'cancelled' WHERE id = expired_id;
    INSERT INTO public.concierge_messages (task_id, sender, body)
      VALUES (expired_id, 'system',
        'This request was cancelled — payment wasn''t completed within 24 hours. You can start a new booking any time.');
  END LOOP;
END;
$$;

-- Idempotent cron registration: unschedule prior job if it exists, then reschedule.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-unpaid-transfers') THEN
    PERFORM cron.unschedule('expire-unpaid-transfers');
  END IF;
  PERFORM cron.schedule(
    'expire-unpaid-transfers',
    '*/30 * * * *',
    $cron$ SELECT public.expire_unpaid_transfers(); $cron$
  );
END $$;
