-- Replace the SELECT policy on concierge_tasks so the visible-to-assistant
-- set is in exact lockstep with concierge-claim-task's claimability rules.
-- Claimable states (from concierge-claim-task):
--   (a) status = 'pending' AND assistant_id IS NULL
--   (b) category = 'transfer' AND status = 'pay_to_confirm'
--       AND assistant_id IS NULL AND (authorized_at IS NOT NULL OR paid_at IS NOT NULL)
-- Keep these two branches in lockstep with that function — if you change one,
-- change the other in the SAME commit.
DROP POLICY IF EXISTS "Users read own tasks" ON public.concierge_tasks;

CREATE POLICY "Users read own tasks"
ON public.concierge_tasks
FOR SELECT
USING (
  user_id = auth.uid()
  OR assistant_id = auth.uid()
  OR (
    -- lockstep with concierge-claim-task branch (a)
    status = 'pending'::concierge_task_status
    AND assistant_id IS NULL
    AND public.has_role(auth.uid(), 'concierge_assistant'::app_role)
  )
  OR (
    -- lockstep with concierge-claim-task branch (b)
    category = 'transfer'
    AND status = 'pay_to_confirm'::concierge_task_status
    AND assistant_id IS NULL
    AND (authorized_at IS NOT NULL OR paid_at IS NOT NULL)
    AND public.has_role(auth.uid(), 'concierge_assistant'::app_role)
  )
);

COMMENT ON POLICY "Users read own tasks" ON public.concierge_tasks IS
  'Assistant-visible branches must stay in exact lockstep with concierge-claim-task claimability rules: (pending + unassigned) and (transfer + pay_to_confirm + unassigned + authorized_at or paid_at set).';