// Per-user rate limiting and a daily spend ceiling for every function that
// calls a paid provider (Lovable AI gateway, Baidu, DeepSeek, Amap).
//
// Two ceilings, both enforced in one atomic SQL call (`ai_rate_check`):
//   1. Hourly call count for THIS function — stops a burst.
//   2. Daily cost-unit total across ALL AI functions — stops slow, patient
//      abuse that stays under every hourly limit.
//
// Cost units are a rough relative price per call (a generated image costs far
// more than a text translation), so one ceiling covers every feature.
// Every number is overridable by env var so limits can be tuned without a deploy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { sendOpsAlert } from "./ops-alert.ts";

export type AiFunctionName =
  | "translate"
  | "transcribe"
  | "translate-image"
  | "chat"
  | "generate-plan"
  | "recommend-restaurant"
  | "recommend-stops"
  | "daily-picks"
  | "pick-image";

type Limit = { envVar: string; defaultHourly: number; units: number };

// Defaults chosen so normal use never touches them: a traveller translating a
// menu line by line, or chatting with the concierge, stays well inside.
const LIMITS: Record<AiFunctionName, Limit> = {
  translate: { envVar: "RATE_LIMIT_TRANSLATE_HOURLY", defaultHourly: 60, units: 1 },
  transcribe: { envVar: "RATE_LIMIT_TRANSCRIBE_HOURLY", defaultHourly: 30, units: 2 },
  "translate-image": { envVar: "RATE_LIMIT_TRANSLATE_IMAGE_HOURLY", defaultHourly: 20, units: 4 },
  chat: { envVar: "RATE_LIMIT_CHAT_HOURLY", defaultHourly: 60, units: 2 },
  "generate-plan": { envVar: "RATE_LIMIT_GENERATE_PLAN_HOURLY", defaultHourly: 20, units: 5 },
  "recommend-restaurant": { envVar: "RATE_LIMIT_RECOMMEND_HOURLY", defaultHourly: 30, units: 3 },
  "recommend-stops": { envVar: "RATE_LIMIT_RECOMMEND_HOURLY", defaultHourly: 30, units: 3 },
  "daily-picks": { envVar: "RATE_LIMIT_DAILY_PICKS_HOURLY", defaultHourly: 20, units: 5 },
  "pick-image": { envVar: "RATE_LIMIT_PICK_IMAGE_HOURLY", defaultHourly: 20, units: 6 },
};

const DEFAULT_DAILY_UNIT_CAP = 400;

function envInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

let alerted = new Set<string>(); // per-instance, keeps repeat alerts down

function alertDailyCap(userId: string, fn: string, dailyUnits: number, cap: number) {
  const key = `${userId}:${new Date().toISOString().slice(0, 10)}`;
  if (alerted.has(key)) return;
  alerted.add(key);
  // taskId carries the user id here: this alert is about a person, not a task,
  // so the ops link won't resolve to a booking — the lines below carry the detail.
  sendOpsAlert({
    event: "ai_daily_cap",
    subject: "AI daily spend ceiling reached",
    headline: "A user crossed the daily AI ceiling",
    intro:
      "This account has been blocked from further AI calls for the rest of the 24-hour window. Check whether this is heavy legitimate use or abuse.",
    lines: [
      { label: "User", value: userId },
      { label: "Blocked on", value: fn },
      { label: "Cost units used (24h)", value: String(dailyUnits) },
      { label: "Daily ceiling", value: String(cap) },
    ],
    taskId: userId,
  });
}

export type RateLimitOk = { hourlyCount: number; dailyUnits: number };

/**
 * Record one paid call for `userId` and enforce both ceilings.
 * Returns a 429 Response to short-circuit, or usage counters on success.
 * Fails OPEN on infrastructure errors: a limiter outage must not take the
 * product down, and the auth check already keeps anonymous callers out.
 */
export async function enforceRateLimit(
  fn: AiFunctionName,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | RateLimitOk> {
  const limit = LIMITS[fn];
  const hourly = envInt(limit.envVar, limit.defaultHourly);
  const dailyCap = envInt("AI_DAILY_UNIT_CAP", DEFAULT_DAILY_UNIT_CAP);
  const units = envInt(`COST_UNITS_${fn.toUpperCase().replace(/-/g, "_")}`, limit.units);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("rate-limit: service credentials missing, allowing call");
    return { hourlyCount: 0, dailyUnits: 0 };
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await admin.rpc("ai_rate_check", {
    _user_id: userId,
    _function_name: fn,
    _hourly_limit: hourly,
    _cost_units: units,
    _daily_unit_cap: dailyCap,
  });

  if (error) {
    console.error("rate-limit: ai_rate_check failed, allowing call:", error);
    return { hourlyCount: 0, dailyUnits: 0 };
  }

  const result = data as {
    allowed: boolean;
    reason: string | null;
    hourly_count: number;
    daily_units: number;
    retry_after_seconds: number;
  };

  if (result.allowed) {
    return { hourlyCount: result.hourly_count, dailyUnits: result.daily_units };
  }

  const retry = Math.max(1, Number(result.retry_after_seconds) || 60);
  const minutes = Math.max(1, Math.round(retry / 60));

  if (result.reason === "daily") {
    alertDailyCap(userId, fn, result.daily_units, dailyCap);
  }

  const message =
    result.reason === "daily"
      ? "You've reached today's limit for assistant features. It resets within 24 hours — message the concierge if you need something now."
      : `You've made a lot of requests in a short time. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;

  console.warn(
    `rate-limit: blocked ${fn} for ${userId} (reason=${result.reason}, hourly=${result.hourly_count}/${hourly}, daily=${result.daily_units}/${dailyCap})`,
  );

  return new Response(
    JSON.stringify({ code: "rate_limited", reason: result.reason, error: message, message }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retry),
      },
    },
  );
}
