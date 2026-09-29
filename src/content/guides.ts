// Static guide content library.
// No database — presentation-only migration of the existing pay / metro /
// etiquette / connectivity content into a shared guides structure.

export type GuideStep = { title: string; body: string };
export type GuideSection = { heading: string; body: string };

export type GuideTopic = {
  slug: string;
  title: string;
  icon: string; // lucide icon name
  intro: string;
};

export type Guide = {
  slug: string;
  topicSlug: string;
  order: number;
  title: string;
  readMinutes: number;
  subtitle?: string;
  lede: string;
  callout?: { text: string };
  steps?: GuideStep[];
  sections?: GuideSection[];
  /** When true, the guide is surfaced via the hero and search only,
   * and does not appear in any topic list. Its topicSlug may reference
   * a hidden pseudo-topic that is not shown in the topic grid. */
  featured?: boolean;
};

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    slug: "pay-and-money",
    title: "Pay & money",
    icon: "Wallet",
    intro:
      "Everything about paying in China — set up before you go, then pay like a local.",
  },
  {
    slug: "getting-around",
    title: "Getting around",
    icon: "Train",
    intro: "Metro, taxis and the fastest ways to move between neighbourhoods.",
  },
  {
    slug: "eat-and-drink",
    title: "Eat & drink",
    icon: "Utensils",
    intro: "How to order, share and pay when you sit down to eat.",
  },
  {
    slug: "culture-and-etiquette",
    title: "Culture & etiquette",
    icon: "HandCoins",
    intro: "The small unwritten rules that make you a welcome guest.",
  },
  {
    slug: "sights-and-museums",
    title: "Sights & museums",
    icon: "Landmark",
    intro: "Booking, timed entry and how to skip the queues.",
  },
  {
    slug: "staying-connected",
    title: "Staying connected",
    icon: "Wifi",
    intro: "eSIMs, VPNs and what actually works once you land.",
  },
];

/** Hidden pseudo-topics — used to give featured, cross-topic guides a
 * valid route (e.g. /guides/pre-arrival/pre-arrival-checklist) without
 * surfacing an extra card in the topic grid. */
const HIDDEN_TOPICS: GuideTopic[] = [
  {
    slug: "pre-arrival",
    title: "Before you fly",
    icon: "Plane",
    intro: "Set up before you land — it's much harder after.",
  },
];

