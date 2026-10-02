import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl, isCapacitorApp, openExternalUrl } from "@/integrations/capacitor";
import { createNativeManagedOAuthUrl } from "@/integrations/capacitor/nativeOAuth";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ArrowLeft, Check, Mail, Inbox, Lock, User as UserIcon, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { triggerHaptic } from "@/integrations/median";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Wordmark } from "@/components/Wordmark";
import shanghaiHero from "@/assets/shanghai-skyline-hero.jpg";
import { SOCIAL_LOGIN_BUTTONS_ENABLED } from "@/lib/featureFlags";

// Length of the signup verification code emailed by the backend.
// Change here if the backend OTP length ever changes — everything else adapts.
const OTP_LENGTH = 8;

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [nextDestination] = useState<string | null>(() => {
    const nextParam = searchParams.get("next");
    return nextParam && nextParam.startsWith("/") ? nextParam : null;
  });
  // Returning users go straight home; the home page already handles routing
  // them to onboarding if their profile isn't completed yet.
  const signinRedirect = nextDestination ?? "/";
  // Preserve ?next= through the signup pipeline: OTP → profile setup → final nav.
  const profileSetupRedirect = nextDestination
    ? `/profile-setup?next=${encodeURIComponent(nextDestination)}`
    : "/profile-setup";
  const traceOpsSignup = nextDestination?.startsWith("/ops") ?? false;

  useEffect(() => {
    if (!traceOpsSignup) return;
    console.info("[ops signup trace] auth screen", {
      url: window.location.href,
      next: nextDestination,
      profileSetupRedirect,
    });
  }, [traceOpsSignup, nextDestination, profileSetupRedirect]);
  const mailAppHref = (addr: string) => {
    const domain = addr.split("@")[1]?.toLowerCase() ?? "";
    if (domain.includes("gmail")) return "https://mail.google.com";
    if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) return "https://outlook.live.com/mail";
    if (domain.includes("yahoo")) return "https://mail.yahoo.com";
    if (domain.includes("icloud") || domain.includes("me.com") || domain.includes("mac.com")) return "https://www.icloud.com/mail";
    if (domain.includes("proton")) return "https://mail.proton.me";
    return `mailto:${addr}`;
  };
  // Shared acceptance notice — must appear on every path that can create an account.
  const legalNotice = (
    <p className="text-center text-[12px] leading-snug text-muted-foreground">
      By continuing you agree to our{" "}
      <Link to="/legal/terms" className="underline underline-offset-2 hover:text-ink">
        Terms &amp; Conditions
      </Link>{" "}
      and{" "}
      <Link to="/legal/privacy" className="underline underline-offset-2 hover:text-ink">
        Privacy Policy
      </Link>
      .
    </p>
  );
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  // Visual steps:
  //  - "welcome" (signin email step, hero photo)
  //  - "password" (signin password step)
  //  - "signup"   (single signup form: name + email + password)
  //  - "sent"     (post-signup email confirmation)
  const [step, setStep] = useState<"welcome" | "password" | "signup" | "code" | "sent">(
    initialMode === "signup" ? "signup" : "welcome",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  // OTP state for the signup verification step
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (otpDigits.length !== OTP_LENGTH) {
      setOtpDigits((digits) => Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] ?? ""));
    }
  }, [otpDigits.length]);

  useEffect(() => {
    if (step === "code") {
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    }
  }, [step]);

  const passwordChecks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "One number", ok: /\d/.test(password) },
  ];
  const passwordValid = passwordChecks.every((c) => c.ok);

  const emailValid = /.+@.+\..+/.test(email.trim());

  const handleContinueEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) {
      toast.error("Enter a valid email address");
      return;
    }
    triggerHaptic("impactLight");
    setMode("signin");
    setStep("password");
    setPasswordError(null);
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !passwordValid) {
      toast.error("Please meet all password requirements.");
      return;
    }
    triggerHaptic("impactMedium");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(profileSetupRedirect),
            data: { display_name: name },
          },
        });
        if (error) throw error;
        if (traceOpsSignup) {
          console.info("[ops signup trace] create account submitted", {
            url: window.location.href,
            next: nextDestination,
            emailRedirectTo: getAuthRedirectUrl(profileSetupRedirect),
          });
        }
        // Supabase returns a "fake" user with empty identities array when the
        // email is already registered (to prevent user enumeration). Detect it
        // and surface a helpful message instead of pretending we sent an email.
        const identities = data?.user?.identities ?? [];
        if (data?.user && identities.length === 0) {
          toast.error("An account with this email already exists. Try logging in instead.");
          setMode("signin");
          setStep("welcome");
          return;
        }
        setOtpDigits(Array(OTP_LENGTH).fill(""));
        setOtpError(null);
        setStep("code");
        startResendTimer();
        toast.success("We've sent a code to your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setPasswordError(error.message || "Incorrect password.");
          throw error;
        }
        navigate(signinRedirect, { replace: true });
      }
    } catch (err: any) {
      if (mode === "signup") {
        toast.error(err.message ?? "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSocialSignIn = async (provider: "google" | "apple") => {
    triggerHaptic("impactLight");
    setBusy(true);
    try {
      if (isCapacitorApp()) {
        await openExternalUrl(createNativeManagedOAuthUrl(provider, signinRedirect));
        return;
      }

      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: getAuthRedirectUrl(signinRedirect),
      });
      if (result.redirected) return;
      if (result.error) throw result.error;

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) throw new Error("Could not complete sign-in");
      navigate(signinRedirect, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: getAuthRedirectUrl("/reset-password"),
      });
      if (error) throw error;
      setForgotOpen(false);
      // Reuse the "sent" screen for the reset confirmation.
      setEmail(forgotEmail);
      setStep("sent");
      startResendTimer();
      toast.success("Check your email for a reset link.");
    } catch (err: any) {
      toast.error(err.message ?? "Could not send reset email");
    } finally {
      setForgotBusy(false);
    }
  };

  const startResendTimer = () => {
    setResendIn(60);
    const id = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) throw error;
      toast.success("New code sent.");
      startResendTimer();
    } catch (err: any) {
      toast.error(err.message ?? "Could not resend code");
    } finally {
      setBusy(false);
    }
  };

  // ---- OTP handlers ----
  const verifyOtp = async (code: string) => {
    setOtpBusy(true);
    setOtpError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "signup",
      });
      if (error) throw error;
      triggerHaptic("impactMedium");
      if (traceOpsSignup) {
        console.info("[ops signup trace] otp verified", {
          url: window.location.href,
          to: profileSetupRedirect,
        });
      }
      navigate(profileSetupRedirect, { replace: true });
    } catch (err: any) {
      triggerHaptic("impactLight");
      const raw = `${err?.message ?? ""} ${err?.code ?? ""}`.toLowerCase();
      const expired =
        raw.includes("expired") || raw.includes("otp_expired") || raw.includes("token has expired");
      setOtpError(
        expired
          ? "That code has expired — tap Resend code to get a new one."
          : "That code didn't match. Check the email and try again.",
      );
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } finally {
      setOtpBusy(false);
    }
  };

  const handleOtpChange = (idx: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      const next = [...otpDigits];
      next[idx] = "";
      setOtpDigits(next);
      return;
    }
    // Paste of full code
    if (clean.length >= OTP_LENGTH) {
      const digits = clean.slice(0, OTP_LENGTH).split("");
      setOtpDigits(digits);
      setOtpError(null);
      otpRefs.current[OTP_LENGTH - 1]?.blur();
      verifyOtp(digits.join(""));
      return;
    }
    const next = [...otpDigits];
    // Handle multi-char input (e.g. pasted 2 digits) by spreading across boxes
    const chars = clean.split("");
    let i = idx;
    for (const ch of chars) {
      if (i > OTP_LENGTH - 1) break;
      next[i] = ch;
      i++;
    }
    setOtpDigits(next);
    setOtpError(null);
    const nextFocus = Math.min(i, OTP_LENGTH - 1);
    otpRefs.current[nextFocus]?.focus();
    if (next.every((d) => d !== "")) {
      verifyOtp(next.join(""));
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (otpDigits[idx]) {
        const next = [...otpDigits];
        next[idx] = "";
        setOtpDigits(next);
        return;
      }
      if (idx > 0) {
        otpRefs.current[idx - 1]?.focus();
        const next = [...otpDigits];
        next[idx - 1] = "";
        setOtpDigits(next);
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < OTP_LENGTH - 1) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  // ---------- Screens ----------

  const renderWelcome = () => (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Hero */}
      <div className="relative h-[200px] w-full overflow-hidden">
        <img
          src={shanghaiHero}
          alt="Shanghai skyline at sunset"
          className="absolute inset-0 h-full w-full object-cover"
          width={1600}
          height={1067}
        />
        {/* Bottom-to-white fade — deepened for the brighter shared hero image
            so the logo and "Welcome back." heading stay legible. */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent via-white/70 to-white" />
        <div className="absolute left-5 right-5 bottom-4">
          <Wordmark className="text-[22px]" />
        </div>
      </div>

      {/* Sheet */}
      <div className="relative flex flex-1 flex-col px-6 pt-5 pb-6">
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          Welcome back.
        </h1>
        <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
          Log in to pick up your trip, bookings and preferences.
        </p>

        <form onSubmit={handleContinueEmail} className="mt-4 space-y-2.5">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
            <Label htmlFor="email" className="sr-only">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@email.com"
              className="h-[52px] rounded-full border-transparent bg-[#F6F6F7] pl-11 pr-4 text-[15px] focus-visible:ring-0 focus-visible:border-ink/20"
            />
          </div>
          <Button
            type="submit"
            disabled={busy || !emailValid}
            className="h-[52px] w-full rounded-full bg-ink text-[15px] font-semibold text-white hover:bg-ink disabled:bg-ink disabled:text-white disabled:opacity-40"
          >
            Continue
          </Button>
        </form>

        {SOCIAL_LOGIN_BUTTONS_ENABLED && (
          <>
        <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-foreground/10" />
          or
          <span className="h-px flex-1 bg-foreground/10" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSocialSignIn("apple")}
            disabled={busy}
            className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#E2E2E2] bg-white text-[15px] font-medium text-ink transition hover:bg-[#F6F6F7] disabled:opacity-50"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16.365 12.826c-.02-2.06 1.68-3.05 1.756-3.096-.958-1.401-2.451-1.593-2.983-1.615-1.27-.128-2.478.75-3.123.75-.644 0-1.638-.732-2.694-.711-1.385.021-2.663.806-3.376 2.045-1.44 2.494-.368 6.184 1.038 8.212.687.993 1.505 2.107 2.579 2.067 1.036-.043 1.427-.671 2.677-.671s1.601.671 2.694.65c1.113-.021 1.818-1.012 2.5-2.008.788-1.152 1.113-2.267 1.132-2.325-.025-.011-2.173-.833-2.2-3.298zM14.42 6.63c.57-.692.955-1.653.85-2.61-.822.033-1.815.547-2.404 1.239-.529.612-.992 1.592-.868 2.531.917.071 1.85-.467 2.422-1.16z"/></svg>
            Apple
          </button>
          <button
            type="button"
            onClick={() => handleSocialSignIn("google")}
            disabled={busy}
            className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#E2E2E2] bg-white text-[15px] font-medium text-ink transition hover:bg-[#F6F6F7] disabled:opacity-50"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden><path fill="#EA4335" d="M5.27 9.76A7.08 7.08 0 0 1 12 4.91c1.85 0 3.52.7 4.79 1.85l3.16-3.16C17.95 1.6 15.18.5 12 .5 7.27.5 3.2 3.21 1.24 7.16l4.03 2.6Z"/><path fill="#34A853" d="M16.04 18.01c-1.13.74-2.6 1.18-4.04 1.18-3.13 0-5.78-2.05-6.7-4.92l-4.04 2.55C3.2 20.79 7.27 23.5 12 23.5c3.05 0 5.97-1.08 8.16-3.12l-4.12-2.37Z"/><path fill="#4A90E2" d="M20.16 20.38c2.15-2 3.34-4.94 3.34-8.38 0-.62-.06-1.27-.17-1.91H12v3.86h6.45c-.34 1.5-1.27 2.7-2.41 3.46l4.12 2.97Z"/><path fill="#FBBC05" d="M5.3 14.27a6.95 6.95 0 0 1 0-4.51L1.27 7.16a11.5 11.5 0 0 0 0 9.65l4.04-2.55Z"/></svg>
            Google
          </button>
        </div>
          </>
        )}

        <div className="mt-4">{legalNotice}</div>

        <p className="mt-5 text-center text-[13px] text-muted-foreground">
          New here?{" "}
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setStep("signup");
            }}
            className="font-semibold text-vermilion hover:underline"
          >
            Create your account
          </button>
        </p>
      </div>
    </div>
  );

  const backButton = (onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F6F6F7] text-ink transition hover:bg-[#EFEFF0]"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2} />
    </button>
  );

  const renderPassword = () => {
    const hasError = !!passwordError;
    return (
      <div className="flex min-h-screen flex-col bg-white px-6 pt-5 pb-6">
        {backButton(() => {
          setPasswordError(null);
          setPassword("");
          setStep("welcome");
        })}

        <h1 className="mt-5 font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          Enter your password
        </h1>

        {/* Email chip */}
        <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-[#F6F6F7] px-3 py-1.5 text-[13px] text-ink">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
          {email}
        </div>

        <form onSubmit={handleEmail} className="mt-4 space-y-2">
          <div className="relative">
            <Lock
              className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 ${hasError ? "text-vermilion" : "text-muted-foreground"}`}
              strokeWidth={1.75}
            />
            <Label htmlFor="password" className="sr-only">Password</Label>
            <Input
              key={showPassword ? "text" : "password"}
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              required
              placeholder="Password"
              className={`h-[52px] rounded-full pl-11 pr-12 text-[15px] focus-visible:ring-0 ${
                hasError
                  ? "border-vermilion/60 bg-[#FBEAE7] text-vermilion placeholder:text-vermilion/60 focus-visible:border-vermilion"
                  : "border-transparent bg-[#F6F6F7] focus-visible:border-ink/20"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
              className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition ${
                hasError ? "text-vermilion" : "text-muted-foreground hover:bg-foreground/5 hover:text-ink"
              }`}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {hasError && (
            <p className="flex items-center gap-1.5 px-1 text-[12px] font-medium text-vermilion">
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
              {passwordError}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setForgotEmail(email);
                setForgotOpen(true);
              }}
              className="text-[13px] font-semibold text-vermilion hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <div className="pt-5">
            <Button
              type="submit"
              disabled={busy || !password}
              className="h-[52px] w-full rounded-full bg-ink text-[15px] font-semibold text-white hover:bg-ink disabled:bg-ink disabled:text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log in"}
            </Button>
          </div>
        </form>
      </div>
    );
  };

  const renderSignup = () => (
    <div className="flex min-h-screen flex-col bg-white px-6 pt-5 pb-6">
      {backButton(() => {
        setStep("welcome");
        setMode("signin");
      })}

      <h1 className="mt-5 font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
        Create your account
      </h1>
      <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">
        Get set up in a minute.
      </p>

      <form onSubmit={handleEmail} className="mt-4 space-y-2.5">
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <Label htmlFor="name" className="sr-only">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Full name"
            className="h-[52px] rounded-full border-transparent bg-[#F6F6F7] pl-11 pr-4 text-[15px] focus-visible:ring-0 focus-visible:border-ink/20"
          />
        </div>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <Label htmlFor="signup-email" className="sr-only">Email</Label>
          <Input
            id="signup-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@email.com"
            className="h-[52px] rounded-full border-transparent bg-[#F6F6F7] pl-11 pr-4 text-[15px] focus-visible:ring-0 focus-visible:border-ink/20"
          />
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <Label htmlFor="signup-password" className="sr-only">Password</Label>
          <Input
            key={showPassword ? "text-s" : "password-s"}
            id="signup-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
            className="h-[52px] rounded-full border-transparent bg-[#F6F6F7] pl-11 pr-12 text-[15px] focus-visible:ring-0 focus-visible:border-ink/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition hover:bg-foreground/5 hover:text-ink"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <ul className="space-y-1 px-1 pt-0.5" aria-live="polite">
          {passwordChecks.map((c) => (
            <li
              key={c.label}
              className={`flex items-center gap-2 text-[11px] transition ${c.ok ? "text-ink" : "text-muted-foreground"}`}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border transition ${
                  c.ok ? "border-emerald-600 bg-emerald-600 text-white" : "border-foreground/20 bg-transparent"
                }`}
              >
                {c.ok && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              {c.label}
            </li>
          ))}
        </ul>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={busy || !passwordValid || !emailValid || !name.trim()}
            className="h-[52px] w-full rounded-full bg-ink text-[15px] font-semibold text-white hover:bg-ink disabled:bg-ink disabled:text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
          </Button>
          <div className="mt-3">{legalNotice}</div>
        </div>
      </form>

      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setStep("welcome");
          }}
          className="font-semibold text-vermilion hover:underline"
        >
          Log in
        </button>
      </p>
    </div>
  );

  const renderCode = () => (
    <div className="flex min-h-screen flex-col bg-white px-6 pt-5 pb-6">
      {backButton(() => {
        setOtpError(null);
        setOtpDigits(Array(OTP_LENGTH).fill(""));
        setStep("signup");
      })}

      <div className="mt-5">
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          Enter the code
        </h1>
        <p className="mt-2 max-w-[22rem] text-[14px] leading-snug text-muted-foreground">
          We sent a code to{" "}
          <button
            type="button"
            onClick={() => {
              setOtpError(null);
              setOtpDigits(Array(OTP_LENGTH).fill(""));
              setStep("signup");
            }}
            className="font-semibold text-ink underline underline-offset-2"
          >
            {email}
          </button>
          .
        </p>
      </div>

      <div className="mt-5 flex justify-between gap-2" role="group" aria-label="Verification code">
        {otpDigits.map((d, i) => {
          const filled = d !== "";
          const errorState = !!otpError;
          const base =
            "h-14 w-full min-w-0 flex-1 rounded-2xl border-2 text-center font-display text-[24px] font-semibold transition focus:outline-none disabled:opacity-60 bg-white";
          const state = errorState
            ? "border-vermilion text-vermilion"
            : filled
              ? "border-ink text-ink"
              : "border-[#E2E2E2] text-ink focus:border-vermilion caret-vermilion";
          return (
            <input
              key={i}
              data-keep-font-size=""
              ref={(el) => (otpRefs.current[i] = el)}
              value={d}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              onFocus={(e) => e.currentTarget.select()}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={OTP_LENGTH}
              aria-label={`Digit ${i + 1}`}
              disabled={otpBusy}
              className={`${base} ${state}`}
            />
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 px-1 text-[13px]">
        <span className="text-muted-foreground">Didn't get it?</span>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendIn > 0 || busy}
          className="font-semibold text-vermilion transition disabled:opacity-70 hover:underline"
        >
          {resendIn > 0
            ? `Resend in 0:${String(resendIn).padStart(2, "0")}`
            : "Resend code"}
        </button>
      </div>

      {otpError && (
        <p className="mt-3 flex items-center gap-1.5 px-1 text-[12px] font-medium text-vermilion">
          <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
          {otpError}
        </p>
      )}

      <div className="mt-6">
        <Button
          type="button"
          onClick={() => {
            const code = otpDigits.join("");
            if (code.length === OTP_LENGTH) verifyOtp(code);
          }}
          disabled={otpBusy || otpDigits.some((d) => d === "")}
          className="h-[52px] w-full rounded-full bg-ink text-[15px] font-semibold text-white hover:bg-ink disabled:bg-ink disabled:text-white disabled:opacity-40"
        >
          {otpBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
        </Button>
      </div>
    </div>
  );

  const renderSent = () => (
    <div className="flex min-h-screen flex-col bg-white px-6 pt-5 pb-6">
      {backButton(() => setStep(mode === "signup" ? "signup" : "welcome"))}

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-7 flex h-24 w-24 items-center justify-center rounded-full bg-[#FCEDDD]">
          <Mail className="h-8 w-8 text-vermilion" strokeWidth={1.75} />
        </div>

        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          Check your email
        </h1>
        <p className="mt-3 max-w-[20rem] text-[15px] leading-snug text-muted-foreground">
          We've sent a {mode === "signup" ? "confirmation" : "password reset"} link to{" "}
          <span className="font-semibold text-ink">{email}</span>.
          {mode !== "signup" && " It expires in 30 minutes."}
        </p>

        <a
          href={mailAppHref(email)}
          className="mt-8 inline-flex h-[52px] w-full max-w-[320px] items-center justify-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-white transition hover:bg-ink/90"
        >
          <Inbox className="h-4 w-4" />
          Open email app
        </a>

        <p className="mt-5 text-[13px] text-muted-foreground">
          Didn't get it?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendIn > 0 || busy || mode !== "signup"}
            className="font-semibold text-vermilion transition disabled:text-muted-foreground hover:underline"
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend"}
          </button>
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-24">
      {step === "welcome" && renderWelcome()}
      {step === "password" && renderPassword()}
      {step === "signup" && renderSignup()}
      {step === "code" && renderCode()}
      {step === "sent" && renderSent()}

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="gap-0 rounded-3xl border border-foreground/10 bg-white p-6 shadow-xl sm:max-w-sm">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="font-display text-[20px] font-bold leading-tight tracking-tight text-ink">
              Reset your password
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-snug text-muted-foreground">
              Enter your email and we'll send you a link to set a new one.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgot} className="mt-5 space-y-3">
            <Label htmlFor="forgot-email" className="sr-only">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="h-12 rounded-2xl border border-foreground/10 bg-white px-4 text-[15px] text-ink placeholder:text-muted-foreground/70 focus-visible:border-vermilion/40 focus-visible:ring-0"
            />
            <Button
              type="submit"
              disabled={forgotBusy}
              className="h-12 w-full rounded-full bg-vermilion text-[15px] font-medium text-cream shadow-soft hover:bg-vermilion-deep"
            >
              {forgotBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <BottomTabBar />
    </div>
  );
};

export default Auth;
