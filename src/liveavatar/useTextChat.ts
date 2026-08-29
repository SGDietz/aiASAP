import { useCallback } from "react";
import { useLiveAvatarContext } from "./context";
import {
  registerSixSpokenLine,
  speakThroughAvatar,
} from "./customVoiceDelivery";
import { logAppEvent } from "../lib/telemetry";

export const useTextChat = (
  mode: "FULL" | "CUSTOM",
  // r25 (2026-06-12, live co-pilot: avatar-mode CUSTOM turns never reached
  // conversation_messages — the official transcript sync only covers FULL
  // sessions): the component passes a logger so 6's brain replies land in the
  // transcript table.
  onAssistantText?: (
    text: string,
    context: { utteranceId: string | null },
  ) => void,
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
  getBuildGateSatisfied?: () => boolean,
  // The turn chain releases after dispatch, so a newer accepted user turn can
  // reach the brain before an older request returns. Only the newest accepted
  // turn may claim the single LiveAvatar speech pipe.
  shouldDeliverAssistantTurn?: (utteranceId: string) => boolean,
) => {
  const { sessionRef, reportActivity } = useLiveAvatarContext();

  const sendMessage = useCallback(
    async (
      message: string,
      imageAnalysis?: string | null,
      utteranceId: string | null = null,
    ) => {
      reportActivity();
      if (mode === "FULL") {
        // PROOF PROBE (Ara's Job-2 packet, 2026-08-21; installed by Claude with
        // one correction). Fires immediately before the ONE speech dispatch, so
        // grouping app_events by utteranceId counts how many times a single line
        // was actually emitted. That settles "does 6 say a line twice?" with data
        // instead of argument.
        //
        // CORRECTION vs the packet: it pinned eventId to
        // `${utteranceId}:voice-speech-emitted`. app_events.event_id is UNIQUE, so
        // a SECOND emission of the same utterance would collide and be dropped -
        // the probe would report exactly one row and we would "prove" one-emit-per-
        // line precisely when the bug was happening. Omitting eventId lets
        // logAppEvent mint a unique id per call (telemetry.ts:95), so every
        // emission gets its own row. utteranceId stays in the envelope for grouping.
        if (utteranceId) {
          logAppEvent(
            "voice_speech_emitted",
            {
              stage: "speech_emit",
              mode,
              path: "full-message",
              textNorm: String(message || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 96),
            },
            "low",
            {
              utteranceId,
              provider: "heygen",
              outcome: "emitted",
            },
          );
        }
        return sessionRef.current.message(message);
      } else if (mode === "CUSTOM") {
        const brainStartedAt = Date.now();
        if (utteranceId) {
          logAppEvent(
            "voice_brain_request_started",
            { stage: "brain_request", mode },
            "low",
            {
              eventId: `${utteranceId}:brain-request-started`,
              utteranceId,
              provider: "openai",
              outcome: "started",
            },
          );
        }
        const response = await fetch("/api/openai-chat-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            image_analysis: imageAnalysis || undefined,
            history: getHistory?.() ?? [],
            userName: getUserName?.() ?? null,
            signedInEmail: getSignedInEmail?.() ?? null,
            buildGateSatisfied: getBuildGateSatisfied?.() ?? false,
          }),
        });
        const { response: chatResponseText } = await response.json();
        if (
          utteranceId &&
          shouldDeliverAssistantTurn &&
          !shouldDeliverAssistantTurn(utteranceId)
        ) {
          // The user has already taken the floor again. Do not feed a stale
          // reply into HeyGen: it can ignore a burst of repeat commands and
          // leave the newest, relevant answer silent.
          return;
        }
        if (utteranceId) {
          logAppEvent(
            "voice_brain_response_ready",
            { stage: "brain_response", mode },
            "low",
            {
              eventId: `${utteranceId}:brain-response-ready`,
              utteranceId,
              provider: "openai",
              durationMs: Math.max(0, Date.now() - brainStartedAt),
              outcome: "ready",
            },
          );
        }
        if (typeof chatResponseText === "string" && chatResponseText) {
          onAssistantText?.(chatResponseText, { utteranceId });
          registerSixSpokenLine(chatResponseText); // echo firewall registry
        }
        // LIP-SYNC (G 2026-06-14): the CUSTOM mint is now a room-based session
        // with a voice but NO context_id, so repeat() (AVATAR_SPEAK_TEXT) makes
        // 6's MOUTH move with native TTS in his voice. Our brain produced the
        // text, so every CUSTOM-mode fix still holds (no interrupt, memory, no
        // double-greet). ElevenLabs + the WebAudio armor stay as the silent
        // fallback if repeat() ever no-ops.
        try {
          if (utteranceId) {
            logAppEvent(
              "voice_avatar_repeat_dispatched",
              { stage: "avatar_repeat", mode },
              "low",
              {
                eventId: `${utteranceId}:avatar-repeat-dispatched`,
                utteranceId,
                provider: "heygen",
                outcome: "dispatched",
              },
            );
          }
          // PROOF PROBE, CUSTOM path (see the note on the FULL branch above).
          // Deliberately separate from voice_avatar_repeat_dispatched, which is
          // keyed per utterance and would swallow a duplicate.
          if (utteranceId) {
            logAppEvent(
              "voice_speech_emitted",
              {
                stage: "speech_emit",
                mode,
                path: "custom-repeat",
                textNorm: String(chatResponseText || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 96),
              },
              "low",
              {
                utteranceId,
                provider: "heygen",
                outcome: "emitted",
              },
            );
          }
          // 2026-08-21: was a bare repeat() inside a try/catch, so 6 was only
          // rescued when the call THREW. The real-world failure is the call
          // being accepted and then silently ignored — the exact thing the
          // audio-push path has watched for since June. speakThroughAvatar adds
          // that same AVATAR_SPEAK_STARTED watchdog here, runs it detached so
          // this call is not slowed, and refuses to rescue a line the user has
          // since interrupted.
          // `repeat()` resolves only after the avatar finishes speaking on some
          // SDK transports. Returning that promise made the single turn chain
          // wait behind the *previous* complete reply: a normal follow-up could
          // be recognized and accepted, then sit silent until the greeting or
          // prior sentence ended. Dispatch is the turn boundary; completion is
          // deliberately owned by the avatar/watchdog. A later accepted user
          // turn already interrupts this speech before it reaches the brain.
          //
          // Do not `return`/`await` this call. That would adopt the SDK's
          // speech-completion promise and reintroduce the queue dam.
          speakThroughAvatar(
            sessionRef.current,
            chatResponseText,
            "textchat.reply",
            (reason) => {
              if (!utteranceId) return;
              logAppEvent(
                "voice_avatar_repeat_failed",
                { stage: "avatar_repeat", mode, reason },
                // HIGH, not medium: every one of these is 6 failing to speak in
                // front of a real person. It must be findable after the fact.
                "high",
                {
                  eventId: `${utteranceId}:avatar-repeat-failed`,
                  utteranceId,
                  provider: "heygen",
                  durationMs: Math.max(0, Date.now() - brainStartedAt),
                  outcome: "failed",
                },
              );
            },
            (presentation) => {
              if (!utteranceId) return;
              const outcome =
                presentation.stage === "media_presented"
                  ? "presented"
                  : presentation.stage === "intentionally_silent"
                    ? "suppressed"
                    : presentation.stage.includes("recovery")
                      ? "recovery"
                      : "observed";
              // Safe transport evidence only: booleans, counts, media state,
              // and sample RMS. No reply text, audio, token, or stream ID.
              logAppEvent(
                "voice_avatar_media_presentation",
                {
                  stage: presentation.stage,
                  reason: presentation.reason ?? null,
                  evidence: presentation.evidence ?? null,
                },
                presentation.stage.includes("recovery") ? "medium" : "low",
                {
                  eventId: `${utteranceId}:avatar-media:${presentation.stage}`,
                  utteranceId,
                  provider: "heygen",
                  durationMs: presentation.durationMs,
                  outcome,
                },
              );
            },
          );
          return;
        } catch (e) {
          console.error("[textchat] speak path failed outright:", e);
          if (utteranceId) {
            logAppEvent(
              "voice_avatar_repeat_failed",
              { stage: "avatar_repeat", mode, reason: "speak_path_threw" },
              "high",
              {
                eventId: `${utteranceId}:avatar-speak-path-threw`,
                utteranceId,
                provider: "heygen",
                durationMs: Math.max(0, Date.now() - brainStartedAt),
                outcome: "failed",
              },
            );
          }
        }
      }
    },
    [sessionRef, mode, reportActivity, onAssistantText, getHistory, getUserName, getSignedInEmail, getBuildGateSatisfied, shouldDeliverAssistantTurn],
  );

  return {
    sendMessage,
  };
};
