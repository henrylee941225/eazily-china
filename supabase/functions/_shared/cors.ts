// Shared CORS policy for every edge function.
//
// Previously every function replied with `Access-Control-Allow-Origin: *`,
// so any web page could call them from a browser. Now the request Origin is
// matched against an allow-list and echoed back only when it matches; other
// origins get the canonical app origin, which makes the browser block the
// response.
//
// Note on threat model: CORS is a browser control only. It does not stop a
// scripted caller (curl and friends) — that is what the auth checks in
// `ai-auth.ts` and the rate limits in `rate-limit.ts` are for.

const PRIMARY_ORIGIN = "https://app.eazilychina.com";

const ALLOWED_PATTERNS: RegExp[] = [
  // Production custom domain and published Lovable domains (incl. previews).
  /^https:\/\/app\.eazilychina\.com$/,
  /^https:\/\/([a-z0-9-]+\.)*eazilychina\.com$/,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/,
  /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.dev$/,
  // Local development.
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  // Native iOS/Android webview shells (Median / Capacitor).
  /^capacitor:\/\/localhost$/,
  /^ionic:\/\/localhost$/,
  /^file:\/\/$/,
  /^file:\/\/localhost$/,
  /^median:\/\/[a-z0-9.-]*$/i,
  /^app:\/\/[a-z0-9.-]*$/i,
];

// Extra origins, comma separated, without changing code.
function extraAllowed(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // no Origin header: not a browser request
  if (origin === "null") return true; // opaque origin from a native webview
  if (extraAllowed().includes(origin)) return true;
  return ALLOWED_PATTERNS.some((re) => re.test(origin));
}

const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/** CORS headers for this specific request. Use in every response, errors included. */
export function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  // Some native webviews (Median included) send the literal string "null" for
  // an opaque origin. Echoing "null" back is what the webview expects; sending
  // the canonical app origin instead would make it block its own response.
  const allow =
    origin === "null" ? "null" : origin && isAllowedOrigin(origin) ? origin : PRIMARY_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** Standard preflight response. */
export function preflight(req: Request): Response {
  return new Response("ok", { status: 200, headers: corsFor(req) });
}

/**
 * Wraps a handler so every response carries the per-request CORS headers and
 * preflights are answered centrally. Inner handlers may keep their own
 * `corsHeaders` object — these values win.
 */
export function withCors(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const cors = corsFor(req);
    if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
