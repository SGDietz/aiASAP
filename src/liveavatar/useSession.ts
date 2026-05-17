import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

export const useSession = () => {
  const {
    sessionRef,
    sessionAccessToken,
    sessionState,
    isStreamReady,
    connectionQuality,
  } =
    useLiveAvatarContext();

  const startSession = useCallback(async () => {
    return await sessionRef.current.start();
  }, [sessionRef]);

  const stopSession = useCallback(async () => {
    try {
      if (sessionAccessToken) {
        await fetch("/api/v1/sessions/stop", {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionAccessToken}` },
        });
      }
    } catch (error) {
      console.warn("LiveAvatar server stop failed:", error);
    } finally {
      return await sessionRef.current.stop();
    }
  }, [sessionAccessToken, sessionRef]);

  const keepAlive = useCallback(async () => {
    return await sessionRef.current.keepAlive();
  }, [sessionRef]);

  const attachElement = useCallback(
    (element: HTMLMediaElement) => {
      return sessionRef.current.attach(element);
    },
    [sessionRef],
  );

  return {
    sessionState,
    isStreamReady,
    connectionQuality,
    startSession,
    stopSession,
    keepAlive,
    attachElement,
  };
};
