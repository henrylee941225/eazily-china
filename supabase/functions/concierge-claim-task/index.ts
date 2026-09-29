import { requireAuth } from "../_shared/ai-auth.ts";
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Must be a concierge_assistant
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.userId)
      .eq("role", "concierge_assistant")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Not an assistant" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const taskId = String(body?.task_id ?? "");
    if (!taskId) {
      return new Response(JSON.stringify({ error: "task_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("assistant_profiles").select("display_name").eq("user_id", auth.userId).maybeSingle();

    // Read the task first so we can decide the correct claim shape.
    // - Standard pending tasks: claim + flip to `assigned`.
    // - Authorised/paid transfer tasks parked in `pay_to_confirm`: claim
    //   without changing status (the money state gates the next step).
    const { data: existing } = await admin
      .from("concierge_tasks")
      .select("id,status,assistant_id,category,authorized_at,paid_at")
      .eq("id", taskId)
      .maybeSingle();
    if (!existing) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (existing.assistant_id && existing.assistant_id !== auth.userId) {
      return new Response(
        JSON.stringify({ error: "Already claimed by another assistant" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isTransferMoneyHeld =
      existing.category === "transfer" &&
      existing.status === "pay_to_confirm" &&
      (existing.authorized_at || existing.paid_at);

    let updateBuilder = admin
      .from("concierge_tasks")
      .update(
        isTransferMoneyHeld
          ? { assistant_id: auth.userId }
          : { assistant_id: auth.userId, status: "assigned" },
      )
      .eq("id", taskId)
      .is("assistant_id", null);
    updateBuilder = isTransferMoneyHeld
      ? updateBuilder.eq("status", "pay_to_confirm")
      : updateBuilder.eq("status", "pending");

    const { data: updated, error } = await updateBuilder.select().maybeSingle();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!updated) {
      // Lost the race — someone else claimed between read and write.
      return new Response(
        JSON.stringify({ error: "Already claimed by another assistant" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin.from("concierge_messages").insert({
      task_id: taskId,
      sender: "system",
      body: `${profile?.display_name || "Your assistant"} has picked up your task.`,
    });

    return new Response(JSON.stringify({ task: updated }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("concierge-claim-task error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
