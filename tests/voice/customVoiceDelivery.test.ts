import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEventsEnum, type LiveAvatarSession } from "@heygen/liveavatar-web-sdk";
import {
  bindAvatarAudioPresentationProbe,
  cutCustomVoiceFallback,
  registerSixSpokenLine,
  setCustomVoiceMuted,
  speakThroughAvatar,
  wasRecentlySpokenBySix,
} from "../../src/liveavatar/customVoiceDelivery";
import type {
  AvatarAudioPresentationEvidence,
  AvatarAudioPresentationProbe,
  AvatarAudioPresentationResult,
} from "../../src/liveavatar/avatarAudioPresentation";

type Handler = (event?: { event_id?: string }) => void;

const audibleEvidence: AvatarAudioPresentationEvidence = {
  elementPresent: true,
  streamAttached: true,
  audioTrackCount: 1,
  liveAudioTrack: true,
  unmutedAudioTrack: true,
  enabledAudioTrack: true,
  audioUnlocked: true,
  intentionallyMuted: false,
  elementMuted: false,
  volume: 1,
  paused: false,
  readyState: 4,
  playStatus: "resolved",
  attachStatus: "unattempted",
  audioContextState: "running",
  nonZeroAudioSamples: true,
  sampleRms: 0.08,
};

const audibleResult: AvatarAudioPresentationResult = {
  presented: true,
  suppressed: false,
  reason: "media_audio_observed",
  evidence: audibleEvidence,
};

const silentResult: AvatarAudioPresentationResult = {
  presented: false,
  suppressed: false,
  reason: "audio_samples_silent",
  evidence: {
    ...audibleEvidence,
    nonZeroAudioSamples: false,
    sampleRms: 0,
  },
};

function makeProbe(args?: {
  observations?: AvatarAudioPresentationResult[];
  recovery?: AvatarAudioPresentationResult;
}) {
  const observations = [...(args?.observations ?? [audibleResult])];
  const probe: AvatarAudioPresentationProbe = {
    prime: vi.fn(async () => undefined),
    notePlayResult: vi.fn(),
    snapshot: vi.fn(() => observations[0]?.evidence ?? audibleEvidence),
    observe: vi.fn(async () => observations.shift() ?? audibleResult),
    recover: vi.fn(async () => args?.recovery ?? silentResult),
    dispose: vi.fn(),
  };
  return probe;
}

function makeMockSession() {
  const listeners = new Map<string, Set<Handler>>();
  let repeatId = 0;
  const raw = {
    on: vi.fn((event: string, handler: Handler) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: Handler) => listeners.get(event)?.delete(handler)),
    repeat: vi.fn(() => `repeat-${++repeatId}`),
  };
  return {
    session: raw as unknown as LiveAvatarSession,
    emit(event: string, eventId = `repeat-${repeatId}`) {
      listeners
        .get(event)
        ?.forEach((handler) => handler({ event_id: eventId }));
    },
    repeat: raw.repeat,
  };
}

async function flushPresentation(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
  vi.stubGlobal("window", {
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof clearTimeout>) => clearTimeout(...args),
  });
});

afterEach(() => {
  setCustomVoiceMuted(false);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("custom voice echo attribution", () => {
  it("keeps near-real-time acoustic echo protected after audible media proof", async () => {
    const { session, emit } = makeMockSession();
    bindAvatarAudioPresentationProbe(session, makeProbe());
    const line = "Perfect. Want me to send the sign-in link to that email now?";
    speakThroughAvatar(session, line, "signup.offer");
    registerSixSpokenLine(line);
    emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);
    await flushPresentation();
    vi.advanceTimersByTime(400);
    expect(wasRecentlySpokenBySix("Perfect want me to send the sign in link to that email now")).toBe(true);
  });

  it("does not swallow distinct delayed send-link consent", async () => {
    const { session, emit } = makeMockSession();
    bindAvatarAudioPresentationProbe(session, makeProbe());
    const line = "Perfect. Want me to send the sign-in link to that email now?";
    speakThroughAvatar(session, line, "signup.offer");
    registerSixSpokenLine(line);
    emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);
    await flushPresentation();
    vi.advanceTimersByTime(18_000);
    expect(wasRecentlySpokenBySix("Send the sign-in link")).toBe(false);
  });
});

