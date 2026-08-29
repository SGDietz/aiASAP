import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("session start failure surface", () => {
  it("surfaces a rejected SDK start immediately even if no DISCONNECTED event follows", () => {
    const session = fs.readFileSync(
      path.join(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );
    const catchBlock = session.slice(
      session.indexOf("startSession().catch((err: Error) =>"),
      session.indexOf("}, [startSession, sessionState, voicePresence])"),
    );

    expect(catchBlock).toContain("sessionStartErrorRef.current = message");
    expect(catchBlock).toContain("setSessionStartError(message)");
    expect(session).toContain("{sessionStartError && (");
  });

  it("exits badge-only loading when SDK startup has failed", () => {
    const session = fs.readFileSync(
      path.join(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );
    const loadingGate = session.slice(
      session.indexOf("const shouldShowLoadingSurface ="),
      session.indexOf("useEffect(() =>", session.indexOf("const shouldShowLoadingSurface =")),
    );

    expect(loadingGate).toContain("!sessionStartError &&");
    expect(session).toContain("{shouldShowLoadingSurface && (");
    expect(session).toContain("{sessionStartError && (");
  });

  it("keeps one final video mounted and requires an actually presented frame", () => {
    const session = fs.readFileSync(
      path.join(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );
    expect(session).not.toContain('data-six-loading-frame-probe="1"');
    expect(session).not.toContain("if (shouldShowLoadingSurface) {");
    expect(session).toContain("video.requestVideoFrameCallback");
    expect(session).toContain("metadata.presentedFrames > 0");
    expect(session).toContain("video.videoWidth >= 2");
    expect(session).toContain("video.videoHeight >= 2");
    expect(session).toContain("currentLayoutBox.width >= 2");
    expect(session).toContain("currentLayoutBox.height >= 2");
    expect(session).toContain("metadata.width >= 2");
    expect(session).toContain("metadata.height >= 2");
    expect(session).toContain('track.readyState === "live" && track.enabled');
    expect(session).toContain(
      "onPlaying={(event) => requestRenderableAvatarFrame(event.currentTarget)}",
    );
    expect(session).toContain(
      'console.warn("Avatar video play rejected; keeping loading badge:", error)',
    );
    const playRejectionStart = session.indexOf(
      'console.warn("Avatar video play rejected; keeping loading badge:", error)',
    );
    const playRejectionEnd = session.indexOf(
      "[requestRenderableAvatarFrame]",
      playRejectionStart,
    );
    expect(playRejectionStart).toBeGreaterThan(-1);
    expect(playRejectionEnd).toBeGreaterThan(playRejectionStart);
    const playRejection = session.slice(playRejectionStart, playRejectionEnd);
    expect(playRejection).not.toContain("setHasRenderableAvatarFrame(true)");
    expect(session).toContain("video.srcObject = null;");
    expect(session).not.toMatch(/startupWatchdog|STARTUP_WATCHDOG/);
  });
});
