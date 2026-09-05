// The avatar can expose the same microphone through two final-transcript
// transports: the LiveAvatar SDK and the app's browser SpeechRecognition path.
// Product mode chooses the authority deterministically. Later finals from the
// competing transport are observational duplicates/conflicts and must never
// enter the turn queue or mutate account state.

export type AvatarSpeechSource = "app_browser" | "liveavatar_sdk";
export type AvatarSpeechMode = "FULL" | "CUSTOM";

export interface SpeechSourceDecision {
  accepted: boolean;
  authoritativeSource: AvatarSpeechSource;
  /**
   * True when this final came from the OTHER live transport. It is not the
   * authority and must never jump the queue, but it is real speech and
   * throwing it away is how G's answers went missing - see the note on
   * arbitrateAvatarSpeechSource.
   */
  backfillCandidate: boolean;
}

/**
 * Android/iOS announce Web Speech recognition start/stop with audible system
 * tones and may repeatedly end/restart a continuous recognizer. LiveAvatar
 * already supplies the same final transcription there, so keep one stable
 * microphone authority on mobile.
 */
export function shouldUseBrowserSpeechRecognition(
  mode: AvatarSpeechMode,
  userAgent: string,
): boolean {
  if (mode !== "CUSTOM") return false;
  return !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    userAgent,
  );
}

/**
 * CUSTOM uses the app-owned browser recognizer when available because that
 * transcript drives the app-owned brain and signup machine. FULL uses the SDK.
 * A CUSTOM browser-recognition failure deliberately falls back to the SDK.
 */
export function selectAvatarSpeechSource(
  mode: AvatarSpeechMode,
  browserSpeechAvailable: boolean,
): AvatarSpeechSource {
  return mode === "CUSTOM" && browserSpeechAvailable
    ? "app_browser"
    : "liveavatar_sdk";
}

/**
 * TWO EARS, ONE TURN (G, ride 48c99dfa, 2026-09-04).
 *
 * CUSTOM on a desktop browser elects `app_browser`, and every final from the
 * SDK used to be dropped on the floor. Measured over five of G's rides, the
 * browser recognizer turned only 14-39% of what he said into turns - it stops
 * and restarts, and it hears very little while 6 is talking. The provider's
 * transcript had the rest, including the two answers that mattered:
 * "yeah you may send that email off" and "Yes." Neither reached the flow, so
 * nothing was ever sent.
 *
 * The authority does not change - the app-owned recognizer still drives the
 * brain and the signup machine, and still wins any race. What changes is that
 * the losing transport is now returned as a BACKFILL CANDIDATE instead of
 * being discarded, so the caller can hold it briefly and deliver it only if
 * the authority never produced that utterance. Duplicate suppression is the
 * existing `resolveSemanticTurn` check against the accepted-turn ring; this
 * function deliberately does no matching of its own.
 */
export function arbitrateAvatarSpeechSource(
  authoritativeSource: AvatarSpeechSource | null,
  incomingSource: AvatarSpeechSource,
): SpeechSourceDecision {
  const authority = authoritativeSource ?? incomingSource;
  const accepted = authority === incomingSource;
  return {
    accepted,
    authoritativeSource: authority,
    backfillCandidate: !accepted,
  };
}
