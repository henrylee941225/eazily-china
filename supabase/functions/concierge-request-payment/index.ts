import { requireAuth } from "../_shared/ai-auth.ts";
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
// Ops action — assigned assistant posts a gentle "nudge to pay" reminder
// into the task thread. The payment card renders automatically as soon as
// the task is in pay_to_confirm with a locked charge; this endpoint is an
// optional prompt, not a gate.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: "¥", USD: "$", EUR: "€", GBP: "£", HKD: "HK$", JPY: "¥",
};

const formatMoney = (cents: number, currency: string): string => {
  const cur = (currency || "CNY").toUpperCase();
  const symbol = CURRENCY_SYMBOL[cur] ?? `${cur} `;
  const isZeroDecimal = cur === "JPY";
  const value = isZeroDecimal ? Math.round(cents) : (cents / 100);
  const formatted = isZeroDecimal
    ? value.toLocaleString("en-GB")
    : value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${formatted}`;
};

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => null);
    const taskId = String(body?.task_id ?? "");
    if (!taskId) {
      return new Response(JSON.stringify({ error: "task_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: task } = await admin
      .from("concierge_tasks")
      .select("id,assistant_id,status,price_cents,currency,charge_amount_cents,charge_currency,quoted_gbp_cents,paid_at")
      .eq("id", taskId)
      .maybeSingle();
    if (!task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (task.assistant_id !== auth.userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (task.status !== "pay_to_confirm" || !task.price_cents || task.paid_at) {
      return new Response(JSON.stringify({ error: "Task is not awaiting payment" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Charge amount is what the customer sees / pays. GBP is shown alongside
    // for reference (skip when they match).
    const chargeCents = Number(task.charge_amount_cents ?? task.price_cents);
    const chargeCurrency = String(task.charge_currency ?? task.currency ?? "GBP");
    const gbpCents = Number(
      task.quoted_gbp_cents
        ?? (String(task.currency).toUpperCase() === "GBP" ? task.price_cents : 0),
    );
    const chargeLabel = formatMoney(chargeCents, chargeCurrency);
    const messageBody =
      `Just a nudge — your car is still held. Tap Pay ${chargeLabel} below whenever you're ready.`;

    const { error } = await admin.from("concierge_messages").insert({
      task_id: taskId,
      sender: "system",
      body: messageBody,
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("concierge-request-payment error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
