import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Physical Android session 79317698 (2026-08-31): twelve brain replies, twelve
// speech dispatches, and the greeting plus nine replies logged `repeat_silent`
// against only eight AVATAR_SPEAK_STARTED events. speakViaProviderVoice detected
// every one of those and then only WROTE THEM DOWN. The person heard nothing.
//
// These tests pin the recovery that was restored, and — just as important —
// pin the three ways it must refuse to speak, because the recovery that was
// removed in August was removed for causing double audio.

const SPEAK_STARTED = "avatar_speak_started";

vi.mock("@heygen/liveavatar-web-sdk", () => ({
  AgentEventsEnum: { AVATAR_SPEAK_STARTED: SPEAK_STARTED },
  LiveAvatarSession: class {},
}));

vi.mock("../../src/lib/voiceMode/pcm", () => ({
  pcm16Base64ToAudioBuffer: vi.fn(() => ({})),
}));

type Listener = (event?: { event_id?: string }) => void;

function fakeSession(overrides: Partial<Record<string, unknown>> = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const session = {
    listeners,
    repeat: vi.fn(() => "event-1"),
    interrupt: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    on: vi.fn((name: string, fn: Listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(fn);
    }),
    off: vi.fn((name: string, fn: Listener) => {
      listeners.get(name)?.delete(fn);
    }),
    emit(name: string, event?: { event_id?: string }) {
      for (const fn of [...(listeners.get(name) ?? [])]) fn(event);
    },
    ...overrides,
  };
  return session;
}

function ttsResponse(audio: string | null, ok = true) {
  return {
    ok,
    json: async () => (audio === null ? {} : { audio }),
  };
}

const AUDIO = "A".repeat(400);

async function loadModule() {
  return import("../../src/liveavatar/customVoiceDelivery");
}

