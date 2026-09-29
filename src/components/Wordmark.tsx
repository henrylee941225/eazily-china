import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  /** @deprecated Kept for backward compatibility; no longer affects styling. */
  tone?: "light" | "dark" | "muted";
}

export const Wordmark = ({ className }: WordmarkProps) => {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-body font-extrabold tracking-tight leading-none",
        className,
      )}
    >
      <span className="text-[#111111]">eazily</span>
      <span className="text-[#DE2910]">China</span>
    </span>
  );
};