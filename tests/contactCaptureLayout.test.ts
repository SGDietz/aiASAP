import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");

describe("contact box and four-control state matrix", () => {
  it("anchors the compact box above the accepted phone and md control positions", () => {
    const box = source("src/components/ContactCaptureBox.tsx");
    const controls = source("src/components/StageControls.tsx");
    expect(controls).toContain("var(--stage-height)*0.225");
    expect(controls).toContain("md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)]");
    expect(box).toContain("var(--stage-height)*0.291+11.25rem");
    expect(box).toContain("md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203+12.75rem)]");
    expect(box).toContain('z-[61]');
    expect(controls).toContain('z-[60]');
  });

  it("reuses the contact HUD for an honest interactive send-link fallback", () => {
    const box = source("src/components/ContactCaptureBox.tsx");
    const avatar = source("src/components/LiveAvatarSession.tsx");
    expect(box).toContain('data-send-link-fallback="1"');
    expect(box).toContain('sendLink.status === "sending"');
    expect(box).toContain('sendLink.status === "sent"');
    expect(box).toContain('sendLink.status === "failed"');
    expect(box).toContain("pointer-events-auto");
    expect(avatar).toContain("resolveSendLinkFallbackStatus");
    expect(avatar).toContain("data?.emailSent === true");
  });

  it("never substitutes the contact box for StageControls in avatar or voice-only", () => {
    const avatar = source("src/components/LiveAvatarSession.tsx");
    const voice = source("src/components/VoiceOnlyStage.tsx");
    expect(avatar).toMatch(/<ContactCaptureBox[\s\S]*<StageControls/);
    expect(voice).toContain("<StageControls");
    expect(voice).toContain("<ContactCaptureBox");
  });

  it("uses inert controls during loading and active controls through stop, exit, return, and voice states", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    expect((demo.match(/<StageControls/g) ?? []).length).toBeGreaterThanOrEqual(3);
    const loadingStart = demo.indexOf("if (!sessionToken && hasTappedToStart");
    const loadingEnd = demo.indexOf("// THE FRONT DOOR", loadingStart);
    expect(demo.slice(loadingStart, loadingEnd)).toContain("<DormantStageControls />");
    expect(demo).toContain("{!isLoading && (");
    expect(demo).toContain("pausedOnStage");
    expect(demo).toContain('mode === "VOICE"');
    const controls = source("src/components/StageControls.tsx");
    for (const label of ["Stop", "Start", "Mute", "Quiet", "Gallery"]) {
      expect(controls).toContain(`"${label}"`);
    }
    expect(controls).not.toContain('"Voice"');
  });
});
