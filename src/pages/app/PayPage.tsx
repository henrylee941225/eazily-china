import { useEffect, useState, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChevronRight, ChevronLeft } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { AppLayout } from "@/components/AppLayout";

// ---------- Palette ----------
// Aligned to the EazilyChina design system (see index.css). Brand colours for
// Alipay and WeChat are kept verbatim so logos / chrome remain recognisable.
const C = {
  cream:     "hsl(36 33% 97%)",   // --background
  cream2:    "hsl(32 25% 92%)",   // --muted
  ink:       "hsl(12 30% 10%)",   // --ink
  inkSoft:   "hsl(12 18% 22%)",   // --ink-soft
  inkMuted:  "hsl(12 12% 38%)",   // --muted-foreground
  line:      "hsl(12 30% 10% / 0.08)",
  lineStrong:"hsl(12 30% 10% / 0.18)",
  coral:     "hsl(4 78% 52%)",    // --vermilion
  amberBg:   "hsl(38 75% 58% / 0.18)",
  amberInk:  "hsl(28 70% 20%)",
  rowBg:     "hsl(32 35% 93%)",
  rowHiBg:   "hsl(14 88% 58% / 0.12)",
  // Brand colours — keep as-is.
  alipay:    "#1677FF",
  alipaySoft:"#E6F1FB",
  alipayInk: "#042C53",
  wechat:    "#07C160",
};

type Screen =
  | "landing" | "ecosystem"
  | "alipay-1" | "alipay-2" | "alipay-3" | "alipay-4" | "alipay-5" | "alipay-done"
  | "wechat-1" | "wechat-2" | "wechat-3" | "wechat-4" | "wechat-5" | "wechat-done";

const ALIPAY_ORDER: Screen[] = ["alipay-1","alipay-2","alipay-3","alipay-4","alipay-5","alipay-done"];
const WECHAT_ORDER: Screen[] = ["wechat-1","wechat-2","wechat-3","wechat-4","wechat-5","wechat-done"];

const KEY_A = "eazily_alipay_step";
const KEY_W = "eazily_wechat_step";

