import { Wallet, Signal, ShieldCheck, FileCheck, Smartphone, PlaneTakeoff, type LucideIcon } from "lucide-react";
import { TRANSFERS_ENABLED } from "@/lib/featureFlags";

// Single source of truth for pre-trip checklist slugs.
// The database CHECK constraint `profiles_pretrip_tasks_done_valid`
// must be kept in sync with this list — see the constraint comment.
export type PretripTaskSlug =
  | "payments"
  | "transfer"
  | "esim"
  | "vpn"
  | "visa"
  | "apps";

export type PretripStep = { n: number; text: string };

export type PretripTask = {
  slug: PretripTaskSlug;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: "orange" | "red";
  body: string;
  steps: PretripStep[];
  callout?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

const ALL_PRETRIP_TASKS: PretripTask[] = [
  {
    slug: "visa",
    title: "Check visa & entry rules",
    subtitle: "Know before you go",
    icon: FileCheck,
    tint: "red",
    body:
      "Many nationalities now qualify for visa-free entry of up to 30 days, but the rules change often. Confirm what applies to your passport and the length of your stay.",
    steps: [
      { n: 1, text: "Check your passport is valid for at least six months." },
      { n: 2, text: "Confirm current visa-free or visa requirements for your nationality." },
      { n: 3, text: "Have proof of onward travel and accommodation ready." },
    ],
  },
  {
    slug: "payments",
    title: "Set up mobile payments",
    subtitle: "Alipay / WeChat Pay ready",
    icon: Wallet,
    tint: "red",
    body:
      "Cash is rare in mainland China and most places expect Alipay or WeChat Pay. Both apps now let foreign cards top up directly, so you can pay by QR code from day one.",
    steps: [
      { n: 1, text: "Install Alipay or WeChat, sign in with your phone number." },
      { n: 2, text: "Verify your passport inside the app to raise transaction limits." },
      { n: 3, text: "Link a Visa or Mastercard so QR payments work on arrival." },
    ],
    callout: "Verification can take a few minutes — do it on home Wi-Fi before you fly.",
  },
  {
    slug: "transfer",
    title: "Book your airport transfer",
    subtitle: "Skip the taxi queue",
    icon: PlaneTakeoff,
    tint: "red",
    body:
      "Landing after a long flight is the worst moment to figure out transport. Book your pickup now — a driver will be waiting with a fixed price, no haggling, no taxi queue.",
    steps: [
      { n: 1, text: "Tell us your flight and pickup time — takes two minutes." },
      { n: 2, text: "A person confirms your driver and a fixed all-in quote." },
      { n: 3, text: "Pay to lock it in. Your driver's details arrive before you land." },
    ],
    ctaHref: "/transfers/airport",
    ctaLabel: "Book airport transfer",
  },
  {
    slug: "esim",
    title: "Get an eSIM or data plan",
    subtitle: "Stay connected on arrival",
    icon: Signal,
    tint: "red",
    body:
      "Local SIMs require a passport in person and often route through the Chinese firewall. A travel eSIM from a provider like HelloGlobe gives you an unfiltered connection the moment you land.",
    steps: [
      { n: 1, text: "Check your phone supports eSIM and is carrier-unlocked." },
      { n: 2, text: "Buy a China or Asia regional eSIM and install it before flying." },
      { n: 3, text: "Switch it on after landing — leave your home SIM for calls." },
    ],
  },
  {
    slug: "vpn",
    title: "Set up a VPN",
    subtitle: "Access your usual apps",
    icon: ShieldCheck,
    tint: "red",
    body:
      "Google, WhatsApp, Instagram and many Western apps are blocked in China. Install a VPN before you arrive — they're hard to download once you're there.",
    steps: [
      { n: 1, text: "Choose a reputable paid VPN with China servers." },
      { n: 2, text: "Install and sign in while still on home Wi-Fi." },
      { n: 3, text: "Test the connection before you fly." },
    ],
    callout: "App stores restrict VPN downloads inside China — set it up in advance.",
  },
  {
    slug: "apps",
    title: "Download key apps",
    subtitle: "The essentials for daily life",
    icon: Smartphone,
    tint: "red",
    body:
      "China's app ecosystem is very different from the West. A couple of local apps make daily life far easier — DiDi for taxis and Meituan for food delivery.",
    steps: [
      { n: 1, text: "Install DiDi to book taxis and private cars in English." },
      { n: 2, text: "Install Meituan for food delivery from local restaurants." },
      { n: 3, text: "Sign in and link a payment method before you fly." },
    ],
  },
];

// Flag-gated: when transfers are off, the task disappears from the list and
// PRETRIP_TOTAL / progress denominators shrink automatically.
export const PRETRIP_TASKS: PretripTask[] = ALL_PRETRIP_TASKS.filter(
  (t) => t.slug !== "transfer" || TRANSFERS_ENABLED,
);

export const PRETRIP_TOTAL = PRETRIP_TASKS.length;

export const isPretripComplete = (done: string[] | null | undefined) =>
  (done ?? []).length >= PRETRIP_TOTAL;

export const pretripDoneCount = (done: string[] | null | undefined) =>
  (done ?? []).filter((s) => PRETRIP_TASKS.some((t) => t.slug === s)).length;