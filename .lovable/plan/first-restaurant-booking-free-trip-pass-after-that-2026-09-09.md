# First restaurant booking free, Trip Pass after that

## What changes for the customer

1. **First ever restaurant request is free.** No card, no price, no mention of money anywhere in that flow. The request goes straight to our team like any other.
2. The free booking is used up **when they send the request**, not when we confirm a table — so nobody can send request after request for free.
3. **If we let them down** — we can't get the table, or we cancel it — their free booking comes back. If *they* cancel, it does not.
4. **When that first table is confirmed**, and only then, we pitch the pass: in the booking conversation, on the booking screen, and in the confirmation email:
   "That's your first booking, on us. Trip Pass gives you five more for the rest of your trip — £9.99, and you're only charged when we get you a table."
5. **Second request onwards, no pass:** a Trip Pass screen appears before the booking form, opening with "Your first booking was on us. To keep going, activate your Trip Pass." Continuing leads to the normal form and the existing card-authorisation step (charged only when a table is confirmed).
6. **Our team sees a "FIRST — FREE" marker** on those requests in the ops queue, so they know this customer hasn't paid and it's their first impression of us.
7. **/pricing** reads: "Your first restaurant booking is free. After that, Trip Pass covers five bookings for your trip — £9.99, charged only when we confirm a table."

Free is **once per person, for good** — an expired pass never earns a second free booking.

## Technical detail

**Database**
- Add `profiles.free_booking_used_at timestamptz null` and `profiles.free_booking_task_id uuid null` (which request consumed it, so restore is exact and idempotent).
- Backfill: leave null for everyone. Existing users with a `booking_entitlements` row have already paid; stamping them would be wrong either way, and one free booking for a tiny live user base is the safer error.

**`concierge-create-task` (restaurant only)** — new decision order:
1. Active entitlement (`booking_entitlement_state`) → task `pending`, stamp `entitlement_id`, ops alert as today.
2. Else `free_booking_used_at IS NULL` → stamp `free_booking_used_at = now()` + `free_booking_task_id` with a conditional update (`is null` guard) so two concurrent submits can't both win; create the task `pending`, `price_cents = 0`, no FX lock, no `pay_to_confirm`; system message with no money in it; ops alert flagged first-free.
3. Else → today's £9.99 fee path unchanged (FX lock, `pay_to_confirm`, authorise, capture on first confirm).

**`concierge-update-task`** — when a restaurant task moves to `unavailable`, or to `cancelled` by ops/assistant (not by the owner), and that task id equals the user's `free_booking_task_id`, clear both profile fields. Owner-initiated cancels take the existing path untouched. Capture/release logic for fee tasks is unchanged.

**Confirmation pitch** — on the first confirm of a free-booking task with no active entitlement:
- insert a system message in the thread carrying the pitch copy;
- `BookingDetail.tsx` renders a pass card on that booking when the same condition holds;
- add a `trip_pass_offer` block to the restaurant confirmation email template.

**Client**
- `useEntitlement` (or a small `useBookingAllowance`) returns `{ hasEntitlement, freeBookingAvailable }` from profile + `booking_entitlement_state`.
- New `TripPassIntro` step at the head of `RestaurantBooking.tsx`, shown only when the free booking is spent and no entitlement is active. It explains the pass and continues into the existing form; payment still happens through the current `TaskPaymentDialog` after submit, because the authorisation needs a task to attach to.
- The free path shows no price, no fee dialog: submit → "Request sent — our team will confirm your table." → booking screen.

**Ops** — `OpsDispatch.tsx` shows a "FIRST — FREE" chip on restaurant tasks whose id matches the requester's `free_booking_task_id` (read through the existing ops-visible query), and `ops-alert` adds a "First booking (free)" line for those requests.

**Untouched**: transfer pricing/payment/cancellation, AI features (free), venue data, Stripe integration, entitlement capture/release machinery.
