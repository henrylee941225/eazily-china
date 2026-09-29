# Booking fee replaces the Trip Pass

## Part 1 — Report (answers to your questions)

### a) How `concierge-create-task` gates today
- `supabase/functions/concierge-create-task/index.ts` runs `requireAuth`, then for `category === "restaurant_reservation"` only it does two things in parallel:
  - `admin.rpc("has_ai_access", { user_uuid })` — reads `profiles.trip_pass_active_until` (+48h grace) in the SQL function.
  - a `count` of that user's `concierge_tasks` where `category = restaurant_reservation` and `status NOT IN (cancelled, unavailable)`.
- The "first booking free" rule *is* that count: if the count is 0 the request passes; otherwise, with no pass, it returns HTTP 200 + `X-Pass-Required: 1` and `code: pass_required`, which the client turns into the paywall (`src/lib/passRequired.ts`, `RestaurantBooking.tsx`).
- No other category is gated. Transfers are priced and go straight to `pay_to_confirm`.

### b) The transfer authorise/capture flow (to be reused, not duplicated)
- **Price + FX lock**: `concierge-create-task` computes GBP from the rate card, calls `lockCharge` (`_shared/fx-lock.ts`), writes `price_cents`, `currency`, `charge_amount_cents`, `charge_currency`, `fx_rate_used`, `quoted_gbp_cents`, and sets `status = pay_to_confirm`.
- **Authorise**: `create-task-checkout` creates a Stripe Checkout Session in the task's locked currency. `capture_method = "manual"` when pickup is within 6 days (auth holds lapse at ~7 days), otherwise `automatic`. It stores `stripe_session_id`, `capture_method`, `stripe_env`.
- **Authorisation recorded**: `payments-webhook` treats `checkout.session.completed` with `payment_status = unpaid` + `capture_method = manual` (and `payment_intent.amount_capturable_updated` as a second, idempotent signal) as authorisation and sets `authorized_at` + `stripe_payment_intent_id`.
- **Capture**: `concierge-update-task`, when ops sets `confirmed` and the task is `capture_method = manual`, `authorized_at` set, `paid_at` null — captures the PaymentIntent *before* committing the status. On capture failure it clears `authorized_at`/PI/session, posts a system message asking the traveller to re-authorise, and returns 502.
- **Release**: on `unavailable`/`cancelled` with an uncaptured hold it cancels the PaymentIntent (`reason: abandoned`) and stamps `hold_released_at`; already-expired/cancelled PIs are tolerated; a PI found `succeeded` fires an ops alert and returns 502 rather than closing the task.
- **24-hour cancellation**: `src/lib/transferCancellation.ts` on the client + a 409 `cancellation_window_closed` guard in `concierge-update-task`, keyed on `details_json.pickup_at`. Unpaid transfers also auto-expire via the hourly `expire_unpaid_transfers()` cron.

**Reuse verdict**: `create-task-checkout`, the webhook's authorisation branch, and the capture/release blocks in `concierge-update-task` are all task-generic already — they key off `capture_method`/`authorized_at`, not off `category = transfer`. The booking fee can ride on exactly this machinery with no fork. Transfer-specific bits (pickup-window capture choice, 24h rule, expiry cron) stay scoped to transfers.

### c) Schema changes needed
One new table plus one nullable link column:

- `public.booking_entitlements`
  - `user_id`, `fee_task_id` (the task whose authorisation carries the fee), `stripe_payment_intent_id`,
  - `status`: `authorised` | `captured` | `released`,
  - `authorised_at`, `captured_at`, `released_at`,
  - `confirmed_count` (int, default 0), `max_bookings` (int, default 5),
  - `valid_from`, `valid_until` (from `profiles.arrival_date`/`departure_date`, 60-day cap, same rule the pass used),
  - timestamps + `updated_at` trigger. GRANT `select` to `authenticated` (own rows only via RLS), `all` to `service_role`; no client writes.
- `concierge_tasks.entitlement_id uuid null` — which entitlement a restaurant booking counts against, so `confirmed_count` increments are idempotent (count distinct tasks rather than trusting a counter bump).
- A security-definer function `booking_entitlement_state(uuid)` returning the active row for the client to render, and `has_booking_allowance(uuid)` for the server gate.
- `has_ai_access()` is **not** changed (AI is free and nothing calls it for AI any more); the restaurant gate stops using it.

Behaviour it encodes: entitlement is live from `authorised`, covers 5 *confirmed* bookings within trip validity; capture happens on the first confirm; release (no confirm ever) marks `released` so the next request authorises fresh; the 6th confirmed booking requires a new authorisation.

### d) The "E1 payment regression"
I can't find an `E1` label anywhere in the codebase or in this project's chat history, so I won't guess at it. The closest known defect on this path is the **capture-failure rollback** in `concierge-update-task` (capture fails → auth cleared → traveller asked to re-authorise → ops sees 502) and its sibling, the **already-captured-on-cancel** 502. Both *do* affect the booking fee, because the fee reuses the same capture and release calls. Tell me what E1 refers to (or paste the note) and I'll assess it precisely before building.

## Part 2 — Implementation plan (on your go-ahead)

1. **Migration** — create `booking_entitlements`, add `concierge_tasks.entitlement_id`, add the two SQL helpers, RLS + GRANTs, `updated_at` trigger.
2. **`concierge-create-task`** — replace the `has_ai_access` + first-free branch for `restaurant_reservation` with:
   - active entitlement (`authorised`/`captured`, in validity, `confirmed_count < max_bookings`) → create the task as today, stamp `entitlement_id`, status `pending`.
   - otherwise → price the fee (£9.99 via `lockCharge` into the user's preferred currency), create the task in `pay_to_confirm` with `capture_method` intent `manual`, and create the entitlement row on authorisation.
   - Ops alert is deferred until authorisation, matching the transfer rule that an unpaid request is not an ops job.
3. **`create-task-checkout`** — force `capture_method = "manual"` for `restaurant_reservation` (no pickup date to reason about). No other change.
4. **`payments-webhook`** — on the existing authorisation branch, when the task is a restaurant fee task, insert/activate the `booking_entitlements` row (`status = authorised`) idempotently, then flip the task to `pending` so ops picks it up and fire the ops alert. No transfer behaviour touched.
5. **`concierge-update-task`** — on `confirmed` for a restaurant booking: increment/derive `confirmed_count`, and if the entitlement is still `authorised`, let the existing manual-capture block capture the fee task's PI and mark the entitlement `captured`. On `unavailable`/`cancelled` of the fee task with nothing ever confirmed, the existing release block runs and the entitlement becomes `released`.
6. **Client** — `useEntitlement` becomes booking-allowance aware (`authorised`/`captured`, bookings used/remaining); `RestaurantBooking.tsx` keeps its existing pay-to-authorise dialog path (`TaskPaymentDialog`) instead of the paywall for the fee case; the queue-immediately behaviour follows from entitlement being live at authorisation.
7. **Verification** — typecheck, then a Stripe sandbox pass: authorise → queue a second booking → ops confirms → capture; and authorise → cancel → hold released, next request re-authorises.

**Untouched**: transfer pricing/payment/cancellation, the seven free AI functions, venue datasets, Pricing/paywall/App Store copy, `has_ai_access()`.
