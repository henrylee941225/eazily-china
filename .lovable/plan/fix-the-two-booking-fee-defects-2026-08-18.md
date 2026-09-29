# Fix the two booking-fee defects

## 1. Duplicate authorisation race

**Rule:** a user may never have more than one open £9.99 authorisation, and never more than one unauthorised fee request.

**Approach:** do not mint a second fee task, and do not silently merge two different bookings into one request. Instead, when a booking request needs the fee and the user already has a fee task awaiting authorisation, `concierge-create-task` returns that existing task instead of creating anything, with a marker (`fee_authorisation_pending`, plus the existing task id and its Stripe session state). The client reopens the payment dialog for that task. Once it is authorised, the entitlement exists and the next request is created free, as today.

Detection: existing task where `user_id = caller`, `category = restaurant_reservation`, `status = pay_to_confirm`, `authorized_at IS NULL`, `paid_at IS NULL`, not cancelled.

**Concurrent case** (two requests in flight at once, both passing the check): guarded in the database, not the application.
- Partial unique index on `concierge_tasks (user_id)` where the row is an unauthorised restaurant fee task — makes a second insert fail rather than succeed.
- Partial unique index on `booking_entitlements (user_id)` where `status = 'authorised'` — makes a second live hold impossible even if two webhooks race.
- On unique violation the function re-reads the existing fee task and returns the same `fee_authorisation_pending` response, so the loser of the race behaves identically to the sequential case. No 500 surfaced.

Both indexes are new migrations. No transfer rows can match either predicate.

## 2. Confirm-time cap

Add a check in `concierge-update-task` on the confirm transition for restaurant tasks carrying an `entitlement_id`: recount that entitlement's tasks in `confirmed`/`completed` (excluding the task being confirmed) and if the count already equals `max_bookings`, reject with HTTP 409 and code `booking_cap_reached`. The task stays as it was, no capture is attempted, no message is written.

## Copy for your approval (nothing is written until you confirm)

**Ops sees** (error toast in the dispatch console, on the blocked confirm):
> Booking cap reached — this traveller's £9.99 fee covers 5 confirmed bookings and all 5 are used. Ask them to submit a new request so a new fee is authorised.

**Traveller sees** nothing for the blocked confirm — no system message, no notification, because the block is an ops-side condition and the request is left untouched.

**Traveller sees** for the duplicate-authorisation case, on the payment dialog reopened for the existing request:
> Finish authorising this request first. One £9.99 authorisation covers your next five confirmed bookings.

Tell me if you want either reworded, or if you want the traveller informed when a confirm is blocked.

## Untouched

Transfer authorise/capture/refund, the 24-hour cancellation guard, `expire_unpaid_transfers()`, the seven free AI functions, `has_ai_access()`, the venue datasets, pricing and paywall copy.

## Known residual

The request-time cap check stays where it is; the confirm-time check above is what makes it watertight. The two-holds hole in the webhook path is closed by the entitlement index rather than by rewriting the webhook.
