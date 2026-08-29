import { describe, expect, it, vi } from "vitest";
import {
  inspectMicrophonePermission,
  microphonePermissionMessage,
  requestMicrophonePermission,
} from "../../src/lib/voice/microphonePermission";

function browser(state: PermissionState, getUserMedia = vi.fn()) {
  return {
    mediaDevices: { getUserMedia },
    permissions: { query: vi.fn().mockResolvedValue({ state }) },
  };
}

describe("microphone permission recovery", () => {
  it("reports the observable fresh-start permission states without prompting", async () => {
    expect(await inspectMicrophonePermission(browser("prompt"))).toBe("prompt");
    expect(await inspectMicrophonePermission(browser("denied"))).toBe("denied");
    expect(await inspectMicrophonePermission({})).toBe("unavailable");
  });

  it("retries a prior prompt/dismissal once and stops the temporary stream before SDK start", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    const api = browser("prompt", getUserMedia);
    expect(await requestMicrophonePermission(api)).toBe("granted");
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("calls getUserMedia directly from the retry gesture instead of awaiting Permissions first", async () => {
    const order: string[] = [];
    const getUserMedia = vi.fn().mockImplementation(async () => {
      order.push("getUserMedia");
      return { getTracks: () => [{ stop: vi.fn() }] };
    });
    const query = vi.fn().mockImplementation(async () => {
      order.push("permissions.query");
      return { state: "prompt" };
    });

    expect(await requestMicrophonePermission({
      mediaDevices: { getUserMedia },
      permissions: { query },
    })).toBe("granted");
    expect(order).toEqual(["getUserMedia"]);
  });

  it("keeps a dismissed or non-gesture-rejected prompt retryable rather than calling it blocked", async () => {
    const dismissed = browser("prompt", vi.fn().mockRejectedValue(new Error("dismissed")));
    expect(await requestMicrophonePermission(dismissed)).toBe("dismissed");

    const blocked = browser("denied", vi.fn().mockRejectedValue(new Error("blocked")));
    expect(await requestMicrophonePermission(blocked)).toBe("denied");
    expect(blocked.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(microphonePermissionMessage("denied")).toContain("browser permissions");
  });

  it("stops the short preflight stream before an ordinary granted session starts", async () => {
    const stop = vi.fn();
    const granted = browser(
      "granted",
      vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }),
    );
    expect(await inspectMicrophonePermission(granted)).toBe("granted");
    expect(granted.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(await requestMicrophonePermission(granted)).toBe("granted");
    expect(granted.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
