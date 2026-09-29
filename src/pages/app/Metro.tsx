import { AppLayout } from "@/components/AppLayout";
import { Train, CreditCard, QrCode, Clock, Ticket } from "lucide-react";

const LINES = [
  { n: "1", color: "#E4002B", note: "People's Square ↔ Xinzhuang / Fujin Rd" },
  { n: "2", color: "#97D700", note: "Pudong Airport ↔ Hongqiao Airport" },
  { n: "10", color: "#C6A4D6", note: "Xintiandi · Yuyuan · Hongqiao Rd" },
  { n: "14", color: "#7B6BAA", note: "Jing'an Temple · Lujiazui · Yuyuan" },
];

const Metro = () => (
  <AppLayout title="Shanghai Metro" subtitle="How to ride · fares · QR pay" showBack backTo="/">
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <Ticket className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">Fares</h2>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Distance-based: ¥3 for the first 6 km, then +¥1 every 10 km. Most central trips are ¥3–¥6. Pudong Airport from downtown is ¥7–¥8.
        </p>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <QrCode className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">Pay with your phone</h2>
        </div>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] text-muted-foreground">
          <li>Open <b>Alipay</b> → search <i>Metro</i> → choose <i>Shanghai Metro</i>.</li>
          <li>Authorise once. A QR code appears.</li>
          <li>Scan the QR at the gate — entering and exiting. Fare deducts after exit.</li>
        </ol>
        <p className="mt-2 text-[12px] text-muted-foreground/80">
          No Alipay? Buy a single-ride ticket from the machine (English supported). Coins & ¥5/¥10 notes accepted.
        </p>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <CreditCard className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">Transit card</h2>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          <b>Shanghai Public Transportation Card</b> (¥20 deposit, refundable). Works on metro, buses, ferries and most taxis. Top up at any station service desk.
        </p>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <Clock className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">Hours</h2>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Roughly <b>05:30 – 23:00</b> daily. Last train varies by line — check the station signs. Trains every 2–4 min in peak.
        </p>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2 text-ink">
          <Train className="h-4 w-4 text-vermilion" />
          <h2 className="font-display text-base">Lines tourists use most</h2>
        </div>
        <ul className="mt-2 space-y-2">
          {LINES.map((l) => (
            <li key={l.n} className="flex items-center gap-3 text-[13px]">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{ background: l.color }}
              >
                {l.n}
              </span>
              <span className="text-muted-foreground">{l.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="px-1 text-[11px] text-muted-foreground/70">
        Tip: bags are X-rayed at every station. Liquids over 100 ml may be sip-tested.
      </p>
    </div>
  </AppLayout>
);

export default Metro;