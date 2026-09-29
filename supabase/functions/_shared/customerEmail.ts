// Customer-facing email enqueue helper.
//
// Same transport as the ops alerts: the verified sending domain plus the
// transactional pgmq queue drained by `process-email-queue`. Suppression,
// retries and the unsubscribe footer are handled downstream.

const SITE_NAME = "eazilyChina";
const SENDER_DOMAIN = "notify.app.eazilychina.com";
const FROM_DOMAIN = "app.eazilychina.com";

export type CustomerEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Used as template_name in email_send_log, e.g. "pickup-reminder-24h". */
  label: string;
  /** Stable per-event id so a retry cannot duplicate the send. */
  idempotencyKey: string;
};

export type CustomerEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/** Enqueue one email to one recipient. Never throws. */
export const enqueueCustomerEmail = async (
  // deno-lint-ignore no-explicit-any
  admin: any,
  email: CustomerEmail,
): Promise<CustomerEmailResult> => {
  const messageId = email.idempotencyKey;

  // The Lovable Email API rejects transactional sends without an unsubscribe
  // token; the table is unique on email, so upsert then read back.
  let unsubscribeToken: string | null = null;
  try {
    const token = crypto.randomUUID().replaceAll("-", "");
    await admin
      .from("email_unsubscribe_tokens")
      .upsert({ email: email.to, token }, { onConflict: "email", ignoreDuplicates: true });
    const { data: row } = await admin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", email.to)
      .maybeSingle();
    unsubscribeToken = row?.token ?? token;
  } catch (e) {
    console.warn("customer-email: unsubscribe token upsert failed", e);
  }

  try {
    await admin.from("email_send_log").insert({
      message_id: messageId,
      template_name: email.label,
      recipient_email: email.to,
      status: "pending",
    });
  } catch (e) {
    console.warn("customer-email: pending log insert failed", e);
  }

  const { error } = await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: email.to,
      from: `${SITE_NAME} <bookings@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: email.subject,
      html: email.html,
      text: email.text,
      purpose: "transactional",
      label: email.label,
      idempotency_key: messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (error) {
    console.error("customer-email: enqueue failed", error);
    try {
      await admin.from("email_send_log").insert({
        message_id: messageId,
        template_name: email.label,
        recipient_email: email.to,
        status: "failed",
        error_message: String(error.message ?? error),
      });
    } catch { /* logging must never mask the send failure */ }
    return { ok: false, error: String(error.message ?? error) };
  }

  return { ok: true, messageId };
};
