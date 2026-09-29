import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Row = { id: string; valid_until: string | null; extended_at: string | null; extension_seen_at: string | null };

/** Tells the traveller a second purchase extended their pass rather than replacing it. */
export const PassExtendedNotice = ({ className = "" }: { className?: string }) => {
  const { user } = useAuth();
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    if (!user?.id) { setRow(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("booking_entitlement_state", { user_uuid: user.id });
      const r = (Array.isArray(data) ? data[0] : data) as Row | null;
      if (!cancelled) setRow(r?.extended_at && !r.extension_seen_at ? r : null);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!row) return null;
  const until = row.valid_until ? format(new Date(`${row.valid_until}T00:00:00`), "d MMMM") : null;
  const dismiss = async () => {
    const id = row.id;
    setRow(null);
    await supabase.rpc("ack_entitlement_extension", { _id: id });
  };

  return (
    <div className={`flex items-start gap-3 rounded-2xl bg-tint-warm p-4 ${className}`}>
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" strokeWidth={1.75} />
      <p className="flex-1 text-[15px] leading-snug text-ink">
        Your Trip Pass was extended, not replaced — 5 more bookings added
        {until ? `, now valid until ${until}` : ""}.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-secondary active:bg-surface-3"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
};
