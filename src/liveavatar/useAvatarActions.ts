import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";
import {
  cutCustomVoiceFallback,
  registerSixSpokenLine,
  speakThroughAvatar,
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
        // LIP-SYNC (G 2026-06-14): native TTS via repeat() (room-based CUSTOM
        // mint, voice, no context_id) moves 6's MOUTH. ElevenLabs + the WebAudio
        // armor stay as the silent fallback.
        //
        // 2026-08-21: this used to be a bare try/catch around repeat(), which
        // only rescued 6 when the call THREW. The failure that actually happens
        // is the call being accepted and then ignored — 6 goes mute and nothing
        // notices. speakThroughAvatar adds the AVATAR_SPEAK_STARTED watchdog
        // that deliverCustomTtsAudio already had, and is shared with useTextChat
        // so the two paths cannot drift.
        return speakThroughAvatar(sessionRef.current, message, "actions.repeat");
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
