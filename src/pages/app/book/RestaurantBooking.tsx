import { useEffect, useMemo, useState } from "react";
import { canOfferCardFallback } from "@/integrations/median/revenuecat";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, BookOpen, Calendar, Check, ChevronRight, Clock, Loader2, Minus, Plus,
  Search, Sparkles, Utensils, UserRound,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { TaskPaymentDialog } from "@/components/concierge/TaskPaymentDialog";
import { TripDatesNudge } from "@/components/trip/TripDatesNudge";
import { PassExtendedNotice } from "@/components/trip/PassExtendedNotice";
import { isPassRequiredData, isPassRequiredError } from "@/lib/passRequired";

const RESUME_KEY = "restaurant-booking-resume-payload";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£", USD: "$", EUR: "€", CNY: "¥", HKD: "HK$", JPY: "¥",
};

const formatCharge = (cents: number, currency: string): string => {
  const cur = (currency || "GBP").toUpperCase();
  const symbol = CURRENCY_SYMBOL[cur] ?? `${cur} `;
  const zeroDecimal = cur === "JPY";
  const value = zeroDecimal ? Math.round(cents) : cents / 100;
  return `${symbol}${value.toLocaleString("en-GB", {
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  })}`;
};

type CreatedTask = {
  id: string;
  status?: string | null;
  charge_amount_cents?: number | null;
  charge_currency?: string | null;
  price_cents?: number | null;
  currency?: string | null;
};

// A task returned in `pay_to_confirm` carries the booking fee; the traveller
// must authorise before it reaches ops.
const feeLabelFor = (task: CreatedTask): string =>
  formatCharge(
    Number(task.charge_amount_cents ?? task.price_cents ?? 0),
    String(task.charge_currency ?? task.currency ?? "GBP"),
  );

// Booking service copy shown on the charge screen. `newSet` is true when the
// traveller has completed a previous set of bookings and this charge starts a
// fresh one — no implication that anything went wrong.
const bookingServiceCopy = (amountLabel: string, newSet: boolean) => ({
  heading: "Our team will book this for you",
  subline: "A person contacts the restaurant and holds the table in your name.",
  lines: [
    `${amountLabel} — charged only when the restaurant confirms your table.`,
    newSet
      ? "Your previous charge covered five bookings. This one covers the next five."
      : "Covers up to five bookings for your trip.",
  ],
});
import { getAmapCityCode } from "@/lib/amapCities";
import { resolveAmapSuggestion, searchAmapSuggestions } from "@/lib/amapPoiSearch";
import type { AutocompleteSuggestion } from "@/lib/mapTypes";
import {
  DINING_BUDGET_LABEL,
  DINING_BUDGET_OPTIONS,
  type DiningBudget,
} from "@/data/profileOptions";
import { triggerHaptic } from "@/integrations/median";

// -----------------------------------------------------------------------------
// Restaurant booking journey — /book/restaurant
// Two paths, shared finish:
//  A. "I know the place"  → search real city venues (fallback to free-text)
//  B. "Help me choose"    → capture prefs; concierge picks the venue
// Both submit through concierge-create-task with category
// "restaurant_reservation" and details_json.kind = "restaurant".
// Nothing about the booking surface, statuses, or change-request flow changes.
// -----------------------------------------------------------------------------

type Step = "entry" | "search" | "prefs" | "recommend" | "confirm";
type Path = "known" | "choose";

type Venue = {
  name: string;
  name_zh?: string;
  address?: string;
  meta?: string;
  lat?: number;
  lng?: number;
  source: "local" | "amap";
  district?: string;
  _suggestion?: AutocompleteSuggestion;
};

// A concise, model-facing candidate derived from the curated pick list.
// The AI is only ever allowed to pick an id from this list; the server
// re-validates. See supabase/functions/recommend-restaurant.
type AiCandidate = {
  id: string;
  name: string;
  name_zh?: string;
  district?: string;
  price?: string;
  tag?: string;
  blurb?: string;
};

type AiRecommendation = {
  current: AiCandidate;
  reason: string;
  alternative: AiCandidate | null;
};

// Total cap across local and AMap results.
const MAX_RESULTS = 8;

const AREAS = [
  "The Bund",
  "Xintiandi",
  "Jing'an",
  "Former French Concession",
  "Near me",
];
const CUISINES = [
  "Any", "Shanghainese", "Cantonese", "Sichuan", "Seafood",
  "Dim sum", "Hot pot", "Modern", "Vegetarian",
];
const VIBES = ["Smart", "Romantic", "Lively", "Quiet"] as const;

// Tomorrow, formatted for <input type="date">
const tomorrowIso = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "2026-05-22" -> "Wed 22 May"
const humanDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.valueOf())) return iso;
  return d.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
};

// "19:30" -> "7:30pm"
const humanTime = (hhmm: string): string => {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")}${period}`;
};

const budgetLabel = (b: DiningBudget | null): string =>
  b ? DINING_BUDGET_LABEL[b] : "¥¥";

// -----------------------------------------------------------------------------

