import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

function decodePcmAudioBase64(audioBase64: string): string {
  if (typeof window === "undefined") {
    return audioBase64;
  }
  return window.atob(audioBase64);
}

export const useAvatarActions = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef } = useLiveAvatarContext();

  const interrupt = useCallback(() => {
    return sessionRef.current.interrupt();
  }, [sessionRef]);

  const repeat = useCallback(
    async (message: string) => {
      if (mode === "FULL") {
        return sessionRef.current.repeat(message);
      } else if (mode === "CUSTOM") {
        const res = await fetch("/api/elevenlabs-text-to-speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message }),
        });
        const { audio } = await res.json();
        return sessionRef.current.repeatAudio(decodePcmAudioBase64(audio));
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
