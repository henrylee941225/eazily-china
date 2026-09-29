import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, Inbox, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OpsLayout } from "./OpsLayout";

type Delivery = {
  id: string;
  channel: string;
  status: string;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
};

type EventRow = {
  id: string;
  task_id: string;
  user_id: string;
  event_key: string;
  from_status: string | null;
  to_status: string | null;
  payload: Record<string, unknown> | null;
  processed_at: string | null;
  created_at: string;
  notification_deliveries: Delivery[];
};

const DELIVERY_TONE: Record<string, string> = {
  sent: "bg-success-tint text-success",
  pending: "bg-pending-tint text-pending",
  failed: "bg-error-tint text-error",
  skipped: "bg-surface-2 text-ink-secondary",
};

/**
 * Ops-only observability for the notification backbone. Read-only: lists recent
 * notification_events with their per-channel deliveries so events can be watched
 * firing during testing.
 */
const OpsNotifications = () => {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("notification_events")
      .select(
        "id, task_id, user_id, event_key, from_status, to_status, payload, processed_at, created_at, notification_deliveries(id, channel, status, attempts, last_error, sent_at)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (err) setError(err.message);
    else {
      setError(null);
      setRows((data ?? []) as unknown as EventRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <OpsLayout>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-ink-secondary" strokeWidth={2} />
          <h1 className="text-[18px] font-bold text-ink">Notification events</h1>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[12px] font-semibold text-ink transition hover:bg-surface-3"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-white p-4 text-[13px] text-ink-secondary">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          Loading events
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-border bg-error-tint p-4 text-[13px] text-error">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-white p-8 text-center">
          <Inbox className="h-5 w-5 text-ink-tertiary" strokeWidth={2} />
          <p className="text-[13px] text-ink-secondary">
            No notification events yet. They appear as bookings change status.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((ev) => (
            <li key={ev.id} className="rounded-2xl border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink">{ev.event_key}</p>
                  <p className="mt-0.5 text-[12px] text-ink-secondary">
                    {(ev.from_status ?? "—")} → {(ev.to_status ?? "—")} ·{" "}
                    {String(ev.payload?.category ?? "—")}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-ink-tertiary">
                    task {ev.task_id.slice(0, 8)} ·{" "}
                    {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
                    ev.processed_at ? DELIVERY_TONE.sent : DELIVERY_TONE.pending
                  }`}
                >
                  {ev.processed_at ? "Processed" : "Queued"}
                </span>
              </div>

              {ev.notification_deliveries?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  {ev.notification_deliveries.map((d) => (
                    <span
                      key={d.id}
                      title={d.last_error ?? undefined}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        DELIVERY_TONE[d.status] ?? DELIVERY_TONE.skipped
                      }`}
                    >
                      {d.channel} · {d.status}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </OpsLayout>
  );
};

export default OpsNotifications;
