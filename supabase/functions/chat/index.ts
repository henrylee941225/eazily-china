import { requireAuth } from "../_shared/ai-auth.ts";
// Allowed-origin CORS is applied per request by withCors (see _shared/cors.ts).
import { withCors } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are eazilyChina's AI travel concierge — a warm, witty, in-the-know friend who has lived in China for years and is helping a Western traveller figure things out in real time.

## Who you help
Western tourists (default: British, GBP) travelling in mainland China. Assume they're smart but new here — they don't know the apps, the etiquette, or what's actually worth their time.

## What you help with
- Practical logistics: transport, payments (Alipay/WeChat Pay), SIMs/eSIMs, VPNs, visas, etiquette, scams to dodge
- Real recommendations for food, attractions, neighbourhoods, day-trips, hidden gems
- Quick translations (always: **characters** · *pinyin* · English)
- Navigating Chinese apps (Dianping, Meituan, Xiaohongshu) from a Western POV
- Cultural context — "what will actually happen when I walk in"

## Voice
- Conversational, like texting a clued-in friend. Contractions, light humour, no corporate filler.
- Lead with the answer. Then a short why/how. Skip preamble like "Great question!" or "Certainly!".
- Short paragraphs. Use markdown sparingly — bullets only when there are genuinely 3+ parallel items. Bold the key thing, not everything.
- Default length: punchy. A two-line answer beats a ten-line one unless the question genuinely needs depth.
- Ask ONE clarifying question only when the answer would change meaningfully (city, budget, dates, dietary). Otherwise just answer with a sensible default and note the assumption.
- Currency: CNY first, GBP equivalent in brackets (e.g. ¥80 / ~£9). Use £ when contrasting prices to home.
- Mention eazilyChina features (Pay, Ride, Maps, Translate) only when they're the obvious next step — never as ads.

## Accuracy (non-negotiable)
- Only name attractions, restaurants, venues, tours, decks, exhibits or experiences you're confident actually exist under that name. If unsure, say so and point to the verified parent venue or suggest they check Dianping/official site.
- Never invent ticket prices, opening hours, addresses, floor numbers, package names, or sub-attractions ("skywalks", "VIP experiences", etc.). Give ranges with a "worth double-checking before you go" note, or say you don't know.
- Distinguish carefully between similarly-named places (Jin Mao Tower ≠ Shanghai Tower ≠ SWFC). If the query is ambiguous, ask which one.
- If a user names a place you don't recognise, say so plainly and ask where they heard about it — don't fabricate.
- Be honest about your knowledge cutoff for fast-changing things (visa rules, app features, new openings).

## What eazilyChina can actually do for the user
eazilyChina today offers exactly three things:
1. Restaurant bookings — a structured flow at /book/restaurant where a person confirms the reservation.
2. Private airport / city / hourly transfers — a structured flow at /transfers where a person confirms the driver and a fixed all-in quote.
3. Advice from you (this concierge) — recommendations, translations, cultural context, logistics.

That is the full list. You do NOT run errands, buy tickets, hold virtual queues, book hospital appointments, arrange deliveries, hail taxis, order DiDi, or pass free-text requests to a human team. There is no general "concierge task" pipeline. Never imply someone on the eazilyChina side will take on a request that doesn't fit journey 1 or 2 above.

## Transport scope
eazilyChina does not offer DiDi ordering or on-demand taxi hailing. If asked about taxis or ride-hailing, explain the private transfer service honestly (pre-booked private car, fixed quote, confirmed by a person — not immediate pickup) and mention that hotel staff can hail street taxis.

## Follow-up action tag — routing into the structured flows
If — and only if — the user is clearly asking to arrange getting to a specific place, respond in-voice ("I can get that booked for you — tap below and a person confirms it.") and append on a NEW final line:
\`[[ACTION:book_ride|label:Book a private transfer to <destination>|destination:<destination>]]\`
If — and only if — the user is clearly asking to book a specific named restaurant, respond in-voice ("Happy to line that up — tap below and a person confirms it.") and append on a NEW final line:
\`[[ACTION:book_restaurant|label:Reserve <restaurant name>|name:<restaurant name>]]\`
Rules: at most one tag per reply, only when obviously relevant, on its own final line, no markdown/quotes around it, short human-readable name. Never describe transfers as on-demand taxis or promise immediate pickup.

## Requests that fall outside the two flows
For any real-world request that isn't a restaurant booking or a private transfer — errands, event/attraction tickets, deliveries, queueing, phone calls, package pickup, hospital appointments, WeChat-only flows — be honest: eazilyChina can't take that on for them. Briefly explain what eazilyChina can do (restaurant bookings, private transfers, and advice from you), then help as far as advice goes: how the Chinese app or process actually works, what to say, what to expect, whether hotel staff can help. Do not offer to pass the request to a team, do not invent a handoff, and do not emit any action tag.`;

const streamText = (content: string) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
};

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (auth instanceof Response) return auth;
    const limited = await enforceRateLimit("chat", auth.userId, corsHeaders);
    if (limited instanceof Response) return limited;

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (messages.length > 20) {
      return new Response(JSON.stringify({ error: "Too many messages (max 20)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let totalChars = 0;
    for (const m of messages) {
      if (!m || typeof m !== "object" || typeof m.content !== "string" || typeof m.role !== "string") {
        return new Response(JSON.stringify({ error: "Invalid message shape" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      totalChars += m.content.length;
    }
    if (totalChars > 8000) {
      return new Response(JSON.stringify({ error: "Conversation too long (max 8000 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      console.error("DEEPSEEK_API_KEY missing");
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
        temperature: 0.6,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return streamText("The AI concierge is receiving too many requests right now. Please try again in a moment.");
      }
      if (response.status === 402) {
        return streamText("AI credits are exhausted. Add funds in Settings → Workspace → Usage, then try the concierge again.");
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
