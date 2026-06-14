import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";
import {
  deliverCustomTtsAudio,
  registerSixSpokenLine,
} from "./customVoiceDelivery";

export const useTextChat = (
  mode: "FULL" | "CUSTOM",
  // r25 (2026-06-12, live co-pilot: avatar-mode CUSTOM turns never reached
  // conversation_messages — the official transcript sync only covers FULL
  // sessions): the component passes a logger so 6's brain replies land in the
  // transcript table.
  onAssistantText?: (text: string) => void,
  // r26: the brain was stateless — every call looked like first contact, so
  // 6 re-introduced himself on every turn. The component supplies the running
  // conversation; we send it with each call.
  getHistory?: () => Array<{ role: "user" | "assistant"; content: string }>,
  // r32 (G 2026-06-12 20:43: 6 said "I don't have a name from you yet"
  // minutes after G gave it): the captured name rides on every brain call.
  getUserName?: () => string | null,
  // r34 (G signed in, brain asked "first time signing up?"): signed-in
  // state rides too.
  getSignedInEmail?: () => string | null,
) => {
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
            history: getHistory?.() ?? [],
            userName: getUserName?.() ?? null,
            signedInEmail: getSignedInEmail?.() ?? null,
          }),
        });
        const { response: chatResponseText } = await response.json();
        if (typeof chatResponseText === "string" && chatResponseText) {
          onAssistantText?.(chatResponseText);
          registerSixSpokenLine(chatResponseText); // echo firewall registry
        }
        // LIP-SYNC (G 2026-06-14): the CUSTOM mint is now a room-based session
        // with a voice but NO context_id, so repeat() (AVATAR_SPEAK_TEXT) makes
        // 6's MOUTH move with native TTS in his voice. Our brain produced the
        // text, so every CUSTOM-mode fix still holds (no interrupt, memory, no
        // double-greet). ElevenLabs + the WebAudio armor stay as the silent
        // fallback if repeat() ever no-ops.
        try {
          return sessionRef.current.repeat(chatResponseText);
        } catch (e) {
          console.error("[textchat] repeat() failed, ElevenLabs fallback:", e);
          try {
            const res = await fetch("/api/elevenlabs-text-to-speech", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: chatResponseText }),
            });
            if (!res.ok) throw new Error(`tts ${res.status}`);
            const { audio } = (await res.json()) as { audio?: string };
            if (typeof audio !== "string" || audio.length < 50) {
              throw new Error("tts returned no audio");
            }
            return deliverCustomTtsAudio(sessionRef.current, audio, "textchat.reply");
          } catch (e2) {
            console.error("[textchat] ElevenLabs fallback also failed:", e2);
          }
        }
      }
    },
    [sessionRef, mode, reportActivity, onAssistantText, getHistory, getUserName, getSignedInEmail],
  );

  return {
    sendMessage,
  };
};
