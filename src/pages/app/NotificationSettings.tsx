import { Bell, Mail } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Switch } from "@/components/ui/switch";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { PUSH_ENABLED } from "@/lib/featureFlags";

const NotificationSettings = () => {
  const { prefs, loading, saving, update } = useNotificationPreferences();

  return (
    <AppLayout title="Notifications" backTo="/account" showLiveActivity={false}>
      <div className="mx-auto max-w-[440px] space-y-6 pb-8">
        <p className="text-[15px] leading-[1.45] text-ink-secondary">
          We only message you about your bookings — driver confirmations, payment updates and pickup
          reminders.
        </p>

        <div className="divide-y divide-border rounded-2xl border border-border bg-white">
          {/* Push stays parked behind the flag: the preference is preserved,
              it just isn't shown or sent while we're email-only. */}
          {PUSH_ENABLED && (
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink">
                <Bell className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold text-ink">Push notifications</span>
                <span className="block text-[13px] text-ink-secondary">
                  Instant updates on this device
                </span>
              </span>
              <Switch
                checked={!!prefs?.push_enabled}
                disabled={loading || saving}
                onCheckedChange={(next) => void update({ push_enabled: next })}
                aria-label="Push notifications"
              />
            </div>
          )}

          <div className="flex items-center gap-3 px-4 py-4">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink">
              <Mail className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-ink">Email updates</span>
              <span className="block text-[13px] text-ink-secondary">Booking confirmations by email</span>
            </span>
            <Switch
              checked={!!prefs?.email_enabled}
              disabled={loading || saving}
              onCheckedChange={(next) => void update({ email_enabled: next })}
              aria-label="Email updates"
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotificationSettings;
