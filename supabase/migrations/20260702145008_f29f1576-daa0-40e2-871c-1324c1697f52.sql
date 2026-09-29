
DROP POLICY IF EXISTS "Users cancel own tasks" ON public.concierge_tasks;

CREATE POLICY "Users cancel own tasks"
ON public.concierge_tasks
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND status = 'cancelled'::concierge_task_status);

CREATE OR REPLACE FUNCTION public.concierge_tasks_guard_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only guard when the updater is the task owner and NOT the assigned assistant
  -- Assistants and service_role updates go through separate flows.
  IF auth.uid() IS NOT NULL
     AND NEW.user_id = auth.uid()
     AND (OLD.assistant_id IS DISTINCT FROM auth.uid())
     AND NOT public.has_role(auth.uid(), 'concierge_assistant'::app_role)
  THEN
    -- Owner is only allowed to cancel; nothing else may change.
    IF NEW.status IS DISTINCT FROM 'cancelled'::concierge_task_status THEN
      RAISE EXCEPTION 'Owners may only cancel their own tasks';
    END IF;
    IF NEW.user_id       IS DISTINCT FROM OLD.user_id
    OR NEW.assistant_id  IS DISTINCT FROM OLD.assistant_id
    OR NEW.price_cents   IS DISTINCT FROM OLD.price_cents
    OR NEW.currency      IS DISTINCT FROM OLD.currency
    OR NEW.category      IS DISTINCT FROM OLD.category
    OR NEW.summary       IS DISTINCT FROM OLD.summary
    OR NEW.created_at    IS DISTINCT FROM OLD.created_at
    OR NEW.completed_at  IS DISTINCT FROM OLD.completed_at
    THEN
      RAISE EXCEPTION 'Owners may only change status to cancelled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS concierge_tasks_guard_user_update ON public.concierge_tasks;
CREATE TRIGGER concierge_tasks_guard_user_update
BEFORE UPDATE ON public.concierge_tasks
FOR EACH ROW EXECUTE FUNCTION public.concierge_tasks_guard_user_update();
