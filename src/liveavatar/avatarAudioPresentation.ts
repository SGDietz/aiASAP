import type { LiveAvatarSession } from "@heygen/liveavatar-web-sdk";

export type AvatarBrowserPlayStatus =
  | "unobserved"
  | "already_playing"
  | "attempting"
  | "resolved"
  | "rejected";

export type AvatarTrackAttachStatus =
  | "unattempted"
  | "attached"
  | "failed";

export type AvatarAudioPresentationEvidence = {
  elementPresent: boolean;
  streamAttached: boolean;
  audioTrackCount: number;
  liveAudioTrack: boolean;
  unmutedAudioTrack: boolean;
  enabledAudioTrack: boolean;
  audioUnlocked: boolean;
  intentionallyMuted: boolean;
  elementMuted: boolean | null;
  volume: number | null;
  paused: boolean | null;
  readyState: number | null;
  playStatus: AvatarBrowserPlayStatus;
  attachStatus: AvatarTrackAttachStatus;
  audioContextState: AudioContextState | "unavailable" | "uninitialized";
  nonZeroAudioSamples: boolean;
  sampleRms: number | null;
};

export type AvatarAudioPresentationResult = {
  presented: boolean;
  suppressed: boolean;
  reason:
    | "media_audio_observed"
    | "intentionally_muted"
    | "audio_not_unlocked"
    | "browser_play_rejected"
    | "remote_audio_unusable"
    | "audio_samples_silent"
    | "cancelled";
  evidence: AvatarAudioPresentationEvidence;
};

export type AvatarAudioPresentationProbe = {
  prime: () => Promise<void>;
  notePlayResult: (status: "resolved" | "rejected") => void;
  snapshot: () => AvatarAudioPresentationEvidence;
  observe: (
    timeoutMs: number,
    signal?: AbortSignal,
  ) => Promise<AvatarAudioPresentationResult>;
  recover: (signal?: AbortSignal) => Promise<AvatarAudioPresentationResult>;
  dispose: () => void;
};

type BrowserProbeOwner = {
  session: LiveAvatarSession;
  getElement: () => HTMLMediaElement | null;
  isAudioUnlocked: () => boolean;
  isIntentionallyMuted: () => boolean;
};

const AUDIO_SAMPLE_POLL_MS = 50;
const MIN_SPEECH_RMS = 0.006;

