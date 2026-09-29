import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  Send,
  Camera as CameraIcon,
  ImagePlus,
  X,
  ChevronDown,
  ArrowLeftRight,
  Bookmark,
  Maximize2,
  Zap,
  Languages,
  ChevronRight,
  MessageCircle,
  Square,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { speak, hasVoiceForBcp47 } from "@/lib/speech";
import LanguagePicker from "@/components/LanguagePicker";
import {
  LANGUAGES,
  findLanguage,
  getStoredPair,
  nearestSupported,
  isChineseCode,
  rememberLanguage,
  storePair,
  supportsCapability,
  type Language,
  type LanguageCapability,
  type LanguageCode,
} from "@/data/languages";
import { captureUtterance, micAvailable, type CaptureHandle } from "@/lib/speechCapture";



// Language definitions now live in src/data/languages.ts — the provider's full
// supported set (Baidu for text, Web Speech for Talk, Gemini OCR for Camera).
// These thin adapters keep the existing panel props unchanged.
export type LangCode = LanguageCode;

type LangDef = {
  code: LangCode;
  label: string;     // English name
  native: string;    // Native script
  bcp47: string;     // For SpeechRecognition / TTS
  rtl: boolean;
};

const toDef = (l: Language): LangDef => ({
  code: l.code,
  label: l.englishName,
  native: l.nativeName,
  bcp47: l.bcp47,
  rtl: l.rtl,
});

export const SOURCE_LANGS: LangDef[] = LANGUAGES.map(toDef);

const findLang = (c: LangCode): LangDef => toDef(findLanguage(c));

// ---------- Target languages (same provider set) ----------
export type TargetCode = LanguageCode;

type TargetDef = LangDef;

export const TARGET_LANGS: TargetDef[] = SOURCE_LANGS;

const findTarget = (c: TargetCode): TargetDef => toDef(findLanguage(c));


// ---------- UI translations (per source language) ----------

type UIText = {
  type: string; voice: string; camera: string;
  chatEmpty: string; chatPlaceholder: string; translateAria: string;
  tapToPlay: string; tapToReplay: string;
  voiceEmpty: string; listeningHint: string; supportedHint: string; unsupportedHint: string;
  speakIn: string; speakInMandarin: string; mandarin: string;
  listeningTapStop: string; speakOnePhrase: string; tapThenSpeak: string;
  talkTapToStop: string;
  talkCapped: string;
  talkDidWeHear: string;
  talkTapToRetry: string;
  talkNoAudio: string;
  talkFirstUseHint: string;
  micDenied: string; listenError: string; couldntStart: string;
  liveUnsupTitle: string; liveUnsupDesc: string;
  camEmpty: string; takePhoto: string; translating: string; reading: string;
  pickGallery: string; clearResults: string; camFooter: string;
  chooseImage: string; noText: string;
  couldntPhoto: string; couldntTranslate: string; tryAgain: string;
  tooMany: string; tryMoment: string;
  creditsTitle: string; creditsDesc: string;
  /** Talk-mode capture states (English fallback used for other languages). */
  talkListening?: string;
  talkTranscribing?: string;
  talkNothingHeard?: string;
  talkNoMicTitle?: string;
  talkNoMicDesc?: string;
  talkTranscribeFailed?: string;
};


