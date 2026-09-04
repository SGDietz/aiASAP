import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");
const session = fs.readFileSync(
  path.join(repoRoot, "src/components/LiveAvatarSession.tsx"),
  "utf8",
);
const demo = fs.readFileSync(
  path.join(repoRoot, "src/components/LiveAvatarDemo.tsx"),
  "utf8",
);

describe("CUSTOM microphone permission lifecycle", () => {
  it("turns a fresh-start prompt into a recoverable muted state, not a fake active mic", () => {
    const start = session.slice(
      session.indexOf("const handleVoiceStartStop"),
      session.indexOf("// The first-stage tap already expressed"),
    );
    expect(start).toContain("inspectMicrophonePermission(navigator)");
    expect(start).toContain("permissionApiAvailable");
    expect(start).toContain("setMicrophonePermissionNotice(notice);");
    expect(start).toContain("stop();");
  });

  it("makes an inactive-mic press a real recovery request and renders actionable feedback", () => {
    expect(session).toContain("handleVoiceStartStop({ retryMicrophone: true })");
    expect(session).toContain("requestMicrophonePermission(navigator)");
    expect(session).toContain("microphonePermissionNotice ?? microphoneWarning");
    expect(session).toContain("<MicrophoneRecoveryCard");
    expect(session).toContain('microphonePermissionState === "denied"');
  });

  it("uses the mobile recovery card instead of stacking the legacy warning when blocked", () => {
    expect(session).toContain("const shouldShowBlockedMicrophoneRecovery");
    expect(session).toContain('shouldShowBlockedMicrophoneRecovery ? "hidden md:block" : ""');
    expect(session).toContain("{shouldShowBlockedMicrophoneRecovery && (");
  });

  it("waits for the live-stage mic gesture instead of starting capture after async provider setup", () => {
    expect(demo).not.toContain("autoStartVoice");
    expect(session).not.toContain("carriedTap");
    expect(session).toContain("handleVoiceStartStop({ retryMicrophone: true })");
  });
});
