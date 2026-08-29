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
import {
  EMPTY_BUILD_INTEREST_STATE,
  canAdvanceBuildInterview,
  resolveContactSave,
  stepBuildInterest,
  type BuildInterestState,
} from "../lib/buildInterestFlow";
import { markPendingBuildAccountSetup, postOpportunitySignal } from "../lib/opportunityClient";
import { StageControls } from "./StageControls";
import { ContactCaptureBox } from "./ContactCaptureBox";
import { StageLegalFooter } from "./StageLegalFooter";
import { WildWorksLinkButton } from "./WildWorksLinkButton";
import {
  resolveAvatarSiteIntent,
  resolveWildWorksLinkTurn,
  type WildWorksOfferState,
} from "../lib/wildWorksLinkIntent";

type Turn = { role: "user" | "assistant"; content: string };

type Props = {
  /** Speaker mute — 6 keeps listening and thinking, he just is not heard. */
  speakerMuted?: boolean;
  /** Mic off — 6 stops hearing. He can still speak. */
  micOff?: boolean;
  /** Cap the history sent to the brain. Keeps cost and latency sane. */
  historyTurns?: number;
  /** Return to CUSTOM avatar mode; the parent owns the paid session mint. */
  onReturnAvatar: () => void;
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
  onReturnAvatar,
}: Props) {
  // "fault" exists so a dead brain or dead voice is VISIBLE. Without it the
  // screen sat on "6 is listening" through every failure and the person waited
  // on somebody who was never going to answer.
  const [state, setState] = useState<
    "idle" | "listening" | "thinking" | "speaking" | "fault"
  >("idle");
  const [unsupported, setUnsupported] = useState(false);
  const [running, setRunning] = useState(true);
  const [localMicOff, setLocalMicOff] = useState(micOff);
  const [localSpeakerMuted, setLocalSpeakerMuted] = useState(speakerMuted);
  const recRef = useRef<MinimalRecognition | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const busyRef = useRef(false);
  const micOffRef = useRef(localMicOff);
  const runningRef = useRef(true);
  const mountedRef = useRef(true);
  // Every utterance takes a ticket. Only the newest ticket may write state,
  // append history, or speak. This is what makes barge-in real: when somebody
  // talks over 6, the older turn is still in flight but it can no longer do
  // anything, so there is no race to guard against with a busy flag.
  const turnIdRef = useRef(0);
  // True only while 6 is actually producing sound. Talking over him is allowed;
  // talking over the model call is not (that would double-charge and interleave).
  const speakingRef = useRef(false);
  const [buildInterestState, setBuildInterestState] = useState<BuildInterestState>(EMPTY_BUILD_INTEREST_STATE);
  const buildInterestStateRef = useRef<BuildInterestState>(EMPTY_BUILD_INTEREST_STATE);
  const [wildWorksOfferState, setWildWorksOfferState] = useState<WildWorksOfferState>("idle");
  const wildWorksOfferStateRef = useRef<WildWorksOfferState>("idle");

  useEffect(() => {
    micOffRef.current = localMicOff;
  }, [localMicOff]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  // Speaker mute is owned by customVoiceDelivery so voice-only and avatar mode
  // cannot disagree about whether 6 is muted.
  useEffect(() => {
    setCustomVoiceMuted(localSpeakerMuted);
    if (localSpeakerMuted) cutVoiceOnlyAudio();
  }, [localSpeakerMuted]);

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
      // A final recognition event can already be queued when STOP calls
      // recognition.stop(). Do not let that stale event start a brain request.
      if (!runningRef.current) return;
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
        void postOpportunitySignal("turn", { text: userText });
        const wildWorks = resolveWildWorksLinkTurn(userText, wildWorksOfferStateRef.current);
        if (wildWorks) {
          wildWorksOfferStateRef.current = wildWorks.nextState;
          setWildWorksOfferState(wildWorks.nextState);
          if (wildWorks.handled && wildWorks.spoken) {
            const scriptedTurn: Turn = {
              role: "assistant",
              content: wildWorks.spoken,
            };
            historyRef.current = [...historyRef.current, scriptedTurn].slice(-historyTurns);
            await speak(wildWorks.spoken, turnId);
            return;
          }
        }
        const avatarSite = resolveAvatarSiteIntent(userText);
        if (avatarSite) {
          const scriptedTurn: Turn = { role: "assistant", content: avatarSite };
          historyRef.current = [...historyRef.current, scriptedTurn].slice(-historyTurns);
          await speak(avatarSite, turnId);
          return;
        }
        const scripted = stepBuildInterest(buildInterestStateRef.current, userText);
        if (scripted.handled) {
          buildInterestStateRef.current = scripted.state;
          setBuildInterestState(scripted.state);
          if (scripted.state.stage === "confirming" && scripted.state.method) {
            void postOpportunitySignal("contact_captured", { method: scripted.state.method });
          }
          let spoken = scripted.spoken;
          if (scripted.effect.kind === "start_account") {
            markPendingBuildAccountSetup();
            spoken = "I’ll bring the avatar back so we can set up your free account.";
          } else if (scripted.effect.kind === "save_contact") {
            if (spoken) await speak(spoken, turnId);
            const saved = await postOpportunitySignal("submit_contact", {
              method: scripted.effect.method,
              value: scripted.effect.value,
            });
            const resolved = resolveContactSave(scripted.state, saved.ok && saved.submitted);
            buildInterestStateRef.current = resolved.state;
            setBuildInterestState(resolved.state);
            spoken = resolved.spoken;
          }
          if (spoken) {
            const scriptedTurn: Turn = { role: "assistant", content: spoken };
            historyRef.current = [...historyRef.current, scriptedTurn].slice(-historyTurns);
            await speak(spoken, turnId);
          }
          if (scripted.effect.kind === "start_account" && turnId === turnIdRef.current) onReturnAvatar();
          return;
        }
        const res = await fetch("/api/openai-chat-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            history: historyRef.current.slice(0, -1),
            buildGateSatisfied: canAdvanceBuildInterview(buildInterestStateRef.current, false),
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
    [historyTurns, onReturnAvatar, speak],
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
      if (!mountedRef.current || micOffRef.current || !runningRef.current) return;
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
    if (!running || localMicOff) {
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
  }, [localMicOff, running]);

  const handleStopStart = useCallback(() => {
    if (runningRef.current) {
      wildWorksOfferStateRef.current = "idle";
      setWildWorksOfferState("idle");
      runningRef.current = false;
      setRunning(false);
      turnIdRef.current += 1;
      busyRef.current = false;
      speakingRef.current = false;
      cutVoiceOnlyAudio();
      try {
        recRef.current?.stop();
      } catch {
        // already stopped
      }
      setState("idle");
      return;
    }
    runningRef.current = true;
    setRunning(true);
    if (!micOffRef.current) {
      try {
        recRef.current?.start();
        setState("listening");
      } catch {
        // already running
      }
    }
  }, []);

  const stopVoiceOnlyForLegal = useCallback(() => {
    // Legal navigation is a hard audio boundary even though VOICE has no paid
    // avatar session. Invalidate in-flight turns, stop the ears, and cut the
    // WebAudio source before StageLegalFooter changes the document.
    runningRef.current = false;
    mountedRef.current = false;
    turnIdRef.current += 1;
    busyRef.current = false;
    speakingRef.current = false;
    setRunning(false);
    setState("idle");
    wildWorksOfferStateRef.current = "idle";
    setWildWorksOfferState("idle");
    cutVoiceOnlyAudio();
    const rec = recRef.current;
    if (rec) {
      rec.onend = null;
      try {
        rec.abort?.();
        rec.stop();
      } catch {
        // Already stopped is the desired legal-navigation state.
      }
    }
  }, []);

  const label = !running
    ? "6 is stopped"
    : unsupported
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
    <>
      <div
        data-voice-only="1"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
        style={{ top: "calc(var(--stage-top) + var(--stage-height) * 0.60)" }}
      >
        <p className="text-center text-[1.35rem] sm:text-[1.6rem] font-black uppercase tracking-[0.16em] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent drop-shadow-[0_10px_28px_rgba(0,0,0,0.72)]">
          {label}
        </p>
      </div>
      <StageControls
        running={running}
        micOff={localMicOff}
        quiet={localSpeakerMuted}
        onStopStart={handleStopStart}
        onToggleMic={() => setLocalMicOff((value) => !value)}
        onToggleQuiet={() => setLocalSpeakerMuted((value) => !value)}
      />
      <ContactCaptureBox
        stage={buildInterestState.stage}
        method={buildInterestState.method}
        value={buildInterestState.value}
      />
      {wildWorksOfferState === "shown" && (
        <WildWorksLinkButton
          onDismiss={() => {
            wildWorksOfferStateRef.current = "idle";
            setWildWorksOfferState("idle");
          }}
        />
      )}
      <StageLegalFooter
        phoneFlow
        placementClassName="md:absolute md:bottom-2 md:left-1/2 md:-translate-x-1/2"
        onBeforeNavigate={stopVoiceOnlyForLegal}
      />
    </>
  );
}
