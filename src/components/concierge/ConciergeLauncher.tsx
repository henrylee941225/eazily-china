import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer as DrawerPrimitive } from "vaul";
import {
  ArrowUp,
  ArrowUpRight,
  Car,
  ChevronRight,
  Mic,
  QrCode,
  Sparkles,
  Sunrise,
  Utensils,
  Wifi,
  X,
} from "lucide-react";
import { triggerHaptic } from "@/integrations/median";
import { TRANSFERS_ENABLED } from "@/lib/featureFlags";

type Ctx = { open: () => void };
const LauncherCtx = createContext<Ctx | null>(null);

export const useConciergeLauncher = () => {
  const ctx = useContext(LauncherCtx);
  if (!ctx) throw new Error("useConciergeLauncher must be used within ConciergeLauncherProvider");
  return ctx;
};

export const ConciergeLauncherProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const openedRef = useRef(false);

  const open = useCallback(() => {
    openedRef.current = true;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const goChat = useCallback(
    (prefill?: string) => {
      setIsOpen(false);
      setInput("");
      navigate("/concierge/chat", prefill ? { state: { prefill } } : undefined);
    },
    [navigate],
  );

  const submitTyped = () => {
    const t = input.trim();
    if (!t) return;
    goChat(t);
  };

  return (
    <LauncherCtx.Provider value={{ open }}>
      {children}
      <DrawerPrimitive.Root open={isOpen} onOpenChange={setIsOpen} shouldScaleBackground={false}>
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <DrawerPrimitive.Content
            className="fixed inset-x-0 bottom-0 top-0 z-[70] flex flex-col bg-white outline-none"
            aria-describedby={undefined}
          >
            <DrawerPrimitive.Title className="sr-only">Concierge</DrawerPrimitive.Title>

            {/* Header */}
            <div
              className="flex items-center justify-between px-5"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles
                  className="h-4 w-4 text-[hsl(var(--brand-red))]"
                  strokeWidth={2}
                  fill="currentColor"
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--brand-red))]">
                  Concierge
                </span>
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-surface-3"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            {/* Body */}
            <div className="mx-auto w-full max-w-[440px] flex-1 overflow-y-auto px-5 pb-6 pt-4">
              <h1 className="text-[28px] font-extrabold leading-[1.15] text-ink">
                What can I get done for you?
              </h1>

              <SectionLabel className="mt-6">Request a service</SectionLabel>
              <ul className="mt-2 space-y-2">
                <ServiceRow
                  icon={Utensils}
                  label="Book a restaurant"
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/book/restaurant");
                  }}
                />
                {TRANSFERS_ENABLED && (
                  <ServiceRow
                    icon={Car}
                    label="Book a private transfer"
                    onClick={() => {
                      setIsOpen(false);
                      navigate("/transfers");
                    }}
                  />
                )}
                <ServiceRow
                  icon={Sunrise}
                  label="Plan my day"
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/ai/plan");
                  }}
                />
              </ul>

              <SectionLabel className="mt-6">Ask about China</SectionLabel>
              <ul className="mt-2 space-y-2">
                <SuggestionRow
                  icon={QrCode}
                  label="How do I pay with Alipay?"
                  onClick={() => goChat("How do I pay with Alipay?")}
                />
                <SuggestionRow
                  icon={Wifi}
                  label="Do I need a VPN or eSIM?"
                  onClick={() => goChat("Do I need a VPN or eSIM?")}
                />
              </ul>
            </div>

            {/* Composer */}
            <div
              className="border-t border-border bg-white px-4 pt-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitTyped();
                }}
                className="mx-auto flex max-w-[440px] items-center gap-2"
              >
                <div className="flex flex-1 items-center rounded-full bg-surface-2 px-4">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything…"
                    className="w-full border-0 bg-transparent py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-secondary/80"
                  />
                </div>
                {input.trim() ? (
                  <button
                    type="submit"
                    aria-label="Send"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition active:scale-95"
                  >
                    <ArrowUp className="h-5 w-5" strokeWidth={2} />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Voice input"
                    onClick={() => goChat()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink transition hover:bg-surface-3"
                  >
                    <Mic className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                )}
              </form>
            </div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </LauncherCtx.Provider>
  );
};

const SectionLabel = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <p
    className={`text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary ${className}`}
  >
    {children}
  </p>
);

const ServiceRow = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Utensils;
  label: string;
  onClick: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={() => {
        triggerHaptic("impactLight");
        onClick();
      }}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60"
    >
      <Icon
        className="h-5 w-5 shrink-0 text-[hsl(var(--brand-red))]"
        strokeWidth={1.75}
      />
      <span className="flex-1 text-[15px] font-semibold text-ink">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" strokeWidth={2} />
    </button>
  </li>
);

const SuggestionRow = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof QrCode;
  label: string;
  onClick: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={() => {
        triggerHaptic("impactLight");
        onClick();
      }}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 text-left transition-colors hover:bg-surface-3"
    >
      <Icon className="h-5 w-5 shrink-0 text-ink" strokeWidth={1.75} />
      <span className="flex-1 text-[15px] font-medium text-ink">{label}</span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-tertiary" strokeWidth={2} />
    </button>
  </li>
);