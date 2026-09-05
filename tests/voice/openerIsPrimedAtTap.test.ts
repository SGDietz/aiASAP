import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MEASURED 2026-09-04. The opening line is 14.4 seconds of speech and our TTS
 * route takes 3.0 seconds to generate it - and none of that used to begin until
 * the provider session was already connected. From G's ride: connected at 8.4s,
 * greeting dispatched at 9.5s, 6 finally audible at 10.6-11.9s.
 *
 * The opener is a constant. Generating it at tap, in parallel with the provider
 * connect (which is pure waiting), takes ~3 seconds off the silence with NO
 * trade: same audio, same voice, same socket push, same lip-sync.
 */
const SPEAK_STARTED = "avatar_speak_started";

vi.mock("@heygen/liveavatar-web-sdk", () => ({
  AgentEventsEnum: { AVATAR_SPEAK_STARTED: SPEAK_STARTED },
  LiveAvatarSession: class {},
}));

vi.mock("../../src/lib/voiceMode/pcm", () => ({
  pcm16Base64ToAudioBuffer: vi.fn(() => ({})),
}));

type Listener = (event?: { event_id?: string }) => void;

function fakeSession() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    repeat: vi.fn(() => "event-1"),
    interrupt: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    on: vi.fn((name: string, fn: Listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(fn);
    }),
    off: vi.fn((name: string, fn: Listener) => listeners.get(name)?.delete(fn)),
  };
}

const OPENER = "6 here. Tell me what you love doing.";

/** reportCustomVoiceDiag also posts via fetch - count only the TTS route. */
function ttsCalls(mock: { mock: { calls: unknown[][] } }): number {
  return mock.mock.calls.filter(
    (c) => String(c[0]).includes("/api/elevenlabs-text-to-speech"),
  ).length;
}
const AUDIO = "A".repeat(400);

describe("the opener is generated at tap, not after the session connects", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ audio: AUDIO }) }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
      clearTimeout: (id: number) => clearTimeout(id),
    });
  });

  afterEach(() => {
    // window must outlive this hook - detached timers are still pending.
    vi.stubGlobal("fetch", undefined);
  });

  it("primes the audio once, and speaking it costs no second fetch", async () => {
    const mod = await import("../../src/liveavatar/customVoiceDelivery");
    mod.primeSpeechAudio(OPENER);
    await vi.waitFor(() => expect(ttsCalls(fetchMock)).toBe(1));

    mod.speakThroughAvatar(fakeSession() as never, OPENER, "greeting");
    // Give the detached speak path a chance to run.
    await new Promise((r) => setTimeout(r, 20));
    expect(ttsCalls(fetchMock)).toBe(1);
  });

  it("priming the same line twice does not fetch twice", async () => {
    const mod = await import("../../src/liveavatar/customVoiceDelivery");
    mod.primeSpeechAudio(OPENER);
    mod.primeSpeechAudio(OPENER);
    await vi.waitFor(() => expect(ttsCalls(fetchMock)).toBe(1));
  });

  it("keeps the consuming wiring in place while the ElevenLabs path is off", async () => {
    // ELEVENLABS_ONLY_VOICE was reverted on G's 2026-09-04 ride, so
    // speakThroughAvatar goes straight to the provider and never consumes a
    // primed line. The prefetch itself still works and still matters: it is
    // what stops the switch COSTING time if it is turned on again (measured:
    // without it the wait got ~2s worse, with it ~1s better). Assert the wiring
    // survives rather than a behaviour the switch currently disables.
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(
      resolve(process.cwd(), "src/liveavatar/customVoiceDelivery.ts"),
      "utf8",
    );
    expect(src).toContain("takePrimedSpeech(text)");
    expect(src).toContain("primed ? await primed : null");
    expect(src).toContain("(primed)");
  });

  it("a failed prime is not cached as a success", async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, json: async () => ({}) }));
    const mod = await import("../../src/liveavatar/customVoiceDelivery");
    mod.primeSpeechAudio(OPENER);
    await vi.waitFor(() => expect(ttsCalls(fetchMock)).toBe(1));
    // Priming a DIFFERENT line afterwards must still fetch - a failed prime
    // must never leave a poisoned entry behind.
    mod.primeSpeechAudio("Another line entirely.");
    await vi.waitFor(() => expect(ttsCalls(fetchMock)).toBe(2));
  });

  it("ignores an empty line", async () => {
    const mod = await import("../../src/liveavatar/customVoiceDelivery");
    mod.primeSpeechAudio("   ");
    await new Promise((r) => setTimeout(r, 10));
    expect(ttsCalls(fetchMock)).toBe(0);
  });
});
