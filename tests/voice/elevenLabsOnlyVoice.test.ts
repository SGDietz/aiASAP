import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// ONE VOICE, EVERY TIME.
//
// G, 2026-08-22: "Can we have ElevenLabs doing all the voice, direct... every
// single time, even when the avatar is showing... I'd like to give it a full
// try." He then hit both of the faults it fixes on his 2026-09-03 rides:
// `repeat_silent` at severity HIGH four times in one day, and "that was a
// different voice, we're playing different voices here."
//
// TRIED, TURNED OFF 2026-09-03 23:00 (ride cf79a533), TURNED BACK ON
// 2026-09-04 on G's order. The precondition this file set - "fix
// trySpeakViaSocketBase64 first" - is done: a socket that has not connected
// yet no longer marks the pipe dead, and the push now succeeds 302/306 across
// all recorded rides.
//
// The other complaint, "it's an odd voice, it's not the real voice", was not
// the engine. Both voice ids were read from their own APIs on 2026-09-04 and
// they are the SAME voice by name:
//   ELEVENLABS_VOICE_ID vBIaixhF... -> "6-20251218-Nailed"
//   LIVEAVATAR_VOICE_ID a65a59af... -> "6-20251218-Nailed"
// It sounded wrong because it was playing out of band through the
// echo-cancelling WebAudio fallback instead of the avatar socket - the same
// single bug that took the lip-sync away.
//
// STILL UNPROVEN BY EARS: lip-sync on a real ride. One constant flips it back.
// ---------------------------------------------------------------------------

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

const AUDIO = "A".repeat(400);

describe("the one-voice switch, now on", () => {
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
    // Only fetch. The window stub must OUTLIVE this hook: the module schedules
    // detached timers (the socket-open poll, the fallback queue's mic-resume
    // tail), and tearing window down under a pending timer threw
    // "window is not defined" into the run as an unhandled error.
    vi.stubGlobal("fetch", undefined);
  });

  it("is ON: every line is generated once by ElevenLabs, never by the provider", async () => {
    const mod = await import("../../src/liveavatar/customVoiceDelivery");
    const session = fakeSession();
    mod.speakThroughAvatar(session as never, "Can I send that to Scott?", "test.line");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("/api/elevenlabs-text-to-speech");
    expect(JSON.parse(init.body).text).toBe("Can I send that to Scott?");
    // No voice_id override: the route uses ELEVENLABS_VOICE_ID, which is the
    // same "6-20251218-Nailed" voice the provider speaks with.
    expect(JSON.parse(init.body).voice_id).toBeUndefined();
    // The provider's own TTS is retired while the switch is on - one engine,
    // so a conversation can never come out in two voices.
    expect(session.repeat).not.toHaveBeenCalled();
  });

  it("falls back to the provider voice if ElevenLabs cannot be reached", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({}) }));
    const mod = await import("../../src/liveavatar/customVoiceDelivery");
    const session = fakeSession();
    mod.speakThroughAvatar(session as never, "Can I send that to Scott?", "test.line");
    // Silence would be worse than a different voice - and the swap is logged.
    await vi.waitFor(() =>
      expect(session.repeat).toHaveBeenCalledWith("Can I send that to Scott?"),
    );
  });

  it("keeps the switch a single constant so it can be tried again", async () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/liveavatar/customVoiceDelivery.ts"),
      "utf8",
    );
    expect(src).toContain("const ELEVENLABS_ONLY_VOICE = true;");
    // the whole mechanism is still there, behind that one word
    expect(src).toContain("deliverCustomTtsAudio(session, audio, where)");
    expect(src).toContain("elevenlabs_unavailable");
  });

  it("says nothing at all for an empty line", async () => {
    const { speakThroughAvatar } = await import("../../src/liveavatar/customVoiceDelivery");
    const session = fakeSession();
    speakThroughAvatar(session as never, "   ", "test.empty");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(session.repeat).not.toHaveBeenCalled();
  });

  it("keeps the provider path exported so its own guarantees stay under test", async () => {
    const mod = await import("../../src/liveavatar/customVoiceDelivery");
    expect(typeof mod.speakViaProviderVoice).toBe("function");
  });
});