const UI: Partial<Record<LangCode, UIText>> = {
  en: {
    type: "Type", voice: "Talk", camera: "Camera",
    chatEmpty: "Type below and tap send. Tap any reply to hear it out loud.",
    chatPlaceholder: "Type in English…",
    translateAria: "Translate", tapToPlay: "tap to play", tapToReplay: "tap to replay",
    voiceEmpty: "Tap the mic and speak.",
    listeningHint: "Listening…",
    supportedHint: "Tap a mic to speak",
    unsupportedHint: "Not supported on this browser",
    speakIn: "Speak in English", speakInMandarin: "Speak in Mandarin", mandarin: "Mandarin",
    listeningTapStop: "Listening… tap to stop",
    talkTapToStop: "Tap to stop",
    talkCapped: "Recording stopped at 60 seconds — tap the mic to continue.",
    talkDidWeHear: "Did we hear that right?",
    talkTapToRetry: "Tap to retry",
    talkNoAudio: "Audio unavailable for this language",
    talkFirstUseHint: "Tap the mic for the language being spoken.",
    speakOnePhrase: "Speak one phrase", tapThenSpeak: "Tap, then speak",
    micDenied: "Microphone permission denied", listenError: "Listening error",
    couldntStart: "Couldn't start listening",
    liveUnsupTitle: "Live listening isn't supported in this browser",
    liveUnsupDesc: "Try Chrome or Edge on desktop / Android.",
    camEmpty: "Point the camera at a sign or menu.",
    takePhoto: "Take photo", translating: "Translating…", reading: "Reading the photo…",
    pickGallery: "Choose from gallery", clearResults: "Clear results",
    camFooter: "Translating in real time — hold steady",
    chooseImage: "Please choose an image file",
    noText: "No text found in this photo",
    couldntPhoto: "Couldn't translate the photo", couldntTranslate: "Couldn't translate",
    tryAgain: "Please try again.",
    tooMany: "Too many requests", tryMoment: "Please try again in a moment.",
    creditsTitle: "AI credits exhausted",
    creditsDesc: "Top up in Settings → Workspace → Usage to keep translating.",
    talkListening: "Listening — pause when you're done",
    talkTranscribing: "Transcribing…",
    talkNothingHeard: "We didn't hear anything — tap the mic and speak.",
    talkNoMicTitle: "Voice isn't available here",
    talkNoMicDesc: "Switch to Type mode to translate.",
    talkTranscribeFailed: "Couldn't transcribe that",
  },

  de: {
    type: "Text", voice: "Talk", camera: "Kamera",
    chatEmpty: "Auf Deutsch tippen · zum Anhören tippen.",
    chatPlaceholder: "Auf Deutsch tippen…",
    translateAria: "Übersetzen", tapToPlay: "tippen zum Abspielen", tapToReplay: "tippen zum Wiedergeben",
    voiceEmpty: "Mikro drücken und sprechen.",
    listeningHint: "Hört zu…",
    supportedHint: "Mikro drücken und sprechen",
    unsupportedHint: "In diesem Browser nicht unterstützt",
    speakIn: "Auf Deutsch sprechen", speakInMandarin: "Auf Mandarin sprechen", mandarin: "Mandarin",
    listeningTapStop: "Hört zu… tippen zum Stoppen",
    talkTapToStop: "Zum Stoppen tippen",
    talkCapped: "Aufnahme nach 60 Sekunden gestoppt — Mikro erneut tippen, um weiterzumachen.",
    talkDidWeHear: "Haben wir das richtig verstanden?",
    talkTapToRetry: "Zum Erneutversuchen tippen",
    talkNoAudio: "Audio für diese Sprache nicht verfügbar",
    talkFirstUseHint: "Tippe auf das Mikro der Sprache, die gerade gesprochen wird.",
    speakOnePhrase: "Einen Satz sprechen", tapThenSpeak: "Tippen, dann sprechen",
    micDenied: "Mikrofonzugriff verweigert", listenError: "Fehler beim Zuhören",
    couldntStart: "Zuhören konnte nicht gestartet werden",
    liveUnsupTitle: "Live-Zuhören wird in diesem Browser nicht unterstützt",
    liveUnsupDesc: "Versuche Chrome oder Edge auf Desktop / Android.",
    camEmpty: "Kamera auf Schild oder Menü halten.",
    takePhoto: "Foto aufnehmen", translating: "Übersetze…", reading: "Foto wird gelesen…",
    pickGallery: "Aus Galerie wählen", clearResults: "Ergebnisse löschen",
    camFooter: "Übersetzt in Echtzeit — ruhig halten",
    chooseImage: "Bitte wähle eine Bilddatei",
    noText: "Kein Text im Foto gefunden",
    couldntPhoto: "Foto konnte nicht übersetzt werden", couldntTranslate: "Übersetzung fehlgeschlagen",
    tryAgain: "Bitte erneut versuchen.",
    tooMany: "Zu viele Anfragen", tryMoment: "Bitte gleich nochmal versuchen.",
    creditsTitle: "KI-Guthaben aufgebraucht",
    creditsDesc: "Lade in Einstellungen → Workspace → Nutzung auf.",
  },
  fra: {
    type: "Texte", voice: "Talk", camera: "Caméra",
    chatEmpty: "Écrivez en français · touchez pour écouter.",
    chatPlaceholder: "Écrivez en français…",
    translateAria: "Traduire", tapToPlay: "touchez pour écouter", tapToReplay: "touchez pour réécouter",
    voiceEmpty: "Appuyez sur le micro et parlez.",
    listeningHint: "À l'écoute…",
    supportedHint: "Appuyez sur un micro, parlez",
    unsupportedHint: "Non pris en charge sur ce navigateur",
    speakIn: "Parler en français", speakInMandarin: "Parler en mandarin", mandarin: "Mandarin",
    listeningTapStop: "À l'écoute… touchez pour arrêter",
    talkTapToStop: "Touchez pour arrêter",
    talkCapped: "Enregistrement arrêté à 60 secondes — touchez le micro pour continuer.",
    talkDidWeHear: "Avons-nous bien entendu ?",
    talkTapToRetry: "Touchez pour réessayer",
    talkNoAudio: "Audio indisponible pour cette langue",
    talkFirstUseHint: "Touchez le micro de la langue qui est parlée.",
    speakOnePhrase: "Dites une phrase", tapThenSpeak: "Appuyez, puis parlez",
    micDenied: "Accès au micro refusé", listenError: "Erreur d'écoute",
    couldntStart: "Impossible de démarrer l'écoute",
    liveUnsupTitle: "L'écoute en direct n'est pas prise en charge",
    liveUnsupDesc: "Essayez Chrome ou Edge sur ordinateur / Android.",
    camEmpty: "Pointez l'appareil sur un panneau ou un menu.",
    takePhoto: "Prendre une photo", translating: "Traduction…", reading: "Lecture de la photo…",
    pickGallery: "Choisir dans la galerie", clearResults: "Effacer les résultats",
    camFooter: "Traduction en temps réel — restez immobile",
    chooseImage: "Veuillez choisir un fichier image",
    noText: "Aucun texte trouvé sur cette photo",
    couldntPhoto: "Impossible de traduire la photo", couldntTranslate: "Traduction impossible",
    tryAgain: "Veuillez réessayer.",
    tooMany: "Trop de requêtes", tryMoment: "Veuillez réessayer dans un instant.",
    creditsTitle: "Crédits IA épuisés",
    creditsDesc: "Rechargez dans Paramètres → Espace → Utilisation.",
  },
  it: {
    type: "Testo", voice: "Talk", camera: "Fotocamera",
    chatEmpty: "Scrivi in italiano · tocca per ascoltare.",
    chatPlaceholder: "Scrivi in italiano…",
    translateAria: "Traduci", tapToPlay: "tocca per riprodurre", tapToReplay: "tocca per riascoltare",
    voiceEmpty: "Tocca il microfono e parla.",
    listeningHint: "In ascolto…",
    supportedHint: "Tocca il microfono e parla",
    unsupportedHint: "Non supportato su questo browser",
    speakIn: "Parla in italiano", speakInMandarin: "Parla in mandarino", mandarin: "Mandarino",
    listeningTapStop: "In ascolto… tocca per fermare",
    talkTapToStop: "Tocca per fermare",
    talkCapped: "Registrazione fermata a 60 secondi — tocca il microfono per continuare.",
    talkDidWeHear: "Abbiamo sentito bene?",
    talkTapToRetry: "Tocca per riprovare",
    talkNoAudio: "Audio non disponibile per questa lingua",
    talkFirstUseHint: "Tocca il microfono della lingua parlata.",
    speakOnePhrase: "Di' una frase", tapThenSpeak: "Tocca, poi parla",
    micDenied: "Permesso microfono negato", listenError: "Errore di ascolto",
    couldntStart: "Impossibile avviare l'ascolto",
    liveUnsupTitle: "L'ascolto dal vivo non è supportato in questo browser",
    liveUnsupDesc: "Prova Chrome o Edge su desktop / Android.",
    camEmpty: "Punta la fotocamera su un cartello o menu.",
    takePhoto: "Scatta una foto", translating: "Traduzione…", reading: "Lettura della foto…",
    pickGallery: "Scegli dalla galleria", clearResults: "Cancella risultati",
    camFooter: "Traduzione in tempo reale — resta fermo",
    chooseImage: "Scegli un file immagine",
    noText: "Nessun testo trovato nella foto",
    couldntPhoto: "Impossibile tradurre la foto", couldntTranslate: "Impossibile tradurre",
    tryAgain: "Riprova.",
    tooMany: "Troppe richieste", tryMoment: "Riprova tra un momento.",
    creditsTitle: "Crediti IA esauriti",
    creditsDesc: "Ricarica in Impostazioni → Workspace → Uso.",
  },
  nl: {
    type: "Tekst", voice: "Talk", camera: "Camera",
    chatEmpty: "Typ in het Nederlands · tik om te beluisteren.",
    chatPlaceholder: "Typ in het Nederlands…",
    translateAria: "Vertalen", tapToPlay: "tik om af te spelen", tapToReplay: "tik om opnieuw af te spelen",
    voiceEmpty: "Tik op de microfoon en spreek.",
    listeningHint: "Luistert…",
    supportedHint: "Tik op de microfoon en spreek",
    unsupportedHint: "Niet ondersteund in deze browser",
    speakIn: "Spreek in het Nederlands", speakInMandarin: "Spreek in Mandarijn", mandarin: "Mandarijn",
    listeningTapStop: "Luistert… tik om te stoppen",
    talkTapToStop: "Tik om te stoppen",
    talkCapped: "Opname na 60 seconden gestopt — tik op de microfoon om verder te gaan.",
    talkDidWeHear: "Hebben we dat goed gehoord?",
    talkTapToRetry: "Tik om opnieuw te proberen",
    talkNoAudio: "Audio niet beschikbaar voor deze taal",
    talkFirstUseHint: "Tik op de microfoon van de taal die wordt gesproken.",
    speakOnePhrase: "Spreek één zin", tapThenSpeak: "Tik, dan spreken",
    micDenied: "Microfoontoegang geweigerd", listenError: "Luisterfout",
    couldntStart: "Kan luisteren niet starten",
    liveUnsupTitle: "Live-luisteren wordt in deze browser niet ondersteund",
    liveUnsupDesc: "Probeer Chrome of Edge op desktop / Android.",
    camEmpty: "Richt de camera op een bord of menu.",
    takePhoto: "Foto maken", translating: "Vertalen…", reading: "Foto lezen…",
    pickGallery: "Kies uit galerij", clearResults: "Resultaten wissen",
    camFooter: "Real-time vertaling — houd stil",
    chooseImage: "Kies een afbeeldingsbestand",
    noText: "Geen tekst gevonden op deze foto",
    couldntPhoto: "Foto kon niet worden vertaald", couldntTranslate: "Vertaling mislukt",
    tryAgain: "Probeer het opnieuw.",
    tooMany: "Te veel verzoeken", tryMoment: "Probeer het zo opnieuw.",
    creditsTitle: "AI-tegoed op",
    creditsDesc: "Aanvullen in Instellingen → Workspace → Gebruik.",
  },
  pt: {
    type: "Texto", voice: "Talk", camera: "Câmara",
    chatEmpty: "Escreva em português · toque para ouvir.",
    chatPlaceholder: "Escreva em português…",
    translateAria: "Traduzir", tapToPlay: "toque para ouvir", tapToReplay: "toque para repetir",
    voiceEmpty: "Toque no microfone e fale.",
    listeningHint: "A ouvir…",
    supportedHint: "Toque no microfone e fale",
    unsupportedHint: "Não suportado neste navegador",
    speakIn: "Falar em português", speakInMandarin: "Falar em mandarim", mandarin: "Mandarim",
    listeningTapStop: "A ouvir… toque para parar",
    talkTapToStop: "Toque para parar",
    talkCapped: "Gravação parada aos 60 segundos — toque no microfone para continuar.",
    talkDidWeHear: "Ouvimos bem?",
    talkTapToRetry: "Toque para tentar novamente",
    talkNoAudio: "Áudio indisponível para este idioma",
    talkFirstUseHint: "Toque no microfone do idioma que está a ser falado.",
    speakOnePhrase: "Diga uma frase", tapThenSpeak: "Toque, depois fale",
    micDenied: "Acesso ao microfone negado", listenError: "Erro ao ouvir",
    couldntStart: "Não foi possível iniciar a escuta",
    liveUnsupTitle: "A escuta ao vivo não é suportada neste navegador",
    liveUnsupDesc: "Experimente Chrome ou Edge no computador / Android.",
    camEmpty: "Aponte a câmara para uma placa ou menu.",
    takePhoto: "Tirar foto", translating: "A traduzir…", reading: "A ler a foto…",
    pickGallery: "Escolher da galeria", clearResults: "Limpar resultados",
    camFooter: "Tradução em tempo real — mantenha firme",
    chooseImage: "Por favor escolha um ficheiro de imagem",
    noText: "Nenhum texto encontrado nesta foto",
    couldntPhoto: "Não foi possível traduzir a foto", couldntTranslate: "Não foi possível traduzir",
    tryAgain: "Por favor tente novamente.",
    tooMany: "Demasiados pedidos", tryMoment: "Tente novamente daqui a um momento.",
    creditsTitle: "Créditos de IA esgotados",
    creditsDesc: "Recarregue em Definições → Workspace → Utilização.",
  },
  spa: {
    type: "Texto", voice: "Talk", camera: "Cámara",
    chatEmpty: "Escribe en español · toca para escucharlo.",
    chatPlaceholder: "Escribe en español…",
    translateAria: "Traducir", tapToPlay: "toca para reproducir", tapToReplay: "toca para repetir",
    voiceEmpty: "Toca el micrófono y habla.",
    listeningHint: "Escuchando…",
    supportedHint: "Toca el micrófono y habla",
    unsupportedHint: "No compatible con este navegador",
    speakIn: "Habla en español", speakInMandarin: "Habla en mandarín", mandarin: "Mandarín",
    listeningTapStop: "Escuchando… toca para parar",
    talkTapToStop: "Toca para parar",
    talkCapped: "Grabación detenida a los 60 segundos — toca el micrófono para continuar.",
    talkDidWeHear: "¿Lo hemos oído bien?",
    talkTapToRetry: "Toca para reintentar",
    talkNoAudio: "Audio no disponible para este idioma",
    talkFirstUseHint: "Toca el micrófono del idioma que se está hablando.",
    speakOnePhrase: "Di una frase", tapThenSpeak: "Toca, luego habla",
    micDenied: "Permiso de micrófono denegado", listenError: "Error al escuchar",
    couldntStart: "No se pudo iniciar la escucha",
    liveUnsupTitle: "La escucha en vivo no es compatible con este navegador",
    liveUnsupDesc: "Prueba Chrome o Edge en escritorio / Android.",
    camEmpty: "Apunta la cámara a un cartel o menú.",
    takePhoto: "Tomar foto", translating: "Traduciendo…", reading: "Leyendo la foto…",
    pickGallery: "Elegir de la galería", clearResults: "Borrar resultados",
    camFooter: "Traducción en tiempo real — mantén firme",
    chooseImage: "Elige un archivo de imagen",
    noText: "No se encontró texto en esta foto",
    couldntPhoto: "No se pudo traducir la foto", couldntTranslate: "No se pudo traducir",
    tryAgain: "Inténtalo de nuevo.",
    tooMany: "Demasiadas solicitudes", tryMoment: "Inténtalo en un momento.",
    creditsTitle: "Créditos de IA agotados",
    creditsDesc: "Recarga en Ajustes → Workspace → Uso.",
  },
  jp: {
    type: "テキスト", voice: "Talk", camera: "カメラ",
    chatEmpty: "日本語で入力・タップで再生。",
    chatPlaceholder: "日本語で入力…",
    translateAria: "翻訳", tapToPlay: "タップして再生", tapToReplay: "タップでもう一度",
    voiceEmpty: "マイクをタップして話してください。",
    listeningHint: "聞いています…",
    supportedHint: "マイクをタップして話す",
    unsupportedHint: "このブラウザには対応していません",
    speakIn: "日本語で話す", speakInMandarin: "中国語で話す", mandarin: "中国語",
    listeningTapStop: "聞いています… タップで停止",
    talkTapToStop: "タップで停止",
    talkCapped: "60秒で録音を停止しました — マイクをタップして続けてください。",
    talkDidWeHear: "これで合っていますか？",
    talkTapToRetry: "タップしてやり直す",
    talkNoAudio: "この言語の音声は使えません",
    talkFirstUseHint: "話している言語のマイクをタップしてください。",
    speakOnePhrase: "一文を話してください", tapThenSpeak: "タップしてから話す",
    micDenied: "マイクへのアクセスが拒否されました", listenError: "音声認識エラー",
    couldntStart: "音声認識を開始できません",
    liveUnsupTitle: "このブラウザではライブ音声認識は使えません",
    liveUnsupDesc: "パソコンや Android の Chrome / Edge をお試しください。",
    camEmpty: "看板やメニューにカメラを向けてください。",
    takePhoto: "写真を撮る", translating: "翻訳中…", reading: "写真を読み取っています…",
    pickGallery: "写真から選ぶ", clearResults: "結果を消す",
    camFooter: "リアルタイム翻訳中 — 動かさないでください",
    chooseImage: "画像ファイルを選んでください",
    noText: "この写真に文字は見つかりませんでした",
    couldntPhoto: "写真を翻訳できませんでした", couldntTranslate: "翻訳できませんでした",
    tryAgain: "もう一度お試しください。",
    tooMany: "リクエストが多すぎます", tryMoment: "少し経ってからお試しください。",
    creditsTitle: "AI クレジットがなくなりました",
    creditsDesc: "設定 → ワークスペース → 使用量からチャージしてください。",
  },
  kor: {
    type: "텍스트", voice: "Talk", camera: "카메라",
    chatEmpty: "한국어로 입력 · 탭하여 재생.",
    chatPlaceholder: "한국어로 입력…",
    translateAria: "번역", tapToPlay: "탭하여 재생", tapToReplay: "탭하여 다시 재생",
    voiceEmpty: "마이크를 탭하고 말씀하세요.",
    listeningHint: "듣는 중…",
    supportedHint: "마이크를 탭하고 말하세요",
    unsupportedHint: "이 브라우저에서는 지원되지 않습니다",
    speakIn: "한국어로 말하기", speakInMandarin: "중국어로 말하기", mandarin: "중국어",
    listeningTapStop: "듣는 중… 탭하여 정지",
    talkTapToStop: "탭하여 정지",
    talkCapped: "60초에서 녹음이 중지되었습니다 — 계속하려면 마이크를 탭하세요.",
    talkDidWeHear: "제대로 들었나요?",
    talkTapToRetry: "탭하여 다시 시도",
    talkNoAudio: "이 언어의 오디오는 사용할 수 없습니다",
    talkFirstUseHint: "말하고 있는 언어의 마이크를 탭하세요.",
    speakOnePhrase: "한 문장 말하기", tapThenSpeak: "탭한 뒤 말하기",
    micDenied: "마이크 권한이 거부되었습니다", listenError: "듣기 오류",
    couldntStart: "듣기를 시작할 수 없습니다",
    liveUnsupTitle: "이 브라우저에서는 실시간 음성 인식이 지원되지 않습니다",
    liveUnsupDesc: "데스크톱이나 Android의 Chrome 또는 Edge를 사용해 보세요.",
    camEmpty: "간판이나 메뉴에 카메라를 향해 주세요.",
    takePhoto: "사진 찍기", translating: "번역 중…", reading: "사진을 읽는 중…",
    pickGallery: "갤러리에서 선택", clearResults: "결과 지우기",
    camFooter: "실시간 번역 — 잠시 그대로 유지",
    chooseImage: "이미지 파일을 선택하세요",
    noText: "사진에서 텍스트를 찾을 수 없습니다",
    couldntPhoto: "사진을 번역할 수 없습니다", couldntTranslate: "번역할 수 없습니다",
    tryAgain: "다시 시도해 주세요.",
    tooMany: "요청이 너무 많습니다", tryMoment: "잠시 후 다시 시도하세요.",
    creditsTitle: "AI 크레딧이 소진되었습니다",
    creditsDesc: "설정 → 워크스페이스 → 사용량에서 충전하세요.",
  },
};

