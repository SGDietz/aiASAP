"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AgentEventsEnum,
  CommandEventsEnum,
  LiveAvatarSession,
  SessionEvent,
  SessionState,
} from "@heygen/liveavatar-web-sdk";

const COMMAND_TOPIC = "agent-control";
const TEST_LINE =
  "Hi, I'm 6. This is a direct LiveAvatar smoke test.";
const RESPONSE_TEST_LINE =
  "Say exactly this sentence back: LiveAvatar response path test.";

type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  at: string;
  level: LogLevel;
  message: string;
};

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getLiveAvatarSessionId(session: LiveAvatarSession | null): string | null {
  const maybeSession = session as
    | { sessionId?: unknown; _sessionInfo?: { session_id?: unknown } }
    | null;
  const rawSessionId =
    maybeSession?.sessionId ?? maybeSession?._sessionInfo?.session_id;
  return typeof rawSessionId === "string" && rawSessionId
    ? rawSessionId
    : null;
}

export function LiveAvatarSmokeClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [state, setState] = useState<string>("idle");
  const [connected, setConnected] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [sessionMode, setSessionMode] = useState<"FULL" | "CUSTOM" | null>(
    null,
  );

  const canSpeak = connected && streamReady;

  const log = (message: string, level: LogLevel = "info") => {
    const at = new Date().toLocaleTimeString();
    setLogs((current) =>
      [{ at, level, message }, ...current].slice(0, 80),
    );
  };

  const session = useMemo(() => sessionRef.current, [connected]);

  useEffect(() => {
    return () => {
      void sessionRef.current?.stop().catch(() => undefined);
      sessionRef.current = null;
    };
  }, []);

  async function connect(mode: "FULL" | "CUSTOM") {
    if (sessionRef.current) {
      log("Session already exists. Stop it first.", "warn");
      return;
    }

    setState("minting token");
    setStreamReady(false);
    setConnected(false);
    setSessionMode(mode);
    log(`Requesting aiASAP LiveAvatar ${mode} token...`);

    const tokenResponse = await fetch(
      mode === "FULL" ? "/api/start-session" : "/api/start-custom-session",
      { method: "POST" },
    );
    const tokenData = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok || !tokenData?.session_token) {
      const message = tokenData?.error || "Token request failed";
      setState("token failed");
      setSessionMode(null);
      log(message, "error");
      return;
    }

    const nextSession = new LiveAvatarSession(tokenData.session_token, {
      apiUrl: `${window.location.origin}/api`,
      voiceChat: false,
    });
    sessionRef.current = nextSession;

    nextSession.on(SessionEvent.SESSION_STATE_CHANGED, (nextState) => {
      setState(nextState);
      setConnected(nextState === SessionState.CONNECTED);
      log(`session.state_changed ${nextState}`);
    });

    nextSession.on(SessionEvent.SESSION_STREAM_READY, () => {
      setStreamReady(true);
      log("session.stream_ready");
      if (videoRef.current) {
        nextSession.attach(videoRef.current);
        videoRef.current.muted = false;
        videoRef.current.volume = 1;
        void videoRef.current.play().catch((error) => {
          log(`video.play failed: ${String(error)}`, "warn");
        });
      }
    });

    nextSession.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, (event) => {
      log(`avatar.speak_started ${safeJson(event)}`);
    });
    nextSession.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, (event) => {
      log(`avatar.speak_ended ${safeJson(event)}`);
    });
    nextSession.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
      log(`avatar.transcription ${safeJson(event)}`);
    });
    nextSession.on(AgentEventsEnum.USER_SPEAK_STARTED, (event) => {
      log(`user.speak_started ${safeJson(event)}`);
    });
    nextSession.on(AgentEventsEnum.USER_SPEAK_ENDED, (event) => {
      log(`user.speak_ended ${safeJson(event)}`);
    });
    nextSession.on(AgentEventsEnum.USER_TRANSCRIPTION, (event) => {
      log(`user.transcription ${safeJson(event)}`);
    });

    try {
      await nextSession.start();
      log(
        `session.start resolved, id=${getLiveAvatarSessionId(nextSession) ?? "none"}`,
      );
      const internalRoom = (nextSession as any).room;
      const rawRoomState = internalRoom?.state ?? "unknown";
      log(`internal room state=${rawRoomState}`);
      internalRoom?.on?.(
        "dataReceived",
        (
          data: Uint8Array,
          _participant: unknown,
          _kind: unknown,
          topic: string,
        ) => {
          if (topic !== "agent-response") return;
          let decoded = "";
          try {
            decoded = new TextDecoder().decode(data);
          } catch {
            decoded = "[decode failed]";
          }
          log(`raw agent-response ${decoded}`);
        },
      );
    } catch (error) {
      log(`session.start failed: ${String(error)}`, "error");
      sessionRef.current = null;
      setSessionMode(null);
    }
  }

  async function stop() {
    const current = sessionRef.current;
    if (!current) return;
    sessionRef.current = null;
    setConnected(false);
    setStreamReady(false);
    setSessionMode(null);
    setState("stopping");
    try {
      await current.stop();
      log("session.stop resolved");
    } catch (error) {
      log(`session.stop failed: ${String(error)}`, "warn");
    }
    setState("idle");
  }

  function speakViaSdk() {
    const current = sessionRef.current;
    if (!current) {
      log("No session for SDK speak.", "warn");
      return;
    }
    const eventId = current.repeat(TEST_LINE);
    log(`sdk.repeat sent event_id=${eventId ?? "none"}`);
  }

  function speakResponseViaSdk() {
    const current = sessionRef.current;
    if (!current) {
      log("No session for SDK response.", "warn");
      return;
    }
    const eventId = current.message(RESPONSE_TEST_LINE);
    log(`sdk.message sent event_id=${eventId ?? "none"}`);
  }

  async function speakAudioViaSdk() {
    const current = sessionRef.current;
    if (!current) {
      log("No session for SDK audio.", "warn");
      return;
    }
    try {
      log("Requesting ElevenLabs PCM audio...");
      const response = await fetch("/api/elevenlabs-text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: TEST_LINE }),
      });
      const data = await response.json().catch(() => null);
      const audioBase64 =
        typeof data?.audio === "string" ? data.audio.trim() : "";
      if (!response.ok || !audioBase64) {
        throw new Error(data?.error || "No audio returned");
      }
      const audio = window.atob(audioBase64);
      const eventId = current.repeatAudio(audio);
      log(`sdk.repeatAudio sent event_id=${eventId ?? "none"}`);
    } catch (error) {
      log(`sdk.repeatAudio failed: ${String(error)}`, "error");
    }
  }

  function publishCommand(eventType: CommandEventsEnum, text: string) {
    const current = sessionRef.current as any;
    const room = current?.room;
    const publishData = room?.localParticipant?.publishData;
    if (!current || !room || typeof publishData !== "function") {
      log("No internal LiveKit room available for direct publish.", "warn");
      return;
    }
    const eventId = crypto.randomUUID();
    const payload = {
      event_id: eventId,
      event_type: eventType,
      session_id: getLiveAvatarSessionId(current),
      source_event_id: null,
      text,
    };
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    void publishData.call(room.localParticipant, encoded, {
      reliable: true,
      topic: COMMAND_TOPIC,
    })
      .then(() => log(`direct ${eventType} resolved event_id=${eventId}`))
      .catch((error: unknown) =>
        log(`direct ${eventType} failed: ${String(error)}`, "error"),
      );
    log(`direct ${eventType} queued ${safeJson(payload)}`);
  }

  function speakViaDirectLiveKit() {
    publishCommand(CommandEventsEnum.AVATAR_SPEAK_TEXT, TEST_LINE);
  }

  function speakResponseViaDirectLiveKit() {
    publishCommand(CommandEventsEnum.AVATAR_SPEAK_RESPONSE, RESPONSE_TEST_LINE);
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-5 text-neutral-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">
            aiASAP LiveAvatar Smoke Test
          </p>
          <h1 className="mt-1 text-2xl font-black">6 response path</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-300">
            This page bypasses the main app and tests whether LiveAvatar will
            speak with the aiASAP avatar/context today.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              className="aspect-video w-full bg-black object-contain"
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-neutral-900 p-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void connect("FULL")}
                disabled={Boolean(session)}
                className="rounded-md bg-amber-400 px-3 py-3 text-sm font-bold text-black disabled:opacity-45"
              >
                Connect FULL
              </button>
              <button
                type="button"
                onClick={() => void connect("CUSTOM")}
                disabled={Boolean(session)}
                className="rounded-md bg-orange-300 px-3 py-3 text-sm font-bold text-black disabled:opacity-45"
              >
                Connect CUSTOM
              </button>
              <button
                type="button"
                onClick={() => void stop()}
                disabled={!session}
                className="rounded-md bg-neutral-700 px-3 py-3 text-sm font-bold disabled:opacity-45"
              >
                Stop
              </button>
              <button
                type="button"
                onClick={speakViaSdk}
                disabled={!canSpeak}
                className="rounded-md bg-blue-400 px-3 py-3 text-sm font-bold text-black disabled:opacity-45"
              >
                Speak SDK
              </button>
              <button
                type="button"
                onClick={speakResponseViaSdk}
                disabled={!canSpeak}
                className="rounded-md bg-cyan-300 px-3 py-3 text-sm font-bold text-black disabled:opacity-45"
              >
                Response SDK
              </button>
              <button
                type="button"
                onClick={() => void speakAudioViaSdk()}
                disabled={!canSpeak}
                className="rounded-md bg-violet-300 px-3 py-3 text-sm font-bold text-black disabled:opacity-45"
              >
                Audio SDK
              </button>
              <button
                type="button"
                onClick={speakViaDirectLiveKit}
                disabled={!canSpeak}
                className="rounded-md bg-emerald-400 px-3 py-3 text-sm font-bold text-black disabled:opacity-45"
              >
                Speak Direct
              </button>
              <button
                type="button"
                onClick={speakResponseViaDirectLiveKit}
                disabled={!canSpeak}
                className="rounded-md bg-lime-300 px-3 py-3 text-sm font-bold text-black disabled:opacity-45"
              >
                Response Direct
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded bg-black/35 p-2">
                <dt className="text-neutral-400">State</dt>
                <dd className="font-bold">{state}</dd>
              </div>
              <div className="rounded bg-black/35 p-2">
                <dt className="text-neutral-400">Stream</dt>
                <dd className="font-bold">{streamReady ? "ready" : "not ready"}</dd>
              </div>
              <div className="rounded bg-black/35 p-2">
                <dt className="text-neutral-400">Mode</dt>
                <dd className="font-bold">{sessionMode ?? "none"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-neutral-900 p-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-neutral-300">
            Event Log
          </h2>
          <div className="mt-3 max-h-[45vh] overflow-y-auto rounded bg-black/45 p-3 font-mono text-xs leading-relaxed">
            {logs.length === 0 ? (
              <p className="text-neutral-500">No events yet.</p>
            ) : (
              logs.map((entry, index) => (
                <p
                  key={`${entry.at}-${index}`}
                  className={
                    entry.level === "error"
                      ? "text-red-300"
                      : entry.level === "warn"
                        ? "text-yellow-300"
                        : "text-neutral-200"
                  }
                >
                  [{entry.at}] {entry.message}
                </p>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
