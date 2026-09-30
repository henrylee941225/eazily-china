import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import type { PluginListenerHandle } from "@capacitor/core";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isCapacitorApp, openExternalUrl } from "@/integrations/capacitor";
import { parseNativeDeepLink } from "@/integrations/capacitor/deepLinks";

export const NativeAppLifecycle = () => {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (!isCapacitorApp()) return;
    let disposed = false;
    let lastUrl: string | undefined;
    const listeners: PluginListenerHandle[] = [];
    const listen = async (listener: Promise<PluginListenerHandle>) => {
      const handle = await listener;
      if (disposed) await handle.remove();
      else listeners.push(handle);
    };

    const handleUrl = async (rawUrl: string) => {
      const link = parseNativeDeepLink(rawUrl);
      if (!link || disposed || lastUrl === rawUrl) return;
      lastUrl = rawUrl;
      try {
        if (link.error) throw new Error(link.error);
        if (link.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(link.code);
          if (error) throw error;
        } else if (link.session) {
          const { error } = await supabase.auth.setSession(link.session);
          if (error) throw error;
        }
        await Browser.close().catch(() => {});
        if (!disposed) navigateRef.current(link.path, { replace: true });
      } catch (error) {
        lastUrl = undefined;
        if (!disposed) toast.error(error instanceof Error ? error.message : "Could not open sign-in link");
      }
    };

    const onExternalLink = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.download || !/^https?:/.test(anchor.href)) return;
      if (new URL(anchor.href).origin === window.location.origin) return;
      event.preventDefault();
      void openExternalUrl(anchor.href).catch(() => toast.error("Could not open link"));
    };
    document.addEventListener("click", onExternalLink);

    const initialize = async () => {
      await listen(App.addListener("appUrlOpen", ({ url }) => { void handleUrl(url); }));
      await listen(App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack && window.history.state?.idx > 0) navigateRef.current(-1);
        else if (window.location.pathname !== "/") navigateRef.current("/", { replace: true });
        else void App.minimizeApp();
      }));
      await listen(App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      }));
      const launch = await App.getLaunchUrl();
      if (launch?.url) await handleUrl(launch.url);
    };
    void initialize().catch((error) => console.warn("Native lifecycle initialization failed", error));

    return () => {
      disposed = true;
      document.removeEventListener("click", onExternalLink);
      listeners.forEach((handle) => { void handle.remove(); });
    };
  }, []);

  return null;
};
