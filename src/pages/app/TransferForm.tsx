import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Calendar, ChevronDown, Clock, Loader2, Minus, Plane, Plus, TramFront } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PickupAutocomplete, type PickupResolved } from "@/components/transfers/PickupAutocomplete";
import { NATIONALITIES, dialForNationality } from "@/data/profileOptions";
import {
  AIRPORTS,
  airportTerminalsSummary,
  CAR_CLASS_EXAMPLE,
  CAR_CLASS_LABEL,
  CAR_CLASS_SUBTITLE,
  CAR_CLASS_ICON,
  CAR_CLASS_ORDER,
  HOURLY_INCLUDED_KM_BY_HOURS,
  SHANGHAI_STATIONS,
  airportsForCity,
  buildTransferDetailsLine,
  buildTransferSummary,
  getTransferGbpPrice,
  type Airport,
  type CarClass,
  type StationPreset,
  type TerminalCode,
  type TransferDetails,
  type TransferDirection,
  type TransferService,
} from "@/lib/transfers";
import { FREE_CANCELLATION_POLICY_LINE } from "@/lib/transferCancellation";
import { useTransferQuote, type TransferQuoteState } from "@/hooks/useTransferQuote";
import { HOURLY_RATE_CARD_GBP } from "@/lib/transfers";

type Step = "route" | "car" | "details";

const isService = (v: string | undefined): v is TransferService =>
  v === "airport" || v === "hourly" || v === "station";

// Duration presets shown on the hourly route step. Each preset carries the
// included distance so cards and headers can label it inline.
const HOURLY_PRESETS: { hours: number; label: string; km: number }[] = [
  { hours: 4,  label: "Half day", km: HOURLY_INCLUDED_KM_BY_HOURS[4] },
  { hours: 8,  label: "Full day", km: HOURLY_INCLUDED_KM_BY_HOURS[8] },
  { hours: 10, label: "Extended", km: HOURLY_INCLUDED_KM_BY_HOURS[10] },
];

const includedKmForHours = (h: number): number | null =>
  HOURLY_INCLUDED_KM_BY_HOURS[h] ?? null;

const hourlyRateLabel = (h: number): string => {
  const km = includedKmForHours(h);
  const base =
    h === 4 ? "Half day · 4 hours"
    : h === 8 ? "Full day · 8 hours"
    : h === 10 ? "Extended · 10 hours"
    : `${h} hours`;
  return km != null ? `${base} · ${km} km included` : base;
};

// Default pickup: tomorrow, 09:30 local, formatted for <input type="datetime-local">.
const defaultPickup = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 30, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TransferForm = () => {
  const { service } = useParams<{ service: string }>();
  const navigate = useNavigate();
  const { city } = useCity();

  if (!isService(service)) {
    return (
      <AppLayout title="Transfers" backTo="/transfers">
        <p className="mx-auto max-w-[440px] text-[14px] text-ink-secondary">Unknown service.</p>
      </AppLayout>
    );
  }

  return <TransferFormInner service={service} cityName={city?.name} navigate={navigate} />;
};

