import { Link } from "react-router-dom";
import { Plane, Clock, TramFront, ChevronRight, Car } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useCity } from "@/contexts/CityContext";
import { SERVICE_BLURB, SERVICE_LABEL, type TransferService } from "@/lib/transfers";

const TILES: {
  service: TransferService;
  icon: typeof Plane;
  accent: "red" | "ink";
}[] = [
  { service: "airport", icon: Plane,     accent: "red" },
  { service: "hourly",  icon: Clock,     accent: "ink" },
  { service: "station", icon: TramFront, accent: "ink" },
];

const Transfers = () => {
  const { city } = useCity();
  const cityName = city?.name || "Shanghai";
  return (
    <AppLayout
      title="Ride"
      subtitle="Private drivers"
      backTo="/"
      headerRight={
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--error-tint))] text-[hsl(var(--brand-red))]">
          <Car className="h-4 w-4" strokeWidth={2} />
        </span>
      }
    >
      <div className="mx-auto max-w-[440px] space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
          Book a transfer
        </p>
        <ul className="space-y-2.5">
          {TILES.map(({ service, icon: Icon, accent }) => {
            const iconBg = accent === "red"
              ? "bg-[hsl(var(--error-tint))] text-[hsl(var(--brand-red))]"
              : "bg-surface-2 text-ink";
            const subtitle = service === "airport"
              ? `To or from any ${cityName} airport`
              : SERVICE_BLURB[service];
            return (
              <li key={service}>
                <Link
                  to={`/transfers/${service}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left transition hover:bg-surface-2/60"
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconBg}`}>
                    <Icon className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold text-ink">{SERVICE_LABEL[service]}</p>
                    <p className="mt-0.5 truncate text-[13px] text-ink-secondary">{subtitle}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </AppLayout>
  );
};

export default Transfers;