// Central feature flags. Keep as compile-time constants — read them
// through this module so every entry point stays in sync.

// Social sign-in (Google / Apple). When false, the OAuth buttons and the
// "or" divider are hidden everywhere, so email is the single visible path.
// Provider config, the OAuth callback handling and handleOAuth code stay
// intact — flip this to true to bring the buttons back.
export const SOCIAL_AUTH_ENABLED = false;

// Private transfers (Airport / Hourly / Station). When false:
//  - Home hides the "Ride" quick tile and the "Airport transfer" card
//  - /transfers and /transfers/:service redirect to Home
//  - Concierge and place-sheet ride actions still route to /transfers
//    (which then redirects to Home), so no dead links remain.
export const TRANSFERS_ENABLED = true;

// Push notifications. Email-only for now: the notification backbone keeps the
// 'push' channel and notification_preferences.push_enabled intact, but nothing
// is sent and the settings toggle stays hidden until this is switched on
// (client) alongside PUSH_ENABLED=true on the dispatcher edge function.
export const PUSH_ENABLED = import.meta.env.VITE_PUSH_ENABLED === "true";
