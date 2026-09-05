import { AgentEventsEnum, LiveAvatarSession } from "@heygen/liveavatar-web-sdk";
import { pcm16Base64ToAudioBuffer } from "../lib/voiceMode/pcm";
import type {
  AvatarAudioPresentationEvidence,
  AvatarAudioPresentationProbe,
} from "./avatarAudioPresentation";

// CUSTOM-mode voice delivery armor (copilot 2026-06-11/12).
//
// Evidence from G's live taps (server-side [custom-voice] diag):
//   - socket=1 (OPEN) and repeatAudio returns an event_id, yet
//     AVATAR_SPEAK_STARTED NEVER fires: HeyGen's v2-alpha endpoint accepts our
//     PCM and silently ignores it. The avatar will not voice or lip-sync it.
//   - The WebAudio fallback made 6 audible — but the open mic heard 6's own
//     speaker audio and transcribed it as the USER ("a little bit better
//     today", "hi I'm six you're"), so the brain answered itself in a loop.
//   - SDK stopListening()/voiceChat.mute() did NOT stop transcription in
//     CUSTOM mode (echo rows kept landing while they were engaged).
//
// Layers, all of which must hold for echo-free audible speech:
//   1. 6 is always audible (WebAudio fallback when the avatar pipe is dead).
//   2. One voice at a time (serialized playback queue).
//   3. Fallback audio routes through an <audio> element so the browser's
//      echoCancellation treats it as render-side reference audio.
//   4. The mic's hardware track is muted directly while 6 talks (the polite
//      SDK requests are also sent, but the LiveKit track mute is the lock).
//   5. Echo firewall: the component can ask "did 6 just say this?" and drop
//      mic lines that are really 6's own voice (wasRecentlySpokenBySix).
//   6. No 1.8s probe lag after the pipe is PROVEN dead (per-session WeakSet).
//   7. Barge-in: cutCustomVoiceFallback() stops playback + queue.

const SPEAK_WATCHDOG_MS = 1800;
const MIC_RESUME_TAIL_MS = 300;
const SPOKEN_LINE_TTL_MS = 25_000;
const SPOKEN_LINE_MAX = 12;
const ECHO_ATTRIBUTION_WINDOW_MS = 4_000;

/** Sessions whose avatar-audio pipe has been proven dead (watchdog missed). */
const deadAudioSessions = new WeakSet<object>();
const failedRepeatSessions = new WeakSet<object>();
type AvatarSpeechFailure = {
  session: LiveAvatarSession;
  where: string;
  reason: string;
  /**
   * Characters in the line that went silent. 8.9% of 6's lines stalled across
   * G's 08-30..09-04 rides and nothing recorded HOW LONG they were, so
   * "does the provider choke on long lines" could not be answered from stored
   * data. Now it can, without asking G for another ride.
   */
  textLength?: number;
};
const avatarSpeechFailureListeners = new Set<
  (failure: AvatarSpeechFailure) => void
>();

// ---------------------------------------------------------------------------
// THE GAP, ANNOUNCED EARLY.
//
// 8.9% of 6's lines are accepted by the provider and never spoken, and the
// watchdog needs a full 5 s before it can be sure (a genuine 4.005 s start has
// been recorded, so it cannot be shortened without cutting him off mid-word).
// Those 5 seconds are silence, and G reads silence as 6 freezing.
//
// G chose the third option, 2026-09-04: keep the 5 s, but do not let it sound
// dead. This fires at 1.4 s if the provider has not started, so the session can
// make one small human sound. It is a HINT, not a verdict - if 6 then speaks,
// nothing else happens and no failure is reported.
// ---------------------------------------------------------------------------
const SPEECH_GAP_HINT_MS = 1400;
type AvatarSpeechGap = { session: LiveAvatarSession; where: string };
const avatarSpeechGapListeners = new Set<(gap: AvatarSpeechGap) => void>();

export function subscribeAvatarSpeechGap(
  listener: (gap: AvatarSpeechGap) => void,
): () => void {
  avatarSpeechGapListeners.add(listener);
  return () => {
    avatarSpeechGapListeners.delete(listener);
  };
}

function reportAvatarSpeechGap(gap: AvatarSpeechGap): void {
  for (const listener of [...avatarSpeechGapListeners]) {
    try {
      listener(gap);
    } catch {
      // a hint must never break the speak path
    }
  }
}
const avatarAudioPresentationProbes = new WeakMap<
  object,
  AvatarAudioPresentationProbe
>();
const activeAvatarSpeechCancels = new Map<() => void, LiveAvatarSession>();

export type AvatarSpeechPresentationEvent = {
  stage:
    | "provider_started"
    | "initial_probe"
    | "media_recovery_started"
    | "media_recovery_finished"
    | "recovery_probe"
    | "media_presented"
    | "intentionally_silent"
    // Audio recovery: our own TTS speaking a reply the provider swallowed.
    | "audio_recovery_started"
    | "audio_recovery_finished";
  reason?: string;
  durationMs: number;
  evidence?: AvatarAudioPresentationEvidence;
};

/** Bind the SDK session to the browser-media probe owned by its visible stage. */
/**
 * The most recent session a probe was bound to. Diagnostic only - never used
 * to resolve a probe, because binding to the WRONG session is exactly the
 * failure we are trying to tell apart. See the media_probe_unavailable note.
 */
let lastBoundProbeSession: WeakRef<LiveAvatarSession> | null = null;
let probeBindCount = 0;

export function bindAvatarAudioPresentationProbe(
  session: LiveAvatarSession,
  probe: AvatarAudioPresentationProbe,
): () => void {
  lastBoundProbeSession = new WeakRef(session);
  probeBindCount += 1;
  avatarAudioPresentationProbes.set(session, probe);
  return () => {
    for (const [cancel, activeSession] of [
      ...activeAvatarSpeechCancels.entries(),
    ]) {
      if (activeSession === session) cancel();
    }
    if (avatarAudioPresentationProbes.get(session) === probe) {
      avatarAudioPresentationProbes.delete(session);
    }
    probe.dispose();
  };
}

/** One-shot diagnostic signal for a silently broken avatar speech path. */
export function subscribeAvatarSpeechFailure(
  listener: (failure: AvatarSpeechFailure) => void,
): () => void {
  avatarSpeechFailureListeners.add(listener);
  return () => avatarSpeechFailureListeners.delete(listener);
}

function reportAvatarSpeechFailure(failure: AvatarSpeechFailure): void {
  if (failedRepeatSessions.has(failure.session)) return;
  failedRepeatSessions.add(failure.session);
  for (const listener of avatarSpeechFailureListeners) listener(failure);
}

