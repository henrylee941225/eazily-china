import { supabase } from "@/integrations/supabase/client";

const MAX_BATCH_LENGTH = 1800;
const REQUEST_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_SPLIT_DEPTH = 2;
const HAN_CHARACTERS = /[\u3400-\u9fff]/u;

const cache = new Map<string, string>();
let nextRequestAt = 0;
let requestQueue: Promise<unknown> = Promise.resolve();

const wait = (milliseconds: number, signal?: AbortSignal): Promise<void> => new Promise((resolve) => {
  if (milliseconds <= 0 || signal?.aborted) return resolve();
  const timer = setTimeout(done, milliseconds);
  function done() {
    clearTimeout(timer);
    signal?.removeEventListener("abort", done);
    resolve();
  }
  signal?.addEventListener("abort", done, { once: true });
});

type BatchResult = "translated" | "mismatch" | "failed" | "aborted";

const translateBatch = (texts: string[], signal?: AbortSignal): Promise<BatchResult> => {
  const run = async () => {
    await wait(nextRequestAt - Date.now(), signal);
    if (signal?.aborted) return "aborted" as const;
    nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;

    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      abort();
    }, REQUEST_TIMEOUT_MS);
    try {
      const { data, error } = await supabase.functions.invoke("translate", {
        body: { text: texts.join("\n"), from: "zh", to: "en" },
        signal: controller.signal,
      });
      if (error || data?.error) throw error ?? new Error(String(data.error));
      const translated = String(data?.translated ?? "").split(/\r?\n/u).map((text) => text.trim());
      if (translated.length !== texts.length) {
        console.warn("POI translation line count mismatch", { expected: texts.length, received: translated.length });
        return "mismatch" as const;
      }
      texts.forEach((text, index) => {
        if (translated[index] && !HAN_CHARACTERS.test(translated[index])) {
          cache.set(text, translated[index]);
        }
      });
      const untranslatedCount = translated.filter((text) => !text || HAN_CHARACTERS.test(text)).length;
      if (untranslatedCount) console.warn("POI translation left Chinese text", { count: untranslatedCount });
      return "translated" as const;
    } catch (error) {
      if (timedOut) console.warn("POI translation timed out");
      else if (!signal?.aborted) {
        const context = error && typeof error === "object" && "context" in error ? error.context : null;
        if (context instanceof Response) {
          const details = await context.clone().json().catch(() => null);
          console.warn("POI translation unavailable", { status: context.status, details });
        } else {
          console.warn("POI translation unavailable", error);
        }
      }
      return signal?.aborted ? "aborted" as const : "failed" as const;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  };

  const result = requestQueue.then(run, run);
  requestQueue = result.then(() => undefined, () => undefined);
  return result;
};

const translateWithFallback = async (texts: string[], signal?: AbortSignal, depth = 0): Promise<void> => {
  const result = await translateBatch(texts, signal);
  if (result !== "mismatch" || texts.length === 1 || depth >= MAX_SPLIT_DEPTH || signal?.aborted) return;
  const middle = Math.ceil(texts.length / 2);
  await translateWithFallback(texts.slice(0, middle), signal, depth + 1);
  if (!signal?.aborted) await translateWithFallback(texts.slice(middle), signal, depth + 1);
};

export const translatePoiTexts = async (texts: string[], signal?: AbortSignal): Promise<string[]> => {
  const normalized = texts.map((text) => text.trim().replace(/\s+/gu, " "));
  const pending = [...new Set(normalized.filter((text) => HAN_CHARACTERS.test(text) && !cache.has(text)))];
  let batch: string[] = [];
  let length = 0;

  for (const text of pending) {
    if (text.length > MAX_BATCH_LENGTH) continue;
    if (batch.length && length + text.length + 1 > MAX_BATCH_LENGTH) {
      await translateWithFallback(batch, signal);
      if (signal?.aborted) break;
      batch = [];
      length = 0;
    }
    batch.push(text);
    length += text.length + (batch.length > 1 ? 1 : 0);
  }
  if (batch.length && !signal?.aborted) await translateWithFallback(batch, signal);

  return normalized.map((text, index) => cache.get(text) ?? texts[index]);
};
