import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const SUPPORTED_CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", label: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", label: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
  { code: "CHF", label: "Swiss Franc", symbol: "Fr", flag: "🇨🇭" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { code: "NZD", label: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },
  { code: "KRW", label: "Korean Won", symbol: "₩", flag: "🇰🇷" },
  { code: "INR", label: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "THB", label: "Thai Baht", symbol: "฿", flag: "🇹🇭" },
  { code: "MYR", label: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾" },
  { code: "IDR", label: "Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩" },
  { code: "PHP", label: "Philippine Peso", symbol: "₱", flag: "🇵🇭" },
  { code: "MXN", label: "Mexican Peso", symbol: "Mex$", flag: "🇲🇽" },
  { code: "BRL", label: "Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  { code: "ZAR", label: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "SEK", label: "Swedish Krona", symbol: "kr", flag: "🇸🇪" },
  { code: "NOK", label: "Norwegian Krone", symbol: "kr", flag: "🇳🇴" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

const STORAGE_KEY = "ec_pref_currency";

type FxRate = { rate: number; trend: string; tip: string; updatedAt: number } | null;

type Ctx = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => Promise<void>;
  rate: FxRate; // 1 currency = rate CNY
  loadingRate: boolean;
  refreshRate: () => Promise<void>;
};

const CurrencyContext = createContext<Ctx | undefined>(undefined);

const getStored = (): CurrencyCode => {
  if (typeof window === "undefined") return "USD";
  return "USD";
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile, refreshProfile } = useAuth();
  const [currency, setCurrencyState] = useState<CurrencyCode>(getStored());
  const [rate, setRate] = useState<FxRate>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  // Sync from profile when it loads
  useEffect(() => {
    const fromProfile = (profile as any)?.preferred_currency as CurrencyCode | undefined;
    if (fromProfile && SUPPORTED_CURRENCIES.some((c) => c.code === fromProfile)) {
      setCurrencyState(fromProfile);
      localStorage.setItem(STORAGE_KEY, fromProfile);
    }
  }, [profile]);

  const fetchRate = async (code: CurrencyCode) => {
    // fx-check requires a signed-in user; skip quietly when logged out.
    if (!user) {
      setRate(null);
      return;
    }
    if ((code as string) === "CNY") {
      setRate({ rate: 1, trend: "Base currency", tip: "", updatedAt: Date.now() });
      return;
    }
    setLoadingRate(true);
    try {
      const { data, error } = await supabase.functions.invoke("fx-check", {
        body: { from: code, to: "CNY", amount: 1 },
      });
      if (error || !data || data.error || typeof data.rate !== "number") {
        setRate(null);
        return;
      }
      setRate({ rate: data.rate, trend: data.trend ?? "", tip: data.tip ?? "", updatedAt: Date.now() });
    } catch (e) {
      console.error("currency fx fetch failed", e);
      setRate(null);
    } finally {
      setLoadingRate(false);
    }
  };

  useEffect(() => {
    fetchRate(currency);
  }, [currency, user]);

  const setCurrency = async (c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem(STORAGE_KEY, c);
    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_currency: c } as never)
        .eq("user_id", user.id);
      if (!error) await refreshProfile();
    }
  };

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, rate, loadingRate, refreshRate: () => fetchRate(currency) }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
};