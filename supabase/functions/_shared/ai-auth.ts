import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

/**
 * Verify the caller's JWT and confirm they have an active AI entitlement
 * (Trip Pass) via the `has_ai_access` SQL function.
 *
 * Returns null on success, or a Response (401 / 403 / 500) to short-circuit.
 */
export async function requireAiAccess(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token).catch((error) => ({
    data: null,
    error,
  }));
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claims.claims.sub as string;

  // Check entitlement server-side via security-definer SQL function.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: hasAccess, error: rpcErr } = await adminClient.rpc("has_ai_access", {
    user_uuid: userId,
  });
  if (rpcErr) {
    console.error("has_ai_access rpc error:", rpcErr);
    return new Response(JSON.stringify({ error: "Entitlement check failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!hasAccess) {
    return new Response(
      JSON.stringify({
        code: "pass_required",
        error: "NO_ENTITLEMENT",
        message: "An active Trip Pass is required for this feature.",
      }),
      // Intentional 200 with a `pass_required` marker so this expected
      // "no entitlement" reply is not surfaced as an edge-function error
      // by platform log/runtime instrumentation. Clients detect the
      // marker via `isPassRequiredResponse` / `isPassRequiredData` and
      // open the paywall — same UX as before.
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Pass-Required": "1",
        },
      },
    );
  }

  return { userId };
}

/**
 * Verify the caller's JWT only (no entitlement check). Use for features that
 * are available to all signed-in users, like FX rates.
 */
export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token).catch((error) => ({
    data: null,
    error,
  }));
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: claims.claims.sub as string };
}

/**
 * Restaurant-journey gate. Matches `concierge-create-task`: allow when the
 * caller has an active pass OR has zero prior restaurant tasks (excluding
 * cancelled / unavailable). Used by recommend-restaurant so a first-time
 * passless user gets their recommendation and books it free — the paywall
 * then fires at booking submission from the second journey onwards.
 */
export async function requireRestaurantAccess(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string } | Response> {
  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const [{ data: hasAccess }, { count: priorCount, error: countErr }] = await Promise.all([
    admin.rpc("has_ai_access", { user_uuid: auth.userId }),
    admin
      .from("concierge_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId)
      .eq("category", "restaurant_reservation")
      .not("status", "in", "(cancelled,unavailable)"),
  ]);
  if (countErr) {
    console.error("restaurant gate count failed:", countErr);
    return new Response(JSON.stringify({ error: "Couldn't verify access" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!hasAccess && (priorCount ?? 0) > 0) {
    return new Response(
      JSON.stringify({
        code: "pass_required",
        error: "NO_ENTITLEMENT",
        message: "An active Trip Pass is required for this feature.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Pass-Required": "1",
        },
      },
    );
  }
  return { userId: auth.userId };
}