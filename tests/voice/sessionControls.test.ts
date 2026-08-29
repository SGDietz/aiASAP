import { describe, expect, it } from "vitest";
import {
  claimSessionGreeting,
  micPressAction,
  shouldAutoStartVoice,
  syncSpeakerMute,
} from "../../src/lib/voice/sessionControls";

describe("session voice controls", () => {
  it("claims the anonymous greeting once until real session teardown resets it", () => {
    const claimed = { current: false };

    expect(claimSessionGreeting(claimed)).toBe(true);
    expect(claimSessionGreeting(claimed)).toBe(false);

    claimed.current = false;
    expect(claimSessionGreeting(claimed)).toBe(true);
  });

  it("keeps the speaker muted when a delayed audio-unlock pass runs", () => {
    const output = { muted: false, volume: 1 };

    syncSpeakerMute(output, true, true);
    expect(output).toEqual({ muted: true, volume: 0 });

    syncSpeakerMute(output, true, true);
    expect(output).toEqual({ muted: true, volume: 0 });
  });

  it("keeps pre-unlock playback silent and restores sound only when allowed", () => {
    const output = { muted: false, volume: 1 };

    syncSpeakerMute(output, false, false);
    expect(output).toEqual({ muted: true, volume: 0 });

    syncSpeakerMute(output, false, true);
    expect(output).toEqual({ muted: false, volume: 1 });
  });

  it("routes a press to mute while the greeting window is still awaiting completion", () => {
    expect(micPressAction(true, true, true)).toBe("toggle_mute");
  });

  it("keeps the cold-start press and re-entry guard unchanged", () => {
    expect(micPressAction(false, false, false)).toBe("start");
    expect(micPressAction(false, true, false)).toBe("wait");
    expect(micPressAction(false, false, true)).toBe("wait");
  });

  it("carries the one front-door tap through mic permission without a second tap", () => {
    const ready = {
      requested: true,
      attempted: false,
      connected: true,
      streamReady: true,
      accountAuthChecked: true,
      hasUserPressedVoiceStart: false,
      voiceIsActive: false,
      voiceStartAwaitingReady: false,
      voiceIsLoading: false,
    };

    expect(shouldAutoStartVoice(ready)).toBe(true);
    expect(shouldAutoStartVoice({ ...ready, attempted: true })).toBe(false);
    expect(
      shouldAutoStartVoice({ ...ready, hasUserPressedVoiceStart: true }),
    ).toBe(false);
    expect(shouldAutoStartVoice({ ...ready, streamReady: false })).toBe(false);
  });
});
