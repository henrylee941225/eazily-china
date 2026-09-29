// Microphone capture for Translate > Talk.
//
// The Web Speech API is unavailable in iOS WKWebView (the Median container) and
// unreliable in Android WebView, so capture is done with getUserMedia + Web
// Audio: PCM is buffered, downsampled to 16 kHz mono and encoded as a complete
// WAV file per utterance, then transcribed server-side (`transcribe` function).
//
// Utterances end automatically after a short silence (voice-activity detection)
// so a conversation needs one tap per turn, not two. A hard cap stops a mic
// that has been forgotten.

export const SILENCE_MS = 1500;
export const MAX_UTTERANCE_MS = 60_000;
/** RMS below this counts as silence. Empirically quiet-room level. */
const SILENCE_RMS = 0.012;
/** Ignore silence until some speech has actually been heard. */
const SPEECH_RMS = 0.02;
const TARGET_RATE = 16_000;

export type StopReason = "silence" | "manual" | "capped" | "error";

export const micAvailable = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === "function" &&
  typeof (window as any).AudioContext !== "undefined";

const downsample = (input: Float32Array, from: number, to: number): Float32Array => {
  if (to >= from) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
};

const encodeWav = (chunks: Float32Array[], sampleRate: number): Blob => {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    samples.set(c, offset);
    offset += c.length;
  }
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let pos = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    pos += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
};

export type Utterance = {
  /** Complete 16 kHz mono WAV file. */
  blob: Blob;
  reason: StopReason;
  /** true when the clip carried no detectable speech. */
  silent: boolean;
};

export type CaptureHandle = {
  /** End the utterance now and resolve the pending promise. */
  stop: () => void;
  /** Abort without producing an utterance. */
  cancel: () => void;
};

/**
 * Start capturing one utterance. Resolves when silence, the manual stop or the
 * hard cap ends it. Rejects when the microphone is unavailable or denied.
 */
export const captureUtterance = async (
  onLevel?: (rms: number) => void,
): Promise<{ handle: CaptureHandle; done: Promise<Utterance> }> => {
  if (!micAvailable()) throw new Error("mic-unavailable");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new (window as any).AudioContext() as AudioContext;
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);

  const chunks: Float32Array[] = [];
  let heardSpeech = false;
  let silenceSince: number | null = null;
  let settled = false;
  let capTimer: number | null = null;

  let resolveDone!: (u: Utterance) => void;
  let rejectDone!: (e: unknown) => void;
  const done = new Promise<Utterance>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });

  const teardown = () => {
    if (capTimer != null) window.clearTimeout(capTimer);
    capTimer = null;
    try { processor.disconnect(); } catch { /* noop */ }
    try { source.disconnect(); } catch { /* noop */ }
    stream.getTracks().forEach((tr) => tr.stop());
    ctx.close().catch(() => { /* noop */ });
  };

  const finish = (reason: StopReason) => {
    if (settled) return;
    settled = true;
    teardown();
    const blob = encodeWav(chunks.map((c) => downsample(c, ctx.sampleRate, TARGET_RATE)), TARGET_RATE);
    resolveDone({ blob, reason, silent: !heardSpeech || blob.size < 4096 });
  };

  processor.onaudioprocess = (e) => {
    if (settled) return;
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    const rms = Math.sqrt(sum / input.length);
    onLevel?.(rms);
    const now = Date.now();
    if (rms > SPEECH_RMS) {
      heardSpeech = true;
      silenceSince = null;
    } else if (rms < SILENCE_RMS) {
      if (silenceSince == null) silenceSince = now;
      else if (heardSpeech && now - silenceSince >= SILENCE_MS) finish("silence");
    } else {
      silenceSince = null;
    }
  };

  source.connect(processor);
  // Required for the processor to run in some engines; gain is muted.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  processor.connect(mute);
  mute.connect(ctx.destination);

  capTimer = window.setTimeout(() => finish("capped"), MAX_UTTERANCE_MS);

  return {
    handle: {
      stop: () => finish("manual"),
      cancel: () => {
        if (settled) return;
        settled = true;
        teardown();
        rejectDone(new Error("cancelled"));
      },
    },
    done,
  };
};
