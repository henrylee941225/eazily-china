// Client-side expiry classification for concierge tasks.
//
// The implementation now lives in supabase/functions/_shared/bookingExpiry.ts so
// edge functions and the frontend share one file. This module re-exports it to
// keep the existing "@/lib/bookingExpiry" import path working unchanged.

export {
  isExpiredUnpaidTransfer,
  isNotConfirmedInTimeTransfer,
  isTransferPastPickupStale,
  type ExpiryInput,
} from "../../supabase/functions/_shared/bookingExpiry.ts";
