import { Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ConciergeChat } from "@/components/ConciergeChat";
import { useEntitlement } from "@/hooks/useEntitlement";

const ConciergeChatPage = () => {
  const { hasAiAccess } = useEntitlement();
  return (
  <AppLayout
    title="Concierge"
    hideTabBar
    fillViewport
    subtitle={
      <span className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
          <span className="h-2 w-2 rounded-full bg-online" aria-hidden />
          Online · replies in seconds
        </span>
        {hasAiAccess && (
          <span className="text-[12px] font-medium text-ink-secondary">Pass active</span>
        )}
      </span>
    }
    showBack
    headerRight={
      <div
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white shadow-soft"
      >
        <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
      </div>
    }
  >
    <ConciergeChat />
  </AppLayout>
  );
};

export default ConciergeChatPage;