let fallbackCtx: AudioContext | null = null;
let aecDest: MediaStreamAudioDestinationNode | null = null;
let aecAudioEl: HTMLAudioElement | null = null;
let aecRouteWorking = false;
let playbackChain: Promise<void> = Promise.resolve();
let pendingCount = 0;
let activeSource: AudioBufferSourceNode | null = null;
let cutEpoch = 0;
let replyEpoch = 0;
let lastAudibleAt = 0;

function noteSixAudioActive(atMs: number = Date.now()): void {
  lastAudibleAt = atMs;
}
// 2026-08-21 ride (G via 6: "a mute button ... where we don't hear him talking"):
// speaker mute for the CUSTOM WebAudio fallback path. While true, queued
// fallback audio is skipped (the queue still drains so the mic gate re-opens)
// and the AEC output element is muted. Flipped by setCustomVoiceMuted().
let customVoiceMuted = false;

export function reportCustomVoiceDiag(message: string): void {
  // console.warn, NOT console.error — the Next.js dev overlay counts errors
  // and G saw a red badge with "six or seven errors" that were just these.
  console.warn(message);
  try {
    void fetch("/api/observability/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "warn", message, route: "/" }),
    });
  } catch {
    // diagnostics must never break the speak path
  }
}

// ---------------------------------------------------------------------------
// Echo firewall: registry of lines 6 spoke recently.

const recentSixLines: { text: string; until: number }[] = [];

// Filler words 6 says in every coaching/confirm line. They must NOT count
// toward echo overlap, or a genuine user command that merely reuses 6's words
// ("add to the Wegmans list" vs 6's "...switch to the Wegmans list now") is
// mistaken for 6's own voice and the real item is dropped (G 2026-06-13:
// "Toothbrush."/"Blow dryer."/"Add to the Wegmans list." all echo_dropped).
const ECHO_FILLER_WORDS = new Set(
  "a an the to of and or but in on at for is are was were be been i you he she it we they me him her them my your his our their this that these those do does did so now then just want add list".split(
    " ",
  ),
);

function normalizeForEcho(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bsix\b/g, "6") // STT hears the name as a word
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Call with every line 6 speaks aloud in CUSTOM mode. */
export function registerSixSpokenLine(text: string): void {
  const normalized = normalizeForEcho(text);
  if (!normalized) return;
  const now = Date.now();
  while (recentSixLines.length && recentSixLines[0].until < now) {
    recentSixLines.shift();
  }
  recentSixLines.push({ text: normalized, until: now + SPOKEN_LINE_TTL_MS });
  if (recentSixLines.length > SPOKEN_LINE_MAX) recentSixLines.shift();
}

/**
 * True when a mic line is (a fragment of) something 6 just said — i.e. the
 * mic heard 6's own speakers, not the user. Substring match catches clean
 * echo tails; token overlap (>= 0.75) catches STT mishears of his own voice.
 */