describe("custom voice media presentation", () => {
  it("does not accept provider speak-start when the remote audio stays silent", async () => {
    const { session, emit, repeat } = makeMockSession();
    const probe = makeProbe({
      observations: [silentResult, silentResult],
      recovery: silentResult,
    });
    bindAvatarAudioPresentationProbe(session, probe);
    const onRescue = vi.fn();
    const stages: string[] = [];

    speakThroughAvatar(session, "Talk to me now, buddy.", "turn", onRescue, (event) => {
      stages.push(event.stage);
    });
    emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);
    await flushPresentation();

    expect(repeat).toHaveBeenCalledTimes(1);
    expect(probe.recover).toHaveBeenCalledTimes(1);
    expect(onRescue).toHaveBeenCalledTimes(1);
    expect(onRescue).toHaveBeenCalledWith("media_not_presented");
    expect(stages).toEqual([
      "provider_started",
      "initial_probe",
      "media_recovery_started",
      "media_recovery_finished",
      "recovery_probe",
    ]);
  });

  it("accepts non-zero audio on the live unmuted playing media path", async () => {
    const { session, emit, repeat } = makeMockSession();
    const probe = makeProbe({ observations: [audibleResult] });
    bindAvatarAudioPresentationProbe(session, probe);
    const onRescue = vi.fn();

    speakThroughAvatar(session, "You can help me make money.", "turn", onRescue);
    emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);
    await flushPresentation();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(repeat).toHaveBeenCalledTimes(1);
    expect(probe.recover).not.toHaveBeenCalled();
    expect(onRescue).not.toHaveBeenCalled();
  });

  it("cancels an older media probe before it can recover a superseded reply", async () => {
    const first = makeMockSession();
    let resolveFirst!: (result: AvatarAudioPresentationResult) => void;
    const firstProbe = makeProbe();
    firstProbe.observe = vi.fn(
      () =>
        new Promise<AvatarAudioPresentationResult>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    bindAvatarAudioPresentationProbe(first.session, firstProbe);
    const firstRescue = vi.fn();
    speakThroughAvatar(first.session, "old reply", "old", firstRescue);
    first.emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);

    const second = makeMockSession();
    const secondProbe = makeProbe({ observations: [audibleResult] });
    bindAvatarAudioPresentationProbe(second.session, secondProbe);
    speakThroughAvatar(second.session, "new reply", "new");
    second.emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);
    resolveFirst(silentResult);
    await flushPresentation();

    expect(firstProbe.recover).not.toHaveBeenCalled();
    expect(firstRescue).not.toHaveBeenCalled();
    expect(secondProbe.recover).not.toHaveBeenCalled();
  });

  it("cancels presentation recovery on STOP and disposes the bound probe", async () => {
    const { session, emit } = makeMockSession();
    let resolveObservation!: (result: AvatarAudioPresentationResult) => void;
    const probe = makeProbe();
    probe.observe = vi.fn(
      () =>
        new Promise<AvatarAudioPresentationResult>((resolve) => {
          resolveObservation = resolve;
        }),
    );
    const unbind = bindAvatarAudioPresentationProbe(session, probe);
    const onRescue = vi.fn();
    speakThroughAvatar(session, "reply", "turn", onRescue);
    emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);

    cutCustomVoiceFallback();
    resolveObservation(silentResult);
    await flushPresentation();
    unbind();

    expect(probe.recover).not.toHaveBeenCalled();
    expect(onRescue).not.toHaveBeenCalled();
    expect(probe.dispose).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending presentation probe when the stage unmounts", async () => {
    const { session, emit } = makeMockSession();
    let resolveObservation!: (result: AvatarAudioPresentationResult) => void;
    const probe = makeProbe();
    probe.observe = vi.fn(
      () =>
        new Promise<AvatarAudioPresentationResult>((resolve) => {
          resolveObservation = resolve;
        }),
    );
    const unbind = bindAvatarAudioPresentationProbe(session, probe);
    const onRescue = vi.fn();
    speakThroughAvatar(session, "reply", "turn", onRescue);
    emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);

    unbind();
    resolveObservation(silentResult);
    await flushPresentation();

    expect(probe.recover).not.toHaveBeenCalled();
    expect(onRescue).not.toHaveBeenCalled();
    expect(probe.dispose).toHaveBeenCalledTimes(1);
  });

  it.each(["quiet", "barge-in"] as const)(
    "cancels a pending media recovery on %s",
    async (interruption) => {
      const { session, emit } = makeMockSession();
      let resolveObservation!: (result: AvatarAudioPresentationResult) => void;
      const probe = makeProbe();
      probe.observe = vi.fn(
        () =>
          new Promise<AvatarAudioPresentationResult>((resolve) => {
            resolveObservation = resolve;
          }),
      );
      bindAvatarAudioPresentationProbe(session, probe);
      const onRescue = vi.fn();
      speakThroughAvatar(session, "reply", "turn", onRescue);
      emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);

      if (interruption === "quiet") setCustomVoiceMuted(true);
      else cutCustomVoiceFallback();
      resolveObservation(silentResult);
      await flushPresentation();

      expect(probe.recover).not.toHaveBeenCalled();
      expect(onRescue).not.toHaveBeenCalled();
    },
  );

  it("runs at most one media recovery and never repeats speech to recover", async () => {
    const { session, emit, repeat } = makeMockSession();
    const probe = makeProbe({
      observations: [silentResult, silentResult],
      recovery: silentResult,
    });
    bindAvatarAudioPresentationProbe(session, probe);
    const onRescue = vi.fn();
    speakThroughAvatar(session, "reply", "turn", onRescue);

    emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);
    emit(AgentEventsEnum.AVATAR_SPEAK_STARTED);
    await flushPresentation();

    expect(probe.recover).toHaveBeenCalledTimes(1);
    expect(repeat).toHaveBeenCalledTimes(1);
    expect(onRescue).toHaveBeenCalledTimes(1);
  });
});

describe("custom voice reply supersession", () => {
  it("suppresses an older silent rescue after a newer reply starts", async () => {
    const first = makeMockSession();
    const firstRescue = vi.fn();
    speakThroughAvatar(first.session, "old reply", "old", firstRescue);
    vi.advanceTimersByTime(500);
    const second = makeMockSession();
    const secondRescue = vi.fn();
    speakThroughAvatar(second.session, "new reply", "new", secondRescue);
    await vi.advanceTimersByTimeAsync(3000);
    expect(firstRescue).not.toHaveBeenCalled();
    expect(secondRescue).toHaveBeenCalledWith("repeat_silent");
  });

  it("keeps the existing barge-in rescue guard", async () => {
    const { session } = makeMockSession();
    const onRescue = vi.fn();
    speakThroughAvatar(session, "reply", "turn", onRescue);
    vi.advanceTimersByTime(500);
    cutCustomVoiceFallback();
    await vi.advanceTimersByTimeAsync(3000);
    expect(onRescue).not.toHaveBeenCalled();
  });
});
