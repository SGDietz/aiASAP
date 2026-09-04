import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const demo = fs.readFileSync(
  path.join(root, "src/components/LiveAvatarDemo.tsx"),
  "utf8",
);

const handler = demo.slice(
  demo.indexOf("const beginSessionFromStart"),
  demo.indexOf("const adoptEarlyStart"),
);
const fromStoppedBranch = handler.slice(
  handler.indexOf("if (fromStopped) {"),
  handler.indexOf("// Initial START keeps"),
);
// Search forward from each block's own opening line. These markers repeat
// earlier in the file, so a bare indexOf for the closing one walks backwards
// and silently yields an empty slice that passes every "not.toContain".
const loadingStart = demo.indexOf("if (!sessionToken && hasTappedToStart");
const idleStart = demo.indexOf("if (showsSharedIdle) {", loadingStart);
const idleEnd = demo.indexOf('if (mode === "VOICE") {', idleStart);
const loadingSurface = demo.slice(loadingStart, idleStart);
const idleSurface = demo.slice(idleStart, idleEnd);

/**
 * G, 2026-08-28, on how his Android phone got blocked without him ever choosing
 * Block: "when everything started, when I had to hit permission for my mic on my
 * phone, then I tap somewhere else on the screen, and the mic permission went
 * away. And then we've had problems ever since."
 *
 * Returned STOP keeps the defensive held surface. Initial START now uses the
 * already-approved post-START loader as its synchronous acknowledgement after
 * getUserMedia owns the gesture: the held-idle acknowledgement did not paint on
 * G's phone, so one real mint looked indistinguishable from a dead control.
 */
describe("the stage acknowledges microphone startup without losing gesture ownership", () => {
  it("enters the existing loading surface immediately after the gesture-owned request", () => {
    const request = handler.indexOf("requestMicrophonePermission(navigator)");
    const swap = handler.indexOf("setHasTappedToStart(true)");
    const answered = handler.lastIndexOf("await permissionRequest");
    expect(request).toBeGreaterThan(-1);
    expect(swap).toBeGreaterThan(-1);
    expect(answered).toBeGreaterThan(-1);
    // getUserMedia owns the tap first; the visual acknowledgement cannot wait
    // for Android's permission promise to settle.
    expect(swap).toBeGreaterThan(request);
    expect(swap).toBeLessThan(answered);
    expect(handler.split("setHasTappedToStart(true)").length - 1).toBe(1);
  });

  it("does not swap the returned-STOP surface before the answer", () => {
    // Chief's review, 2026-08-28: the returned-STOP path had the identical
    // defect through setPausedOnStage(false) and must be fixed symmetrically.
    const answered = fromStoppedBranch.indexOf("await permissionRequest");
    const unpause = fromStoppedBranch.indexOf("setPausedOnStage(false)");
    expect(unpause).toBeGreaterThan(-1);
    expect(answered).toBeGreaterThan(-1);
    expect(unpause).toBeGreaterThan(answered);
  });

  it("returns the initial scene on a dismissal or deny", () => {
    const initialBranch = handler.slice(
      handler.indexOf("// Initial START keeps"),
    );
    const bail = initialBranch.indexOf('if (permission !== "granted")');
    const reset = initialBranch.indexOf("setHasTappedToStart(false)", bail);
    expect(bail).toBeGreaterThan(-1);
    expect(reset).toBeGreaterThan(bail);
  });

  it("slices the two render surfaces it claims to be checking", () => {
    // Guard the guard. Both of the assertions below are "not.toContain" shaped
    // in spirit, and an empty string satisfies those for free.
    expect(loadingStart).toBeGreaterThan(-1);
    expect(idleStart).toBeGreaterThan(loadingStart);
    expect(idleEnd).toBeGreaterThan(idleStart);
    expect(loadingSurface.length).toBeGreaterThan(200);
    expect(idleSurface.length).toBeGreaterThan(200);
  });

  it("keeps the existing microphone guidance available on held idle surfaces", () => {
    expect(idleSurface).toContain('data-microphone-awaiting-answer="1"');
    expect(loadingSurface).not.toContain("data-microphone-awaiting-answer");
    expect(idleSurface).toContain("Answer the microphone question");
    expect(idleSurface).toContain("Do not tap");
  });

  it("keeps a tap from ever looking ignored", () => {
    // G, 2026-08-28: "I hit the start button, and nothing happens." A held
    // surface with no acknowledgement reads exactly like a dead button, so the
    // pending flag must be raised in the same gesture, before the request.
    const raised = handler.indexOf("setStartMicAwaitingAnswer(true)");
    const request = handler.indexOf("requestMicrophonePermission(navigator)");
    expect(raised).toBeGreaterThan(-1);
    expect(raised).toBeLessThan(request);
  });

  it("never lets the held surface start a second paid session", () => {
    // The bootstrap effect watches hasTappedToStart. Deferring the flip means it
    // now flips while the mint is already in flight, so the effect must still be
    // short-circuited by sessionBootstrapRef or the grant would mint twice.
    const bootstrapGuard = demo.indexOf("if (sessionBootstrapRef.current) {");
    const tapGate = demo.indexOf("if (!hasTappedToStart) {");
    expect(bootstrapGuard).toBeGreaterThan(-1);
    expect(tapGate).toBeGreaterThan(bootstrapGuard);
    // The ownership reservation is set before the loader flip and before either
    // post-grant mint call inside the handler.
    expect(handler.indexOf("sessionBootstrapRef.current = true")).toBeLessThan(
      handler.indexOf("setHasTappedToStart(true)"),
    );
    expect(handler.indexOf("sessionBootstrapRef.current = true")).toBeLessThan(
      handler.indexOf("startSession({"),
    );
    expect(handler.indexOf('if (permission !== "granted")')).toBeLessThan(
      handler.indexOf("startSession({"),
    );
  });
});
