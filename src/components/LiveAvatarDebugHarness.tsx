"use client";

import { useRef, useState } from "react";
import {
  AgentEventsEnum,
  LiveAvatarSession,
  SessionEvent,
  SessionState,
} from "@heygen/liveavatar-web-sdk";

type Variant = {
  id: string;
  label: string;
  includeContext: boolean;
  includeVoice: boolean;
  isSandbox: boolean;
};

const VARIANTS: Variant[] = [
  {
    id: "current",
    label: "Current: voice + context",
    includeContext: true,
    includeVoice: true,
    isSandbox: false,
  },
  {
    id: "sandbox",
    label: "Sandbox: voice + context",
    includeContext: true,
    includeVoice: true,
    isSandbox: true,
  },
  {
    id: "no-context",
    label: "No context: voice only",
    includeContext: false,
    includeVoice: true,
    isSandbox: false,
  },
  {
    id: "no-context-sandbox",
    label: "No context + sandbox",
    includeContext: false,
    includeVoice: true,
    isSandbox: true,
  },
];

type DebugTokenResponse = {
  session_token?: string;
  session_id?: string;
  payload?: unknown;
  error?: string;
};

function timeStamp() {
  return new Date().toLocaleTimeString();
}

export function LiveAvatarDebugHarness() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const [variantId, setVariantId] = useState("no-context");
  const [sessionState, setSessionState] = useState<string>(SessionState.INACTIVE);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [avatarSpeechEvents, setAvatarSpeechEvents] = useState(0);
  const [avatarTranscriptEvents, setAvatarTranscriptEvents] = useState(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>("none");
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [testText, setTestText] = useState(
    "Hi, I'm 6. This is a LiveAvatar debug speech test.",
  );

  const variant = VARIANTS.find((item) => item.id === variantId) ?? VARIANTS[0];

  function log(message: string, data?: unknown) {
    const suffix = data === undefined ? "" : ` ${JSON.stringify(data)}`;
    setLogs((current) => [`${timeStamp()} ${message}${suffix}`, ...current].slice(0, 80));
  }

  async function unlockAudio() {
    const video = videoRef.current;
    if (!video) {
      log("audio.unlock failed", "video element missing");
      return;
    }
    video.muted = false;
    video.volume = 1;
    try {
      await video.play();
      setAudioUnlocked(true);
      log("audio.unlocked", {
        muted: video.muted,
        volume: video.volume,
        paused: video.paused,
        readyState: video.readyState,
      });
    } catch (error) {
      setAudioUnlocked(false);
      log("audio.unlock failed", error instanceof Error ? error.message : String(error));
    }
  }

  function attachDebugListeners(session: LiveAvatarSession) {
    session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
      setSessionState(state);
      log(`session.state=${state}`);
    });
    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      log("session.stream_ready");
      if (videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = 1;
        session.attach(videoRef.current);
        void videoRef.current.play().then(() => {
          setAudioUnlocked(true);
          log("video.play ok", {
            muted: videoRef.current?.muted,
            volume: videoRef.current?.volume,
            paused: videoRef.current?.paused,
            readyState: videoRef.current?.readyState,
          });
        }).catch((error) => {
          setAudioUnlocked(false);
          log("video.play failed", String(error));
        });
      }
    });
    session.on(SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED, (quality) => {
      log("session.quality", quality);
    });
    session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
      log("session.disconnected", reason);
    });

    const agentEvents = [
      AgentEventsEnum.USER_SPEAK_STARTED,
      AgentEventsEnum.USER_SPEAK_ENDED,
      AgentEventsEnum.USER_TRANSCRIPTION,
      AgentEventsEnum.USER_TRANSCRIPTION_CHUNK,
      AgentEventsEnum.AVATAR_TRANSCRIPTION,
      AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK,
      AgentEventsEnum.AVATAR_SPEAK_STARTED,
      AgentEventsEnum.AVATAR_SPEAK_ENDED,
      AgentEventsEnum.ELEVENLABS_AGENT_EVENT,
      AgentEventsEnum.SESSION_STOPPED,
    ];
    agentEvents.forEach((eventName) => {
      session.on(eventName as never, ((event: unknown) => {
        if (eventName === AgentEventsEnum.AVATAR_SPEAK_STARTED) {
          setAvatarSpeechEvents((count) => count + 1);
        }
        if (
          eventName === AgentEventsEnum.AVATAR_TRANSCRIPTION ||
          eventName === AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK
        ) {
          setAvatarTranscriptEvents((count) => count + 1);
        }
        log(String(eventName), event);
      }) as never);
    });
  }

  async function start() {
    setBusy(true);
    setLogs([]);
    setSessionId(null);
    setAvatarSpeechEvents(0);
    setAvatarTranscriptEvents(0);
    setAudioUnlocked(false);
    setLastCommand("none");
    try {
      await sessionRef.current?.stop().catch(() => null);
      const res = await fetch("/api/liveavatar/debug-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variant),
      });
      const data = (await res.json().catch(() => null)) as DebugTokenResponse | null;
      if (!res.ok || !data?.session_token) {
        throw new Error(data?.error || `Token failed (${res.status})`);
      }
      setSessionId(data.session_id ?? null);
      log("token.ok", { variant: variant.id, session_id: data.session_id, payload: data.payload });
      const session = new LiveAvatarSession(data.session_token, {
        apiUrl: window.location.origin + "/api",
        voiceChat: false,
      });
      sessionRef.current = session;
      attachDebugListeners(session);
      await session.start();
      log("start.done");
    } catch (error) {
      log("start.error", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await sessionRef.current?.stop();
      log("stop.done");
    } catch (error) {
      log("stop.error", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function sendRepeat() {
    try {
      const eventId = sessionRef.current?.repeat(testText);
      setLastCommand("repeat()");
      log("repeat.sent", { eventId, text: testText });
    } catch (error) {
      log("repeat.error", error instanceof Error ? error.message : String(error));
    }
  }

  function sendMessage() {
    try {
      const eventId = sessionRef.current?.message(testText);
      setLastCommand("message()");
      log("message.sent", { eventId, text: testText });
    } catch (error) {
      log("message.error", error instanceof Error ? error.message : String(error));
    }
  }

  function buildDiscordReport() {
    const logExcerpt = logs.slice(0, 12).reverse().join("\n");
    return `We are still seeing the same LiveAvatar FULL speech issue on SDK 0.0.17.

Session connects and avatar video is visible. repeat() and/or message() send without throwing, but no avatar.speak_started / avatar.speak_ended / avatar transcription events fire, and no audio plays.

Latest session_id:
${sessionId ?? "none captured"}

Token variant tested:
${variant.label}
FULL mode
avatar_persona: ${[
      variant.includeVoice ? "voice_id" : null,
      variant.includeContext ? "context_id" : null,
    ]
      .filter(Boolean)
      .join(", ") || "none"}
is_sandbox: ${variant.isSandbox}

Last command:
${lastCommand}

Test text:
"${testText}"

Observed on page:
State: ${sessionState}
Audio unlocked: ${audioUnlocked ? "yes" : "no"}
Avatar speak events: ${avatarSpeechEvents}
Avatar transcript events: ${avatarTranscriptEvents}

Also: every token request with is_sandbox: true returns HTTP 400 for this account, even avatar-only, so we cannot test sandbox.

Recent client log:
${logExcerpt || "No client log lines captured yet."}

What should we test next, or can you check the session server-side?`;
  }

  async function copyDiscordReport() {
    const report = buildDiscordReport();
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus("Copied Discord report");
      log("discord_report.copied");
    } catch (error) {
      setCopyStatus("Copy failed - select text from log instead");
      log("discord_report.copy_failed", error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#060302] px-3 py-4 text-[#f7dfbd] sm:px-4 sm:py-6">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:grid lg:grid-cols-[1fr_24rem] lg:gap-5">
        <div className="order-2 rounded-[1.25rem] border border-[#e0aa62]/20 bg-black p-3 lg:order-1 lg:rounded-[1.5rem] lg:p-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            controls
            className="aspect-[9/16] max-h-[64vh] w-full rounded-[1rem] bg-[#120a05] object-contain lg:max-h-[78vh] lg:rounded-[1.25rem]"
          />
        </div>

        <aside className="order-1 w-full rounded-[1.25rem] border border-[#e0aa62]/20 bg-[#140b05] p-4 lg:order-2 lg:rounded-[1.5rem]">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#e0aa62]">
            LiveAvatar debug
          </p>
          <h1 className="mt-3 text-2xl font-black leading-tight text-[#f1c477] sm:text-3xl">
            Speech path test
          </h1>
          <p className="mt-2 text-sm font-semibold text-white/62">
            Tests SDK 0.0.17 without aiASAP conversation logic. Sandbox returns
            HTTP 400 on this account, so test no-context first.
          </p>

          <label className="mt-5 block text-xs font-black uppercase tracking-[0.18em] text-white/50">
            Token variant
          </label>
          <div className="mt-2 grid gap-2">
            {VARIANTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setVariantId(item.id)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                  item.id === variant.id
                    ? "border-[#f1c477] bg-[#f1c477] text-black"
                    : "border-white/10 bg-black/35 text-white"
                }`}
              >
                {item.id === "no-context" ? "Try first: " : ""}
                {item.label}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-xs font-black uppercase tracking-[0.18em] text-white/50">
            Test text
          </label>
          <textarea
            value={testText}
            onChange={(event) => setTestText(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm font-semibold text-white"
          />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void start()}
              disabled={busy}
              className="rounded-full bg-[#e0aa62] px-4 py-3 font-black text-black disabled:opacity-50"
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => void stop()}
              disabled={busy}
              className="rounded-full bg-white/10 px-4 py-3 font-black text-white disabled:opacity-50"
            >
              Stop
            </button>
            <button
              type="button"
              onClick={() => void unlockAudio()}
              className="col-span-2 rounded-full bg-white px-4 py-3 font-black text-black"
            >
              Unlock audio / play video
            </button>
            <button
              type="button"
              onClick={sendRepeat}
              disabled={busy || sessionState !== SessionState.CONNECTED}
              className="rounded-full bg-[#f1c477] px-4 py-3 font-black text-black disabled:opacity-50"
            >
              repeat()
            </button>
            <button
              type="button"
              onClick={sendMessage}
              disabled={busy || sessionState !== SessionState.CONNECTED}
              className="rounded-full bg-[#f1c477] px-4 py-3 font-black text-black disabled:opacity-50"
            >
              message()
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-xs font-semibold text-white/70">
            <p>State: {sessionState}</p>
            <p>Session: {sessionId ?? "none"}</p>
            <p>Variant: {variant.label}</p>
            <p>Audio unlocked: {audioUnlocked ? "yes" : "no"}</p>
            <p>Last command: {lastCommand}</p>
            <p>Avatar speak events: {avatarSpeechEvents}</p>
            <p>Avatar transcript events: {avatarTranscriptEvents}</p>
            <p className={avatarSpeechEvents > 0 ? "text-green-300" : "text-red-300"}>
              {avatarSpeechEvents > 0
                ? "LiveAvatar sent speech; phone audio may be blocked if silent."
                : "No avatar speech event seen yet."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void copyDiscordReport()}
            className="mt-3 w-full rounded-full bg-[#e0aa62] px-4 py-3 font-black text-black"
          >
            Copy Discord report
          </button>
          {copyStatus ? (
            <p className="mt-2 text-center text-xs font-black uppercase tracking-[0.12em] text-[#f1c477]">
              {copyStatus}
            </p>
          ) : null}

          <div className="mt-4 max-h-[34vh] overflow-y-auto rounded-xl bg-black/40 p-3 font-mono text-[0.72rem] text-white/72">
            {logs.length ? (
              logs.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)
            ) : (
              <p>No events yet.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
