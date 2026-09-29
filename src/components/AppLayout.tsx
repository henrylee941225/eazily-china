import { ReactNode } from "react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { AILiveActivity } from "@/components/AILiveActivity";
import { ScreenHeader } from "@/components/ScreenHeader";

type Props = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  showBack?: boolean;
  /** Where the back button navigates. Defaults to history(-1). */
  backTo?: string;
  showLiveActivity?: boolean;
  /** Optional element rendered on the right side of the header (e.g. menu). */
  headerRight?: ReactNode;
  /** Extra classes for the outer wrapper (e.g. additional bottom padding). */
  className?: string;
  /** Hide the floating bottom tab bar (used by wizard-style flows). */
  hideTabBar?: boolean;
  /** Set when the page renders its own sticky CTA bar via `.bottom-above-nav`
   *  — reserves extra scroll padding so the last content clears both the CTA
   *  and the floating nav. Ignored when `hideTabBar` is true. */
  hasBottomBar?: boolean;
};

export const AppLayout = ({
  title,
  subtitle,
  children,
  showBack = true,
  backTo,
  showLiveActivity = false,
  headerRight,
  className,
  hideTabBar = false,
  hasBottomBar = false,
}: Props) => {
  const bottomPad = hideTabBar
    ? ""
    : hasBottomBar
      ? "pb-with-nav-cta"
      : "pb-with-nav";
  return (
    <div className={`min-h-screen bg-white ${bottomPad} ${className ?? ""}`}>
      {showLiveActivity && <AILiveActivity />}
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        backTo={backTo}
        trailing={headerRight}
      />

      <main className="container mx-auto px-3 py-4 sm:px-4 sm:py-6">{children}</main>

      {!hideTabBar && <BottomTabBar />}
    </div>
  );
};