import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { requestMicrophonePermission } from "../../src/lib/voice/microphonePermission";

const root = path.resolve(__dirname, "../..");
const session = fs.readFileSync(
  path.join(root, "src/components/LiveAvatarSession.tsx"),
  "utf8",
);
const demo = fs.readFileSync(
  path.join(root, "src/components/LiveAvatarDemo.tsx"),
  "utf8",
);

function browser(state: PermissionState, getUserMedia: ReturnType<typeof vi.fn>) {
  return {
    mediaDevices: { getUserMedia },
    permissions: { query: vi.fn().mockResolvedValue({ state }) },
  };
}

describe("Android microphone gesture ownership", () => {
  it("makes START own the gesture and mint only after microphone grant", () => {
    const start = demo.slice(
      demo.indexOf("const beginSessionFromStart"),
      demo.indexOf("const stopPendingStartForLegal", demo.indexOf("const beginSessionFromStart")),
    );
    expect(start.indexOf("requestMicrophonePermission(navigator)")).toBeGreaterThan(-1);
    expect(start.indexOf("window.isSecureContext")).toBeGreaterThan(-1);
    expect(start).toContain("const permissionRequest = requestMicrophonePermission(navigator);");
    expect(start.match(/startSession\(\{/g)).toHaveLength(2);
    expect(start.indexOf("requestMicrophonePermission(navigator)")).toBeLessThan(
      start.indexOf("startSession({"),
    );
    expect(start.indexOf('if (permission !== "granted")')).toBeLessThan(
      start.indexOf("startSession({"),
    );
    expect(start).toContain("if (sessionToken) setSessionToken(sessionToken);");
    expect(session).not.toContain("Tap/Click ANYWHERE");
    expect(session).not.toContain("To Talk To 6");
    expect(demo).toContain("microphonePreflightGranted={startMicGranted}");
  });

  it("does not let CONNECTED arm CUSTOM barge-in capture before the explicit start succeeds", () => {
    const barge = session.slice(
      session.indexOf("// CATASTROPHIC BARGE-IN FIX"),
      session.indexOf("const startListening", session.indexOf("// CATASTROPHIC BARGE-IN FIX")),
    );
    expect(barge.indexOf("if (!hasExplicitMicStartGrant) return;")).toBeGreaterThan(-1);
    expect(barge.indexOf("if (!hasExplicitMicStartGrant) return;")).toBeLessThan(
      barge.indexOf("navigator.mediaDevices.getUserMedia"),
    );
  });

  it("keeps START -> CONNECTED capture-free, then allows dismiss -> STOP -> fresh START -> grant", async () => {
    const handler = session.slice(
      session.indexOf("const handleVoiceStartStop"),
      session.indexOf("// r22: keyed", session.indexOf("const handleVoiceStartStop")),
    );
    expect(handler.indexOf("requestMicrophonePermission(navigator)")).toBeGreaterThan(-1);
    expect(handler.indexOf("requestMicrophonePermission(navigator)")).toBeLessThan(
      handler.indexOf("primeCustomVoiceFallback();"),
    );

    const dismissed = browser("prompt", vi.fn().mockRejectedValue(new Error("dismissed")));
    expect(await requestMicrophonePermission(dismissed as any)).toBe("dismissed");
    expect(dismissed.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

    const stop = vi.fn();
    const freshStart = browser(
      "prompt",
      vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }),
    );
    expect(await requestMicrophonePermission(freshStart as any)).toBe("granted");
    expect(freshStart.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("renders the blocked recovery only for a gesture-owned observable deny", async () => {
    const denied = browser("denied", vi.fn().mockRejectedValue(new Error("denied")));
    expect(await requestMicrophonePermission(denied as any)).toBe("denied");
    expect(denied.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(session).toContain('microphonePermissionState === "denied"');
    expect(session).toContain('rendered_as: "retryable"');
  });

  it("does not leave blocked prose on a clean or returned START screen", () => {
    expect(demo).toContain("setStartMicPermissionState(null);");
    expect(demo).not.toContain("startMicNotice");
    expect(demo).toContain("Only the immediately preceding gesture-owned deny");

    // The card renders for EVERY blocked outcome, not only a site-level deny.
    // "dismissed" and "unavailable" used to collapse to null and paint nothing,
    // which is what left Android tapping a dead START button (G, 2026-08-28).
    // On Android a browser-app-level block reports as "dismissed", so gating on
    // "denied" alone hid the most common failure on that platform.
    expect(demo).toContain("startMicPermissionState !== null");

    // The no-stale-prose guarantee never came from the render gate. It comes
    // from clearing the state on the same gesture, immediately BEFORE the fresh
    // request, so only the attempt just made can ever be on screen. Assert that
    // ordering directly instead of pinning the render expression.
    const start = demo.slice(
      demo.indexOf("const beginSessionFromStart"),
      demo.indexOf("const stopPendingStartForLegal"),
    );
    expect(start).toContain("setStartMicPermissionState(null);");
    expect(start.indexOf("setStartMicPermissionState(null);")).toBeLessThan(
      start.indexOf("const permissionRequest = requestMicrophonePermission(navigator);"),
    );
  });

  it("owns cancellation during the prompt and performs no denial-side mint", () => {
    const start = demo.slice(
      demo.indexOf("const beginSessionFromStart"),
      demo.indexOf("const stopPendingStartForLegal", demo.indexOf("const beginSessionFromStart")),
    );
    expect(start).toContain("const attemptController = new AbortController();");
    expect(start).toContain("startAbortRef.current = attemptController;");
    expect(start).toContain("attemptController.abort();");
    const branches = start.split('if (permission !== "granted")').slice(1);
    expect(branches).toHaveLength(2);
    for (const branch of branches) {
      const denial = branch.slice(0, branch.indexOf("return;") + "return;".length);
      expect(denial).not.toContain("startSession(");
    }
    expect(start.indexOf("const permission = await permissionRequest;")).toBeLessThan(
      start.indexOf("if (sessionToken) setSessionToken(sessionToken);"),
    );
    expect(demo).toContain("startAbortRef.current?.abort();");
    expect(demo.indexOf("startAbortRef.current?.abort();")).toBeLessThan(
      demo.indexOf('window.addEventListener("pagehide", onPageHide)'),
    );
  });
});
