# Trip Pass as the front door to restaurants

## Who is affected (counted today, 16 accounts)
- **13** have not used their free booking and have no pass: they keep one free booking (grandfathered).
- **3** have already used their free booking: they need a pass from now on.
- **0** have an active pass right now, so nothing changes for anyone with one.

New accounts created after this ships get no free booking.

## What changes
1. **One gate for restaurants.** Anyone without an active pass who is not grandfathered sees the Trip Pass screen instead of:
   - the restaurant directory (list, search, filters, venue detail)
   - bars and nightlife inside Eat & drink
   - the booking form, "Help me choose" and its preferences
   The server checks access. The app's own memory is never used.
2. **Stays free and open:** Translate, Maps, the written guides (articles and topic pages), concierge chat, Plan my day and transfers. Transfer pricing and payment are not touched.
3. **Free first booking turned off, not deleted.** A server switch (`FREE_FIRST_BOOKING_MODE`) decides who gets one: only people who signed up before the cut-over and haven't used it. The column and its data stay, so the old behaviour can come back by changing the switch.
4. **The pass screen does the selling:**
   - what we do: we phone the restaurant in Chinese, book in your name, and send you the address in Chinese characters for your taxi driver
   - why it matters: most Shanghai restaurants won't take a booking from a foreign phone number
   - what's included: 5 restaurant bookings for your trip
   - the existing price, store purchase, restore and failure handling stay as they are
5. **Preview behind the paywall:** the venue count, then a strip of real venue photos with English and Chinese names, all locked. Tapping one doesn't open it; it points you back to the pass.
6. **Deep links:** a link to a specific venue from outside the app opens the pass screen with that venue named ("Unlock bookings at 鼎泰丰 Din Tai Fung"). Once someone buys, they go straight to that venue.

## Entry points to gate (all will be checked)
- Home: "Restaurants" quick link and the restaurant booking shortcut
- Concierge launcher: "Book a restaurant"
- Concierge chat: "Reserve" on a suggested venue, and venue search
- Guides › Eat & drink topic: Restaurants, Bars and Nightlife tiles
- Directory pages `/guides/eat-and-drink/directory` and `/nightlife`, including their "Book" buttons
- `/bars` and `/bars/:slug` redirects
- `/book/restaurant` (all modes, including resume after payment)
- Booking detail: "Book another"
- Today's picks and Recommended cards that open a restaurant
- Place guides that link into the directory

## Questions to confirm
- Plan my day suggests cafés and lunch spots. I plan to leave it open, as the request lists it under neither group. Say if it should be gated too.
- Should grandfathered users (the 13) see the directory, or only get their free booking? The plan lets them in until they use it.

## Technical details
- New `restaurant_access_state(user_uuid)` security-definer RPC that returns `{ has_pass, remaining, valid_until, free_booking_available }`. It reuses `booking_entitlement_state`. Free booking only if `free_booking_used_at IS NULL AND profile.created_at < cutover`.
- Migration: create the RPC and add a `app_settings`-style constant for the cut-over timestamp (or hard-code it in the function). No column is dropped.
- `concierge-create-task`: apply the same free-booking rule on the server, so the gate can't be bypassed.
- Client: `useRestaurantAccess` hook plus a `<RestaurantGate venueSlug?>` wrapper on the routes above. The Trip Pass page reads `?venue=<slug>` through `resolveVenueBySlug`, then continues to `/book/restaurant?...` after a successful purchase.
- Venue data files stay read-only.
