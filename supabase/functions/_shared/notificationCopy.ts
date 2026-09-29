// Shared notification copy for customer-facing transfer updates.
// Importable by edge functions and the frontend — one vocabulary everywhere.
// Wording deliberately matches the chip/banner copy in paymentPhase.ts
// ("Payment authorised", "Payment received", "Paid & booked") so email, push
// and in-app never disagree.

import { derivePaymentPhase, type PaymentPhase, type PhaseInput } from "./paymentPhase.ts";

export type NotificationEventKey =
  | "payment_authorised"
  | "payment_received"
  | "driver_confirmed"
  | "change_confirmed"
  | "booking_unavailable"
  | "payment_failed"
  | "booking_cancelled"
  | "pickup_reminder_24h"
  | "pickup_reminder_2h"
  | "hold_expiring_soon";

export type NotificationCopy = {
  emailSubject: string;
  emailHeading: string;
  emailBody: string;
  pushTitle: string;
  pushBody: string;
  ctaLabel: string;
  ctaPath: string;
};

/**
 * Map a task's derived payment phase to an event key. Phases with no customer
 * notification return null.
 */
export const eventKeyForPhase = (
  phase: PaymentPhase | null,
  opts: { fromStatus?: string | null } = {},
): NotificationEventKey | null => {
  switch (phase) {
    case "authorised":
      return "payment_authorised";
    case "prepaid":
      return "payment_received";
    case "confirmed":
      return opts.fromStatus === "change_pending" ? "change_confirmed" : "driver_confirmed";
    case "unavailable":
      return "booking_unavailable";
    case "cancelled":
    case "expired":
      return "booking_cancelled";
    default:
      // awaiting_payment / change_pending / null -> nothing to tell the traveller yet
      return null;
  }
};

/** Convenience: derive the event key straight from a task row. */
export const eventKeyForTask = (
  task: PhaseInput,
  opts: { fromStatus?: string | null } = {},
): NotificationEventKey | null => eventKeyForPhase(derivePaymentPhase(task), opts);

const bookingsPath = (taskId?: string | null) =>
  taskId ? `/bookings/${taskId}` : "/bookings";

export const notificationCopy = (
  eventKey: NotificationEventKey,
  ctx: { taskId?: string | null } = {},
): NotificationCopy => {
  const path = bookingsPath(ctx.taskId);
  const map: Record<NotificationEventKey, NotificationCopy> = {
    payment_authorised: {
      emailSubject: "Payment authorised — confirming your driver",
      emailHeading: "Payment authorised",
      emailBody:
        "Your card is on hold, not charged. You'll only be charged once your driver is confirmed.",
      pushTitle: "Payment authorised",
      pushBody: "We're confirming your driver. Your card is on hold, not charged.",
      ctaLabel: "View booking",
      ctaPath: path,
    },
    payment_received: {
      emailSubject: "Payment received — confirming your driver",
      emailHeading: "Payment received",
      emailBody:
        "Charged now because your trip is further out. Refunded in full if we can't confirm a car.",
      pushTitle: "Payment received",
      pushBody: "We're confirming your driver. Refunded in full if we can't confirm a car.",
      ctaLabel: "View booking",
      ctaPath: path,
    },
    driver_confirmed: {
      emailSubject: "Paid & booked — your car is confirmed",
      emailHeading: "Paid & booked",
      emailBody: "Driver details will arrive in the chat before your pickup.",
      pushTitle: "Paid & booked",
      pushBody: "Your car is confirmed. Driver details arrive before pickup.",
      ctaLabel: "View booking",
      ctaPath: path,
    },
    change_confirmed: {
      emailSubject: "Your change is confirmed",
      emailHeading: "Change confirmed",
      emailBody: "Your updated pickup is booked. Driver details will arrive in the chat.",
      pushTitle: "Change confirmed",
      pushBody: "Your updated pickup is booked.",
      ctaLabel: "View booking",
      ctaPath: path,
    },
    booking_unavailable: {
      emailSubject: "We couldn't arrange a car",
      emailHeading: "We couldn't arrange a car",
      emailBody: "No cars are free for this pickup. You haven't been charged.",
      pushTitle: "We couldn't arrange a car",
      pushBody: "No cars are free for this pickup. You haven't been charged.",
      ctaLabel: "Message the concierge",
      ctaPath: path,
    },
    payment_failed: {
      emailSubject: "Your payment didn't go through",
      emailHeading: "Payment didn't go through",
      emailBody:
        "We couldn't take payment for this transfer, so it isn't requested yet. Try again to request your driver.",
      pushTitle: "Payment didn't go through",
      pushBody: "Your transfer isn't requested yet. Try again to request your driver.",
      ctaLabel: "Complete payment",
      ctaPath: path,
    },
    booking_cancelled: {
      emailSubject: "Your transfer is cancelled",
      emailHeading: "Cancelled",
      emailBody: "This request was cancelled. Nothing further needed.",
      pushTitle: "Transfer cancelled",
      pushBody: "This request was cancelled. Nothing further needed.",
      ctaLabel: "View bookings",
      ctaPath: "/bookings",
    },
    // Sent at authorized_at + 5 days, and only while ops still haven't
    // confirmed a driver. The hold is released by us 36 hours later.
    hold_expiring_soon: {
      emailSubject: "Still working on your driver — your card hold expires soon",
      emailHeading: "Still working on your driver",
      emailBody:
        "We're still working on your driver — your card hold is due to expire soon and nothing has been charged. We'll let you know either way within 36 hours.",
      pushTitle: "Still working on your driver",
      pushBody:
        "Your card hold expires soon and nothing has been charged. We'll let you know either way within 36 hours.",
      ctaLabel: "Message the concierge",
      ctaPath: path,
    },
    pickup_reminder_24h: {
      emailSubject: "Your car is tomorrow",
      emailHeading: "Your car is tomorrow",
      emailBody: "Your pickup is in 24 hours. Driver details will arrive in the chat before you go.",
      pushTitle: "Your car is tomorrow",
      pushBody: "Your pickup is in 24 hours.",
      ctaLabel: "View booking",
      ctaPath: path,
    },
    // Fired at T-3h, not T-2h: email is slower and easier to miss than push,
    // so the reminder gets an extra hour to land and be seen. The email itself
    // is rendered self-contained by pickupReminderEmail.ts — this copy backs
    // the in-app and (parked) push channels.
    pickup_reminder_2h: {
      emailSubject: "Your car is in about 3 hours",
      emailHeading: "Your car is in about 3 hours",
      emailBody: "Your driver will meet you at the pickup point. Details are in the booking.",
      pushTitle: "Your car is in about 3 hours",
      pushBody: "Your driver will meet you at the pickup point.",
      ctaLabel: "View booking",
      ctaPath: path,
    },
  };
  return map[eventKey];
};