// ---------- Logos (verbatim from spec) ----------
const AlipayLogo = ({ size = 44 }: { size?: number }) => (
  <div style={{ width: size, height: size, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
      <rect width="48" height="48" fill="#1677FF"/>
      <text x="24" y="36" textAnchor="middle"
        fontFamily="'PingFang SC','Microsoft YaHei','Hiragino Sans GB',sans-serif"
        fontSize="32" fontWeight="700" fill="white">支</text>
    </svg>
  </div>
);

const WechatLogo = ({ size = 44 }: { size?: number }) => (
  <div style={{ width: size, height: size, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
      <rect width="48" height="48" fill="#07C160"/>
      <ellipse cx="20" cy="22" rx="11" ry="9" fill="white"/>
      <polygon points="13,29 11.5,32.5 17,30" fill="white"/>
      <circle cx="17" cy="21" r="1.4" fill="#07C160"/>
      <circle cx="23" cy="21" r="1.4" fill="#07C160"/>
      <ellipse cx="33" cy="32" rx="8.5" ry="7" fill="white"/>
      <polygon points="38,38.5 41,41.5 36.5,39" fill="white"/>
      <circle cx="30" cy="31" r="1.1" fill="#07C160"/>
      <circle cx="36" cy="31" r="1.1" fill="#07C160"/>
    </svg>
  </div>
);

// ---------- Generic UI primitives ----------
const Eyebrow = ({ children, color = C.inkMuted }: { children: ReactNode; color?: string }) => (
  <div style={{
    fontFamily: "var(--font-body)",
    fontSize: 11, fontWeight: 600, letterSpacing: "0.16em",
    textTransform: "uppercase", color,
  }}>{children}</div>
);

const Headline = ({ children }: { children: ReactNode }) => (
  <h1 className="font-display" style={{
    fontWeight: 300, lineHeight: 1.05, fontSize: 38,
    letterSpacing: "-0.02em", color: C.ink, margin: 0,
  }}>{children}</h1>
);

const Italic = ({ children }: { children: ReactNode }) => (
  <em className="font-display" style={{ color: C.coral, fontStyle: "italic", fontWeight: 300 }}>{children}</em>
);

const Body = ({ children, color = C.inkSoft }: { children: ReactNode; color?: string }) => (
  <p style={{ fontFamily: "var(--font-body)", fontSize: 15, lineHeight: 1.55, color, margin: 0 }}>{children}</p>
);

const TextNav = ({ children, onClick, ariaLabel }: { children: ReactNode; onClick: () => void; ariaLabel?: string }) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    onMouseEnter={(e) => (e.currentTarget.style.color = C.ink)}
    onMouseLeave={(e) => (e.currentTarget.style.color = C.inkSoft)}
    style={{
      background: "transparent", border: "none", cursor: "pointer",
      color: C.inkSoft, fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500,
      padding: 0,
    }}
  >{children}</button>
);

const PrimaryButton = ({
  children, onClick, bg, color = "#fff",
}: { children: ReactNode; onClick: () => void; bg: string; color?: string }) => (
  <button onClick={onClick} style={{
    width: "100%", padding: "15px 20px", borderRadius: 12,
    background: bg, color, border: "none", cursor: "pointer",
    fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600,
    letterSpacing: "-0.005em",
  }}>{children}</button>
);

const SecondaryButton = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button onClick={onClick} style={{
    width: "100%", padding: "14px 20px", borderRadius: 12,
    background: "transparent", color: C.ink,
    border: `1px solid ${C.lineStrong}`, cursor: "pointer",
    fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 500,
  }}>{children}</button>
);

// ---------- Screen frame ----------
const ScreenFrame = ({ children }: { children: ReactNode }) => (
  <div style={{
    minHeight: "100vh", background: C.cream,
    padding: "56px 24px 112px",
    fontFamily: "var(--font-body)",
    color: C.ink,
  }}>
    <div style={{ maxWidth: 380, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {children}
    </div>
  </div>
);

// ---------- Header / progress ----------
const Header = ({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, minHeight: 22 }}>
    <div style={{ justifySelf: "start" }}>{left}</div>
    <div style={{ justifySelf: "center" }}>{center}</div>
    <div style={{ justifySelf: "end" }}>{right}</div>
  </div>
);

const Progress = ({ pct, fill, label }: { pct: number; fill: string; label: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div style={{ flex: 1, height: 3, background: C.line, borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: fill, transition: "width 250ms" }} />
    </div>
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
      textTransform: "uppercase", color: C.inkMuted, fontVariantNumeric: "tabular-nums" }}>
      {label}
    </div>
  </div>
);

// ---------- Mocked phone-card primitives ----------
const PhoneCard = ({ children }: { children: ReactNode }) => (
  <div style={{
    width: 190, background: "#fff", borderRadius: 12, padding: 12,
    boxShadow: "0 8px 24px -16px rgba(31,26,20,0.25)",
    display: "flex", flexDirection: "column", gap: 8,
  }}>
    {children}
  </div>
);

const StepVisual = ({ children }: { children: ReactNode }) => (
  <div style={{
    height: 220, background: C.cream2, borderRadius: 18,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    {children}
  </div>
);

const Row = ({ children, highlighted }: { children: ReactNode; highlighted?: boolean }) => (
  <div style={{
    background: highlighted ? C.rowHiBg : C.rowBg,
    border: highlighted ? `1.5px solid ${C.coral}` : "none",
    padding: highlighted ? "8px 10px" : 9,
    borderRadius: 6,
    color: highlighted ? C.ink : C.inkSoft,
    fontSize: 12, fontWeight: highlighted ? 600 : 500,
  }}>{children}</div>
);

// ---------- Mock visuals per step ----------
const DownloadMock = ({ app }: { app: "alipay" | "wechat" }) => (
  <PhoneCard>
    <Eyebrow>App Store</Eyebrow>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {app === "alipay" ? <AlipayLogo size={38} /> : <WechatLogo size={38} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
          {app === "alipay" ? "Alipay" : "WeChat"}
        </div>
        <div style={{ fontSize: 10, color: C.inkMuted }}>Free</div>
      </div>
      <div style={{
        background: C.coral, color: "#fff",
        padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      }}>Get</div>
    </div>
  </PhoneCard>
);

const SignupMock = () => (
  <PhoneCard>
    <Eyebrow>Sign up</Eyebrow>
    <Row>Country / region</Row>
    <Row highlighted>+44 _________</Row>
    <div style={{ textAlign: "center", fontSize: 10, color: C.inkMuted, marginTop: 2 }}>Send SMS code</div>
  </PhoneCard>
);

const SettingsMock = () => (
  <PhoneCard>
    <Eyebrow>Me · Settings</Eyebrow>
    <Row>Account</Row>
    <Row highlighted>Identity verification</Row>
    <Row>Password</Row>
    <Row>Privacy</Row>
  </PhoneCard>
);

const AlipayCardsMock = () => (
  <PhoneCard>
    <Eyebrow>Bank Cards</Eyebrow>
    <Row>No cards yet</Row>
    <Row highlighted>Add card</Row>
    <div style={{ textAlign: "center", fontSize: 10, color: C.inkMuted, marginTop: 2 }}>
      Visa · Mastercard · Amex · JCB
    </div>
  </PhoneCard>
);

const QrFriendMock = () => {
  // Stylised QR — 21×21 grid with three finder patterns (corner squares),
  // a deterministic pseudo-random data field, and a centred WeChat dot.
  const N = 21;
  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) =>
      r >= br && r <= br + 6 && c >= bc && c <= bc + 6;
    if (!(inBox(0, 0) || inBox(0, N - 7) || inBox(N - 7, 0))) return null;
    // outer ring (7x7)
    const ringR = (br: number, bc: number) =>
      r === br || r === br + 6 || c === bc || c === bc + 6;
    // inner solid (3x3)
    const innerR = (br: number, bc: number) =>
      r >= br + 2 && r <= br + 4 && c >= bc + 2 && c <= bc + 4;
    for (const [br, bc] of [[0, 0], [0, N - 7], [N - 7, 0]] as const) {
      if (r >= br && r <= br + 6 && c >= bc && c <= bc + 6) {
        if (ringR(br, bc) || innerR(br, bc)) return true;
        return false;
      }
    }
    return null;
  };
  // separator: 1-cell white gutter around finders → already false above
  // deterministic noise for data area
  const dataOn = (r: number, c: number) => {
    const v = (r * 73856093) ^ (c * 19349663) ^ ((r + c) * 83492791);
    return ((v >>> 0) % 100) < 48;
  };
  const cells: ReactNode[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const fin = isFinder(r, c);
      const on = fin === null ? dataOn(r, c) : fin;
      cells.push(
        <div key={`${r}-${c}`} style={{ background: on ? C.ink : "#fff" }} />
      );
    }
  }
  return (
    <PhoneCard>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{
          background: "#fff", padding: 6, borderRadius: 6,
          boxShadow: "0 0 0 1px rgba(31,26,20,0.06)",
          position: "relative",
        }}>
          <div style={{
            width: 96, height: 96,
            display: "grid",
            gridTemplateColumns: `repeat(${N}, 1fr)`,
            gridTemplateRows: `repeat(${N}, 1fr)`,
            gap: 0,
          }}>{cells}</div>
          {/* Centre WeChat-green badge to suggest a personal QR */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 22, height: 22, borderRadius: 5,
            background: C.wechat,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff",
          }}>
            <div style={{
              width: 10, height: 7, background: "#fff", borderRadius: "50%",
            }} />
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: C.inkSoft }}>Ask a friend to scan</div>
    </PhoneCard>
  );
};

