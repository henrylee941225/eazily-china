ALTER TYPE public.concierge_task_status ADD VALUE IF NOT EXISTS 'confirming';
ALTER TYPE public.concierge_task_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.concierge_task_status ADD VALUE IF NOT EXISTS 'change_pending';
ALTER TYPE public.concierge_task_status ADD VALUE IF NOT EXISTS 'pay_to_confirm';
ALTER TYPE public.concierge_task_status ADD VALUE IF NOT EXISTS 'unavailable';

ALTER TABLE public.concierge_tasks
  ADD COLUMN IF NOT EXISTS previous_status public.concierge_task_status;

ALTER TABLE public.concierge_tasks
  ADD COLUMN IF NOT EXISTS booking_reference text;