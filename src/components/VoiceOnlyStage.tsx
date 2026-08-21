"use client";

/**
 * VOICE-ONLY 6 — no avatar, no LiveAvatar session, no per-block billing.
 *
 * G, 2026-08-21: "we need to have a system built where it can be voice only."
 *
 * Architecture by Ara (Job 4): VOICE is a real mode in LiveAvatarDemo, it never
 * calls startSession, and it never mounts LiveAvatarSession. Her first draft of
 * this component was a skeleton — it declared a recognizer ref but never created
 * one, and never called the brain, so 6 would have sat there saying "listening"
 * forever. She also caught her own bug that `deliverCustomTtsAudio` needs a live
 * session and told me. This is the working version, built on her design.
 *
 * The money argument, stated plainly: the avatar is what costs. A LiveAvatar
 * session bills from the moment it exists — a block for the first 30s then a
 * block every 6s, whether or not 6 is talking. This path mints none. It pays
 * only for OpenAI tokens and ElevenLabs speech, which is the difference between
 * a long interview being affordable and being something G watches the clock on.
 *
 * Deliberately self-contained: it does NOT reach into LiveAvatarSession's
 * control cluster or its ears. Two writers on one file is how work gets lost.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cutVoiceOnlyAudio,
  playVoiceOnlyAudio,
  setCustomVoiceMuted,
} from "../liveavatar/customVoiceDelivery";
import { logAppEvent } from "../lib/telemetry";

type Turn = { role: "user" | "assistant"; content: string };

type Props = {
  /** Speaker mute — 6 keeps listening and thinking, he just is not heard. */
  speakerMuted?: boolean;
  /** Mic off — 6 stops hearing. He can still speak. */
  micOff?: boolean;
  /** Cap the history sent to the brain. Keeps cost and latency sane. */
  historyTurns?: number;
};

type MinimalRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

function createRecognition(): MinimalRecognition | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => MinimalRecognition }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => MinimalRecognition })
      .webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = false;
  return rec;
}

/** Pull the final transcript text out of a recognition result event. */
function finalTextFrom(event: unknown): string {
  const e = event as {
    resultIndex?: number;
    results?: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>;
  };
  if (!e?.results) return "";
  let out = "";
  const start = typeof e.resultIndex === "number" ? e.resultIndex : 0;
  for (let i = start; i < e.results.length; i++) {
    const r = e.results[i];
    if (!r?.isFinal) continue;
    const alt = r[0];
    if (alt?.transcript) out += ` ${alt.transcript}`;
  }
  return out.trim();
}