function waitForNextSample(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(done, AUDIO_SAMPLE_POLL_MS);
    function done() {
      signal?.removeEventListener("abort", done);
      globalThis.clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

/**
 * Observe the same visible media element that the SDK owns. Web platforms
 * cannot prove that a physical speaker produced sound, but a live enabled
 * remote track, a successfully playing unmuted element, and non-zero PCM
 * samples are the strongest safe in-page evidence that usable audio reached
 * the browser presentation path.
 */
export function createBrowserAvatarAudioPresentationProbe({
  session,
  getElement,
  isAudioUnlocked,
  isIntentionallyMuted,
}: BrowserProbeOwner): AvatarAudioPresentationProbe {
  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let silentSink: GainNode | null = null;
  let observedTrackId: string | null = null;
  let playStatus: AvatarBrowserPlayStatus = "unobserved";
  let attachStatus: AvatarTrackAttachStatus = "unattempted";
  let lastRms: number | null = null;
  let disposed = false;

  const getStream = (element: HTMLMediaElement | null): MediaStream | null => {
    if (
      !element ||
      typeof MediaStream === "undefined" ||
      !(element.srcObject instanceof MediaStream)
    ) {
      return null;
    }
    return element.srcObject;
  };

  const releaseGraph = (closeContext: boolean) => {
    try {
      source?.disconnect();
      analyser?.disconnect();
      silentSink?.disconnect();
    } catch {
      // The media graph may already be detached during STOP/unmount.
    }
    source = null;
    analyser = null;
    silentSink = null;
    observedTrackId = null;
    if (closeContext && context) {
      void context.close().catch(() => {});
      context = null;
    }
  };

  const ensureAnalyser = async (): Promise<boolean> => {
    if (disposed || typeof AudioContext === "undefined") return false;
    const stream = getStream(getElement());
    const track = stream
      ?.getAudioTracks()
      .find((candidate) => candidate.readyState === "live");
    if (!stream || !track) return false;

    if (context?.state === "closed" || observedTrackId !== track.id) {
      releaseGraph(true);
    }
    if (!context) {
      try {
        context = new AudioContext();
        source = context.createMediaStreamSource(new MediaStream([track]));
        analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0;
        // Pull the analyser graph without duplicating the avatar in speakers.
        silentSink = context.createGain();
        silentSink.gain.value = 0;
        source.connect(analyser);
        analyser.connect(silentSink);
        silentSink.connect(context.destination);
        observedTrackId = track.id;
      } catch {
        releaseGraph(true);
        return false;
      }
    }
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        // The evidence snapshot will truthfully retain the suspended state.
      }
    }
    return Boolean(analyser && context.state === "running");
  };

  const sampleAudio = (): number | null => {
    if (!analyser || !context || context.state !== "running") return null;
    const samples = new Float32Array(analyser.fftSize);
    try {
      analyser.getFloatTimeDomainData(samples);
    } catch {
      return null;
    }
    let sumSquares = 0;
    for (const sample of samples) sumSquares += sample * sample;
    lastRms = Math.sqrt(sumSquares / samples.length);
    return lastRms;
  };

  const snapshot = (): AvatarAudioPresentationEvidence => {
    const element = getElement();
    const stream = getStream(element);
    const audioTracks = stream?.getAudioTracks() ?? [];
    const liveAudioTrack = audioTracks.some(
      (track) => track.readyState === "live",
    );
    const unmutedAudioTrack = audioTracks.some(
      (track) => track.readyState === "live" && !track.muted,
    );
    const enabledAudioTrack = audioTracks.some(
      (track) => track.readyState === "live" && track.enabled,
    );
    const effectivePlayStatus =
      playStatus === "unobserved" && element && !element.paused
        ? "already_playing"
        : playStatus;
    return {
      elementPresent: Boolean(element),
      streamAttached: Boolean(stream),
      audioTrackCount: audioTracks.length,
      liveAudioTrack,
      unmutedAudioTrack,
      enabledAudioTrack,
      audioUnlocked: isAudioUnlocked(),
      intentionallyMuted: isIntentionallyMuted(),
      elementMuted: element ? element.muted : null,
      volume: element ? element.volume : null,
      paused: element ? element.paused : null,
      readyState: element ? element.readyState : null,
      playStatus: effectivePlayStatus,
      attachStatus,
      audioContextState:
        typeof AudioContext === "undefined"
          ? "unavailable"
          : context?.state ?? "uninitialized",
      nonZeroAudioSamples: (lastRms ?? 0) >= MIN_SPEECH_RMS,
      sampleRms: lastRms === null ? null : Number(lastRms.toFixed(5)),
    };
  };

  const resultFromEvidence = (
    evidence: AvatarAudioPresentationEvidence,
  ): AvatarAudioPresentationResult => {
    if (evidence.intentionallyMuted) {
      return {
        presented: false,
        suppressed: true,
        reason: "intentionally_muted",
        evidence,
      };
    }
    if (!evidence.audioUnlocked) {
      return {
        presented: false,
        suppressed: false,
        reason: "audio_not_unlocked",
        evidence,
      };
    }
    if (evidence.playStatus === "rejected") {
      return {
        presented: false,
        suppressed: false,
        reason: "browser_play_rejected",
        evidence,
      };
    }
    const transportUsable =
      evidence.elementPresent &&
      evidence.streamAttached &&
      evidence.liveAudioTrack &&
      evidence.unmutedAudioTrack &&
      evidence.enabledAudioTrack &&
      evidence.elementMuted === false &&
      (evidence.volume ?? 0) > 0 &&
      evidence.paused === false;
    if (!transportUsable) {
      return {
        presented: false,
        suppressed: false,
        reason: "remote_audio_unusable",
        evidence,
      };
    }
    if (!evidence.nonZeroAudioSamples) {
      return {
        presented: false,
        suppressed: false,
        reason: "audio_samples_silent",
        evidence,
      };
    }
    return {
      presented: true,
      suppressed: false,
      reason: "media_audio_observed",
      evidence,
    };
  };

  const observe = async (
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<AvatarAudioPresentationResult> => {
    const startedAt = Date.now();
    let latest = resultFromEvidence(snapshot());
    while (!disposed && !signal?.aborted && Date.now() - startedAt < timeoutMs) {
      await ensureAnalyser();
      sampleAudio();
      latest = resultFromEvidence(snapshot());
      if (latest.presented || latest.suppressed) return latest;
      await waitForNextSample(signal);
    }
    if (disposed || signal?.aborted) {
      return {
        presented: false,
        suppressed: false,
        reason: "cancelled",
        evidence: snapshot(),
      };
    }
    return latest;
  };

  const recover = async (
    signal?: AbortSignal,
  ): Promise<AvatarAudioPresentationResult> => {
    if (disposed || signal?.aborted) {
      return {
        presented: false,
        suppressed: false,
        reason: "cancelled",
        evidence: snapshot(),
      };
    }
    const element = getElement();
    if (!element || isIntentionallyMuted()) {
      return resultFromEvidence(snapshot());
    }
    try {
      session.attach(element);
      attachStatus = "attached";
    } catch {
      attachStatus = "failed";
    }

    const stream = getStream(element);
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    if (!isAudioUnlocked()) return resultFromEvidence(snapshot());

    element.muted = false;
    element.volume = 1;
    playStatus = "attempting";
    try {
      await element.play();
      playStatus = "resolved";
    } catch {
      playStatus = "rejected";
    }
    await ensureAnalyser();
    return resultFromEvidence(snapshot());
  };

  return {
    async prime() {
      await ensureAnalyser();
    },
    notePlayResult(status) {
      playStatus = status;
    },
    snapshot,
    observe,
    recover,
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseGraph(true);
    },
  };
}