export function wasRecentlySpokenBySix(
  userText: string,
  nowMs: number = Date.now(),
): boolean {
  const heard = normalizeForEcho(userText);
  if (heard.length < 8) return false; // too short to attribute either way
  // Text similarity is only evidence of acoustic echo while 6 has actually
  // been audible recently. The longer registry TTL remains useful for matching,
  // but must not swallow a deliberate answer that repeats 6's suggested words.
  if (nowMs - lastAudibleAt > ECHO_ATTRIBUTION_WINDOW_MS) return false;
  const now = nowMs;
  const heardTokens = heard.split(" ");
  // Only content words count toward overlap — filler 6 repeats in every coach
  // line would otherwise inflate the match on a genuine user command.
  const heardContent = heardTokens.filter((t) => !ECHO_FILLER_WORDS.has(t));
  for (const line of recentSixLines) {
    if (line.until < now) continue;
    // Substring is a real echo only when the heard line is MOST of what 6 said
    // (the mic bled back his whole phrase). A user echoing one coached item
    // ("toothbrush") back is a tiny fragment of a long coaching line — not echo.
    if (line.text.includes(heard) && heard.length >= line.text.length * 0.6) {
      return true;
    }
    const lineTokens = new Set(line.text.split(" "));
    let hits = 0;
    for (const token of heardContent) {
      if (lineTokens.has(token)) hits++;
    }
    if (heardContent.length >= 3 && hits / heardContent.length >= 0.75) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Mic gating: hardware-track mute is the lock; SDK requests are best-effort.

type VoiceChatRuntime = {
  state?: string;
  isMuted?: boolean;
  track?: {
    mute?: () => Promise<unknown>;
    unmute?: () => Promise<unknown>;
    isMuted?: boolean;
  } | null;
};

function setMicGate(session: LiveAvatarSession, open: boolean): void {
  try {
    if (open) {
      session.startListening();
    } else {
      session.stopListening();
    }
  } catch {
    // session may be tearing down; the track mute below is the real lock
  }
  let vcState = "no-vc";
  let trackMuted: string = "no-track";
  try {
    const vc = (session as unknown as { voiceChat?: VoiceChatRuntime })
      .voiceChat;
    if (vc) {
      vcState = String(vc.state ?? "unknown");
      const track = vc.track;
      if (track) {
        void (open ? track.unmute?.() : track.mute?.());
        trackMuted = String(track.isMuted ?? "unknown");
      }
    }
  } catch {
    // keep going — diag below still tells us what we reached
  }
  reportCustomVoiceDiag(
    `[mic-gate] ${open ? "OPEN" : "CLOSED"} vcState=${vcState} trackMutedBefore=${trackMuted}`,
  );
}

// ---------------------------------------------------------------------------
// Playback: serialized queue, AEC-friendly output.

/**
 * Route through a MediaStream-backed <audio> element when possible: Chrome's
 * echoCancellation uses element playback as reference audio, so the mic
 * subtracts 6's voice natively. Falls back to raw WebAudio destination.
 */
function fallbackOutputNode(ctx: AudioContext): AudioNode {
  if (!aecDest) {
    try {
      aecDest = ctx.createMediaStreamDestination();
      aecAudioEl = new Audio();
      aecAudioEl.srcObject = aecDest.stream;
      aecAudioEl.autoplay = true;
      const playAttempt = aecAudioEl.play();
      aecRouteWorking = true;
      if (playAttempt) {
        playAttempt.catch(() => {
          aecRouteWorking = false;
          reportCustomVoiceDiag(
            "[custom-voice] AEC audio element blocked -> raw WebAudio output",
          );
        });
      }
    } catch {
      aecRouteWorking = false;
    }
  }
  return aecRouteWorking && aecDest ? aecDest : ctx.destination;
}

// ---------------------------------------------------------------------------
// LOUD FIRST LINE - NOT FIXED HERE, AND DELIBERATELY NOT PAPERED OVER.
//
// G, 2026-09-03: "his voice is loud when he first comes on, like maximum
// loudness... after the mic permission it's a moderate volume."
//
// WildWorks hit the same thing that morning and diagnosed it properly
// (avatar-iscott/route.ts ~4457, G's words: "way too loud when starting, then
// after i hit the mic permissions, the volume is normal"). The cause is NOT
// amplitude: the phone only routes playback through the quieter voice-call
// path once a microphone capture is LIVE. Before that it plays at media
// volume. Their fix was ordering - ask for the mic BEFORE the session start.
//
// aiASAP already does that (earlyStartBridge requests the microphone as its
// first async action, and LiveAvatarSession treats the START tap's grant as
// the only mic request). So a gain stage here would be treating a symptom this
// app may not even have, and would quietly shrink every mid-conversation
// rescue line - where the routing is already correct - to fix an opening line
// that might already be fine. Measure it on a ride first: the suspect window
// is between the warm stream being released and the SDK's own capture opening.
// ---------------------------------------------------------------------------

async function playPcmBase64ViaWebAudio(audioBase64: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (customVoiceMuted) return false; // speaker muted: skip, queue still drains
  if (!fallbackCtx) fallbackCtx = new AudioContext();
  if (fallbackCtx.state === "suspended") {
    try {
      await fallbackCtx.resume();
    } catch {
      // resume is gesture-gated; if it stays suspended the play below is a no-op
    }
  }
  if (fallbackCtx.state !== "running") return false;
  const buffer = pcm16Base64ToAudioBuffer(fallbackCtx, audioBase64);
  return new Promise<boolean>((resolve) => {
    const source = fallbackCtx!.createBufferSource();
    source.buffer = buffer;
    source.connect(fallbackOutputNode(fallbackCtx!));
    source.onended = () => {
      if (activeSource === source) activeSource = null;
      resolve(true);
    };
    activeSource = source;
    noteSixAudioActive();
    source.start();
  });
}

/**
 * Unlock the WebAudio fallback context from a USER GESTURE (tap-to-start) so
 * list-mode replies — which fall back to WebAudio after the avatar session
 * stops — are never silent no-ops on a suspended context. (G 2026-06-13: 6
 * went mute the moment a list opened.) Safe to call repeatedly.
 */
export function primeCustomVoiceFallback(): void {
  if (typeof window === "undefined") return;
  try {
    if (!fallbackCtx) fallbackCtx = new AudioContext();
    if (fallbackCtx.state === "suspended") void fallbackCtx.resume();
    const b = fallbackCtx.createBuffer(1, 1, 22050);
    const s = fallbackCtx.createBufferSource();
    s.buffer = b;
    s.connect(fallbackCtx.destination);
    s.start(0);
  } catch {
    // best-effort unlock
  }
}

/** Queue one fallback utterance: deaf mic -> play -> (queue empty) -> mic back. */
function enqueueFallback(
  session: LiveAvatarSession,
  audioBase64: string,
): Promise<boolean> {
  const myEpoch = cutEpoch;
  let settle: (played: boolean) => void = () => {};
  const outcome = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  pendingCount++;
  playbackChain = playbackChain
    .then(async () => {
      if (cutEpoch !== myEpoch) {
        settle(false);
        return; // barge-in cleared the queue
      }
      setMicGate(session, false);
      settle(await playPcmBase64ViaWebAudio(audioBase64));
    })
    .catch(() => {
      // keep the chain alive no matter what a single item does
      settle(false);
    })
    .finally(() => {
      pendingCount--;
      if (pendingCount === 0) {
        // queue drained (played, cut, or skipped): beat of silence, ears back on
        window.setTimeout(() => {
          if (pendingCount === 0) setMicGate(session, true);
        }, MIC_RESUME_TAIL_MS);
      }
    });
  return outcome;
}

/** Stop the current fallback utterance AND drop anything queued behind it. */
export function cutCustomVoiceFallback(): void {
  cutEpoch++;
  for (const cancel of [...activeAvatarSpeechCancels.keys()]) cancel();
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      // already stopped
    }
    activeSource = null;
  }
}

/**
 * Speaker mute for the fallback path (2026-08-21). Muting cuts whatever is
 * playing and silences the AEC output element; unmuting only lifts the flag —
 * nothing already skipped is replayed.
 */
export function setCustomVoiceMuted(muted: boolean): void {
  customVoiceMuted = muted;
  if (aecAudioEl) {
    try {
      aecAudioEl.muted = muted;
    } catch {
      // element may be detached; the flag alone still silences playback
    }
  }
  if (muted) cutCustomVoiceFallback();
}

export function isCustomVoiceMuted(): boolean {
  return customVoiceMuted;
}

/**
 * Sessionless playback for VOICE-ONLY mode (2026-08-21).
 *
 * `deliverCustomTtsAudio` needs a live LiveAvatarSession — it probes the avatar
 * socket first. Voice-only has no session ON PURPOSE: minting one is what bills
 * G by the block, and a voice conversation should cost nothing but tokens. Ara
 * spotted this herself after first drafting `deliverCustomTtsAudio(null, …)`.
 *
 * So this exposes the WebAudio path that was already private and already used
 * whenever the avatar pipe is dead. It honours the speaker mute, and it is the
 * ONLY sanctioned way to make 6 speak without a session.
 *
 * Input is base64 PCM16 @24kHz — exactly what /api/elevenlabs-text-to-speech
 * returns (`output_format=pcm_24000`).
 */
export async function playVoiceOnlyAudio(audioBase64: string): Promise<void> {
  if (!audioBase64 || audioBase64.length < 50) return;
  await playPcmBase64ViaWebAudio(audioBase64);
}

/** Stop whatever voice-only line is playing (barge-in, mute, unmount). */
export function cutVoiceOnlyAudio(): void {
  cutCustomVoiceFallback();
}

/**
 * True while a fallback utterance is queued or playing. (G 2026-06-13 INTERRUPT
 * FIX: list-mode 6 speaks through THIS WebAudio fallback, which never sets the
 * component's voiceTtsBusyRef — so the mic barge-in detector thought 6 was
 * silent and never let G talk over him. The barge-in gate now ORs this in so
 * 6 can be cut off in list mode too. cutCustomVoiceFallback() is already wired
 * into voiceCutSpeech, so detection was the only missing half.)
 */
export function isCustomVoiceFallbackBusy(): boolean {
  return pendingCount > 0;
}

/** WebSocket.readyState as a string ("1" = OPEN), "null" if the SDK never made one. */
function audioSocketState(session: LiveAvatarSession): string {
  try {
    const raw = (
      session as unknown as {
        _sessionEventSocket?: { readyState?: number } | null;
      }
    )._sessionEventSocket;
    return raw ? String(raw.readyState) : "null";
  } catch {
    return "unreadable";
  }
}

