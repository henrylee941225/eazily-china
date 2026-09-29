import { AppLayout } from "@/components/AppLayout";
import { Check, X, Utensils, HandCoins } from "lucide-react";

const DOS = [
  "Let elders sit / eat first.",
  "Receive business cards & gifts with both hands.",
  "Tap two fingers on the table to thank someone pouring your tea.",
  "Slurping noodles is fine — even appreciated.",
  "Carry tissues — many public toilets don't supply paper.",
];

const DONTS = [
  "Don't stick chopsticks upright in rice — it mirrors funeral incense.",
  "Don't tip in restaurants, taxis or hotels. It's not expected and can confuse staff.",
  "Don't discuss politics, Taiwan or Tibet with strangers.",
  "Don't blow your nose loudly at the table — step away.",
  "Don't expect personal space in queues or on the metro.",
];

const Etiquette = () => (
  <AppLayout title="Tipping & etiquette" subtitle="The unwritten rules" showBack backTo="/">
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="rounded-2xl border border-vermilion/20 bg-vermilion/[0.04] p-4">
        <div className="flex items-center gap-2 text-ink">
          <HandCoins className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">Tipping</h2>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          <b>Generally, no.</b> Restaurants, taxis, Didi and hotel staff do not expect tips — many will chase you down to return the money. Exceptions: high-end Western hotels (¥10–¥20 for porters is fine) and licensed tour guides (¥50–¥100/day if they were great).
        </p>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <Utensils className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">At the table</h2>
        </div>
        <ul className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
          <li>Dishes are shared in the middle — use the serving spoon, not your chopsticks.</li>
          <li>The host orders and pays. Offering to split is polite, but expect them to insist.</li>
          <li>"Cheers" = <i>gānbēi</i> (干杯). It literally means "dry the cup" — sip if you can't keep up.</li>
          <li>Leaving a little food on the plate signals you're full and well-fed.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <Check className="h-4 w-4 text-emerald-600" />
          <h2 className="font-display text-base">Do</h2>
        </div>
        <ul className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
          {DOS.map((d) => (
            <li key={d} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{d}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <X className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">Don't</h2>
        </div>
        <ul className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
          {DONTS.map((d) => (
            <li key={d} className="flex gap-2"><X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-vermilion" />{d}</li>
          ))}
        </ul>
      </section>
    </div>
  </AppLayout>
);

export default Etiquette;