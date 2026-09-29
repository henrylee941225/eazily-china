import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  showBack?: boolean;
  /** Where the back button navigates. Defaults to history(-1). */
  backTo?: string;
  /** Optional trailing slot — action button or status chip. */
  trailing?: ReactNode;
  className?: string;
};

export const ScreenHeader = ({
  title,
  subtitle,
  showBack = true,
  backTo,
  trailing,
  className,
}: Props) => {
  const navigate = useNavigate();

  return (
    <header
      className={`sticky top-0 z-40 bg-white pt-safe ${className ?? ""}`}
    >
      <div className="mx-auto flex w-full max-w-[440px] items-center gap-3 px-4 py-3">
        {showBack ? (
          <button
            type="button"
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-surface-3 active:bg-surface-3"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : (
          <span className="h-11 w-11 shrink-0" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-bold leading-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-0.5 truncate text-[13px] leading-snug text-ink-secondary">
              {subtitle}
            </div>
          )}
        </div>

        {trailing && <div className="ml-1 shrink-0">{trailing}</div>}
      </div>
    </header>
  );
};