import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { TripDateField } from "@/components/trip/TripDateField";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCity } from "@/contexts/CityContext";

// Lightweight "trip step" page — the destination for the Trip dates & details
// row on the Account home. Reads/writes the same profile columns the
// onboarding trip step uses (destination_city, arrival_date, departure_date).
const TripDates = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { cities } = useCity();

  const [destCity, setDestCity] = useState("");
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDestCity(profile?.destination_city ?? "");
    setArrival(profile?.arrival_date ?? "");
    setDeparture(profile?.departure_date ?? "");
  }, [profile]);

  const invalidRange =
    arrival && departure && new Date(arrival) > new Date(departure);

  const save = async () => {
    if (!user) return;
    if (invalidRange) {
      toast.error("Departure must be after arrival");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        destination_city: destCity || null,
        arrival_date: arrival || null,
        departure_date: departure || null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Trip updated");
    navigate("/account");
  };

  return (
    <AppLayout title="Trip dates & details" backTo="/account" showLiveActivity={false} hideTabBar>
      <div className="mx-auto max-w-[440px] space-y-6 pb-28">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
            Destination city
          </p>
          <div className="relative">
            <select
              value={destCity}
              onChange={(e) => setDestCity(e.target.value)}
              className="w-full appearance-none rounded-2xl bg-surface-2 px-4 py-3.5 pr-10 text-[15px] text-ink focus:outline-none"
            >
              <option value="">Select…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary" strokeWidth={2} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TripDateField label="Arrival" value={arrival} onChange={setArrival} />
          <TripDateField label="Departure" value={departure} onChange={setDeparture} min={arrival} />
        </div>

      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 py-3 backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-[440px]">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white transition disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save trip
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default TripDates;
