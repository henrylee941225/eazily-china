// Self-contained pickup reminder emails.
//
// Assume the traveller CANNOT open the app link: they may be on a mainland
// network with a blocked provider, or on no data at all. Everything they need
// — pickup time in trip local time with the timezone named, driver, vehicle,
// plate, phone numbers, meeting point and booking reference — lives in the
// body, and the most critical bits (time, meeting point, plate) live in the
// subject line, because many travellers will only ever see the notification
// preview.
//
// Addresses are shown in English and, when stored on the booking, in Chinese
// on the line directly beneath at the same size: the traveller will hold the
// phone up to a driver or hotel clerk who cannot read the English.

export type ReminderKind = "pickup_reminder_24h" | "pickup_reminder_2h";

export type ReminderPayload = {
  pickup_at?: string | null;
  timezone?: string | null;
  pickup_location?: string | null;
  pickup_location_zh?: string | null;
  dropoff_location?: string | null;
  dropoff_location_zh?: string | null;
  meeting_point?: string | null;
  meeting_point_zh?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle?: string | null;
  plate?: string | null;
  flight_number?: string | null;
  booking_reference?: string | null;
  city?: string | null;
  task_id?: string | null;
};

const SITE_NAME = "eazilyChina";
const APP_BASE_URL = "https://app.eazilychina.com";

/** 24/7 support line, configurable so it can change without a redeploy. */
export const supportPhone = (): string | null => {
  try {
    const v = Deno.env.get("SUPPORT_PHONE");
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
};

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Strip everything a dialler can't use, keeping a leading +. */
const telHref = (phone: string) => {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return `tel:${plus}${trimmed.replace(/[^0-9]/g, "")}`;
};

const tzOf = (p: ReminderPayload) => p.timezone || "Asia/Shanghai";

/** Short timezone name in trip local terms, e.g. "China Standard Time". */
export const timeZoneLabel = (iso: string, timeZone: string): string => {
  const d = new Date(iso);
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      timeZoneName: "long",
    }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
};

const fmt = (iso: string, timeZone: string, opts: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone, ...opts }).format(new Date(iso));
  } catch {
    return iso;
  }
};

/** "14:30" in trip local time. */
export const localTime = (iso: string, timeZone: string) =>
  fmt(iso, timeZone, { hour: "2-digit", minute: "2-digit", hour12: false });

/** "Tue 1 Sep" in trip local time. */
export const localDate = (iso: string, timeZone: string) =>
  fmt(iso, timeZone, { weekday: "short", day: "numeric", month: "short" });

const dash = (v?: string | null) => (v && String(v).trim() ? String(v).trim() : null);

/**
 * Subject line. Both reminders carry the meeting point; the T-3h one also
 * carries the plate so the notification preview alone is actionable.
 */
export const reminderSubject = (kind: ReminderKind, p: ReminderPayload): string => {
  const iso = p.pickup_at;
  const tz = tzOf(p);
  const time = iso ? localTime(iso, tz) : null;
  const meeting = dash(p.meeting_point) ?? dash(p.pickup_location);
  const plate = dash(p.plate);

  if (kind === "pickup_reminder_2h") {
    const bits = [meeting, plate ? `plate ${plate}` : null].filter(Boolean).join(", ");
    const head = time ? `Your car at ${time}` : "Your car today";
    return bits ? `${head} — ${bits}` : head;
  }

  const head = time ? `Your car tomorrow at ${time}` : "Your car is tomorrow";
  return meeting ? `${head} — ${meeting}` : head;
};

type Line = {
  label: string;
  /** Plain-text value (English first line, Chinese on a second line). */
  value: string;
  /** Optional HTML override, e.g. tel: links or bilingual line breaks. */
  html?: string;
};

/** English value plus, when present, the Chinese equivalent underneath. */
const bilingual = (label: string, en: string, zh?: string | null): Line => {
  const cn = dash(zh);
  return {
    label,
    value: cn ? `${en}\n${cn}` : en,
    html: cn ? `${esc(en)}<br>${esc(cn)}` : undefined,
  };
};

const phoneLine = (label: string, phone: string): Line => ({
  label,
  value: phone,
  html: `<a href="${esc(telHref(phone))}" style="color:#0A0A0B;text-decoration:underline;">${esc(phone)}</a>`,
});

