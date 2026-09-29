/**
 * Detect a "pass required" reply from any AI-gated edge function.
 *
 * The server side (see `supabase/functions/_shared/ai-auth.ts` and
 * `concierge-create-task/index.ts`) intentionally returns HTTP 200 with a
 * JSON body `{ code: "pass_required", ... }` and an `X-Pass-Required: 1`
 * header. This keeps the expected "no entitlement" path out of the
 * platform's edge-function error instrumentation while preserving the
 * paywall UX. Older 402 responses are still detected for compatibility.
 */

/** True when a `supabase.functions.invoke` success `data` payload is the
 *  pass_required marker. Use this in preference to the legacy error path. */
export function isPassRequiredData(data: unknown): boolean {
  return !!(data && typeof data === "object" && (data as { code?: unknown }).code === "pass_required");
}

/** Legacy: still detect a rejected invoke whose Response body carries the
 *  marker (kept so pre-deploy clients don't crash mid-rollout). */
export async function isPassRequiredError(err: unknown): Promise<boolean> {
  if (!err) return false;
  const ctx = (err as { context?: Response }).context;
  if (!ctx || typeof ctx.clone !== "function") return false;
  if (ctx.headers?.get?.("X-Pass-Required") === "1") return true;
  try {
    const parsed = await ctx.clone().json();
    return parsed?.code === "pass_required";
  } catch {
    return false;
  }
}

/** Detect a `fetch` Response carrying the marker. Works for both the new
 *  200 + header path and the legacy 402 path. */
export async function isPassRequiredResponse(resp: Response): Promise<boolean> {
  if (resp.headers.get("X-Pass-Required") === "1") return true;
  if (resp.status !== 402 && resp.status !== 200) return false;
  const contentType = resp.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) return false;
  try {
    const parsed = await resp.clone().json();
    return parsed?.code === "pass_required";
  } catch {
    return false;
  }
}