const TransferFormInner = ({
  service,
  cityName,
  navigate,
}: {
  service: TransferService;
  cityName: string | undefined;
  navigate: ReturnType<typeof useNavigate>;
}) => {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>("route");

  // route state
  const airports = useMemo(() => airportsForCity(cityName), [cityName]);
  const [airport, setAirport] = useState<Airport>(airports[0]);
  // Terminal state. To-airport requires one; From-airport allows null
  // (no terminal selected) — default null on both directions until user picks.
  const [terminal, setTerminal] = useState<TerminalCode | null>(null);
  const [direction, setDirection] = useState<TransferDirection>(
    service === "hourly" ? "departure" : "departure",
  );
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  // Extra fields captured when the user picks a MapKit suggestion for
  // the pickup address. Free-text edits clear these back to null.
  const [pickupResolved, setPickupResolved] = useState<PickupResolved | null>(null);
  const [dropoffResolved, setDropoffResolved] = useState<PickupResolved | null>(null);
  const [stationCode, setStationCode] = useState("");
  const [stationName, setStationName] = useState("");
  const [hours, setHours] = useState<number>(4);
  const [routePlan, setRoutePlan] = useState<string>("");
  // Custom-duration input toggle on the hourly route step.
  const [customHoursOpen, setCustomHoursOpen] = useState<boolean>(false);

  // car
  const [carClass, setCarClass] = useState<CarClass>("standard");
  // Route code fed to pricing: airport IATA for airport transfers, station
  // preset code for station transfers. Hourly ignores this.
  const routeCode: string | null =
    service === "airport" ? airport.code
    : service === "station" ? (stationCode || null)
    : null;

  // Every GBP rate-card amount this screen can display, quoted in one call.
  // Hourly includes all duration presets so switching duration is instant.
  const quotableGbp = useMemo(() => {
    const list: (number | null)[] = [];
    if (service === "hourly") {
      for (const preset of HOURLY_PRESETS) {
        for (const c of CAR_CLASS_ORDER) list.push(HOURLY_RATE_CARD_GBP[preset.hours]?.[c] ?? null);
      }
    } else {
      for (const c of CAR_CLASS_ORDER) list.push(getTransferGbpPrice(service, c, hours, routeCode));
    }
    return list;
  }, [service, hours, routeCode]);

  // Re-quote when the customer reaches the confirm step so the displayed
  // total reflects a fresh rate immediately before booking.
  const quote = useTransferQuote(quotableGbp, step === "details" ? "confirm" : "browse");

  // Keep carClass valid when the current selection is priced null for the
  // active configuration (e.g. Maybach at 4h). Snap back to Standard.
  useEffect(() => {
    if (getTransferGbpPrice(service, carClass, hours, routeCode) == null) {
      if (carClass !== "standard") setCarClass("standard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, hours, routeCode]);


  // details
  const [pickupAt, setPickupAt] = useState<string>(defaultPickup());
  const [pax, setPax] = useState(2);
  const [bags, setBags] = useState(2);
  const [flight, setFlight] = useState("");
  const [train, setTrain] = useState("");
  // Contact phone — split into dial code + local digits, pre-filled from the
  // saved profile phone when one exists. If the profile has none, the field
  // starts empty and the CTA stays disabled until a plausible number is
  // entered.
  const initialProfilePhone = (profile?.phone ?? "").trim();
  const initialDial = useMemo(() => {
    if (initialProfilePhone) {
      const match = NATIONALITIES.find((n) => initialProfilePhone.startsWith(n.dial));
      if (match) return match.dial;
    }
    return dialForNationality(profile?.nationality ?? "");
  }, [initialProfilePhone, profile?.nationality]);
  const initialLocal = useMemo(() => {
    if (!initialProfilePhone) return "";
    return initialProfilePhone.startsWith(initialDial)
      ? initialProfilePhone.slice(initialDial.length).trim()
      : initialProfilePhone;
  }, [initialProfilePhone, initialDial]);
  const [phoneDial, setPhoneDial] = useState(initialDial);
  const [phoneLocal, setPhoneLocal] = useState(initialLocal);
  // Keep phone in sync when the profile loads after initial render.
  useEffect(() => {
    if (!phoneLocal) {
      setPhoneDial(initialDial);
      setPhoneLocal(initialLocal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDial, initialLocal]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Direction toggle for airport / station: swap the free-text address
  // (and any resolved MapKit selection) between the pickup and drop-off
  // slots so the traveller's typed text follows them across the flip
  // instead of silently ending up in the wrong details_json field.
  const changeDirection = (next: TransferDirection) => {
    if (next === direction) return;
    if (service === "airport" || service === "station") {
      const nextPickup = dropoffAddress;
      const nextDropoff = pickupAddress;
      const nextPickupResolved = dropoffResolved;
      const nextDropoffResolved = pickupResolved;
      setPickupAddress(nextPickup);
      setDropoffAddress(nextDropoff);
      setPickupResolved(nextPickupResolved);
      setDropoffResolved(nextDropoffResolved);
    }
    setDirection(next);
  };

  // Reset the terminal choice whenever the airport changes so a T2 picked
  // for PVG doesn't silently carry into SHA.
  const changeAirport = (next: Airport) => {
    if (next.code === airport.code) return;
    setAirport(next);
    setTerminal(null);
  };

  const composedPhone = phoneLocal.trim() ? `${phoneDial} ${phoneLocal.trim()}` : "";
  // Basic plausibility check: at least 6 digits in the local part. Country
  // code UX is handled by the dial prefix picker, so we don't strict-parse.
  const phoneValid = (phoneLocal.match(/\d/g)?.length ?? 0) >= 6;

  const canContinueRoute = (() => {
    if (service === "airport") {
      if (direction === "arrival") return !!airport && dropoffAddress.trim().length >= 3;
      // To-airport: terminal is REQUIRED.
      return !!airport && !!terminal && pickupAddress.trim().length >= 3;
    }
    if (service === "station") {
      // Station: one of the presets must be picked (stationCode), and
      // the free-text address (pickup or drop-off, whichever isn't the
      // preset) must be filled.
      if (!stationCode.trim()) return false;
      const addr = direction === "arrival" ? dropoffAddress : pickupAddress;
      return addr.trim().length >= 3;
    }
    // hourly — needs a duration + a pickup and a real date/time
    return (
      hours >= 1 &&
      pickupAddress.trim().length >= 3 &&
      Boolean(pickupAt)
    );
  })();

  const routeTitle: Record<TransferService, string> = {
    airport: "Airport transfer",
    hourly: "Car by the hour",
    station: "Station transfer",
  };

  const routeSubtitle: Record<TransferService, string> = {
    airport: "Which airport?",
    hourly: "How long?",
    station: "Which station?",
  };

  const HeaderIcon =
    service === "station" ? TramFront : service === "hourly" ? Clock : Plane;
  const headerIconTone =
    service === "hourly"
      ? "bg-[hsl(var(--tint-warm))] text-[hsl(var(--brand-orange))]"
      : "bg-[hsl(var(--error-tint))] text-[hsl(var(--brand-red))]";

  const submit = async () => {
    setSubmitting(true);
    try {
      const details: TransferDetails = {
        kind: "transfer",
        service,
        car_class: carClass,
        pax,
        bags,
        notes: notes.trim() || undefined,
        pickup_at: new Date(pickupAt).toISOString(),
        pickup_address: pickupAddress.trim() || undefined,
        dropoff_address: dropoffAddress.trim() || undefined,
        phone: composedPhone || undefined,
        contact_phone: composedPhone || undefined,
      };
      // Only mirror resolved fields when the picked address still
      // matches the text in the field (user hasn't edited over it).
      if (
        pickupResolved &&
        pickupAddress.trim() === pickupResolved.address.trim()
      ) {
        if (pickupResolved.address_full) details.pickup_address_full = pickupResolved.address_full;
        if (typeof pickupResolved.lat === "number") details.pickup_lat = pickupResolved.lat;
        if (typeof pickupResolved.lng === "number") details.pickup_lng = pickupResolved.lng;
      }
      if (
        dropoffResolved &&
        dropoffAddress.trim() === dropoffResolved.address.trim()
      ) {
        if (dropoffResolved.address_full) details.dropoff_address_full = dropoffResolved.address_full;
        if (typeof dropoffResolved.lat === "number") details.dropoff_lat = dropoffResolved.lat;
        if (typeof dropoffResolved.lng === "number") details.dropoff_lng = dropoffResolved.lng;
      }
      if (service === "airport") {
        details.airport_code = airport.code;
        details.airport_name = airport.name;
        // Store the specific terminal code ("T1" | "T2") or omit when
        // From-airport traveller left the terminal unselected.
        if (terminal) details.terminal = terminal;
        details.direction = direction;
        if (flight.trim()) details.flight_number = flight.trim();
        // Chinese rendering of the airport side, so reminder emails can show
        // an address a local driver can read.
        const airportZh = [airport.cn, terminal ? `${terminal}航站楼` : null]
          .filter(Boolean)
          .join(" · ");
        if (direction === "arrival") details.pickup_address_zh = airportZh;
        else details.dropoff_address_zh = airportZh;
      }
      if (service === "hourly") {
        details.hours = hours;
        const km = includedKmForHours(hours);
        if (km != null) details.included_km = km;
        if (routePlan.trim()) details.route_plan = routePlan.trim();
        // Aliases requested by the hourly spec (start_at, luggage) while
        // keeping pickup_at + bags for existing consumers (ops queue,
        // BookingDetail) that already read them.
        details.start_at = details.pickup_at;
        details.luggage = details.bags;
      }
      if (service === "station") {
        if (stationCode.trim()) details.station_code = stationCode.trim();
        if (stationName.trim()) details.station_name = stationName.trim();
        details.direction = direction;
        details.station_direction = direction === "arrival" ? "from_station" : "to_station";
        // Chinese rendering of the station side for the reminder emails.
        const stationZh = SHANGHAI_STATIONS.find((s) => s.code === stationCode.trim())?.cn;
        if (stationZh) {
          if (direction === "arrival") details.pickup_address_zh = stationZh;
          else details.dropoff_address_zh = stationZh;
        }
        if (train.trim()) details.train_number = train.trim();
        // Mirror luggage under the shared alias, consistent with hourly.
        details.luggage = details.bags;
      }

      const summary = buildTransferSummary(details);
      const detailsLine = buildTransferDetailsLine(details);

      // If the profile has no phone yet, mirror this number back so the
      // traveller isn't asked twice on subsequent bookings.
      if (composedPhone && !initialProfilePhone && user) {
        try {
          await supabase
            .from("profiles")
            .update({ phone: composedPhone })
            .eq("user_id", user.id);
          await refreshProfile();
        } catch (err) {
          console.warn("profile phone back-save failed (non-blocking)", err);
        }
      }

      const { data, error } = await supabase.functions.invoke("concierge-create-task", {
        body: {
          summary,
          details: detailsLine,
          details_json: details,
          category: "transfer",
          city: cityName ?? null,
          // The exact amount the customer just saw. The server still locks
          // the charge itself — if the rate moved, the locked amount wins and
          // the payment card renders it before any payment is taken.
          quoted_charge_cents: (() => {
            const gbp = getTransferGbpPrice(service, carClass, hours, routeCode);
            return gbp != null ? quote.centsFor(gbp) : null;
          })(),
          quoted_charge_currency: quote.currency,
        },
      });
      if (error) throw error;
      const taskId = (data as { task?: { id: string } })?.task?.id;
      if (!taskId) throw new Error("No task id returned");
      // Booking a transfer completes the "transfer" pre-trip task.
      try {
        const current = ((profile as any)?.pretrip_tasks_done as string[] | null | undefined) ?? [];
        if (!current.includes("transfer") && user) {
          await supabase
            .from("profiles")
            .update({ pretrip_tasks_done: [...current, "transfer"] } as any)
            .eq("user_id", user.id);
          await refreshProfile();
        }
      } catch (err) {
        console.warn("pretrip transfer auto-complete failed (non-blocking)", err);
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem("booking-request-sent", taskId);
      }
      toast.success("Car reserved — pay to confirm your driver.");
      navigate(`/bookings/${taskId}`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't send the request. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout
      title={step === "car" ? "Choose your car" : step === "details" ? "Trip details" : routeTitle[service]}
      subtitle={
        step === "route"
          ? routeSubtitle[service]
          : step === "car" && service === "hourly"
            ? hourlyRateLabel(hours)
            : step === "car" && service === "station"
              ? (() => {
                  const preset = SHANGHAI_STATIONS.find((s) => s.code === stationCode);
                  const from = direction === "arrival" ? preset?.name : (pickupAddress || "Pickup");
                  const to = direction === "arrival" ? (dropoffAddress || "Drop-off") : preset?.name;
                  if (from && to) return `${from} → ${to}`;
                  return undefined;
                })()
              : undefined
      }
      backTo={step === "route" ? "/transfers" : undefined}
      showBack={true}
      hasBottomBar
      headerRight={
        step === "route" ? (
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${headerIconTone}`}>
            <HeaderIcon className="h-4 w-4" strokeWidth={2} />
          </span>
        ) : step === "car" && service === "hourly" ? (
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${headerIconTone}`}>
            <Clock className="h-4 w-4" strokeWidth={2} />
          </span>
        ) : step === "car" && service === "station" ? (
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${headerIconTone}`}>
            <TramFront className="h-4 w-4" strokeWidth={2} />
          </span>
        ) : step === "details" ? (
          <HeaderCarPrice service={service} carClass={carClass} hours={hours} routeCode={routeCode} quote={quote} />
        ) : null
      }
    >
      <div className="mx-auto max-w-[440px]">
        {step === "route" && (
          <RouteStep
            service={service}
            airports={airports}
            airport={airport}
            setAirport={changeAirport}
            terminal={terminal}
            setTerminal={setTerminal}
            direction={direction}
            setDirection={changeDirection}
            pickupAddress={pickupAddress}
            setPickupAddress={setPickupAddress}
            setPickupResolved={setPickupResolved}
            dropoffAddress={dropoffAddress}
            setDropoffAddress={setDropoffAddress}
            setDropoffResolved={setDropoffResolved}
            stationCode={stationCode}
            setStationCode={setStationCode}
            stationName={stationName}
            setStationName={setStationName}
            hours={hours}
            setHours={setHours}
            cityName={cityName}
            pickupAt={pickupAt}
            setPickupAt={setPickupAt}
            routePlan={routePlan}
            setRoutePlan={setRoutePlan}
            customHoursOpen={customHoursOpen}
            setCustomHoursOpen={setCustomHoursOpen}
            flight={flight}
            setFlight={setFlight}
          />
        )}

        {step === "car" && (
          <CarStep
            service={service}
            carClass={carClass}
            setCarClass={setCarClass}
            hours={hours}
            routeCode={routeCode}
            quote={quote}
            inline={
              service === "hourly"
                ? {
                    pax, setPax, bags, setBags, notes, setNotes,
                    phoneDial, setPhoneDial, phoneLocal, setPhoneLocal, phoneValid,
                  }
                : service === "station"
                  ? {
                      pax, setPax, bags, setBags, notes, setNotes,
                      train, setTrain,
                      phoneDial, setPhoneDial, phoneLocal, setPhoneLocal, phoneValid,
                    }
                  : undefined
            }
          />
        )}

        {step === "details" && (
          <DetailsStep
            service={service}
            carClass={carClass}
            pickupAt={pickupAt}
            setPickupAt={setPickupAt}
            pax={pax}
            setPax={setPax}
            bags={bags}
            setBags={setBags}
            flight={flight}
            setFlight={setFlight}
            train={train}
            setTrain={setTrain}
            phoneDial={phoneDial}
            setPhoneDial={setPhoneDial}
            phoneLocal={phoneLocal}
            setPhoneLocal={setPhoneLocal}
            phoneValid={phoneValid}
            notes={notes}
            setNotes={setNotes}
            hours={hours}
            routeCode={routeCode}
            quote={quote}
          />
        )}
      </div>

      {/* Sticky CTA — sits above the floating nav via the shared inset. */}
      <div className="bottom-above-nav fixed inset-x-0 z-40 border-t border-border bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-[440px]">
          {step === "route" && (
            <button
              type="button"
              disabled={!canContinueRoute}
              onClick={() => setStep("car")}
              className="w-full rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white transition disabled:opacity-40"
            >
              Choose a car
            </button>
          )}
          {step === "car" && (
            service === "hourly" || service === "station" ? (
              <button
                type="button"
                disabled={submitting || !phoneValid}
                onClick={submit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {service === "hourly" ? "Request an hourly car" : "Request car"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep("details")}
                className="w-full rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white"
              >
                Continue with {CAR_CLASS_LABEL[carClass]}
              </button>
            )
          )}
          {step === "details" && (
            <button
              type="button"
              disabled={submitting || !phoneValid}
              onClick={submit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Request transfer
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

// —— steps ——————————————————————————————————————

const HeaderCarPrice = ({
  service, carClass, hours, routeCode, quote,
}: {
  service: TransferService; carClass: CarClass; hours: number;
  routeCode: string | null; quote: TransferQuoteState;
}) => {
  const gbp = getTransferGbpPrice(service, carClass, hours, routeCode);
  const label = gbp != null ? quote.labelFor(gbp) : null;
  return (
    <span className="text-[13px] font-medium text-ink-secondary">
      {CAR_CLASS_LABEL[carClass]}
      {gbp != null && quote.status === "loading" && (
        <span className="ml-1 inline-block h-3 w-10 animate-pulse rounded-full bg-surface-3 align-middle" />
      )}
      {label ? ` · ${label}` : ""}
    </span>
  );
};

// Full-width fixed-price card shown at the top of the details step so the
// total is unmistakable before the customer taps "Request transfer" and
// lands on the payment screen.
const TotalPriceBanner = ({
  service, carClass, hours, routeCode, quote,
}: {
  service: TransferService; carClass: CarClass; hours: number;
  routeCode: string | null; quote: TransferQuoteState;
}) => {
  const gbp = getTransferGbpPrice(service, carClass, hours, routeCode);
  if (gbp == null) return null;
  const label = quote.labelFor(gbp);
  return (
    <div className="flex items-end justify-between rounded-2xl bg-ink px-4 py-4 text-white">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Total · fixed all-in</p>
        <p className="mt-0.5 text-[13px] text-white/80">
          {CAR_CLASS_LABEL[carClass]}{service === "hourly" && hours ? ` · ${hours}h` : ""}
        </p>
      </div>
      <div className="text-right">
        {quote.status === "loading" && (
          <span className="block h-8 w-28 animate-pulse rounded-lg bg-white/20" />
        )}
        {quote.status === "error" && (
          <button
            type="button"
            onClick={quote.retry}
            className="text-[13px] font-semibold text-white underline underline-offset-4"
          >
            Pricing unavailable — retry
          </button>
        )}
        {quote.status === "ready" && label && (
          <p className="text-[32px] font-extrabold leading-none">{label}</p>
        )}
      </div>
    </div>
  );
};

const Segmented = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div className="flex items-center rounded-full bg-surface-2 p-1">
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
            active ? "bg-white text-ink shadow-sm" : "text-ink-secondary"
          }`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

// Label lookup for the currently-picked terminal code, falls back to the
// short code ("T1") when we can't find a match (defensive).
const terminalLabelFor = (a: Airport, code: TerminalCode): string =>
  a.terminals.find((t) => t.code === code)?.label ?? code;

const TerminalChips = ({
  airport,
  terminal,
  setTerminal,
}: {
  airport: Airport;
  terminal: TerminalCode | null;
  setTerminal: (t: TerminalCode | null) => void;
}) => {
  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-semibold transition ${
      active
        ? "bg-ink text-white"
        : "border border-border bg-white text-ink-secondary hover:bg-surface-2"
    }`;
  return (
    <div className="flex flex-wrap gap-2">
      {airport.terminals.map((t) => (
        <button
          key={t.code}
          type="button"
          onClick={() => setTerminal(t.code)}
          className={chip(terminal === t.code)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};

const RouteStep = (p: {
  service: TransferService;
  airports: Airport[];
  airport: Airport;
  setAirport: (a: Airport) => void;
  terminal: TerminalCode | null;
  setTerminal: (t: TerminalCode | null) => void;
  direction: TransferDirection;
  setDirection: (d: TransferDirection) => void;
  pickupAddress: string;
  setPickupAddress: (v: string) => void;
  setPickupResolved: (r: PickupResolved | null) => void;
  dropoffAddress: string;
  setDropoffAddress: (v: string) => void;
  setDropoffResolved: (r: PickupResolved | null) => void;
  stationCode: string;
  setStationCode: (v: string) => void;
  stationName: string;
  setStationName: (v: string) => void;
  hours: number;
  setHours: (v: number) => void;
  cityName: string | undefined;
  pickupAt: string;
  setPickupAt: (v: string) => void;
  routePlan: string;
  setRoutePlan: (v: string) => void;
  customHoursOpen: boolean;
  setCustomHoursOpen: (v: boolean) => void;
  flight: string;
  setFlight: (v: string) => void;
}) => {
  if (p.service === "hourly") {
    return <HourlyRouteStep {...p} />;
  }

  const directionOpts =
    p.service === "airport"
      ? [
          { value: "departure", label: "To airport" },
          { value: "arrival",   label: "From airport" },
        ]
      : [
          { value: "departure", label: "To station" },
          { value: "arrival",   label: "From station" },
        ];

  if (p.service === "station") {
    return <StationRouteStep {...p} />;
  }

  const toAirport = p.direction === "departure";
  return (
    <div className="space-y-5">
      <Segmented
        value={p.direction}
        onChange={(v) => p.setDirection(v as TransferDirection)}
        options={directionOpts}
      />

      {p.service === "airport" && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Shanghai airport
          </p>
          <ul className="space-y-2">
            {p.airports.map((a) => {
              const selected = a.code === p.airport.code;
              return (
                <li key={a.code}>
                  <button
                    type="button"
                    onClick={() => p.setAirport(a)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                      selected
                        ? "border border-ink bg-white"
                        : "border border-transparent bg-surface-2 hover:bg-surface-3"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      selected ? "bg-[hsl(var(--error-tint))] text-[hsl(var(--brand-red))]" : "bg-white text-[hsl(var(--brand-red))]"
                    }`}>
                      <Plane className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">
                        {a.name} <span className="text-ink-tertiary">{a.code}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-ink-secondary">
                        {airportTerminalsSummary(a)}
                      </p>
                    </div>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        selected ? "border-ink bg-ink text-white" : "border-border bg-white"
                      }`}
                      aria-hidden
                    >
                      {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Terminal chips — required on To-airport, optional on From-airport. */}
          <TerminalChips
            airport={p.airport}
            terminal={p.terminal}
            setTerminal={p.setTerminal}
          />

          {p.direction === "arrival" && !p.terminal && !p.flight.trim() && (
            <p className="text-[12px] leading-snug text-ink-secondary">
              Add your flight number and we'll confirm the terminal for you.
            </p>
          )}
        </div>
      )}

      {/* Route summary card — pickup & dropoff, layout swaps with direction */}
      <div className="rounded-2xl bg-surface-2">
        <div className="flex items-start gap-3 p-3">
          <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
            {toAirport ? (
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--success))]" aria-hidden />
            ) : (
              <Plane className="h-4 w-4 text-[hsl(var(--brand-red))]" strokeWidth={1.9} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              Pickup
            </p>
            {toAirport ? (
              <PickupAutocomplete
                value={p.pickupAddress}
                onChange={p.setPickupAddress}
                onResolved={p.setPickupResolved}
                placeholder="Hotel or address"
              />
            ) : (
              <p className="text-[14px] font-semibold text-ink">
                {p.airport.name} ({p.airport.code})
                {p.terminal ? ` · ${terminalLabelFor(p.airport, p.terminal)}` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="mx-3 border-t border-border/70" />
        <div className="flex items-start gap-3 p-3">
          <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
            {toAirport ? (
              <Plane className="h-4 w-4 text-[hsl(var(--brand-red))]" strokeWidth={1.9} />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--success))]" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              Drop-off
            </p>
            {toAirport ? (
              <p className="text-[14px] font-semibold text-ink">
                {p.airport.name} ({p.airport.code})
                {p.terminal ? ` · ${terminalLabelFor(p.airport, p.terminal)}` : ""}
              </p>
            ) : (
              <PickupAutocomplete
                value={p.dropoffAddress}
                onChange={p.setDropoffAddress}
                onResolved={p.setDropoffResolved}
                placeholder="Hotel or address"
              />
            )}
          </div>
        </div>
      </div>

      {!toAirport && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Flight number · optional
          </p>
          <input
            value={p.flight}
            onChange={(e) => p.setFlight(e.target.value)}
            placeholder="e.g. MU587 — helps your driver time the pickup"
            className="w-full rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
          />
        </div>
      )}
    </div>
  );
};

const CarStep = ({
  service,
  carClass,
  setCarClass,
  hours,
  routeCode,
  quote,
  inline,
}: {
  service: TransferService;
  carClass: CarClass;
  setCarClass: (c: CarClass) => void;
  hours: number;
  routeCode: string | null;
  quote: TransferQuoteState;
  inline?: {
    pax: number;
    setPax: (v: number) => void;
    bags: number;
    setBags: (v: number) => void;
    notes: string;
    setNotes: (v: string) => void;
    train?: string;
    setTrain?: (v: string) => void;
    phoneDial: string;
    setPhoneDial: (v: string) => void;
    phoneLocal: string;
    setPhoneLocal: (v: string) => void;
    phoneValid: boolean;
  };
}) => {
  const isHourly = service === "hourly";
  const isStation = service === "station";
  return (
    <div className="space-y-3">
      {quote.status === "error" && (
        <button
          type="button"
          onClick={quote.retry}
          className="w-full rounded-2xl bg-surface-2 p-3 text-[13px] font-semibold text-ink"
        >
          Pricing unavailable — retry
        </button>
      )}
      {CAR_CLASS_ORDER.map((c) => {
        const selected = c === carClass;
        const Icon = CAR_CLASS_ICON[c];
        const gbp = getTransferGbpPrice(service, c, hours, routeCode);
        const priceLabel = gbp != null ? quote.labelFor(gbp) : null;
        const disabled = gbp == null;
        const disabledNote =
          disabled && isHourly && c === "maybach"
            ? "Available for 8 hours or more"
            : disabled
              ? "Not available for this route"
              : null;
        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setCarClass(c)}
            className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
              disabled
                ? "cursor-not-allowed border border-transparent bg-surface-2 opacity-50"
                : selected
                  ? "border border-ink bg-white"
                  : "border border-transparent bg-surface-2 hover:bg-surface-3"
            }`}
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-ink">
              <Icon className="h-6 w-6" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-ink">{CAR_CLASS_LABEL[c]}</p>
              <p className="mt-0.5 text-[12px] text-ink-secondary">{CAR_CLASS_SUBTITLE[c]}</p>
              <p className="text-[12px] text-ink-tertiary">{CAR_CLASS_EXAMPLE[c]}</p>
              {disabledNote && (
                <p className="mt-0.5 text-[11px] text-ink-tertiary">{disabledNote}</p>
              )}
            </div>
            {gbp != null && (
              <div className="text-right">
                {quote.status === "loading" ? (
                  <span className="block h-4 w-14 animate-pulse rounded-full bg-surface-3" />
                ) : priceLabel ? (
                  <p className="text-[16px] font-extrabold text-ink">{priceLabel}</p>
                ) : null}
                <p className="mt-0.5 text-[11px] text-ink-tertiary">fixed all-in</p>
              </div>
            )}
          </button>
        );
      })}

      {isHourly || isStation ? (
        <>
          <p className="rounded-2xl bg-surface-2 p-3 text-[12px] leading-snug text-ink-secondary">
            {isHourly
              ? "Fixed all-in price. Fuel, tolls and parking included. Extra hours billed at the same hourly rate. Complete payment to confirm your driver."
              : "Fixed all-in price — no surge, no tolls added later. Complete payment to confirm your driver."}
          </p>
          {inline && (
            <div className="space-y-3 pt-2">
              <Stepper value={inline.pax} onChange={inline.setPax} min={1} max={9} label="Passengers" />
              <Stepper value={inline.bags} onChange={inline.setBags} min={0} max={9} label="Luggage" />
              {isStation && inline.setTrain && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
                    Train number · optional
                  </p>
                  <input
                    value={inline.train ?? ""}
                    onChange={(e) => inline.setTrain!(e.target.value)}
                    placeholder="e.g. G7 — we'll track arrival"
                    className="w-full rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
                  />
                </div>
              )}
              <PhoneField
                dial={inline.phoneDial}
                setDial={inline.setPhoneDial}
                local={inline.phoneLocal}
                setLocal={inline.setPhoneLocal}
                valid={inline.phoneValid}
              />
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
                  Notes · optional
                </p>
                <textarea
                  value={inline.notes}
                  onChange={(e) => inline.setNotes(e.target.value)}
                  rows={3}
                  placeholder="Child seat, language, meeting point…"
                  className="w-full rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="rounded-2xl bg-surface-2 p-3 text-[12px] leading-snug text-ink-secondary">
          Fixed all-in price — no surge, tolls or airport fees added later. Complete payment on the next step to confirm your driver.
        </p>
      )}
    </div>
  );
};

// —— Hourly route step (matches the "Pick hours, date & start" mockup) ——
const HourlyRouteStep = (p: {
  hours: number;
  setHours: (v: number) => void;
  pickupAt: string;
  setPickupAt: (v: string) => void;
  pickupAddress: string;
  setPickupAddress: (v: string) => void;
  setPickupResolved: (r: PickupResolved | null) => void;
  routePlan: string;
  setRoutePlan: (v: string) => void;
  customHoursOpen: boolean;
  setCustomHoursOpen: (v: boolean) => void;
}) => {
  const [datePart, timePart] = p.pickupAt.split("T");
  const setDate = (v: string) => p.setPickupAt(`${v}T${timePart || "09:00"}`);
  const setTime = (v: string) => p.setPickupAt(`${datePart}T${v}`);
  const isPreset = HOURLY_PRESETS.some((o) => o.hours === p.hours);
  const showCustom = p.customHoursOpen || !isPreset;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          How long?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {HOURLY_PRESETS.map(({ hours, label, km }) => {
            const active = hours === p.hours;
            return (
              <button
                key={hours}
                type="button"
                onClick={() => {
                  p.setCustomHoursOpen(false);
                  p.setHours(hours);
                }}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-2 py-4 transition ${
                  active
                    ? "border-2 border-ink bg-white"
                    : "border border-transparent bg-surface-2 hover:bg-surface-3"
                }`}
              >
                <span className="text-[22px] font-extrabold leading-none text-ink">{hours}h</span>
                <span className="mt-1 text-[11px] font-medium text-ink-secondary">{label}</span>
                <span className="text-[10px] text-ink-tertiary">{km} km incl.</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-ink-secondary">
          Longer or custom hires — ask the concierge.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Date
          </p>
          <label className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-3 text-[14px] text-ink">
            <Calendar className="h-4 w-4 text-ink-secondary" strokeWidth={1.9} />
            <input
              type="date"
              value={datePart}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none"
            />
          </label>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Start
          </p>
          <label className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-3 text-[14px] text-ink">
            <Clock className="h-4 w-4 text-ink-secondary" strokeWidth={1.9} />
            <input
              type="time"
              value={timePart}
              onChange={(e) => setTime(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none"
            />
          </label>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          Start location
        </p>
        <label className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-3 text-[14px] text-ink">
          <span className="flex h-4 w-4 items-center justify-center">
            <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--success))]" aria-hidden />
          </span>
          <PickupAutocomplete
            value={p.pickupAddress}
            onChange={p.setPickupAddress}
            onResolved={p.setPickupResolved}
            placeholder="Hotel or address in the city"
            className="relative flex-1"
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          Anywhere in mind? <span className="text-ink-tertiary">· Optional</span>
        </p>
        <textarea
          value={p.routePlan}
          onChange={(e) => p.setRoutePlan(e.target.value)}
          rows={3}
          placeholder="e.g. Yu Garden, the Bund, Tianzifang, then back to the hotel…"
          className="w-full rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
        />
      </div>
    </div>
  );
};

// —— Station route step (matches the "Pick station & route" mockup) ——
const StationRouteStep = (p: {
  direction: TransferDirection;
  setDirection: (d: TransferDirection) => void;
  pickupAddress: string;
  setPickupAddress: (v: string) => void;
  setPickupResolved: (r: PickupResolved | null) => void;
  dropoffAddress: string;
  setDropoffAddress: (v: string) => void;
  setDropoffResolved: (r: PickupResolved | null) => void;
  stationCode: string;
  setStationCode: (v: string) => void;
  stationName: string;
  setStationName: (v: string) => void;
}) => {
  const toStation = p.direction === "departure";
  const selectStation = (s: StationPreset) => {
    p.setStationCode(s.code);
    p.setStationName(`${s.name} ${s.cn}`);
  };
  const selected = SHANGHAI_STATIONS.find((s) => s.code === p.stationCode);
  const stationLabel = selected ? `${selected.name} Station` : "Station";
  // Free-text field toggles side with direction; keep the same split
  // as before (pickupAddress when to_station, dropoffAddress when
  // from_station) so ops sees the same details_json shape. Only the
  // to_station side capture resolved lat/lng into pickup_address_full
  // — from_station's free-text is the drop-off, not the pickup.
  const addressValue = toStation ? p.pickupAddress : p.dropoffAddress;
  const setAddress = toStation ? p.setPickupAddress : p.setDropoffAddress;
  const onResolved = toStation ? p.setPickupResolved : p.setDropoffResolved;

  return (
    <div className="space-y-5">
      <Segmented
        value={p.direction}
        onChange={(v) => p.setDirection(v as TransferDirection)}
        options={[
          { value: "departure", label: "To station" },
          { value: "arrival",   label: "From station" },
        ]}
      />

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          Shanghai station
        </p>
        <ul className="space-y-2">
          {SHANGHAI_STATIONS.map((s) => {
            const isSelected = s.code === p.stationCode;
            return (
              <li key={s.code}>
                <button
                  type="button"
                  onClick={() => selectStation(s)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                    isSelected
                      ? "border border-ink bg-white"
                      : "border border-transparent bg-surface-2 hover:bg-surface-3"
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                    isSelected ? "bg-[hsl(var(--error-tint))] text-[hsl(var(--brand-red))]" : "bg-white text-[hsl(var(--brand-red))]"
                  }`}>
                    <TramFront className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {s.name} <span className="text-ink-tertiary">{s.cn}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-secondary">
                      {s.subtitle}
                    </p>
                  </div>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      isSelected ? "border-ink bg-ink text-white" : "border-border bg-white"
                    }`}
                    aria-hidden
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-2xl bg-surface-2">
        <div className="flex items-start gap-3 p-3">
          <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
            {toStation ? (
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--success))]" aria-hidden />
            ) : (
              <TramFront className="h-4 w-4 text-[hsl(var(--brand-red))]" strokeWidth={1.9} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              Pickup
            </p>
            {toStation ? (
              <PickupAutocomplete
                value={addressValue}
                onChange={setAddress}
                onResolved={onResolved}
                placeholder="Hotel or address"
              />
            ) : (
              <p className="text-[14px] font-semibold text-ink">{stationLabel}</p>
            )}
          </div>
        </div>
        <div className="mx-3 border-t border-border/70" />
        <div className="flex items-start gap-3 p-3">
          <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
            {toStation ? (
              <TramFront className="h-4 w-4 text-[hsl(var(--brand-red))]" strokeWidth={1.9} />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--success))]" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              Drop-off
            </p>
            {toStation ? (
              <p className="text-[14px] font-semibold text-ink">{stationLabel}</p>
            ) : (
              <PickupAutocomplete
                value={addressValue}
                onChange={setAddress}
                onResolved={onResolved}
                placeholder="Hotel or address"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Stepper = ({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  label: string;
}) => (
  <div className="flex items-center justify-between">
    <p className="text-[15px] font-semibold text-ink">{label}</p>
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink hover:bg-surface-3"
      >
        <Minus className="h-4 w-4" strokeWidth={2} />
      </button>
      <span className="min-w-[1.5rem] text-center text-[15px] font-bold text-ink">{value}</span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white hover:bg-ink/90"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  </div>
);

const DetailsStep = (p: {
  service: TransferService;
  carClass: CarClass;
  hours: number;
  routeCode: string | null;
  quote: TransferQuoteState;
  pickupAt: string;
  setPickupAt: (v: string) => void;
  pax: number;
  setPax: (v: number) => void;
  bags: number;
  setBags: (v: number) => void;
  flight: string;
  setFlight: (v: string) => void;
  train: string;
  setTrain: (v: string) => void;
  phoneDial: string;
  setPhoneDial: (v: string) => void;
  phoneLocal: string;
  setPhoneLocal: (v: string) => void;
  phoneValid: boolean;
  notes: string;
  setNotes: (v: string) => void;
}) => {
  // Split ISO-local into date + time inputs.
  const [datePart, timePart] = p.pickupAt.split("T");
  const setDate = (v: string) => p.setPickupAt(`${v}T${timePart || "09:30"}`);
  const setTime = (v: string) => p.setPickupAt(`${datePart}T${v}`);

  return (
    <div className="space-y-5">
      <TotalPriceBanner service={p.service} carClass={p.carClass} hours={p.hours} routeCode={p.routeCode} quote={p.quote} />
      <p className="-mt-3 text-[12px] leading-snug text-ink-secondary">
        {FREE_CANCELLATION_POLICY_LINE}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Date
          </p>
          <label className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-3 text-[14px] text-ink">
            <Calendar className="h-4 w-4 text-ink-secondary" strokeWidth={1.9} />
            <input
              type="date"
              value={datePart}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none"
            />
          </label>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Pickup
          </p>
          <label className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-3 text-[14px] text-ink">
            <Clock className="h-4 w-4 text-ink-secondary" strokeWidth={1.9} />
            <input
              type="time"
              value={timePart}
              onChange={(e) => setTime(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none"
            />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <Stepper value={p.pax} onChange={p.setPax} min={1} max={9} label="Passengers" />
        <Stepper value={p.bags} onChange={p.setBags} min={0} max={9} label="Bags" />
      </div>

      {p.service === "airport" && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Flight number · optional
          </p>
          <input
            value={p.flight}
            onChange={(e) => p.setFlight(e.target.value)}
            placeholder="e.g. MU587 — we'll track it"
            className="w-full rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
          />
        </div>
      )}

      {p.service === "station" && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Train number · optional
          </p>
          <input
            value={p.train}
            onChange={(e) => p.setTrain(e.target.value)}
            placeholder="e.g. G7 — we'll track arrival"
            className="w-full rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
          />
        </div>
      )}

      <PhoneField
        dial={p.phoneDial}
        setDial={p.setPhoneDial}
        local={p.phoneLocal}
        setLocal={p.setPhoneLocal}
        valid={p.phoneValid}
      />

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          Notes · optional
        </p>
        <textarea
          value={p.notes}
          onChange={(e) => p.setNotes(e.target.value)}
          rows={3}
          placeholder="Child seat, luggage details, meeting point…"
          className="w-full rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
        />
      </div>
    </div>
  );
};

// Contact phone field shared by the airport details step and the
// hourly/station car step. Dial-code picker + local digits input, matching
// the pattern used on the profile editor.
const PhoneField = ({
  dial,
  setDial,
  local,
  setLocal,
  valid,
}: {
  dial: string;
  setDial: (v: string) => void;
  local: string;
  setLocal: (v: string) => void;
  valid: boolean;
}) => {
  const showInvalid = local.trim().length > 0 && !valid;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
        Contact phone
      </p>
      <div className="flex items-stretch gap-2">
        <div className="relative shrink-0">
          <select
            value={dial}
            onChange={(e) => setDial(e.target.value)}
            aria-label="Country dial code"
            className="h-full appearance-none rounded-2xl bg-surface-2 px-4 py-3 pr-8 text-[15px] font-semibold text-ink focus:outline-none"
          >
            {NATIONALITIES.map((n) => (
              <option key={n.code} value={n.dial}>{n.dial}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-secondary" strokeWidth={2} />
        </div>
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value.replace(/[^\d\s-]/g, ""))}
          inputMode="tel"
          maxLength={20}
          placeholder="7700 900000"
          aria-invalid={showInvalid || undefined}
          className="flex-1 rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
        />
      </div>
      <p className="mt-1.5 text-[12px] text-ink-secondary">
        So your driver can reach you if anything changes.
      </p>
      {showInvalid && (
        <p className="mt-1 text-[12px] text-[hsl(var(--brand-red))]">
          Enter a full phone number so the driver can reach you.
        </p>
      )}
    </div>
  );
};

export default TransferForm;