// Shared Stripe helper that routes ALL Stripe API calls through the
// Lovable connector gateway. This is required: direct calls to
// api.stripe.com will fail because the project doesn't have a raw
// Stripe secret key — only a gateway-scoped key.

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/stripe";

export type StripeEnv = "sandbox" | "live";

export const stripeKeyForEnv = (env: StripeEnv): string => {
  const name = env === "live" ? "STRIPE_LIVE_API_KEY" : "STRIPE_SANDBOX_API_KEY";
  const key = Deno.env.get(name);
  if (!key) throw new Error(`${name} is not configured`);
  return key;
};

export const lovableApiKey = (): string => {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
};

/**
 * Make a request to the Stripe API via the Lovable connector gateway.
 * Body is sent as application/x-www-form-urlencoded (Stripe's standard).
 */
export const stripeRequest = async <T = unknown>(
  env: StripeEnv,
  path: string,
  init: { method?: string; body?: Record<string, unknown> } = {}
): Promise<T> => {
  const stripeKey = stripeKeyForEnv(env);
  const lovableKey = lovableApiKey();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": stripeKey,
  };

  let body: string | undefined;
  if (init.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = encodeForm(init.body);
  }

  const res = await fetch(`${GATEWAY_BASE}${path}`, {
    method: init.method ?? "POST",
    headers,
    body,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `Stripe gateway call failed [${res.status}] ${path}: ${JSON.stringify(data)}`
    );
  }

  return data as T;
};

// Stripe expects nested params encoded with bracket notation, e.g.
// `line_items[0][price_data][currency]=gbp`. This helper supports
// objects, arrays, primitives.
const encodeForm = (input: Record<string, unknown>): string => {
  const parts: string[] = [];
  const append = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => append(`${key}[${i}]`, v));
    } else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        append(`${key}[${k}]`, v);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  };
  for (const [k, v] of Object.entries(input)) append(k, v);
  return parts.join("&");
};