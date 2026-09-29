import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-white hover:bg-ink/90 active:bg-ink/95",
        secondary:
          "bg-surface-2 text-ink hover:bg-surface-3",
        outline:
          "border border-hairline bg-surface text-ink hover:bg-surface-2",
        destructive:
          "border border-brand-red/40 bg-surface text-brand-red hover:bg-error-tint",
        ghost: "text-ink hover:bg-surface-2",
        link: "rounded-none text-brand-red underline-offset-4 hover:underline",
        "on-dark":
          "bg-white text-ink hover:bg-white/90",
      },
      size: {
        default: "h-[52px] px-6 text-[15px]",
        sm: "h-9 px-4 text-sm",
        lg: "h-14 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