const WechatServicesMock = () => (
  <PhoneCard>
    <Eyebrow>Me · Services</Eyebrow>
    <Row>Pay Friends</Row>
    <Row highlighted>Wallet</Row>
    <Row>Mobile Top-up</Row>
    <Row>Transfer</Row>
  </PhoneCard>
);

const WechatCardsMock = () => (
  <PhoneCard>
    <Eyebrow>Wallet · Cards</Eyebrow>
    <Row>No cards yet</Row>
    <Row highlighted>Add a card</Row>
    <div style={{ textAlign: "center", fontSize: 10, color: C.inkMuted, marginTop: 2 }}>
      Visa · Mastercard · Amex · JCB
    </div>
  </PhoneCard>
);

// ---------- Callouts ----------
const AlipayCallout = ({ label, body }: { label: string; body: string }) => (
  <div style={{ background: C.alipaySoft, color: C.alipayInk, padding: 14, borderRadius: 10 }}>
    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{body}</div>
  </div>
);

const AmberCallout = ({ label, body }: { label: string; body: string }) => (
  <div style={{ background: C.amberBg, color: C.amberInk, padding: 14, borderRadius: 10 }}>
    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{body}</div>
  </div>
);

// ---------- Wizard step shell ----------
type WizardStepProps = {
  app: "alipay" | "wechat";
  stepNum: number;
  totalSteps: number;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  visual: ReactNode;
  stepLabel: string;
  title: string;
  instruction: ReactNode;
  callout?: ReactNode;
};

