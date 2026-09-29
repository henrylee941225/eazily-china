import { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Wordmark } from "@/components/Wordmark";

type Props = { children: ReactNode; assistantName?: string | null };

/**
 * Standalone shell for the ops portal. Deliberately isolated from the
 * customer app — no bottom nav, no concierge sparkle, no cross-links.
 */
export const OpsLayout = ({ children, assistantName }: Props) => {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-surface-2 text-ink">
      <header className="sticky top-0 z-40 border-b border-border bg-white pt-safe">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <Wordmark className="text-[18px]" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">
                Dispatch
              </span>
            </div>
            {assistantName && (
              <p className="mt-0.5 truncate text-[12px] text-ink-secondary">
                Signed in as {assistantName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[12px] font-semibold text-ink transition hover:bg-surface-3"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-3 pb-16 pt-3 sm:px-4">
        {children}
      </main>
    </div>
  );
};