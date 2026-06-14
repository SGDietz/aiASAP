import { AgentEventsEnum, LiveAvatarSession } from "@heygen/liveavatar-web-sdk";
import { pcm16Base64ToAudioBuffer } from "../lib/voiceMode/pcm";

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

/** Sessions whose avatar-audio pipe has been proven dead (watchdog missed). */
const deadAudioSessions = new WeakSet<object>();

let fallbackCtx: AudioContext | null = null;
let aecDest: MediaStreamAudioDestinationNode | null = null;
let aecAudioEl: HTMLAudioElement | null = null;
let aecRouteWorking = false;
let playbackChain: Promise<void> = Promise.resolve();
let pendingCount = 0;
let activeSource: AudioBufferSourceNode | null = null;
let cutEpoch = 0;

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
export function wasRecentlySpokenBySix(userText: string): boolean {
  const heard = normalizeForEcho(userText);
  if (heard.length < 8) return false; // too short to attribute either way
  const now = Date.now();
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

async function playPcmBase64ViaWebAudio(audioBase64: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!fallbackCtx) fallbackCtx = new AudioContext();
  if (fallbackCtx.state === "suspended") {
    try {
      await fallbackCtx.resume();
    } catch {
      // resume is gesture-gated; if it stays suspended the play below is a no-op
    }
  }
  const buffer = pcm16Base64ToAudioBuffer(fallbackCtx, audioBase64);
  await new Promise<void>((resolve) => {
    const source = fallbackCtx!.createBufferSource();
    source.buffer = buffer;
    source.connect(fallbackOutputNode(fallbackCtx!));
    source.onended = () => {
      if (activeSource === source) activeSource = null;
      resolve();
    };
    activeSource = source;
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
function enqueueFallback(session: LiveAvatarSession, audioBase64: string): void {
  const myEpoch = cutEpoch;
  pendingCount++;
  playbackChain = playbackChain
    .then(async () => {
      if (cutEpoch !== myEpoch) return; // barge-in cleared the queue
      setMicGate(session, false);
      await playPcmBase64ViaWebAudio(audioBase64);
    })
    .catch(() => {
      // keep the chain alive no matter what a single item does
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
}

/** Stop the current fallback utterance AND drop anything queued behind it. */
export function cutCustomVoiceFallback(): void {
  cutEpoch++;
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
function trySpeakViaSocketBase64(
  session: LiveAvatarSession,
  audioBase64: string,
): boolean {
  try {
    const sock = (
      session as unknown as { _sessionEventSocket?: WebSocket | null }
    )._sessionEventSocket;
    if (!sock || sock.readyState !== WebSocket.OPEN) return false;
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
    return true;
  } catch {
    return false;
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
  const sentB64 = trySpeakViaSocketBase64(session, audioBase64);
  const socket = audioSocketState(session);
  reportCustomVoiceDiag(
    `[custom-voice] ${where} socket=${socket} b64speak=${sentB64} b64len=${audioBase64.length}`,
  );
  if (!sentB64) {
    deadAudioSessions.add(session);
    reportCustomVoiceDiag(`[custom-voice] ${where} undeliverable -> WebAudio fallback`);
    enqueueFallback(session, audioBase64);
    return;
  }
  // Socket said OPEN — but if the avatar never starts speaking, voice it
  // ourselves and stop trusting the pipe for the rest of this session.
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
}
