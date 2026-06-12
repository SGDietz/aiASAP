import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";
import {
  cutCustomVoiceFallback,
  deliverCustomTtsAudio,
  registerSixSpokenLine,
} from "./customVoiceDelivery";

export const useAvatarActions = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef } = useLiveAvatarContext();

  const interrupt = useCallback(() => {
    // copilot 2026-06-12: barge-in must also silence the WebAudio fallback
    // voice (the avatar pipe can't carry CUSTOM audio; see customVoiceDelivery).
    cutCustomVoiceFallback();
    return sessionRef.current.interrupt();
  }, [sessionRef]);

  const repeat = useCallback(
    async (message: string) => {
      if (mode === "FULL") {
        return sessionRef.current.repeat(message);
      } else if (mode === "CUSTOM") {
        // r24 (live co-pilot, G's localhost session 23:24: "Failed to execute
        // 'atob'"): a failed TTS response used to feed undefined into atob and
        // crash the speak path — 6 went MUTE. Any ElevenLabs failure now falls
        // back to the session's built-in voice instead of silence.
        registerSixSpokenLine(message); // echo firewall: mark as 6's own words
        try {
          const res = await fetch("/api/elevenlabs-text-to-speech", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: message }),
          });
          if (!res.ok) {
            throw new Error(`tts ${res.status}: ${(await res.text()).slice(0, 120)}`);
          }
          const { audio } = (await res.json()) as { audio?: string };
          if (typeof audio !== "string" || audio.length < 50) {
            throw new Error("tts returned no audio");
          }
          // copilot 2026-06-11: repeatAudio can no-op silently (socket gone) —
          // delivery wrapper adds server-visible diag + WebAudio fallback.
          return deliverCustomTtsAudio(sessionRef.current, audio, "actions.repeat");
        } catch (e) {
          console.error("[custom repeat] ElevenLabs failed, falling back:", e);
          return sessionRef.current.repeat(message);
        }
      }
    },
    [sessionRef, mode],
  );

  const startListening = useCallback(() => {
    return sessionRef.current.startListening();
  }, [sessionRef]);

  const stopListening = useCallback(() => {
    return sessionRef.current.stopListening();
  }, [sessionRef]);

  return {
    interrupt,
    repeat,
    startListening,
    stopListening,
  };
};
