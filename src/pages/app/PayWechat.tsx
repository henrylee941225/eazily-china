import { AppLayout } from "@/components/AppLayout";
import { PaymentGuide, type GuideStep } from "@/components/PaymentGuide";
import { GotchasCallout } from "@/components/GotchasCallout";

const ACCENT = "#07C160";

const STEPS: GuideStep[] = [
  {
    title: "Download WeChat",
    body: "Search 'WeChat' on the App Store or Google Play. Green speech-bubble logo.",
    image: "/images/wechat/step-1.png",
  },
  {
    title: "Create an account with your phone number",
    body: "Sign up with your home phone. A friend already on WeChat may need to 'verify' your new account.",
    image: "/images/wechat/step-2.png",
  },
  {
    title: "Enable Weixin Pay for Tourists",
    body: "Tap Me → Services → Wallet. Open 'Weixin Pay for Tourists' — that's WeChat's foreign-card mode.",
    image: "/images/wechat/step-3.png",
  },
  {
    title: "Link a foreign credit or debit card",
    body: "Inside the wallet, tap 'Cards' → 'Add card'. Enter your Visa or Mastercard. WeChat will ask for your passport for KYC.",
    image: "/images/wechat/step-4.png",
  },
  {
    title: "Verify with your passport",
    body: "Photo of your passport plus a 5-second face scan. Usually approved within a minute.",
    image: "/images/wechat/step-5.png",
  },
  {
    title: "Pay in a shop",
    body: "Tap the + icon → 'Money' to show your QR for the cashier to scan, or tap 'Scan' to scan theirs.",
    image: "/images/wechat/step-6.png",
  },
  {
    title: "Top up, check balance & refunds",
    body: "Open the wallet for balance and history. Refunds appear back on your card automatically.",
    image: "/images/wechat/step-7.png",
  },
];

const PayWechat = () => {
  return (
    <AppLayout title="WeChat Pay setup" subtitle="Step by step" backTo="/pay">
      <div className="space-y-8">
        <section className="rounded-2xl border border-foreground/10 p-5 shadow-soft" style={{ background: "linear-gradient(135deg, #07C16010, #07C16005)" }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>WeChat · Weixin Pay for Tourists</div>
          <h2 className="font-display mt-1 text-2xl font-light text-ink">Pay friends, markets and stalls — the local way.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Seven steps. About 10 minutes from download to first payment.</p>
        </section>

        <PaymentGuide steps={STEPS} accentColor={ACCENT} />

        <GotchasCallout
          items={[
            "New accounts often need a friend already on WeChat to confirm you're real.",
            "Facial verification can fail in low light — try near a window.",
            "Passport must have at least 6 months' validity remaining.",
            "Some merchants only accept Alipay — keep both apps installed.",
          ]}
        />
      </div>
    </AppLayout>
  );
};

export default PayWechat;