import { AppLayout } from "@/components/AppLayout";
import { PaymentGuide, type GuideStep } from "@/components/PaymentGuide";
import { GotchasCallout } from "@/components/GotchasCallout";

const ACCENT = "#1677FF";

const STEPS: GuideStep[] = [
  {
    title: "Download Alipay",
    body: "Search 'Alipay' on the App Store or Google Play. Look for the blue square logo. It's free.",
    image: "/images/alipay/step-1.png",
  },
  {
    title: "Create an account with your phone number",
    body: "Use your home number (e.g. +44, +1, +33). You'll get an SMS verification code.",
    image: "/images/alipay/step-2.png",
  },
  {
    title: "Enable Tour Pass",
    body: "On the home screen, search 'Tour Pass'. This is Alipay's tourist mode for visitors staying under 90 days.",
    image: "/images/alipay/step-3.png",
  },
  {
    title: "Link a foreign credit or debit card",
    body: "Tap 'Add Card' inside Tour Pass. Enter your Visa, Mastercard or Amex details. No Chinese bank account needed.",
    image: "/images/alipay/step-4.png",
  },
  {
    title: "Verify with your passport",
    body: "Upload a clear photo of your passport and complete a quick face scan. Approval is usually under a minute.",
    image: "/images/alipay/step-5.png",
  },
  {
    title: "Pay in a shop",
    body: "Two flows: tap 'Scan' to scan the merchant's QR, or tap 'Pay' to show your QR for them to scan. Same result.",
    image: "/images/alipay/step-6.png",
  },
  {
    title: "Top up, check balance & refunds",
    body: "Inside Tour Pass you can top up, see every transaction, and request refunds — receipts are all digital.",
    image: "/images/alipay/step-7.png",
  },
];

const PayAlipay = () => {
  return (
    <AppLayout title="Alipay setup" subtitle="Step by step" backTo="/pay">
      <div className="space-y-8">
        <section className="rounded-2xl border border-foreground/10 p-5 shadow-soft" style={{ background: "linear-gradient(135deg, #1677FF10, #1677FF05)" }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>Alipay · Tour Pass</div>
          <h2 className="font-display mt-1 text-2xl font-light text-ink">The fastest way to pay anywhere in China.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Follow the seven steps below. Most travellers finish in 10 minutes.</p>
        </section>

        <PaymentGuide steps={STEPS} accentColor={ACCENT} />

        <GotchasCallout
          items={[
            "Facial verification can fail in low light — try near a window.",
            "Your passport must have at least 6 months' validity remaining.",
            "Some small merchants only accept WeChat Pay — keep both apps installed.",
            "Transactions over ¥200 carry a small foreign-card fee (around 3%).",
          ]}
        />
      </div>
    </AppLayout>
  );
};

export default PayAlipay;