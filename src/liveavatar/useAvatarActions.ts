import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

const formatSpokenBrandName = (message: string) =>
  message
    .replace(/\bA\.?\s*I\.?\s*A[-\s]?S[-\s]?A[-\s]?P\.?\b/gi, "a-i-ASAP")
    .replace(/\bAI\s+ASAP\b/gi, "a-i-ASAP")
    .replace(/\bai[-\s]?asap\b/gi, "a-i-ASAP");

export const useAvatarActions = () => {
  const { sessionRef } = useLiveAvatarContext();

  const interrupt = useCallback(() => {
    return sessionRef.current.interrupt();
  }, [sessionRef]);

  const repeat = useCallback(
    async (message: string) => {
      const spokenMessage = formatSpokenBrandName(message);
      const result = await sessionRef.current.repeat(spokenMessage);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("aiasap:assistant-repeat", {
            detail: { message: spokenMessage },
          }),
        );
      }
      return result;
    },
    [sessionRef],
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
