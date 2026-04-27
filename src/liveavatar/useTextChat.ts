import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

function decodePcmAudioBase64(audioBase64: string): string {
  if (typeof window === "undefined") {
    return audioBase64;
  }
  return window.atob(audioBase64);
}

export const useTextChat = (mode: "FULL" | "CUSTOM") => {
  const { sessionRef, reportActivity } = useLiveAvatarContext();

  const sendMessage = useCallback(
    async (message: string, imageAnalysis?: string | null) => {
      reportActivity();
      if (mode === "FULL") {
        return sessionRef.current.message(message);
      } else if (mode === "CUSTOM") {
        const response = await fetch("/api/openai-chat-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            image_analysis: imageAnalysis || undefined,
          }),
        });
        const { response: chatResponseText } = await response.json();
        const res = await fetch("/api/elevenlabs-text-to-speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chatResponseText }),
        });
        const { audio } = await res.json();
        // Have the avatar repeat the audio
        return sessionRef.current.repeatAudio(decodePcmAudioBase64(audio));
      }
    },
    [sessionRef, mode, reportActivity],
  );

  return {
    sendMessage,
  };
};
