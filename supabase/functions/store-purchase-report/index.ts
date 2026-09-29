// Client-side store diagnostics and reconciliation.
//
// kind "purchase_error": the store returned an error. Logged with the raw
//   error and code so the first real failures are diagnosable.
// kind "unconfirmed": the store reported success but no booking allowance
//   appeared within the client's polling window. Recorded for replay and ops
//   is alerted so a person can reconcile it. Nothing is granted here.
//
// Records reuse revenuecat_dead_letters (no schema change); the user id comes
// from the verified JWT, never from the body.
import { createClient } from "npm:@supabase/supabase-js@2";
import { withCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/ai-auth.ts";
import { sendOpsAlert } from "../_shared/ops-alert.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : v == null ? null : String(v).slice(0, max));

Deno.serve(withCors(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const auth = await requireAuth(req, {});
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 8000) return json(413, { error: "too_large" });
    body = JSON.parse(text);
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const kind = body.kind;
  if (kind !== "purchase_error" && kind !== "unconfirmed") return json(400, { error: "invalid_kind" });

  const productId = str(body.product_id);
  const transactionId = str(body.transaction_id);
  const code = str(body.code);
  const classified = str(body.classified, 40);
  const rawError = str(body.raw_error, 2000);
  const platform = str(body.platform, 40);

  const record = {
    kind, user_id: auth.userId, product_id: productId, transaction_id: transactionId,
    code, classified, raw_error: rawError, platform, reported_at: new Date().toISOString(),
  };

  if (kind === "purchase_error") {
    console.error("store purchase error", record);
  } else {
    console.error("store purchase unconfirmed — needs reconciliation", record);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.from("revenuecat_dead_letters").insert({
    reason: kind === "unconfirmed" ? "client_unconfirmed_purchase" : "client_purchase_error",
    event_type: kind === "unconfirmed" ? "CLIENT_UNCONFIRMED" : "CLIENT_PURCHASE_ERROR",
    app_user_id: auth.userId,
    transaction_id: transactionId,
    raw_event: record,
  }).select("id").single();
  if (error) console.error("store-purchase-report insert failed", error);

  if (kind === "unconfirmed") {
    const { data: u } = await supabase.auth.admin.getUserById(auth.userId);
    sendOpsAlert({
      event: "revenuecat_unconfirmed",
      subject: "Trip Pass paid but not activated — action needed",
      headline: "A customer's store purchase succeeded but no allowance appeared",
      intro: "The App Store reported success, but the webhook hasn't granted the pass within the polling window. Check RevenueCat for this user and grant or replay. The customer has been told we can see the payment and are fixing it.",
      lines: [
        { label: "User id", value: auth.userId },
        { label: "Email", value: u?.user?.email ?? "unknown" },
        { label: "Product", value: productId ?? "unknown" },
        { label: "Store transaction", value: transactionId ?? "not provided by the store" },
        { label: "Record id", value: data?.id ?? "insert failed — see function logs" },
      ],
      taskId: "",
      category: "restaurant_reservation",
    });
  }

  return json(200, { ok: true, reference: data?.id ?? null });
}));
