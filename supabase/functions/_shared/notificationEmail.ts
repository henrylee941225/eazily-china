// Generic branded email for copy-driven customer notifications.
//
// Pickup reminders have their own fully self-contained renderer
// (pickupReminderEmail.ts). Everything else is short: heading, one paragraph,
// one action. Inline styles only — email clients ignore stylesheets.

import type { NotificationCopy } from "./notificationCopy.ts";

const APP_BASE_URL = "https://app.eazilychina.com";

const INK = "#0A0A0B";
const SECONDARY = "#6E6E73";
const BORDER = "#E2E2E2";

const esc = (s: string) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const notificationEmailHtml = (copy: NotificationCopy, ref?: string | null): string => {
  const url = `${APP_BASE_URL}${copy.ctaPath}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Hanken Grotesk',Helvetica,Arial,sans-serif;color:${INK};">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:13px;font-weight:600;color:${SECONDARY};letter-spacing:0.08em;text-transform:uppercase;">eazilyChina</div>
    <h1 style="font-size:24px;font-weight:800;line-height:1.2;margin:20px 0 12px;">${esc(copy.emailHeading)}</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px;color:${INK};">${esc(copy.emailBody)}</p>
    ${ref ? `<p style="font-size:13px;color:${SECONDARY};margin:0 0 20px;">Booking reference: ${esc(ref)}</p>` : ""}
    <a href="${esc(url)}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:999px;">${esc(copy.ctaLabel)}</a>
    <hr style="border:none;border-top:1px solid ${BORDER};margin:28px 0 12px;">
    <p style="font-size:12px;color:${SECONDARY};margin:0;">You're receiving this because of a booking you made with eazilyChina.</p>
  </div>
</body></html>`;
};

export const notificationEmailText = (copy: NotificationCopy, ref?: string | null): string =>
  [
    copy.emailHeading,
    "",
    copy.emailBody,
    ref ? `\nBooking reference: ${ref}` : "",
    "",
    `${copy.ctaLabel}: ${APP_BASE_URL}${copy.ctaPath}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
