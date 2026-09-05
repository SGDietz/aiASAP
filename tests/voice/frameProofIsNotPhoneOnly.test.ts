import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/LiveAvatarSession.tsx"),
  "utf-8",
);

/**
 * G's rides on 2026-09-04 both logged `greeting_before_frame: spoke_unseen`,
 * and neither logged `first_presented_frame` - yet he watched 6's mouth move.
 * The proof was not wrong about the frame; it never ran. It opened with
 * `if (!isPhoneLifecycleViewport || ...) return;` and G rides on desktop.
 *
 * Consequence: avatarFrameProvenRef was false for the entire session, so the
 * greeting guard waited its full 3s timeout every single time and every desktop
 * ride was missing its first-frame timing.
 *
 * The proof is viewport-independent. The LOADING SURFACE is the phone-only
 * part, and it gates itself at its own use site.
 */
describe("renderable-frame proof is not phone-only", () => {
  it("does not bail out of the proof on wide viewports", () => {
    const start = source.indexOf("const requestRenderableAvatarFrame = useCallback(");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("const attemptAvatarVideoPlayback", start));
    expect(body).not.toContain("!isPhoneLifecycleViewport");
    expect(body).toContain("if (avatarFrameProvenRef.current) return;");
  });

  it("still fails closed when the engine cannot prove a presented frame", () => {
    const start = source.indexOf("const requestRenderableAvatarFrame = useCallback(");
    const body = source.slice(start, source.indexOf("const attemptAvatarVideoPlayback", start));
    // no rVFC means no proof - never guess from decoded/playback counters
    expect(body).toContain('typeof video.requestVideoFrameCallback !== "function"');
    expect(body).toContain("metadata.presentedFrames > 0");
  });

  it("holds the loading surface on every device until a frame is proven, then settles once", () => {
    // Reversed 2026-09-05 by G, on his desktop: "Loading six comes in. That
    // stays until six has loaded and things flow smoothly." Ride 228a745a
    // showed desktop flipping loading/avatar twice on voiceIsLoading alone.
    expect(source).not.toContain("(isPhoneLifecycleViewport && !hasRenderableAvatarFrame)");
    expect(source).toContain("const startupSettledRef = useRef(false);");
    expect(source).toContain("frameProofReady &&");
    // Firefox has no requestVideoFrameCallback: the proof is waived after a
    // bounded wait so nobody is parked on a loading screen forever.
    expect(source).toContain("const FRAME_PROOF_WAIT_MS = 4000;");
    expect(source).toContain('reason: "frame_proof_waived"');
  });
});