const WizardStep = ({ app, stepNum, totalSteps, onClose, onBack, onNext, visual, stepLabel, title, instruction, callout }: WizardStepProps) => {
  const eyebrow = app === "alipay" ? "Set up Alipay" : "Set up WeChat Pay";
  const pct = Math.round((stepNum / totalSteps) * 100);
  const isLast = stepNum === totalSteps;
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-card">
      {/* Top bar */}
      <header
        className="flex shrink-0 items-center gap-2 border-b border-foreground/10 bg-card/95 px-2 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/80 hover:bg-muted"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-vermilion">
            {eyebrow}
          </div>
          <div className="truncate font-display text-base text-ink">
            Step {stepNum} of {totalSteps}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 px-3 text-[12px] font-medium text-muted-foreground hover:text-ink"
        >
          Close
        </button>
      </header>

      {/* Thin progress bar */}
      <div className="h-[3px] w-full shrink-0 bg-muted">
        <div
          className="h-full bg-vermilion transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Scroll body */}
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-5">
          {/* Step visual */}
          <div className="flex items-center justify-center rounded-2xl border border-foreground/10 bg-muted/40 px-4 py-6">
            {visual}
          </div>

          {/* Step content */}
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vermilion text-xs font-semibold text-cream">
              {stepNum}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {stepLabel}
              </div>
              <h2 className="mt-1 font-display text-xl text-ink">{title}</h2>
              <div className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
                {instruction}
              </div>
            </div>
          </div>

          {callout && <div>{callout}</div>}
        </div>
      </div>

      {/* Sticky action bar */}
      <div
        className="flex shrink-0 items-center gap-2 border-t border-foreground/10 bg-card px-3 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-2xl border border-foreground/15 bg-card px-4 py-3 text-sm text-ink transition hover:bg-muted/40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-[2] rounded-2xl bg-vermilion px-4 py-3 text-sm font-medium text-cream transition hover:bg-vermilion-deep"
        >
          {isLast ? "Finish" : "Next step"}
        </button>
      </div>
    </div>
  );
};

// ---------- Strong helper ----------
const S = ({ children }: { children: ReactNode }) => (
  <strong style={{ color: C.ink, fontWeight: 700 }}>{children}</strong>
);

// ---------- Done sheet (native style, matches rest of app) ----------
type DoneSheetProps = {
  eyebrow: string;
  title: string;
  body: string;
  calloutEyebrow: string;
  calloutTitle: string;
  calloutBody: string;
  onBack: () => void;
  onPrimary: () => void;
  primaryLabel: string;
};

const DoneSheet = ({ eyebrow, title, body, calloutEyebrow, calloutTitle, calloutBody, onBack, onPrimary, primaryLabel }: DoneSheetProps) => (
  <div className="fixed inset-0 z-[80] flex flex-col bg-card">
    <header
      className="flex shrink-0 items-center gap-2 border-b border-foreground/10 bg-card/95 px-2 py-3"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/80 hover:bg-muted"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-vermilion">
          {eyebrow}
        </div>
        <div className="truncate font-display text-base text-ink">All set</div>
      </div>
    </header>

    <div className="h-[3px] w-full shrink-0 bg-muted">
      <div className="h-full w-full bg-vermilion" />
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-6">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-vermilion">
            Ready
          </div>
          <h2 className="mt-1 font-display text-2xl text-ink">{title}</h2>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{body}</p>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-card px-4 py-3.5 shadow-soft">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-vermilion">
            {calloutEyebrow}
          </div>
          <div className="mt-1 font-display text-base text-ink">{calloutTitle}</div>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{calloutBody}</p>
        </div>
      </div>
    </div>

    <div
      className="flex shrink-0 items-center gap-2 border-t border-foreground/10 bg-card px-3 pt-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
    >
      <button
        type="button"
        onClick={onPrimary}
        className="w-full rounded-2xl bg-vermilion px-4 py-3 text-sm font-medium text-cream transition hover:bg-vermilion-deep"
      >
        {primaryLabel}
      </button>
    </div>
  </div>
);