const PHRASES_EN_TO_ZH: Record<string, { zh: string; pinyin: string }> = {
  hello: { zh: "你好", pinyin: "Nǐ hǎo" },
  "thank you": { zh: "谢谢", pinyin: "Xiè xie" },
  "how much": { zh: "多少钱", pinyin: "Duō shǎo qián" },
  "how much is this": { zh: "这个多少钱", pinyin: "Zhège duōshǎo qián" },
  "where is the bathroom": { zh: "厕所在哪里", pinyin: "Cè suǒ zài nǎ lǐ" },
  goodbye: { zh: "再见", pinyin: "Zài jiàn" },
  yes: { zh: "是", pinyin: "Shì" },
  no: { zh: "不", pinyin: "Bù" },
  "i need help": { zh: "我需要帮助", pinyin: "Wǒ xū yào bāng zhù" },
  "the bill please": { zh: "买单", pinyin: "Mǎi dān" },
  "no spicy": { zh: "不要辣", pinyin: "Bú yào là" },
};

type ChatMsg = {
  id: string;
  side: "you" | "them"; // you = source language, them = Mandarin source
  source: string;
  translated: string;
  pinyin?: string;
  /** true when the recognizer's confidence was low — bubble offers retry instead of translating. */
  uncertain?: boolean;
  /** Direction this message came from, used by the retry affordance. */
  dir?: "src2zh" | "zh2src";
  /** Set once translation completes if no local TTS voice exists for the target BCP-47. */
  noAudio?: boolean;
};

