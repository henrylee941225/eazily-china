// Translation languages.
//
// Providers actually used by this app:
//  - Text translation: Baidu Translate (edge function `translate`). Codes are
//    Baidu's own non-standard codes (jp, kor, spa, fra, ara, cht, rom, slo,
//    vie, ...) because they are what the API accepts.
//  - Speech recognition (Talk mode): audio goes to the `transcribe` edge
//    function (gpt-4o-mini-transcribe).
//  - Image OCR (Camera mode): Gemini via the Lovable AI gateway
//    (`translate-image`).
//
// IMPORTANT — all 200 entries below are Baidu's full documented set, but only
// 28 of them are actually enabled on our Baidu account tier. The other 172
// return upstream error 58001 (unsupported language pair), so they carry
// supportsText: false. They are kept in this file deliberately: if the account
// is upgraded, enabling them is a flag flip rather than another research pass.
//
// Talk and Camera both translate through the same Baidu endpoint, so
// supportsSpeech and supportsOCR are never true where supportsText is false —
// a language that transcribes but can't translate is a dead end.
//
// Flag counts: text 28, speech 27, OCR 27.


export type LanguageCode =
  | "zh" | "cht" | "yue" | "wyw" | "en" | "jp" | "kor" | "fra" | "frn" | "frm" | "spa" | "th"
  | "ara" | "arq" | "tua" | "ru" | "pt" | "pot" | "de" | "log" | "it" | "el" | "gra" | "nl"
  | "pl" | "bul" | "est" | "dan" | "fin" | "cs" | "rom" | "slo" | "sk" | "swe" | "hu" | "vie"
  | "tr" | "ukr" | "bel" | "hrv" | "srp" | "src" | "bos" | "mot" | "mac" | "alb" | "lav"
  | "lit" | "lag" | "ice" | "fao" | "nor" | "nob" | "nno" | "gle" | "gla" | "wel" | "cor"
  | "bre" | "glv" | "cat" | "baq" | "glg" | "ast" | "arg" | "oci" | "wln" | "srd" | "cos"
  | "nea" | "fri" | "roh" | "lim" | "fry" | "ltz" | "lat" | "eno" | "sil" | "kah" | "ups"
  | "los" | "ruy" | "ro" | "chv" | "bak" | "tat" | "cri" | "aze" | "kir" | "tuk" | "hi" | "urd"
  | "ben" | "pan" | "guj" | "mar" | "nep" | "sin" | "tam" | "tel" | "kan" | "mal" | "ori"
  | "asm" | "snd" | "kas" | "san" | "mai" | "bho" | "kok" | "div" | "per" | "pus" | "kur"
  | "bal" | "ir" | "oss" | "tgk" | "arm" | "geo" | "heb" | "yid" | "syr" | "amh" | "tir"
  | "bli" | "orm" | "som" | "swa" | "afr" | "xho" | "zul" | "sot" | "ped" | "nbl" | "tso"
  | "ven" | "sna" | "nya" | "bem" | "lug" | "kin" | "lin" | "kon" | "ful" | "hau" | "ibo"
  | "yor" | "twi" | "aka" | "wol" | "kau" | "kab" | "ber" | "sol" | "nqo" | "mg" | "mau" | "ht"
  | "pap" | "may" | "id" | "jav" | "sun" | "ach" | "fil" | "tgl" | "ceb" | "hil" | "pam"
  | "bur" | "hkm" | "lao" | "sha" | "hak" | "hmn" | "tet" | "bis" | "mah" | "sm" | "mao"
  | "haw" | "grn" | "aym" | "que" | "chr" | "cre" | "oji" | "hup" | "iku" | "kal" | "sme"
  | "ing" | "zaz" | "epo" | "ido" | "ina" | "loj" | "kli" | "mlt";

export type Language = {
  /** Baidu Translate code — the code every edge function expects. */
  code: LanguageCode;
  /** ISO-639-1 code, or "" when the language has none. */
  iso639_1: string;
  /** BCP-47 locale for speechSynthesis. */
  bcp47: string;
  englishName: string;
  nativeName: string;
  supportsText: boolean;
  supportsSpeech: boolean;
  supportsOCR: boolean;
  rtl: boolean;
};

