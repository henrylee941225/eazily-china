
ALTER TABLE public.concierge_tasks
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS capture_method TEXT NULL,
  ADD COLUMN IF NOT EXISTS hold_released_at TIMESTAMPTZ NULL;

ALTER TABLE public.concierge_tasks
  DROP CONSTRAINT IF EXISTS concierge_tasks_capture_method_chk;
ALTER TABLE public.concierge_tasks
  ADD CONSTRAINT concierge_tasks_capture_method_chk
  CHECK (capture_method IS NULL OR capture_method IN ('manual', 'automatic'));

-- Authorised tasks are exempt from 24h unpaid expiry; only never-paid,
-- never-authorised transfers get auto-cancelled.
CREATE OR REPLACE FUNCTION public.expire_unpaid_transfers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
      AND created_at < now() - interval '24 hours'
  LOOP
    UPDATE public.concierge_tasks SET status = 'cancelled' WHERE id = expired_id;
    INSERT INTO public.concierge_messages (task_id, sender, body)
      VALUES (expired_id, 'system',
        'This request was cancelled — payment wasn''t completed within 24 hours. You can start a new booking any time.');
  END LOOP;
END;
$function$;
