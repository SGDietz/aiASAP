import { afterEach, describe, expect, it, vi } from "vitest";

describe("silent avatar speech fault reporting", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("signals the session fault once while attempting one bounded rescue per silent reply", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const {
      speakViaProviderVoice,
      subscribeAvatarSpeechFailure,
    } = await import("../../src/liveavatar/customVoiceDelivery");

    const listeners = new Map<unknown, Set<() => void>>();
    const session = {
      on: vi.fn((event: unknown, listener: () => void) => {
        const set = listeners.get(event) ?? new Set<() => void>();
        set.add(listener);
        listeners.set(event, set);
      }),
      off: vi.fn((event: unknown, listener: () => void) => {
        listeners.get(event)?.delete(listener);
      }),
      repeat: vi.fn(async () => undefined),
    };
    const failures: Array<{ where: string; reason: string }> = [];
    const unsubscribe = subscribeAvatarSpeechFailure((failure) => {
      failures.push({ where: failure.where, reason: failure.reason });
    });

    speakViaProviderVoice(session as never, "First line", "test.first");
    await vi.advanceTimersByTimeAsync(5_000);
    speakViaProviderVoice(session as never, "Second line", "test.second");
    await vi.advanceTimersByTimeAsync(5_000);

    expect(failures).toEqual([
      { where: "test.first", reason: "repeat_silent" },
    ]);
    expect(session.repeat).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/elevenlabs-text-to-speech"),
      ),
    ).toHaveLength(2);
    unsubscribe();
  });
});
