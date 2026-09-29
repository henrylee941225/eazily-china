import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import {
  CheckCircle2, RefreshCw, AlertCircle, Loader2,
  SlidersHorizontal, RotateCcw, Calendar, MapPin, Plane, IdCard, Car, MapPinned,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TaskThread } from "@/components/concierge/TaskThread";
import { TRIP_PASS_PITCH } from "@/lib/tripPassPitch";
import {
  TransferPayCard,
  TransferChangeButton,
  TransferCancelSection,
} from "@/components/concierge/TransferActions";
import { TransferMessages } from "@/components/concierge/TransferMessages";
import {
  STATUS_LABEL,
  TONE_CLASSES,
  isActive,
  statusTone,
  type ConciergeStatus,
} from "@/lib/conciergeStatus";
import {
  CAR_CLASS_LABEL,
  SERVICE_LABEL,
  formatMoney,
  formatChargeMoney,
  // formatDualPriceRef removed — customer-facing prices show locked currency only.
  formatPickupDate,
  formatPickupTime,
  type TransferDetails,
} from "@/lib/transfers";
import {
  isExpiredUnpaidTransfer,
  isNotConfirmedInTimeTransfer,
} from "@/lib/bookingExpiry";
import { resolvePaymentPresentation } from "@/lib/paymentPhase";

type Task = {
  id: string;
  summary: string;
  details: string | null;
  details_json: TransferDetails | Record<string, unknown> | null;
  status: ConciergeStatus;
  category: string;
  price_cents: number;
  currency: string;
  booking_reference: string | null;
  previous_status: ConciergeStatus | null;
  created_at: string;
  paid_at: string | null;
  charge_amount_cents: number | null;
  charge_currency: string | null;
  quoted_gbp_cents: number | null;
  authorized_at: string | null;
  capture_method: string | null;
  amount_paid_cents: number | null;
  user_id: string;
};

type DriverDetails = {
  name: string;
  vehicle: string;
  plate: string;
  meeting_point: string;
};

const banner = (
  status: ConciergeStatus,
  category: string,
  priceLabel: string,
  transfer?: TransferDetails | null,
): { icon: typeof CheckCircle2; title: string; body: string } => {
  const isTransfer = category === "transfer";
  const carLabel = transfer ? CAR_CLASS_LABEL[transfer.car_class] : "";
  const pickupTimeLabel = transfer?.pickup_at ? formatPickupTime(transfer.pickup_at) : "";
  switch (status) {
    case "confirmed":
    case "completed":
      return isTransfer
        ? {
            icon: CheckCircle2,
            title: "Paid & booked",
            body: priceLabel
              ? `${priceLabel} paid · driver details will arrive in the chat before your pickup.`
              : "Driver details will arrive in the chat before your pickup.",
          }
        : {
            icon: CheckCircle2,
            title: "Your booking is confirmed",
            body: "Confirmed by the venue. See you there.",
          };
    case "confirming":
      return isTransfer
        ? {
            icon: Loader2,
            title: "Confirming your driver",
            body: "Assigning a driver and car. Will confirm shortly.",
          }
        : {
            icon: Loader2,
            title: "A person is confirming",
            body: "Checking availability. Usually under 5 minutes.",
          };
    case "change_pending":
      return {
        icon: RefreshCw,
        title: "Change being confirmed",
        body: "We're confirming your change. Your current booking is still held.",
      };
    case "unavailable":
      return isTransfer
        ? {
            icon: AlertCircle,
            title: "We couldn't arrange a car",
            body: "No cars are free for this pickup. You haven't been charged.",
          }
        : {
            icon: AlertCircle,
            title: "We couldn't book this",
            body: "You haven't been charged — ask the concierge for alternatives.",
          };
    case "cancelled":
      return {
        icon: AlertCircle,
        title: "Cancelled",
        body: "This request was cancelled. Nothing further needed.",
      };
    case "pay_to_confirm":
      {
        if (isTransfer) {
          return {
            icon: AlertCircle,
            title: "Complete payment to request your driver",
            body: "Pay below to request your driver — you'll only be charged once your car is confirmed.",
          };
        }
        return {
          icon: CheckCircle2,
          title: "Payment required",
          body: "Pay below to confirm your booking.",
        };
      }
    default:
      return isTransfer
        ? {
            icon: Loader2,
            title: "Request received",
            body: "A person will confirm your driver and share a fixed quote here.",
          }
        : {
            icon: Loader2,
            title: "In progress",
            body: "Request received. We'll update you here.",
          };
  }
};

const BookingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("concierge_tasks")
        .select("id,summary,details,details_json,status,category,price_cents,currency,booking_reference,previous_status,created_at,paid_at,charge_amount_cents,charge_currency,quoted_gbp_cents,authorized_at,capture_method,amount_paid_cents,user_id")
        .eq("id", id)
        .maybeSingle();
      if (!cancelled && data) setTask(data as Task);
    };
    load();
    const channel = supabase
      .channel(`booking:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "concierge_tasks", filter: `id=eq.${id}` },
        (payload) => setTask((prev) => (prev ? { ...prev, ...(payload.new as Task) } : (payload.new as Task))),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (!id) return null;

  if (!task) {
    return (
      <AppLayout title="Booking" backTo="/bookings">
        <div className="mx-auto max-w-[440px] space-y-3">
          <div className="h-20 animate-pulse rounded-2xl bg-surface-2" />
          <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />
        </div>
      </AppLayout>
    );
  }

  const isTransfer = task.category === "transfer";
  const transfer = (isTransfer && task.details_json && (task.details_json as TransferDetails).kind === "transfer")
    ? (task.details_json as TransferDetails)
    : null;
  const driver: DriverDetails | null =
    isTransfer && task.details_json && typeof task.details_json === "object"
      ? (((task.details_json as Record<string, unknown>).driver as DriverDetails) ?? null)
      : null;
  const hasDriver =
    !!driver && !!(driver.name || driver.vehicle || driver.plate || driver.meeting_point);
  // Prefer the locked customer-facing charge; fall back to CNY for legacy tasks.
  const chargeCents = task.charge_amount_cents ?? 0;
  const chargeCurrency = task.charge_currency ?? "";
  const priceLabel =
    chargeCents > 0
      ? formatChargeMoney(chargeCents, chargeCurrency)
      : task.price_cents > 0
        ? formatMoney(task.price_cents, task.currency)
        : "";
  const chargeOnlyLabel = chargeCents > 0 ? formatChargeMoney(chargeCents, chargeCurrency) : "";
  const phaseInput = {
    status: task.status,
    category: task.category,
    paid_at: task.paid_at,
    authorized_at: task.authorized_at,
    hold_released_at: (task as { hold_released_at?: string | null }).hold_released_at ?? null,
    details_json: task.details_json,
  };
  const expiredUnpaid = isExpiredUnpaidTransfer(phaseInput);
  const notConfirmedInTime = isNotConfirmedInTimeTransfer(phaseInput);
  const staleTransfer = expiredUnpaid || notConfirmedInTime;
  const phase = resolvePaymentPresentation(phaseInput, { priceLabel });
  const bRaw = banner(task.status, task.category, priceLabel, transfer);
  const b = phase
    ? { icon: phase.bannerIcon, title: phase.bannerTitle, body: phase.body }
    : bRaw;
  const BIcon = b.icon;
  const tone = phase ? phase.toneClasses : TONE_CLASSES[statusTone(task.status)];
  const spinBanner = phase ? phase.spin : task.status === "confirming";
  const active = isActive(task.status) && !staleTransfer;
  const displayName = profile?.display_name || profile?.full_name || "you";
  const isConfirmed = task.status === "confirmed" || task.status === "completed";
  const chipTone = tone;
  const titleForHeader = isTransfer ? (transfer ? SERVICE_LABEL[transfer.service] : "Transfer") : task.summary;
  const showPrimaryCta = active && task.status !== "pay_to_confirm";
  const displayStatusLabel = phase ? phase.chipLabel : STATUS_LABEL[task.status];


  return (
    <AppLayout
      title={titleForHeader}
      backTo="/bookings"
      headerRight={
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${chipTone.bg} ${chipTone.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${chipTone.dot}`} aria-hidden />
          {displayStatusLabel}
        </span>
      }
    >
      <div className="mx-auto max-w-[440px] space-y-4">
        {/* Status banner */}
        <div className={`flex items-start gap-3 rounded-2xl ${tone.bg} p-3.5`}>
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ${tone.text}`}
          >
            <BIcon
              className={`h-4 w-4 ${spinBanner ? "animate-spin" : ""}`}
              strokeWidth={2}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight text-ink">{b.title}</p>
            <p className="mt-1 text-[13px] leading-snug text-ink/75">{b.body}</p>
          </div>
        </div>

        {/* Pay card — unpaid transfers only. Renders quote + Pay CTA. */}

        {isTransfer && !staleTransfer && (
          <TransferPayCard task={task} isOwner={!!user && user.id === task.user_id} />
        )}

        {/* Driver card — shown once ops have assigned a driver */}
        {isTransfer && hasDriver && driver && (
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              Your driver
            </p>
            {driver.name && (
              <p className="mt-2 text-[20px] font-bold leading-tight text-ink">{driver.name}</p>
            )}
            {driver.vehicle && (
              <p className="mt-1 text-[14px] text-ink-secondary">{driver.vehicle}</p>
            )}
            {driver.plate && (
              <div className="mt-3 inline-flex items-center rounded-xl border border-ink bg-white px-3 py-2">
                <span className="text-[22px] font-extrabold tracking-[0.14em] text-ink">
                  {driver.plate}
                </span>
              </div>
            )}
            {driver.meeting_point && (
              <div className="mt-3 flex items-start gap-2.5 text-[14px] text-ink">
                <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-ink-secondary" strokeWidth={1.9} />
                <span>{driver.meeting_point}</span>
              </div>
            )}
            {task.booking_reference && (
              <div className="mt-3 flex items-center gap-2.5 text-[14px] text-ink">
                <IdCard className="h-4 w-4 shrink-0 text-ink-secondary" strokeWidth={1.9} />
                <span>
                  Ref <span className="font-bold">#{task.booking_reference}</span>
                </span>
              </div>
            )}
            <p className="mt-3 text-[13px] leading-snug text-ink-secondary">
              Your driver has your number and will call if needed.
            </p>
          </div>
        )}

        {/* Transfer detail card */}
        {isTransfer && transfer ? (
          <TransferDetailCard
            transfer={transfer}
            priceLabel={priceLabel}
            isConfirmed={isConfirmed}
            bookingReference={task.booking_reference}
            showRef={!hasDriver}
            paidChipLabel={
              isTransfer && task.paid_at && chargeOnlyLabel ? `Paid ${chargeOnlyLabel}` : null
            }
          />
        ) : (
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              {task.status === "change_pending" ? "Currently held" : "Details"}
            </p>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-snug text-ink">
              {task.details?.trim() || task.summary}
            </p>
            {isConfirmed && task.booking_reference && (
              <p className="mt-3 text-[13px] text-ink-secondary">
                Held under <span className="font-semibold text-ink">"{displayName}"</span> · Ref{" "}
                <span className="font-semibold text-ink">#{task.booking_reference}</span>
              </p>
            )}
          </div>
        )}

        {/* Pass pitch — only on the traveller's first (free) booking, and only
            once it's actually confirmed. */}
        {!isTransfer && isConfirmed && (
          <FirstBookingPassCard
            taskId={task.id}
            freeBookingTaskId={
              (profile as { free_booking_task_id?: string | null } | null)?.free_booking_task_id ?? null
            }
            userId={user?.id ?? null}
          />
        )}

        {/* Thread — restaurants only; transfers are chat-free (status banner + cards tell the story) */}
        {!isTransfer && <TaskThread taskId={task.id} />}

        {/* Transfer booking thread: system notes, ops replies and a composer
            bound to this task (no gate). Terminal bookings are
            read-only. */}
        {isTransfer && (
          <TransferMessages taskId={task.id} canSend={active && !!user && user.id === task.user_id} />
        )}

        {/* Request a change — active transfers, below cards */}
        {isTransfer && !staleTransfer && (
          <TransferChangeButton task={task} isOwner={!!user && user.id === task.user_id} />
        )}

        {/* Free cancellation policy / cancel action — confirmed transfers */}
        {isTransfer && !staleTransfer && (
          <TransferCancelSection task={task} isOwner={!!user && user.id === task.user_id} />
        )}

        {/* Primary action */}
        <div className="pt-1">
          {showPrimaryCta ? (
            <button
              type="button"
              onClick={() => navigate(`/bookings/${task.id}/manage`)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-ink/90"
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
              {isTransfer ? "Manage transfer" : "Manage reservation"}
            </button>
          ) : task.status === "unavailable" || staleTransfer ? (
            <button
              type="button"
              onClick={() => navigate(isTransfer ? "/transfers" : "/concierge/chat")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-ink/90"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2} />
              {isTransfer ? "Request another transfer" : "Make another reservation"}
            </button>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
};

// The pass pitch, at the moment of success. Renders only when THIS booking is
// the one that consumed the traveller's free booking and they hold no pass.
const FirstBookingPassCard = ({
  taskId,
  freeBookingTaskId,
  userId,
}: {
  taskId: string;
  freeBookingTaskId: string | null;
  userId: string | null;
}) => {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!userId || freeBookingTaskId !== taskId) { setShow(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("booking_entitlement_state", { user_uuid: userId });
      if (cancelled) return;
      const active = Array.isArray(data) ? data[0] : data;
      setShow(!active?.id);
    })();
    return () => { cancelled = true; };
  }, [userId, freeBookingTaskId, taskId]);
  if (!show) return null;
  return (
    <div className="rounded-2xl border border-border bg-tint-warm p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" strokeWidth={2} fill="currentColor" />
        <p className="text-[14px] leading-snug text-ink">{TRIP_PASS_PITCH}</p>
      </div>
      <button
        type="button"
        onClick={() => navigate("/book/restaurant")}
        className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-ink px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-ink/90"
      >
        Activate Trip Pass
      </button>
    </div>
  );
};

const TransferDetailCard = ({
  transfer,
  priceLabel,
  isConfirmed,
  bookingReference,
  showRef,
  paidChipLabel,
}: {
  transfer: TransferDetails;
  priceLabel: string;
  isConfirmed: boolean;
  bookingReference: string | null;
  showRef: boolean;
  paidChipLabel: string | null;
}) => {
  const carLine = `${CAR_CLASS_LABEL[transfer.car_class]}${transfer.service === "airport" ? " sedan" : ""}`;
  const date = transfer.pickup_at ? formatPickupDate(transfer.pickup_at) : "";
  const time = transfer.pickup_at ? formatPickupTime(transfer.pickup_at) : "";
  const pickupText = transfer.direction === "arrival" && transfer.service === "airport"
    ? `${transfer.airport_name ?? "Airport"} (${transfer.airport_code ?? ""})${transfer.terminal ? " · " + transfer.terminal : ""}`
    : transfer.direction === "arrival" && transfer.service === "station"
      ? transfer.station_name || transfer.station_code || "Station"
      : transfer.pickup_address || "";
  const dropoffText = transfer.direction === "departure" && transfer.service === "airport"
    ? `${transfer.airport_name ?? "Airport"} (${transfer.airport_code ?? ""})${transfer.terminal ? " · " + transfer.terminal : ""}`
    : transfer.direction === "departure" && transfer.service === "station"
      ? transfer.station_name || transfer.station_code || "Station"
      : transfer.dropoff_address || "";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      {isConfirmed && (
        <div className="relative flex h-32 items-center justify-center bg-[repeating-linear-gradient(135deg,hsl(var(--surface-2))_0px,hsl(var(--surface-2))_10px,hsl(var(--surface-3))_10px,hsl(var(--surface-3))_20px)]">
          <div className="flex flex-col items-center gap-1 text-ink-tertiary">
            <Car className="h-8 w-8" strokeWidth={1.4} />
            <p className="text-[12px]">photo · {CAR_CLASS_LABEL[transfer.car_class]}</p>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[16px] font-bold text-ink">{carLine}</p>
          {paidChipLabel ? (
            <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-success">
              {paidChipLabel}
            </span>
          ) : (
            priceLabel && <p className="text-[16px] font-extrabold text-ink">{priceLabel}</p>
          )}
        </div>
        <ul className="mt-3 space-y-2 text-[14px] text-ink">
          {(date || time) && (
            <li className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 shrink-0 text-ink-secondary" strokeWidth={1.9} />
              <span>
                {date}{date && time ? " · " : ""}
                {time && <span className="font-semibold">{time} pickup</span>}
              </span>
            </li>
          )}
          {pickupText && (
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden />
              <span>{pickupText}</span>
            </li>
          )}
          {dropoffText && (
            <li className="flex items-start gap-2.5">
              {transfer.service === "airport" ? (
                <Plane className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-red))]" strokeWidth={1.9} />
              ) : (
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-red))]" strokeWidth={1.9} />
              )}
              <span>{dropoffText}</span>
            </li>
          )}
          {transfer.hours && (
            <li className="flex items-center gap-2.5 text-ink-secondary">
              <span className="text-[13px]">{transfer.hours} hours on call</span>
            </li>
          )}
          {isConfirmed && showRef && bookingReference && (
            <li className="flex items-center gap-2.5">
              <IdCard className="h-4 w-4 shrink-0 text-ink-secondary" strokeWidth={1.9} />
              <span>
                Ref <span className="font-bold">#{bookingReference}</span>
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default BookingDetail;