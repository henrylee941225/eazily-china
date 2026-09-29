# Make booking_entitlements the only thing that controls restaurant booking access

## What happens today with a null valid_until
`booking_entitlement_state` treats a null `valid_until` as never expiring (`valid_until IS NULL OR valid_until >= today`). The allowance lasts until all 5 bookings are used. There is no time limit.

## Database change (needs approval)
```sql
ALTER TABLE public.booking_entitlements
  ALTER COLUMN fee_task_id DROP NOT NULL,             -- app-store purchases have no fee task
  ADD COLUMN source text NOT NULL DEFAULT 'stripe'
    CHECK (source IN ('stripe','apple','google')),
  ADD COLUMN rc_transaction_id text,
  ADD COLUMN trip_dates_defaulted boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX booking_entitlements_rc_tx
  ON public.booking_entitlements (rc_transaction_id) WHERE rc_transaction_id IS NOT NULL;
ALTER TABLE public.booking_entitlements
  ADD CONSTRAINT booking_entitlements_origin CHECK (
    (source = 'stripe' AND fee_task_id IS NOT NULL) OR
    (source IN ('apple','google') AND rc_transaction_id IS NOT NULL));
-- Backfill: the 2 existing rows keep source 'stripe'; any null valid_until becomes valid_from (or created_at) + 60 days.
```
After this, a null `valid_until` can only exist on old rows. The backfill removes those, and every code path always writes a date.

## Code changes
1. **revenuecat-webhook, purchase events.** Map `ev.store`: APP_STORE becomes `apple` and PLAY_STORE becomes `google`. Anything else is rejected and ops is alerted. Insert a `booking_entitlements` row with:
   - status `captured`, because the store has already charged the customer
   - `max_bookings: 5`
   - `valid_from` = the purchase date
   - `valid_until` = the departure date, capped at purchase + 60 days; with no departure date, purchase + 60 days and `trip_dates_defaulted = true`
   - `rc_transaction_id` = the transaction id

   The `trip_passes` row is still written as a purchase log.
2. **Idempotency.** A duplicate `rc_transaction_id` (checked first, then enforced by the unique index) returns 200 "already processed".
3. **Overlapping purchase.** The server can't block a purchase inside the store sheet, so there are two guards:
   - The app stops offering the purchase whenever `booking_entitlement_state` returns a row.
   - If the webhook still receives a purchase while an unexpired entitlement exists, it records the entitlement as `released` with a reason and alerts ops as "overlapping pass — refund via App Store/Play". Customers never end up holding two active passes.
4. **Refunds, cancellations and expiries.** Release the matching `booking_entitlements` row (status `released`, `released_at`) as well as the `trip_passes` row. Confirmed restaurant bookings are left alone. Ops gets an alert with the user, the event and the number of bookings already confirmed.
5. **Unknown app_user_id.** Before writing anything, check that the auth user exists. If the id isn't a UUID or no user matches, log it, alert ops ("RevenueCat purchase for unknown user — would be lost") and return 200 so RevenueCat doesn't retry endlessly. The alert is the safeguard.
6. **Stripe path (payments-webhook).** Set `max_bookings: 5` and `source: 'stripe'` explicitly. With no trip dates, set `valid_from` to today, `valid_until` to today + 60 days, and `trip_dates_defaulted = true`. The existing 60-day cap stays.
7. **Asking for trip dates.** When the active entitlement has `trip_dates_defaulted`:
   - The booking screen and the Trip Pass row on /account show a warm callout: "Add your trip dates so your bookings cover the right days."
   - The callout links to /account/trip-dates.
   - Saving dates realigns `valid_until` (departure date, capped at `valid_from` + 60) and clears the flag, through a small change to the TripDates save path. That change is the one exception to "presentation only" here.
8. **Comments only.** Mark `trip_passes`, `profiles.trip_pass_active_until`, `useEntitlement.ts` and `create-pass-checkout` as "purchase log only — nothing may gate on this". `useEntitlement.ts` is not referenced by any gate today. I'll confirm that and report back.

## Not changing
Transfers, how Stripe is captured, the free first booking, the 5-booking cap check in concierge-update-task, and the RevenueCat client setup.

## Verification
Deploy both functions. Send test webhook calls for: purchase, duplicate purchase, overlapping purchase, no trip dates, refund with confirmed bookings, and unknown user. Check the resulting rows and ops alerts with read-only queries.
