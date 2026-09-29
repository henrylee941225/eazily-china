CREATE UNIQUE INDEX IF NOT EXISTS concierge_tasks_one_open_restaurant_fee
  ON public.concierge_tasks (user_id)
  WHERE category = 'restaurant_reservation'
    AND status = 'pay_to_confirm'
    AND authorized_at IS NULL
    AND paid_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS booking_entitlements_one_authorised
  ON public.booking_entitlements (user_id)
  WHERE status = 'authorised';