/**
 * SDK BYPASS (copilot 2026-06-12): the SDK puts RAW binary-string PCM chunks
 * into JSON websocket frames; HeyGen's agent.speak protocol expects BASE64.
 * Diag proved the server accepts those frames and silently does nothing
 * (AVATAR_SPEAK_STARTED never fires). Speak directly to the socket with
 * base64-encoded 20ms chunks instead. Returns false if no open socket.
 */
type SocketPushResult = "sent" | "not_connected_yet" | "failed";

function trySpeakViaSocketBase64(
  session: LiveAvatarSession,
  audioBase64: string,
): SocketPushResult {
  try {
    const sock = (
      session as unknown as { _sessionEventSocket?: WebSocket | null }
    )._sessionEventSocket;
    // A socket that has not come up yet is NOT a broken pipe. Telling those
    // two apart is the whole point of this return type - see the note at the
    // call site.
    if (!sock || sock.readyState !== WebSocket.OPEN) return "not_connected_yet";
    const binary = window.atob(audioBase64);
    const BYTES_PER_CHUNK = 960; // 20ms @ 24kHz mono 16-bit
    const event_id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Math.floor(Math.random() * 1e12));
    for (let i = 0; i < binary.length; i += BYTES_PER_CHUNK) {
      sock.send(
        JSON.stringify({
          type: "agent.speak",
          event_id,
          audio: window.btoa(binary.slice(i, i + BYTES_PER_CHUNK)),
        }),
      );
    }
    sock.send(JSON.stringify({ type: "agent.speak_end", event_id }));
    return "sent";
  } catch {
    return "failed";
  }
}

/**
 * repeatAudio + server-visible diagnostics + guaranteed-audible fallback.
 * Returns immediately like the bare SDK call; the watchdog runs detached.
 */
export function deliverCustomTtsAudio(
  session: LiveAvatarSession,
  audioBase64: string,
  where: string,
): string | void {
  if (deadAudioSessions.has(session)) {
    // Pipe already proven dead this session — no probe wait, no double-play risk.
    enqueueFallback(session, audioBase64);
    return;
  }
  const push = trySpeakViaSocketBase64(session, audioBase64);
  const socket = audioSocketState(session);
  reportCustomVoiceDiag(
    `[custom-voice] ${where} socket=${socket} b64speak=${push === "sent"} push=${push} b64len=${audioBase64.length}`,
  );

  // Socket said OPEN - but if the avatar never starts speaking, voice it
  // ourselves and stop trusting the pipe for the rest of this session.
  const armSpeakWatchdog = () => {
    let spoke = false;
    const onStarted = () => {
      spoke = true;
    };
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, onStarted);
    window.setTimeout(() => {
      session.off(AgentEventsEnum.AVATAR_SPEAK_STARTED, onStarted);
      if (!spoke) {
        deadAudioSessions.add(session);
        reportCustomVoiceDiag(
          `[custom-voice] ${where} no AVATAR_SPEAK_STARTED in ${SPEAK_WATCHDOG_MS}ms -> WebAudio fallback (pipe marked dead this session)`,
        );
        enqueueFallback(session, audioBase64);
      }
    }, SPEAK_WATCHDOG_MS);
  };

  if (push === "sent") {
    armSpeakWatchdog();
    return;
  }

  // ------------------------------------------------------------------
  // RIDE cf79a533, 2026-09-03. The greeting fires about a second after the
  // session starts, BEFORE the event socket has connected, so this push
  // logged `socket=null`. The old code marked the whole session's audio
  // pipe dead on that one miss, and every later line skipped the socket
  // without even trying: G heard the ElevenLabs voice for the entire ride
  // and said "I don't think a single time 6 moved his mouth."
  //
  // A pipe that has not come up yet is not a broken pipe. Only a socket
  // that was OPEN and still refused the audio is.
  //
  // THAT 302-OF-306 FIGURE WAS JUNE DATA AND IT EXPIRED (re-measured
  // 2026-09-04, every socket= line ever logged):
  //     2026-06-12..14  socket=1     327 of 327   (CUSTOM mints)
  //     2026-07-20..now socket=null    8 of 8     (FULL mints)
  // It has not been open ONCE since the mint shape moved to FULL. FULL
  // sessions are room-based and are handed no ws_url, so the SDK never
  // constructs _sessionEventSocket - see sessionCanHaveAudioSocket below.
  // Reading the old number cost a morning chasing a broken socket that was
  // behaving exactly as designed.
  // ------------------------------------------------------------------
  if (push === "failed") {
    deadAudioSessions.add(session);
    reportCustomVoiceDiag(
      `[custom-voice] ${where} undeliverable (failed) -> WebAudio fallback (pipe marked dead this session)`,
    );
    enqueueFallback(session, audioBase64);
    return;
  }

  // not_connected_yet. Not a broken pipe - an early one. Falling back
  // immediately is what still cost the GREETING its lip-sync even after the
  // dead-pipe bug was fixed: the opener is the one line that always arrives
  // before the socket, and it is the line G judges 6 on.
  //
  // Waiting costs nothing real. The provider does not present its first video
  // frame until ~9.4s after the tap (measured 2026-09-04), so a line held for
  // up to 1.5s here still speaks long before there is a face to watch. If the
  // socket never opens, behaviour is exactly what it was: WebAudio fallback.
  // No ws_url means no socket will EVER exist on this session. Waiting the
  // full budget for it is dead air on every rescued line, and it is what
  // makes the diag read like a broken pipe when nothing is broken.
  if (!sessionCanHaveAudioSocket(session)) {
    reportCustomVoiceDiag(
      `[custom-voice] ${where} session has no ws_url (FULL mint) - no event socket exists, not waiting`,
    );
    enqueueFallback(session, audioBase64);
    return;
  }

  const cutAtArm = cutEpoch;
  void (async () => {
    const opened = await waitForAudioSocket(session, SOCKET_OPEN_WAIT_MS);
    // Barge-in, STOP or QUIET while we waited: the line is stale. Dropping it
    // is correct - speaking now would talk over the interruption.
    if (cutEpoch !== cutAtArm) {
      reportCustomVoiceDiag(`[custom-voice] ${where} socket wait abandoned (barge-in)`);
      return;
    }
    if (deadAudioSessions.has(session)) {
      enqueueFallback(session, audioBase64);
      return;
    }
    const retry = opened ? trySpeakViaSocketBase64(session, audioBase64) : "not_connected_yet";
    reportCustomVoiceDiag(
      `[custom-voice] ${where} socket wait ${opened ? "opened" : "timed out"} -> retry=${retry}`,
    );
    if (retry === "sent") {
      armSpeakWatchdog();
      return;
    }
    if (retry === "failed") deadAudioSessions.add(session);
    enqueueFallback(session, audioBase64);
  })();
}