// ============= Main page =============
const PayPage = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("landing");
  const [fade, setFade] = useState(1);
  const [alipayProgress, setAlipayProgress] = useState<string | null>(null);
  const [wechatProgress, setWechatProgress] = useState<string | null>(null);

  // Always reset progress when the user (re-)enters the Pay section.
  // Guides should start from step 1 every time.
  useEffect(() => {
    try {
      localStorage.removeItem(KEY_A);
      localStorage.removeItem(KEY_W);
    } catch { /* noop */ }
    setAlipayProgress(null);
    setWechatProgress(null);
  }, []);

  const goto = useCallback((next: Screen) => {
    setFade(0);
    window.setTimeout(() => {
      setScreen(next);
      setFade(1);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }, 250);
  }, []);

  const writeAlipay = (val: string) => {
    try { localStorage.setItem(KEY_A, val); } catch { /* noop */ }
    setAlipayProgress(val);
  };
  const writeWechat = (val: string) => {
    try { localStorage.setItem(KEY_W, val); } catch { /* noop */ }
    setWechatProgress(val);
  };

  // Keyboard arrow nav
  useEffect(() => {
    const order: Screen[] = [
      "landing", "ecosystem",
      ...ALIPAY_ORDER,
      ...WECHAT_ORDER,
    ];
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const idx = order.indexOf(screen);
      if (idx < 0) return;
      const next = e.key === "ArrowRight" ? order[idx + 1] : order[idx - 1];
      if (next) goto(next);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen, goto]);

  // Advance helper for a wizard step
  const advanceAlipay = (currentStepNum: number, nextScreen: Screen) => {
    const newVal = nextScreen === "alipay-done" ? "complete" : String(currentStepNum + 1);
    writeAlipay(newVal);
    goto(nextScreen);
  };
  const advanceWechat = (currentStepNum: number, nextScreen: Screen) => {
    const newVal = nextScreen === "wechat-done" ? "complete" : String(currentStepNum + 1);
    writeWechat(newVal);
    goto(nextScreen);
  };

  const ctaLabel = (progress: string | null): string => {
    if (progress === "complete") return "Open guide";
    if (progress && /^\d+$/.test(progress)) return "Continue setup";
    return "Set it up";
  };

  // Always start guides from step 1.
  const alipayEntry: Screen = "alipay-1";
  const wechatEntry: Screen = "wechat-1";

  // ---------- Renderers ----------
  const renderLanding = () => (
    <AppLayout title="Pay" subtitle="Alipay & WeChat Pay" showBack backTo="/">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {/* First time in China */}
        <button
          onClick={() => goto("ecosystem")}
          className="group flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3.5 text-left shadow-soft transition hover:border-vermilion/40"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-vermilion shadow-soft">
            <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-base text-ink">How to pay in China</span>
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              First time? Read in under a minute
            </div>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-vermilion">Read</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-vermilion" />
        </button>

        {/* Alipay */}
        <button
          onClick={() => goto(alipayEntry)}
          className="group flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3.5 text-left shadow-soft transition hover:border-vermilion/40"
        >
          <AlipayLogo size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-base text-ink">Alipay</span>
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Easiest for first-time visitors
            </div>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-vermilion">View guide</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-vermilion" />
        </button>

        {/* WeChat Pay */}
        <button
          onClick={() => goto(wechatEntry)}
          className="group flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3.5 text-left shadow-soft transition hover:border-vermilion/40"
        >
          <WechatLogo size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-base text-ink">WeChat Pay</span>
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Set up after Alipay
            </div>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-vermilion">View guide</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-vermilion" />
        </button>

        {/* Coming soon */}
        <div className="rounded-2xl border border-vermilion/20 bg-vermilion/5 px-4 py-3.5">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-vermilion">
            Coming soon
          </div>
          <div className="mt-1 font-display text-base text-ink">
            Pay directly in eazilyChina
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            We're building one-tap payments inside the app — no Alipay or WeChat needed.
          </p>
        </div>
      </div>
    </AppLayout>
  );

  const renderEcosystem = () => {
    const STEPS: Array<{ title: string; body: string }> = [
      { title: "Cash is rare", body: "Almost every shop, taxi, market and street vendor expects mobile payment. Many places no longer accept cash at all." },
      { title: "Two apps run everything", body: "Alipay and WeChat Pay. Locals use one or the other — sometimes both. The same QR code is shown to either." },
      { title: "You scan, or get scanned", body: "At small shops, look for a printed QR code on the counter — open the app, tap Scan, point your camera, enter the amount, then confirm with your face or fingerprint. At bigger stores the cashier scans your personal QR instead. Either way, payment lands in seconds." },
      { title: "Your foreign card works", body: "Since 2024, Visa, Mastercard, Amex and JCB link directly to both apps. No Chinese bank account needed." },
    ];
    return (
      <div className="fixed inset-0 z-[80] flex flex-col bg-card">
        <header
          className="flex shrink-0 items-center gap-2 border-b border-foreground/10 bg-card/95 px-2 py-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
        >
          <button
            type="button"
            onClick={() => goto("landing")}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/80 hover:bg-muted"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-vermilion">
              How to pay in China
            </div>
            <div className="truncate font-display text-base text-ink">
              Four things to know before you arrive
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ol className="divide-y divide-foreground/10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3 px-5 py-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vermilion text-xs font-semibold text-cream">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-ink">{s.title}</div>
                  <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                    {s.body}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div
          className="flex shrink-0 items-center gap-2 border-t border-foreground/10 bg-card px-3 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
        >
          <button
            type="button"
            onClick={() => goto("landing")}
            className="w-full rounded-2xl bg-vermilion px-4 py-3 text-sm font-medium text-cream transition hover:bg-vermilion-deep"
          >
            View guides
          </button>
        </div>
      </div>
    );
  };

  const onClose = () => goto("landing");

  // ---------- Alipay steps ----------
  const renderAlipayStep = (n: 1 | 2 | 3 | 4 | 5) => {
    const next: Screen = n === 5 ? "alipay-done" : (`alipay-${n + 1}` as Screen);
    const prev: Screen = n === 1 ? "landing" : (`alipay-${n - 1}` as Screen);
    const props: Omit<WizardStepProps, "visual" | "title" | "instruction" | "callout" | "stepLabel"> = {
      app: "alipay", stepNum: n, totalSteps: 5,
      onClose, onBack: () => goto(prev), onNext: () => advanceAlipay(n, next),
    };
    if (n === 1) return (
      <WizardStep {...props} stepLabel="Step one" visual={<DownloadMock app="alipay" />}
        title="Download Alipay"
        instruction={<>Search "Alipay" in your phone's app store and install it. It's free.</>} />
    );
    if (n === 2) return (
      <WizardStep {...props} stepLabel="Step two" visual={<SignupMock />}
        title="Sign up with your phone"
        instruction={<>Use your home number — for example, +44 if you're from the UK. Alipay will text you a code. Make sure your number can receive SMS while you're abroad.</>} />
    );
    if (n === 3) return (
      <WizardStep {...props} stepLabel="Step three" visual={<SettingsMock />}
        title="Verify your passport"
        instruction={<>In Alipay, go to <S>Me</S>, then <S>Settings</S>, then <S>Identity verification</S>. Take a photo of your passport and a quick selfie. Takes about a minute.</>} />
    );
    if (n === 4) return (
      <WizardStep {...props} stepLabel="Step four" visual={<AlipayCardsMock />}
        title="Add your card"
        instruction={<>Go to <S>Me</S>, then <S>Bank Cards</S>, then <S>Add card</S>. Enter your Visa, Mastercard, Amex or JCB. Your bank may text you a confirmation code.</>}
        callout={<AlipayCallout label="If your card is declined" body="Tell your bank you're travelling to China. Many block China transactions by default until you let them know." />} />
    );
    // n === 5: optional fifth step — spec lists 5 alipay wizard steps but only describes 4. Use a "review & open" placeholder so 5/5 is reachable. Actually re-reading spec: "5 Alipay wizard steps". Steps 1-4 described. Step 5 isn't explicitly described. Per "Build order" suggests proceed. We need a 5th. Reusing card-confirmation isn't specified. Skip — actually spec says "5 Alipay wizard steps". Let me reconsider.
    return (
      <WizardStep {...props} stepLabel="Step five" visual={<AlipayCardsMock />}
        title="Try a small payment"
        instruction={<>Once your card is linked, send yourself a small test by tapping <S>Pay</S> on Alipay's home screen and scanning any merchant QR. If it confirms in seconds, you're ready.</>} />
    );
  };

  const renderAlipayDone = () => (
    <DoneSheet
      eyebrow="Set up Alipay"
      title="You're set to pay"
      body="Alipay is verified and your card is linked. You can pay anywhere in China that takes a QR code — which is almost everywhere."
      calloutEyebrow="One more thing"
      calloutTitle="Pay directly in EazilyChina, coming soon"
      calloutBody="We're working on in-app payments so you won't need to download Chinese apps to pay in China — everything will happen right inside EazilyChina. Stay tuned."
      onBack={() => goto("alipay-5")}
      onPrimary={() => goto("landing")}
      primaryLabel="View guides"
    />
  );

  // ---------- WeChat steps ----------
  const renderWechatStep = (n: 1 | 2 | 3 | 4 | 5) => {
    const next: Screen = n === 5 ? "wechat-done" : (`wechat-${n + 1}` as Screen);
    const prev: Screen = n === 1 ? "landing" : (`wechat-${n - 1}` as Screen);
    const props: Omit<WizardStepProps, "visual" | "title" | "instruction" | "callout" | "stepLabel"> = {
      app: "wechat", stepNum: n, totalSteps: 6,
      onClose, onBack: () => goto(prev), onNext: () => advanceWechat(n, next),
    };
    if (n === 1) return (
      <WizardStep {...props} stepLabel="Step one" visual={<DownloadMock app="wechat" />}
        title="Download WeChat"
        instruction={<>Install WeChat from the App Store or Google Play.</>}
        callout={<AmberCallout label="Turn off your VPN first" body="A VPN is the number one cause of WeChat setup failing. Disable it before opening the app — turn it back on afterwards if you need it." />} />
    );
    if (n === 2) return (
      <WizardStep {...props} stepLabel="Step two" visual={<SignupMock />}
        title="Sign up with your phone"
        instruction={<>Use your home number — the same one you used for Alipay is fine. WeChat sends an SMS code to verify it.</>} />
    );
    if (n === 3) return (
      <WizardStep {...props} stepLabel="Step three" visual={<QrFriendMock />}
        title="Ask someone to verify you"
        instruction={<>WeChat may show you a QR code and ask another WeChat user to scan it, to confirm you're a real person. A friend, colleague, or even hotel reception can do this in five seconds.</>} />
    );
    if (n === 4) return (
      <WizardStep {...props} stepLabel="Step four" visual={<WechatServicesMock />}
        title="Verify your passport"
        instruction={<>Go to <S>Me</S>, then <S>Services</S>, then <S>Wallet</S>. Upload your passport and complete a face scan.</>}
        callout={<AmberCallout label='Can&apos;t see "Services"?' body="Ask a WeChat friend to send you one yuan in a chat first. Tapping the money unlocks the wallet menu." />} />
    );
    // n === 5
    return (
      <WizardStep {...props} stepLabel="Step five" visual={<WechatCardsMock />}
        title="Add your card"
        instruction={<>Inside <S>Wallet</S>, tap <S>Cards</S>, then <S>Add a card</S>. Visa, Mastercard, Amex and JCB all work. Confirm with your bank's one-time code.</>} />
    );
  };

  const renderWechatDone = () => (
    <DoneSheet
      eyebrow="Set up WeChat Pay"
      title="You'll pay like a local"
      body="Alipay and WeChat Pay are both set up. Either one works at almost any shop, taxi, market or restaurant in China."
      calloutEyebrow="One more thing"
      calloutTitle="Pay directly in EazilyChina, coming soon"
      calloutBody="We're working on in-app payments so you won't need to download Chinese apps to pay in China — everything will happen right inside EazilyChina. Stay tuned."
      onBack={() => goto("wechat-5")}
      onPrimary={() => goto("landing")}
      primaryLabel="View guides"
    />
  );

  // Master switch
  const renderScreen = () => {
    switch (screen) {
      case "landing": return renderLanding();
      case "ecosystem": return renderEcosystem();
      case "alipay-1": return renderAlipayStep(1);
      case "alipay-2": return renderAlipayStep(2);
      case "alipay-3": return renderAlipayStep(3);
      case "alipay-4": return renderAlipayStep(4);
      case "alipay-5": return renderAlipayStep(5);
      case "alipay-done": return renderAlipayDone();
      case "wechat-1": return renderWechatStep(1);
      case "wechat-2": return renderWechatStep(2);
      case "wechat-3": return renderWechatStep(3);
      case "wechat-4": return renderWechatStep(4);
      case "wechat-5": return renderWechatStep(5);
      case "wechat-done": return renderWechatDone();
    }
  };

  return (
    <div style={{ opacity: fade, transition: "opacity 250ms ease", background: C.cream, minHeight: "100vh" }}>
      {renderScreen()}
      <BottomTabBar />
    </div>
  );
};

export default PayPage;
