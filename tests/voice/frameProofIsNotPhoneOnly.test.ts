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

  it("keeps the opaque loading surface phone-only", () => {
    // Desktop look must not change: only phones raise the surface on no-frame.
    expect(source).toContain("(isPhoneLifecycleViewport && !hasRenderableAvatarFrame)");
  });
});