/**
 * Can this session EVER have an event socket?
 *
 * The SDK only builds one when the mint handed back a ws_url:
 *     const websocketUrl = this._sessionInfo.ws_url;
 *     if (websocketUrl) { yield this.connectWebSocket(websocketUrl); }
 *
 * FULL mints (our default since 2026-06-14, see start-custom-session) are
 * room-based and carry NO ws_url, so `_sessionEventSocket` stays null for the
 * whole session BY DESIGN. In that shape lip-sync comes from the provider's
 * own TTS through the LiveKit room, never from a pushed audio buffer.
 *
 * Fails OPEN on purpose: an unreadable or missing _sessionInfo returns true so
 * a CUSTOM session still gets its wait. Only a session that explicitly reports
 * no ws_url skips it.
 */
function sessionCanHaveAudioSocket(session: LiveAvatarSession): boolean {
  try {
    const info = (
      session as unknown as { _sessionInfo?: { ws_url?: string | null } | null }
    )._sessionInfo;
    if (!info || typeof info !== "object" || !("ws_url" in info)) return true;
    return Boolean(info.ws_url);
  } catch {
    return true;
  }
}

/** How long a line may wait for the event socket before we voice it ourselves. */
const SOCKET_OPEN_WAIT_MS = 1500;
const SOCKET_POLL_MS = 75;

/** Resolves true as soon as the audio socket is OPEN, false on timeout. */
function waitForAudioSocket(session: LiveAvatarSession, budgetMs: number): Promise<boolean> {
  const isOpen = () => {
    try {
      const sock = (session as unknown as { _sessionEventSocket?: WebSocket | null })
        ._sessionEventSocket;
      return Boolean(sock && sock.readyState === WebSocket.OPEN);
    } catch {
      return false;
    }
  };
  if (isOpen()) return Promise.resolve(true);
  // Capture the scheduler ONCE. Re-reading `window` on every tick threw
  // "window is not defined" when a timer outlived its environment (caught by
  // the test run's global teardown, but the same shape as a poll surviving an
  // unmount). A pending poll must never be able to throw.
  const schedule: ((fn: () => void, ms: number) => unknown) | null =
    typeof window !== "undefined" && typeof window.setTimeout === "function"
      ? (fn, ms) => window.setTimeout(fn, ms)
      : typeof setTimeout === "function"
        ? (fn, ms) => setTimeout(fn, ms)
        : null;
  if (!schedule) return Promise.resolve(false);
  return new Promise((resolve) => {
    const deadline = Date.now() + budgetMs;
    const tick = () => {
      try {
        if (isOpen()) return resolve(true);
        if (Date.now() >= deadline) return resolve(false);
        schedule(tick, SOCKET_POLL_MS);
      } catch {
        resolve(false);
      }
    };
    schedule(tick, SOCKET_POLL_MS);
  });
}

// ---------------------------------------------------------------------------
// THE SILENT-6 HOLE (found by audit 2026-08-21, fixed here).
//
// In CUSTOM mode 6's PRIMARY voice is repeat() — LiveAvatar's own TTS, which is
// also what moves his mouth. Both call sites wrapped it in try/catch and fell
// back to ElevenLabs on a THROW. But the failure that actually happens is not a
// throw: the call is ACCEPTED, resolves fine, and the avatar simply never
// speaks. That is the exact behaviour documented at the top of this file for
// the audio-push path ("socket=1 ... yet AVATAR_SPEAK_STARTED NEVER fires").
// On the repeat() path nothing watched for it, so 6 went quiet and no alarm
// rang anywhere.
//
// deliverCustomTtsAudio already had the right shape. This gives repeat() the
// same armour, in one place, so the two call sites cannot drift apart again.

// Longer than SPEAK_WATCHDOG_MS on purpose: deliverCustomTtsAudio is pushing
// bytes that already exist, while repeat() has to generate speech server-side
// before the avatar can start. Rescuing too early would talk over him.
// The 2026-09-01 Android smoke measured native speak_started at 4.005s. The
// previous 2.6s deadline launched audible WebAudio before the provider could
// animate the mouth. Five seconds preserves a useful silent-speech recovery
// while giving the native avatar the first right to speak.
const REPEAT_WATCHDOG_MS = 5000;
const PRESENTATION_WATCH_MS = 1200;
const PRESENTATION_RECOVERY_WATCH_MS = 1600;

// ---------------------------------------------------------------------------
// AUDIBLE RECOVERY (restored 2026-08-31 after physical Android session
// 79317698: twelve accepted turns, twelve brain replies, twelve speech
// dispatches — and the greeting plus nine replies logged `repeat_silent` with
// only eight AVATAR_SPEAK_STARTED events. A dispatch is not delivery, and the
// visitor sat in silence.)
//
// Before the 2026-08-21 rewrite, a dead repeat() fell through to
// /api/elevenlabs-text-to-speech + the WebAudio armor below and 6 stayed
// audible. That rewrite replaced the recovery with a log line, because the OLD
// rescue pushed audio into the avatar session and produced rapid start/end
// events, no lip sync, and mic click storms.
//
// This restores audibility WITHOUT that failure mode. It never touches the
// avatar session's speech pipe, never mints, never starts a second session: it
// gets real audio from our own TTS route and plays it through the same
// serialized, echo-cancelled, mic-gated fallback queue that voice-only mode
// uses. And it is bounded hard:
//   - one attempt per reply, only after a CONFIRMED silent/rejected/thrown
//     repeat (never after a merely unobservable one)
//   - the possibly-late original is interrupted first, so the provider cannot
//     start talking underneath the fallback
//   - a newer reply, STOP/QUIET/barge-in, or unmount cancels it at three
//     checkpoints: before the fetch, after the fetch, and inside the queue
//     (enqueueFallback already honours cutEpoch)
// ---------------------------------------------------------------------------

/** Only a proven-silent provider dispatch may be re-voiced. */
const AUDIBLE_RECOVERY_REASONS = new Set([
  "repeat_silent",
  "repeat_rejected",
  "repeat_threw",
]);

const RECOVERY_TTS_TIMEOUT_MS = 6000;
const MAX_RECOVERY_TEXT_CHARS = 900;

type RecoveryOutcome =
  | "spoken"
  | "superseded"
  | "interrupted"
  | "tts_failed"
  | "tts_threw";

