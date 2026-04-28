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
  const [variantId, setVariantId] = useState(VARIANTS[0].id);
  const [sessionState, setSessionState] = useState<string>(SessionState.INACTIVE);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [testText, setTestText] = useState(
    "Hi, I'm 6. This is a LiveAvatar debug speech test.",
  );

  const variant = VARIANTS.find((item) => item.id === variantId) ?? VARIANTS[0];

  function log(message: string, data?: unknown) {
    const suffix = data === undefined ? "" : ` ${JSON.stringify(data)}`;
    setLogs((current) => [`${timeStamp()} ${message}${suffix}`, ...current].slice(0, 80));
  }

  function attachDebugListeners(session: LiveAvatarSession) {
    session.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
      setSessionState(state);
      log(`session.state=${state}`);
    });
    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      log("session.stream_ready");
      if (videoRef.current) {
        session.attach(videoRef.current);
        void videoRef.current.play().catch((error) => {
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
        log(String(eventName), event);
      }) as never);
    });
  }

  async function start() {
    setBusy(true);
    setLogs([]);
    setSessionId(null);
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
      log("repeat.sent", { eventId, text: testText });
    } catch (error) {
      log("repeat.error", error instanceof Error ? error.message : String(error));
    }
  }

  function sendMessage() {
    try {
      const eventId = sessionRef.current?.message(testText);
      log("message.sent", { eventId, text: testText });
    } catch (error) {
      log("message.error", error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="min-h-screen bg-[#060302] px-4 py-6 text-[#f7dfbd]">
      <section className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_24rem]">
        <div className="rounded-[1.5rem] border border-[#e0aa62]/20 bg-black p-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="aspect-[9/16] max-h-[78vh] w-full rounded-[1.25rem] bg-[#120a05] object-contain"
          />
        </div>

        <aside className="rounded-[1.5rem] border border-[#e0aa62]/20 bg-[#140b05] p-4">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#e0aa62]">
            LiveAvatar isolated debug
          </p>
          <h1 className="mt-3 text-3xl font-black text-[#f1c477]">Speech path test</h1>
          <p className="mt-2 text-sm font-semibold text-white/62">
            Tests SDK 0.0.17 without aiASAP conversation logic.
          </p>

          <label className="mt-5 block text-xs font-black uppercase tracking-[0.18em] text-white/50">
            Token variant
          </label>
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 font-bold text-white"
          >
            {VARIANTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

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
          </div>

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
