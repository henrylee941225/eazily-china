// Single source of truth for "is this request test money or real money?".
//
// Threat model, stated plainly: preview and production share one Supabase
// project and one edge-function deployment, so there is no environment
// boundary to lean on. The mode must therefore be decided from a signal the
// caller cannot use to make real money cheap. That signal is the request
// Origin:
//
//   production web origins + native app shells -> live
//   Lovable preview / localhost origins        -> sandbox
//   anything else                              -> rejected
//
// Nothing in the request body, no header the client invents, and no client
// token prefix may influence the result. Callers may DECLARE an expected mode
// so we can fail loudly on a mismatch, but the declaration never decides.
//
// Fail-safe direction: an unknown or missing Origin resolves to LIVE, never
// sandbox. A forged Origin can therefore only put an attacker on the real
// money path (where they pay), never on the free test path (where they would
// get a real transfer for a 4242 card).

import type { StripeEnv } from "./stripe.ts";
export type { StripeEnv } from "./stripe.ts";

const LIVE_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/app\.eazilychina\.com$/,
  /^https:\/\/(www\.)?eazilychina\.com$/,
  /^https:\/\/eazilychina\.lovable\.app$/,
  // Native iOS/Android shells (Median). These wrap the PRODUCTION build.
  /^capacitor:\/\/localhost$/,
  /^ionic:\/\/localhost$/,
  /^file:\/\/(localhost)?$/,
  /^median:\/\/[a-z0-9.-]*$/i,
  /^app:\/\/[a-z0-9.-]*$/i,
];

const SANDBOX_ORIGIN_PATTERNS: RegExp[] = [
  // Lovable preview and sandbox hosts.
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/preview--[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.dev$/,
  // Local development.
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

const list = (name: string): string[] =>
  (Deno.env.get(name) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export type EnvResolution =
  | { env: StripeEnv; origin: string; source: string }
  | { reject: string; origin: string };

/**
 * Decide the Stripe mode for an incoming request from its Origin alone.
 * `PAYMENTS_FORCE_SANDBOX=true` is a server-side rollback switch that pins
 * everything to sandbox; there is deliberately no switch that forces live.
 */
export function resolveRequestStripeEnv(req: Request): EnvResolution {
  const origin = req.headers.get("Origin") ?? "";

  if (String(Deno.env.get("PAYMENTS_FORCE_SANDBOX") ?? "").toLowerCase() === "true") {
    return { env: "sandbox", origin, source: "PAYMENTS_FORCE_SANDBOX" };
  }

  // Explicit per-project overrides, checked before the patterns.
  if (origin && list("PAYMENTS_SANDBOX_ORIGINS").includes(origin)) {
    return { env: "sandbox", origin, source: "PAYMENTS_SANDBOX_ORIGINS" };
  }
  if (origin && list("PAYMENTS_LIVE_ORIGINS").includes(origin)) {
    return { env: "live", origin, source: "PAYMENTS_LIVE_ORIGINS" };
  }

  // No Origin header at all, or the opaque "null" a native webview sends.
  // Native shells ship the production build, so this is the live path.
  if (!origin || origin === "null") {
    return { env: "live", origin: origin || "(none)", source: "no-origin (native shell)" };
  }

  if (SANDBOX_ORIGIN_PATTERNS.some((re) => re.test(origin))) {
    return { env: "sandbox", origin, source: "sandbox origin pattern" };
  }
  if (LIVE_ORIGIN_PATTERNS.some((re) => re.test(origin))) {
    return { env: "live", origin, source: "live origin pattern" };
  }

  return { reject: "origin does not map to a known payments mode", origin };
}

/**
 * Resolve the mode or hand back a ready 403. `declared` is the mode the
 * client believes it is in (from its bundled publishable token): a mismatch
 * means the build and the origin disagree, which would produce a broken
 * checkout or a test payment on a real page — so we refuse.
 */
export function requireRequestStripeEnv(
  req: Request,
  fnName: string,
  declared?: string | null,
): { env: StripeEnv } | { response: Response } {
  const headers = { "Content-Type": "application/json" };
  const r = resolveRequestStripeEnv(req);

  if ("reject" in r) {
    console.error(`${fnName}: refusing payment request — unknown origin '${r.origin}'`);
    return {
      response: new Response(
        JSON.stringify({
          error: "Payments are not available from this location.",
          code: "unknown_payments_origin",
        }),
        { status: 403, headers },
      ),
    };
  }

  console.log(
    `${fnName}: payments mode '${r.env}' resolved from origin '${r.origin}' (${r.source})`,
  );

  if (declared && declared !== r.env) {
    console.error(
      `${fnName}: client declared mode '${declared}' but origin '${r.origin}' resolves to '${r.env}' — refusing.`,
    );
    return {
      response: new Response(
        JSON.stringify({
          error:
            "This app build doesn't match the payment environment for this address. Reload the app and try again.",
          code: "payments_mode_mismatch",
        }),
        { status: 409, headers },
      ),
    };
  }

  return { env: r.env };
}

/**
 * The mode a stored payment was CREATED in. Actioning a payment (capture,
 * refund, hold release) must always use this, never the request mode — a
 * sandbox PaymentIntent captured with live keys is a silent data corruption.
 * There is no fallback: an unknown value is an error, not a guess.
 */
export function storedStripeEnv(value: unknown): StripeEnv | null {
  return value === "live" || value === "sandbox" ? value : null;
}

/** True when a PaymentIntent id belongs to the mode we're about to act in. */
export function looksLikeStripeId(id: unknown): id is string {
  return typeof id === "string" && /^pi_[A-Za-z0-9_]+$/.test(id);
}
