import type { LucideIcon } from "lucide-react";
import { Landmark, Utensils, CreditCard, Train } from "lucide-react";
import type { InterestId } from "./interests";
import { SHANGHAI_DINING_PICKS } from "@/content/shanghaiDining";

export type CityPlaceCategory = "sights" | "food" | "atm" | "subway";

// Category for the small overline chip shown on pick cards and the AI
// insider guide sheet. Separate from the free-form vibe `tag`. Kept short
// and factual — what the venue actually is.
export const PICK_CATEGORIES = [
  "restaurant",
  "cafe",
  "bar",
  "attraction",
  "museum",
  "gallery",
  "park",
  "temple",
  "shopping",
  "view",
] as const;
export type PickCategoryId = typeof PICK_CATEGORIES[number];

export type CityPlace = {
  id: string;
  coords: [number, number];
  name: string;
  nameZh: string;
  pinyin: string;
  category: CityPlaceCategory;
  address: string;
  addressZh: string;
  blurb: string;
};

export type CityPick = {
  tag: string;
  category?: PickCategoryId;
  title: string;
  blurb: string;
  meta: string;
  rating?: number;
  accent: "violet" | "cyan" | "amber";
  interests?: InterestId[];
  dianping_signal?: string;
  // New (Amap-verified) fields, populated for picks returned from the
  // daily-picks edge function. Optional so the static seed still type-checks.
  title_zh?: string;
  address?: string;
  source_url?: string;
  // District label used by Path A's "From our picks" restaurant search
  // (RestaurantBooking.tsx). Optional so existing picks still type-check.
  district?: string;
};

export type CityBrief = {
  weather: string;
  weatherHint: string;
  air: string;
  airHint: string;
  crowd: string;
  crowdHint: string;
  tickerWeather: string;
  tickerCrowd: string;
  signatureSpot: string;
};

export type CityData = {
  id: string;
  name: string;
  nameZh: string;
  center: [number, number];
  brief: CityBrief;
  places: CityPlace[];
  picks: CityPick[];
};

export const PLACE_CATEGORIES: { id: CityPlaceCategory; label: string; icon: LucideIcon }[] = [
  { id: "atm", label: "ATM", icon: CreditCard },
  { id: "food", label: "Restaurant", icon: Utensils },
  { id: "subway", label: "Subway Station", icon: Train },
  { id: "sights", label: "Sights", icon: Landmark },
];

