export type MutableAudioOutput = {
  muted: boolean;
  volume: number;
};

export type LiveAvatarStopTarget = {
  stop: () => unknown | Promise<unknown>;
};

export type LiveAvatarStopOptions = {
  keepalive?: boolean;
  reason?: "USER_CLOSED" | "INACTIVITY" | "PAGE_HIDDEN";
};

/**
 * Stop both halves of a LiveAvatar session. The server request is the billing
 * teardown; the SDK stop releases local media/listeners. Start them together
 * so pagehide cannot strand one behind an await on the other.
 */
export async function stopLiveAvatarSessionEverywhere(
  session: LiveAvatarStopTarget,
  sessionAccessToken: string,
  fetchImpl: typeof fetch,
  options: LiveAvatarStopOptions = {},
): Promise<void> {
  const reason = options.reason ?? "USER_CLOSED";
  const serverStop = sessionAccessToken
    ? fetchImpl("/api/v1/sessions/stop", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
        keepalive: options.keepalive === true,
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`LiveAvatar server stop returned ${response.status}`);
        }
      })
    : Promise.resolve(null);
  const localStop = Promise.resolve().then(() => session.stop());

  const [serverResult, localResult] = await Promise.allSettled([
    serverStop,
    localStop,
  ]);
  if (serverResult.status === "rejected") {
    console.warn("LiveAvatar server stop failed:", serverResult.reason);
  }
  if (localResult.status === "rejected") {
    throw localResult.reason;
  }
}

/**
 * Apply the user's speaker preference without letting an autoplay/unlock pass
 * turn sound back on behind their back.
 */
export function syncSpeakerMute(
  output: MutableAudioOutput | null,
  userMuted: boolean,
  audioUnlocked: boolean,
): void {
  if (!output) return;
  const silent = userMuted || !audioUnlocked;
  output.muted = silent;
  output.volume = silent ? 0 : 1;
}

/** Atomically claim a one-shot greeting for the current provider session. */
export function claimSessionGreeting(claimed: { current: boolean }): boolean {
  if (claimed.current) return false;
  claimed.current = true;
  return true;
}

export type MicPressAction = "toggle_mute" | "wait" | "start";

/**
 * Decide what the stage mic button means without swallowing a mute press while
 * the opening greeting is still finishing. Once the voice loop is active,
 * mute owns the press; the loading guard only protects a genuine cold start.
 */
export function micPressAction(
  voiceIsActive: boolean,
  voiceStartAwaitingReady: boolean,
  voiceIsLoading: boolean,
): MicPressAction {
  if (voiceIsActive) return "toggle_mute";
  if (voiceStartAwaitingReady || voiceIsLoading) return "wait";
  return "start";
}

export type AutoStartVoiceState = {
  requested: boolean;
  attempted: boolean;
  connected: boolean;
  streamReady: boolean;
  accountAuthChecked: boolean;
  hasUserPressedVoiceStart: boolean;
  voiceIsActive: boolean;
  voiceStartAwaitingReady: boolean;
  voiceIsLoading: boolean;
};

/**
 * Carry the front-door tap through session minting and provider connection.
 * The user has already made the one explicit gesture; once the live stage is
 * actually ready, that same intent starts the microphone exactly once.
 */
export function shouldAutoStartVoice(state: AutoStartVoiceState): boolean {
  return (
    state.requested &&
    !state.attempted &&
    state.connected &&
    state.streamReady &&
    state.accountAuthChecked &&
    !state.hasUserPressedVoiceStart &&
    !state.voiceIsActive &&
    !state.voiceStartAwaitingReady &&
    !state.voiceIsLoading
  );
}
