import { useEffect, useState } from "react";

const SHANGHAI_TZ = "Asia/Shanghai";

const fmtTime = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date());

const cityFromTz = (tz: string) => {
  const part = tz.split("/").pop() ?? tz;
  return part.replace(/_/g, " ");
};

/**
 * Quiet clock strip:
 * - Shanghai local time (large)
 * - Home country local time (small, derived from the browser timezone)
 */
export const AILiveActivity = () => {
  const homeTz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
  const isInChina = homeTz === SHANGHAI_TZ;
  const homeLabel = cityFromTz(homeTz);

  const [shanghai, setShanghai] = useState(() => fmtTime(SHANGHAI_TZ));
  const [home, setHome] = useState(() => fmtTime(homeTz));

  useEffect(() => {
    const tick = () => {
      setShanghai(fmtTime(SHANGHAI_TZ));
      setHome(fmtTime(homeTz));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [homeTz]);

  return (
    <div className="sticky top-0 z-40 border-b border-foreground/10 bg-card/85 backdrop-blur-md pt-safe">
      <div className="container mx-auto flex items-baseline justify-between gap-3 px-4 py-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Shanghai
          </span>
          <span className="font-mono text-sm font-medium tabular-nums text-ink">
            {shanghai}
          </span>
        </div>
        {!isInChina && (
          <div className="flex items-baseline gap-1.5 text-muted-foreground">
            <span className="text-[9px] uppercase tracking-[0.2em]">{homeLabel}</span>
            <span className="font-mono text-[11px] tabular-nums">{home}</span>
          </div>
        )}
      </div>
    </div>
  );
};