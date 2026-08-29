import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { requestMicrophonePermission } from "../../src/lib/voice/microphonePermission";

const root = path.resolve(__dirname, "../..");
const demo = fs.readFileSync(
  path.join(root, "src/components/LiveAvatarDemo.tsx"),
  "utf8",
);
const card = fs.readFileSync(
  path.join(root, "src/components/MicrophoneRecoveryCard.tsx"),
  "utf8",
);

function rejectingWith(name: string, permissionState: PermissionState = "prompt") {
  const err = Object.assign(new Error(name), { name });
  return {
    mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(err) },
    permissions: { query: vi.fn().mockResolvedValue({ state: permissionState }) },
  };
}

// G, 2026-08-28. He was blocked on Android, tapped CHECK MIC AGAIN, and nothing
// happened - because a browser never re-prompts for a blocked site, so the retry
// could not work. Worse, every tap ran the full START path and minted a paid
// session. These lock both halves of that fix.
describe("blocked microphone recovery", () => {
  it("does not blame the user for a missing or busy microphone", async () => {
    // A device failure is not a permission answer. Routing these through the
    // Permissions query used to label them denied/dismissed, which then told the
    // visitor to go change a browser setting that was never the problem.
    for (const name of [
      "NotFoundError",
      "OverconstrainedError",
      "NotReadableError",
      "AbortError",
    ]) {
      const api = rejectingWith(name, "denied");
      expect(await requestMicrophonePermission(api as never)).toBe("unavailable");
      // It must not even consult Permissions for these - the device is the story.
      expect(api.permissions.query).not.toHaveBeenCalled();
    }
  });

  it("still treats a real permission rejection as a permission outcome", async () => {
    expect(
      await requestMicrophonePermission(rejectingWith("NotAllowedError", "denied") as never),
    ).toBe("denied");
    expect(
      await requestMicrophonePermission(rejectingWith("NotAllowedError", "prompt") as never),
    ).toBe("dismissed");
    // An unrecognised error keeps the established query-based behaviour.
    expect(
      await requestMicrophonePermission(rejectingWith("Error", "denied") as never),
    ).toBe("denied");
  });

  it("recovers a blocked site by re-READING permission, never by re-requesting or minting", () => {
    expect(demo).toContain("const recheckBlockedMicrophone");
    // The whole point: the blocked button must not run the START path.
    const recheck = demo.slice(
      demo.indexOf("const recheckBlockedMicrophone"),
      demo.indexOf("const stopPendingStartForLegal"),
    );
    expect(recheck).toContain("inspectMicrophonePermission(navigator)");
    expect(recheck).not.toContain("requestMicrophonePermission");
    expect(recheck).not.toContain("startSession(");
    // And it is wired to the blocked state specifically.
    expect(demo).toContain('startMicPermissionState === "denied"');
    expect(demo).toContain("void recheckBlockedMicrophone()");
  });

  it("guards the microphone sheet against a double tap with a ref, not state", () => {
    // Two taps land in the same tick. A state flag reads false for both, so each
    // would fire its own getUserMedia and its own mint - paying twice for one
    // gesture. Only a ref updates synchronously. (Chief's review, 2026-08-28.)
    expect(demo).toContain("micPromptPendingRef");
    expect(demo).toContain("if (micPromptPendingRef.current) return;");
    const begin = demo.slice(
      demo.indexOf("const beginSessionFromStart"),
      demo.indexOf("const adoptEarlyStart"),
    );
    expect(begin.indexOf("micPromptPendingRef.current = true;")).toBeLessThan(
      begin.indexOf("requestMicrophonePermission(navigator)"),
    );
    // Released on both entry paths once the sheet is answered.
    expect(begin.match(/micPromptPendingRef\.current = false;/g)).toHaveLength(2);
  });

  it("warns not to tap the page while the browser sheet is open", () => {
    // The dismissal is what trained the block in the first place.
    expect(demo).toContain("startMicAwaitingAnswer");
    expect(demo).toContain("Answer the microphone question");
    expect(demo).toContain("Do not tap");
  });

  it("gives blocked-site steps that do not assume a particular browser chrome", () => {
    // G hit this inside a Custom Tab, which has no lock icon beside the address.
    expect(card).toContain("open it in your full browser app first");
    expect(card).not.toContain("just left of the web address");
    // It must not promise a retry that a blocked browser will refuse.
    expect(card).not.toContain(
      "Tapping again will not fix this. Your browser will not ask a second time",
    );
    // And it must not accuse the visitor of doing it.
    expect(card).toContain("You probably did not do this");
  });
});
