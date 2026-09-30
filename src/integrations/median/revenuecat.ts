/**
 * RevenueCat bridge for Median and Capacitor native apps.
 *
 * The bridge functions exist only inside a supported native wrapper. On web
 * builds every helper here reports "unavailable" so callers fall back to the
 * existing Stripe checkout instead of throwing.
 *
 * Entitlement is NEVER granted from this file: purchase() returns a UI signal
 * only. The revenuecat-webhook edge function writes
 * booking_entitlements server-side; the UI polls the server for it.
 */
import { Median } from "@/integrations/median";
import { Capacitor } from "@capacitor/core";
import { capacitorRevenueCatBridge } from "@/integrations/capacitor/revenuecat";

export const TRIP_PASS_PRODUCT_IDENTIFIER = "com.eazilychina.app.trippass";

const revenueCatApiKey = () => Capacitor.getPlatform() === "android"
  ? import.meta.env.VITE_REVENUECAT_ANDROID_KEY
  : import.meta.env.VITE_REVENUECAT_IOS_KEY;

type RevenueCatBridge = {
  configure?: (params: { apiKey: string; appUserID: string }) => Promise<unknown>;
  purchase?: (params: { identifier: string }) => Promise<{ success?: boolean; error?: string }>;
  isInitialized?: () => Promise<boolean | { isInitialized?: boolean }> | boolean;
  restorePurchases?: (params?: unknown) => Promise<unknown>;
  getOfferings?: (params?: unknown) => Promise<unknown>;
};

const bridge = (): RevenueCatBridge | null => {
  if (typeof window === "undefined") return null;
  if (Capacitor.isNativePlatform()) return capacitorRevenueCatBridge;
  if (!(window as unknown as { isMedianApp?: boolean }).isMedianApp) return null;
  const rc = (Median as unknown as { revenueCat?: RevenueCatBridge })?.revenueCat;
  return rc && typeof rc.purchase === "function" ? rc : null;
};

export type PlatformGuess = "browser" | "native" | "uncertain";

/**
 * Fail-safe platform detection. Only returns "browser" when every native
 * signal is confidently absent AND the user agent looks like a full browser
 * (not an embedded web view). Any error, ambiguity or native-looking signal
 * resolves to "native"/"uncertain", which callers must treat as native.
 */
export const detectPlatform = (): PlatformGuess => {
  try {
    if (Capacitor.isNativePlatform()) return "native";
    if (typeof window === "undefined" || typeof navigator === "undefined") return "uncertain";
    const w = window as unknown as Record<string, unknown> & {
      webkit?: { messageHandlers?: Record<string, unknown> };
    };
    const ua = navigator.userAgent || "";
    if (!ua) return "uncertain";
    if (/median|gonative/i.test(ua)) return "native";
    if (w.isMedianApp || w.median || w.gonative || w.ReactNativeWebView) return "native";
    const handlers = w.webkit?.messageHandlers;
    if (handlers && Object.keys(handlers).some((k) => /median|gonative/i.test(k))) return "native";
    if (handlers) return "uncertain"; // some iOS web view with a native bridge
    // iOS web views omit "Safari"; Android web views carry "; wv)".
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (isIOS && !/Safari\//.test(ua)) return "uncertain";
    if (/Android/.test(ua) && /; wv\)/.test(ua)) return "uncertain";
    if (/Mozilla\/5\.0/.test(ua) && /(Chrome|Safari|Firefox|Edg)\//.test(ua)) return "browser";
    return "uncertain";
  } catch {
    return "uncertain";
  }
};

/** Card payment is offered only on a confidently detected browser. */
export const canOfferCardFallback = (): boolean => detectPlatform() === "browser";

/** True when the native purchase bridge and the platform's API key are present. */
export const isRevenueCatAvailable = (): boolean => !!bridge() && !!revenueCatApiKey();

/** Resolves the bridge's own initialisation flag, tolerating shape differences. */
const readIsInitialized = async (rc: RevenueCatBridge): Promise<boolean> => {
  if (typeof rc.isInitialized !== "function") return false;
  try {
    const res = await rc.isInitialized();
    if (typeof res === "boolean") return res;
    return !!(res as { isInitialized?: boolean })?.isInitialized;
  } catch {
    return false;
  }
};

let configuredForUser: string | null = null;

/**
 * Configure RevenueCat with the Supabase auth user id as the app user id.
 * The webhook looks the user up by this value, so an anonymous RevenueCat id
 * would orphan the purchase — we never let the SDK generate one.
 */
export const configureRevenueCat = async (userId: string | null | undefined): Promise<boolean> => {
  const rc = bridge();
  if (!rc || typeof rc.configure !== "function") return false;
  if (!userId) {
    configuredForUser = null;
    return false;
  }
  const apiKey = revenueCatApiKey();
  if (!apiKey) {
    console.warn("RevenueCat: the platform API key is not set — in-app purchase disabled.");
    return false;
  }
  if (configuredForUser === userId && (await readIsInitialized(rc))) return true;
  try {
    await rc.configure({ apiKey, appUserID: userId });
    configuredForUser = userId;
    return true;
  } catch (err) {
    console.warn("RevenueCat configure failed", err);
    configuredForUser = null;
    return false;
  }
};

/**
 * Start the native Trip Pass purchase. The returned flag is a UI signal only
 * and must never unlock anything on its own.
 */
export type PurchaseResult = {
  success: boolean;
  error?: string;
  code?: string;
  raw?: string;
  transactionId?: string;
};

const pick = (o: unknown, keys: string[]): string | undefined => {
  if (!o || typeof o !== "object") return undefined;
  const r = o as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" || typeof v === "number") return String(v);
  }
  for (const nested of ["transaction", "storeTransaction", "error", "customerInfo"]) {
    const v = r[nested];
    if (v && typeof v === "object") {
      const found = pick(v, keys);
      if (found) return found;
    }
  }
  return undefined;
};

