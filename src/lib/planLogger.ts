// Dev-only logger for the Plan my day flow.
// In production builds (import.meta.env.PROD) these calls are no-ops.
const isDev = import.meta.env.DEV;

export const planLog = (...args: unknown[]) => {
  if (isDev) console.log("[PLAN]", ...args);
};

export const planError = (...args: unknown[]) => {
  if (isDev) console.error("[PLAN]", ...args);
};

const TWELVE_HOUR_LOCALES = ["en-US", "en-GB", "en-AU", "en-CA", "en-NZ", "en-IE"];

const userLocale = (): string => {
  if (typeof navigator === "undefined") return "en-US";
  return navigator.language || "en-US";
};

export const uses12HourClock = (): boolean => {
  const loc = userLocale().toLowerCase();
  return TWELVE_HOUR_LOCALES.some((l) => loc.startsWith(l.toLowerCase()));
};

// Format a "HH:MM" string per the user's locale convention.
export const formatStopTime = (hhmm: string): string => {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm;
  if (!uses12HourClock()) return hhmm;
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};