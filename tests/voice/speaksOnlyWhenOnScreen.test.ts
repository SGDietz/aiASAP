import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const session = readFileSync(
  join(process.cwd(), "src/components/LiveAvatarSession.tsx"),
  "utf8",
);

/**
 * G, 2026-09-04: "the avatar should only be speaking with the avatar is on
 * screen."
 *
 * Nothing enforced it. It worked on a 90 ms margin - his ride painted the first
 * real frame at 9,378 ms and dispatched the greeting at 9,467 ms. On a slower
 * phone or a worse network that order flips and 6 talks to an empty screen.
 *
 * avatarFrameProvenRef was already being set on a genuinely painted frame
 * (readyState, non-zero video dimensions, a laid-out box, presentedFrames > 0)
 * but only a phone-lifecycle check read it.
 */
describe("6 does not speak before he is on screen", () => {
  const greetingBlock = session.slice(
    session.indexOf("if (greeting) {"),
    session.indexOf('markStartupTiming("greeting_dispatch")'),
  );

  it("gates the opener on a proven painted frame", () => {
    expect(greetingBlock).toContain("avatarFrameProvenRef.current");
    expect(greetingBlock).toContain('voicePresenceRef.current === "avatar"');
  });

  it("only waits in avatar mode - voice-only has no face to wait for", () => {
    // Without the presence check a voice-only start would burn the whole
    // budget every time, because no frame is ever painted there.
    const guard = greetingBlock.slice(greetingBlock.indexOf("voicePresenceRef"));
    expect(guard.indexOf("avatarFrameProvenRef")).toBeGreaterThan(-1);
  });

  it("is bounded - silence is worse than an unseen voice", () => {
    expect(session).toContain("const AVATAR_ON_SCREEN_WAIT_MS = 3000;");
    expect(greetingBlock).toContain("frameDeadline");
    expect(greetingBlock).toContain("Date.now() < frameDeadline");
  });

  it("says so out loud when it gives up rather than hiding it", () => {
    expect(greetingBlock).toContain('"greeting_before_frame"');
    expect(greetingBlock).toContain('outcome: "spoke_unseen"');
  });

  it("can only delay the opener, never advance it", () => {
    // The wait sits BEFORE the dispatch mark, so the mark can only move later.
    expect(session.indexOf("frameDeadline")).toBeLessThan(
      session.indexOf('markStartupTiming("greeting_dispatch")'),
    );
  });
});
