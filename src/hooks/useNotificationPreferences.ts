import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type NotificationPreferences = {
  email_enabled: boolean;
  push_enabled: boolean;
};

// A missing row means "everything on" — the dispatcher defaults the same way.
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_enabled: true,
  push_enabled: true,
};

export const useNotificationPreferences = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setPrefs(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("email_enabled, push_enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) console.error("notification preferences: load failed", error);
    setPrefs((data as NotificationPreferences) ?? DEFAULT_PREFERENCES);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      if (!user) return;
      setSaving(true);
      setPrefs((prev) => ({ ...(prev ?? DEFAULT_PREFERENCES), ...patch }));
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
      if (error) {
        console.error("notification preferences: save failed", error);
        await load();
      }
      setSaving(false);
    },
    [user, load],
  );

  return { prefs, loading, saving, update, reload: load };
};