const RestaurantBooking = () => {
  const navigate = useNavigate();
  const { city } = useCity();
  const { profile, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [step, setStep] = useState<Step>("entry");
  const [path, setPath] = useState<Path>("choose");

  // Path A state
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Venue | null>(null);

  // Path B state — pre-filled from saved preferences where possible.
  const [cuisine, setCuisine] = useState<string>("Any");
  const [budget, setBudget] = useState<DiningBudget>(
    (profile?.dining_budget as DiningBudget | undefined) ?? "mid",
  );
  const [area, setArea] = useState<string>(AREAS[0]);
  const [vibe, setVibe] = useState<(typeof VIBES)[number]>("Smart");

  // Path B AI recommendation state — only relevant after the prefs step.
  const [aiRec, setAiRec] = useState<AiRecommendation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [shownIds, setShownIds] = useState<string[]>([]);

  // Shared booking-details state
  const [date, setDate] = useState<string>(tomorrowIso());
  const [time, setTime] = useState<string>("19:30");
  const [party, setParty] = useState<number>(2);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  // Booking fee — the created task comes back in `pay_to_confirm` when the
  // traveller has no active booking entitlement. Authorise (manual capture)
  // in place, then continue to the booking.
  const [feeTask, setFeeTask] = useState<
    { id: string; label: string; note?: string; newSet?: boolean } | null
  >(null);
  // True while replaying a booking request that was interrupted.
  const [resuming, setResuming] = useState(false);

  // Trip Pass gate — second request onwards with no active pass sees the pass
  // screen before the booking form. The first request is free and never sees
  // it. The server is authoritative; this only decides what we show.
  const [passGate, setPassGate] = useState<"checking" | "needed" | "clear">("checking");
  // "?pass=card" = web fallback chosen on /trip-pass (no store in a browser);
  // the existing card-hold path then applies after the request is prepared.
  const [passAcknowledged] = useState(
    () => searchParams.get("pass") === "card" && canOfferCardFallback(),
  );
  useEffect(() => {
    if (!user?.id) { setPassGate("clear"); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("restaurant_access_state", { user_uuid: user.id });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      setPassGate(row?.has_pass || row?.free_booking_available ? "clear" : "needed");
    })();
    return () => { cancelled = true; };
  }, [user?.id, profile]);
  const showPassIntro = passGate === "needed" && !passAcknowledged;

  // True when the user entered this flow via a directory prefill; used to
  // route back to the directory instead of a blank search step.
  const [enteredViaPrefill, setEnteredViaPrefill] = useState(false);

  // Copy-only signal: has this traveller already completed a set of bookings?
  // Used to word the charge screen as "the next five" rather than "your trip".
  const hasPriorSet = async (): Promise<boolean> => {
    if (!user?.id) return false;
    const { count } = await supabase
      .from("booking_entitlements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    return (count ?? 0) > 0;
  };

  // Prefill from directory ("Browse our restaurant guide" → venue detail →
  // "Book this restaurant"). Enters the flow at the confirm step with the
  // venue already selected, mirroring the "I know the place" path.
  useEffect(() => {
    const venueName = searchParams.get("venueName");
    // Fallback path: the venue could not be resolved by slug, so the flow
    // opens on the search step with the name pre-filled instead of showing an
    // empty selection.
    const venueSearch = searchParams.get("venueSearch");
    if (!venueName) {
      if (!venueSearch) return;
      setPath("known");
      setQuery(venueSearch);
      setStep("search");
      const searchNext = new URLSearchParams(searchParams);
      searchNext.delete("venueSearch");
      setSearchParams(searchNext, { replace: true });
      return;
    }
    const venueNameZh = searchParams.get("venueNameZh") ?? undefined;
    const venueArea = searchParams.get("venueArea") ?? undefined;
    const venueAddress = searchParams.get("venueAddress") ?? undefined;
    setPath("known");
    setSelected({
      name: venueName,
      name_zh: venueNameZh || undefined,
      district: venueArea || undefined,
      address: venueAddress || undefined,
      source: "local",
    });
    setStep("confirm");
    setEnteredViaPrefill(true);
    // Clear params so browser back / refresh doesn't re-trigger.
    const next = new URLSearchParams(searchParams);
    next.delete("venueName");
    next.delete("venueNameZh");
    next.delete("venueArea");
    next.delete("venueAddress");
    next.delete("venueSlug");
    next.delete("venueSearch");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume after paywall purchase — replay the last submit payload directly.
  // The user was interrupted mid-flow with the paywall; after buying a pass,
  // /pricing navigates back to /book/restaurant?resume=1 and we finish the
  // request they'd already prepared.
  useEffect(() => {
    if (searchParams.get("resume") !== "1") return;
    const raw = (() => {
      try { return sessionStorage.getItem(RESUME_KEY); } catch { return null; }
    })();
    if (!raw) return;
    let payload: Record<string, unknown> | null = null;
    try { payload = JSON.parse(raw); } catch { /* ignore */ }
    if (!payload) return;
    const next = new URLSearchParams(searchParams);
    next.delete("resume");
    setSearchParams(next, { replace: true });
    (async () => {
      setSubmitting(true);
      setResuming(true);
      try {
        // Entitlement state can land a beat after payment confirms. Retry for
        // ~10s before giving up.
        const deadline = Date.now() + 10_000;
        let taskId: string | undefined;
        for (;;) {
          const { data, error } = await supabase.functions.invoke("concierge-create-task", {
            body: payload,
          });
          const gated =
            isPassRequiredData(data) || (error ? await isPassRequiredError(error) : false);
          if (gated) {
            if (Date.now() < deadline) {
              await new Promise((r) => setTimeout(r, 1200));
              continue;
            }
            try { sessionStorage.setItem(RESUME_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
            toast.error("Couldn't send the request. Try again in a moment.");
            return;
          }
          if (error) throw error;
          const created = (data as { task?: CreatedTask })?.task;
          taskId = created?.id;
          if (created && created.status === "pay_to_confirm" && taskId) {
            try { sessionStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
            setFeeTask({ id: taskId, label: feeLabelFor(created), newSet: await hasPriorSet() });
            return;
          }
          break;
        }
        if (!taskId) throw new Error("No task id returned");
        try {
          sessionStorage.setItem("booking-request-sent", taskId);
          sessionStorage.removeItem(RESUME_KEY);
        } catch { /* ignore */ }
        toast.success("Request sent — our team will confirm your table.");
        navigate(`/bookings/${taskId}`);
      } catch (e) {
        console.error(e);
        toast.error("Couldn't finish your booking. Please try again from the confirm step.");
      } finally {
        setSubmitting(false);
        setResuming(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Keep prefs step aligned with saved profile whenever it lands.
    if (profile?.dining_budget) setBudget(profile.dining_budget as DiningBudget);
  }, [profile?.dining_budget]);

  // Real venue index (deduplicated on English name) built from CityData.
  // Path A only surfaces places the app actually knows about locally; users
  // can also type any restaurant name freely and continue.
  const venueIndex: Venue[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Venue[] = [];
    for (const p of city.places) {
      if (p.category !== "food") continue;
      const key = p.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: p.name, name_zh: p.nameZh, address: p.address, source: "local" });
    }
    for (const pk of city.picks) {
      if (!pk.meta?.includes("¥")) continue; // treat "¥/¥¥/¥¥¥" tagged picks as venues
      const key = pk.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: pk.title,
        name_zh: pk.title_zh,
        meta: pk.meta,
        district: (pk as { district?: string }).district,
        source: "local",
      });
    }
    return out;
  }, [city]);

  // Model-facing candidate list built from the same curated picks. We only
  // include entries that carry a price marker (¥/¥¥/¥¥¥/¥¥¥¥) so we never
  // hand the model a non-restaurant.
  const aiCandidates: AiCandidate[] = useMemo(() => {
    const out: AiCandidate[] = [];
    const seen = new Set<string>();
    for (const pk of city.picks) {
      if (!pk.meta?.includes("¥")) continue;
      const id = pk.title;
      if (seen.has(id)) continue;
      seen.add(id);
      const priceMatch = pk.meta.match(/¥+/);
      out.push({
        id,
        name: pk.title,
        name_zh: (pk as { title_zh?: string }).title_zh,
        district: (pk as { district?: string }).district,
        price: priceMatch ? priceMatch[0] : undefined,
        tag: pk.tag,
        blurb: pk.blurb,
      });
    }
    return out;
  }, [city]);

  const candidateById = useMemo(() => {
    const m = new Map<string, AiCandidate>();
    for (const c of aiCandidates) m.set(c.id, c);
    return m;
  }, [aiCandidates]);

  // Merged async search: local venues first, then AMap suggestions.
  const [results, setResults] = useState<Venue[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }

    const ql = q.toLowerCase();
    const local = venueIndex
      .filter((v) =>
        v.name.toLowerCase().includes(ql) ||
        (v.name_zh ?? "").toLowerCase().includes(ql),
      )
      .slice(0, MAX_RESULTS);

    // Show local matches immediately while AMap runs.
    setResults(local);
    setSearching(true);

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const suggestions = await searchAmapSuggestions(q, {
          center: { latitude: city.center[0], longitude: city.center[1] },
          city: getAmapCityCode(city.id),
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        const seen = new Set(local.map((v) => v.name.toLowerCase()));
        const mapped: Venue[] = [];
        const remaining = Math.max(0, MAX_RESULTS - local.length);
        for (const s of suggestions) {
          const primary = s.displayLines[0]?.trim();
          if (!primary) continue;
          const key = primary.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          mapped.push({
            name: primary,
            address: s.displayLines.slice(1).join(", ") || undefined,
            lat: s.coordinate?.latitude,
            lng: s.coordinate?.longitude,
            source: "amap",
            _suggestion: s,
          });
          if (mapped.length >= remaining) break;
        }
        setResults([...local, ...mapped]);
      } catch {
        /* keep local results */
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, venueIndex, city]);

  const canAddFreeText = query.trim().length >= 2;

  // ---------------------------------------------------------------------------
  // AI recommendation fetch (Path B). Never blocks the flow: on any failure
  // we surface the honest "a person will pick the spot" card carrying the
  // preferences into the request.
  const requestRecommendation = async (exclude: string[]) => {
    setAiLoading(true);
    setAiFailed(false);
    try {
      const { data, error } = await supabase.functions.invoke("recommend-restaurant", {
        body: {
          preferences: {
            cuisine,
            budget,
            area,
            vibe,
            dietary_needs: profile?.dietary_needs ?? [],
            spice_level: profile?.spice_level ?? null,
          },
          venues: aiCandidates,
          exclude_ids: exclude,
        },
      });
      if (isPassRequiredData(data)) {
        setAiFailed(false);
        setAiRec(null);
        return;
      }
      if (error) {
        if (await isPassRequiredError(error)) {
          setAiFailed(false);
          setAiRec(null);
          return;
        }
        throw error;
      }
      const rec = data as {
        venue_id?: string; reason?: string; alternative_id?: string | null;
      };
      const chosen = rec.venue_id ? candidateById.get(rec.venue_id) : undefined;
      if (!chosen) throw new Error("bad_selection");
      const alt = rec.alternative_id ? candidateById.get(rec.alternative_id) ?? null : null;
      setAiRec({ current: chosen, reason: rec.reason ?? "", alternative: alt });
      setShownIds(Array.from(new Set([...exclude, chosen.id])));
    } catch (e) {
      console.error("recommend-restaurant failed:", e);
      setAiRec(null);
      setAiFailed(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleShowAnother = async () => {
    if (!aiRec) { await requestRecommendation(shownIds); return; }
    const currentId = aiRec.current.id;
    if (aiRec.alternative) {
      const alt = aiRec.alternative;
      const nextShown = Array.from(new Set([...shownIds, currentId, alt.id]));
      // Optimistic swap so the UI reacts instantly.
      setAiRec({ current: alt, reason: "", alternative: null });
      setShownIds(nextShown);
      await requestRecommendation(nextShown);
    } else {
      const nextShown = Array.from(new Set([...shownIds, currentId]));
      setShownIds(nextShown);
      await requestRecommendation(nextShown);
    }
  };

  // Kick off the first recommendation on entering the recommend step.
  useEffect(() => {
    if (step !== "recommend") return;
    if (aiRec || aiLoading || aiFailed) return;
    if (aiCandidates.length === 0) { setAiFailed(true); return; }
    void requestRecommendation([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Reset any stale recommendation when the user re-opens the prefs step or
  // changes their picks; ensures the next entry to "recommend" refetches.
  useEffect(() => {
    setAiRec(null);
    setAiFailed(false);
    setShownIds([]);
  }, [cuisine, budget, area, vibe]);

  const acceptAiRecommendation = () => {
    if (!aiRec) return;
    const v = aiRec.current;
    triggerHaptic("impactLight");
    setSelected({
      name: v.name,
      name_zh: v.name_zh,
      district: v.district,
      meta: v.district ? `${v.district}${v.price ? ` · ${v.price}` : ""}` : undefined,
      source: "local",
    });
    setStep("confirm");
  };

  const pickVenue = async (v: Venue) => {
    triggerHaptic("impactLight");
    if (v.source === "amap" && v._suggestion) {
      try {
        const place = await resolveAmapSuggestion(v._suggestion);
        if (place) {
          setSelected({
            name: place.name || v.name,
            address: place.formattedAddress || v.address,
            lat: place.coordinate?.latitude ?? v.lat,
            lng: place.coordinate?.longitude ?? v.lng,
            source: "amap",
          });
          setStep("confirm");
          return;
        }
      } catch {
        /* fall through to raw suggestion */
      }
    }
    setSelected(v);
    setStep("confirm");
  };

  // ---------------------------------------------------------------------------
  // Submission — one place, both paths converge here.
  const submit = async () => {
    setSubmitting(true);
    try {
      const dateHuman = humanDate(date);
      const timeHuman = humanTime(time);
      const partyLabel = `Table for ${party}`;

      let summary: string;
      let detailsLine: string;
      const detailsJson: Record<string, unknown> = {
        kind: "restaurant",
        path,
        date,
        time,
        date_human: dateHuman,
        time_human: timeHuman,
        party_size: party,
        notes: notes.trim() || null,
      };

      const hasVenue = selected !== null;
      const aiPicked = path === "choose" && hasVenue && aiRec !== null;

      if (hasVenue) {
        detailsJson.venue_name = selected.name;
        if (selected.name_zh) detailsJson.venue_name_zh = selected.name_zh;
        if (selected.address) detailsJson.venue_address = selected.address;
        if (typeof selected.lat === "number") detailsJson.venue_lat = selected.lat;
        if (typeof selected.lng === "number") detailsJson.venue_lng = selected.lng;
        const nameLine = selected.name_zh
          ? `${selected.name} ${selected.name_zh}`
          : selected.name;
        summary = `${nameLine} · ${dateHuman} ${timeHuman} · ${partyLabel}`;
        if (aiPicked) {
          detailsJson.recommended_by = "ai";
          detailsJson.ai_reason = aiRec?.reason ?? "";
          detailsJson.preferences = { cuisine, budget, area, vibe };
        }
        detailsLine = [
          aiPicked ? "Selected via concierge AI recommendation." : null,
          aiPicked && aiRec?.reason ? `Reason: ${aiRec.reason}` : null,
          notes.trim() ? `Notes: ${notes.trim()}` : null,
        ].filter(Boolean).join(" · ");
      } else {
        detailsJson.preferences = {
          cuisine, budget, area, vibe,
        };
        const cuisineLabel = cuisine === "Any" ? "" : `${cuisine}, `;
        summary = `${cuisineLabel}${budgetLabel(budget)}, ${area} · ${dateHuman} ${timeHuman} · ${partyLabel}`;
        detailsLine = [
          `Cuisine: ${cuisine}`,
          `Budget: ${budgetLabel(budget)}`,
          `Area: ${area}`,
          `Vibe: ${vibe}`,
          notes.trim() ? `Notes: ${notes.trim()}` : null,
        ].filter(Boolean).join(" · ");
      }

      const payload = {
        summary,
        details: detailsLine || null,
        details_json: detailsJson,
        category: "restaurant_reservation" as const,
        city: city?.name ?? null,
      };

      const { data, error } = await supabase.functions.invoke("concierge-create-task", {
        body: payload,
      });
      if (isPassRequiredData(data)) {
        try {
          sessionStorage.setItem(RESUME_KEY, JSON.stringify(payload));
        } catch { /* storage may be blocked */ }
        toast.error("Couldn't send the request. Try again in a moment.");
        return;
      }
      if (error) {
        if (await isPassRequiredError(error)) {
          try {
            sessionStorage.setItem(RESUME_KEY, JSON.stringify(payload));
          } catch { /* storage may be blocked */ }
          toast.error("Couldn't send the request. Try again in a moment.");
          return;
        }
        throw error;
      }
      const created = (data as { task?: CreatedTask })?.task;
      const taskId = created?.id;
      if (!created || !taskId) throw new Error("No task id returned");

      // An earlier request is still awaiting authorisation. The server hands
      // that task back rather than taking a second hold; finish it first.
      const pendingAuth = (data as { fee_authorisation_pending?: boolean })
        ?.fee_authorisation_pending === true;
      if (pendingAuth) {
        setFeeTask({
          id: taskId,
          label: feeLabelFor(created),
          newSet: await hasPriorSet(),
          note:
            "You already have a request waiting for card authorisation — finishing it here covers this one too.",
        });
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("booking-request-sent", taskId);
        sessionStorage.removeItem(RESUME_KEY);
      }
      // Booking fee due — authorise before the request goes to ops.
      if (created.status === "pay_to_confirm") {
        setFeeTask({ id: taskId, label: feeLabelFor(created), newSet: await hasPriorSet() });
        return;
      }
      toast.success("Request sent — our team will confirm your table.");
      navigate(`/bookings/${taskId}`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't send the request. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // UI

  const stepTitle = (() => {
    switch (step) {
      case "entry": return "Book a restaurant";
      case "search": return "Find your restaurant";
      case "prefs": return "Help me choose";
      case "recommend": return "How we'll book it";
      case "confirm": return "Confirm details";
    }
  })();

  const stepSubtitle = (() => {
    switch (step) {
      case "entry": return "We confirm the table for you";
      case "search": return "Search by name";
      case "prefs": return "Four quick questions";
      case "recommend": return "Concierge will pick the venue";
      case "confirm": return "Review and send";
    }
  })();

  const onBack = () => {
    if (step === "entry") { navigate(-1); return; }
    if (step === "search") { setStep("entry"); return; }
    if (step === "prefs") { setStep("entry"); return; }
    if (step === "recommend") { setStep("prefs"); return; }
    if (step === "confirm") {
      // Entered via directory prefill → return to the directory, not to a
      // blank search step.
      if (enteredViaPrefill && path === "known") {
        navigate(-1);
        return;
      }
      // Clear an AI-selected venue when returning to the recommend step so
      // the venue card resets to the recommendation UI.
      if (path === "choose") setSelected(null);
      setStep(path === "known" ? "search" : "recommend");
    }
  };

  if (showPassIntro) {
    // Trip Pass screen comes BEFORE the booking form, never after it.
    const next = `${window.location.pathname}${window.location.search}`;
    return <Navigate to={`/trip-pass?next=${encodeURIComponent(next)}`} replace />;
  }


  return (
    <AppLayout
      title={stepTitle}
      subtitle={stepSubtitle}
      showBack
      backTo={step === "entry" ? "/" : undefined}
      headerRight={
        step === "entry" ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tint-warm text-vermilion">
            <Utensils className="h-4 w-4" strokeWidth={1.75} />
          </div>
        ) : undefined
      }
    >
      {/* Custom back handler (intercepts the header back where needed) */}
      <BackIntercept onBack={onBack} armed={step !== "entry"} />

      <div className="mx-auto w-full max-w-[440px]">
        {step === "entry" && <PassExtendedNotice className="mb-4" />}
        {step === "entry" && <TripDatesNudge className="mb-4" />}
        {step === "entry" && (
          <Entry
            onKnow={() => { setPath("known"); setStep("search"); }}
            onChoose={() => { setPath("choose"); setStep("prefs"); }}
          />
        )}

        {step === "search" && (
          <SearchStep
            query={query}
            setQuery={setQuery}
            results={results}
            searching={searching}
            onPick={pickVenue}
            onFreeText={() => {
              const name = query.trim();
              if (!canAddFreeText) return;
              triggerHaptic("impactLight");
              setSelected({ name, source: "local" });
              setStep("confirm");
            }}
            canAddFreeText={canAddFreeText}
          />
        )}

        {step === "prefs" && (
          <PrefsStep
            cuisine={cuisine} setCuisine={setCuisine}
            budget={budget} setBudget={setBudget}
            area={area} setArea={setArea}
            vibe={vibe} setVibe={setVibe}
            onSubmit={() => { triggerHaptic("impactMedium"); setStep("recommend"); }}
          />
        )}

        {step === "recommend" && (
          aiFailed || (!aiLoading && !aiRec) ? (
            <RecommendFallback
              cuisine={cuisine} budget={budget} area={area} vibe={vibe}
              onContinue={() => setStep("confirm")}
            />
          ) : (
            <AiRecommendStep
              loading={aiLoading}
              rec={aiRec}
              onAccept={acceptAiRecommendation}
              onShowAnother={handleShowAnother}
            />
          )
        )}

        {step === "confirm" && (
          <ConfirmStep
            path={path}
            selected={selected}
            prefs={{ cuisine, budget, area, vibe }}
            date={date} setDate={setDate}
            time={time} setTime={setTime}
            party={party} setParty={setParty}
            notes={notes} setNotes={setNotes}
            submitting={submitting}
            onSubmit={submit}
            onChangeVenue={() => setStep("search")}
          />
        )}
      </div>

      {resuming && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/95 px-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-ink-secondary" />
          <p className="text-[15px] font-semibold text-ink">Sending your request…</p>
          <p className="text-[13px] leading-snug text-ink-secondary">
            We're sending the booking you'd already prepared.
          </p>
        </div>
      )}

      {feeTask && (
        <TaskPaymentDialog
          open={!!feeTask}
          onOpenChange={(open) => {
            if (!open) {
              const id = feeTask.id;
              setFeeTask(null);
              // Closed without authorising — the request is saved and can be
              // paid from the booking itself.
              navigate(`/bookings/${id}`);
            }
          }}
          taskId={feeTask.id}
          amountLabel={feeTask.label}
          note={feeTask.note}
          {...bookingServiceCopy(feeTask.label, !!feeTask.newSet)}
          successBody="Request sent. Our team will confirm your table and let you know here."
          onPaid={() => {
            const id = feeTask.id;
            setFeeTask(null);
            toast.success("Request sent — our team will confirm your table.");
            navigate(`/bookings/${id}`);
          }}
        />
      )}
    </AppLayout>
  );
};

export default RestaurantBooking;

// -----------------------------------------------------------------------------
// AppLayout's back button uses history(-1); we want internal step navigation
// on inner steps. This small helper hijacks the browser back so users move
// through the flow rather than exiting.
const BackIntercept = ({ onBack, armed }: { onBack: () => void; armed: boolean }) => {
  useEffect(() => {
    if (!armed) return;
    const onPop = () => onBack();
    // We don't push a state; the header back button in AppLayout still
    // triggers navigate(-1), which fires popstate. This just catches the OS
    // back gesture and calls the same handler.
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [armed, onBack]);
  return null;
};

// -----------------------------------------------------------------------------

const Entry = ({ onKnow, onChoose }: { onKnow: () => void; onChoose: () => void }) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
        How do you want to pick?
      </p>

      <PathCard
        icon={<BookOpen className="h-5 w-5 text-ink" strokeWidth={1.8} />}
        title="Browse our restaurant guide"
        subtitle="The places we recommend — filter by cuisine, area and price."
        onClick={() =>
          navigate("/guides/eat-and-drink/directory?entity=restaurant&intent=book")
        }
      />

      <PathCard
        icon={<Search className="h-5 w-5 text-ink" strokeWidth={1.8} />}
        title="I know the place"
        subtitle="Search by name and we'll book it."
        onClick={onKnow}
      />

      <PathCard
        icon={
          <Sparkles
            className="h-5 w-5 text-brand-orange"
            strokeWidth={2}
            fill="currentColor"
          />
        }
        title="Help me choose"
        subtitle="Four quick questions and we'll suggest the right spot."
        cta={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic("impactLight");
              onChoose();
            }}
            className="mt-3 flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white transition active:scale-[.99]"
          >
            Find me a restaurant
          </button>
        }
      />
    </div>
  );
};

const PathCard = ({
  icon, title, subtitle, onClick, cta,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  cta?: React.ReactNode;
}) => {
  const Wrapper: React.ElementType = onClick && !cta ? "button" : "div";
  return (
    <Wrapper
      {...(onClick && !cta
        ? {
            type: "button" as const,
            onClick: () => { triggerHaptic("impactLight"); onClick(); },
          }
        : {})}
      className="block w-full rounded-2xl border border-border bg-white p-4 text-left transition hover:bg-surface-2/60"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-ink">{title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-secondary">{subtitle}</p>
        </div>
        {!cta && (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-tertiary" strokeWidth={2} />
        )}
      </div>
      {cta}
    </Wrapper>
  );
};

// -----------------------------------------------------------------------------

const SearchStep = ({
  query, setQuery, results, searching, onPick, onFreeText, canAddFreeText,
}: {
  query: string; setQuery: (v: string) => void;
  results: Venue[]; searching: boolean; onPick: (v: Venue) => void;
  onFreeText: () => void; canAddFreeText: boolean;
}) => {
  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 3;
  const localResults = results.filter((r) => r.source === "local");
  const amapResults = results.filter((r) => r.source === "amap");
  const freeTextAvailable =
    canAddFreeText &&
    !results.some((r) => r.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" strokeWidth={1.75} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Search restaurant or area"
          className="h-[52px] w-full rounded-full border-transparent bg-surface-2 pl-11 pr-4 text-[15px] text-ink placeholder:text-ink-tertiary focus:border-transparent focus:outline-none"
        />
        {searching && (
          <Loader2 className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-tertiary" />
        )}
      </div>

      {!hasQuery && (
        <p className="mt-6 text-[13px] text-ink-secondary">
          Type at least three letters to search.
        </p>
      )}

      {hasQuery && (
        <div className="mt-6 space-y-6">
          {localResults.length > 0 && (
            <ResultGroup label="From our picks">
              {localResults.map((v) => (
                <ResultRow
                  key={`local-${v.name}`}
                  primary={v.name}
                  primaryZh={v.name_zh}
                  secondary={v.district ?? v.address ?? v.meta}
                  onClick={() => onPick(v)}
                />
              ))}
            </ResultGroup>
          )}

          {amapResults.length > 0 && (
            <ResultGroup label="Places">
              {amapResults.map((v) => (
                <ResultRow
                  key={`amap-${v.name}`}
                  primary={v.name}
                  secondary={v.address}
                  onClick={() => onPick(v)}
                />
              ))}
            </ResultGroup>
          )}

          {results.length === 0 && searching && (
            <p className="text-[13px] text-ink-secondary">Searching…</p>
          )}

          {freeTextAvailable && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
                Not listed?
              </p>
              <button
                type="button"
                onClick={onFreeText}
                className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-white p-3 text-left transition hover:bg-surface-2/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink">
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">
                    Book "{trimmed}"
                  </p>
                  <p className="truncate text-[12px] text-ink-secondary">
                    A person confirms every booking.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-tertiary" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ResultGroup = ({
  label, children,
}: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
      {label}
    </p>
    <ul className="space-y-2">{children}</ul>
  </div>
);

const ResultRow = ({
  primary, primaryZh, secondary, onClick,
}: {
  primary: string;
  primaryZh?: string;
  secondary?: string;
  onClick: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left transition hover:bg-surface-2/60"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">
          {primary}
          {primaryZh && <span className="ml-1.5 text-[13px] font-normal text-ink-tertiary">{primaryZh}</span>}
        </p>
        {secondary && (
          <p className="mt-0.5 truncate text-[13px] text-ink-secondary">{secondary}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-ink-tertiary" strokeWidth={2} />
    </button>
  </li>
);

// -----------------------------------------------------------------------------

const PrefsStep = ({
  cuisine, setCuisine, budget, setBudget, area, setArea, vibe, setVibe, onSubmit,
}: {
  cuisine: string; setCuisine: (v: string) => void;
  budget: DiningBudget; setBudget: (v: DiningBudget) => void;
  area: string; setArea: (v: string) => void;
  vibe: (typeof VIBES)[number]; setVibe: (v: (typeof VIBES)[number]) => void;
  onSubmit: () => void;
}) => (
  <div className="space-y-6">
    <Group label="Cuisine">
      {CUISINES.map((c) => (
        <Chip key={c} active={cuisine === c} onClick={() => setCuisine(c)}>{c}</Chip>
      ))}
    </Group>

    <Group label="Budget per person">
      {DINING_BUDGET_OPTIONS.map((b) => (
        <Chip key={b.value} active={budget === b.value} onClick={() => setBudget(b.value)} square>
          {b.label}
        </Chip>
      ))}
    </Group>

    <Group label="Area">
      {AREAS.map((a) => (
        <Chip key={a} active={area === a} onClick={() => setArea(a)}>{a}</Chip>
      ))}
    </Group>

    <Group label="Ambience">
      {VIBES.map((v) => (
        <Chip key={v} active={vibe === v} onClick={() => setVibe(v)}>{v}</Chip>
      ))}
    </Group>

    <button
      type="button"
      onClick={onSubmit}
      className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white transition active:scale-[.99]"
    >
      <Sparkles className="h-4 w-4" strokeWidth={2} fill="currentColor" />
      Recommend a table
    </button>
  </div>
);

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">{label}</p>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

const Chip = ({
  active, onClick, children, square,
}: { active: boolean; onClick: () => void; children: React.ReactNode; square?: boolean }) => (
  <button
    type="button"
    onClick={() => { triggerHaptic("impactLight"); onClick(); }}
    className={`h-10 ${square ? "min-w-[52px] px-4" : "px-4"} rounded-full text-[14px] font-semibold transition ${
      active
        ? "bg-ink text-white"
        : "border border-border bg-white text-ink hover:bg-surface-2/60"
    }`}
  >
    {children}
  </button>
);

// -----------------------------------------------------------------------------
// Honest fallback: we don't have an AI restaurant recommender that filters real
// venues by cuisine × budget × area × vibe. So instead of fabricating a "top
// match" card, we tell the user a person will pick the right spot and carry
// their preferences into the request.
const RecommendFallback = ({
  cuisine, budget, area, vibe, onContinue,
}: {
  cuisine: string; budget: DiningBudget; area: string;
  vibe: (typeof VIBES)[number]; onContinue: () => void;
}) => (
  <div>
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tint-warm text-vermilion">
        <UserRound className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h2 className="mt-4 text-[20px] font-bold leading-tight text-ink">
        A person will pick the perfect spot for you
      </h2>
      <p className="mt-2 text-[14px] leading-snug text-ink-secondary">
        A bilingual concierge will match your picks against real availability and confirm the
        venue before booking. Usually under 15 minutes.
      </p>

      <div className="mt-4 space-y-1.5 rounded-2xl bg-surface-2 p-3 text-[13px]">
        <RowLine k="Cuisine" v={cuisine} />
        <RowLine k="Budget" v={budgetLabel(budget)} />
        <RowLine k="Area" v={area} />
        <RowLine k="Ambience" v={vibe} />
      </div>
    </div>

    <button
      type="button"
      onClick={onContinue}
      className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white transition active:scale-[.99]"
    >
      Set date and party size
    </button>
  </div>
);

const RowLine = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-ink-secondary">{k}</span>
    <span className="font-semibold text-ink">{v}</span>
  </div>
);

// -----------------------------------------------------------------------------
// AI-powered recommendation card (Path B, happy path). The venue displayed is
// always drawn from the client's curated index; the AI only supplies the id
// and the reason. On failure the parent swaps this out for RecommendFallback.
const AiRecommendStep = ({
  loading, rec, onAccept, onShowAnother,
}: {
  loading: boolean;
  rec: AiRecommendation | null;
  onAccept: () => void;
  onShowAnother: () => void;
}) => {
  if (!rec) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-vermilion text-white">
            <Sparkles className="h-5 w-5" strokeWidth={2} fill="currentColor" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-ink">Finding the right table</p>
            <p className="text-[13px] text-ink-secondary">Your concierge AI is checking real venues…</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-ink-tertiary" />
        </div>
      </div>
    );
  }

  const v = rec.current;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-vermilion text-white">
            <Sparkles className="h-4 w-4" strokeWidth={2} fill="currentColor" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-vermilion">
            Concierge pick
          </p>
        </div>

        <h2 className="mt-4 text-[22px] font-bold leading-tight text-ink">
          {v.name}
          {v.name_zh && <span className="ml-2 text-ink-secondary">{v.name_zh}</span>}
        </h2>
        {(v.district || v.price) && (
          <p className="mt-1 text-[13px] text-ink-secondary">
            {[v.district, v.price].filter(Boolean).join(" · ")}
          </p>
        )}

        {rec.reason && (
          <p className="mt-4 text-[14px] leading-snug text-ink">
            {rec.reason}
          </p>
        )}

        <p className="mt-4 text-[12px] leading-snug text-ink-secondary">
          Picked by your concierge AI — a person makes the reservation.
        </p>
      </div>

      <button
        type="button"
        onClick={() => { triggerHaptic("impactMedium"); onAccept(); }}
        className="inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white transition active:scale-[.99]"
      >
        Book this table
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => { triggerHaptic("impactLight"); onShowAnother(); }}
          disabled={loading}
          className="text-[14px] font-semibold text-vermilion disabled:opacity-60"
        >
          {loading ? "Finding another…" : "Show another"}
        </button>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------

const ConfirmStep = ({
  path, selected, prefs,
  date, setDate, time, setTime, party, setParty, notes, setNotes,
  submitting, onSubmit, onChangeVenue,
}: {
  path: Path;
  selected: Venue | null;
  prefs: { cuisine: string; budget: DiningBudget; area: string; vibe: string };
  date: string; setDate: (v: string) => void;
  time: string; setTime: (v: string) => void;
  party: number; setParty: (v: number) => void;
  notes: string; setNotes: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onChangeVenue: () => void;
}) => (
  <div className="space-y-5">
    {path === "known" && selected ? (
      <div className="rounded-2xl border border-border bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">Venue</p>
            <p className="mt-1 text-[17px] font-bold leading-tight text-ink">
              {selected.name}
              {selected.name_zh && <span className="ml-1.5 text-ink-secondary">{selected.name_zh}</span>}
            </p>
            {(selected.address ?? selected.meta) && (
              <p className="mt-1 text-[13px] leading-snug text-ink-secondary">
                {selected.address ?? selected.meta}
              </p>
            )}
            {!selected.address && !selected.meta && (
              <p className="mt-1 text-[13px] leading-snug text-ink-secondary">
                We'll find it — a person confirms every booking.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onChangeVenue}
            className="shrink-0 text-[13px] font-semibold text-vermilion"
          >
            Change
          </button>
        </div>
      </div>
    ) : (
      <div className="rounded-2xl border border-border bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">Your picks</p>
        <p className="mt-1 text-[15px] font-semibold text-ink">
          {[prefs.cuisine !== "Any" ? prefs.cuisine : null, budgetLabel(prefs.budget), prefs.area, prefs.vibe].filter(Boolean).join(" · ")}
        </p>
      </div>
    )}

    <div className="grid grid-cols-2 gap-3">
      <Field label="Date" icon={<Calendar className="h-4 w-4 text-ink-tertiary" strokeWidth={1.75} />}>
        <input
          type="date"
          value={date}
          min={tomorrowIso()}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-transparent text-[15px] text-ink outline-none"
        />
      </Field>
      <Field label="Time" icon={<Clock className="h-4 w-4 text-ink-tertiary" strokeWidth={1.75} />}>
        <input
          type="time"
          value={time}
          step={900}
          onChange={(e) => setTime(e.target.value)}
          className="w-full bg-transparent text-[15px] text-ink outline-none"
        />
      </Field>
    </div>

    <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
      <p className="text-[15px] font-semibold text-ink">Party size</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Decrease party size"
          onClick={() => setParty(Math.max(1, party - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink transition active:scale-95 disabled:opacity-40"
          disabled={party <= 1}
        >
          <Minus className="h-4 w-4" strokeWidth={2} />
        </button>
        <span className="min-w-[1.5rem] text-center text-[17px] font-bold text-ink">{party}</span>
        <button
          type="button"
          aria-label="Increase party size"
          onClick={() => setParty(Math.min(20, party + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white transition active:scale-95"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>

    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">Notes</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, 240))}
        rows={3}
        placeholder="e.g. window table, birthday, dietary needs…"
        className="w-full rounded-2xl bg-surface-2 p-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
      />
    </div>

    <button
      type="button"
      onClick={onSubmit}
      disabled={submitting}
      className="inline-flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white transition active:scale-[.99] disabled:opacity-60"
    >
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" strokeWidth={2} />Request booking</>}
    </button>
  </div>
);

const Field = ({
  label, icon, children,
}: { label: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-2xl bg-surface-2 px-3.5 py-2.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">{label}</p>
    <div className="mt-1 flex items-center gap-2">
      {icon}
      {children}
    </div>
  </div>
);
