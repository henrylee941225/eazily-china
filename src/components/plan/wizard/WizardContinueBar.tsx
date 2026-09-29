import type { ReactNode } from "react";

type Props = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  leadingIcon?: ReactNode;
};

/** Sticky bottom Continue button used across every wizard step. Wizard routes
 *  hide the floating tab bar, so this sits directly on the safe-area inset. */
export const WizardContinueBar = ({ onClick, disabled, label = "Continue", leadingIcon }: Props) => (
  <div
    className="fixed inset-x-0 z-40 border-t border-foreground/10 bg-[#F7F7F5]/90 px-5 py-4 backdrop-blur-xl"
    style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))", bottom: 0 }}
  >
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink text-base font-medium text-cream transition disabled:opacity-40"
    >
      {leadingIcon}
      {label}
    </button>
  </div>
);