# Store purchase handler: extend instead of flag, and dead-letter unknown users

## Database change (needs approval)
```sql
-- 1. Extension bookkeeping on the allowance
ALTER TABLE public.booking_entitlements
  ADD COLUMN rc_transaction_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN extended_at timestamptz,
  ADD COLUMN extension_seen_at timestamptz;
UPDATE public.booking_entitlements
   SET rc_transaction_ids = ARRAY[rc_transaction_id]
 WHERE rc_transaction_id IS NOT NULL;
CREATE INDEX booking_entitlements_rc_tx_ids ON public.booking_entitlements USING gin (rc_transaction_ids);

-- Traveller dismisses the "pass extended" notice (only their own row, only this column)
CREATE FUNCTION public.ack_entitlement_extension(_id uuid) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE booking_entitlements SET extension_seen_at = now()
   WHERE id = _id AND user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.ack_entitlement_extension(uuid) TO authenticated;
-- booking_entitlement_state() also returns extended_at, extension_seen_at, rc_transaction_ids.

-- 2. Dead-letter table for store events we couldn't apply
CREATE TABLE public.revenuecat_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text NOT NULL,              -- unknown_user | malformed_user | unsupported_store
  event_type text,
  app_user_id text,
  transaction_id text,
  raw_event jsonb NOT NULL,          -- full request body, verbatim
  received_at timestamptz NOT NULL DEFAULT now(),
  replayed_at timestamptz,
  replay_result text
);
GRANT ALL ON public.revenuecat_dead_letters TO service_role;
ALTER TABLE public.revenuecat_dead_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ops can read dead letters" ON public.revenuecat_dead_letters
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'concierge_assistant'));
GRANT SELECT ON public.revenuecat_dead_letters TO authenticated;
```

## Handler changes (revenuecat-webhook)
1. **Idempotency first.** The purchase-log insert into `trip_passes` (which is already unique on the transaction id) acts as the lock. If it's a duplicate, return "already processed" before any allowance is touched. It is still a log only; nothing gates on it.
2. **Overlapping purchase extends the allowance.** When an unexpired allowance exists:
   - `max_bookings` goes up by 5.
   - `valid_until` becomes the later of the current end date and the departure date capped at 60 days from this purchase. With no usable departure date, it's purchase + 60 days.
   - The new transaction id is appended to `rc_transaction_ids` and `extended_at` is set to now.
   - This also applies when the existing allowance came from a card hold.

   Ops gets an alert marked "for visibility, no action needed". No purchase is left unactivated.
3. **Refunds on an extended allowance.** Releasing the whole allowance would take back bookings that were bought separately. Instead, a refund whose transaction is one of several on the row takes off 5 bookings (never below the number already confirmed) and removes that id. The allowance is released only when its last transaction is refunded. Ops is alerted either way.
4. **Dead letter.** For an unknown or malformed app user id, or an unsupported store, the full raw event is written to `revenuecat_dead_letters` before returning 200 and alerting ops. If that write itself fails, return 500 so RevenueCat retries and nothing is lost.

## In-app notice
When the active allowance has `extended_at` and no `extension_seen_at`, a small notice appears on Home and on the booking screen: "Your Trip Pass was extended, not replaced — 5 more bookings added, now valid until {date}." Dismissing it calls `ack_entitlement_extension`.

## Replay
There's no replay button yet. Once the cause is fixed, I can re-post dead-lettered events to the handler on request and mark them replayed.

## Verification
Sample events for: a first purchase, an overlapping purchase (confirm 10 bookings, the later end date, both ids), a duplicate, a refund of one of two transactions, and an unknown user (confirm a dead-letter row with the raw event). The test rows are removed afterwards.