// ---------------------------------------------------------------------------
// PREFETCH THE OPENER (2026-09-04, measured).
//
// The opening line is 14.4 seconds of speech and our TTS route takes 3.0
// seconds to generate it. Today none of that starts until the provider session
// is already connected: connected at 8.4s, greeting dispatched at 9.5s, and 6
// finally speaks at 10.6-11.9s. Three of those seconds are us waiting for audio
// we could have had in hand before the session even existed.
//
// The opener text is a CONSTANT. Nothing about it depends on the session, so it
// can be generated the moment the visitor taps, in parallel with the mint and
// the provider connect - both of which are pure waiting. By the time the socket
// is ready the bytes are already here.
//
// This is a straight subtraction with no trade: same audio, same voice, same
// socket push, same lip-sync. It only stops the fetch happening late.
// One entry, because there is exactly one line worth priming.
let primedSpeech: { text: string; audio: Promise<string | null> } | null = null;

/**
 * Start generating a line's audio now so it is ready when it is needed.
 * Safe to call more than once; the second call for the same text is a no-op.
 * Never throws and never blocks the caller.
 */
export function primeSpeechAudio(text: string): void {
  const key = (text ?? "").trim();
  if (!key) return;
  if (primedSpeech && primedSpeech.text === key) return;
  try {
    primedSpeech = { text: key, audio: fetchRecoveryAudio(key) };
    // A rejected promise stored for later would become an unhandled rejection
    // if nothing ever consumed it.
    void primedSpeech.audio.catch(() => null);
    reportCustomVoiceDiag(`[custom-voice] primed opener audio (${key.length} chars)`);
  } catch {
    primedSpeech = null;
  }
}

/** Take the primed audio for `text` if we have it. One-shot: it is consumed. */
function takePrimedSpeech(text: string): Promise<string | null> | null {
  const key = (text ?? "").trim();
  if (!primedSpeech || primedSpeech.text !== key) return null;
  const { audio } = primedSpeech;
  primedSpeech = null;
  return audio;
}

