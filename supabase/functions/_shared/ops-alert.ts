// Shared, fire-and-forget ops alert helper for concierge edge functions.
//
// Every call is strictly non-blocking: any missing config, RPC failure, or
// render error is caught and logged; an alert failure MUST NEVER fail or
// delay the user-facing operation that triggered it.
//
// Reuses the existing email infrastructure: the verified sending domain and
// the transactional queue processed by `process-email-queue`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SITE_NAME = "eazilyChina";
const SENDER_DOMAIN = "notify.app.eazilychina.com";
const FROM_DOMAIN = "app.eazilychina.com";
const APP_BASE_URL = "https://app.eazilychina.com";

export type OpsAlertLine = { label: string; value: string };

// Structured payload driving the richer "driver dispatch" template used only
// for new transfer requests. When present on OpsAlertInput, this replaces the
// default simple layout. All other event types (message/status/cancel and
// non-transfer new_request) keep the existing render path.
export interface TransferAlertPoint {
  title: string;       // primary — e.g. "The Peninsula Shanghai" or "Pudong Int'l Airport (PVG) · Terminal 2"
  subtitle?: string;   // secondary — street address, or Chinese name (+ terminal), etc.
}

export interface TransferAlertData {
  service: "airport" | "hourly" | "station";
  taskShortId: string;      // first 8 chars of task UUID
  pickupWhen: string;       // ISO date-time
  pickup: TransferAlertPoint;
  dropoff?: TransferAlertPoint | null;
  distanceKm?: number | null;
  passenger: string;
  phone?: string | null;
  carType: string;          // e.g. "Standard sedan"
  pax: number;
  bags: number;
  notes?: string | null;
  flightOrTrainLine?: string | null; // e.g. "Flight MU587" or "Train G7"
}

export interface OpsAlertInput {
  event: string; // short slug used as template_name in email_send_log, e.g. "new_request"
  subject: string;
  headline: string;
  intro?: string;
  lines: OpsAlertLine[];
  taskId: string;
  // Optional task category (e.g. "transfer", "restaurant_reservation") used
  // to route the alert to the right ops inbox. When absent, or when the
  // category-specific secret is unset, the alert falls back to
  // CONCIERGE_OPS_EMAIL — an alert must never fail to send.
  category?: string | null;
  transfer?: TransferAlertData;
}

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function taskUrl(taskId: string) {
  return `${APP_BASE_URL}/ops?task=${encodeURIComponent(taskId)}`;
}

const SERVICE_CHIP: Record<TransferAlertData["service"], string> = {
  airport: "AIRPORT TRANSFER",
  hourly: "HOURLY CAR",
  station: "STATION TRANSFER",
};

function fmtPickupWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Shanghai",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Shanghai",
  }).format(d);
  return `${date} · ${time}`;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function renderTransferHtml(input: OpsAlertInput): string {
  const t = input.transfer!;
  const url = taskUrl(input.taskId);
  const chip = SERVICE_CHIP[t.service] ?? "TRANSFER";

  const dropoffSubtitle = (() => {
    const parts: string[] = [];
    if (t.dropoff?.subtitle) parts.push(t.dropoff.subtitle);
    if (t.distanceKm && t.distanceKm > 0) parts.push(`~${Math.round(t.distanceKm)} km`);
    return parts.join(" · ");
  })();

  const routeCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F7;border-radius:12px;margin:0 0 20px;">
      <tr>
        <td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="top" width="24" style="padding-top:6px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#1B895A;"></span>
              </td>
              <td valign="top" style="padding-bottom:14px;border-bottom:1px solid #E2E2E2;">
                <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:#6E6E73;">PICK UP</p>
                <p style="margin:0;font-size:15px;font-weight:700;color:#0A0A0B;line-height:1.35;">${esc(t.pickup.title)}</p>
                ${t.pickup.subtitle ? `<p style="margin:2px 0 0;font-size:13px;color:#6E6E73;line-height:1.4;">${esc(t.pickup.subtitle)}</p>` : ""}
              </td>
            </tr>
            ${t.dropoff ? `
            <tr>
              <td valign="top" width="24" style="padding-top:16px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#DE2910;"></span>
              </td>
              <td valign="top" style="padding-top:14px;">
                <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:#6E6E73;">DROP OFF</p>
                <p style="margin:0;font-size:15px;font-weight:700;color:#0A0A0B;line-height:1.35;">${esc(t.dropoff.title)}</p>
                ${dropoffSubtitle ? `<p style="margin:2px 0 0;font-size:13px;color:#6E6E73;line-height:1.4;">${esc(dropoffSubtitle)}</p>` : ""}
              </td>
            </tr>` : ""}
          </table>
        </td>
      </tr>
    </table>`;

  const cell = (label: string, valueHtml: string) => `
    <td width="50%" valign="top" style="padding:10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F7;border-radius:12px;">
        <tr><td style="padding:12px 14px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:#6E6E73;">${esc(label)}</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#0A0A0B;line-height:1.35;">${valueHtml}</p>
        </td></tr>
      </table>
    </td>`;

  const phoneCellHtml = t.phone
    ? `<a href="${esc(telHref(t.phone))}" style="color:#DE2910;text-decoration:none;font-weight:700;">${esc(t.phone)}</a>`
    : "";

  const grid = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -10px 20px;">
      <tr>
        ${cell("PASSENGER", esc(t.passenger))}
        ${t.phone ? cell("PHONE", phoneCellHtml) : cell("PHONE", `<span style="color:#B0B0B1;font-weight:500;">Not provided</span>`)}
      </tr>
      <tr>
        ${cell("CAR TYPE", esc(t.carType))}
        ${cell("PASSENGERS · BAGS", esc(`${t.pax} · ${t.bags} ${t.bags === 1 ? "bag" : "bags"}`))}
      </tr>
    </table>`;

  const notesLine = t.notes ? esc(t.notes).replace(/\n/g, "<br/>") : "";
  const flightLine = t.flightOrTrainLine ? esc(t.flightOrTrainLine) : "";
  const notesInner = [flightLine, notesLine].filter(Boolean).join("<br/><br/>");
  const notesCard = notesInner
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="border:1px dashed #DE2910;background:#FCEDDD;border-radius:12px;padding:14px 16px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:#DE2910;">NOTES FROM PASSENGER</p>
        <p style="margin:0;font-size:14px;color:#0A0A0B;line-height:1.5;">${notesInner}</p>
      </td></tr>
    </table>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/></head>
<body style="background:#ffffff;margin:0;padding:0;font-family:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0A0A0B;">
  <div style="max-width:640px;margin:0 auto;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0B;">
      <tr>
        <td style="padding:16px 24px;font-size:15px;font-weight:700;letter-spacing:0.02em;">
          <span style="color:#ffffff;">eazily</span><span style="color:#DE2910;">China</span>
        </td>
        <td align="right" style="padding:16px 24px;color:#B0B0B1;font-weight:700;font-size:11px;letter-spacing:0.14em;">DRIVER DISPATCH</td>
      </tr>
    </table>
    <div style="padding:28px 24px 32px;">
      <div style="margin:0 0 20px;">
        <span style="display:inline-block;background:#FBEAE7;color:#DE2910;border-radius:999px;padding:8px 14px;font-size:11px;font-weight:700;letter-spacing:0.12em;">${esc(chip)}</span>
      </div>
      <h1 style="font-size:28px;font-weight:800;color:#0A0A0B;line-height:1.15;margin:0 0 8px;">New ride request</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#6E6E73;">Task #${esc(t.taskShortId)}</p>
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:#6E6E73;">PICKUP DATE &amp; TIME</p>
      <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#0A0A0B;line-height:1.2;">${esc(fmtPickupWhen(t.pickupWhen))}</p>
      ${routeCard}
      ${grid}
      ${notesCard}
      <p style="margin:0 0 20px;">
        <a href="${esc(url)}" style="display:block;background:#0A0A0B;color:#ffffff;text-decoration:none;text-align:center;font-weight:700;font-size:15px;padding:16px 20px;border-radius:999px;">Open task</a>
      </p>
      <p style="font-size:12px;color:#B0B0B1;margin:0;line-height:1.5;">Automated dispatch alert. Do not reply.</p>
    </div>
  </div>
</body></html>`;
}

function renderTransferText(input: OpsAlertInput): string {
  const t = input.transfer!;
  const lines = [
    "New ride request",
    `Task #${t.taskShortId}`,
    "",
    `Pickup: ${fmtPickupWhen(t.pickupWhen)}`,
    `Pick up: ${t.pickup.title}${t.pickup.subtitle ? ` — ${t.pickup.subtitle}` : ""}`,
  ];
  if (t.dropoff) {
    const sub = [t.dropoff.subtitle, t.distanceKm ? `~${Math.round(t.distanceKm)} km` : ""].filter(Boolean).join(" · ");
    lines.push(`Drop off: ${t.dropoff.title}${sub ? ` — ${sub}` : ""}`);
  }
  lines.push(`Passenger: ${t.passenger}`);
  if (t.phone) lines.push(`Phone: ${t.phone}`);
  lines.push(`Car: ${t.carType}`);
  lines.push(`Passengers · Bags: ${t.pax} · ${t.bags}`);
  if (t.flightOrTrainLine) lines.push(t.flightOrTrainLine);
  if (t.notes) lines.push("", `Notes: ${t.notes}`);
  lines.push("", `Open task: ${taskUrl(input.taskId)}`);
  return lines.join("\n");
}