export const purchaseTripPass = async (userId: string | null | undefined): Promise<PurchaseResult> => {
  const rc = bridge();
  if (!rc || typeof rc.purchase !== "function") return { success: false, error: "unavailable", code: "bridge_absent" };
  if (!(await configureRevenueCat(userId))) return { success: false, error: "not_initialised", code: "not_initialised" };
  try {
    const res = (await rc.purchase({ identifier: TRIP_PASS_PRODUCT_IDENTIFIER })) as unknown;
    const r = (res ?? {}) as Record<string, unknown>;
    const success = r.success === true;
    return {
      success,
      error: success ? undefined : (typeof r.error === "string" ? r.error : errorText(r.error ?? res)),
      code: pick(res, ["code", "errorCode", "readableErrorCode", "underlyingErrorCode"]),
      raw: errorText(res),
      transactionId: pick(res, ["transactionIdentifier", "storeTransactionId", "transactionId"]),
    };
  } catch (err) {
    console.warn("RevenueCat purchase failed", err);
    return {
      success: false,
      error: errorText(err),
      code: pick(err, ["code", "errorCode", "readableErrorCode"]) ?? "exception",
      raw: errorText(err instanceof Error ? { name: err.name, message: err.message } : err),
    };
  }
};

const errorText = (e: unknown): string => {
  if (!e) return "";
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return String(e); }
};

export type PurchaseFailure = "cancelled" | "declined" | "store_unavailable" | "already_owned" | "pending" | "generic";

// RevenueCat PURCHASES_ERROR_CODE numbers and readable names we know.
const CODE_MAP: Record<string, PurchaseFailure> = {
  "1": "cancelled", PURCHASE_CANCELLED: "cancelled", PurchaseCancelledError: "cancelled",
  "2": "store_unavailable", STORE_PROBLEM: "store_unavailable", StoreProblemError: "store_unavailable",
  "3": "declined", PURCHASE_NOT_ALLOWED: "declined", PurchaseNotAllowedError: "declined",
  "4": "declined", PURCHASE_INVALID: "declined", PurchaseInvalidError: "declined",
  "5": "store_unavailable", PRODUCT_NOT_AVAILABLE_FOR_PURCHASE: "store_unavailable",
  "6": "already_owned", PRODUCT_ALREADY_PURCHASED: "already_owned",
  "10": "store_unavailable", NETWORK_ERROR: "store_unavailable", NetworkError: "store_unavailable",
  "20": "pending", PAYMENT_PENDING: "pending", PaymentPendingError: "pending",
  bridge_absent: "store_unavailable", not_initialised: "store_unavailable",
};

/**
 * Maps a store failure onto a message category. Known codes first, then a
 * narrow text match for cancellation only; everything else is "generic" so
 * an unrecognised error never shows a wrong, specific message.
 */
export const classifyPurchaseError = (code?: string, raw?: string): PurchaseFailure => {
  if (code && CODE_MAP[code]) return CODE_MAP[code];
  const e = (raw ?? "").toLowerCase();
  if (/user ?cancel|purchase ?cancel|"usercancelled":\s*true/.test(e)) return "cancelled";
  return "generic";
};

/**
 * Localised Trip Pass price from the store, via RevenueCat offerings.
 * Returns null when the bridge or the product is unavailable — callers must
 * then show no price rather than a hardcoded one.
 */
export const getTripPassPrice = async (
  userId: string | null | undefined,
): Promise<string | null> => {
  const rc = bridge();
  if (!rc || typeof rc.getOfferings !== "function") return null;
  if (!(await configureRevenueCat(userId))) return null;
  try {
    const res = (await rc.getOfferings()) as Record<string, unknown> | null;
    const root = (res?.offerings as Record<string, unknown>) ?? res ?? {};
    const offerings: Record<string, unknown>[] = [];
    if (root.current) offerings.push(root.current as Record<string, unknown>);
    const all = root.all as Record<string, Record<string, unknown>> | undefined;
    if (all) offerings.push(...Object.values(all));
    let fallback: string | null = null;
    for (const o of offerings) {
      const pkgs = (o.availablePackages ?? o.packages ?? []) as Record<string, unknown>[];
      for (const pkg of pkgs) {
        const product = (pkg.product ?? pkg.storeProduct ?? pkg) as Record<string, unknown>;
        const price = (product.priceString ?? product.localizedPriceString) as string | undefined;
        const id = (product.identifier ?? product.productIdentifier) as string | undefined;
        if (price && id === TRIP_PASS_PRODUCT_IDENTIFIER) return price;
        if (price && !fallback) fallback = price;
      }
    }
    return fallback;
  } catch (err) {
    console.warn("RevenueCat getOfferings failed", err);
    return null;
  }
};

/** Asks the store to resend past purchases; the webhook grants server-side. */
export const restoreTripPassPurchases = async (
  userId: string | null | undefined,
): Promise<{ ok: boolean; error?: string }> => {
  const rc = bridge();
  if (!rc || typeof rc.restorePurchases !== "function") return { ok: false, error: "unavailable" };
  if (!(await configureRevenueCat(userId))) return { ok: false, error: "not_initialised" };
  try {
    await rc.restorePurchases();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
};
