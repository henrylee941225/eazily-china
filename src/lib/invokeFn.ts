import { supabase } from "@/integrations/supabase/client";

/**
 * Wrapper around supabase.functions.invoke that surfaces the edge function's
 * JSON `{ error: "..." }` body on non-2xx responses, instead of the generic
 * "Edge Function returned a non-2xx status code" string supabase-js returns.
 */
export async function invokeFn<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string; status?: number } | null }> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (!error) return { data: data ?? null, error: null };

  let message = "";
  let status: number | undefined;
  const ctx = (error as { context?: unknown }).context;
  // FunctionsHttpError.context is the raw Response; clone so callers can still read it.
  if (ctx instanceof Response) {
    status = ctx.status;
    try {
      const text = await ctx.clone().text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          message = parsed.error || parsed.message || text;
        } catch {
          message = text;
        }
      }
    } catch {
      /* ignore body-read failures */
    }
  }
  if (!message && data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    message = String((data as { error?: unknown }).error ?? "");
  }
  if (!message) message = (error as { message?: string }).message ?? "Request failed";
  return { data: null, error: { message, status } };
}