const translate = async (
  text: string,
  from: LangCode | TargetCode,
  to: LangCode | TargetCode,
): Promise<{ translated: string; pinyin: string }> => {
  if (from === "en" && to === "zh") {
    const key = text.trim().toLowerCase().replace(/[.?!]+$/, "");
    const cached = PHRASES_EN_TO_ZH[key];
    if (cached) return { translated: cached.zh, pinyin: cached.pinyin };
  }
  try {
    const { data, error } = await supabase.functions.invoke("translate", {
      body: { text, from, to },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return {
      translated: String(data?.translated ?? ""),
      pinyin: String(data?.pinyin ?? ""),
    };
  } catch (err: any) {
    console.error("translate failed", err);
    const msg = String(err?.message ?? "");
    if (msg.includes("402") || /credits/i.test(msg)) {
      toast.error("AI credits exhausted", {
        description: "Top up in Settings → Workspace → Usage to keep translating.",
      });
    } else if (msg.includes("429")) {
      toast.error("Too many requests", { description: "Please try again in a moment." });
    } else {
      toast.error("Couldn't translate", { description: "Please try again." });
    }
    return { translated: "", pinyin: "" };
  }
};

// ---------- Shared header controls ----------

type Tab = "chat" | "voice" | "camera";

const SegmentedTabs = ({
  tab,
  setTab,
  t,
  dark,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  t: UIText;
  dark?: boolean;
}) => {
  const items: { key: Tab; label: string }[] = [
    { key: "chat", label: t.type },
    { key: "voice", label: t.voice },
    { key: "camera", label: t.camera },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it) => {
        const active = tab === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => setTab(it.key)}
            className={
              "h-11 flex-1 rounded-full text-[15px] font-semibold transition-colors " +
              (active
                ? "bg-ink text-white"
                : dark
                  ? "bg-white/10 text-white hover:bg-white/15"
                  : "bg-white text-ink border border-hairline hover:bg-surface-2")
            }
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
};

const LangSwitcher = ({
  sourceLang,
  setSourceLang,
  swapped,
  onSwap,
  targetCode,
  setTargetCode,
  capability,
}: {
  sourceLang: LangCode;
  setSourceLang: (c: LangCode) => void;
  swapped: boolean;
  onSwap: () => void;
  targetCode: TargetCode;
  setTargetCode: (c: TargetCode) => void;
  capability: LanguageCapability;
}) => (
  <div className="flex items-center gap-1.5">
    <div className={`min-w-0 flex-1 ${swapped ? "order-3" : "order-1"}`}>
      <LanguagePicker
        value={sourceLang}
        onChange={setSourceLang}
        capability={capability}
        title="Translate from"
        ariaLabel="Source language"
      />
    </div>

    <button
      type="button"
      onClick={onSwap}
      aria-label="Swap languages"
      className="order-2 flex h-10 w-10 shrink-0 items-center justify-center justify-self-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-surface-3"
    >
      <ArrowLeftRight className="h-4 w-4" strokeWidth={2} />
    </button>

    <div className={`min-w-0 flex-1 ${swapped ? "order-1" : "order-3"}`}>
      <LanguagePicker
        value={targetCode}
        onChange={setTargetCode}
        capability={capability}
        mode="chinese"
        title="Chinese variant"
        ariaLabel="Chinese variant"
      />
    </div>

  </div>
);

// Inline notice shown when a chosen language can't do what the active mode
// needs. Never fails silently — always offers the nearest supported swap.
const UnsupportedNotice = ({
  which,
  language,
  capability,
  onUse,
}: {
  which: string;
  language: Language;
  capability: LanguageCapability;
  onUse: (code: LanguageCode) => void;
}) => {
  const alt = nearestSupported(language.code, capability);
  const modeLabel =
    capability === "speech" ? "Talk" : capability === "ocr" ? "Camera" : "Type";
  return (
    <div className="rounded-2xl bg-[hsl(var(--tint-warm))] px-4 py-3">
      <p className="text-[13px] leading-relaxed text-ink">
        {language.englishName} isn't available in {modeLabel} mode as the {which} language.
      </p>
      <button
        type="button"
        onClick={() => onUse(alt.code)}
        className="mt-2 text-[13px] font-semibold text-brand-red"
      >
        Use {alt.englishName} instead
      </button>
    </div>
  );
};

// ---------- Root ----------

const SignInToTranslate = () => (
  <div className="mx-auto w-full max-w-[440px]">
    <div className="rounded-2xl border border-border bg-surface p-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2">
        <Languages className="h-5 w-5 text-ink" strokeWidth={2} />
      </div>
      <h2 className="text-[20px] font-bold text-ink">Log in to translate</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-secondary">
        Translation, voice and menu photos are free with an account. It takes a moment to create
        one.
      </p>
      <Link
        to="/auth"
        className="mt-5 flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white"
      >
        Log in or create your account
      </Link>
      <Link
        to="/translate/phrases"
        className="mt-3 flex h-[52px] w-full items-center justify-center rounded-full bg-surface-2 text-[15px] font-semibold text-ink"
      >
        Browse essential phrases
      </Link>
    </div>
  </div>
);

export const Translator = () => {
  const { session, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("chat");
  // The user's own side is never Chinese; coerce legacy stored pairs.
  const stored = useMemo(() => {
    const pair = getStoredPair();
    return isChineseCode(pair.source) ? { ...pair, source: "en" as LangCode } : pair;
  }, []);
  const [sourceLang, setSourceLangRaw] = useState<LangCode>(stored.source);
  const [swapped, setSwapped] = useState(false);
  const [targetCode, setTargetCodeRaw] = useState<TargetCode>(stored.target);
  const target = findTarget(targetCode);
  const lang = findLang(sourceLang);
  const t = UI[sourceLang] ?? UI.en!;

  const capability: LanguageCapability =
    tab === "voice" ? "speech" : tab === "camera" ? "ocr" : "text";

  const setSourceLang = (c: LangCode) => {
    setSourceLangRaw(c);
    rememberLanguage(c);
    storePair(c, targetCode);
  };
  const setTargetCode = (c: TargetCode) => {
    setTargetCodeRaw(c);
    rememberLanguage(c);
    storePair(sourceLang, c);
  };

  const onSwap = () => setSwapped((s) => !s);

  const sourceOk = supportsCapability(findLanguage(sourceLang), capability);
  const targetOk = supportsCapability(findLanguage(targetCode), capability);

  // Translation runs on our servers and now needs an account, so say so up
  // front rather than letting a translation attempt fail with a vague error.
  if (!authLoading && !session) return <SignInToTranslate />;

  if (tab === "camera") {
    return (
      <CameraPanel
        tab={tab}
        setTab={setTab}
        lang={lang}
        t={t}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[440px] space-y-4">
      <SegmentedTabs tab={tab} setTab={setTab} t={t} />
      <LangSwitcher
        sourceLang={sourceLang}
        setSourceLang={setSourceLang}
        swapped={swapped}
        onSwap={onSwap}
        targetCode={targetCode}
        setTargetCode={setTargetCode}
        capability={capability}
      />

      {!sourceOk && (
        <UnsupportedNotice
          which="source"
          language={findLanguage(sourceLang)}
          capability={capability}
          onUse={setSourceLang}
        />
      )}
      {!targetOk && (
        <UnsupportedNotice
          which="target"
          language={findLanguage(targetCode)}
          capability={capability}
          onUse={setTargetCode}
        />
      )}

      {tab === "chat" && <ChatPanel lang={lang} t={t} target={target} />}
      {tab === "voice" && <VoicePanel lang={lang} t={t} target={target} />}
    </div>
  );
};


// ---------------- Chat panel ----------------

// Quick phrases live at /translate/phrases (see src/data/quickPhrases.ts).

const ChatPanel = ({ lang, t, target }: { lang: LangDef; t: UIText; target: TargetDef }) => {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<{ source: string; translated: string; pinyin?: string; bcp47: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Focus the real input when the Type tab mounts so the cursor/keyboard is ready.
    inputRef.current?.focus();
  }, []);

  const send = async (raw?: string) => {
    const text = (raw ?? draft).trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    const id = `you-${Date.now()}`;
    setMessages((prev) => [...prev, { id, side: "you", source: text, translated: "…" }]);
    try {
      const { translated, pinyin } = await translate(text, lang.code, target.code);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, translated, pinyin } : m)));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Conversation / results region */}
      <div
        ref={scrollRef}
        className="max-h-[min(420px,50vh)] overflow-y-auto"
      >
        {messages.length === 0 ? (
          <p
            className="pointer-events-none select-none py-12 text-center text-[13px] text-ink-secondary"
            aria-hidden="true"
          >
            {t.chatEmpty}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const loading = m.translated === "…";
              const hasResult = !loading && !!m.translated;
              return (
                <div key={m.id} className="flex flex-col gap-3">
                  {/* User source */}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl bg-surface-2 px-4 py-3">
                      <p dir={lang.rtl ? "rtl" : "ltr"} className="text-[15px] leading-relaxed text-ink">{m.source}</p>
                    </div>
                  </div>

                  {/* Assistant translation */}
                  <div className="max-w-[90%] rounded-2xl bg-ink p-4 text-white">
                    <div dir={target.rtl ? "rtl" : "ltr"} className="text-[22px] font-semibold leading-snug">
                      {loading ? (
                        <span className="inline-flex items-center gap-2 text-white/70">
                          <Loader2 className="h-4 w-4 animate-spin" /> {t.translating}
                        </span>
                      ) : (
                        m.translated || "—"
                      )}
                    </div>
                    {hasResult && m.pinyin && (
                      <div className="mt-1 text-[13px] italic text-white/70">{m.pinyin}</div>
                    )}
                    {hasResult && (
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPreview({
                              source: m.source,
                              translated: m.translated,
                              pinyin: m.pinyin,
                              bcp47: target.bcp47,
                            })
                          }
                          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-ink"
                        >
                          <Maximize2 className="h-4 w-4" strokeWidth={2} />
                          Show
                        </button>
                        <button
                          type="button"
                          onClick={() => speak(m.translated, target.bcp47)}
                          aria-label={t.tapToPlay}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10"
                        >
                          <Volume2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          aria-label="Save phrase"
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10"
                        >
                          <Bookmark className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="pt-2">
        <div className="flex items-center gap-2 rounded-full bg-surface-2 px-2 py-2 pl-4">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t.chatPlaceholder}
            aria-label={t.chatPlaceholder}
            dir={lang.rtl ? "rtl" : "ltr"}
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-secondary"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!draft.trim() || sending}
            aria-label={t.translateAria}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Quick phrases — entry card links to dedicated screen */}
      <Link
        to="/translate/phrases"
        className="flex items-center gap-3 rounded-2xl border border-hairline bg-white px-4 py-4 transition-colors hover:bg-surface-2"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-red)/0.1)] text-brand-red">
          <MessageCircle className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="flex-1 text-[16px] font-semibold text-ink">Quick phrases</span>
        <ChevronRight className="h-5 w-5 text-ink-secondary" strokeWidth={2} />
      </Link>


      {/* Fullscreen "Show" overlay for restaurant staff to read */}
      {preview && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#FF7A00] to-[#D63A0A] text-white"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 12px)",
            paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          }}
        >
          <div className="flex items-center justify-between px-5 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
              Show this
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPreview(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/25 active:bg-white/30"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-8 h-px w-8 bg-white/60" />
            <p dir={target.rtl ? "rtl" : "ltr"} className="text-[30px] font-semibold leading-[1.25] text-white">
              {preview.translated}
            </p>
            {preview.pinyin && (
              <p className="mt-3 text-[15px] italic text-white/85">{preview.pinyin}</p>
            )}
            {preview.source && (
              <p className="mt-5 text-[15px] leading-snug text-white/80">
                {preview.source}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 px-5">
            <button
              type="button"
              onClick={() => speak(preview.translated, preview.bcp47)}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-[#D63A0A] shadow-[0_8px_24px_rgba(0,0,0,0.12)] active:bg-white/95"
            >
              <Volume2 className="h-5 w-5" strokeWidth={2} />
              Play aloud
            </button>
            <button
              type="button"
              aria-label="Save"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/25 active:bg-white/30"
            >
              <Bookmark className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ---------------- Voice panel ----------------

// BCP-47 for the target of a given direction. Source langs come from
// SOURCE_LANGS; the Mandarin mic is always zh-CN.
const bcp47ForTarget = (dir: "src2zh" | "zh2src", lang: LangDef): string =>
  dir === "src2zh" ? "zh-CN" : lang.bcp47;

// Talk mode records one utterance at a time with getUserMedia + Web Audio and
// transcribes it server-side (`transcribe` edge function). The Web Speech API is
// unavailable in the iOS webview, so it is no longer used. Voice-activity
// detection ends an utterance after a short pause; the 60-second cap in
// speechCapture.ts is only a backstop.

const transcribeAudio = async (blob: Blob, language: string): Promise<string> => {
  const form = new FormData();
  form.append("file", blob, "recording.wav");
  form.append("language", language);
  const { data, error } = await supabase.functions.invoke("transcribe", { body: form });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return String(data?.text ?? "").trim();
};

type VoicePhase = "idle" | "listening" | "transcribing";

const VoicePanel = ({ lang, t, target }: { lang: LangDef; t: UIText; target: TargetDef }) => {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [direction, setDirection] = useState<"src2zh" | "zh2src" | null>(null);
  const [interim, setInterim] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [hintDismissed, setHintDismissed] = useState(false);
  const handleRef = useRef<CaptureHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const supported = useMemo(() => micAvailable(), []);
  const listening = phase === "listening";
  const transcribing = phase === "transcribing";
  const busy = listening || transcribing;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, interim, phase]);

  useEffect(() => () => {
    try { handleRef.current?.cancel(); } catch { /* noop */ }
  }, []);

  // Speak a translated string in the actual target locale, honouring the
  // installed voice list. Returns false when no voice matched so callers can
  // flag the message rather than mangling it in English.
  const speakInTarget = (text: string, bcp47: string): boolean => {
    if (!text) return false;
    return speak(text, bcp47);
  };

  const processFinal = async (
    src: string,
    dir: "src2zh" | "zh2src",
  ) => {
    if (!src) return;
    const from: LangCode | "zh" = dir === "src2zh" ? lang.code : "zh";
    const to: LangCode | "zh" = dir === "src2zh" ? "zh" : lang.code;
    const targetBcp47 = dir === "src2zh" ? "zh-CN" : lang.bcp47;
    const id = `${dir}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const side: "you" | "them" = dir === "src2zh" ? "you" : "them";
    setMessages((prev) => [...prev, { id, side, source: src, translated: "…", dir }]);
    const { translated, pinyin } = await translate(src, from, to);
    const finalText = translated || "—";
    const spoke = translated ? speakInTarget(translated, targetBcp47) : false;
    const noAudio = Boolean(translated) && !spoke && !hasVoiceForBcp47(targetBcp47);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, translated: finalText, pinyin, noAudio } : m)),
    );
  };

  const start = async (dir: "src2zh" | "zh2src") => {
    if (!supported) {
      toast.error(t.talkNoMicTitle ?? "Voice isn't available here", {
        description: t.talkNoMicDesc ?? "Switch to Type mode to translate.",
      });
      return;
    }
    if (busy) return;
    setHintDismissed(true);
    setInterim("");
    setDirection(dir);
    setPhase("listening");

    let utterance;
    try {
      const { handle, done } = await captureUtterance();
      handleRef.current = handle;
      utterance = await done;
    } catch (err: any) {
      handleRef.current = null;
      setPhase("idle");
      setDirection(null);
      if (String(err?.message) === "cancelled") return;
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        toast.error(t.micDenied, { description: t.talkNoMicDesc ?? undefined });
      } else if (String(err?.message) === "mic-unavailable") {
        toast.error(t.talkNoMicTitle ?? "Voice isn't available here", {
          description: t.talkNoMicDesc ?? "Switch to Type mode to translate.",
        });
      } else {
        toast.error(t.couldntStart);
      }
      return;
    }
    handleRef.current = null;

    if (utterance.reason === "capped") toast(t.talkCapped);
    if (utterance.silent) {
      setPhase("idle");
      setDirection(null);
      toast(t.talkNothingHeard ?? "We didn't hear anything — tap the mic and speak.");
      return;
    }

    setPhase("transcribing");
    let text = "";
    try {
      text = await transcribeAudio(utterance.blob, dir === "src2zh" ? lang.code : "zh");
    } catch (err: any) {
      console.error("transcribe failed", err);
      const msg = String(err?.message ?? "");
      if (msg.includes("429")) {
        toast.error(t.tooMany, { description: t.tryMoment });
      } else {
        toast.error(t.talkTranscribeFailed ?? "Couldn't transcribe that", {
          description: t.tryAgain,
        });
      }
    }
    setPhase("idle");
    setDirection(null);
    if (!text) {
      if (utterance.reason !== "capped") {
        toast(t.talkNothingHeard ?? "We didn't hear anything — tap the mic and speak.");
      }
      return;
    }
    await processFinal(text, dir);
  };

  const stop = () => {
    try { handleRef.current?.stop(); } catch { /* noop */ }
  };

  const retry = (m: ChatMsg) => {
    if (!m.dir) return;
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    void start(m.dir);
  };

  const primaryActive = busy && direction === "zh2src"; // large red = Mandarin mic
  const secondaryActive = busy && direction === "src2zh";

  const sourceLabel = lang.label;
  const mandarinLabel = target.native;
  const showFirstUseHint =
    !hintDismissed && messages.length === 0 && !busy && supported;


  return (
    <div
      className="flex flex-col"
      style={{ minHeight: "calc(100dvh - 20rem)" }}
    >
      {/* Transcript */}
      <div
        ref={scrollRef}
        className="min-h-[240px] flex-1 space-y-3 overflow-y-auto py-2"
      >
        {messages.length === 0 && !interim ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-[15px] text-ink-secondary">{t.voiceEmpty}</p>
          </div>
        ) : (
          <>
            {messages.map((m) => {
              const roleLabel = m.side === "you" ? `You · ${lang.label}` : "Them · Chinese";
              const bcp47 = m.side === "you" ? "zh-CN" : lang.bcp47;
              return (
                <div key={m.id} className={"flex flex-col " + (m.side === "you" ? "items-start" : "items-end")}>
                  <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-tertiary">
                    {roleLabel}
                  </div>
                  {m.uncertain ? (
                    <div
                      className={
                        "max-w-[85%] rounded-2xl border border-hairline bg-white px-4 py-3 text-left text-[15px] leading-snug " +
                        (m.side === "you" ? "" : "")
                      }
                    >
                      <div className="text-[13px] font-semibold text-ink-secondary">
                        {t.talkDidWeHear}
                      </div>
                      <div className="mt-1 text-[15px] text-ink">"{m.source}"</div>
                      <button
                        type="button"
                        onClick={() => retry(m)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-3"
                      >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                        {t.talkTapToRetry}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          m.translated && m.translated !== "…" && m.translated !== "—" &&
                          speakInTarget(m.translated, bcp47)
                        }
                        className={
                          "max-w-[85%] rounded-2xl px-4 py-3 text-left text-[15px] leading-snug " +
                          (m.side === "you"
                            ? "bg-surface-2 text-ink"
                            : "bg-ink text-white")
                        }
                      >
                        <div>{m.translated === "…" ? "…" : m.translated}</div>
                        {m.pinyin && (
                          <div className={"mt-1 text-[12px] italic " + (m.side === "you" ? "text-ink-secondary" : "text-white/70")}>
                            {m.pinyin}
                          </div>
                        )}
                        <div className={"mt-1 text-[11px] " + (m.side === "you" ? "text-ink-tertiary" : "text-white/50")}>
                          {m.source}
                        </div>
                      </button>
                      {m.noAudio && (
                        <div className="mt-1 text-[11px] text-ink-tertiary">
                          {t.talkNoAudio}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {interim && (
              <div className={"flex " + (direction === "src2zh" ? "justify-start" : "justify-end")}>
                <div className="max-w-[85%] rounded-2xl border border-dashed border-hairline bg-white px-4 py-3 text-[15px] text-ink-secondary">
                  {interim}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Capture state */}
      <div className="flex flex-col items-center gap-1 py-3">
        {listening ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-tint-warm px-4 py-1.5 text-[13px] font-semibold text-brand-red">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-red animate-pulse" />
            {t.talkListening ?? t.listeningHint}
          </div>
        ) : transcribing ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-1.5 text-[13px] font-semibold text-ink-secondary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            {t.talkTranscribing ?? t.translating}
          </div>
        ) : supported ? (
          <>
            <div className="text-[12px] text-ink-tertiary">{t.supportedHint}</div>
            {showFirstUseHint && (
              <div className="text-[12px] text-ink-secondary">{t.talkFirstUseHint}</div>
            )}
          </>
        ) : (
          <div className="rounded-2xl bg-tint-warm px-4 py-3 text-center">
            <p className="text-[13px] font-semibold text-ink">
              {t.talkNoMicTitle ?? "Voice isn't available here"}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-secondary">
              {t.talkNoMicDesc ?? "Switch to Type mode to translate."}
            </p>
          </div>
        )}
      </div>

      {/* Mic controls */}
      <div className="flex items-center justify-center gap-24 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
        {/* Source-language mic */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => (secondaryActive && listening ? stop() : void start("src2zh"))}
            disabled={!supported || (busy && !secondaryActive) || (secondaryActive && transcribing)}
            aria-label={secondaryActive && listening ? t.talkTapToStop : sourceLabel}
            className={
              "flex h-[72px] w-[72px] items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40 " +
              (secondaryActive
                ? "bg-brand-red text-white ring-4 ring-brand-red/25 " + (listening ? "animate-pulse" : "")
                : "bg-surface-2 text-ink hover:bg-surface-3")
            }
          >
            {secondaryActive && transcribing ? (
              <Loader2 className="h-7 w-7 animate-spin" strokeWidth={2} />
            ) : secondaryActive ? (
              <Square className="h-7 w-7" fill="currentColor" strokeWidth={0} />
            ) : (
              <Mic className="h-7 w-7" strokeWidth={2} />
            )}
          </button>
          <span className="text-[13px] font-medium text-ink">{sourceLabel}</span>
        </div>

        {/* Mandarin mic — the "them" side, large red */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => (primaryActive && listening ? stop() : void start("zh2src"))}
            disabled={!supported || (busy && !primaryActive) || (primaryActive && transcribing)}
            aria-label={primaryActive && listening ? t.talkTapToStop : mandarinLabel}
            className={
              "relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brand-red text-white shadow-[0_10px_28px_-8px_rgba(222,41,16,0.45)] ring-[6px] ring-brand-red/15 transition-transform active:scale-95 disabled:opacity-40 " +
              (primaryActive && listening ? "animate-pulse" : "")
            }
          >
            {primaryActive && transcribing ? (
              <Loader2 className="h-7 w-7 animate-spin" strokeWidth={2} />
            ) : primaryActive ? (
              <Square className="h-7 w-7" fill="currentColor" strokeWidth={0} />
            ) : (
              <Mic className="h-7 w-7" strokeWidth={2} />
            )}
          </button>
          <span className="text-[13px] font-medium text-brand-red">{mandarinLabel}</span>
        </div>
      </div>

    </div>
  );
};

// Kept for backward compatibility with any external imports.
type DirectionButtonProps = {
  title: string;
  sub: string;
  from: string;
  to: string;
  activeLabel: string;
  speakOnePhrase: string;
  tapThenSpeak: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export const DirectionButton = forwardRef<HTMLButtonElement, DirectionButtonProps>(({
  title,
  activeLabel,
  active,
  disabled,
  onClick,
}, ref) => (
  <button
    ref={ref}
    onClick={onClick}
    disabled={disabled}
    className={
      "flex min-h-[56px] w-full items-center justify-center rounded-full text-[15px] font-semibold transition " +
      (active
        ? "bg-brand-red text-white"
        : "bg-surface-2 text-ink hover:bg-surface-3")
    }
  >
    {active ? activeLabel : title}
  </button>
));
DirectionButton.displayName = "DirectionButton";

// ---------------- Camera panel ----------------

type CameraResult = {
  id: string;
  imageUrl: string;
  source: string;
  translated: string;
  pinyin?: string;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(file);
  });

const downscaleImage = (dataUrl: string, maxDim = 1600, quality = 0.82) =>
  new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      if (scale === 1 && dataUrl.length < 1_500_000) {
        resolve(dataUrl);
        return;
      }
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const CameraPanel = ({
  tab,
  setTab,
  lang,
  t,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  lang: LangDef;
  t: UIText;
}) => {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<CameraResult[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // idle: prompt tap-to-start · starting: awaiting getUserMedia · live: stream attached
  // denied: NotAllowedError · unavailable: NotFoundError/NotReadableError/other
  type CamState = "idle" | "starting" | "live" | "denied" | "unavailable";
  const [camState, setCamState] = useState<CamState>("idle");

  const stopStream = () => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch { /* ignore */ }
    }
  };

  const hasMediaDevices = () =>
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";

  const startCamera = async () => {
    // Webviews without mediaDevices: silently fall through to native capture sheet.
    if (!hasMediaDevices()) {
      cameraRef.current?.click();
      return;
    }
    setCamState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Some webviews need an explicit play() after srcObject.
        try { await videoRef.current.play(); } catch { /* autoplay policy */ }
      }
      setCamState("live");
    } catch (err: any) {
      const name = String(err?.name ?? "");
      stopStream();
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCamState("denied");
      } else {
        // NotFoundError, NotReadableError, OverconstrainedError, AbortError, TypeError
        setCamState("unavailable");
      }
    }
  };

  // Stop the stream when leaving Camera mode.
  useEffect(() => {
    if (tab !== "camera") {
      stopStream();
      setCamState("idle");
    }
  }, [tab]);

  // Stop when the tab is backgrounded; re-tap to restart.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        stopStream();
        setCamState((s) => (s === "live" || s === "starting" ? "idle" : s));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Belt-and-braces: stop on unmount.
  useEffect(() => () => stopStream(), []);

  const processImage = async (raw: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    const timeoutMs = 45000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeoutMs)
    );
    try {
      const image = await downscaleImage(raw);
      setPreview(image);
      const { data, error } = (await Promise.race([
        supabase.functions.invoke("translate-image", {
          body: { image, from: "zh", to: lang.code },
        }),
        timeoutPromise,
      ])) as { data: any; error: any };
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const source = String(data?.source ?? "");
      const translated = String(data?.translated ?? "");
      const pinyin = String(data?.pinyin ?? "");
      if (!translated && !source) {
        toast.error(t.noText);
      } else {
        setResults((prev) => [
          { id: `cam-${Date.now()}`, imageUrl: image, source, translated, pinyin },
          ...prev,
        ]);
      }
    } catch (err: any) {
      console.error("translate-image failed", err);
      const msg = String(err?.message ?? "");
      if (msg === "timeout") {
        toast.error(t.couldntPhoto, { description: t.tryAgain });
      } else if (msg.includes("402") || /credits/i.test(msg)) {
        toast.error(t.creditsTitle, { description: t.creditsDesc });
      } else if (msg.includes("429")) {
        toast.error(t.tooMany, { description: t.tryMoment });
      } else {
        toast.error(t.couldntPhoto, { description: t.tryAgain });
      }
    } finally {
      inFlightRef.current = false;
      setBusy(false);
      setPreview(null);
    }
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t.chooseImage);
      return;
    }
    const raw = await fileToDataUrl(file);
    await processImage(raw);
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video || camState !== "live") return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    } catch {
      return;
    }
    // Stop the stream on capture; user re-taps to restart.
    stopStream();
    setCamState("idle");
    await processImage(dataUrl);
  };

  const openPhotoFallback = () => cameraRef.current?.click();

  // Camera panel takes over the viewport with a dark aesthetic.
  return (
    <div className="fixed inset-x-0 bottom-0 top-0 z-40 flex flex-col bg-[#0F1114] text-white">
      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          handleFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          handleFile(f);
          e.target.value = "";
        }}
      />

      {/* Top segmented tabs + close-to-return-to-app affordance */}
      <div className="px-4 pb-3 pt-safe-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setTab("chat")}
            aria-label="Close camera"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
          <h2 className="text-[17px] font-bold">Camera</h2>
          <button
            type="button"
            aria-label="Flash"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <Zap className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="mt-4">
          <SegmentedTabs tab={tab} setTab={setTab} t={t} dark />
        </div>
      </div>

      {/* Live overlay area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Live video stream — only visible when a stream is attached */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 h-full w-full object-cover ${camState === "live" ? "opacity-100" : "opacity-0"}`}
        />

        {/* LIVE · MENU chip — only while stream is actually live */}
        {camState === "live" && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
              <Languages className="h-3.5 w-3.5 text-brand-orange" strokeWidth={2.2} />
              <span className="text-brand-red">Live</span>
              <span className="text-white/40">·</span>
              <span>Menu</span>
            </div>
          </div>
        )}

        {/* Idle: tap-to-start overlay (webviews require a user gesture) */}
        {camState === "idle" && (
          <button
            type="button"
            onClick={startCamera}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/50 px-8 text-center text-white"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <CameraIcon className="h-7 w-7" strokeWidth={2} />
            </span>
            <span className="text-[16px] font-semibold">Tap to start camera</span>
            <span className="max-w-[260px] text-[13px] text-white/70">
              We'll ask for camera access. You can also pick a photo instead.
            </span>
          </button>
        )}

        {/* Starting: spinner */}
        {camState === "starting" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[13px] text-white/80">Starting camera…</span>
          </div>
        )}

        {/* Denied: permission error with photo fallback */}
        {camState === "denied" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 px-8 text-center text-white">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-red/20 ring-1 ring-brand-red/40">
              <CameraIcon className="h-6 w-6 text-brand-red" strokeWidth={2} />
            </span>
            <span className="text-[16px] font-semibold">Camera access denied</span>
            <span className="max-w-[280px] text-[13px] text-white/75">
              Enable camera access for eazilyChina in your device settings, then tap to try again.
            </span>
            <div className="mt-2 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setCamState("idle")}
                className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-ink"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={openPhotoFallback}
                className="rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-white ring-1 ring-white/20"
              >
                Take a photo instead
              </button>
            </div>
          </div>
        )}

        {/* Unavailable: no camera / in use */}
        {camState === "unavailable" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 px-8 text-center text-white">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <CameraIcon className="h-6 w-6" strokeWidth={2} />
            </span>
            <span className="text-[16px] font-semibold">Camera unavailable</span>
            <span className="max-w-[280px] text-[13px] text-white/75">
              We couldn't reach the camera. It may be in use by another app.
            </span>
            <button
              type="button"
              onClick={openPhotoFallback}
              className="mt-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-ink"
            >
              Take a photo instead
            </button>
          </div>
        )}

        {/* Preview / results stack */}
        <div className="absolute inset-x-0 top-14 z-10 space-y-2 px-4">
          {busy && preview && (
            <div className="flex items-center gap-3 rounded-2xl bg-black/70 p-3 text-white backdrop-blur">
              <img src={preview} alt={t.translating} className="h-14 w-14 rounded-lg object-cover" />
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Loader2 className="h-4 w-4 animate-spin" /> {t.reading}
              </div>
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => speak(r.translated, "en-US")}
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-black/70 px-4 py-3 text-left text-white backdrop-blur"
            >
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{r.translated || "—"}</div>
                {r.source && (
                  <div className="mt-0.5 truncate text-[12px] text-white/60">{r.source}</div>
                )}
              </div>
              <Volume2 className="h-4 w-4 shrink-0 text-white/70" />
            </button>
          ))}
        </div>

        {/* Helper text */}
        {camState === "live" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-32 z-10 flex justify-center px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[13px] text-white/85 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
              {results.length === 0 && !busy ? t.camEmpty : t.camFooter}
            </div>
          </div>
        )}

        {/* Neutral background behind the video / overlays */}
        <div className="absolute inset-0 -z-10 bg-[#0F1114]" />
      </div>

      {/* Bottom camera controls */}
      <div
        className="flex items-center justify-around gap-6 border-t border-white/10 bg-[#0F1114] px-6 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={busy}
          aria-label={t.pickGallery}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white disabled:opacity-50"
        >
          <ImagePlus className="h-5 w-5" strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={() => {
            if (busy) return;
            if (camState === "live") captureFrame();
            else if (camState === "idle") startCamera();
            else openPhotoFallback();
          }}
          disabled={busy || camState === "starting"}
          aria-label={t.takePhoto}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white ring-4 ring-white/25 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-ink" />
          ) : (
            <span className="h-14 w-14 rounded-full bg-white ring-2 ring-ink/10" />
          )}
        </button>

        {results.length > 0 ? (
          <button
            type="button"
            onClick={() => setResults([])}
            aria-label={t.clearResults}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Save"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white"
          >
            <Bookmark className="h-5 w-5" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
};
