import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  BadgeDollarSign,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Inbox,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Send,
  Sparkles,
  Utensils,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { invokeFn } from "@/lib/invokeFn";
import { TaskThread } from "@/components/concierge/TaskThread";
import { AcceptDriverDialog } from "@/components/concierge/AcceptDriverDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  STATUS_LABEL,
  isTerminal,
  statusTone,
  type ConciergeStatus,
} from "@/lib/conciergeStatus";
import {
  CAR_CLASS_LABEL,
  formatChargeMoney,
  formatMoney,
  formatPickupDate,
  formatPickupTime,
  type TransferDetails,
} from "@/lib/transfers";
import { OpsLayout } from "./OpsLayout";

type TaskRow = {
  id: string;
  user_id: string;
  assistant_id: string | null;
  summary: string;
  category: string;
  status: ConciergeStatus;
  created_at: string;
  price_cents: number;
  currency: string;
  details_json: TransferDetails | Record<string, unknown> | null;
  charge_amount_cents: number | null;
  charge_currency: string | null;
  quoted_gbp_cents: number | null;
  paid_at: string | null;
  authorized_at: string | null;
  capture_method: string | null;
  booking_reference: string | null;
  completed_at: string | null;
  entitlement_id: string | null;
  stripe_env: string | null;
};

const TASK_COLS =
  "id,user_id,assistant_id,summary,category,status,created_at,price_cents,currency,details_json,charge_amount_cents,charge_currency,quoted_gbp_cents,paid_at,authorized_at,capture_method,booking_reference,completed_at,entitlement_id,stripe_env";

// A first-free restaurant request: no price and no entitlement behind it.
// The customer hasn't paid us anything yet, and this is their first
// impression of us.
const isFirstFreeBooking = (t: TaskRow): boolean =>
  typeof t.category === "string" &&
  t.category.startsWith("restaurant") &&
  !t.entitlement_id &&
  Number(t.price_cents ?? 0) === 0;

const HOUR_MS = 60 * 60 * 1000;

/** A transfer whose pickup is more than 1h in the past — a driver can no
 *  longer be dispatched. Ops still see the row so they can clear it. */
const isTransferPickupMissed = (t: TaskRow): boolean => {
  if (t.category !== "transfer") return false;
  const dj = t.details_json as { pickup_at?: unknown } | null;
  const pickup = dj && typeof dj === "object" ? dj.pickup_at : null;
  if (typeof pickup !== "string" || !pickup) return false;
  const ms = Date.parse(pickup);
  if (!Number.isFinite(ms)) return false;
  return ms < Date.now() - HOUR_MS;
};

const TONE_CHIP: Record<ReturnType<typeof statusTone>, string> = {
  pending: "bg-pending-tint text-pending",
  success: "bg-success-tint text-success",
  error: "bg-error-tint text-error",
};

type ActionId =
  | "in_progress"
  | "confirming"
  | "confirmed"
  | "change_pending"
  | "revert"
  | "unavailable"
  | "completed";

const ACTION_LABEL: Record<ActionId, string> = {
  in_progress: "Start work",
  confirming: "A person is confirming",
  confirmed: "Confirmed…",
  change_pending: "Change pending",
  revert: "Confirm change",
  unavailable: "Unavailable",
  completed: "Mark complete",
};

const nextRestaurantActions = (status: ConciergeStatus): ActionId[] => {
  if (isTerminal(status)) return [];
  switch (status) {
    case "assigned":
    case "pending":
      return ["confirming", "in_progress", "confirmed", "change_pending", "unavailable"];
    case "in_progress":
      return ["confirming", "confirmed", "change_pending", "unavailable", "completed"];
    case "confirming":
      return ["confirmed", "change_pending", "unavailable"];
    case "confirmed":
      return ["change_pending", "unavailable"];
    case "change_pending":
      return ["revert", "confirmed", "unavailable"];
    default:
      return [];
  }
};