describe("silent provider speech is recovered with our own audio, exactly once", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    fetchMock = vi.fn(async () => ttsResponse(AUDIO));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
      clearTimeout: (id: number) => clearTimeout(id),
    });
    vi.stubGlobal("AudioContext", class {
      state = "running";
      async resume() {}
      createBufferSource() {
        return {
          buffer: null,
          connect() {},
          start() {
            queueMicrotask(() => this.onended?.());
          },
          stop() {},
          onended: null as null | (() => void),
        };
      }
      createGain() {
        return { gain: { value: 1 }, connect() {} };
      }
      createMediaStreamDestination() {
        return { stream: {} };
      }
      createBuffer() {
        return {};
      }
      get destination() {
        return {};
      }
    });
    vi.stubGlobal("Audio", class {
      srcObject: unknown = null;
      autoplay = false;
      muted = false;
      play() {
        return Promise.resolve();
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("re-voices a reply the provider accepted and then never spoke", async () => {
    const { speakViaProviderVoice } = await loadModule();
    const session = fakeSession();
    const rescued: string[] = [];
    const stages: Array<{ stage: string; reason?: string }> = [];

    speakViaProviderVoice(
      session as never,
      "aiASAP can help with that.",
      "textchat.reply",
      (reason) => rescued.push(reason),
      (event) => stages.push({ stage: event.stage, reason: event.reason }),
    );

    // AVATAR_SPEAK_STARTED never fires; the watchdog expires.
    await vi.advanceTimersByTimeAsync(5500);
    await vi.waitFor(() =>
      expect(stages.some((s) => s.stage === "audio_recovery_finished")).toBe(true),
    );

    expect(rescued).toEqual(["repeat_silent"]);
    // the failure is still reported honestly, not swallowed by the recovery
    expect(stages.map((s) => s.stage)).toContain("audio_recovery_started");
    expect(
      stages.find((s) => s.stage === "audio_recovery_finished")?.reason,
    ).toBe("spoken");

    // real audio, from the existing route, exactly one call
    const ttsCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/elevenlabs-text-to-speech"),
    );
    expect(ttsCalls).toHaveLength(1);

    // the possibly-late original is cancelled BEFORE the fallback plays, so one
    // reply can never become two audible replies
    expect(session.interrupt).toHaveBeenCalledTimes(1);
    // and it never minted or started a second provider session
    expect(session.repeat).toHaveBeenCalledTimes(1);
  });

  it("does not report spoken when the recovery speaker is muted", async () => {
    const { setCustomVoiceMuted, speakViaProviderVoice } = await loadModule();
    const session = fakeSession();
    const stages: Array<{ stage: string; reason?: string }> = [];
    setCustomVoiceMuted(true);

    speakViaProviderVoice(
      session as never,
      "This line must not be reported as audible.",
      "textchat.reply",
      undefined,
      (event) => stages.push({ stage: event.stage, reason: event.reason }),
    );

    await vi.advanceTimersByTimeAsync(5500);
    await vi.waitFor(() =>
      expect(stages.some((s) => s.stage === "audio_recovery_finished")).toBe(true),
    );
    expect(
      stages.find((s) => s.stage === "audio_recovery_finished")?.reason,
    ).toBe("tts_failed");
  });

  it("recovers a rejected repeat and a thrown repeat too", async () => {
    const { speakViaProviderVoice } = await loadModule();

    const rejecting = fakeSession({
      repeat: vi.fn(() => Promise.reject(new Error("nope"))),
    });
    const rejectedReasons: string[] = [];
    speakViaProviderVoice(
      rejecting as never,
      "one",
      "textchat.reply",
      (reason) => rejectedReasons.push(reason),
    );
    await vi.advanceTimersByTimeAsync(50);
    expect(rejectedReasons).toEqual(["repeat_rejected"]);
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          String(url).includes("elevenlabs"),
        ).length,
      ).toBe(1),
    );

    fetchMock.mockClear();
    const throwing = fakeSession({
      repeat: vi.fn(() => {
        throw new Error("boom");
      }),
    });
    const thrownReasons: string[] = [];
    speakViaProviderVoice(
      throwing as never,
      "two",
      "textchat.reply",
      (reason) => thrownReasons.push(reason),
    );
    await vi.advanceTimersByTimeAsync(50);
    expect(thrownReasons).toEqual(["repeat_threw"]);
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          String(url).includes("elevenlabs"),
        ).length,
      ).toBe(1),
    );
  });

  it("stays quiet when the provider really did speak", async () => {
    const { bindAvatarAudioPresentationProbe, speakViaProviderVoice } = await loadModule();
    const session = fakeSession();
    const rescued: string[] = [];
    const evidence = {} as never;
    const unbind = bindAvatarAudioPresentationProbe(session as never, {
      prime: vi.fn(async () => {}),
      notePlayResult: vi.fn(),
      snapshot: vi.fn(() => evidence),
      observe: vi.fn(async () => ({
        presented: true,
        suppressed: false,
        reason: "media_audio_observed" as const,
        evidence,
      })),
      recover: vi.fn(),
      dispose: vi.fn(),
    });

    speakViaProviderVoice(
      session as never,
      "hello",
      "textchat.reply",
      (reason) => rescued.push(reason),
    );
    session.emit(SPEAK_STARTED, { event_id: "event-1" });
    await vi.advanceTimersByTimeAsync(4000);

    expect(rescued).toEqual([]);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("elevenlabs")),
    ).toHaveLength(0);
    unbind();
  });

  it("accepts the provider start even when HeyGen replaces the command event id", async () => {
    const { bindAvatarAudioPresentationProbe, speakViaProviderVoice } =
      await loadModule();
    const session = fakeSession();
    const rescued: string[] = [];
    const evidence = {} as never;
    const unbind = bindAvatarAudioPresentationProbe(session as never, {
      prime: vi.fn(async () => {}),
      notePlayResult: vi.fn(),
      snapshot: vi.fn(() => evidence),
      observe: vi.fn(async () => ({
        presented: true,
        suppressed: false,
        reason: "media_audio_observed" as const,
        evidence,
      })),
      recover: vi.fn(),
      dispose: vi.fn(),
    });

    speakViaProviderVoice(
      session as never,
      "hello",
      "textchat.reply",
      (reason) => rescued.push(reason),
    );
    // Supabase showed this exact shape: the SDK's global listener observed
    // AVATAR_SPEAK_STARTED, but the per-reply watchdog still fired. HeyGen's
    // start event can carry a different id from repeat()'s command id.
    session.emit(SPEAK_STARTED, { event_id: "provider-event-99" });
    await vi.advanceTimersByTimeAsync(4000);

    expect(rescued).toEqual([]);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("elevenlabs")),
    ).toHaveLength(0);
    unbind();
  });

  it("lets the observed 4.005-second native start animate before WebAudio recovery", async () => {
    const { bindAvatarAudioPresentationProbe, speakViaProviderVoice } = await loadModule();
    const session = fakeSession();
    const rescued: string[] = [];
    const evidence = {} as never;
    const unbind = bindAvatarAudioPresentationProbe(session as never, {
      prime: vi.fn(async () => {}),
      notePlayResult: vi.fn(),
      snapshot: vi.fn(() => evidence),
      observe: vi.fn(async () => ({
        presented: true,
        suppressed: false,
        reason: "media_audio_observed" as const,
        evidence,
      })),
      recover: vi.fn(),
      dispose: vi.fn(),
    });

    speakViaProviderVoice(
      session as never,
      "native mouth animation wins",
      "textchat.reply",
      (reason) => rescued.push(reason),
    );
    await vi.advanceTimersByTimeAsync(4005);
    session.emit(SPEAK_STARTED, { event_id: "late-native" });
    await vi.advanceTimersByTimeAsync(1500);

    expect(rescued).toEqual([]);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("elevenlabs")),
    ).toHaveLength(0);
    unbind();
  });

  it("does not speak over a newer reply that has taken the floor", async () => {
    const { speakViaProviderVoice } = await loadModule();
    const session = fakeSession();
    const stages: Array<{ stage: string; reason?: string }> = [];

    speakViaProviderVoice(
      session as never,
      "older reply",
      "textchat.reply",
      undefined,
      (event) => stages.push({ stage: event.stage, reason: event.reason }),
    );
    // A newer accepted turn claims the pipe before the watchdog expires.
    speakViaProviderVoice(session as never, "newer reply", "textchat.reply");
    await vi.advanceTimersByTimeAsync(5500);

    // The older line is settled by the newer one and never rescued at all.
    expect(stages.some((s) => s.stage === "audio_recovery_started")).toBe(false);
  });

  it("does not speak after a barge-in or QUIET cut the line", async () => {
    const { speakViaProviderVoice, cutCustomVoiceFallback } = await loadModule();
    const session = fakeSession();
    const rescued: string[] = [];
    const stages: string[] = [];

    speakViaProviderVoice(
      session as never,
      "interrupted reply",
      "textchat.reply",
      (reason) => rescued.push(reason),
      (event) => stages.push(event.stage),
    );
    cutCustomVoiceFallback(); // barge-in / QUIET / STOP
    await vi.advanceTimersByTimeAsync(5500);

    expect(rescued).toEqual([]);
    expect(stages).not.toContain("audio_recovery_started");
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("elevenlabs")),
    ).toHaveLength(0);
  });

  it("reports honestly and stays silent when our own TTS also fails", async () => {
    const { speakViaProviderVoice } = await loadModule();
    fetchMock.mockImplementation(async () => ttsResponse(null, false));
    const session = fakeSession();
    const stages: Array<{ stage: string; reason?: string }> = [];

    speakViaProviderVoice(
      session as never,
      "reply",
      "textchat.reply",
      undefined,
      (event) => stages.push({ stage: event.stage, reason: event.reason }),
    );
    await vi.advanceTimersByTimeAsync(5500);
    await vi.waitFor(() =>
      expect(stages.some((s) => s.stage === "audio_recovery_finished")).toBe(true),
    );

    expect(
      stages.find((s) => s.stage === "audio_recovery_finished")?.reason,
    ).toBe("tts_failed");
  });

  it("never recovers an unobservable dispatch, only a proven-silent one", async () => {
    const { speakViaProviderVoice } = await loadModule();
    const session = fakeSession({
      on: vi.fn(() => {
        throw new Error("no listener support");
      }),
    });
    const rescued: string[] = [];

    speakViaProviderVoice(
      session as never,
      "reply",
      "textchat.reply",
      (reason) => rescued.push(reason),
    );
    await vi.advanceTimersByTimeAsync(5500);

    expect(rescued).toEqual(["provider_listener_unavailable"]);
    // unobservable is NOT proven silent: guessing here is how you get 6 saying
    // everything twice
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("elevenlabs")),
    ).toHaveLength(0);
  });
});
