import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  claimSessionGreeting,
  micPressAction,
  shouldAutoStartVoice,
  stopLiveAvatarSessionEverywhere,
  syncSpeakerMute,
} from "../../src/lib/voice/sessionControls";

describe("session voice controls", () => {
  const source = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
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

  it("starts server and local teardown together and carries pagehide keepalive", async () => {
    const order: string[] = [];
    let releaseServer!: () => void;
    const serverHeld = new Promise<void>((resolve) => {
      releaseServer = resolve;
    });
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      order.push(`server:${String(init?.keepalive)}:${String(init?.body)}`);
      await serverHeld;
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const session = {
      stop: async () => {
        order.push("local");
      },
    };

    const stopping = stopLiveAvatarSessionEverywhere(
      session,
      "session-token",
      fetchImpl,
      { keepalive: true, reason: "USER_CLOSED" },
    );
    await Promise.resolve();

    expect(order).toEqual([
      'server:true:{"reason":"USER_CLOSED"}',
      "local",
    ]);
    releaseServer();
    await stopping;
  });

  it("still releases the SDK when the server stop fails", async () => {
    let localStops = 0;
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as typeof fetch;

    await stopLiveAvatarSessionEverywhere(
      { stop: async () => { localStops += 1; } },
      "session-token",
      fetchImpl,
    );

    expect(localStops).toBe(1);
  });

  it("routes explicit, idle, hidden, and pagehide teardown through one owner", () => {
    const context = source("src/liveavatar/context.tsx");
    const sessionHook = source("src/liveavatar/useSession.ts");

    expect(sessionHook).toContain('stopCurrentSession({ reason: "USER_CLOSED" })');
    expect(context).toContain('stopCurrentSession({ reason: "INACTIVITY" })');
    expect(context).toContain('stopCurrentSession({ reason: "PAGE_HIDDEN" })');
    expect(context).toContain(
      'stopCurrentSession({ keepalive: true, reason: "USER_CLOSED" })',
    );
    expect(context).not.toContain("sessionRef.current?.stop?.()");
  });
});