export const GUIDES: Guide[] = [
  // ── Featured, cross-topic ────────────────────────────────────────────
  {
    slug: "pre-arrival-checklist",
    topicSlug: "pre-arrival",
    order: 0,
    title: "Pre-arrival checklist",
    readMinutes: 6,
    subtitle: "Before you fly",
    featured: true,
    lede:
      "The single biggest favour you can do yourself is to set up the essentials before you board. Several of these steps are harder — or impossible — once you're behind the Great Firewall.",
    callout: {
      text:
        "Do all of this on home Wi-Fi. App downloads, card verification and account sign-ups are far more reliable before you land.",
    },
    steps: [
      {
        title: "Check your visa or visa-free status",
        body:
          "Confirm whether your nationality qualifies for China's visa-free transit or visa-free entry schemes, and check the permitted length of stay. Rules change — verify on your government's official travel advice site close to departure.",
      },
      {
        title: "Set up Alipay with your foreign card",
        body:
          "Download Alipay, register with your home mobile number, add a Visa or Mastercard and complete identity verification with your passport. This is how you'll pay for almost everything. Full walkthrough in our Set up Alipay guide.",
      },
      {
        title: "Set up WeChat Pay as a backup",
        body:
          "Some smaller merchants only take WeChat. Registration needs an existing WeChat user to verify you in some cases, so start early. See our WeChat Pay guide.",
      },
      {
        title: "Sort your connectivity",
        body:
          "Buy an eSIM or roaming plan from your home provider before departure. Many Western apps and sites are blocked on Chinese networks; international roaming data routes around this, while local SIMs do not.",
      },
      {
        title: "Download offline essentials",
        body:
          "Save offline maps of your destination cities, download a translation app's offline Mandarin pack, and keep digital and printed copies of your hotel addresses in Chinese characters.",
      },
      {
        title: "Carry some cash",
        body:
          "Mobile payment dominates, but a small amount of yuan (a few hundred RMB) covers taxis, small vendors and any moment your phone or card lets you down. Order it from your bank before you travel.",
      },
      {
        title: "Save your key documents",
        body:
          "Screenshot your passport photo page, visa or entry confirmation, hotel bookings and flight details. Keep them available offline — you'll be asked for hotel addresses on your arrival card.",
      },
      {
        title: "Tell your bank you're travelling",
        body:
          "Flag China on your account so card verification requests and Alipay top-ups aren't blocked as suspicious activity mid-trip.",
      },
    ],
  },
  // ── Pay & money ───────────────────────────────────────────────────────
  {
    slug: "how-paying-in-china-works",
    topicSlug: "pay-and-money",
    order: 1,
    title: "How paying in China works",
    readMinutes: 3,
    subtitle: "Read this first",
    lede:
      "Four things to know before you land, so nothing about paying in China feels foreign.",
    steps: [
      {
        title: "Cash is rare",
        body:
          "Almost every shop, taxi, market and street vendor expects mobile payment. Many places no longer accept cash at all.",
      },
      {
        title: "Two apps run everything",
        body:
          "Alipay and WeChat Pay. Locals use one or the other — sometimes both. The same QR code is shown to either.",
      },
      {
        title: "You scan, or get scanned",
        body:
          "At small shops, look for a printed QR code on the counter — open the app, tap Scan, point your camera, enter the amount, then confirm with your face or fingerprint. At bigger stores the cashier scans your personal QR instead. Either way, payment lands in seconds.",
      },
      {
        title: "Your foreign card works",
        body:
          "Since 2024, Visa, Mastercard, Amex and JCB link directly to both apps. No Chinese bank account needed.",
      },
    ],
  },
  {
    slug: "set-up-alipay",
    topicSlug: "pay-and-money",
    order: 2,
    title: "How to set up Alipay",
    readMinutes: 5,
    subtitle: "with a foreign card",
    lede:
      "Alipay is how you'll pay for almost everything — taxis, restaurants, the metro. Set it up before you fly.",
    callout: {
      text:
        "Do this on home Wi-Fi — some steps are harder once you've landed.",
    },
    steps: [
      {
        title: "Download Alipay",
        body:
          "Search Alipay in the App Store or Google Play. Look for the blue square logo. It's free.",
      },
      {
        title: "Sign up with your phone",
        body:
          "Use your home number — for example +44 if you're from the UK. Alipay will text you a code. Make sure your number can receive SMS while you're abroad.",
      },
      {
        title: "Verify your passport",
        body:
          "In Alipay, go to Me → Settings → Identity verification. Take a photo of your passport and a quick selfie. Takes about a minute.",
      },
      {
        title: "Add your card",
        body:
          "Go to Me → Bank Cards → Add card. Enter your Visa, Mastercard, Amex or JCB. Your bank may text you a confirmation code. If it's declined, tell your bank you're travelling to China — many block China transactions by default.",
      },
      {
        title: "Try a small payment",
        body:
          "Once your card is linked, tap Pay on Alipay's home screen and scan any merchant QR. If it confirms in seconds, you're ready.",
      },
    ],
  },
  {
    slug: "set-up-wechat-pay",
    topicSlug: "pay-and-money",
    order: 3,
    title: "How to set up WeChat Pay",
    readMinutes: 5,
    subtitle: "after Alipay",
    lede:
      "Some markets and small shops prefer WeChat. Set it up as a backup once Alipay is working.",
    callout: {
      text:
        "Turn off your VPN before you open WeChat — it's the number one cause of setup failing.",
    },
    steps: [
      {
        title: "Download WeChat",
        body:
          "Install WeChat from the App Store or Google Play. Green speech-bubble logo.",
      },
      {
        title: "Sign up with your phone",
        body:
          "Use your home number — the same one you used for Alipay is fine. WeChat sends an SMS code to verify it.",
      },
      {
        title: "Ask someone to verify you",
        body:
          "WeChat may show a QR code and ask another WeChat user to scan it, to confirm you're a real person. A friend, colleague or hotel receptionist can do this in five seconds.",
      },
      {
        title: "Verify your passport",
        body:
          "Go to Me → Services → Wallet. Upload your passport and complete a face scan. If you can't see Services, ask a WeChat friend to send you one yuan in a chat first — tapping the money unlocks the wallet menu.",
      },
      {
        title: "Add your card",
        body:
          "Inside Wallet, tap Cards → Add a card. Visa, Mastercard, Amex and JCB all work. Confirm with your bank's one-time code.",
      },
    ],
  },

  // ── Getting around ────────────────────────────────────────────────────
  {
    slug: "shanghai-metro",
    topicSlug: "getting-around",
    order: 1,
    title: "Riding the Shanghai Metro",
    readMinutes: 4,
    subtitle: "fares, QR pay and hours",
    lede:
      "The metro is the fastest way across Shanghai. Trains run every 2–4 minutes in peak hours and stations are signed in English.",
    sections: [
      {
        heading: "Fares",
        body:
          "Distance-based: ¥3 for the first 6 km, then +¥1 every 10 km. Most central trips are ¥3–¥6. Pudong Airport from downtown is ¥7–¥8.",
      },
      {
        heading: "Pay with your phone",
        body:
          "Open Alipay, search Metro and choose Shanghai Metro. Authorise once — a QR code appears. Scan it at the gate on the way in and on the way out; the fare deducts when you exit.",
      },
      {
        heading: "No Alipay?",
        body:
          "Buy a single-ride ticket from the machine (English supported). Coins and ¥5 or ¥10 notes accepted.",
      },
      {
        heading: "Transit card",
        body:
          "The Shanghai Public Transportation Card (¥20 refundable deposit) works on metro, buses, ferries and most taxis. Top up at any station service desk.",
      },
      {
        heading: "Hours",
        body:
          "Roughly 05:30–23:00 daily. Last train varies by line — check the station signs.",
      },
      {
        heading: "Lines tourists use most",
        body:
          "Line 1: People's Square ↔ Xinzhuang / Fujin Rd. Line 2: Pudong Airport ↔ Hongqiao Airport. Line 10: Xintiandi · Yuyuan · Hongqiao Rd. Line 14: Jing'an Temple · Lujiazui · Yuyuan.",
      },
      {
        heading: "One thing to expect",
        body:
          "Bags are X-rayed at every station. Liquids over 100 ml may be sip-tested.",
      },
    ],
  },

  // ── Culture & etiquette ───────────────────────────────────────────────
  {
    slug: "tipping-and-etiquette",
    topicSlug: "culture-and-etiquette",
    order: 1,
    title: "Tipping and etiquette",
    readMinutes: 3,
    subtitle: "the unwritten rules",
    lede:
      "China does hospitality differently. A few small habits will save you a lot of confused looks.",
    sections: [
      {
        heading: "Tipping",
        body:
          "Generally, no. Restaurants, taxis, Didi and hotel staff do not expect tips — many will chase you down to return the money. Exceptions: high-end Western hotels (¥10–¥20 for porters is fine) and licensed tour guides (¥50–¥100 a day if they were great).",
      },
      {
        heading: "At the table",
        body:
          "Dishes are shared in the middle — use the serving spoon, not your chopsticks. The host orders and pays; offering to split is polite, but expect them to insist. Cheers is gānbēi (干杯) — literally dry the cup. Sip if you can't keep up. Leaving a little food on the plate signals you're full and well-fed.",
      },
      {
        heading: "Do",
        body:
          "Let elders sit and eat first. Receive business cards and gifts with both hands. Tap two fingers on the table to thank someone pouring your tea. Slurping noodles is fine — even appreciated. Carry tissues — many public toilets don't supply paper.",
      },
      {
        heading: "Don't",
        body:
          "Don't stick chopsticks upright in rice — it mirrors funeral incense. Don't tip in restaurants, taxis or hotels; it's not expected and can confuse staff. Don't discuss politics, Taiwan or Tibet with strangers. Don't blow your nose loudly at the table — step away. Don't expect personal space in queues or on the metro.",
      },
    ],
  },

  // ── Staying connected ─────────────────────────────────────────────────
  {
    slug: "vpn-and-esim",
    topicSlug: "staying-connected",
    order: 1,
    title: "eSIMs and VPNs before you land",
    readMinutes: 4,
    subtitle: "stay connected from day one",
    lede:
      "You can't download a VPN once you're inside China — the app stores hide them. Set everything up while you're still home.",
    callout: {
      text:
        "Install and sign in to your VPN and eSIM before you fly. Run each one once to confirm it works.",
    },
    sections: [
      {
        heading: "Recommended eSIMs",
        body:
          "Airalo (China): easy install; routes via China, so Google and Instagram are blocked — pair with a VPN. Holafly China + HK: routes through Hong Kong, so Google, Instagram and WhatsApp work without a VPN. Nomad Asia: multi-country plan, good if you also visit HK, Japan or South Korea.",
      },
      {
        heading: "VPNs that still work",
        body:
          "Astrill: most reliable in China, around US$30 a month. LetsVPN: cheaper, popular with expats. ExpressVPN: works in patches — check status before relying on it. Install them all before you arrive.",
      },
      {
        heading: "What works without a VPN",
        body:
          "WeChat, Alipay, Didi, Apple Maps, Bing, Outlook, Apple iCloud, Booking.com, Trip.com.",
      },
      {
        heading: "What's blocked",
        body:
          "Google (Search, Gmail, Maps, Drive), YouTube, Instagram, Facebook, WhatsApp, X/Twitter, most Western news.",
      },
      {
        heading: "The simplest trick",
        body:
          "A Hong Kong-routed eSIM is the easiest way to keep using Google, Instagram and WhatsApp without a VPN.",
      },
    ],
  },
  {
    slug: "apps-you-need-in-china",
    topicSlug: "staying-connected",
    order: 2,
    title: "Apps you need in China",
    readMinutes: 5,
    lede:
      "China runs on a handful of apps that most Western phones have never met. Download these before you fly — several are far easier to set up from home — and you'll land functional rather than locked out.",
    callout: {
      text:
        "Download everything on home Wi-Fi before departure. App downloads, verifications and sign-ups are slower and sometimes harder once you've landed.",
    },
    sections: [
      {
        heading: "Alipay — how you'll pay for everything",
        body:
          "The one non-negotiable. Alipay is how you'll pay for taxis, restaurants, shops, the metro and street vendors — cash and foreign cards are accepted far less than you'd expect. It takes a foreign Visa or Mastercard and verifies with your passport. It also hides a second superpower: mini-programs inside Alipay let you hail rides, order food and buy metro tickets without installing anything else. Full setup walkthrough in our Set up Alipay guide.",
      },
      {
        heading: "WeChat — messaging, and your backup wallet",
        body:
          "China's everything-app: messaging, and a payment wallet some smaller merchants prefer over Alipay. If you'll be in touch with anyone local — a guide, a driver, a friend — they will want to add you on WeChat, not text you. Registration sometimes needs an existing user to vouch for you, so start early. See our WeChat Pay guide.",
      },
      {
        heading: "DiDi — rides without the negotiation",
        body:
          "China's ride-hailing giant. Cars are cheap, plentiful and metered through the app, which removes both the language barrier and the fare negotiation. Use it through the mini-program inside Alipay — no separate app or Chinese number needed. For airport runs with luggage, a pre-booked private transfer through eazilyChina means a driver waiting in arrivals instead of a pickup-point hunt.",
      },
      {
        heading: "Meituan or Ele.me — food delivery to your hotel door",
        body:
          "China's food delivery is fast, cheap and astonishingly comprehensive — from full restaurant meals to a single bubble tea, delivered to a hotel lobby in half an hour. Meituan (the yellow kangaroo) is the market giant and offers an English interface for foreign visitors in major cities; Ele.me runs as a mini-program inside Alipay, so it works with the payment setup you already have. Set your delivery address in Chinese — copy it from your hotel's booking confirmation or ask reception to type it in.",
      },
      {
        heading: "What about Google, WhatsApp and Instagram?",
        body:
          "Most Western services — Google, WhatsApp, Instagram, Facebook, YouTube — are blocked on Chinese networks. The simplest lawful workaround for a visitor: use international roaming or a travel eSIM from a non-Chinese provider, because data routed through your home carrier is not filtered. Set this up before you fly (see our connectivity guide). Some travellers also install a VPN before arrival; be aware reliability inside China varies week to week, and a VPN cannot be reliably downloaded once you're there. Whatever you choose, the rule is the same: sort it before departure.",
      },
    ],
  },
  // ── Sights & museums ──────────────────────────────────────────────────
  {
    slug: "shanghai-must-sees",
    topicSlug: "sights-and-museums",
    order: 1,
    title: "Shanghai's must-see sights",
    readMinutes: 7,
    lede:
      "Shanghai splits neatly in two: the historic city west of the river, and the skyline that stares back at it from Pudong. These are the places worth your time, with the Chinese names to show a taxi driver.",
    callout: {
      text:
        "Big-name sights often use timed entry and sell out. Ask the concierge to arrange tickets before you queue.",
    },
    sections: [
      {
        heading: "The Bund (外滩)",
        body:
          "Shanghai's riverfront parade of 1920s banking palaces, facing the Pudong skyline across the water. Free, open all day, and at its best at night when both banks light up. Metro Line 2 or 10 to Nanjing East Road (南京东路), then walk east.",
      },
      {
        heading: "Yu Garden & the Old Town (豫园)",
        body:
          "A classical Ming-dynasty garden wrapped in the bazaar streets of the old walled city, with the City God Temple next door. Come hungry — the surrounding lanes are famous for xiaolongbao and shengjianbao. Metro Line 10 to Yuyuan Garden (豫园).",
      },
      {
        heading: "The Pudong towers (陆家嘴)",
        body:
          "Three generations of skyline stand side by side in Lujiazui: the Oriental Pearl Tower, the World Financial Centre and the corkscrew Shanghai Tower, one of the tallest buildings on earth. Each has an observation deck; pick one rather than all three. Metro Line 2 to Lujiazui (陆家嘴).",
      },
      {
        heading: "The former French Concession (法租界)",
        body:
          "Plane-tree avenues, lane houses, small cafés and boutiques — the best neighbourhood in Shanghai for simply walking. Anchor a wander around Wukang Road and Anfu Road, with no ticket and no plan required.",
      },
      {
        heading: "Xintiandi (新天地)",
        body:
          "Restored shikumen lane houses turned into an open-air dining and shopping quarter — polished rather than gritty, and an easy evening out. Metro Line 10 or 13 to Xintiandi (新天地).",
      },
      {
        heading: "Tianzifang (田子坊)",
        body:
          "A maze of alleys threaded with craft shops, galleries and snack stalls in the old Taikang Road lanes. Touristy but charming, and best mid-week. Metro Line 9 to Dapuqiao (打浦桥).",
      },
      {
        heading: "Shanghai Museum (上海博物馆)",
        body:
          "One of China's great collections — bronzes, ceramics, calligraphy and jade — split between the original People's Square building and the newer Shanghai Museum East in Pudong. Free entry, but book ahead online or ask the concierge; weekend slots go fast.",
      },
      {
        heading: "M50 & West Bund art (M50创意园)",
        body:
          "Shanghai's contemporary art lives in converted industrial spaces: the M50 warehouse district on Suzhou Creek for galleries, and the West Bund riverside in Xuhui for major museums. Most galleries are free.",
      },
    ],
  },
  {
    slug: "water-towns-day-trips",
    topicSlug: "sights-and-museums",
    order: 2,
    title: "Water towns & day trips",
    readMinutes: 5,
    lede:
      "Shanghai sits at the edge of the Yangtze delta's canal country, and some of China's most beautiful places are under an hour away by high-speed rail.",
    sections: [
      {
        heading: "Zhujiajiao (朱家角)",
        body:
          "The closest of the classic water towns — Qing-dynasty houses, stone bridges and canal boats, inside Shanghai municipality itself. Half a day is enough; go early to beat the crowds.",
      },
      {
        heading: "Suzhou (苏州)",
        body:
          "The city of classical gardens, silk and canals, around half an hour away by high-speed rail. The Humble Administrator's Garden and the old town's canal streets make an easy, spectacular day trip.",
      },
      {
        heading: "Hangzhou (杭州)",
        body:
          "West Lake's temples, pagodas and tea hills earn Hangzhou its ancient reputation as heaven on earth. Under an hour by high-speed rail; a long day trip or a relaxed overnight.",
      },
      {
        heading: "Getting tickets",
        body:
          "High-speed rail tickets are real-name booked against your passport, and popular trains sell out. The concierge can arrange tickets and tell you which station your train leaves from — Shanghai has several, and they are far apart.",
      },
    ],
  },
  // ── Getting around (additional) ───────────────────────────────────────
  {
    slug: "airports-and-arrival",
    topicSlug: "getting-around",
    order: 2,
    title: "Arriving: airports, the Maglev & getting into town",
    readMinutes: 5,
    lede:
      "Shanghai has two airports on opposite sides of the city: Pudong (PVG) for most international flights, and Hongqiao (SHA) for mostly domestic routes, next to the high-speed rail hub.",
    callout: {
      text:
        "Book a private transfer in the app before you fly and your driver will meet you in arrivals — no queues, no negotiation, fixed price.",
    },
    sections: [
      {
        heading: "From Pudong (PVG)",
        body:
          "Pudong is a long way out — allow around an hour to the centre by road. The Maglev is the fun option: a few minutes at up to 300 km/h to Longyang Road, where you change to the metro. Metro Line 2 runs the whole way into town more slowly. A private transfer is the door-to-door option, and what we recommend after a long flight.",
      },
      {
        heading: "From Hongqiao (SHA)",
        body:
          "Much closer to the city, and connected to the metro on Lines 2 and 10. Hongqiao is also where most high-speed trains depart, so you may pass through again for day trips.",
      },
      {
        heading: "Taxis and DiDi",
        body:
          "Official taxi ranks are safe and metered — never accept a ride from someone approaching you in arrivals. DiDi (China's ride-hailing app) works well if you have mobile data; the Ride tab in this app will guide you through it.",
      },
      {
        heading: "Show, don't say",
        body:
          "Drivers rarely speak English. Have your hotel's name and address in Chinese characters ready to show — every venue in our Eat & drink directory includes a show-to-driver card for exactly this reason.",
      },
    ],
  },
  // ── Culture & etiquette (additional) ──────────────────────────────────
  {
    slug: "if-something-goes-wrong",
    topicSlug: "culture-and-etiquette",
    order: 2,
    title: "If something goes wrong",
    readMinutes: 4,
    lede:
      "China is one of the safest countries you can visit, but knowing the basics before you need them makes any problem smaller.",
    callout: {
      text:
        "In any emergency: 110 for police, 120 for ambulance, 119 for fire. All are free to call. For anything less urgent, message the concierge and we'll help you handle it.",
    },
    sections: [
      {
        heading: "Lost passport",
        body:
          "Confirm it's genuinely gone before reporting — a reported passport is cancelled and stays cancelled. Then report the loss at the nearest police station (Public Security Bureau) for a loss certificate, and contact your country's consulate in Shanghai for an emergency replacement. The concierge can help you find both and get there.",
      },
      {
        heading: "Lost or stolen cards",
        body:
          "Freeze the card in your banking app immediately, then follow your bank's process. If your phone is gone too, this is exactly the moment the paper backup of key numbers you packed pays off.",
      },
      {
        heading: "Feeling unwell",
        body:
          "Pharmacies are everywhere for minor complaints. For anything serious, Shanghai has excellent international hospitals with English-speaking staff — message the concierge and we'll point you to the nearest and help with the language.",
      },
      {
        heading: "Lost, or in a dispute",
        body:
          "Screenshot your hotel's address in Chinese before you go out. For a taxi dispute or anything confusing on the ground, don't escalate — photograph what matters, pay if you must, and let us untangle it afterwards.",
      },
    ],
  },
];

export function getTopic(slug: string): GuideTopic | undefined {
  return (
    GUIDE_TOPICS.find((t) => t.slug === slug) ??
    HIDDEN_TOPICS.find((t) => t.slug === slug)
  );
}

export function getGuidesInTopic(slug: string): Guide[] {
  return GUIDES.filter((g) => g.topicSlug === slug && !g.featured).sort(
    (a, b) => a.order - b.order,
  );
}

export function getGuide(topicSlug: string, guideSlug: string): Guide | undefined {
  return GUIDES.find((g) => g.topicSlug === topicSlug && g.slug === guideSlug);
}

export function getNextGuide(current: Guide): Guide | undefined {
  return getGuidesInTopic(current.topicSlug).find((g) => g.order > current.order);
}

export function countGuides(topicSlug: string): number {
  return getGuidesInTopic(topicSlug).length;
}

export function featuredGuide(): Guide {
  return GUIDES.find((g) => g.slug === "pre-arrival-checklist")!;
}