function renderHtml(input: OpsAlertInput): string {
  if (input.transfer) return renderTransferHtml(input);
  const url = taskUrl(input.taskId);
  const rows = input.lines
    .filter((l) => l && l.value != null && String(l.value).length > 0)
    .map(
      (l) => `
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#6E6E73;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;width:120px;vertical-align:top;">${esc(l.label)}</td>
          <td style="padding:6px 0;font-size:14px;color:#0A0A0B;line-height:1.45;">${esc(l.value)}</td>
        </tr>`,
    )
    .join("");

  const intro = input.intro
    ? `<p style="font-size:15px;color:#6E6E73;line-height:1.5;margin:0 0 20px;">${esc(input.intro)}</p>`
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/></head>
<body style="background:#ffffff;margin:0;padding:0;font-family:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;padding:32px 24px;">
    <p style="font-size:13px;font-weight:700;letter-spacing:0.02em;margin:0 0 24px;">
      <span style="color:#0A0A0B;">eazily</span><span style="color:#DE2910;">China</span>
      <span style="color:#6E6E73;font-weight:500;"> · Ops alert</span>
    </p>
    <h1 style="font-size:22px;font-weight:800;color:#0A0A0B;line-height:1.2;margin:0 0 12px;">${esc(input.headline)}</h1>
    ${intro}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#F6F6F7;border-radius:12px;padding:16px 20px;margin:0 0 24px;">
      ${rows}
      <tr>
        <td style="padding:6px 0;font-size:12px;color:#6E6E73;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;width:120px;vertical-align:top;">Task ID</td>
        <td style="padding:6px 0;font-size:13px;color:#0A0A0B;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;">${esc(input.taskId)}</td>
      </tr>
    </table>
    <p style="margin:0 0 24px;">
      <a href="${esc(url)}" style="display:inline-block;background:#0A0A0B;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:999px;">Open task</a>
    </p>
    <p style="font-size:12px;color:#B0B0B1;margin:0;line-height:1.5;">Automated operations alert. Do not reply.</p>
  </div>
</body></html>`;
}

function renderText(input: OpsAlertInput): string {
  if (input.transfer) return renderTransferText(input);
  const lines = [
    input.headline,
    "",
    ...(input.intro ? [input.intro, ""] : []),
    ...input.lines
      .filter((l) => l && l.value)
      .map((l) => `${l.label}: ${l.value}`),
    `Task ID: ${input.taskId}`,
    "",
    `Open task: ${taskUrl(input.taskId)}`,
  ];
  return lines.join("\n");
}

// Parse a secret that holds either a single address or a comma-separated
// list. Trims whitespace, drops empty entries, de-duplicates
// case-insensitively (first spelling wins).
function parseAddressList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of String(raw).split(",")) {
    const addr = part.trim();
    if (!addr) continue;
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

// Resolve the ops inbox(es) for a given task category. Missing or unknown
// categories, and missing/empty category-specific secrets, fall back to
// CONCIERGE_OPS_EMAIL. Returns an empty array only when no fallback is
// configured.
function resolveOpsRecipients(category: string | null | undefined): string[] {
  const fallback = parseAddressList(Deno.env.get("CONCIERGE_OPS_EMAIL"));
  const cat = (category ?? "").toLowerCase();
  if (cat === "transfer") {
    const list = parseAddressList(Deno.env.get("OPS_EMAIL_TRANSFERS"));
    return list.length > 0 ? list : fallback;
  }
  if (cat.startsWith("restaurant")) {
    const list = parseAddressList(Deno.env.get("OPS_EMAIL_RESTAURANTS"));
    return list.length > 0 ? list : fallback;
  }
  return fallback;
}

// deno-lint-ignore no-explicit-any
async function enqueueForRecipient(
  admin: any,
  input: OpsAlertInput,
  recipient: string,
  templateName: string,
  html: string,
  text: string,
): Promise<void> {
  // Attempt-distinguishing message_id: every sendOpsAlert invocation gets a
  // fresh random suffix + wall-clock component. This means a re-trigger after
  // a failure never reuses the same idempotency_key on the Lovable Email API
  // side, so a deterministic 400 on one attempt cannot poison future ones.
  // True in-queue retries (same enqueued payload) still dedupe via this key.
  const messageId = `ops-${input.event}-${input.taskId}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

  // Mint (or reuse) one unsubscribe token per ops recipient. The Lovable
  // Email API rejects transactional sends without a token. The table has a
  // UNIQUE constraint on email, so we upsert and read back the current token.
  let unsubscribeToken: string | null = null;
  try {
    const token = crypto.randomUUID().replaceAll("-", "");
    await admin
      .from("email_unsubscribe_tokens")
      .upsert({ email: recipient, token }, { onConflict: "email", ignoreDuplicates: true });
    const { data: row } = await admin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", recipient)
      .maybeSingle();
    unsubscribeToken = row?.token ?? token;
  } catch (e) {
    console.warn(`ops-alert: unsubscribe token upsert failed for ${recipient}`, e);
  }

  try {
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: recipient,
      status: "pending",
    });
  } catch (e) {
    console.warn(`ops-alert: pending log insert failed for ${recipient}`, e);
  }

  try {
    const { error } = await admin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: recipient,
        from: `${SITE_NAME} Ops <ops@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: input.subject,
        html,
        text,
        purpose: "transactional",
        label: templateName,
        idempotency_key: messageId,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) {
      console.warn(`ops-alert: enqueue failed for ${recipient}`, error);
      try {
        await admin.from("email_send_log").insert({
          message_id: messageId,
          template_name: templateName,
          recipient_email: recipient,
          status: "failed",
          error_message: `enqueue failed: ${error.message ?? "unknown"}`,
        });
    } catch { /* ignore */ }
    }
  } catch (e) {
    console.warn(`ops-alert: enqueue threw for ${recipient}`, e);
  }
}

async function enqueueOpsAlert(input: OpsAlertInput): Promise<void> {
  const recipients = resolveOpsRecipients(input.category);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (recipients.length === 0) {
    console.error(
      `ops-alert: NO OPS RECIPIENT CONFIGURED — alert dropped (event=${input.event}, category=${input.category ?? "none"}, task=${input.taskId}). Set CONCIERGE_OPS_EMAIL.`,
    );
    return;
  }
  if (!supabaseUrl || !serviceRole) return; // silent no-op

  const admin = createClient(supabaseUrl, serviceRole);
  const templateName = `concierge-ops-${input.event}`;
  // Render once; the templates are recipient-independent.
  const html = renderHtml(input);
  const text = renderText(input);

  // One enqueued message per address (the queue mints one unsubscribe token
  // per address). Each send is independent: a failure for one recipient must
  // never suppress the others.
  const results = await Promise.allSettled(
    recipients.map((r) => enqueueForRecipient(admin, input, r, templateName, html, text)),
  );
  results.forEach((res, i) => {
    if (res.status === "rejected") {
      console.warn(`ops-alert: recipient failed ${recipients[i]}`, res.reason);
    }
  });
}

/**
 * Fire-and-forget. Safe to call without `await` — errors are swallowed and
 * scheduled work is kept alive via EdgeRuntime.waitUntil when available.
 */
export function sendOpsAlert(input: OpsAlertInput): void {
  try {
    const p = enqueueOpsAlert(input).catch((e) => {
      console.warn("ops-alert: unhandled", e);
    });
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt && typeof rt.waitUntil === "function") rt.waitUntil(p);
  } catch (e) {
    console.warn("ops-alert: dispatch threw", e);
  }
}

export { taskUrl as opsTaskUrl };