async function fetchRecoveryAudio(text: string): Promise<string | null> {
  if (typeof fetch !== "function") return null;
  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), RECOVERY_TTS_TIMEOUT_MS)
    : null;
  try {
    const res = await fetch("/api/elevenlabs-text-to-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, MAX_RECOVERY_TEXT_CHARS) }),
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { audio?: unknown };
    return typeof data?.audio === "string" && data.audio.length > 50
      ? data.audio
      : null;
  } catch {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/**
 * Speak `text` ourselves because the provider accepted the line and then said
 * nothing. Resolves with what actually happened so the caller can log it
 * honestly — this module still owns no telemetry.
 */
async function recoverSpeechAudibly(args: {
  session: LiveAvatarSession;
  text: string;
  where: string;
  replyEpochAtArm: number;
  cutEpochAtArm: number;
}): Promise<RecoveryOutcome> {
  const { session, text, where, replyEpochAtArm, cutEpochAtArm } = args;
  // Unmount and probe-unbind cancel by identity through this map, so the
  // recovery is stoppable even though the original speech attempt is settled.
  let cancelled = false;
  const cancelRecovery = () => {
    cancelled = true;
  };
  activeAvatarSpeechCancels.set(cancelRecovery, session);
  const stale = (): RecoveryOutcome | null => {
    if (cancelled) return "interrupted";
    if (replyEpoch !== replyEpochAtArm) return "superseded";
    if (cutEpoch !== cutEpochAtArm) return "interrupted";
    return null;
  };
  const done = <T,>(outcome: T): T => {
    activeAvatarSpeechCancels.delete(cancelRecovery);
    return outcome;
  };

  const before = stale();
  if (before) return done(before);

  // Cancel the original first. repeat() was accepted, so the provider may still
  // start speaking late; without this the fallback and a late original can
  // overlap into two audible replies for one turn.
  try {
    session.interrupt();
  } catch {
    // best effort — the session may already be tearing down
  }

  const audioBase64 = await fetchRecoveryAudio(text);

  const after = stale();
  if (after) return done(after);
  if (!audioBase64) return done("tts_failed");

  // enqueueFallback re-checks cutEpoch inside the queue, so a barge-in that
  // lands between here and playback still silences it.
  const played = await enqueueFallback(session, audioBase64);
  const afterPlayback = stale();
  if (afterPlayback) return done(afterPlayback);
  if (!played) return done("tts_failed");
  reportCustomVoiceDiag(
    `[custom-voice] ${where} silent -> recovered with our own TTS (${audioBase64.length}b64)`,
  );
  return done("spoken");
}

/**
 * ONE VOICE, EVERY TIME.
 *
 * G, 2026-08-22: "Can we have ElevenLabs doing all the voice, direct, so not
 * have any [provider TTS] - every single time, even when the avatar is
 * showing, we're still drawing the voice from ElevenLabs... I'd like to give
 * it a full try."
 *
 * This is the root fix for two things he hit on his 2026-09-03 rides:
 *   - `repeat_silent` (app_events, severity HIGH, four times in one day): the
 *     provider accepts a line, returns an id, and never speaks it. 6's mouth
 *     does not move.
 *   - "that was a different voice, we're playing different voices here": the
 *     rescue for the above swapped engines MID-RIDE, so one conversation came
 *     out in two voices.
 * Both disappear if only one engine ever generates the audio. The audio is
 * still pushed through the avatar's own socket, so lip-sync is unchanged.
 *
 * The cost is one ElevenLabs round trip before he speaks. If that ever feels
 * slow on a real ride, flip this single constant back to false and the
 * provider voice returns with the old rescue behaviour underneath it.
 */
// TURNED BACK ON 2026-09-04 on G's order ("do the elevenlabs only voice"),
// after checking the two things that made it fail on ride cf79a533.
//
// 1. "It's an odd voice, it's not the real voice."
//    The 09-03 note assumed the ElevenLabs voice simply is not 6's voice. It
//    IS. Both engines were asked, by id, on 2026-09-04:
//      ELEVENLABS_VOICE_ID  vBIaixhF... -> "6-20251218-Nailed"
//      LIVEAVATAR_VOICE_ID  a65a59af... -> "6-20251218-Nailed"
//    The same voice, by name, on both sides. So an odd voice was never the
//    engine choice - see 2.
//
// 2. "I don't think a single time 6 moved his mouth."
//    That was the real fault, and it explains the odd sound too. The audio
//    never reached the avatar SOCKET: the greeting fires about a second after
//    the session starts, before the event socket connects, and the old code
//    marked the whole session's pipe dead on that single not-connected-yet
//    miss. Every later line then skipped the socket and played out of band
//    through the WebAudio fallback queue - no lip-sync, and processed by the
//    echo-cancelling output node, which is what made a familiar voice sound
//    thin and wrong. That bug is FIXED (see deliverCustomTtsAudio): a pipe
//    that has not come up yet is no longer a broken pipe, and across all
//    recorded rides the socket push now succeeds 302 times out of 306.
//
// So: one engine, one voice, generated once and pushed through the avatar's
// own socket, which is what animates the mouth. If ElevenLabs cannot be
// reached the provider voice still answers underneath, and the swap is logged
// rather than hidden.
//
// STILL UNPROVEN BY EARS: the precondition this file set for itself was "fix
// trySpeakViaSocketBase64 first AND prove lip-sync on a real ride". The fix is
// in; the ride is not. If 6's mouth is still, or he sounds wrong, flip this one
// constant back to false and the provider voice returns unchanged.
const ELEVENLABS_ONLY_VOICE = false;

export function speakThroughAvatar(
  session: LiveAvatarSession,
  text: string,
  where: string,
  onRescue?: (reason: string) => void,
  onPresentation?: (event: AvatarSpeechPresentationEvent) => void,
): unknown {
  if (!text || !text.trim()) return;
  if (!ELEVENLABS_ONLY_VOICE) {
    return speakViaProviderVoice(session, text, where, onRescue, onPresentation);
  }

  // A newer accepted reply owns the one speech pipe; drop the older probe
  // before this one takes the floor. Same rule the provider path uses.
  for (const cancel of [...activeAvatarSpeechCancels.keys()]) cancel();

  // Detached on purpose, exactly like the provider path: the caller is never
  // held up waiting for speech.
  void (async () => {
    // If this line was primed at tap time, the bytes are already here (or on
    // their way) and we skip a 3-second generation on the critical path.
    const primed = takePrimedSpeech(text);
    // A primed fetch that FAILED must not cost 6 his line - try once more live
    // before giving the turn to the provider voice.
    const audio = (primed ? await primed : null) ?? (await fetchRecoveryAudio(text));
    if (audio) {
      reportCustomVoiceDiag(
        `[custom-voice] ${where} elevenlabs-only b64len=${audio.length}${primed ? " (primed)" : ""}`,
      );
      deliverCustomTtsAudio(session, audio, where);
      return;
    }
    // ElevenLabs unreachable. Going silent would be worse than a different
    // voice, so fall through to the provider - and say so out loud in
    // telemetry rather than hiding a voice change.
    reportCustomVoiceDiag(`[custom-voice] ${where} elevenlabs unavailable -> provider voice`);
    onRescue?.("elevenlabs_unavailable");
    speakViaProviderVoice(session, text, where, onRescue, onPresentation);
  })();
}

/**
 * Speak through the avatar with a watchdog. Returns whatever repeat() returns
 * and does NOT wait — like deliverCustomTtsAudio, the watchdog runs detached,
 * so the caller is never held up by it.
 *
 * onRescue fires when the controlled failure path is taken, so a caller that has telemetry
 * context (an utteranceId) can log it in its own channel. Keeping it a callback
 * is why this module still has no telemetry dependency.
 */
/**
 * The provider-voice path. Still the fallback whenever ElevenLabs cannot be
 * reached, so every guarantee its tests encode - one bounded rescue per reply,
 * no speech after a barge-in, the observed 4-second native start - still has
 * to hold. Exported so those tests aim at it directly.
 */
export function speakViaProviderVoice(
  session: LiveAvatarSession,
  text: string,
  where: string,
  onRescue?: (reason: string) => void,
  onPresentation?: (event: AvatarSpeechPresentationEvent) => void,
): unknown {
  if (!text || !text.trim()) return;

  // A newer accepted reply owns the one avatar speech pipe. Cancel the older
  // presentation probe now; it may neither reattach media nor report a stale
  // failure after the new reply takes the floor.
  for (const cancel of [...activeAvatarSpeechCancels.keys()]) cancel();

  let settled = false;
  let providerStarted = false;
  let recoveryAttempted = false;
  // One audible recovery per reply, ever. `settled` already makes rescue()
  // single-shot; this is the explicit belt to go with that brace.
  let audibleRecoveryStarted = false;
  let repeatDispatched = false;
  let queuedStartedEvent: { event_id?: string } | null = null;
  let repeatWatchdog: number | null = null;
  let gapHintTimer: number | null = null;
  const presentationStartedAt = Date.now();
  const presentationAbort = new AbortController();
  // Snapshot the barge-in counter. If the person talks over 6 (or hits QUIET)
  // while we are waiting, the line is stale and rescuing it would make 6 speak
  // over the very interruption that cancelled him.
  const armedEpoch = cutEpoch;
  const myReplyEpoch = ++replyEpoch;

  const emitPresentation = (
    stage: AvatarSpeechPresentationEvent["stage"],
    reason?: string,
    evidence?: AvatarAudioPresentationEvidence,
  ) => {
    onPresentation?.({
      stage,
      reason,
      durationMs: Math.max(0, Date.now() - presentationStartedAt),
      evidence,
    });
  };

  const disarm = () => {
    if (repeatWatchdog !== null) {
      window.clearTimeout(repeatWatchdog);
      repeatWatchdog = null;
    }
    if (gapHintTimer !== null) {
      window.clearTimeout(gapHintTimer);
      gapHintTimer = null;
    }
    try {
      session.off(AgentEventsEnum.AVATAR_SPEAK_STARTED, onStarted);
    } catch {
      // listener already gone
    }
  };
  const finish = () => {
    if (settled) return false;
    settled = true;
    presentationAbort.abort();
    disarm();
    activeAvatarSpeechCancels.delete(cancel);
    return true;
  };
  const cancel = () => {
    finish();
  };
  activeAvatarSpeechCancels.set(cancel, session);

  const rescue = (reason: string) => {
    if (settled) return;
    if (replyEpoch !== myReplyEpoch) {
      finish();
      reportCustomVoiceDiag(
        `[custom-voice] ${where} silent (${reason}) but superseded by a newer reply — no rescue`,
      );
      return;
    }
    if (cutEpoch !== armedEpoch) {
      finish();
      reportCustomVoiceDiag(
        `[custom-voice] ${where} silent (${reason}) but interrupted since — no rescue`,
      );
      return;
    }
    finish();
    reportCustomVoiceDiag(
      `[custom-voice] ${where} silent (${reason}) -> stable avatar-mode failure signal`,
    );
    onRescue?.(reason);
    // Do NOT push repeatAudio into the avatar session here. That old rescue
    // produced rapid start/end events, no lip sync, and repeated mic
    // CLOSED/OPEN clicks. The stage records the fault and never changes modes
    // without the visitor pressing the explicit Voice control.
    reportAvatarSpeechFailure({ session, where, reason, textLength: text.length });

    // ...but the person is still owed the answer out loud. One bounded
    // recovery through our own TTS + the WebAudio armor (see the block above).
    if (!AUDIBLE_RECOVERY_REASONS.has(reason) || audibleRecoveryStarted) return;
    audibleRecoveryStarted = true;
    emitPresentation("audio_recovery_started", reason);
    void recoverSpeechAudibly({
      session,
      text,
      where,
      replyEpochAtArm: myReplyEpoch,
      cutEpochAtArm: armedEpoch,
    })
      .then((outcome) => emitPresentation("audio_recovery_finished", outcome))
      .catch(() => emitPresentation("audio_recovery_finished", "tts_threw"));
  };

  const verifyPresentation = async () => {
    const probe = avatarAudioPresentationProbes.get(session);
    const initialEvidence = probe?.snapshot();
    emitPresentation("provider_started", undefined, initialEvidence);
    if (!probe) {
      // WHY THIS MATTERS (2026-09-04): this fired twice on G's 17:06 ride and
      // costs lip-sync every time - the rescue speaks through our own TTS, so
      // 6's mouth does not move. It is NOT the ElevenLabs-only flag; this path
      // runs on the provider route too, so it can happen again with that off.
      //
      // Two causes look identical from here and need telling apart:
      //   (a) the binding effect has not run yet for this session, so NOTHING
      //       is bound - probeBindCount would be 0, or the last bound session
      //       is gone;
      //   (b) a probe IS bound, but to a DIFFERENT session object than the one
      //       speaking - a stale sessionRef. Then `sameSession` is false while
      //       `everBound` is true.
      // Guessing between them in the speech path is how you break a ride, so
      // record which one it is and let the next ride settle it.
      const bound = lastBoundProbeSession?.deref() ?? null;
      reportCustomVoiceDiag(
        `[custom-voice] ${where} media probe missing` +
          ` everBound=${probeBindCount}` +
          ` boundSessionAlive=${Boolean(bound)}` +
          ` sameSession=${bound === session}`,
      );
      rescue("media_probe_unavailable");
      return;
    }

    const initial = await probe.observe(
      PRESENTATION_WATCH_MS,
      presentationAbort.signal,
    );
    if (settled || presentationAbort.signal.aborted) return;
    emitPresentation("initial_probe", initial.reason, initial.evidence);
    if (initial.suppressed) {
      emitPresentation("intentionally_silent", initial.reason, initial.evidence);
      finish();
      return;
    }
    if (initial.presented) {
      noteSixAudioActive();
      emitPresentation("media_presented", initial.reason, initial.evidence);
      finish();
      return;
    }
    if (replyEpoch !== myReplyEpoch || cutEpoch !== armedEpoch) {
      finish();
      return;
    }

    // One media-only recovery. It may reattach the existing remote tracks and
    // retry browser playback, but it never repeats text, mints, or starts a
    // second provider session.
    if (recoveryAttempted) return;
    recoveryAttempted = true;
    emitPresentation(
      "media_recovery_started",
      initial.reason,
      initial.evidence,
    );
    const recovery = await probe.recover(presentationAbort.signal);
    if (settled || presentationAbort.signal.aborted) return;
    emitPresentation(
      "media_recovery_finished",
      recovery.reason,
      recovery.evidence,
    );
    if (recovery.suppressed) {
      emitPresentation(
        "intentionally_silent",
        recovery.reason,
        recovery.evidence,
      );
      finish();
      return;
    }

    const afterRecovery = await probe.observe(
      PRESENTATION_RECOVERY_WATCH_MS,
      presentationAbort.signal,
    );
    if (settled || presentationAbort.signal.aborted) return;
    emitPresentation(
      "recovery_probe",
      afterRecovery.reason,
      afterRecovery.evidence,
    );
    if (afterRecovery.suppressed) {
      emitPresentation(
        "intentionally_silent",
        afterRecovery.reason,
        afterRecovery.evidence,
      );
      finish();
      return;
    }
    if (afterRecovery.presented) {
      noteSixAudioActive();
      emitPresentation(
        "media_presented",
        afterRecovery.reason,
        afterRecovery.evidence,
      );
      finish();
      return;
    }
    rescue(
      afterRecovery.reason === "browser_play_rejected"
        ? "browser_play_rejected"
        : "media_not_presented",
    );
  };

  const handleStarted = (_event?: { event_id?: string }) => {
    if (settled || providerStarted) return;
    // HeyGen does not preserve repeat()'s command event_id on every
    // agent.speak_started notification. Supabase proved the SDK-wide listener
    // saw native speech start while this per-reply watchdog discarded the same
    // event and launched the different ElevenLabs voice over it. This function
    // owns the one current speech pipe (newer replies cancel older probes), so
    // a post-dispatch native start is authoritative even when its opaque id was
    // replaced by the provider.
    providerStarted = true;
    disarm();
    void verifyPresentation().catch(() => rescue("media_probe_failed"));
  };
  const onStarted = (event?: { event_id?: string }) => {
    if (!repeatDispatched) {
      queuedStartedEvent = event ?? {};
      return;
    }
    handleStarted(event);
  };

  try {
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, onStarted);
  } catch {
    // Let the one requested dispatch proceed, but record that presentation is
    // unobservable. Never add a blind second dispatch to compensate.
    let bareResult: unknown;
    try {
      bareResult = session.repeat(text);
    } catch (error) {
      rescue("repeat_threw");
      return;
    }
    finish();
    reportCustomVoiceDiag(
      `[custom-voice] ${where} provider listener unavailable -> presentation unobservable`,
    );
    onRescue?.("provider_listener_unavailable");
    reportAvatarSpeechFailure({
      session,
      where,
      reason: "provider_listener_unavailable",
      textLength: text.length,
    });
    return bareResult;
  }

  let result: unknown;
  try {
    result = session.repeat(text);
    repeatDispatched = true;
    if (queuedStartedEvent) handleStarted(queuedStartedEvent);
  } catch (e) {
    repeatDispatched = true;
    reportCustomVoiceDiag(
      `[custom-voice] ${where} repeat() threw: ${e instanceof Error ? e.message : String(e)}`,
    );
    rescue("repeat_threw");
    return;
  }

  // A rejected promise is the old caught case; keep handling it, just here now.
  Promise.resolve(result).catch(() => rescue("repeat_rejected"));

  if (!providerStarted) {
    // One small sound at 1.4 s so a slow start does not read as 6 freezing.
    // Cleared by disarm() the moment he actually speaks.
    gapHintTimer = window.setTimeout(() => {
      gapHintTimer = null;
      if (!providerStarted && !settled) reportAvatarSpeechGap({ session, where });
    }, SPEECH_GAP_HINT_MS);
    repeatWatchdog = window.setTimeout(() => {
      repeatWatchdog = null;
      // Accepted, resolved, and still not a word out of him. This is the case
      // that used to go unnoticed.
      if (!providerStarted) rescue("repeat_silent");
    }, REPEAT_WATCHDOG_MS);
  }

  return result;
}
