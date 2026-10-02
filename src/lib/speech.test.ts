import { afterEach, describe, expect, it, vi } from "vitest";
import { speak } from "./speech";

describe("speech playback", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the engine's locale default while its voice list is loading", () => {
    const synth = {
      getVoices: vi.fn(() => []),
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    class Utterance {
      lang = "";
      voice: SpeechSynthesisVoice | null = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal("speechSynthesis", synth);
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);

    expect(speak("Guten Tag", "de-DE")).toBe(true);
    expect(synth.cancel).toHaveBeenCalledOnce();
    expect(synth.speak).toHaveBeenCalledWith(expect.objectContaining({
      text: "Guten Tag",
      lang: "de-DE",
      voice: null,
    }));
  });

  it("declines playback when loaded voices do not support the locale", () => {
    const synth = {
      getVoices: vi.fn(() => [{ name: "English", lang: "en-US", localService: true }]),
      cancel: vi.fn(),
      speak: vi.fn(),
    };
    vi.stubGlobal("speechSynthesis", synth);

    expect(speak("Guten Tag", "de-DE")).toBe(false);
    expect(synth.speak).not.toHaveBeenCalled();
  });
});
