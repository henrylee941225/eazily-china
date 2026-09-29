import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
};

/**
 * Structured change request for an active transfer booking. Traveller may
 * update pickup time, flight number, and/or pickup address — no freeform
 * text. Submitting sets the task to `change_pending` and fires an ops alert.
 */
export const TransferChangeDialog = ({ open, onOpenChange, taskId }: Props) => {
  const [pickupAt, setPickupAt] = useState("");
  const [flight, setFlight] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const change_request: Record<string, string> = {};
    if (pickupAt) change_request.new_pickup_at = new Date(pickupAt).toISOString();
    if (flight.trim()) change_request.new_flight_number = flight.trim();
    if (address.trim()) change_request.new_pickup_address = address.trim();
    if (Object.keys(change_request).length === 0) {
      toast.error("Update at least one field.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("concierge-update-task", {
      body: { task_id: taskId, status: "change_pending", change_request },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't send change request.");
      return;
    }
    toast.success("Change requested — we'll confirm shortly.");
    setPickupAt("");
    setFlight("");
    setAddress("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Request a change</DialogTitle>
          <DialogDescription>
            Update one or more fields. Your original booking is still held while we confirm.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              New pickup time
            </label>
            <input
              type="datetime-local"
              value={pickupAt}
              onChange={(e) => setPickupAt(e.target.value)}
              className="mt-1 w-full rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              New flight number
            </label>
            <input
              type="text"
              value={flight}
              onChange={(e) => setFlight(e.target.value)}
              placeholder="e.g. MU587"
              maxLength={40}
              className="mt-1 w-full rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-secondary/70"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              New pickup address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Hotel or street address"
              maxLength={200}
              className="mt-1 w-full rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-secondary/70"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Send change request
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};