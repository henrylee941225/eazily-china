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
import { invokeFn } from "@/lib/invokeFn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  claimFirst?: boolean;
  onDone?: () => void;
};

/**
 * Single-form ops action for authorised transfers: capture the payment and
 * confirm the booking with driver dispatch details in one step.
 */
export const AcceptDriverDialog = ({ open, onOpenChange, taskId, claimFirst, onDone }: Props) => {
  const [ref, setRef] = useState("");
  const [name, setName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [meeting, setMeeting] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!ref.trim() || !name.trim() || !vehicle.trim() || !plate.trim() || !meeting.trim()) {
      toast.error("All fields are required.");
      return;
    }
    setSubmitting(true);
    if (claimFirst) {
      const { error: claimErr } = await invokeFn("concierge-claim-task", { task_id: taskId });
      if (claimErr) {
        setSubmitting(false);
        toast.error(claimErr.message || "Couldn't claim — someone may have picked it up.");
        return;
      }
    }
    const { error } = await invokeFn("concierge-update-task", {
      task_id: taskId,
      status: "confirmed",
      booking_reference: ref.trim(),
      driver_details: {
        name: name.trim(),
        vehicle: vehicle.trim(),
        plate: plate.trim(),
        meeting_point: meeting.trim(),
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Couldn't confirm booking.");
      return;
    }
    toast.success("Driver assigned · booking confirmed");
    onOpenChange(false);
    onDone?.();
  };

  const field = (label: string, value: string, on: (v: string) => void, placeholder: string, max = 120) => (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => on(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        className="mt-1 w-full rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-secondary/70"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Accept &amp; assign driver</DialogTitle>
          <DialogDescription>
            Captures the authorised payment and posts driver details to the traveller.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {field("Booking reference", ref, setRef, "e.g. EZ-4831", 60)}
          {field("Driver name", name, setName, "e.g. Zhang Wei")}
          {field("Vehicle make & colour", vehicle, setVehicle, "e.g. Black Toyota Camry", 160)}
          {field("Plate", plate, setPlate, "e.g. 沪A·12345", 40)}
          {field("Meeting point", meeting, setMeeting, "e.g. Arrivals Gate 6", 200)}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm booking
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};