const detailLines = (p: ReminderPayload): Line[] => {
  const tz = tzOf(p);
  const lines: Line[] = [];
  if (p.pickup_at) {
    lines.push({
      label: "Pickup",
      value: `${localDate(p.pickup_at, tz)}, ${localTime(p.pickup_at, tz)} ${timeZoneLabel(p.pickup_at, tz)}`,
    });
  }
  const meeting = dash(p.meeting_point);
  if (meeting) lines.push(bilingual("Meeting point", meeting, p.meeting_point_zh));
  const pickup = dash(p.pickup_location);
  if (pickup) lines.push(bilingual("Pickup address", pickup, p.pickup_location_zh));
  const dropoff = dash(p.dropoff_location);
  if (dropoff && dropoff !== pickup) {
    lines.push(bilingual("Drop-off", dropoff, p.dropoff_location_zh));
  }
  const flight = dash(p.flight_number);
  if (flight) lines.push({ label: "Flight", value: flight });
  const driver = dash(p.driver_name);
  if (driver) lines.push({ label: "Driver", value: driver });
  const vehicle = dash(p.vehicle);
  if (vehicle) lines.push({ label: "Vehicle", value: vehicle });
  const plate = dash(p.plate);
  if (plate) lines.push({ label: "Plate", value: plate });

  // Contacts sit directly below the driver details and above the reference:
  // whoever is reading this is often standing at the pickup point with a
  // problem, so the numbers must be the easiest thing to reach.
  const driverPhone = dash(p.driver_phone);
  if (driverPhone) lines.push(phoneLine("Driver phone", driverPhone));
  const support = supportPhone();
  if (support) lines.push(phoneLine("eazilyChina support (24/7)", support));

  const ref = dash(p.booking_reference);
  if (ref) lines.push({ label: "Booking reference", value: ref });
  return lines;
};

const bookingUrl = (p: ReminderPayload) => {
  const id = dash(p.task_id);
  return id ? `${APP_BASE_URL}/bookings/${encodeURIComponent(id)}` : `${APP_BASE_URL}/bookings`;
};

const headline = (kind: ReminderKind, p: ReminderPayload) => {
  const tz = tzOf(p);
  const time = p.pickup_at ? localTime(p.pickup_at, tz) : null;
  if (kind === "pickup_reminder_2h") {
    return time ? `Your car is at ${time} today` : "Your car is later today";
  }
  return time ? `Your car is tomorrow at ${time}` : "Your car is tomorrow";
};

const intro = (kind: ReminderKind) =>
  kind === "pickup_reminder_2h"
    ? "Everything you need is below — you don't need the app or a connection to use it."
    : "A reminder for tomorrow. Everything you need is below, so you can travel without needing the app or a connection.";

export const reminderHtml = (kind: ReminderKind, p: ReminderPayload): string => {
  const rows = detailLines(p)
    .map(
      (l) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #E2E2E2;font:400 13px/1.4 Arial,Helvetica,sans-serif;color:#6E6E73;width:150px;" valign="top">${esc(l.label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #E2E2E2;font:600 15px/1.45 Arial,Helvetica,sans-serif;color:#0A0A0B;" valign="top">${l.html ?? esc(l.value)}</td>
        </tr>`,
    )
    .join("");

  const support = supportPhone();
  const footerSupport = support
    ? `Need help right now? Call eazilyChina support, 24/7: <a href="${esc(telHref(support))}" style="color:#6E6E73;">${esc(support)}</a>.<br>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#ffffff;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(reminderSubject(kind, p))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:32px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;text-align:left;">
        <tr><td style="font:800 12px/1 Arial,Helvetica,sans-serif;letter-spacing:0.08em;text-transform:uppercase;color:#6E6E73;padding-bottom:16px;">${esc(SITE_NAME)}</td></tr>
        <tr><td style="font:800 26px/1.15 Arial,Helvetica,sans-serif;color:#0A0A0B;padding-bottom:10px;">${esc(headline(kind, p))}</td></tr>
        <tr><td style="font:400 15px/1.45 Arial,Helvetica,sans-serif;color:#6E6E73;padding-bottom:20px;">${esc(intro(kind))}</td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        </td></tr>
        <tr><td style="padding-top:24px;">
          <a href="${esc(bookingUrl(p))}" style="display:inline-block;background:#0A0A0B;color:#ffffff;text-decoration:none;font:600 15px/1 Arial,Helvetica,sans-serif;padding:16px 24px;border-radius:999px;">View booking</a>
        </td></tr>
        <tr><td style="font:400 13px/1.45 Arial,Helvetica,sans-serif;color:#B0B0B1;padding-top:20px;">
          ${footerSupport}If your plans change, reply to your concierge chat in the app as early as you can.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

export const reminderText = (kind: ReminderKind, p: ReminderPayload): string => {
  const lines = detailLines(p).map((l) => `${l.label}: ${l.value.replace(/\n/g, "\n  ")}`);
  const support = supportPhone();
  return [
    headline(kind, p),
    "",
    intro(kind),
    "",
    ...lines,
    "",
    `View booking: ${bookingUrl(p)}`,
    ...(support ? ["", `eazilyChina support, 24/7: ${support}`] : []),
  ].join("\n");
};
