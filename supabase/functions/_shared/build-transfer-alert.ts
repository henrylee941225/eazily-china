// Builds the structured TransferAlertData payload consumed by the "driver
// dispatch" ops-alert template. Extracted so both create-task (legacy path)
// and the payments-webhook (new paid-transfer alert) can share it without
// duplication.

import type { TransferAlertData } from "./ops-alert.ts";
import { AIRPORT_LOOKUP, STATION_LOOKUP, haversineKm } from "./transfer-lookups.ts";

export function buildTransferAlertData(args: {
  taskId: string;
  detailsJson: Record<string, unknown>;
  passenger: string;
  fallbackPhone?: string | null;
}): TransferAlertData | null {
  const dj = args.detailsJson;
  const svc = String(dj.service ?? "");
  if (svc !== "airport" && svc !== "hourly" && svc !== "station") return null;

  const carClass = String(dj.car_class ?? "standard");
  const carType =
    carClass === "premium" ? "Premium sedan"
    : carClass === "van" ? "Van (MPV)"
    : carClass === "first" ? "First Class sedan"
    : carClass === "maybach" ? "Maybach"
    : "Standard";
  const pax = Number(dj.pax ?? 1) || 1;
  const bags = Number((dj.bags ?? dj.luggage) ?? 0) || 0;
  const pickupAt = String(dj.pickup_at ?? dj.start_at ?? "");
  const notes = typeof dj.notes === "string" && dj.notes.trim() ? String(dj.notes).trim() : null;
  const flightNo = typeof dj.flight_number === "string" && dj.flight_number.trim() ? String(dj.flight_number).trim() : "";
  const trainNo = typeof dj.train_number === "string" && dj.train_number.trim() ? String(dj.train_number).trim() : "";
  const flightOrTrainLine =
    svc === "airport" && flightNo ? `Flight ${flightNo}`
    : svc === "station" && trainNo ? `Train ${trainNo}`
    : null;

  const strTrim = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : "";
  const pickupName = strTrim(dj.pickup_address);
  const pickupFull = strTrim(dj.pickup_address_full);
  const dropoffName = strTrim(dj.dropoff_address);
  const dropoffFull = strTrim(dj.dropoff_address_full);
  const pickupCoord = typeof dj.pickup_lat === "number" && typeof dj.pickup_lng === "number"
    ? { lat: dj.pickup_lat as number, lng: dj.pickup_lng as number } : null;
  const dropoffCoord = typeof dj.dropoff_lat === "number" && typeof dj.dropoff_lng === "number"
    ? { lat: dj.dropoff_lat as number, lng: dj.dropoff_lng as number } : null;

  const terminal = typeof dj.terminal === "string" && dj.terminal.trim() ? String(dj.terminal).trim() : "";
  const airportCode = typeof dj.airport_code === "string" ? String(dj.airport_code).trim() : "";
  const airportRef = airportCode ? AIRPORT_LOOKUP[airportCode] : undefined;
  const stationCode = typeof dj.station_code === "string" ? String(dj.station_code).trim() : "";
  const stationRef = stationCode ? STATION_LOOKUP[stationCode] : undefined;

  const airportPoint = airportRef
    ? {
        title: terminal ? `${airportRef.name} · Terminal ${terminal.replace(/^T/i, "")}` : airportRef.name,
        subtitle: terminal ? `${airportRef.cn} ${terminal}` : airportRef.cn,
        coord: airportRef.coord,
      }
    : null;
  const stationPoint = stationRef
    ? { title: stationRef.name, subtitle: stationRef.cn, coord: stationRef.coord }
    : null;
  // Render rules: when both display name and full address exist, the display
  // name (venue/label the traveller saw) is the title and the full address is
  // the subtitle. When only one exists, it becomes the title with no
  // subtitle. Never derive a title by splitting the address on a comma —
  // that dropped venue names like "Hilton Garden Inn Shanghai Hongqiao NECC".
  const addrPoint = (
    name: string,
    full: string,
    coord: { lat: number; lng: number } | null,
  ) => {
    if (name && full && name !== full) {
      return { title: name, subtitle: full, coord };
    }
    const only = name || full;
    return only ? { title: only, coord } : null;
  };

  let pickup: { title: string; subtitle?: string; coord?: { lat: number; lng: number } | null } | null = null;
  let dropoff: { title: string; subtitle?: string; coord?: { lat: number; lng: number } | null } | null = null;
  let pCoord: { lat: number; lng: number } | null = null;
  let dCoord: { lat: number; lng: number } | null = null;

  const direction = String(dj.direction ?? "");
  if (svc === "airport") {
    if (direction === "arrival") {
      pickup = airportPoint; pCoord = airportPoint?.coord ?? null;
      const a = addrPoint(dropoffName, dropoffFull, dropoffCoord);
      dropoff = a; dCoord = a?.coord ?? null;
    } else {
      const a = addrPoint(pickupName, pickupFull, pickupCoord);
      pickup = a; pCoord = a?.coord ?? null;
      dropoff = airportPoint; dCoord = airportPoint?.coord ?? null;
    }
  } else if (svc === "station") {
    const toStation = dj.station_direction === "to_station" || direction === "departure";
    if (toStation) {
      const a = addrPoint(pickupName, pickupFull, pickupCoord);
      pickup = a; pCoord = a?.coord ?? null;
      dropoff = stationPoint; dCoord = stationPoint?.coord ?? null;
    } else {
      pickup = stationPoint; pCoord = stationPoint?.coord ?? null;
      const a = addrPoint(dropoffName, dropoffFull, dropoffCoord);
      dropoff = a; dCoord = a?.coord ?? null;
    }
  } else {
    const a = addrPoint(pickupName, pickupFull, pickupCoord);
    pickup = a; pCoord = a?.coord ?? null;
    const routePlan = typeof dj.route_plan === "string" ? String(dj.route_plan).trim() : "";
    const hours = Number(dj.hours ?? 0);
    if (routePlan || hours) {
      dropoff = { title: hours ? `As directed · ${hours}h` : "As directed", subtitle: routePlan || undefined };
    }
  }

  const distanceKm = pCoord && dCoord ? haversineKm(pCoord, dCoord) : null;
  const contactPhone = (() => {
    const fromDetails =
      typeof dj.contact_phone === "string" && dj.contact_phone.trim()
        ? String(dj.contact_phone).trim()
        : typeof dj.phone === "string" && dj.phone.trim()
          ? String(dj.phone).trim()
          : "";
    return fromDetails || (args.fallbackPhone ?? "") || null;
  })();

  return {
    service: svc as TransferAlertData["service"],
    taskShortId: args.taskId.slice(0, 8),
    pickupWhen: pickupAt,
    pickup: pickup ? { title: pickup.title, subtitle: pickup.subtitle } : { title: "Pickup location" },
    dropoff: dropoff ? { title: dropoff.title, subtitle: dropoff.subtitle } : null,
    distanceKm: distanceKm && distanceKm > 0 ? distanceKm : null,
    passenger: args.passenger,
    phone: contactPhone,
    carType,
    pax,
    bags,
    notes,
    flightOrTrainLine,
  };
}