import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, Map as MapIcon, CalendarCheck, Languages, Sparkles } from "lucide-react";
import { Keyboard } from "@capacitor/keyboard";
import type { PluginListenerHandle } from "@capacitor/core";
import { triggerHaptic } from "@/integrations/median";
import { isCapacitorApp } from "@/integrations/capacitor";
import { useAuth } from "@/contexts/AuthContext";

type Tab = {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
  requireAuth?: boolean;
};

const TABS: Tab[] = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/map", label: "Maps", icon: MapIcon, requireAuth: true },
  { to: "/bookings", label: "Bookings", icon: CalendarCheck, requireAuth: true },
  { to: "/translate", label: "Translate", icon: Languages },
];

export const BottomTabBar = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!isCapacitorApp()) return;
    let disposed = false;
    const listeners: PluginListenerHandle[] = [];
    const listen = async (listener: Promise<PluginListenerHandle>) => {
      try {
        const handle = await listener;
        if (disposed) await handle.remove();
        else listeners.push(handle);
      } catch (error) {
        console.warn("Keyboard listener registration failed", error);
      }
    };

    void listen(Keyboard.addListener("keyboardWillShow", () => {
      if (!disposed) setKeyboardVisible(true);
    }));
    void listen(Keyboard.addListener("keyboardDidHide", () => {
      if (!disposed) setKeyboardVisible(false);
    }));

    return () => {
      disposed = true;
      listeners.forEach((handle) => { void handle.remove(); });
    };
  }, []);

  const handleConcierge = () => {
    triggerHaptic("impactMedium");
    if (!session) {
      navigate(`/auth?next=${encodeURIComponent("/concierge/chat")}`);
      return;
    }
    navigate("/concierge/chat");
  };

  return (
    <nav
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-1 ${keyboardVisible ? "invisible" : ""}`}
      style={{ paddingBottom: "max(0px, calc(env(safe-area-inset-bottom) - 16px))" }}
      aria-label="Primary"
      aria-hidden={keyboardVisible}
    >
      <div className="pointer-events-auto relative mx-auto flex max-w-[420px] items-stretch justify-between rounded-full border border-hairline bg-white px-3 py-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]">
        {/* Left pair */}
        <ul className="flex flex-1 items-stretch justify-around">
          {TABS.slice(0, 2).map((tab) => (
            <TabItem key={tab.to} {...tab} signedIn={!!session} />
          ))}
        </ul>

        {/* Centre spacer for raised concierge button */}
        <div className="w-16 shrink-0" aria-hidden />

        {/* Right pair */}
        <ul className="flex flex-1 items-stretch justify-around">
          {TABS.slice(2).map((tab) => (
            <TabItem key={tab.to} {...tab} signedIn={!!session} />
          ))}
        </ul>

        {/* Raised concierge centre button */}
        <button
          type="button"
          onClick={handleConcierge}
          aria-label="Open concierge"
          className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-1/3 items-center justify-center rounded-full bg-ink text-white shadow-[0_10px_24px_-8px_rgba(0,0,0,0.45)] ring-4 ring-white transition-transform active:scale-95"
        >
          <Sparkles className="h-6 w-6" strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  );
};

const TabItem = ({ to, label, icon: Icon, end, requireAuth, signedIn }: Tab & { signedIn: boolean }) => {
  const href = requireAuth && !signedIn ? `/auth?next=${encodeURIComponent(to)}` : to;
  return (
  <li className="flex-1">
    <NavLink
      to={href}
      end={end}
      onClick={() => triggerHaptic("impactLight")}
      className={({ isActive }) =>
        `flex h-full flex-col items-center justify-center gap-0.5 px-1 py-1 transition ${
          isActive ? "text-ink" : "text-ink-tertiary hover:text-ink-secondary"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2 : 1.6} />
          <span
            className={`text-[12px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  </li>
  );
};