export const LANGUAGES: Language[] = [
  { code: "zh",  iso639_1: "zh",  bcp47: "zh-CN",   englishName: "Chinese (Simplified)", nativeName: "简体中文", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "cht", iso639_1: "zh",  bcp47: "zh-TW",   englishName: "Chinese (Traditional)", nativeName: "繁體中文", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "yue", iso639_1: "zh",  bcp47: "zh-HK",   englishName: "Cantonese", nativeName: "粵語", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "wyw", iso639_1: "",    bcp47: "zh-CN",   englishName: "Classical Chinese", nativeName: "文言文", supportsText: true, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "en",  iso639_1: "en",  bcp47: "en-US",   englishName: "English", nativeName: "English", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "jp",  iso639_1: "ja",  bcp47: "ja-JP",   englishName: "Japanese", nativeName: "日本語", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "kor", iso639_1: "ko",  bcp47: "ko-KR",   englishName: "Korean", nativeName: "한국어", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "fra", iso639_1: "fr",  bcp47: "fr-FR",   englishName: "French", nativeName: "Français", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "frn", iso639_1: "fr",  bcp47: "fr-CA",   englishName: "French (Canada)", nativeName: "Français canadien", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "frm", iso639_1: "",    bcp47: "en-US",   englishName: "Middle French", nativeName: "Moyen français", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "spa", iso639_1: "es",  bcp47: "es-ES",   englishName: "Spanish", nativeName: "Español", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "th",  iso639_1: "th",  bcp47: "th-TH",   englishName: "Thai", nativeName: "ไทย", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "ara", iso639_1: "ar",  bcp47: "ar-SA",   englishName: "Arabic", nativeName: "العربية", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: true },
  { code: "arq", iso639_1: "ar",  bcp47: "ar-SA",   englishName: "Arabic (Algerian)", nativeName: "العربية الجزائرية", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "tua", iso639_1: "ar",  bcp47: "ar-SA",   englishName: "Arabic (Tunisian)", nativeName: "العربية التونسية", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "ru",  iso639_1: "ru",  bcp47: "ru-RU",   englishName: "Russian", nativeName: "Русский", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "pt",  iso639_1: "pt",  bcp47: "pt-PT",   englishName: "Portuguese", nativeName: "Português", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "pot", iso639_1: "pt",  bcp47: "pt-BR",   englishName: "Portuguese (Brazil)", nativeName: "Português do Brasil", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "de",  iso639_1: "de",  bcp47: "de-DE",   englishName: "German", nativeName: "Deutsch", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "log", iso639_1: "",    bcp47: "en-US",   englishName: "Low German", nativeName: "Plattdüütsch", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "it",  iso639_1: "it",  bcp47: "it-IT",   englishName: "Italian", nativeName: "Italiano", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "el",  iso639_1: "el",  bcp47: "el-GR",   englishName: "Greek", nativeName: "Ελληνικά", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "gra", iso639_1: "",    bcp47: "en-US",   englishName: "Ancient Greek", nativeName: "Ἀρχαία ἑλληνική", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "nl",  iso639_1: "nl",  bcp47: "nl-NL",   englishName: "Dutch", nativeName: "Nederlands", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "pl",  iso639_1: "pl",  bcp47: "pl-PL",   englishName: "Polish", nativeName: "Polski", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "bul", iso639_1: "bg",  bcp47: "bg-BG",   englishName: "Bulgarian", nativeName: "Български", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "est", iso639_1: "et",  bcp47: "et-EE",   englishName: "Estonian", nativeName: "Eesti", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "dan", iso639_1: "da",  bcp47: "da-DK",   englishName: "Danish", nativeName: "Dansk", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "fin", iso639_1: "fi",  bcp47: "fi-FI",   englishName: "Finnish", nativeName: "Suomi", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "cs",  iso639_1: "cs",  bcp47: "cs-CZ",   englishName: "Czech", nativeName: "Čeština", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "rom", iso639_1: "ro",  bcp47: "ro-RO",   englishName: "Romanian", nativeName: "Română", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "slo", iso639_1: "sl",  bcp47: "sl-SI",   englishName: "Slovenian", nativeName: "Slovenščina", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "sk",  iso639_1: "sk",  bcp47: "sk-SK",   englishName: "Slovak", nativeName: "Slovenčina", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "swe", iso639_1: "sv",  bcp47: "sv-SE",   englishName: "Swedish", nativeName: "Svenska", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "hu",  iso639_1: "hu",  bcp47: "hu-HU",   englishName: "Hungarian", nativeName: "Magyar", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "vie", iso639_1: "vi",  bcp47: "vi-VN",   englishName: "Vietnamese", nativeName: "Tiếng Việt", supportsText: true, supportsSpeech: true, supportsOCR: true, rtl: false },
  { code: "tr",  iso639_1: "tr",  bcp47: "tr-TR",   englishName: "Turkish", nativeName: "Türkçe", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ukr", iso639_1: "uk",  bcp47: "uk-UA",   englishName: "Ukrainian", nativeName: "Українська", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "bel", iso639_1: "be",  bcp47: "be",      englishName: "Belarusian", nativeName: "Беларуская", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "hrv", iso639_1: "hr",  bcp47: "hr-HR",   englishName: "Croatian", nativeName: "Hrvatski", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "srp", iso639_1: "sr",  bcp47: "sr-RS",   englishName: "Serbian", nativeName: "Српски", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "src", iso639_1: "sr",  bcp47: "sr-RS",   englishName: "Serbian (Cyrillic)", nativeName: "Српски (ћирилица)", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "bos", iso639_1: "bs",  bcp47: "bs",      englishName: "Bosnian", nativeName: "Bosanski", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "mot", iso639_1: "sr",  bcp47: "sr-RS",   englishName: "Montenegrin", nativeName: "Crnogorski", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "mac", iso639_1: "mk",  bcp47: "mk",      englishName: "Macedonian", nativeName: "Македонски", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "alb", iso639_1: "sq",  bcp47: "sq",      englishName: "Albanian", nativeName: "Shqip", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "lav", iso639_1: "lv",  bcp47: "lv-LV",   englishName: "Latvian", nativeName: "Latviešu", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "lit", iso639_1: "lt",  bcp47: "lt-LT",   englishName: "Lithuanian", nativeName: "Lietuvių", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "lag", iso639_1: "",    bcp47: "en-US",   englishName: "Latgalian", nativeName: "Latgaliešu", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ice", iso639_1: "is",  bcp47: "is-IS",   englishName: "Icelandic", nativeName: "Íslenska", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "fao", iso639_1: "fo",  bcp47: "fo",      englishName: "Faroese", nativeName: "Føroyskt", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "nor", iso639_1: "no",  bcp47: "nb-NO",   englishName: "Norwegian", nativeName: "Norsk", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "nob", iso639_1: "no",  bcp47: "nb-NO",   englishName: "Norwegian Bokmål", nativeName: "Norsk bokmål", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "nno", iso639_1: "nn",  bcp47: "nn-NO",   englishName: "Norwegian Nynorsk", nativeName: "Nynorsk", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "gle", iso639_1: "ga",  bcp47: "ga",      englishName: "Irish", nativeName: "Gaeilge", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "gla", iso639_1: "gd",  bcp47: "gd",      englishName: "Scottish Gaelic", nativeName: "Gàidhlig", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "wel", iso639_1: "cy",  bcp47: "cy",      englishName: "Welsh", nativeName: "Cymraeg", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "cor", iso639_1: "kw",  bcp47: "kw",      englishName: "Cornish", nativeName: "Kernewek", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "bre", iso639_1: "br",  bcp47: "br",      englishName: "Breton", nativeName: "Brezhoneg", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "glv", iso639_1: "gv",  bcp47: "gv",      englishName: "Manx", nativeName: "Gaelg", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "cat", iso639_1: "ca",  bcp47: "ca-ES",   englishName: "Catalan", nativeName: "Català", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "baq", iso639_1: "eu",  bcp47: "eu",      englishName: "Basque", nativeName: "Euskara", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "glg", iso639_1: "gl",  bcp47: "gl",      englishName: "Galician", nativeName: "Galego", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ast", iso639_1: "",    bcp47: "en-US",   englishName: "Asturian", nativeName: "Asturianu", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "arg", iso639_1: "an",  bcp47: "an",      englishName: "Aragonese", nativeName: "Aragonés", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "oci", iso639_1: "oc",  bcp47: "oc",      englishName: "Occitan", nativeName: "Occitan", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "wln", iso639_1: "wa",  bcp47: "wa",      englishName: "Walloon", nativeName: "Walon", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "srd", iso639_1: "sc",  bcp47: "sc",      englishName: "Sardinian", nativeName: "Sardu", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "cos", iso639_1: "co",  bcp47: "co",      englishName: "Corsican", nativeName: "Corsu", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "nea", iso639_1: "",    bcp47: "en-US",   englishName: "Neapolitan", nativeName: "Napulitano", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "fri", iso639_1: "fur", bcp47: "fur",     englishName: "Friulian", nativeName: "Furlan", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "roh", iso639_1: "rm",  bcp47: "rm",      englishName: "Romansh", nativeName: "Rumantsch", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "lim", iso639_1: "li",  bcp47: "li",      englishName: "Limburgish", nativeName: "Limburgs", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "fry", iso639_1: "fy",  bcp47: "fy",      englishName: "Western Frisian", nativeName: "Frysk", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ltz", iso639_1: "lb",  bcp47: "lb",      englishName: "Luxembourgish", nativeName: "Lëtzebuergesch", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "lat", iso639_1: "la",  bcp47: "la",      englishName: "Latin", nativeName: "Latina", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "eno", iso639_1: "",    bcp47: "en-US",   englishName: "Old English", nativeName: "Englisc", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "sil", iso639_1: "",    bcp47: "en-US",   englishName: "Silesian", nativeName: "Ślōnski", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "kah", iso639_1: "",    bcp47: "en-US",   englishName: "Kashubian", nativeName: "Kaszëbsczi", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ups", iso639_1: "",    bcp47: "en-US",   englishName: "Upper Sorbian", nativeName: "Hornjoserbsce", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "los", iso639_1: "",    bcp47: "en-US",   englishName: "Lower Sorbian", nativeName: "Dolnoserbski", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ruy", iso639_1: "",    bcp47: "en-US",   englishName: "Rusyn", nativeName: "Русиньскый", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ro",  iso639_1: "",    bcp47: "en-US",   englishName: "Romani", nativeName: "Romani čhib", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "chv", iso639_1: "cv",  bcp47: "cv",      englishName: "Chuvash", nativeName: "Чӑвашла", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "bak", iso639_1: "ba",  bcp47: "ba",      englishName: "Bashkir", nativeName: "Башҡортса", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "tat", iso639_1: "tt",  bcp47: "tt",      englishName: "Tatar", nativeName: "Татарча", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "cri", iso639_1: "",    bcp47: "en-US",   englishName: "Crimean Tatar", nativeName: "Qırımtatarca", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "aze", iso639_1: "az",  bcp47: "az",      englishName: "Azerbaijani", nativeName: "Azərbaycanca", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "kir", iso639_1: "ky",  bcp47: "ky",      englishName: "Kyrgyz", nativeName: "Кыргызча", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "tuk", iso639_1: "tk",  bcp47: "tk",      englishName: "Turkmen", nativeName: "Türkmençe", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "hi",  iso639_1: "hi",  bcp47: "hi-IN",   englishName: "Hindi", nativeName: "हिन्दी", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "urd", iso639_1: "ur",  bcp47: "ur-PK",   englishName: "Urdu", nativeName: "اردو", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "ben", iso639_1: "bn",  bcp47: "bn-BD",   englishName: "Bengali", nativeName: "বাংলা", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "pan", iso639_1: "pa",  bcp47: "pa",      englishName: "Punjabi", nativeName: "ਪੰਜਾਬੀ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "guj", iso639_1: "gu",  bcp47: "gu",      englishName: "Gujarati", nativeName: "ગુજરાતી", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "mar", iso639_1: "mr",  bcp47: "mr",      englishName: "Marathi", nativeName: "मराठी", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "nep", iso639_1: "ne",  bcp47: "ne",      englishName: "Nepali", nativeName: "नेपाली", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "sin", iso639_1: "si",  bcp47: "si",      englishName: "Sinhala", nativeName: "සිංහල", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "tam", iso639_1: "ta",  bcp47: "ta-IN",   englishName: "Tamil", nativeName: "தமிழ்", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "tel", iso639_1: "te",  bcp47: "te-IN",   englishName: "Telugu", nativeName: "తెలుగు", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "kan", iso639_1: "kn",  bcp47: "kn",      englishName: "Kannada", nativeName: "ಕನ್ನಡ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "mal", iso639_1: "ml",  bcp47: "ml",      englishName: "Malayalam", nativeName: "മലയാളം", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ori", iso639_1: "or",  bcp47: "or",      englishName: "Odia", nativeName: "ଓଡ଼ିଆ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "asm", iso639_1: "as",  bcp47: "as",      englishName: "Assamese", nativeName: "অসমীয়া", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "snd", iso639_1: "sd",  bcp47: "sd",      englishName: "Sindhi", nativeName: "سنڌي", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "kas", iso639_1: "",    bcp47: "en-US",   englishName: "Kashmiri", nativeName: "کٲشُر", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "san", iso639_1: "sa",  bcp47: "sa",      englishName: "Sanskrit", nativeName: "संस्कृतम्", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "mai", iso639_1: "",    bcp47: "en-US",   englishName: "Maithili", nativeName: "मैथिली", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "bho", iso639_1: "",    bcp47: "en-US",   englishName: "Bhojpuri", nativeName: "भोजपुरी", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "kok", iso639_1: "",    bcp47: "en-US",   englishName: "Konkani", nativeName: "कोंकणी", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "div", iso639_1: "dv",  bcp47: "dv",      englishName: "Dhivehi", nativeName: "ދިވެހި", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "per", iso639_1: "fa",  bcp47: "fa-IR",   englishName: "Persian", nativeName: "فارسی", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "pus", iso639_1: "ps",  bcp47: "ps",      englishName: "Pashto", nativeName: "پښتو", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "kur", iso639_1: "ku",  bcp47: "ku",      englishName: "Kurdish", nativeName: "Kurdî", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "bal", iso639_1: "",    bcp47: "en-US",   englishName: "Balochi", nativeName: "بلۏچی", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "ir",  iso639_1: "",    bcp47: "en-US",   englishName: "Iranian", nativeName: "Iranian", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "oss", iso639_1: "os",  bcp47: "os",      englishName: "Ossetian", nativeName: "Ирон", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "tgk", iso639_1: "tg",  bcp47: "tg",      englishName: "Tajik", nativeName: "Тоҷикӣ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "arm", iso639_1: "hy",  bcp47: "hy",      englishName: "Armenian", nativeName: "Հայերեն", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "geo", iso639_1: "ka",  bcp47: "ka",      englishName: "Georgian", nativeName: "ქართული", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "heb", iso639_1: "he",  bcp47: "he-IL",   englishName: "Hebrew", nativeName: "עברית", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "yid", iso639_1: "yi",  bcp47: "yi",      englishName: "Yiddish", nativeName: "ייִדיש", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "syr", iso639_1: "",    bcp47: "en-US",   englishName: "Syriac", nativeName: "ܣܘܪܝܝܐ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "amh", iso639_1: "am",  bcp47: "am",      englishName: "Amharic", nativeName: "አማርኛ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "tir", iso639_1: "ti",  bcp47: "ti",      englishName: "Tigrinya", nativeName: "ትግርኛ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "bli", iso639_1: "",    bcp47: "en-US",   englishName: "Blin", nativeName: "ብሊና", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "orm", iso639_1: "om",  bcp47: "om",      englishName: "Oromo", nativeName: "Oromoo", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "som", iso639_1: "so",  bcp47: "so",      englishName: "Somali", nativeName: "Soomaali", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "swa", iso639_1: "sw",  bcp47: "sw-KE",   englishName: "Swahili", nativeName: "Kiswahili", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "afr", iso639_1: "af",  bcp47: "af-ZA",   englishName: "Afrikaans", nativeName: "Afrikaans", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "xho", iso639_1: "xh",  bcp47: "xh",      englishName: "Xhosa", nativeName: "isiXhosa", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "zul", iso639_1: "zu",  bcp47: "zu",      englishName: "Zulu", nativeName: "isiZulu", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "sot", iso639_1: "st",  bcp47: "st",      englishName: "Southern Sotho", nativeName: "Sesotho", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ped", iso639_1: "nso", bcp47: "nso",     englishName: "Northern Sotho", nativeName: "Sesotho sa Leboa", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "nbl", iso639_1: "nr",  bcp47: "nr",      englishName: "Southern Ndebele", nativeName: "isiNdebele", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "tso", iso639_1: "ts",  bcp47: "ts",      englishName: "Tsonga", nativeName: "Xitsonga", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ven", iso639_1: "ve",  bcp47: "ve",      englishName: "Venda", nativeName: "Tshivenḓa", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "sna", iso639_1: "sn",  bcp47: "sn",      englishName: "Shona", nativeName: "ChiShona", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "nya", iso639_1: "ny",  bcp47: "ny",      englishName: "Chichewa", nativeName: "Chichewa", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "bem", iso639_1: "",    bcp47: "en-US",   englishName: "Bemba", nativeName: "Ichibemba", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "lug", iso639_1: "lg",  bcp47: "lg",      englishName: "Luganda", nativeName: "Luganda", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "kin", iso639_1: "rw",  bcp47: "rw",      englishName: "Kinyarwanda", nativeName: "Ikinyarwanda", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "lin", iso639_1: "ln",  bcp47: "ln",      englishName: "Lingala", nativeName: "Lingála", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "kon", iso639_1: "kg",  bcp47: "kg",      englishName: "Kikongo", nativeName: "Kikongo", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ful", iso639_1: "ff",  bcp47: "ff",      englishName: "Fula", nativeName: "Fulfulde", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "hau", iso639_1: "ha",  bcp47: "ha",      englishName: "Hausa", nativeName: "Hausa", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ibo", iso639_1: "ig",  bcp47: "ig",      englishName: "Igbo", nativeName: "Igbo", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "yor", iso639_1: "yo",  bcp47: "yo",      englishName: "Yoruba", nativeName: "Yorùbá", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "twi", iso639_1: "tw",  bcp47: "tw",      englishName: "Twi", nativeName: "Twi", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "aka", iso639_1: "ak",  bcp47: "ak",      englishName: "Akan", nativeName: "Akan", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "wol", iso639_1: "wo",  bcp47: "wo",      englishName: "Wolof", nativeName: "Wolof", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "kau", iso639_1: "kr",  bcp47: "kr",      englishName: "Kanuri", nativeName: "Kanuri", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "kab", iso639_1: "",    bcp47: "en-US",   englishName: "Kabyle", nativeName: "Taqbaylit", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ber", iso639_1: "",    bcp47: "en-US",   englishName: "Berber", nativeName: "Tamaziɣt", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "sol", iso639_1: "",    bcp47: "en-US",   englishName: "Songhay", nativeName: "Soŋay", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "nqo", iso639_1: "",    bcp47: "en-US",   englishName: "N'Ko", nativeName: "ߒߞߏ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: true },
  { code: "mg",  iso639_1: "mg",  bcp47: "mg",      englishName: "Malagasy", nativeName: "Malagasy", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "mau", iso639_1: "",    bcp47: "en-US",   englishName: "Mauritian Creole", nativeName: "Kreol Morisien", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ht",  iso639_1: "ht",  bcp47: "ht",      englishName: "Haitian Creole", nativeName: "Kreyòl ayisyen", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "pap", iso639_1: "",    bcp47: "en-US",   englishName: "Papiamento", nativeName: "Papiamentu", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "may", iso639_1: "ms",  bcp47: "ms-MY",   englishName: "Malay", nativeName: "Bahasa Melayu", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "id",  iso639_1: "id",  bcp47: "id-ID",   englishName: "Indonesian", nativeName: "Bahasa Indonesia", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "jav", iso639_1: "jv",  bcp47: "jv",      englishName: "Javanese", nativeName: "Basa Jawa", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "sun", iso639_1: "su",  bcp47: "su",      englishName: "Sundanese", nativeName: "Basa Sunda", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ach", iso639_1: "",    bcp47: "en-US",   englishName: "Acehnese", nativeName: "Bahasa Acèh", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "fil", iso639_1: "tl",  bcp47: "fil-PH",  englishName: "Filipino", nativeName: "Filipino", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "tgl", iso639_1: "tl",  bcp47: "fil-PH",  englishName: "Tagalog", nativeName: "Tagalog", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ceb", iso639_1: "",    bcp47: "en-US",   englishName: "Cebuano", nativeName: "Cebuano", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "hil", iso639_1: "",    bcp47: "en-US",   englishName: "Hiligaynon", nativeName: "Hiligaynon", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "pam", iso639_1: "",    bcp47: "en-US",   englishName: "Kapampangan", nativeName: "Kapampangan", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "bur", iso639_1: "my",  bcp47: "my",      englishName: "Burmese", nativeName: "မြန်မာ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "hkm", iso639_1: "km",  bcp47: "km",      englishName: "Khmer", nativeName: "ភាសាខ្មែរ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "lao", iso639_1: "lo",  bcp47: "lo",      englishName: "Lao", nativeName: "ລາວ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "sha", iso639_1: "",    bcp47: "en-US",   englishName: "Shan", nativeName: "လိၵ်ႈတႆး", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "hak", iso639_1: "",    bcp47: "en-US",   englishName: "Hakha Chin", nativeName: "Laiholh", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "hmn", iso639_1: "",    bcp47: "en-US",   englishName: "Hmong", nativeName: "Hmoob", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "tet", iso639_1: "",    bcp47: "en-US",   englishName: "Tetum", nativeName: "Tetun", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "bis", iso639_1: "",    bcp47: "en-US",   englishName: "Bislama", nativeName: "Bislama", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "mah", iso639_1: "",    bcp47: "en-US",   englishName: "Marshallese", nativeName: "Kajin M̧ajeļ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "sm",  iso639_1: "sm",  bcp47: "sm",      englishName: "Samoan", nativeName: "Gagana Samoa", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "mao", iso639_1: "mi",  bcp47: "mi",      englishName: "Maori", nativeName: "Te Reo Māori", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "haw", iso639_1: "",    bcp47: "en-US",   englishName: "Hawaiian", nativeName: "ʻŌlelo Hawaiʻi", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "grn", iso639_1: "gn",  bcp47: "gn",      englishName: "Guarani", nativeName: "Avañeʼẽ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "aym", iso639_1: "ay",  bcp47: "ay",      englishName: "Aymara", nativeName: "Aymar aru", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "que", iso639_1: "qu",  bcp47: "qu",      englishName: "Quechua", nativeName: "Runa Simi", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "chr", iso639_1: "",    bcp47: "en-US",   englishName: "Cherokee", nativeName: "ᏣᎳᎩ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "cre", iso639_1: "",    bcp47: "en-US",   englishName: "Cree", nativeName: "ᓀᐦᐃᔭᐍᐏᐣ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "oji", iso639_1: "",    bcp47: "en-US",   englishName: "Ojibwe", nativeName: "Anishinaabemowin", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "hup", iso639_1: "",    bcp47: "en-US",   englishName: "Hupa", nativeName: "Na:tinixwe", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "iku", iso639_1: "iu",  bcp47: "iu",      englishName: "Inuktitut", nativeName: "ᐃᓄᒃᑎᑐᑦ", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "kal", iso639_1: "kl",  bcp47: "kl",      englishName: "Greenlandic", nativeName: "Kalaallisut", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "sme", iso639_1: "se",  bcp47: "se",      englishName: "Northern Sami", nativeName: "Davvisámegiella", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ing", iso639_1: "",    bcp47: "en-US",   englishName: "Ingush", nativeName: "ГӀалгӀай", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "zaz", iso639_1: "",    bcp47: "en-US",   englishName: "Zazaki", nativeName: "Zazakî", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "epo", iso639_1: "eo",  bcp47: "eo",      englishName: "Esperanto", nativeName: "Esperanto", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ido", iso639_1: "io",  bcp47: "io",      englishName: "Ido", nativeName: "Ido", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "ina", iso639_1: "ia",  bcp47: "ia",      englishName: "Interlingua", nativeName: "Interlingua", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "loj", iso639_1: "",    bcp47: "en-US",   englishName: "Lojban", nativeName: "Lojban", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "kli", iso639_1: "",    bcp47: "en-US",   englishName: "Klingon", nativeName: "tlhIngan Hol", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
  { code: "mlt", iso639_1: "mt",  bcp47: "mt",      englishName: "Maltese", nativeName: "Malti", supportsText: false, supportsSpeech: false, supportsOCR: false, rtl: false },
];

export type LanguageCapability = "text" | "speech" | "ocr";

export const findLanguage = (code: string): Language =>
  LANGUAGES.find((l) => l.code === code) ??
  LANGUAGES.find((l) => l.code === "en")!;

export const supportsCapability = (l: Language, cap: LanguageCapability) =>
  cap === "speech" ? l.supportsSpeech : cap === "ocr" ? l.supportsOCR : l.supportsText;

export const languagesFor = (cap: LanguageCapability): Language[] =>
  LANGUAGES.filter((l) => supportsCapability(l, cap));

export const isRtl = (code: string) => findLanguage(code).rtl;

export const dirFor = (code: string): "rtl" | "ltr" => (isRtl(code) ? "rtl" : "ltr");

/** Strip diacritics and case so "Francais" matches "Français". */
export const foldText = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const matchesQuery = (l: Language, query: string) => {
  const q = foldText(query);
  if (!q) return true;
  return (
    foldText(l.englishName).includes(q) ||
    foldText(l.nativeName).includes(q) ||
    foldText(l.code).includes(q)
  );
};

/** Map a browser locale (navigator.language) onto a provider code. */
export const codeFromLocale = (locale?: string | null): LanguageCode => {
  if (!locale) return "en";
  const lower = locale.toLowerCase();
  const [base] = lower.split("-");
  if (base === "zh") {
    if (/(^|-)(hk|mo)\b/.test(lower) || lower.includes("yue")) return "yue";
    if (/(^|-)(tw|hant)\b/.test(lower)) return "cht";
    return "zh";
  }
  const map: Record<string, LanguageCode> = {
  zh: "zh",
  en: "en",
  ja: "jp",
  ko: "kor",
  fr: "fra",
  es: "spa",
  th: "th",
  ar: "ara",
  ru: "ru",
  pt: "pt",
  de: "de",
  it: "it",
  el: "el",
  nl: "nl",
  pl: "pl",
  bg: "bul",
  et: "est",
  da: "dan",
  fi: "fin",
  cs: "cs",
  ro: "rom",
  sl: "slo",
  sk: "sk",
  sv: "swe",
  hu: "hu",
  vi: "vie",
  tr: "tr",
  uk: "ukr",
  be: "bel",
  hr: "hrv",
  sr: "srp",
  bs: "bos",
  mk: "mac",
  sq: "alb",
  lv: "lav",
  lt: "lit",
  is: "ice",
  fo: "fao",
  no: "nor",
  nn: "nno",
  ga: "gle",
  gd: "gla",
  cy: "wel",
  kw: "cor",
  br: "bre",
  gv: "glv",
  ca: "cat",
  eu: "baq",
  gl: "glg",
  an: "arg",
  oc: "oci",
  wa: "wln",
  sc: "srd",
  co: "cos",
  fur: "fri",
  rm: "roh",
  li: "lim",
  fy: "fry",
  lb: "ltz",
  la: "lat",
  cv: "chv",
  ba: "bak",
  tt: "tat",
  az: "aze",
  ky: "kir",
  tk: "tuk",
  hi: "hi",
  ur: "urd",
  bn: "ben",
  pa: "pan",
  gu: "guj",
  mr: "mar",
  ne: "nep",
  si: "sin",
  ta: "tam",
  te: "tel",
  kn: "kan",
  ml: "mal",
  or: "ori",
  as: "asm",
  sd: "snd",
  sa: "san",
  dv: "div",
  fa: "per",
  ps: "pus",
  ku: "kur",
  os: "oss",
  tg: "tgk",
  hy: "arm",
  ka: "geo",
  he: "heb",
  yi: "yid",
  am: "amh",
  ti: "tir",
  om: "orm",
  so: "som",
  sw: "swa",
  af: "afr",
  xh: "xho",
  zu: "zul",
  st: "sot",
  nso: "ped",
  nr: "nbl",
  ts: "tso",
  ve: "ven",
  sn: "sna",
  ny: "nya",
  lg: "lug",
  rw: "kin",
  ln: "lin",
  kg: "kon",
  ff: "ful",
  ha: "hau",
  ig: "ibo",
  yo: "yor",
  tw: "twi",
  ak: "aka",
  wo: "wol",
  kr: "kau",
  mg: "mg",
  ht: "ht",
  ms: "may",
  id: "id",
  jv: "jav",
  su: "sun",
  tl: "fil",
  my: "bur",
  km: "hkm",
  lo: "lao",
  sm: "sm",
  mi: "mao",
  gn: "grn",
  ay: "aym",
  qu: "que",
  iu: "iku",
  kl: "kal",
  se: "sme",
  eo: "epo",
  io: "ido",
  ia: "ina",
  mt: "mlt",
  };
  return map[base] ?? "en";
};

export const deviceLanguageCode = (): LanguageCode =>
  codeFromLocale(typeof navigator !== "undefined" ? navigator.language : "en");

/**
 * Nearest supported alternative when the picked language can't do the active
 * mode: same family first (Chinese variants), then the device language, then
 * English.
 */
export const nearestSupported = (code: string, cap: LanguageCapability): Language => {
  const pool = languagesFor(cap);
  const family: Record<string, string[]> = {
    wyw: ["zh", "cht", "yue"],
    cht: ["zh", "yue"],
    yue: ["zh", "cht"],
    zh: ["cht", "yue"],
    est: ["fin", "en"],
    slo: ["cs", "en"],
  };
  for (const alt of family[code] ?? []) {
    const hit = pool.find((l) => l.code === alt);
    if (hit) return hit;
  }
  const device = pool.find((l) => l.code === deviceLanguageCode());
  if (device) return device;
  return pool.find((l) => l.code === "en") ?? pool[0];
};

/** Recently used codes, most recent first. */
const RECENT_KEY = "ez.translate.recentLangs";
const PAIR_KEY = "ez.translate.pair";

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const getRecentLanguages = (): LanguageCode[] => {
  const list = readJson<string[]>(RECENT_KEY) ?? [];
  return list
    .filter((c): c is LanguageCode => LANGUAGES.some((l) => l.code === c))
    .slice(0, 3);
};

export const rememberLanguage = (code: LanguageCode) => {
  try {
    const next = [code, ...getRecentLanguages().filter((c) => c !== code)].slice(0, 3);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* noop */ }
};

export const getStoredPair = (): { source: LanguageCode; target: LanguageCode } => {
  const stored = readJson<{ source?: string; target?: string }>(PAIR_KEY);
  const valid = (c?: string): LanguageCode | null =>
    c && LANGUAGES.some((l) => l.code === c) ? (c as LanguageCode) : null;
  const device = deviceLanguageCode();
  return {
    source: valid(stored?.source) ?? (isChineseCode(device) ? "en" : device),
    target: valid(stored?.target) ?? "zh",
  };
};

export const storePair = (source: LanguageCode, target: LanguageCode) => {
  try {
    localStorage.setItem(PAIR_KEY, JSON.stringify({ source, target }));
  } catch { /* noop */ }
};

/** Chinese variants offered on the Chinese side of the pair. */
export const CHINESE_CODES: LanguageCode[] = ["zh", "cht", "yue"];

export const isChineseCode = (code: string) =>
  code === "zh" || code === "cht" || code === "yue" || code === "wyw";

/** The three Chinese variants, filtered by what the active mode supports. */
export const chineseVariantsFor = (cap: LanguageCapability): Language[] =>
  CHINESE_CODES.map((c) => findLanguage(c)).filter((l) => supportsCapability(l, cap));

/**
 * Ordered picker sections for the user's own language: likely choices first,
 * then everything else. Chinese is never a valid choice on this side.
 */
export const pickerSections = (
  cap: LanguageCapability,
  query: string,
): { suggested: Language[]; all: Language[] } => {
  const pool = languagesFor(cap).filter(
    (l) => !isChineseCode(l.code) && matchesQuery(l, query),
  );
  const priority: string[] = [];
  const push = (c: string) => { if (!priority.includes(c) && !isChineseCode(c)) priority.push(c); };
  push(deviceLanguageCode());
  push("en");
  getRecentLanguages().forEach(push);
  const suggested = priority
    .map((c) => pool.find((l) => l.code === c))
    .filter((l): l is Language => Boolean(l));
  const all = pool
    .filter((l) => !suggested.some((s) => s.code === l.code))
    .sort((a, b) => a.englishName.localeCompare(b.englishName));
  return { suggested, all };
};

