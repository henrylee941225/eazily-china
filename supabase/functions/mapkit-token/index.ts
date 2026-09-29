// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/ai-auth.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

Deno.serve(withCors(async (req) => {
  // Signed-in users only: this mints an Apple MapKit credential billed to us.
  const auth = await requireAuth(req, corsHeaders);
  if (auth instanceof Response) return auth;


  try {
    const teamId = Deno.env.get("MAPKIT_TEAM_ID");
    const keyId = Deno.env.get("MAPKIT_KEY_ID");
    const privateKeyPem = Deno.env.get("MAPKIT_PRIVATE_KEY");

    if (!teamId || !keyId || !privateKeyPem) {
      return new Response(JSON.stringify({ error: "MapKit secrets not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keyData = pemToArrayBuffer(privateKeyPem);
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );

    // Apple MapKit JS tokens are bearer credentials for our whole MapKit
    // service usage (map tiles/views, Search, Geocode, Directions) billed
    // against the team's daily quota. Apple supports exactly two restrictions:
    //   - `exp`: lifetime, max 20160 minutes; we keep it short (default 15 min).
    //   - `origin`: the single web origin allowed to use the token; Apple
    //     rejects use from anywhere else. Optional, because native webview
    //     shells do not present a matching web origin.
    const now = Math.floor(Date.now() / 1000);
    const ttlMinutes = Math.min(
      1440,
      Math.max(5, Number(Deno.env.get("MAPKIT_TOKEN_TTL_MINUTES") ?? "15") || 15),
    );
    const scopedOrigin = Deno.env.get("MAPKIT_ALLOWED_ORIGIN")?.trim();
    const jwt = await create(
      { alg: "ES256", kid: keyId, typ: "JWT" },
      {
        iss: teamId,
        iat: now,
        exp: now + ttlMinutes * 60,
        ...(scopedOrigin ? { origin: scopedOrigin } : {}),
      },
      cryptoKey,
    );

    return new Response(jwt, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (e) {
    console.error("mapkit-token error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