export function VoiceOnlyStage({
  speakerMuted = false,
  micOff = false,
  historyTurns = 12,
}: Props) {
  // "fault" exists so a dead brain or dead voice is VISIBLE. Without it the
  // screen sat on "6 is listening" through every failure and the person waited
  // on somebody who was never going to answer.
  const [state, setState] = useState<
    "idle" | "listening" | "thinking" | "speaking" | "fault"
  >("idle");
  const [unsupported, setUnsupported] = useState(false);
  const recRef = useRef<MinimalRecognition | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const busyRef = useRef(false);
  const micOffRef = useRef(micOff);
  const mountedRef = useRef(true);
  // Every utterance takes a ticket. Only the newest ticket may write state,
  // append history, or speak. This is what makes barge-in real: when somebody
  // talks over 6, the older turn is still in flight but it can no longer do
  // anything, so there is no race to guard against with a busy flag.
  const turnIdRef = useRef(0);
  // True only while 6 is actually producing sound. Talking over him is allowed;
  // talking over the model call is not (that would double-charge and interleave).
  const speakingRef = useRef(false);

  useEffect(() => {
    micOffRef.current = micOff;
  }, [micOff]);

  // Speaker mute is owned by customVoiceDelivery so voice-only and avatar mode
  // cannot disagree about whether 6 is muted.
  useEffect(() => {
    setCustomVoiceMuted(speakerMuted);
    if (speakerMuted) cutVoiceOnlyAudio();
  }, [speakerMuted]);

  const speak = useCallback(async (text: string, turnId: number) => {
    if (!text.trim()) return;
    // Every failure below used to `return` in silence while the screen still
    // read "6 is listening" — the person waits forever and nothing anywhere
    // records it. Voice-only has no avatar to look wrong, so a silent failure
    // is invisible. Every exit now says why, out loud, to app_events.
    const fault = (reason: string, detail?: Record<string, unknown>) => {
      logAppEvent("voice_only_tts_failed", { reason, ...detail }, "high");
    };
    try {
      const res = await fetch("/api/elevenlabs-text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        fault("http_error", { status: res.status });
        if (mountedRef.current && turnId === turnIdRef.current) setState("fault");
        return;
      }
      const { audio } = (await res.json()) as { audio?: string };
      if (typeof audio !== "string" || audio.length < 50) {
        fault("empty_audio", { length: typeof audio === "string" ? audio.length : -1 });
        if (mountedRef.current && turnId === turnIdRef.current) setState("fault");
        return;
      }
      if (!mountedRef.current) return;
      // Somebody talked over him between the request and the reply — this turn
      // is stale, so drop it rather than speaking on top of the new one.
      if (turnId !== turnIdRef.current) return;
      setState("speaking");
      speakingRef.current = true;
      // PCM16 @24kHz, played through WebAudio with no session. Honours mute.
      await playVoiceOnlyAudio(audio);
    } catch (err) {
      fault("threw", { message: err instanceof Error ? err.message : String(err) });
      if (mountedRef.current && turnId === turnIdRef.current) setState("fault");
    } finally {
      speakingRef.current = false;
    }
  }, []);

  const handleUtterance = useCallback(
    async (userText: string) => {
      if (!userText.trim()) return;
      // BARGE-IN FIRST, unconditionally. This line used to sit BELOW a
      // `busyRef.current` guard — and busyRef is true for the whole time 6 is
      // speaking, so the guard returned before the cut ever ran and talking
      // over him was impossible. Cut, then decide.
      cutVoiceOnlyAudio();
      // Talking over his VOICE is allowed and is the whole point. Talking over
      // the model call is not: that would bill a second completion and
      // interleave two answers.
      if (busyRef.current && !speakingRef.current) return;
      speakingRef.current = false;
      const turnId = ++turnIdRef.current;
      busyRef.current = true;
      setState("thinking");
      const userTurn: Turn = { role: "user", content: userText };
      historyRef.current = [...historyRef.current, userTurn].slice(-historyTurns);
      try {
        const res = await fetch("/api/openai-chat-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            history: historyRef.current.slice(0, -1),
          }),
        });
        if (res.ok) {
          const { response } = (await res.json()) as { response?: string };
          if (response) {
            // Stale turn: they talked over him while the brain was thinking.
            // Throw this answer away rather than speaking it after the newer one.
            if (turnId !== turnIdRef.current) return;
            const botTurn: Turn = { role: "assistant", content: response };
            historyRef.current = [...historyRef.current, botTurn].slice(-historyTurns);
            await speak(response, turnId);
          } else {
            logAppEvent("voice_only_brain_empty", { status: res.status }, "high");
          }
        } else {
          // Same silent-failure problem as the TTS path: without this, the brain
          // 500s and the screen just says "listening" forever.
          logAppEvent("voice_only_brain_failed", { status: res.status }, "high");
          if (mountedRef.current && turnId === turnIdRef.current) setState("fault");
        }
      } catch (err) {
        logAppEvent(
          "voice_only_brain_threw",
          { message: err instanceof Error ? err.message : String(err) },
          "high",
        );
        if (mountedRef.current && turnId === turnIdRef.current) setState("fault");
      } finally {
        // Only the newest turn owns the state. An older turn finishing late
        // must not drag the screen back to "listening" under a live one.
        if (turnId === turnIdRef.current) {
          busyRef.current = false;
          if (mountedRef.current) {
            setState((prev) =>
              prev === "fault" ? "fault" : micOffRef.current ? "idle" : "listening",
            );
          }
        }
      }
    },
    [historyTurns, speak],
  );

  // The recognizer. `continuous` recognizers stop themselves on silence and on
  // errors, so onend restarts it — without that, 6 goes deaf after the first
  // pause and looks broken.
  useEffect(() => {
    mountedRef.current = true;
    const rec = createRecognition();
    if (!rec) {
      setUnsupported(true);
      return;
    }
    recRef.current = rec;
    rec.onresult = (event) => {
      const text = finalTextFrom(event);
      if (text) void handleUtterance(text);
    };
    rec.onerror = () => {
      // no-op: onend handles the restart
    };
    rec.onend = () => {
      if (!mountedRef.current || micOffRef.current) return;
      try {
        rec.start();
      } catch {
        // already started, or the browser refused — nothing useful to do
      }
    };
    return () => {
      mountedRef.current = false;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        // already stopped
      }
      cutVoiceOnlyAudio();
      recRef.current = null;
    };
  }, [handleUtterance]);

  // Mic toggle drives the recognizer directly.
  useEffect(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (micOff) {
      try {
        rec.stop();
      } catch {
        // already stopped
      }
      setState("idle");
    } else {
      try {
        rec.start();
        setState("listening");
      } catch {
        // already running
      }
    }
  }, [micOff]);

  const label = unsupported
    ? "This browser cannot listen — try Chrome"
    : state === "fault"
      ? "6 lost his voice for a second — say that again"
      : state === "speaking"
        ? "6 is speaking"
        : state === "thinking"
          ? "6 is thinking"
          : state === "listening"
            ? "6 is listening"
            : "6 is here — turn the mic on to talk";

  return (
    <div
      data-voice-only="1"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
      style={{ top: "calc(var(--stage-top) + var(--stage-height) * 0.55)" }}
    >
      <p className="text-center text-[1.35rem] sm:text-[1.6rem] font-black uppercase tracking-[0.16em] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent drop-shadow-[0_10px_28px_rgba(0,0,0,0.72)]">
        {label}
      </p>
    </div>
  );
}
