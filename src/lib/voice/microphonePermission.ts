export type MicrophonePermissionState =
  | "granted"
  | "prompt"
  | "denied"
  | "dismissed"
  | "unavailable";

type MicrophoneStream = { getTracks: () => Array<{ stop: () => void }> };

export type MicrophoneNavigator = {
  mediaDevices?: {
    getUserMedia: (constraints: MediaStreamConstraints) => Promise<MicrophoneStream>;
  };
  permissions?: {
    query: (descriptor: PermissionDescriptor) => Promise<{ state: PermissionState }>;
  };
};

/** Read the browser's observable mic state without prompting. */
export async function inspectMicrophonePermission(
  browser: MicrophoneNavigator,
): Promise<MicrophonePermissionState> {
  if (!browser.mediaDevices?.getUserMedia) return "unavailable";
  if (!browser.permissions?.query) return "prompt";
  try {
    const status = await browser.permissions.query({ name: "microphone" } as PermissionDescriptor);
    return status.state === "granted" || status.state === "denied"
      ? status.state
      : "prompt";
  } catch {
    // Permissions is optional/inconsistent across mobile browsers. getUserMedia
    // remains the authoritative request path when it is present.
    return "prompt";
  }
}

/**
 * Make one user-gesture recovery attempt. A successful preflight stream is
 * stopped immediately, before the SDK publishes its own track, so it cannot
 * leave duplicate capture running.
 */
export async function requestMicrophonePermission(
  browser: MicrophoneNavigator,
): Promise<MicrophonePermissionState> {
  if (!browser.mediaDevices?.getUserMedia) return "unavailable";

  // This must be the first async browser call made from the explicit mic tap.
  // On Android, awaiting Permissions.query() first can consume the transient
  // user activation, leaving getUserMedia to reject without presenting its
  // legitimate prompt. Permissions is diagnostic only after a request.
  try {
    const stream = await browser.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return "granted";
  } catch (error) {
    // Not every getUserMedia rejection is a permission answer. A missing or
    // busy microphone rejects too, and routing those through the Permissions
    // query below mislabels them as "denied"/"dismissed" — which then tells the
    // visitor to go fix a browser setting that was never the problem. Name the
    // device failures explicitly; anything unrecognised keeps the established
    // query-based behaviour. (Chief's review, 2026-08-28.)
    const name = (error as { name?: string } | null)?.name ?? "";
    if (
      name === "NotFoundError" ||          // no capture device at all
      name === "OverconstrainedError" ||   // no device satisfies the constraints
      name === "NotReadableError" ||       // hardware/OS held it, often another app
      name === "AbortError"                // device present but could not start
    ) {
      return "unavailable";
    }
    const after = await inspectMicrophonePermission(browser);
    // Chrome leaves Permissions at "prompt" when its sheet was dismissed.
    // It can also be prompt after a non-gesture rejection, so never promote a
    // prompt observation to "denied". A later explicit tap remains retryable.
    return after === "prompt" ? "dismissed" : after;
  }
}

export function microphonePermissionMessage(
  state: MicrophonePermissionState,
): string | null {
  switch (state) {
    case "prompt":
      return "Microphone permission is needed. Tap the mic button to try again.";
    case "denied":
      return "Microphone access is blocked for this site. Enable Microphone in this site's browser permissions, then tap the mic button.";
    case "dismissed":
      return "Microphone permission was not granted. Tap the mic button to try again.";
    case "unavailable":
      return "A microphone is not available in this browser or on this device.";
    default:
      return null;
  }
}