export const CITIES: CityData[] = [
  {
    id: "shanghai",
    name: "Shanghai",
    nameZh: "上海",
    center: [31.2330, 121.4760],
    brief: {
      weather: "23°C · Clear",
      weatherHint: "Jacket after 8pm",
      air: "AQI 42",
      airHint: "Good — go outside",
      crowd: "Medium",
      crowdHint: "Quietest 7–9am",
      tickerWeather: "23° clear",
      tickerCrowd: "Bund crowd · medium",
      signatureSpot: "The Bund",
    },
    places: [
      { id: "bund", coords: [31.2397, 121.4905], name: "The Bund", nameZh: "外滩", pinyin: "Wài tān", category: "sights", address: "Zhongshan East 1st Rd, Huangpu", addressZh: "黄浦区中山东一路", blurb: "Iconic waterfront promenade with colonial-era architecture facing Pudong's skyline." },
      { id: "yuyuan", coords: [31.2272, 121.4920], name: "Yu Garden", nameZh: "豫园", pinyin: "Yù yuán", category: "sights", address: "218 Anren St, Huangpu", addressZh: "黄浦区安仁街218号", blurb: "Classical Ming-dynasty garden with a buzzing bazaar and dumpling houses." },
      { id: "din-tai-fung", coords: [31.2310, 121.4730], name: "Din Tai Fung (Xintiandi)", nameZh: "鼎泰丰 新天地店", pinyin: "Dǐng tài fēng", category: "food", address: "Xintiandi South Block, Lane 123 Xingye Rd", addressZh: "新天地南里兴业路123弄", blurb: "Picture menus, English staff, legendary xiaolongbao." },
      { id: "hsbc-atm", coords: [31.2370, 121.4860], name: "HSBC ATM (Visa accepted)", nameZh: "汇丰银行 ATM", pinyin: "Huì fēng yín háng", category: "atm", address: "101 Yincheng East Rd, Pudong", addressZh: "浦东新区银城东路101号", blurb: "Reliable Visa/Mastercard withdrawals in CNY. English interface." },
      { id: "nanjing-east-station", coords: [31.2390, 121.4810], name: "Nanjing East Rd Station", nameZh: "南京东路地铁站", pinyin: "Nán jīng dōng lù dì tiě zhàn", category: "subway", address: "Line 2 & Line 10 interchange, Huangpu", addressZh: "黄浦区 2号线/10号线换乘", blurb: "Major interchange between Line 2 and Line 10. English signage." },
    ],
    picks: [
      { tag: "Hidden gem", title: "Yongkang Lu street eats", blurb: "A 200m strip lined with small stalls — wander and pick what looks busy.", meta: "Former French Concession · ¥¥", rating: 4.8, accent: "violet" },
      { tag: "Local favourite", category: "bar", title: "Sip Tea Bar (speakeasy)", blurb: "Hidden cocktail and tea bar — book ahead for an evening seat.", meta: "Open late · ¥¥¥", rating: 4.9, accent: "cyan" },
      { tag: "Skyline view", category: "bar", title: "Bar Rouge · Bund 18", blurb: "Rooftop bar with a head-on view of the Pudong skyline at sunset.", meta: "The Bund · ¥¥¥¥", rating: 4.6, accent: "cyan" },
      { tag: "Foodie pick", category: "restaurant", title: "Din Tai Fung · Xintiandi", blurb: "Picture menu and English staff — the xiaolongbao is the classic order.", meta: "Xintiandi · ¥¥", rating: 4.8, accent: "violet" },
      // ---------------------------------------------------------------------
      // Path A restaurant index — established, verifiable Shanghai venues
      // frequented by Western visitors. Every entry has an English name I'm
      // confident in; title_zh is only set where I'm confident in the exact
      // Chinese name. District is the recognised neighbourhood label used
      // in city guides. `meta` carries a ¥ price signal so the venue is
      // picked up by the restaurant venueIndex filter.
      //
      // Not included (flagged, needs verification before adding):
      //  - Hakkasan Shanghai (Bund 5): closed in 2019; leaving out.
      //  - T8 Xintiandi, The Commune Social, Napa Wine Bar: status uncertain.
      //  - Yong Yi Ting (Mandarin Oriental Pudong): exact venue name/loc
      //    unverified.
      // ---------------------------------------------------------------------
      { tag: "Fine dining", category: "restaurant", title: "Fu 1088", title_zh: "福1088", district: "Jing'an", blurb: "Shanghainese fine dining in a 1930s villa — private rooms only, book well ahead.", meta: "Jing'an · ¥¥¥¥", accent: "violet" },
      { tag: "Fine dining", category: "restaurant", title: "Fu 1039", title_zh: "福1039", district: "Changning", blurb: "Sister restaurant to Fu 1088, in a heritage villa on Yuyuan Road.", meta: "Changning · ¥¥¥", accent: "violet" },
      { tag: "Michelin", category: "restaurant", title: "Fu He Hui", title_zh: "福和慧", district: "Changning", blurb: "Michelin-starred contemporary Chinese vegetarian tasting menu.", meta: "Changning · ¥¥¥¥", accent: "violet" },
      { tag: "Chef's table", category: "restaurant", title: "Ultraviolet by Paul Pairet", district: "The Bund", blurb: "Ten-seat multi-sensory tasting menu; pickup point on the Bund.", meta: "The Bund · ¥¥¥¥", accent: "violet" },
      { tag: "The Bund", category: "restaurant", title: "Mr & Mrs Bund", district: "The Bund", blurb: "Modern French by Paul Pairet on the sixth floor of Bund 18.", meta: "The Bund · ¥¥¥¥", accent: "cyan" },
      { tag: "The Bund", category: "restaurant", title: "Jean-Georges Shanghai", title_zh: "Jean-Georges 法国餐厅", district: "The Bund", blurb: "Jean-Georges Vongerichten's classic room at Three on the Bund.", meta: "The Bund · ¥¥¥¥", accent: "cyan" },
      { tag: "The Bund", category: "restaurant", title: "Mercato", title_zh: "Mercato 意大利餐厅", district: "The Bund", blurb: "Rustic Italian by Jean-Georges — wood-fired pizza with a river view.", meta: "The Bund · ¥¥¥", accent: "cyan" },
      { tag: "Michelin", category: "restaurant", title: "8½ Otto e Mezzo Bombana", title_zh: "8½ Otto e Mezzo BOMBANA", district: "The Bund", blurb: "Umberto Bombana's Michelin Italian on Bund 6.", meta: "The Bund · ¥¥¥¥", accent: "violet" },
      { tag: "Michelin", category: "restaurant", title: "Da Vittorio Shanghai", title_zh: "Da Vittorio 上海", district: "The Bund", blurb: "The Cerea family's three-star Italian at the Bund Finance Centre.", meta: "The Bund · ¥¥¥¥", accent: "violet" },
      { tag: "The Bund", category: "restaurant", title: "Shook!", district: "The Bund", blurb: "Rooftop pan-Asian at the Swatch Art Peace Hotel, Nanjing East Rd.", meta: "The Bund · ¥¥¥", accent: "cyan" },
      { tag: "Yunnan", category: "restaurant", title: "Lost Heaven", title_zh: "花马天堂", district: "The Bund", blurb: "Candlelit Yunnanese cooking on Yan'an East Rd near the Bund.", meta: "The Bund · ¥¥¥", accent: "amber" },
      { tag: "Local classic", category: "restaurant", title: "Jesse", title_zh: "老吉士", district: "Former French Concession", blurb: "Old-Shanghai home cooking on Tianping Road; book days ahead.", meta: "Former French Concession · ¥¥¥", accent: "amber" },
      { tag: "Local classic", category: "restaurant", title: "Bao Luo", title_zh: "保罗酒楼", district: "Former French Concession", blurb: "Late-night Shanghainese institution on Fumin Road — open past midnight.", meta: "Former French Concession · ¥¥", accent: "amber" },
      { tag: "Local classic", category: "restaurant", title: "Yè Shanghai", title_zh: "夜上海", district: "Xintiandi", blurb: "Refined Shanghainese in Xintiandi's North Block.", meta: "Xintiandi · ¥¥¥", accent: "violet" },
      { tag: "Local classic", category: "restaurant", title: "1221", title_zh: "一二二一", district: "Changning", blurb: "Long-running Shanghainese favourite on Yan'an West Road.", meta: "Changning · ¥¥", accent: "amber" },
      { tag: "Local classic", category: "restaurant", title: "Shanghai Grandmother", title_zh: "上海姥姥", district: "Huangpu", blurb: "Home-style Shanghainese on Fuzhou Rd, a short walk from the Bund.", meta: "Huangpu · ¥¥", accent: "amber" },
      { tag: "Peking duck", category: "restaurant", title: "Xindalu", title_zh: "新大陆", district: "Hongkou", blurb: "Peking duck at Hyatt on the Bund with a Pudong skyline view.", meta: "Hongkou · ¥¥¥", accent: "cyan" },
      { tag: "Xiaolongbao", category: "restaurant", title: "Nanxiang Steamed Bun", title_zh: "南翔馒头店", district: "Yu Garden", blurb: "The century-old xiaolongbao house on Yuyuan Old Street — go early.", meta: "Yu Garden · ¥¥", accent: "amber" },
      { tag: "Dim sum", category: "restaurant", title: "Crystal Jade", title_zh: "翡翠酒家", district: "Xintiandi", blurb: "Reliable Cantonese dim sum and hand-pulled noodles in Xintiandi.", meta: "Xintiandi · ¥¥", accent: "violet" },
      { tag: "Fine dining", category: "restaurant", title: "Xin Rong Ji", title_zh: "新荣记", district: "Jing'an", blurb: "Michelin-starred Taizhou seafood — the L'Avenue mall location is central.", meta: "Jing'an · ¥¥¥¥", accent: "violet" },
      { tag: "Vegetarian", category: "restaurant", title: "Wujie", title_zh: "大蔬无界", district: "The Bund", blurb: "Sleek vegetarian tasting menus overlooking the Huangpu.", meta: "The Bund · ¥¥¥", accent: "violet" },
      { tag: "Xinjiang", category: "restaurant", title: "Xibo", title_zh: "锡伯新疆餐厅", district: "Former French Concession", blurb: "Modern Xinjiang cooking on Changshu Road — hand-pulled noodles, cumin lamb.", meta: "Former French Concession · ¥¥", accent: "amber" },
      { tag: "Hot pot", category: "restaurant", title: "Hai Di Lao", title_zh: "海底捞", district: "Multiple", blurb: "The famous service-obsessed hot pot chain — English menu at every branch.", meta: "Multiple · ¥¥", accent: "amber" },
      { tag: "French", category: "restaurant", title: "Le Comptoir de Pierre Gagnaire", title_zh: "Le Comptoir de Pierre Gagnaire", district: "Xuhui", blurb: "Pierre Gagnaire's Shanghai bistro at Capella Jian Ye Li.", meta: "Xuhui · ¥¥¥¥", accent: "violet" },
      { tag: "Italian", category: "restaurant", title: "Da Marco", district: "Former French Concession", blurb: "Long-running honest Italian on Yueyang Road.", meta: "Former French Concession · ¥¥¥", accent: "amber" },
      { tag: "Bistro", category: "restaurant", title: "Sasha's", district: "Former French Concession", blurb: "Western brunch and steaks in a heritage mansion on Dongping Road.", meta: "Former French Concession · ¥¥¥", accent: "cyan" },
      { tag: "Bistro", category: "restaurant", title: "Franck", district: "Former French Concession", blurb: "Blackboard-menu French bistro at Ferguson Lane, Wukang Road.", meta: "Former French Concession · ¥¥¥", accent: "cyan" },
      { tag: "Fine dining", category: "restaurant", title: "Yongfoo Elite", title_zh: "雍福会", district: "Former French Concession", blurb: "Antique-filled Shanghainese in a former British consulate on Yongfu Road.", meta: "Former French Concession · ¥¥¥¥", accent: "violet" },
      { tag: "Historic", category: "restaurant", title: "Ye Olde Station Restaurant", title_zh: "上海老站", district: "Xujiahui", blurb: "Shanghainese served in refurbished vintage railway carriages by St Ignatius Cathedral.", meta: "Xujiahui · ¥¥", accent: "amber" },
      // ---------------------------------------------------------------------
      // Sightseeing index — established Shanghai sights spread across the six
      // curated wizard areas (The Bund, Yu Garden, Xintiandi, French
      // Concession, Jing'an, West Bund). District strings match
      // src/data/shanghaiAreas.ts so recommend-stops can filter by area.
      //
      // Not included (flagged, mapping uncertain — leaving out rather than
      // forcing them into an area they don't belong to):
      //  - Shanghai Tower observation deck (Lujiazui/Pudong — no curated area)
      //  - Oriental Pearl Tower (Lujiazui/Pudong — no curated area)
      //  - M50 Creative Park (Moganshan Rd, Putuo — no curated area)
      //  - Power Station of Art (South Bund/Huangpu — not truly West Bund)
      //  - People's Park & People's Square (Huangpu but not the Bund proper)
      // ---------------------------------------------------------------------
      { tag: "Iconic", category: "attraction", title: "The Bund Promenade", title_zh: "外滩", district: "The Bund", blurb: "Riverfront walk lined with 1920s trading houses facing the Pudong skyline.", meta: "The Bund · free", accent: "cyan" },
      { tag: "Museum", category: "museum", title: "Shanghai Museum", title_zh: "上海博物馆", district: "Huangpu", blurb: "China's foremost antiquities collection — bronzes, ceramics, calligraphy — on People's Square.", meta: "People's Square · free", accent: "violet" },
      { tag: "Art", category: "gallery", title: "Rockbund Art Museum", title_zh: "外滩美术馆", district: "The Bund", blurb: "Contemporary shows in a restored 1932 building one block behind the Bund.", meta: "The Bund · ¥", accent: "violet" },
      { tag: "Quirky", category: "attraction", title: "Bund Sightseeing Tunnel", title_zh: "外滩观光隧道", district: "The Bund", blurb: "A retro under-river light tunnel connecting the Bund to Lujiazui — kitsch in the best way.", meta: "The Bund · ¥", accent: "amber" },
      { tag: "Classical garden", category: "attraction", title: "Yu Garden", title_zh: "豫园", district: "Yu Garden", blurb: "16th-century scholar's garden of ponds, rockeries and pavilions in the Old City.", meta: "Yu Garden · ¥", accent: "violet" },
      { tag: "Temple", category: "temple", title: "City God Temple", title_zh: "城隍庙", district: "Yu Garden", blurb: "Working Taoist temple at the heart of the Old City bazaar.", meta: "Yu Garden · ¥", accent: "amber" },
      { tag: "Shopping", category: "shopping", title: "Yuyuan Bazaar", title_zh: "豫园商城", district: "Yu Garden", blurb: "Lantern-lit warren of snack stalls, souvenir shops and dumpling houses around the garden.", meta: "Yu Garden · free", accent: "amber" },
      { tag: "Heritage lanes", category: "shopping", title: "Xintiandi", title_zh: "新天地", district: "Xintiandi", blurb: "Restored shikumen lane houses turned boutiques, wine bars and terraces.", meta: "Xintiandi · free", accent: "cyan" },
      { tag: "Museum", category: "museum", title: "Shikumen Open House Museum", title_zh: "屋里厢", district: "Xintiandi", blurb: "A furnished 1920s lane house showing how Shanghai families lived.", meta: "Xintiandi · ¥", accent: "violet" },
      { tag: "Museum", category: "museum", title: "Site of the First CPC National Congress", title_zh: "中共一大会址", district: "Xintiandi", blurb: "Preserved 1921 meeting house with a large adjoining exhibition hall.", meta: "Xintiandi · free", accent: "violet" },
      { tag: "Park", category: "park", title: "Fuxing Park", title_zh: "复兴公园", district: "Former French Concession", blurb: "French-designed 1909 park with plane trees, tai chi in the mornings, ballroom dancers by day.", meta: "Former French Concession · free", accent: "amber" },
      { tag: "Lanes", category: "shopping", title: "Tianzifang", title_zh: "田子坊", district: "Former French Concession", blurb: "Warren of shikumen alleys packed with indie boutiques, tea shops and small cafés.", meta: "Former French Concession · free", accent: "amber" },
      { tag: "Landmark", category: "attraction", title: "Wukang Mansion", title_zh: "武康大楼", district: "Former French Concession", blurb: "Iconic 1924 flatiron building at the six-way Wukang Road junction — best photo at dusk.", meta: "Former French Concession · free", accent: "cyan" },
      { tag: "Museum", category: "museum", title: "Former Residence of Sun Yat-sen", title_zh: "孙中山故居", district: "Former French Concession", blurb: "The republican leader's 1918–1924 home, preserved with original furnishings.", meta: "Former French Concession · ¥", accent: "violet" },
      { tag: "Museum", category: "museum", title: "Shanghai Propaganda Poster Art Centre", title_zh: "宣传画年画艺术中心", district: "Former French Concession", blurb: "Basement gallery of 1949–1979 propaganda posters — call ahead, entrance is unmarked.", meta: "Former French Concession · ¥", accent: "amber" },
      { tag: "Temple", category: "temple", title: "Jing'an Temple", title_zh: "静安寺", district: "Jing'an", blurb: "Golden-roofed Buddhist temple wedged between Jing'an's skyscrapers.", meta: "Jing'an · ¥", accent: "amber" },
      { tag: "Park", category: "park", title: "Jing'an Sculpture Park", title_zh: "静安雕塑公园", district: "Jing'an", blurb: "Lawned park dotted with contemporary sculpture, fronting the Natural History Museum.", meta: "Jing'an · free", accent: "cyan" },
      { tag: "Heritage", category: "attraction", title: "Zhang Garden (Zhangyuan)", title_zh: "张园", district: "Jing'an", blurb: "Restored late-Qing shikumen compound reopened as a heritage shopping and dining quarter.", meta: "Jing'an · free", accent: "cyan" },
      { tag: "Museum", category: "museum", title: "Shanghai Natural History Museum", title_zh: "上海自然博物馆", district: "Jing'an", blurb: "Nautilus-shaped museum with dinosaur halls and a full-scale whale skeleton.", meta: "Jing'an · ¥", accent: "violet" },
      { tag: "Art", category: "museum", title: "Long Museum West Bund", title_zh: "龙美术馆西岸馆", district: "West Bund", blurb: "Vaulted-concrete private museum with strong modern and traditional Chinese collections.", meta: "West Bund · ¥¥", accent: "violet" },
      { tag: "Art", category: "museum", title: "West Bund Museum", title_zh: "西岸美术馆", district: "West Bund", blurb: "David Chipperfield-designed riverside museum running a rolling Centre Pompidou partnership.", meta: "West Bund · ¥¥", accent: "violet" },
      { tag: "Art", category: "gallery", title: "Tank Shanghai", title_zh: "油罐艺术中心", district: "West Bund", blurb: "Disused aviation fuel tanks reworked into a contemporary art park by the Huangpu.", meta: "West Bund · ¥¥", accent: "cyan" },
      { tag: "Art", category: "museum", title: "Yuz Museum", title_zh: "余德耀美术馆", district: "West Bund", blurb: "Former aircraft hangar showing large-scale contemporary installations.", meta: "West Bund · ¥¥", accent: "violet" },
      // ---------------------------------------------------------------------
      // Café index — established Shanghai cafés a Western visitor would
      // plausibly want for breakfast, weighted to French Concession & Jing'an
      // where café culture actually is.
      // ---------------------------------------------------------------------
      { tag: "Third-wave", category: "cafe", title: "Seesaw Coffee", title_zh: "Seesaw 咖啡", district: "Jing'an", blurb: "Shanghai-born speciality roaster — the Jing'an Kerry Centre flagship is the flagship.", meta: "Jing'an · ¥¥", accent: "amber" },
      { tag: "Third-wave", category: "cafe", title: "% Arabica · Wukang Road", title_zh: "% Arabica", district: "Former French Concession", blurb: "Minimalist Kyoto-founded coffee bar on the Wukang Mansion corner — takeaway only.", meta: "Former French Concession · ¥¥", accent: "cyan" },
      { tag: "Local chain", category: "cafe", title: "Manner Coffee", title_zh: "Manner 咖啡", district: "Jing'an", blurb: "The Shanghai-born stand-up espresso bar that started the city's third-wave boom.", meta: "Jing'an · ¥", accent: "amber" },
      { tag: "Bakery-café", category: "cafe", title: "Baker & Spice · Anfu Road", title_zh: "Baker & Spice", district: "Former French Concession", blurb: "All-day bakery-café for sourdough, quiches and full breakfasts on Anfu Road.", meta: "Former French Concession · ¥¥", accent: "amber" },
      { tag: "Indie", category: "cafe", title: "Café del Volcán", title_zh: "Café del Volcán", district: "Former French Concession", blurb: "Tiny single-origin coffee bar on Yongkang Road — long black, one pastry, done.", meta: "Former French Concession · ¥¥", accent: "cyan" },
      { tag: "Brunch", category: "cafe", title: "RAC Bar & Coffee", title_zh: "RAC", district: "Former French Concession", blurb: "French-style buckwheat galettes and flat whites — the go-to weekend brunch.", meta: "Former French Concession · ¥¥", accent: "amber" },
      { tag: "Brunch", category: "cafe", title: "Egg", title_zh: "Egg", district: "Former French Concession", blurb: "All-day brunch spot on Xiangyang Road — eggs Benedict, avocado toast, decent coffee.", meta: "Former French Concession · ¥¥", accent: "cyan" },
      { tag: "Roaster", category: "cafe", title: "Sumerian Coffee Roasters", title_zh: "Sumerian", district: "Jing'an", blurb: "Cozy in-house roaster off Nanjing West Road — bagels, cold brew, WiFi that works.", meta: "Jing'an · ¥¥", accent: "amber" },
      // Merged from curated dining index (curated-2026-07) — 172 new venues.
      ...SHANGHAI_DINING_PICKS,
    ],
  },
  {
    id: "beijing",
    name: "Beijing",
    nameZh: "北京",
    center: [39.9042, 116.4074],
    brief: {
      weather: "18°C · Sunny",
      weatherHint: "Layer up at dusk",
      air: "AQI 78",
      airHint: "Moderate — ease up",
      crowd: "High",
      crowdHint: "Arrive 8:30am sharp",
      tickerWeather: "18° sunny",
      tickerCrowd: "Forbidden City · busy",
      signatureSpot: "the Forbidden City",
    },
    places: [
      { id: "forbidden-city", coords: [39.9163, 116.3972], name: "Forbidden City", nameZh: "故宫", pinyin: "Gù gōng", category: "sights", address: "4 Jingshan Front St, Dongcheng", addressZh: "东城区景山前街4号", blurb: "Imperial palace complex — book entry the day before." },
      { id: "great-wall-mutianyu", coords: [40.4319, 116.5704], name: "Great Wall · Mutianyu", nameZh: "慕田峪长城", pinyin: "Mù tián yù", category: "sights", address: "Huairou District", addressZh: "怀柔区", blurb: "Less-crowded restored stretch with cable car and toboggan." },
      { id: "siji-minfu", coords: [39.9180, 116.4030], name: "Siji Minfu (Peking Duck)", nameZh: "四季民福烤鸭店", pinyin: "Sì jì mín fú", category: "food", address: "Near Forbidden City east gate", addressZh: "故宫东门附近", blurb: "Crispy Peking duck with a Forbidden City wall view. Book ahead." },
      { id: "icbc-atm-wangfujing", coords: [39.9138, 116.4108], name: "ICBC ATM · Wangfujing", nameZh: "工商银行 ATM", pinyin: "Gōng shāng yín háng", category: "atm", address: "Wangfujing Pedestrian St", addressZh: "王府井步行街", blurb: "Visa/Mastercard accepted. English interface." },
      { id: "wangfujing-station", coords: [39.9151, 116.4105], name: "Wangfujing Station", nameZh: "王府井地铁站", pinyin: "Wáng fǔ jǐng", category: "subway", address: "Line 1, Dongcheng", addressZh: "东城区 1号线", blurb: "Closest stop to Forbidden City east gate." },
    ],
    picks: [
      { tag: "Must-see", category: "attraction", title: "Forbidden City sunrise", blurb: "Beat the crowds — be at Meridian Gate by 8:20am. Book tickets the day before.", meta: "Book day before · ¥60", rating: 4.9, accent: "cyan" },
      { tag: "Foodie pick", category: "restaurant", title: "Siji Minfu Peking Duck", blurb: "Crisp-skin Peking duck with a view of the palace walls. Book ahead.", meta: "Near Forbidden City · ¥¥¥", rating: 4.8, accent: "violet" },
      { tag: "Hidden gem", title: "Hutong walk · Wudaoying", blurb: "Indie cafes and bookshops in a quiet hutong. Best 3–5pm.", meta: "Lama Temple area · ¥¥", rating: 4.7, accent: "amber" },
      { tag: "Skyline view", category: "park", title: "Jingshan Park hilltop", blurb: "Panorama over Forbidden City rooftops. Sunset gold.", meta: "10 min walk · ¥2", rating: 4.8, accent: "cyan" },
    ],
  },
  {
    id: "xian",
    name: "Xi'an",
    nameZh: "西安",
    center: [34.3416, 108.9398],
    brief: {
      weather: "21°C · Hazy sun",
      weatherHint: "Dry — pack water",
      air: "AQI 95",
      airHint: "Hazy — mask optional",
      crowd: "High",
      crowdHint: "Best after 3pm",
      tickerWeather: "21° hazy",
      tickerCrowd: "Warriors · busy",
      signatureSpot: "the Terracotta Army",
    },
    places: [
      { id: "terracotta", coords: [34.3848, 109.2734], name: "Terracotta Army", nameZh: "兵马俑", pinyin: "Bīng mǎ yǒng", category: "sights", address: "Lintong District", addressZh: "临潼区", blurb: "8,000 lifesize warriors. Book early-bird 8:30am ticket." },
      { id: "city-wall", coords: [34.2658, 108.9540], name: "Xi'an City Wall", nameZh: "西安城墙", pinyin: "Xī ān chéng qiáng", category: "sights", address: "Inner ring", addressZh: "城墙内环", blurb: "14km Ming-dynasty wall — rent a bike and circle it." },
      { id: "muslim-quarter-noodles", coords: [34.2670, 108.9402], name: "Biang Biang Noodles · Muslim Quarter", nameZh: "Biangbiang面 · 回民街", pinyin: "Biáng biáng miàn", category: "food", address: "Beiyuanmen St", addressZh: "北院门", blurb: "Hand-pulled noodles, chili oil. Cash + WeChat Pay." },
      { id: "boc-atm-bell", coords: [34.2615, 108.9402], name: "Bank of China ATM · Bell Tower", nameZh: "中国银行 ATM", pinyin: "Zhōng guó yín háng", category: "atm", address: "Bell Tower Square", addressZh: "钟楼广场", blurb: "Reliable for Visa & Mastercard. English available." },
      { id: "bell-tower-station", coords: [34.2608, 108.9401], name: "Bell Tower Station", nameZh: "钟楼地铁站", pinyin: "Zhōng lóu", category: "subway", address: "Line 2, Beilin", addressZh: "碑林区 2号线", blurb: "Heart of old town — walk to Muslim Quarter in 5 min." },
    ],
    picks: [
      { tag: "Must-see", category: "museum", title: "Terracotta Army afternoon", blurb: "Tour buses thin out after 3pm — afternoon entry is the calmer slot.", meta: "Lintong District · ¥150", rating: 4.9, accent: "cyan" },
      { tag: "Hidden gem", category: "attraction", title: "City Wall sunset bike loop", blurb: "Rent at South Gate, finish at golden hour. ¥45 + bike fee.", meta: "Allow 2hr · ¥¥", rating: 4.8, accent: "violet" },
      { tag: "Foodie pick", title: "Muslim Quarter food crawl", blurb: "Roujiamo, lamb skewers, persimmon cakes. Cash helps here.", meta: "After dark · ¥", rating: 4.7, accent: "amber" },
      { tag: "Quiet now", category: "temple", title: "Big Wild Goose Pagoda", blurb: "Calm gardens, evening fountain show at 8:30pm.", meta: "Metro Line 3 · ¥40", rating: 4.6, accent: "cyan" },
    ],
  },
  {
    id: "chengdu",
    name: "Chengdu",
    nameZh: "成都",
    center: [30.5728, 104.0668],
    brief: {
      weather: "20°C · Overcast",
      weatherHint: "Drizzle — pack umbrella",
      air: "AQI 65",
      airHint: "Fine for strolls",
      crowd: "High",
      crowdHint: "Pandas 9–11am",
      tickerWeather: "20° overcast",
      tickerCrowd: "Panda Base · busy",
      signatureSpot: "the Panda Base",
    },
    places: [
      { id: "panda-base", coords: [30.7330, 104.1465], name: "Chengdu Panda Base", nameZh: "成都大熊猫基地", pinyin: "Dà xióng māo jī dì", category: "sights", address: "Chenghua District", addressZh: "成华区", blurb: "Best 8:30–10:30am when pandas eat. ¥55 entry." },
      { id: "kuanzhai-alley", coords: [30.6740, 104.0590], name: "Kuanzhai Ancient Alley", nameZh: "宽窄巷子", pinyin: "Kuān zhǎi xiàng zi", category: "sights", address: "Qingyang District", addressZh: "青羊区", blurb: "Restored Qing-era alleys with teahouses and snacks." },
      { id: "chen-mapo", coords: [30.6630, 104.0700], name: "Chen Mapo Tofu", nameZh: "陈麻婆豆腐", pinyin: "Chén má pó dòu fu", category: "food", address: "Qinghua Rd, Qingyang", addressZh: "青羊区青华路", blurb: "Original mapo tofu since 1862. Picture menu." },
      { id: "icbc-atm-tianfu", coords: [30.6586, 104.0648], name: "ICBC ATM · Tianfu Square", nameZh: "工商银行 ATM", pinyin: "Gōng shāng yín háng", category: "atm", address: "Tianfu Square", addressZh: "天府广场", blurb: "Major bank — Visa accepted, English UI." },
      { id: "tianfu-square-station", coords: [30.6596, 104.0664], name: "Tianfu Square Station", nameZh: "天府广场地铁站", pinyin: "Tiān fǔ guǎng chǎng", category: "subway", address: "Line 1 & 2 interchange", addressZh: "1号线/2号线换乘", blurb: "Central interchange. English signage." },
    ],
    picks: [
      { tag: "Must-see", category: "attraction", title: "Panda Base early entry", blurb: "Pandas are most active 8:30–10:30am, before their lunch nap.", meta: "Chenghua District · ¥55", rating: 4.9, accent: "cyan" },
      { tag: "Foodie pick", category: "restaurant", title: "Hot pot · Shu Jiu Xiang", blurb: "Ask for a split pot — mild broth one side, spicy the other.", meta: "Open late · ¥¥¥", rating: 4.8, accent: "violet" },
      { tag: "Hidden gem", category: "cafe", title: "He Ming Teahouse · People's Park", blurb: "Bamboo chairs, ear cleaners, locals playing mahjong.", meta: "Free park · ¥30 tea", rating: 4.7, accent: "amber" },
      { tag: "Quiet now", category: "temple", title: "Wenshu Monastery", blurb: "Tranquil incense gardens, vegetarian lunch hall.", meta: "Metro Line 1 · ¥5", rating: 4.6, accent: "cyan" },
    ],
  },
  {
    id: "guangzhou",
    name: "Guangzhou",
    nameZh: "广州",
    center: [23.1291, 113.2644],
    brief: { weather: "27°C · Humid", weatherHint: "Hot — hydrate", air: "AQI 55", airHint: "Acceptable", crowd: "Medium", crowdHint: "Go up by 5pm", tickerWeather: "27° humid", tickerCrowd: "Canton Tower · medium", signatureSpot: "Canton Tower" },
    places: [
      { id: "canton-tower", coords: [23.1066, 113.3245], name: "Canton Tower", nameZh: "广州塔", pinyin: "Guǎng zhōu tǎ", category: "sights", address: "Yuejiang West Rd, Haizhu", addressZh: "海珠区阅江西路", blurb: "Iconic 600m tower with sky deck and ride." },
      { id: "shamian-island", coords: [23.1107, 113.2407], name: "Shamian Island", nameZh: "沙面岛", pinyin: "Shā miàn dǎo", category: "sights", address: "Liwan District", addressZh: "荔湾区", blurb: "Colonial architecture, leafy walks, photo-worthy." },
      { id: "lin-heung-tea", coords: [23.1280, 113.2625], name: "Lin Heung Tea House (dim sum)", nameZh: "莲香楼", pinyin: "Lián xiāng lóu", category: "food", address: "Liwan", addressZh: "荔湾区", blurb: "Old-school dim sum trolleys. Go before 11am." },
      { id: "boc-atm-tianhe", coords: [23.1363, 113.3214], name: "Bank of China ATM · Tianhe", nameZh: "中国银行 ATM", pinyin: "Zhōng guó yín háng", category: "atm", address: "Tianhe Rd", addressZh: "天河路", blurb: "Visa/Mastercard, English UI." },
      { id: "guangzhou-east-station", coords: [23.1521, 113.3225], name: "Guangzhou East Station", nameZh: "广州东站", pinyin: "Guǎng zhōu dōng zhàn", category: "subway", address: "Line 1 & 3 interchange", addressZh: "1号线/3号线换乘", blurb: "HSR + metro hub for Hong Kong trains." },
    ],
    picks: [
      { tag: "Foodie pick", category: "restaurant", title: "Lin Heung morning dim sum", blurb: "Trolleys roll 8–10am — try the har gow and char siu bao first.", meta: "Open 7am · ¥¥", rating: 4.7, accent: "violet" },
      { tag: "Skyline view", category: "view", title: "Canton Tower sunset", blurb: "Sky drop ride at 488m. Late afternoon is the calmer window.", meta: "Metro APM line · ¥150", rating: 4.6, accent: "cyan" },
      { tag: "Hidden gem", category: "attraction", title: "Shamian Island stroll", blurb: "Colonial mansions and shaded benches. Photographer favourite.", meta: "Liwan · free", rating: 4.7, accent: "amber" },
      { tag: "Trending now", title: "Beijing Lu food street", blurb: "Egg waffles and milk tea. Locals are queuing this week.", meta: "Yuexiu · ¥", rating: 4.5, accent: "violet" },
    ],
  },
  {
    id: "shenzhen",
    name: "Shenzhen",
    nameZh: "深圳",
    center: [22.5431, 114.0579],
    brief: { weather: "26°C · Partly cloudy", weatherHint: "Light layer for breeze", air: "AQI 48", airHint: "Good", crowd: "Low", crowdHint: "Galleries 1–8pm", tickerWeather: "26° clouds", tickerCrowd: "OCT Loft · calm", signatureSpot: "OCT Loft" },
    places: [
      { id: "oct-loft", coords: [22.5535, 113.9851], name: "OCT-Loft Creative Park", nameZh: "华侨城创意园", pinyin: "Huá qiáo chéng", category: "sights", address: "Nanshan", addressZh: "南山区", blurb: "Galleries, indie cafes, designer shops." },
      { id: "windows-of-world", coords: [22.5350, 113.9740], name: "Window of the World", nameZh: "世界之窗", pinyin: "Shì jiè zhī chuāng", category: "sights", address: "Nanshan", addressZh: "南山区", blurb: "Theme park with mini world landmarks." },
      { id: "huangbeiling-noodles", coords: [22.5611, 114.1318], name: "Huangbeiling Hot Pot", nameZh: "黄贝岭老火锅", pinyin: "Huáng bèi lǐng", category: "food", address: "Luohu", addressZh: "罗湖区", blurb: "Sichuan hot pot favourite — late night queue." },
      { id: "ccb-atm-futian", coords: [22.5400, 114.0590], name: "CCB ATM · Futian", nameZh: "建设银行 ATM", pinyin: "Jiàn shè yín háng", category: "atm", address: "Futian CBD", addressZh: "福田中心区", blurb: "Visa/Mastercard, English UI." },
      { id: "futian-station", coords: [22.5360, 114.0590], name: "Futian Station", nameZh: "福田地铁站", pinyin: "Fú tián", category: "subway", address: "Line 2, 3, 11 interchange", addressZh: "2/3/11号线换乘", blurb: "HSR to Hong Kong West Kowloon in 14 min." },
    ],
    picks: [
      { tag: "Hidden gem", category: "gallery", title: "OCT-Loft gallery hop", blurb: "Free indie galleries + great brunch spots.", meta: "Metro Line 1 · free", rating: 4.7, accent: "violet" },
      { tag: "Local favourite", category: "bar", title: "Coco Park rooftop bars", blurb: "Cluster of rooftop bars with HK skyline views over the border.", meta: "Futian · ¥¥¥", rating: 4.5, accent: "cyan" },
      { tag: "Foodie pick", category: "restaurant", title: "Sea World seafood", blurb: "Pick your fish from the tanks — kitchens cook it to order.", meta: "Shekou · ¥¥¥", rating: 4.6, accent: "amber" },
      { tag: "Quiet now", category: "park", title: "Lianhua Mountain park", blurb: "Sunset over Futian skyline from the top.", meta: "Metro Line 4 · free", rating: 4.7, accent: "cyan" },
    ],
  },
  {
    id: "hangzhou",
    name: "Hangzhou",
    nameZh: "杭州",
    center: [30.2741, 120.1551],
    brief: { weather: "22°C · Mist over lake", weatherHint: "Umbrella for the mist", air: "AQI 50", airHint: "Good", crowd: "Medium", crowdHint: "Sunrise = quietest", tickerWeather: "22° misty", tickerCrowd: "West Lake · medium", signatureSpot: "West Lake" },
    places: [
      { id: "west-lake", coords: [30.2470, 120.1490], name: "West Lake", nameZh: "西湖", pinyin: "Xī hú", category: "sights", address: "Xihu District", addressZh: "西湖区", blurb: "UNESCO lake — walk Bai Causeway at sunrise." },
      { id: "lingyin-temple", coords: [30.2410, 120.0980], name: "Lingyin Temple", nameZh: "灵隐寺", pinyin: "Líng yǐn sì", category: "sights", address: "Feilai Feng", addressZh: "飞来峰", blurb: "Ancient Buddhist temple in a forested valley." },
      { id: "louwailou", coords: [30.2552, 120.1478], name: "Lou Wai Lou (Hangzhou cuisine)", nameZh: "楼外楼", pinyin: "Lóu wài lóu", category: "food", address: "Gushan Rd, by West Lake", addressZh: "孤山路", blurb: "Iconic restaurant — try the West Lake fish." },
      { id: "icbc-atm-hubin", coords: [30.2540, 120.1640], name: "ICBC ATM · Hubin", nameZh: "工商银行 ATM", pinyin: "Gōng shāng yín háng", category: "atm", address: "Hubin Pedestrian Rd", addressZh: "湖滨步行街", blurb: "Visa/Mastercard, English UI." },
      { id: "longxiangqiao-station", coords: [30.2530, 120.1670], name: "Longxiangqiao Station", nameZh: "龙翔桥地铁站", pinyin: "Lóng xiáng qiáo", category: "subway", address: "Line 1, near West Lake", addressZh: "1号线 西湖东侧", blurb: "Closest metro to West Lake east side." },
    ],
    picks: [
      { tag: "Must-see", category: "attraction", title: "West Lake sunrise walk", blurb: "Bai Causeway at 6am — mist and morning tai chi.", meta: "Free · 1hr", rating: 4.9, accent: "cyan" },
      { tag: "Foodie pick", category: "restaurant", title: "Lou Wai Lou — West Lake fish", blurb: "Lake-view tables — ask for a window seat near sunset.", meta: "By Gushan · ¥¥¥", rating: 4.7, accent: "violet" },
      { tag: "Hidden gem", title: "Longjing tea fields", blurb: "Walk through Meijiawu — buy tea straight from farmers.", meta: "West of West Lake · ¥¥", rating: 4.8, accent: "amber" },
      { tag: "Quiet now", category: "temple", title: "Lingyin Temple morning", blurb: "Calm forest paths before tour buses arrive.", meta: "Bus Y2 · ¥30", rating: 4.7, accent: "cyan" },
    ],
  },
  {
    id: "suzhou",
    name: "Suzhou",
    nameZh: "苏州",
    center: [31.2989, 120.5853],
    brief: { weather: "21°C · Soft rain", weatherHint: "Romantic in the gardens — bring umbrella", air: "AQI 52", airHint: "Good", crowd: "Humble Garden · Low", crowdHint: "Calm in light rain — perfect garden day", tickerWeather: "21° drizzle", tickerCrowd: "Gardens · calm", signatureSpot: "Humble Administrator's Garden" },
    places: [
      { id: "humble-garden", coords: [31.3253, 120.6325], name: "Humble Administrator's Garden", nameZh: "拙政园", pinyin: "Zhuō zhèng yuán", category: "sights", address: "178 Dongbei St", addressZh: "东北街178号", blurb: "Largest classical garden in Suzhou. UNESCO." },
      { id: "pingjiang-road", coords: [31.3210, 120.6280], name: "Pingjiang Historic Street", nameZh: "平江路历史街区", pinyin: "Píng jiāng lù", category: "sights", address: "Gusu District", addressZh: "姑苏区", blurb: "Canal-side lanes, teahouses, pingtan music." },
      { id: "songhelou", coords: [31.3115, 120.6193], name: "Songhelou (Suzhou cuisine)", nameZh: "松鹤楼", pinyin: "Sōng hè lóu", category: "food", address: "Taijian Lane", addressZh: "太监弄", blurb: "Sweet & sour mandarin fish — local classic." },
      { id: "boc-atm-guanqian", coords: [31.3115, 120.6196], name: "Bank of China ATM · Guanqian", nameZh: "中国银行 ATM", pinyin: "Zhōng guó yín háng", category: "atm", address: "Guanqian St", addressZh: "观前街", blurb: "Visa/Mastercard, English UI." },
      { id: "leqiao-station", coords: [31.3045, 120.6173], name: "Leqiao Station", nameZh: "乐桥地铁站", pinyin: "Lè qiáo", category: "subway", address: "Line 1 & 4 interchange", addressZh: "1号线/4号线换乘", blurb: "Central interchange near old town." },
    ],
    picks: [
      { tag: "Must-see", category: "park", title: "Humble Administrator's Garden", blurb: "Go at opening — first hour is meditative.", meta: "8 min walk · ¥70", rating: 4.9, accent: "cyan" },
      { tag: "Hidden gem", category: "attraction", title: "Pingjiang canal walk", blurb: "Lantern-lit at dusk — stop at a teahouse to catch pingtan storytelling.", meta: "Free · ¥¥ tea", rating: 4.8, accent: "violet" },
      { tag: "Foodie pick", category: "restaurant", title: "Songhelou — squirrel fish", blurb: "The sweet-and-sour mandarin fish is the Suzhou classic to order.", meta: "Taijian Lane · ¥¥¥", rating: 4.6, accent: "amber" },
      { tag: "Sunset", category: "attraction", title: "Tiger Hill at sunset", blurb: "Leaning pagoda lit in golden-hour light.", meta: "North-west Suzhou · ¥80", rating: 4.7, accent: "cyan" },
    ],
  },
  {
    id: "nanjing",
    name: "Nanjing",
    nameZh: "南京",
    center: [32.0603, 118.7969],
    brief: { weather: "20°C · Clear", weatherHint: "Crisp — perfect for hill temples", air: "AQI 60", airHint: "Acceptable", crowd: "Confucius Temple · Medium", crowdHint: "Evenings buzz with lanterns", tickerWeather: "20° clear", tickerCrowd: "Fuzimiao · medium", signatureSpot: "the Confucius Temple" },
    places: [
      { id: "confucius-temple", coords: [32.0185, 118.7896], name: "Confucius Temple (Fuzimiao)", nameZh: "夫子庙", pinyin: "Fū zǐ miào", category: "sights", address: "Qinhuai District", addressZh: "秦淮区", blurb: "Lantern-lit historic district along the Qinhuai river." },
      { id: "sun-yat-sen-mausoleum", coords: [32.0606, 118.8517], name: "Sun Yat-sen Mausoleum", nameZh: "中山陵", pinyin: "Zhōng shān líng", category: "sights", address: "Purple Mountain", addressZh: "紫金山", blurb: "Marble steps up a forested mountain." },
      { id: "duck-blood-noodles", coords: [32.0190, 118.7940], name: "Duck Blood Soup · Fuzimiao", nameZh: "鸭血粉丝汤", pinyin: "Yā xuě fěn sī tāng", category: "food", address: "Fuzimiao food street", addressZh: "夫子庙小吃街", blurb: "Local specialty — savoury and warming." },
      { id: "icbc-atm-xinjiekou", coords: [32.0410, 118.7785], name: "ICBC ATM · Xinjiekou", nameZh: "工商银行 ATM", pinyin: "Gōng shāng yín háng", category: "atm", address: "Xinjiekou", addressZh: "新街口", blurb: "Visa/Mastercard accepted." },
      { id: "xinjiekou-station", coords: [32.0408, 118.7783], name: "Xinjiekou Station", nameZh: "新街口地铁站", pinyin: "Xīn jiē kǒu", category: "subway", address: "Line 1 & 2 interchange", addressZh: "1号线/2号线换乘", blurb: "Largest underground hub in Asia." },
    ],
    picks: [
      { tag: "Must-see", category: "attraction", title: "Fuzimiao lantern night", blurb: "Boats on Qinhuai river — book a 7pm cruise.", meta: "Metro Line 3 · ¥80", rating: 4.7, accent: "cyan" },
      { tag: "Hidden gem", category: "attraction", title: "Purple Mountain hike", blurb: "Stone-paved path past the mausoleum, finish at the observatory.", meta: "Allow 4hr · free", rating: 4.8, accent: "violet" },
      { tag: "Foodie pick", category: "restaurant", title: "Duck blood vermicelli soup", blurb: "Local breakfast staple. Try Yi Pin Dan in Fuzimiao.", meta: "¥15 · cash", rating: 4.5, accent: "amber" },
      { tag: "Quiet now", category: "attraction", title: "Ming City Wall walk", blurb: "Original Ming wall stretches — quiet at sunset.", meta: "Zhonghua Gate · ¥50", rating: 4.7, accent: "cyan" },
    ],
  },
  {
    id: "chongqing",
    name: "Chongqing",
    nameZh: "重庆",
    center: [29.5630, 106.5516],
    brief: { weather: "24°C · Foggy", weatherHint: "Hilly + humid — comfy shoes essential", air: "AQI 70", airHint: "Moderate", crowd: "Hongya Cave · High", crowdHint: "Light show at 7pm draws crowds", tickerWeather: "24° foggy", tickerCrowd: "Hongya · packed", signatureSpot: "Hongya Cave" },
    places: [
      { id: "hongya-cave", coords: [29.5620, 106.5836], name: "Hongya Cave", nameZh: "洪崖洞", pinyin: "Hóng yá dòng", category: "sights", address: "Yuzhong District", addressZh: "渝中区", blurb: "11-storey stilt complex glowing at night." },
      { id: "ciqikou", coords: [29.5666, 106.4546], name: "Ciqikou Ancient Town", nameZh: "磁器口古镇", pinyin: "Cí qì kǒu", category: "sights", address: "Shapingba", addressZh: "沙坪坝区", blurb: "Cobbled lanes, snacks, riverfront views." },
      { id: "liuyishou-hotpot", coords: [29.5570, 106.5790], name: "Liuyishou Hot Pot (original)", nameZh: "刘一手火锅", pinyin: "Liú yī shǒu", category: "food", address: "Yuzhong", addressZh: "渝中区", blurb: "Numbing-spicy Sichuan hot pot. AI orders mild side." },
      { id: "ccb-atm-jiefangbei", coords: [29.5577, 106.5780], name: "CCB ATM · Jiefangbei", nameZh: "建设银行 ATM", pinyin: "Jiàn shè yín háng", category: "atm", address: "Jiefangbei CBD", addressZh: "解放碑", blurb: "Visa/Mastercard, English UI." },
      { id: "jiaochangkou-station", coords: [29.5582, 106.5763], name: "Jiaochangkou Station", nameZh: "较场口地铁站", pinyin: "Jiào chǎng kǒu", category: "subway", address: "Line 1 & 2 interchange", addressZh: "1号线/2号线换乘", blurb: "Closest stop to Hongya Cave & Jiefangbei." },
    ],
    picks: [
      { tag: "Skyline view", title: "Hongya Cave at 7pm", blurb: "Lights flick on across all 11 floors — Studio Ghibli vibe.", meta: "Free · busy", rating: 4.8, accent: "cyan" },
      { tag: "Foodie pick", category: "restaurant", title: "Authentic hot pot crawl", blurb: "Work your way from mild to numbing across a few neighbourhood spots.", meta: "Yuzhong · ¥¥", rating: 4.9, accent: "violet" },
      { tag: "Hidden gem", category: "attraction", title: "Liziba metro through building", blurb: "Yes, the metro really runs through a tower. Best 4pm.", meta: "Line 2 · ¥3", rating: 4.7, accent: "amber" },
      { tag: "Trending now", category: "view", title: "Yangtze cable car", blurb: "Crosses the river — quietest at noon.", meta: "Yuzhong → Nan'an · ¥30", rating: 4.6, accent: "cyan" },
    ],
  },
  {
    id: "guilin",
    name: "Guilin",
    nameZh: "桂林",
    center: [25.2736, 110.2900],
    brief: { weather: "23°C · Clear", weatherHint: "Karst river day — sunscreen & water", air: "AQI 38", airHint: "Excellent", crowd: "Li River · Medium", crowdHint: "Boats fill 9am — go on the 7am slot", tickerWeather: "23° clear", tickerCrowd: "Li River · medium", signatureSpot: "the Li River" },
    places: [
      { id: "li-river", coords: [25.0500, 110.4000], name: "Li River cruise dock", nameZh: "漓江码头", pinyin: "Lí jiāng", category: "sights", address: "Zhujiang Pier", addressZh: "竹江码头", blurb: "Cruise through karst mountains to Yangshuo." },
      { id: "elephant-trunk-hill", coords: [25.2613, 110.2978], name: "Elephant Trunk Hill", nameZh: "象鼻山", pinyin: "Xiàng bí shān", category: "sights", address: "Xiufeng District", addressZh: "秀峰区", blurb: "Iconic karst arch — symbol of Guilin." },
      { id: "guilin-rice-noodles", coords: [25.2790, 110.2890], name: "Chongshan Rice Noodles", nameZh: "崇善米粉", pinyin: "Chóng shàn mǐ fěn", category: "food", address: "Zhongshan Rd", addressZh: "中山中路", blurb: "Local breakfast standard. ¥10 a bowl." },
      { id: "boc-atm-guilin", coords: [25.2820, 110.2920], name: "Bank of China ATM · Zhongshan", nameZh: "中国银行 ATM", pinyin: "Zhōng guó yín háng", category: "atm", address: "Zhongshan Middle Rd", addressZh: "中山中路", blurb: "Visa/Mastercard accepted." },
      { id: "guilin-train-station", coords: [25.2603, 110.2920], name: "Guilin Train Station", nameZh: "桂林站", pinyin: "Guì lín zhàn", category: "subway", address: "Central Guilin", addressZh: "桂林市中心", blurb: "HSR + regular trains. No metro yet — taxis are easy." },
    ],
    picks: [
      { tag: "Must-see", category: "attraction", title: "Li River cruise to Yangshuo", blurb: "The 9am scenic slot is the classic 4hr karst journey downriver.", meta: "Allow full day · ¥¥¥", rating: 4.9, accent: "cyan" },
      { tag: "Hidden gem", category: "attraction", title: "Yangshuo bamboo raft", blurb: "Quieter Yulong tributary — drift through rice fields and karst peaks.", meta: "Yangshuo County · ¥¥", rating: 4.8, accent: "violet" },
      { tag: "Foodie pick", category: "restaurant", title: "Beer fish in Yangshuo", blurb: "Local Li River fish stewed with beer. Try Cui's.", meta: "West Street · ¥¥", rating: 4.6, accent: "amber" },
      { tag: "Quiet now", category: "attraction", title: "Reed Flute Cave", blurb: "Coloured limestone caverns. Quiet 2–4pm.", meta: "DiDi 15 min · ¥120", rating: 4.7, accent: "cyan" },
    ],
  },
  {
    id: "hong-kong",
    name: "Hong Kong",
    nameZh: "香港",
    center: [22.3193, 114.1694],
    brief: { weather: "25°C · Humid sun", weatherHint: "AC everywhere — light layer for restaurants", air: "AQI 55", airHint: "Acceptable", crowd: "Victoria Peak · Medium", crowdHint: "Sunset is busiest — go up at 4pm", tickerWeather: "25° humid", tickerCrowd: "Victoria Peak · medium", signatureSpot: "Victoria Peak" },
    places: [
      { id: "victoria-peak", coords: [22.2759, 114.1455], name: "Victoria Peak", nameZh: "太平山顶", pinyin: "Tài píng shān", category: "sights", address: "The Peak, HK Island", addressZh: "香港岛 太平山顶", blurb: "Iconic skyline view. Take the Peak Tram up." },
      { id: "tsim-sha-tsui-promenade", coords: [22.2940, 114.1722], name: "Tsim Sha Tsui Promenade", nameZh: "尖沙咀海滨长廊", pinyin: "Jiān shā jǔ", category: "sights", address: "Kowloon waterfront", addressZh: "九龙海滨", blurb: "Best skyline view across the harbour." },
      { id: "tim-ho-wan", coords: [22.3050, 114.1700], name: "Tim Ho Wan (dim sum)", nameZh: "添好运", pinyin: "Tiān hǎo yùn", category: "food", address: "Sham Shui Po (original)", addressZh: "深水埗", blurb: "Michelin-starred dim sum. BBQ pork buns are legendary." },
      { id: "hsbc-atm-central", coords: [22.2840, 114.1582], name: "HSBC ATM · Central", nameZh: "汇丰银行 ATM", pinyin: "Huì fēng yín háng", category: "atm", address: "1 Queen's Rd Central", addressZh: "中环皇后大道中1号", blurb: "Free for HSBC cards globally. English." },
      { id: "central-station", coords: [22.2820, 114.1580], name: "Central Station", nameZh: "中环站", pinyin: "Zhōng huán", category: "subway", address: "MTR Island Line", addressZh: "港铁港岛线", blurb: "Hub for Star Ferry + airport express." },
    ],
    picks: [
      { tag: "Must-see", category: "attraction", title: "Star Ferry · sunset crossing", blurb: "HK$5 ride between Central and TST. Best 6pm.", meta: "Daily · ferry", rating: 4.9, accent: "cyan" },
      { tag: "Skyline view", category: "view", title: "Victoria Peak walk", blurb: "Take Peak Tram up, walk Lugard Rd loop.", meta: "Tram + 1hr loop", rating: 4.8, accent: "violet" },
      { tag: "Foodie pick", category: "restaurant", title: "Tim Ho Wan dim sum", blurb: "Michelin-starred — the baked BBQ pork buns are the signature order.", meta: "Sham Shui Po · HK$$", rating: 4.7, accent: "amber" },
      { tag: "Hidden gem", category: "shopping", title: "PMQ creative quarter", blurb: "Indie designers, rooftop garden, free entry.", meta: "Central · free", rating: 4.6, accent: "cyan" },
    ],
  },
];

export const DEFAULT_CITY = CITIES[0];

export const getCityById = (id: string): CityData =>
  CITIES.find((c) => c.id === id) ?? DEFAULT_CITY;