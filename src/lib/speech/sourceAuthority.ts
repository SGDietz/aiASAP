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

export function arbitrateAvatarSpeechSource(
  authoritativeSource: AvatarSpeechSource | null,
  incomingSource: AvatarSpeechSource,
): SpeechSourceDecision {
  const authority = authoritativeSource ?? incomingSource;
  return {
    accepted: authority === incomingSource,
    authoritativeSource: authority,
  };
}
