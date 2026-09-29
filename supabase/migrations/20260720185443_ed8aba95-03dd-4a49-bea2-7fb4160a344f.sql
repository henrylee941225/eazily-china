
CREATE OR REPLACE FUNCTION public.expire_unpaid_transfers()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  expired_id uuid;
BEGIN
  FOR expired_id IN
    SELECT id FROM public.concierge_tasks
    WHERE category = 'transfer'
      AND status = 'pay_to_confirm'
      AND paid_at IS NULL
      AND authorized_at IS NULL
      -- Guard the cast: only rows with a parseable ISO-8601 timestamp
      -- participate. Malformed / missing pickup_at values are skipped
      -- rather than raising, so one bad row can't stall the cron.
      AND details_json ? 'pickup_at'
      AND (details_json ->> 'pickup_at') ~
          '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$'
      AND (details_json ->> 'pickup_at')::timestamptz < (now() - interval '1 hour')
  LOOP
    UPDATE public.concierge_tasks SET status = 'cancelled' WHERE id = expired_id;
    INSERT INTO public.concierge_messages (task_id, sender, body)
      VALUES (expired_id, 'system',
        'This request expired before payment — nothing was charged. You can request another transfer any time.');
  END LOOP;
END;
$function$;

-- Schedule hourly. Unschedule any prior job with the same name first so
-- re-running this migration is idempotent.
DO $$
BEGIN
  PERFORM cron.unschedule('expire-unpaid-transfers');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-unpaid-transfers',
  '0 * * * *',
  $cron$ SELECT public.expire_unpaid_transfers(); $cron$
);
