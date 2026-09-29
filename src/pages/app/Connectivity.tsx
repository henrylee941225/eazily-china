import { AppLayout } from "@/components/AppLayout";
import { Wifi, Shield, Smartphone, CheckCircle2 } from "lucide-react";

const ESIMS = [
  { name: "Airalo (China)", note: "Easy install. Routes via China — Google/Insta blocked. Pair with a VPN." },
  { name: "Holafly China + HK", note: "Routes through Hong Kong — Google, Instagram, WhatsApp work without VPN." },
  { name: "Nomad Asia", note: "Multi-country plan, good if you also visit HK / Japan / SK." },
];

const VPNS = [
  { name: "Astrill", note: "Most reliable in China. ~US$30/mo. Install BEFORE you arrive." },
  { name: "LetsVPN", note: "Cheaper, popular with expats. Install before arrival." },
  { name: "ExpressVPN", note: "Works in patches — check status before relying on it." },
];

const Connectivity = () => (
  <AppLayout title="VPN & eSIM" subtitle="Stay connected from day one" showBack backTo="/">
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="rounded-2xl border border-vermilion/20 bg-vermilion/[0.04] p-4">
        <div className="flex items-center gap-2 text-ink">
          <CheckCircle2 className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">Set up BEFORE you land</h2>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          You can't download a VPN once you're in China — the App Store / Play Store hide them. Install everything while you're still home, sign in, and run it once to confirm it works.
        </p>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <Smartphone className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">Recommended eSIMs</h2>
        </div>
        <ul className="mt-2 space-y-2.5">
          {ESIMS.map((s) => (
            <li key={s.name} className="text-[13px]">
              <div className="font-medium text-ink">{s.name}</div>
              <div className="text-muted-foreground">{s.note}</div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground/80">
          Pro tip: a Hong Kong-routed eSIM is the simplest way to keep using Google / Instagram / WhatsApp without a VPN.
        </p>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <Shield className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">VPNs that still work</h2>
        </div>
        <ul className="mt-2 space-y-2.5">
          {VPNS.map((v) => (
            <li key={v.name} className="text-[13px]">
              <div className="font-medium text-ink">{v.name}</div>
              <div className="text-muted-foreground">{v.note}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <Wifi className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">What works without a VPN</h2>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          WeChat, Alipay, Didi, Apple Maps, Bing, Outlook, Apple iCloud, Booking.com, Trip.com.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          <b>Blocked:</b> Google (Search, Gmail, Maps, Drive), YouTube, Instagram, Facebook, WhatsApp, X/Twitter, most Western news.
        </p>
      </section>
    </div>
  </AppLayout>
);

export default Connectivity;