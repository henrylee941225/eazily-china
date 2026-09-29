// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendOpsAlert } from "../_shared/ops-alert.ts";

// booking_entitlements is the SINGLE source of truth for restaurant booking
// access. trip_passes and profiles.trip_pass_active_until are written here as
// a purchase log only — nothing may gate on them.

const MAX_TRIP_DAYS = 60;
const BOOKINGS_PER_PASS = 5; // explicit: never rely on the column default
const QUOTED_GBP_CENTS = 999;
const ENTITLEMENT_ID = "trip_pass";
const DAY_MS = 86_400_000;

const GRANT_TYPES = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"]);
const REVOKE_TYPES = new Set(["CANCELLATION", "REFUND", "EXPIRATION"]);
const STORE_SOURCE: Record<string, "apple" | "google"> = {
  APP_STORE: "apple",
  MAC_APP_STORE: "apple",
  PLAY_STORE: "google",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function alert(subject: string, headline: string, lines: Record<string, string>) {
  sendOpsAlert({
    event: "revenuecat",
    subject,
    headline,
    lines: Object.entries(lines).map(([label, value]) => ({ label, value })),
    taskId: "",
    category: "restaurant_reservation",
  });
}

Deno.serve(withCors(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const expected = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!expected) {
    console.error("REVENUECAT_WEBHOOK_SECRET not configured");
    return json(500, { error: "not_configured" });
  }
  if (req.headers.get("Authorization") !== expected) {
    console.warn("rejected webhook: bad authorization header");
    return json(401, { error: "unauthorized" });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const ev = payload?.event;
  if (!ev?.type) return json(400, { error: "missing_event" });

  const type: string = ev.type;
  const entitlements: string[] = ev.entitlement_ids ??
    (ev.entitlement_id ? [ev.entitlement_id] : []);

  if (entitlements.length && !entitlements.includes(ENTITLEMENT_ID)) {
    return json(200, { ignored: "other_entitlement" });
  }
  if (!GRANT_TYPES.has(type) && !REVOKE_TYPES.has(type)) {
    return json(200, { ignored: type });
  }

  const appUserId: string = String(ev.app_user_id ?? "");
  const txId = String(ev.transaction_id ?? ev.original_transaction_id ?? "");
  const store = String(ev.store ?? "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Park an event we can't apply, verbatim, so it can be replayed later.
  // If parking fails, return 500 so RevenueCat retries — never lose it.
  const deadLetter = async (reason: string): Promise<Response> => {
    const { error } = await supabase.from("revenuecat_dead_letters").insert({
      reason,
      event_type: type,
      app_user_id: appUserId || null,
      transaction_id: txId || null,
      raw_event: payload,
    });
    if (error) {
      console.error("dead-letter write failed — asking RevenueCat to retry", error);
      return json(500, { error: "dead_letter_failed" });
    }
    console.error("revenuecat event dead-lettered", { reason, type, appUserId, txId, store });
    alert(
      `RevenueCat ${type} parked (${reason}) — replay once fixed`,
      "A store event couldn't be applied. The full event is saved for replay.",
      {
        Reason: reason,
        Event: type,
        "App user id": appUserId || "(missing)",
        Transaction: txId || "(missing)",
        Store: store || "(missing)",
      },
    );
    return json(200, { ignored: reason, dead_lettered: true });
  };

  // ---- Unknown / malformed user ----------------------------------------
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserId)) {
    return await deadLetter("malformed_user");
  }
  {
    const { data, error } = await supabase.auth.admin.getUserById(appUserId);
    if (error && !/not.?found/i.test(error.message ?? "")) {
      // Lookup itself failed (transient) — let RevenueCat retry.
      console.error("user lookup failed", error);
      return json(500, { error: "user_lookup_failed" });
    }
    if (!data?.user) return await deadLetter("unknown_user");
  }

  // ---- Revocation -------------------------------------------------------
  if (REVOKE_TYPES.has(type)) {
    if (txId) {
      await supabase
        .from("trip_passes")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("rc_transaction_id", txId);
    }

    const { data: rows } = txId
      ? await supabase
        .from("booking_entitlements")
        .select("id, status, confirmed_count, max_bookings, rc_transaction_ids")
        .contains("rc_transaction_ids", [txId])
        .neq("status", "released")
      : { data: [] as any[] };

    let action = "no_matching_allowance";
    let confirmed = 0;
    for (const row of rows ?? []) {
      confirmed += row.confirmed_count ?? 0;
      const ids: string[] = (row.rc_transaction_ids ?? []).filter((t: string) => t !== txId);
      if (ids.length > 0) {
        // Other purchases still back this allowance: remove only this one.
        await supabase
          .from("booking_entitlements")
          .update({
            rc_transaction_ids: ids,
            max_bookings: Math.max(row.confirmed_count ?? 0, (row.max_bookings ?? 0) - BOOKINGS_PER_PASS),
          })
          .eq("id", row.id);
        action = "reduced";
      } else {
        await supabase
          .from("booking_entitlements")
          .update({
            rc_transaction_ids: ids,
            status: "released",
            released_at: new Date().toISOString(),
            release_reason: type.toLowerCase(),
          })
          .eq("id", row.id);
        action = "released";
        await supabase
          .from("profiles")
          .update({ trip_pass_active_until: null })
          .eq("user_id", appUserId);
      }
    }

    // Confirmed bookings are left alone — a person decides.
    alert(
      `Trip Pass ${type.toLowerCase()} — ${confirmed} confirmed booking(s) to review`,
      "A store purchase was revoked. Confirmed bookings were not touched.",
      {
        Event: type,
        User: appUserId,
        Transaction: txId || "(missing)",
        Allowance: action,
        "Bookings already confirmed": String(confirmed),
      },
    );
    console.log("revoked", { type, appUserId, txId, action, confirmed });
    return json(200, { ok: true, action });
  }

  // ---- Grant ------------------------------------------------------------
  if (!txId) return json(400, { error: "missing_transaction_id" });
  const source = STORE_SOURCE[store];
  if (!source) return await deadLetter("unsupported_store");

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("departure_date")
    .eq("user_id", appUserId)
    .maybeSingle();
  if (profileErr) {
    console.error("profile lookup failed", profileErr);
    return json(500, { error: "profile_lookup_failed" });
  }

  // Validity for this purchase: departure date capped at purchase + 60d.
  const purchasedAt = new Date(ev.purchased_at_ms ?? Date.now());
  const validFrom = isoDate(purchasedAt);
  const cap = isoDate(new Date(purchasedAt.getTime() + MAX_TRIP_DAYS * DAY_MS));
  const dep = (profile?.departure_date as string | null) ?? null;
  const tripDatesDefaulted = !dep || dep < validFrom;
  const validUntil = tripDatesDefaulted ? cap : (dep! < cap ? dep! : cap);

  const priceMajor = Number(ev.price_in_purchased_currency ?? ev.price ?? 0);
  const currency = String(ev.currency ?? "").toUpperCase() || null;
  const chargeCents = Number.isFinite(priceMajor) && priceMajor > 0
    ? Math.round(priceMajor * 100)
    : null;
  const days = Math.max(1, Math.round((Date.parse(validUntil) - Date.parse(validFrom)) / DAY_MS));

  // Idempotency lock: the purchase log is unique on the transaction id.
  // Log only — nothing gates on trip_passes.
  const { error: logErr } = await supabase.from("trip_passes").insert({
    user_id: appUserId,
    purchased_at: purchasedAt.toISOString(),
    trip_start_date: validFrom,
    trip_end_date: validUntil,
    days_total: days,
    days_billed: days,
    amount_paid_usd_cents: chargeCents ?? QUOTED_GBP_CENTS,
    status: "active",
    source: "revenuecat",
    rc_transaction_id: txId,
    rc_app_user_id: appUserId,
    rc_environment: String(ev.environment ?? "").toUpperCase() || null,
    charge_amount_cents: chargeCents,
    charge_currency: currency,
    quoted_gbp_cents: QUOTED_GBP_CENTS,
  });
  if (logErr) {
    if ((logErr as any).code === "23505") {
      console.log("duplicate webhook ignored", txId);
      return json(200, { ok: true, action: "already_processed" });
    }
    console.error("purchase log insert failed", logErr);
    return json(500, { error: "purchase_log_failed" });
  }
  // Belt and braces: an allowance may already carry this id.
  const { data: already } = await supabase
    .from("booking_entitlements")
    .select("id")
    .contains("rc_transaction_ids", [txId])
    .maybeSingle();
  if (already) return json(200, { ok: true, action: "already_processed" });

  const { data: active } = await supabase.rpc("booking_entitlement_state", { user_uuid: appUserId });
  const activeRow = Array.isArray(active) ? active[0] : active;

  let finalUntil = validUntil;
  if (activeRow?.id) {
    // Extend, never replace: +5 bookings, later of the two end dates.
    const { data: cur } = await supabase
      .from("booking_entitlements")
      .select("max_bookings, valid_until, rc_transaction_ids, trip_dates_defaulted")
      .eq("id", activeRow.id)
      .single();
    const curUntil = (cur?.valid_until as string | null) ?? validUntil;
    finalUntil = curUntil > validUntil ? curUntil : validUntil;
    const { error: extErr } = await supabase
      .from("booking_entitlements")
      .update({
        max_bookings: (cur?.max_bookings ?? 0) + BOOKINGS_PER_PASS,
        valid_until: finalUntil,
        rc_transaction_ids: [...(cur?.rc_transaction_ids ?? []), txId],
        extended_at: new Date().toISOString(),
        extension_seen_at: null,
        trip_dates_defaulted: !!cur?.trip_dates_defaulted && tripDatesDefaulted,
      })
      .eq("id", activeRow.id);
    if (extErr) {
      console.error("entitlement extend failed", extErr);
      await supabase.from("trip_passes").delete().eq("rc_transaction_id", txId);
      return json(500, { error: "entitlement_write_failed" });
    }
    alert(
      "Trip Pass extended (for visibility, no action needed)",
      "A traveller bought a pass while one was active. The existing allowance was extended.",
      {
        User: appUserId,
        Transaction: txId,
        Store: source,
        Allowance: String(activeRow.id),
        "Bookings now": String((cur?.max_bookings ?? 0) + BOOKINGS_PER_PASS),
        "Valid until": finalUntil,
      },
    );
    console.log("extended", { appUserId, txId, entitlement: activeRow.id, finalUntil });
  } else {
    const { error: entErr } = await supabase.from("booking_entitlements").insert({
      user_id: appUserId,
      source,
      rc_transaction_id: txId,
      rc_transaction_ids: [txId],
      status: "captured",
      authorised_at: purchasedAt.toISOString(),
      captured_at: purchasedAt.toISOString(),
      max_bookings: BOOKINGS_PER_PASS,
      confirmed_count: 0,
      valid_from: validFrom,
      valid_until: validUntil,
      trip_dates_defaulted: tripDatesDefaulted,
    });
    if (entErr) {
      console.error("entitlement insert failed", entErr);
      // Undo the lock so RevenueCat's retry can succeed.
      await supabase.from("trip_passes").delete().eq("rc_transaction_id", txId);
      return json(500, { error: "entitlement_write_failed" });
    }
    console.log("granted", { appUserId, txId, source, validFrom, validUntil, tripDatesDefaulted });
  }

  await supabase
    .from("profiles")
    .update({ trip_pass_active_until: `${finalUntil}T23:59:59Z` })
    .eq("user_id", appUserId);

  return json(200, { ok: true, action: activeRow?.id ? "extended" : "granted" });
}));
