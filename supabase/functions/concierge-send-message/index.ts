import { requireAuth } from "../_shared/ai-auth.ts";
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { sendOpsAlert } from "../_shared/ops-alert.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => null);
    const taskId = String(body?.task_id ?? "");
    const text = String(body?.body ?? "").trim().slice(0, 2000);
    if (!taskId || !text) {
      return new Response(JSON.stringify({ error: "task_id and body required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: task, error: te } = await admin
      .from("concierge_tasks")
      .select("id,user_id,assistant_id,status,category")
      .eq("id", taskId)
      .maybeSingle();
    if (te || !task) {
      return new Response(JSON.stringify({ error: "task not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Transfers are driven by structured status/change flows, but the booking's
    // own message thread stays open so a customer can reach a person about
    // their booking without the Trip Pass-gated AI concierge chat. Ownership is
    // enforced below; this function is requireAuth only.
    const isUser = task.user_id === auth.userId;
    const isAssistant = task.assistant_id === auth.userId;
    if (!isUser && !isAssistant) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sender = isAssistant ? "assistant" : "user";
    const { data: msg, error } = await admin
      .from("concierge_messages")
      .insert({ task_id: taskId, sender, sender_id: auth.userId, body: text })
      .select()
      .single();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First reply from the assistant → user-facing "A person is confirming"
    if (isAssistant && task.status === "assigned") {
      await admin.from("concierge_tasks").update({ status: "confirming" }).eq("id", taskId);
    }

    // Ops alert on user-sent messages against an active task. Assistant/system
    // messages never alert. Terminal statuses are skipped.
    if (
      isUser &&
      !["completed", "cancelled", "unavailable"].includes(task.status)
    ) {
      try {
        const { data: t2 } = await admin
          .from("concierge_tasks")
          .select("summary")
          .eq("id", taskId)
          .maybeSingle();
        const title = (t2?.summary ?? "concierge task").slice(0, 120);
        sendOpsAlert({
          event: "new_message",
          subject: `New message on ${title}`,
          headline: `New message on ${title}`,
          intro: text.slice(0, 300),
          lines: [{ label: "From", value: "Traveller" }],
          taskId,
          category: task.category,
        });
      } catch (e) {
        console.warn("ops-alert dispatch (message) failed:", e);
      }
    }

    return new Response(JSON.stringify({ message: msg }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("concierge-send-message error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
