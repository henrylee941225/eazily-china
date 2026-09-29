import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash on load.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Could not update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-cream">
      <div className="container mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 self-start text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to home
        </Link>
        <Link to="/" className="mb-8 flex justify-center">
          <Wordmark tone="dark" className="text-3xl" />
        </Link>

        <div className="rounded-3xl border border-foreground/10 bg-card p-7 shadow-soft">
          <div className="mb-6 text-center">
            <h1 className="font-display text-3xl font-light text-ink">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ready ? "Choose a strong password to continue." : "Verifying your reset link…"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="password" className="text-xs">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:text-ink"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm" className="text-xs">Confirm password</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={busy || !ready}
              className="w-full gap-2 bg-vermilion text-cream hover:bg-vermilion-deep"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Update password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;