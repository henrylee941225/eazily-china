import { supabase } from "@/integrations/supabase/client";

export type CancelResult = { ok: boolean; message?: string };

const GENERIC = "Couldn't cancel. Try again.";

/**
 * Cancels a concierge task and surfaces the server's policy message when the
 * 24h transfer cancellation window has closed (409 cancellation_window_closed).
 * Never returns a raw error string to the UI.
 */
export const cancelTaskWithPolicy = async (taskId: string): Promise<CancelResult> => {
  try {
    const { error } = await supabase.functions.invoke("concierge-update-task", {
      body: { task_id: taskId, status: "cancelled" },
    });
    if (!error) return { ok: true };

    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      try {
        const payload = await res.clone().json();
        if (payload && typeof payload.message === "string" && payload.message.trim()) {
          return { ok: false, message: payload.message };
        }
      } catch {
        /* fall through to the generic message */
      }
    }
    return { ok: false, message: GENERIC };
  } catch {
    return { ok: false, message: GENERIC };
  }
};
