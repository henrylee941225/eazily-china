import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[14px] border border-transparent bg-surface-2 px-4 py-2 text-[15px] text-ink ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-ink-secondary focus-visible:outline-none focus-visible:border-ink/20 focus-visible:bg-surface focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-brand-red aria-[invalid=true]:bg-error-tint",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
