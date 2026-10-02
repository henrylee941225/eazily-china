import { withCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/ai-auth.ts";
import { buildAmapRequest, type SearchRequest } from "./request.ts";

const headers = { "Content-Type": "application/json" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(withCors(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = await requireAuth(req, headers);
  if (auth instanceof Response) return auth;

  let body: SearchRequest;
  try {
    body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request body" }, 400);
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  const key = Deno.env.get("AMAP_WEB_SERVICE_KEY");
  if (!key) return json({ error: "AMap search is not configured" }, 503);
  const url = buildAmapRequest(body, key);
  if (!url) return json({ error: "Invalid search request" }, 400);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return json({ error: "AMap search is unavailable" }, 502);
    const data = await response.json();
    if (data?.status !== "1") {
      console.warn("AMap POI request failed", data?.infocode, data?.info);
      return json({ error: "AMap search is unavailable", code: data?.infocode }, 502);
    }
    if (body.action === "suggest") return json({ tips: Array.isArray(data.pois) ? data.pois : [] });
    return json({ pois: Array.isArray(data.pois) ? data.pois : [] });
  } catch {
    return json({ error: "AMap search is unavailable" }, 502);
  }
}));
