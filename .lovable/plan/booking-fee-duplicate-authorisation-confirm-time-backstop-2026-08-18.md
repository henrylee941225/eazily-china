# Booking fee: duplicate authorisation + confirm-time backstop

## Current state (already in place)
- **Reuse of a pending fee task** exists in `concierge-create-task`: when a fee is needed, it looks for an existing restaurant task in `pay_to_confirm` with no authorisation and no payment, and returns it with `fee_authorisation_pending: true`.
- **Concurrent case** is handled by a partial unique index; on a `23505` insert conflict the function re-reads the winning task and returns the same `fee_authorisation_pending` response.
- **Confirm-time cap** exists in `concierge-update-task`, but it is currently framed as a real cap with traveller-facing wording about authorising a new fee.

## What I will change
1. **Duplicate-authorisation guard — verify only, no code change**
   - Verified: both partial unique indexes are live (`concierge_tasks_one_open_restaurant_fee`, `booking_entitlements_one_authorised`), so a second concurrent hold cannot be created. No migration needed.
   - Keep the reuse response shape unchanged so the client reopens the existing payment dialog rather than creating a new hold.

2. **Reframe the confirm-time check as a backstop**
   - Keep the check where it is: before any Stripe capture, when ops moves a restaurant task to `confirmed`.
   - Compare confirmed/completed siblings on the same entitlement against that entitlement's own `max_bookings` (no hardcoded 5 in the message).
   - Block with `409` and code `booking_cap_reached`.
   - Ops message (plain, names the reason, no instructions to the traveller):
     "Blocked: this booking's fee entitlement has no allowance left (all N confirmed bookings used). This shouldn't happen — flag for investigation."
   - **No traveller-facing message** is written to the task thread on this path, and no status change or capture occurs.
   - Log a `console.error` with task id, entitlement id, and counts so the failure is traceable.

3. **Leave the request-time behaviour untouched**
   - Booking 6 still creates a fresh `pay_to_confirm` task with a new authorisation at request time. That remains the intended customer experience.

## Not touched
Transfer path, the seven free AI functions, `has_ai_access()`, venue datasets, pricing and paywall copy.
