import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";

export const useTextChat = () => {
  const { sessionRef, reportActivity } = useLiveAvatarContext();

  const sendMessage = useCallback(
    async (message: string) => {
      reportActivity();
      return sessionRef.current.message(message);
    },
    [sessionRef, reportActivity],
  );

  return {
    sendMessage,
  };
};
