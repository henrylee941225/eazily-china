export type QuickPhrase = { en: string; zh: string; pinyin: string };
export type QuickPhraseCategory = {
  key: "dining" | "taxi" | "shopping" | "pharmacy";
  label: string;
  phrases: QuickPhrase[];
};

export const QUICK_PHRASE_CATEGORIES: QuickPhraseCategory[] = [
  {
    key: "dining",
    label: "Dining",
    phrases: [
      { en: "A table for two, please",       zh: "两位，谢谢",         pinyin: "Liǎng wèi, xièxie" },
      { en: "Not too spicy, please",         zh: "请不要太辣",         pinyin: "Qǐng búyào tài là" },
      { en: "Do you have an English menu?",  zh: "有英文菜单吗？",     pinyin: "Yǒu yīngwén càidān ma?" },
      { en: "The bill, please",              zh: "买单",               pinyin: "Mǎidān" },
      { en: "I'm allergic to peanuts",       zh: "我对花生过敏",       pinyin: "Wǒ duì huāshēng guòmǐn" },
      { en: "Water, no ice please",          zh: "水，不要冰",         pinyin: "Shuǐ, búyào bīng" },
      { en: "Can I pay by Alipay?",          zh: "可以用支付宝吗？",   pinyin: "Kěyǐ yòng zhīfùbǎo ma?" },
      { en: "Delicious, thank you",          zh: "很好吃，谢谢",       pinyin: "Hěn hǎochī, xièxie" },
      { en: "I'm vegetarian",                zh: "我吃素",             pinyin: "Wǒ chī sù" },
    ],
  },
  {
    key: "taxi",
    label: "Taxi",
    phrases: [
      { en: "Please take me to this address", zh: "请带我去这个地址",   pinyin: "Qǐng dài wǒ qù zhège dìzhǐ" },
      { en: "How much will it cost?",         zh: "大概多少钱？",       pinyin: "Dàgài duōshǎo qián?" },
      { en: "Please use the meter",           zh: "请打表",             pinyin: "Qǐng dǎ biǎo" },
      { en: "Stop here, please",              zh: "在这里停，谢谢",     pinyin: "Zài zhèlǐ tíng, xièxie" },
      { en: "May I have a receipt?",          zh: "请给我发票",         pinyin: "Qǐng gěi wǒ fāpiào" },
      { en: "Please open the boot",           zh: "请打开后备箱",       pinyin: "Qǐng dǎkāi hòubèixiāng" },
      { en: "Please turn on the air-con",     zh: "请开空调",           pinyin: "Qǐng kāi kōngtiáo" },
      { en: "Please slow down",               zh: "请开慢一点",         pinyin: "Qǐng kāi màn yīdiǎn" },
    ],
  },
  {
    key: "shopping",
    label: "Shopping",
    phrases: [
      { en: "How much is this?",              zh: "这个多少钱？",       pinyin: "Zhège duōshǎo qián?" },
      { en: "Can you make it cheaper?",       zh: "可以便宜一点吗？",   pinyin: "Kěyǐ piányi yīdiǎn ma?" },
      { en: "Do you take card or mobile pay?",zh: "可以刷卡或手机支付吗？", pinyin: "Kěyǐ shuākǎ huò shǒujī zhīfù ma?" },
      { en: "I'll take this one",             zh: "我要这个",           pinyin: "Wǒ yào zhège" },
      { en: "Do you have a bigger size?",     zh: "有大一点的尺寸吗？", pinyin: "Yǒu dà yīdiǎn de chǐcùn ma?" },
      { en: "Do you have another colour?",    zh: "有别的颜色吗？",     pinyin: "Yǒu bié de yánsè ma?" },
      { en: "Can I try it on?",               zh: "可以试穿吗？",       pinyin: "Kěyǐ shìchuān ma?" },
      { en: "I'm just looking, thank you",    zh: "我随便看看，谢谢",   pinyin: "Wǒ suíbiàn kànkan, xièxie" },
    ],
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    phrases: [
      { en: "I have a headache",              zh: "我头痛",             pinyin: "Wǒ tóu tòng" },
      { en: "I have a fever",                 zh: "我发烧",             pinyin: "Wǒ fāshāo" },
      { en: "I have a sore throat",           zh: "我喉咙痛",           pinyin: "Wǒ hóulóng tòng" },
      { en: "I have a stomach ache",          zh: "我肚子痛",           pinyin: "Wǒ dùzi tòng" },
      { en: "Do you have pain relief?",       zh: "有止痛药吗？",       pinyin: "Yǒu zhǐtòngyào ma?" },
      { en: "Do you have cold medicine?",     zh: "有感冒药吗？",       pinyin: "Yǒu gǎnmàoyào ma?" },
      { en: "I'm allergic to penicillin",     zh: "我对青霉素过敏",     pinyin: "Wǒ duì qīngméisù guòmǐn" },
      { en: "Is this available without a prescription?", zh: "这个不用处方吗？", pinyin: "Zhège búyòng chǔfāng ma?" },
    ],
  },
];