/** Standalone dispatch queue for the operations fulfilment team. */
const OpsDispatch = () => {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const taskParam = searchParams.get("task");
  const [me, setMe] = useState<string | null>(null);
  const [isAssistant, setIsAssistant] = useState<boolean | null>(null);
  const [open, setOpen] = useState<TaskRow[]>([]);
  const [mine, setMine] = useState<TaskRow[]>([]);
  // Restaurant owners with an active Trip Pass — used to surface a "PASS"
  // chip in the ops queue and float those tasks to the top. Derived from
  // the `ops_pass_holders` SECURITY DEFINER RPC (concierge_assistant only).
  const [passHolders, setPassHolders] = useState<Set<string>>(() => new Set());
  const [linked, setLinked] = useState<TaskRow | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [acceptFor, setAcceptFor] = useState<{ id: string; claimFirst: boolean } | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);

  // Per-user category filter, persisted in localStorage. "all" (default),
  // "transfers", or "restaurants". Working filter only — access control is
  // unchanged; every concierge_assistant still receives every row from the
  // queries above.
  const CAT_FILTER_KEY = "ops.catFilter";
  type CatFilter = "all" | "transfers" | "restaurants";
  const [catFilter, setCatFilter] = useState<CatFilter>(() => {
    if (typeof window === "undefined") return "all";
    const v = window.localStorage.getItem(CAT_FILTER_KEY);
    return v === "transfers" || v === "restaurants" ? v : "all";
  });
  const setCatFilterPersist = (v: CatFilter) => {
    setCatFilter(v);
    try {
      window.localStorage.setItem(CAT_FILTER_KEY, v);
    } catch { /* ignore */ }
  };
  const matchesFilter = (t: TaskRow): boolean => {
    if (catFilter === "all") return true;
    if (catFilter === "transfers") return t.category === "transfer";
    return typeof t.category === "string" && t.category.startsWith("restaurant");
  };

  const assistantName =
    profile?.display_name ||
    (profile as unknown as { full_name?: string })?.full_name ||
    user?.email?.split("@")[0] ||
    null;

  const refresh = async (uid: string) => {
    const [pendingRes, transferHeldRes, mineRes] = await Promise.all([
      supabase
        .from("concierge_tasks")
        .select(TASK_COLS)
        .eq("status", "pending")
        .is("assistant_id", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("concierge_tasks")
        .select(TASK_COLS)
        .eq("category", "transfer")
        .eq("status", "pay_to_confirm")
        .is("assistant_id", null)
        .or("paid_at.not.is.null,authorized_at.not.is.null")
        .order("created_at", { ascending: false }),
      supabase
        .from("concierge_tasks")
        .select(TASK_COLS)
        .eq("assistant_id", uid)
        .order("created_at", { ascending: false }),
    ]);

    const firstErr = pendingRes.error ?? transferHeldRes.error ?? mineRes.error ?? null;
    if (firstErr) {
      console.error("OpsDispatch queue load failed:", firstErr);
      setQueueError(firstErr.message || "Couldn't load the queue");
      return;
    }
    setQueueError(null);

    const byId = new Map<string, TaskRow>();
    for (const row of [
      ...(pendingRes.data ?? []),
      ...(transferHeldRes.data ?? []),
    ] as TaskRow[]) {
      byId.set(row.id, row);
    }
    const merged = Array.from(byId.values()).sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
    );
    setOpen(merged);
    setMine((mineRes.data ?? []) as TaskRow[]);

    // Refresh pass-holder set for owners visible across both queues, so
    // restaurant cards can show a "PASS" chip and float to the top.
    const ownerIds = Array.from(
      new Set(
        [...merged, ...((mineRes.data ?? []) as TaskRow[])]
          .filter((t) => typeof t.category === "string" && t.category.startsWith("restaurant"))
          .map((t) => t.user_id),
      ),
    );
    if (ownerIds.length === 0) {
      setPassHolders(new Set());
    } else {
      // Cast: types regenerate after the migration lands; keep compiling now.
      const { data: holders, error: holdersErr } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "ops_pass_holders",
        { user_ids: ownerIds },
      );
      if (holdersErr) {
        console.warn("ops_pass_holders failed:", holdersErr);
        setPassHolders(new Set());
      } else {
        const rows = Array.isArray(holders) ? (holders as unknown[]) : [];
        setPassHolders(
          new Set(
            rows
              .map((r) =>
                typeof r === "string"
                  ? r
                  : r && typeof r === "object" && "user_id" in (r as Record<string, unknown>)
                    ? String((r as Record<string, unknown>).user_id)
                    : "",
              )
              .filter(Boolean),
          ),
        );
      }
    }
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) {
        setIsAssistant(false);
        return;
      }
      setMe(uid);
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "concierge_assistant")
        .maybeSingle();
      const ok = !!role;
      setIsAssistant(ok);
      if (ok) await refresh(uid);
    })();
  }, []);

  // Deep link from ops alert email (?task=<id>): pull the row directly so
  // it renders even when neither queue query would surface it.
  useEffect(() => {
    if (!taskParam || !isAssistant) return;
    (async () => {
      const { data, error } = await supabase
        .from("concierge_tasks")
        .select(TASK_COLS)
        .eq("id", taskParam)
        .maybeSingle();
      if (error) {
        console.error("Deep-link task fetch failed:", error);
        return;
      }
      if (data) setLinked(data as TaskRow);
    })();
  }, [taskParam, isAssistant]);

  const claim = async (taskId: string) => {
    setClaiming(taskId);
    const { error } = await invokeFn("concierge-claim-task", { task_id: taskId });
    setClaiming(null);
    if (error) {
      toast.error(error.message || "Couldn't claim — someone may have picked it up.");
      return;
    }
    toast.success("Task claimed");
    if (me) await refresh(me);
  };

  const runAction = async (
    taskId: string,
    action: ActionId,
    opts: { claimFirst?: boolean; extraBody?: Record<string, unknown> } = {},
  ) => {
    let body: Record<string, unknown> = { task_id: taskId };

    if (action === "revert") body.revert = true;
    else if (action === "confirmed") {
      const ref = window.prompt("Booking reference (e.g. EZ-4831). Shown to the traveller.");
      if (!ref || !ref.trim()) return;
      body.status = "confirmed";
      body.booking_reference = ref.trim();
    } else if (action === "unavailable") {
      const t = mine.concat(open).find((x) => x.id === taskId);
      const isPaid = !!t?.paid_at;
      const isTransfer = t?.category === "transfer";
      const msg = isPaid
        ? "Mark this task unavailable? The customer's payment will be REFUNDED in full via Stripe. This cannot be undone from the app."
        : isTransfer
          ? "Mark this transfer unavailable? The customer will see it can't be arranged and won't be charged."
          : "Mark this task unavailable?";
      if (!window.confirm(msg)) return;
      body.status = "unavailable";
    } else body.status = action;
    if (opts.extraBody) body = { ...body, ...opts.extraBody };

    setUpdating(taskId);
    if (opts.claimFirst) {
      const { error: claimErr } = await invokeFn("concierge-claim-task", { task_id: taskId });
      if (claimErr) {
        setUpdating(null);
        toast.error(
          /already claimed/i.test(claimErr.message)
            ? "Already claimed by another assistant"
            : claimErr.message || "Couldn't claim task",
        );
        if (me) await refresh(me);
        return;
      }
    }
    const { error } = await invokeFn("concierge-update-task", body);
    setUpdating(null);
    if (error) {
      toast.error(error.message || "Couldn't update — check the transition is allowed.");
      if (me) await refresh(me);
      return;
    }
    toast.success(`Status: ${ACTION_LABEL[action]}`);
    if (me) await refresh(me);
  };

  // ---- Sectioning (hooks MUST run on every render — keep above any early returns) ----

  const openList = useMemo(() => {
    if (!linked || linked.assistant_id || open.some((t) => t.id === linked.id)) return open;
    return [linked, ...open];
  }, [open, linked]);
  const mineList = useMemo(() => {
    if (!linked || linked.assistant_id !== me || mine.some((t) => t.id === linked.id)) return mine;
    return [linked, ...mine];
  }, [mine, linked, me]);

  // ---- Access wall (after all hooks) --------------------------------------

  if (isAssistant === null) {
    return (
      <OpsLayout>
        <div className="flex justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-ink-secondary" />
        </div>
      </OpsLayout>
    );
  }
  if (!isAssistant) {
    return (
      <OpsLayout>
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-border bg-white p-6 text-center">
          <Inbox className="mx-auto h-6 w-6 text-ink-secondary" />
          <p className="mt-2 text-[16px] font-semibold text-ink">Dispatch access required</p>
          <p className="mt-1 text-[13px] text-ink-secondary">
            This portal is for the eazilyChina operations team.
          </p>
          <p className="mt-3 text-[13px] text-ink-secondary">
            Signed up? Ask your eazilyChina contact to activate your access, then reload.
          </p>
        </div>
      </OpsLayout>
    );
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isDoneToday = (t: TaskRow) => {
    if (t.status !== "completed" && t.status !== "confirmed" && t.status !== "unavailable" && t.status !== "cancelled")
      return false;
    const ref = t.completed_at ? new Date(t.completed_at) : new Date(t.created_at);
    return ref.getTime() >= startOfToday.getTime();
  };

  const newQueue = openList
    .filter((t) => t.status !== "change_pending")
    .filter(matchesFilter)
    // Restaurant pass-holders first, then the existing created_at ordering.
    .sort((a, b) => {
      const aPass = passHolders.has(a.user_id) && a.category.startsWith("restaurant");
      const bPass = passHolders.has(b.user_id) && b.category.startsWith("restaurant");
      if (aPass !== bPass) return aPass ? -1 : 1;
      return 0;
    });
  const changeRequests = [...openList, ...mineList]
    .filter(
      (t, i, arr) => t.status === "change_pending" && arr.findIndex((x) => x.id === t.id) === i,
    )
    .filter(matchesFilter);
  const active = mineList
    .filter((t) => !isTerminal(t.status) && t.status !== "change_pending")
    .filter(matchesFilter);
  const doneToday = mineList.filter(isDoneToday).filter(matchesFilter);
  const claimedByOther =
    linked && linked.assistant_id && linked.assistant_id !== me ? linked : null;

  // ---- Card renderers -----------------------------------------------------

  const cardActionProps = (t: TaskRow) => ({
    disabled: updating === t.id || claiming === t.id,
  });

  const renderTransferPrimary = (t: TaskRow, isQueue: boolean) => {
    const claimFirst = isQueue;
    const missed = isTransferPickupMissed(t);
    if (missed) {
      // A driver can no longer be assigned to a past pickup — hide
      // Accept & assign entirely and expose only the terminal "Can't
      // fulfil" action. Ops must still see the card so they can clear it.
      return (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => runAction(t.id, "unavailable", { claimFirst })}
            {...cardActionProps(t)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-error/40 bg-white px-4 py-2.5 text-[13px] font-semibold text-error transition hover:bg-error-tint disabled:opacity-60"
          >
            Can't fulfil
          </button>
        </div>
      );
    }
    return (
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setAcceptFor({ id: t.id, claimFirst })}
          {...cardActionProps(t)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60"
        >
          <Car className="h-4 w-4" strokeWidth={2} />
          Accept &amp; assign driver
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            {...cardActionProps(t)}
            aria-label="More actions"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-ink transition hover:bg-surface-3 disabled:opacity-50"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => runAction(t.id, "unavailable", { claimFirst })}
              className="cursor-pointer text-error focus:text-error"
            >
              Can't fulfil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const renderChangeActions = (t: TaskRow, isQueue: boolean) => {
    const claimFirst = isQueue;
    return (
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => runAction(t.id, "revert", { claimFirst, extraBody: { apply_change: true } })}
          {...cardActionProps(t)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          Apply change
        </button>
        <button
          onClick={() => runAction(t.id, "revert", { claimFirst, extraBody: { cant_accommodate: true } })}
          {...cardActionProps(t)}
          className="inline-flex flex-1 items-center justify-center rounded-full border border-border bg-white px-4 py-2.5 text-[13px] font-semibold text-ink disabled:opacity-60"
        >
          Can't accommodate
        </button>
      </div>
    );
  };

  const renderRestaurantActions = (t: TaskRow, isQueue: boolean) => {
    const actions = nextRestaurantActions(t.status);
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isQueue && (
          <button
            onClick={() => claim(t.id)}
            {...cardActionProps(t)}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {claiming === t.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Claim task
          </button>
        )}
        {!isQueue && (
          <button
            onClick={() => setActiveThread((p) => (p === t.id ? null : t.id))}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface-3"
          >
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
            {activeThread === t.id ? "Close thread" : "Message thread"}
          </button>
        )}
        {!isQueue && actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              {...cardActionProps(t)}
              aria-label="Task actions"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-ink hover:bg-surface-3 disabled:opacity-50"
            >
              {updating === t.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-ink-secondary">
                Update status
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {actions.map((a) => (
                <DropdownMenuItem
                  key={a}
                  onClick={() => runAction(t.id, a)}
                  className={`cursor-pointer text-sm ${a === "unavailable" ? "text-error focus:text-error" : ""}`}
                >
                  {ACTION_LABEL[a]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!isQueue && t.status === "pay_to_confirm" && !t.paid_at && !t.authorized_at && t.price_cents > 0 && (
          <button
            onClick={async () => {
              setUpdating(t.id);
              const { error } = await invokeFn("concierge-request-payment", { task_id: t.id });
              setUpdating(null);
              if (error) {
                toast.error("Couldn't send nudge");
                return;
              }
              toast.success("Nudge sent");
            }}
            disabled={updating === t.id}
            className="inline-flex items-center gap-1 rounded-full bg-brand-red px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            <Send className="h-3 w-3" strokeWidth={2} />
            Nudge to pay
          </button>
        )}
      </div>
    );
  };

  const renderCard = (t: TaskRow, opts: { isQueue: boolean; emphasise?: boolean }) => {
    const { isQueue, emphasise } = opts;
    const isTransfer = t.category === "transfer";
    const isChange = t.status === "change_pending";
    return (
      <article
        key={t.id}
        className={`rounded-2xl border bg-white p-4 ${
          emphasise ? "border-ink shadow-sm ring-1 ring-ink/5" : "border-border"
        }`}
      >
        <CardHeader t={t} emphasise={emphasise} hasPass={passHolders.has(t.user_id)} />
        {isTransfer ? <TransferBody t={t} /> : <RestaurantBody t={t} />}
        {isTransfer && isChange && <ChangeDiff row={t} />}
        {isTransfer && isChange
          ? renderChangeActions(t, isQueue)
          : isTransfer
            ? renderTransferPrimary(t, isQueue)
            : renderRestaurantActions(t, isQueue)}
        {!isTransfer && activeThread === t.id && <TaskThread taskId={t.id} />}
      </article>
    );
  };

  return (
    <OpsLayout assistantName={assistantName}>
      {/* Category filter — client-side working filter, persisted per user. */}
      <div className="mb-3 flex gap-1 rounded-full bg-surface-2 p-1">
        {([
          ["all", "All"],
          ["transfers", "Transfers"],
          ["restaurants", "Restaurants"],
        ] as Array<[CatFilter, string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCatFilterPersist(id)}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
              catFilter === id ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {queueError && (
        <div className="mb-3 flex items-start gap-2 rounded-2xl border border-error/30 bg-error-tint p-3 text-[13px] text-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <div className="flex-1">
            <p className="font-semibold">Couldn't load the queue</p>
            <p className="text-[12px] opacity-80">{queueError}</p>
          </div>
          <button
            onClick={() => me && refresh(me)}
            className="rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-white"
          >
            Retry
          </button>
        </div>
      )}

      {claimedByOther && (
        <SectionShell title="Linked task (read-only)" count={1}>
          {renderCard(claimedByOther, { isQueue: false })}
          <p className="mt-1 px-1 text-[11px] text-ink-secondary">
            Claimed by another assistant — actions disabled.
          </p>
        </SectionShell>
      )}

      <SectionShell
        title="New — needs a driver"
        count={newQueue.length}
        empty="Nothing waiting. Nice work."
      >
        {newQueue.map((t) => renderCard(t, { isQueue: true, emphasise: true }))}
      </SectionShell>

      {changeRequests.length > 0 && (
        <SectionShell title="Change requests" count={changeRequests.length}>
          {changeRequests.map((t) =>
            renderCard(t, { isQueue: t.assistant_id !== me }),
          )}
        </SectionShell>
      )}

      <SectionShell title="My active" count={active.length} empty="No active tasks assigned to you.">
        {active.map((t) => renderCard(t, { isQueue: false }))}
      </SectionShell>

      {doneToday.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setDoneOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-left"
          >
            <span className="text-[13px] font-semibold text-ink">
              Done today
              <span className="ml-2 text-ink-secondary">({doneToday.length})</span>
            </span>
            {doneOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {doneOpen && (
            <div className="mt-2 space-y-2">
              {doneToday.map((t) => renderCard(t, { isQueue: false }))}
            </div>
          )}
        </section>
      )}

      {acceptFor && (
        <AcceptDriverDialog
          open={!!acceptFor}
          onOpenChange={(o) => !o && setAcceptFor(null)}
          taskId={acceptFor.id}
          claimFirst={acceptFor.claimFirst}
          onDone={() => me && refresh(me)}
        />
      )}
    </OpsLayout>
  );
};

// ---- Section shell --------------------------------------------------------

const SectionShell = ({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  children: React.ReactNode;
}) => (
  <section className="mt-5">
    <h2 className="mb-2 flex items-baseline gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">
      {title}
      <span className="text-ink-tertiary">· {count}</span>
    </h2>
    {count === 0 ? (
      empty && <p className="rounded-2xl border border-dashed border-border bg-white p-4 text-[13px] text-ink-secondary">{empty}</p>
    ) : (
      <div className="space-y-2.5">{children}</div>
    )}
  </section>
);

// ---- Card pieces ----------------------------------------------------------

const CardHeader = ({
  t, emphasise, hasPass,
}: { t: TaskRow; emphasise?: boolean; hasPass?: boolean }) => {
  const moneyState: "paid" | "authorised" | null = t.paid_at
    ? "paid"
    : t.authorized_at
      ? "authorised"
      : null;
  const missed = isTransferPickupMissed(t);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ${
          t.category === "transfer"
            ? "bg-ink text-white"
            : "bg-surface-2 text-ink"
        }`}
      >
        {t.category === "transfer" ? <Car className="h-3 w-3" strokeWidth={2.2} /> : <Utensils className="h-3 w-3" strokeWidth={2.2} />}
        {t.category === "transfer" ? "Transfer" : t.category.replace(/_/g, " ")}
      </span>
      {missed && (
        <span className="rounded-full bg-error-tint px-2 py-0.5 font-semibold uppercase tracking-wider text-error">
          Missed — pickup passed
        </span>
      )}
      {/* Real money is the norm now, so anything on test money is called out
          loudly: no live payment exists behind this request. */}
      {t.stripe_env === "sandbox" && (t.paid_at || t.authorized_at) && (
        <span className="rounded-full bg-error-tint px-2 py-0.5 font-semibold uppercase tracking-wider text-error">
          Test payment — not real money
        </span>
      )}
      {emphasise && t.category === "transfer" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-brand-orange">
          <Sparkles className="h-3 w-3" strokeWidth={2.2} />
          New
        </span>
      )}
      {hasPass && typeof t.category === "string" && t.category.startsWith("restaurant") && (
        <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 font-semibold uppercase tracking-wider text-white">
          <Sparkles className="h-3 w-3" strokeWidth={2.2} />
          Pass
        </span>
      )}
      {isFirstFreeBooking(t) && (
        <span className="inline-flex items-center gap-1 rounded-full bg-tint-warm px-2 py-0.5 font-semibold uppercase tracking-wider text-pending">
          <Sparkles className="h-3 w-3" strokeWidth={2.2} />
          First — free
        </span>
      )}
      {moneyState && (
        <span
          className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ${
            moneyState === "paid" ? "bg-success-tint text-success" : "bg-pending-tint text-pending"
          }`}
        >
          {moneyState === "paid" ? "Paid" : "Authorised"}
        </span>
      )}
      <span
        className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ${TONE_CHIP[statusTone(t.status)]}`}
      >
        {STATUS_LABEL[t.status]}
      </span>
      <span className="ml-auto text-[11px] text-ink-secondary">
        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
      </span>
    </div>
  );
};

const TransferBody = ({ t }: { t: TaskRow }) => {
  const dj = t.details_json;
  const isTransfer =
    t.category === "transfer" &&
    dj &&
    typeof dj === "object" &&
    (dj as TransferDetails).kind === "transfer";
  if (!isTransfer) return <p className="mt-2 text-[13px] text-ink">{t.summary}</p>;
  const d = dj as TransferDetails;

  const gbpCents =
    t.quoted_gbp_cents ?? (String(t.currency).toUpperCase() === "GBP" ? t.price_cents : 0);
  const gbpQuote =
    gbpCents > 0
      ? formatChargeMoney(gbpCents, "GBP")
      : t.price_cents > 0
        ? formatMoney(t.price_cents, t.currency)
        : "—";
  const chargeQuote =
    t.charge_amount_cents && t.charge_currency
      ? formatChargeMoney(t.charge_amount_cents, t.charge_currency)
      : null;
  const quote =
    chargeQuote && (t.charge_currency ?? "").toUpperCase() !== "GBP"
      ? `${gbpQuote} → ${chargeQuote}`
      : gbpQuote;

  const pickupLabel =
    d.service === "airport"
      ? `${d.airport_name ?? d.airport_code ?? "Airport"}${d.terminal ? ` · ${d.terminal}` : ""}`
      : d.service === "station"
        ? d.station_name || d.station_code || "Station"
        : d.pickup_address || "Pickup";
  const dropoffLabel =
    d.service === "hourly"
      ? `${d.hours ?? "—"} hours on call`
      : d.dropoff_address || (d.service === "airport" && d.direction === "arrival" ? "Traveller's stay" : "Destination TBC");

  const from = d.direction === "arrival" ? pickupLabel : d.pickup_address || pickupLabel;
  const to = d.direction === "arrival" ? d.dropoff_address || pickupLabel : pickupLabel;

  const phone = d.contact_phone ?? (d as unknown as { phone?: string }).phone ?? null;

  return (
    <div className="mt-2">
      {d.pickup_at && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Pickup
          </p>
          <p className="mt-0.5 text-[28px] font-extrabold leading-none tracking-tight text-ink">
            {formatPickupTime(d.pickup_at)}
          </p>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            {formatPickupDate(d.pickup_at)}
          </p>
        </div>
      )}
      <div className="mt-3 rounded-2xl bg-surface-2 p-3">
        <div className="grid grid-cols-[16px_1fr] gap-x-2 text-[13px] text-ink">
          <span className="mt-1 h-2 w-2 rounded-full bg-ink" aria-hidden />
          <span className="font-semibold">{d.service === "hourly" ? "Pickup" : from}</span>
          <span
            className="ml-[3px] mt-1 h-4 w-[2px] rounded-full bg-border"
            aria-hidden
          />
          <span className="text-ink-secondary">
            {d.service === "hourly" ? dropoffLabel : to}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className="rounded-full bg-surface-2 px-2 py-1 font-semibold text-ink">
          {CAR_CLASS_LABEL[d.car_class]}
        </span>
        <span className="rounded-full bg-surface-2 px-2 py-1 text-ink-secondary">
          {d.pax} pax · {d.bags} bags
        </span>
        {d.flight_number && (
          <span className="rounded-full bg-surface-2 px-2 py-1 text-ink-secondary">
            Flight {d.flight_number}
          </span>
        )}
        {d.train_number && (
          <span className="rounded-full bg-surface-2 px-2 py-1 text-ink-secondary">
            Train {d.train_number}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-ink ring-1 ring-border">
          <BadgeDollarSign className="h-3 w-3" strokeWidth={2.2} />
          {quote}
        </span>
      </div>
      {phone && (
        <a
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-red/10 px-3 py-1.5 text-[13px] font-semibold text-brand-red"
        >
          <Phone className="h-3.5 w-3.5" strokeWidth={2.2} />
          {phone}
        </a>
      )}
      {d.notes && (
        <p className="mt-2 rounded-xl bg-surface-2 p-2.5 text-[12px] text-ink-secondary">
          Notes: {d.notes}
        </p>
      )}
      {t.booking_reference && (
        <p className="mt-2 text-[12px] text-ink-secondary">
          Ref <span className="font-semibold text-ink">{t.booking_reference}</span>
        </p>
      )}
    </div>
  );
};

const RestaurantBody = ({ t }: { t: TaskRow }) => (
  <div className="mt-2">
    <p className="text-[14px] text-ink">{t.summary}</p>
    {t.booking_reference && (
      <p className="mt-1 text-[12px] text-ink-secondary">
        Ref <span className="font-semibold text-ink">{t.booking_reference}</span>
      </p>
    )}
  </div>
);

const ChangeDiff = ({ row }: { row: TaskRow }) => {
  const dj = row.details_json as Record<string, unknown> | null;
  if (!dj || typeof dj !== "object") return null;
  const pending = (dj as {
    pending_change?: {
      new_pickup_at?: string;
      new_flight_number?: string;
      new_pickup_address?: string;
    };
  }).pending_change;
  if (!pending) return null;
  const current = dj as {
    pickup_at?: string;
    flight_number?: string;
    pickup_address?: string;
    pickup_address_full?: string;
  };
  const rows: { label: string; current: string; requested: string }[] = [];
  if (pending.new_pickup_at) {
    rows.push({
      label: "Pickup time",
      current: current.pickup_at
        ? formatPickupDate(current.pickup_at) + " · " + formatPickupTime(current.pickup_at)
        : "—",
      requested:
        formatPickupDate(pending.new_pickup_at) + " · " + formatPickupTime(pending.new_pickup_at),
    });
  }
  if (pending.new_flight_number) {
    rows.push({
      label: "Flight",
      current: current.flight_number || "—",
      requested: pending.new_flight_number,
    });
  }
  if (pending.new_pickup_address) {
    rows.push({
      label: "Pickup address",
      current: current.pickup_address || current.pickup_address_full || "—",
      requested: pending.new_pickup_address,
    });
  }
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 rounded-2xl border border-pending/30 bg-pending-tint/60 p-3 text-[12px]">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-pending">
        Change requested
      </p>
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="align-top">
              <td className="py-0.5 pr-2 text-ink-secondary">{r.label}</td>
              <td className="py-0.5 pr-2 text-ink line-through opacity-70">{r.current}</td>
              <td className="py-0.5 font-semibold text-ink">→ {r.requested}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OpsDispatch;