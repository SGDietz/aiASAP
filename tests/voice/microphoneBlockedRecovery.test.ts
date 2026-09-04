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

// G, 2026-08-31. Telemetry separated two paths that must stay distinct: a true
// origin-level deny on the burned address cannot prompt again, while a
// dismissed/prompt outcome must issue a current gesture-owned request.
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

  it("keeps true site-denied recovery query-only until Chrome reports it promptable", () => {
    expect(demo).toContain("const recheckBlockedMicrophone");
    const recheck = demo.slice(
      demo.indexOf("const recheckBlockedMicrophone"),
      demo.indexOf("const stopPendingStartForLegal"),
    );
    expect(recheck).toContain("inspectMicrophonePermission(navigator)");
    expect(recheck).not.toContain("requestMicrophonePermission");
    expect(recheck).not.toContain("startSession(");
    expect(demo).toContain('startMicPermissionState === "denied"');
    expect(demo).toContain("void recheckBlockedMicrophone()");
  });

  it("keeps dismissed/prompt recovery on the real current-request START path", () => {
    expect(demo).toContain(
      ': () => void beginSessionFromStart(showsReturnedIdle)',
    );
    const begin = demo.slice(
      demo.indexOf("const beginSessionFromStart"),
      demo.indexOf("const adoptEarlyStart"),
    );
    expect(begin).toContain("requestMicrophonePermission(navigator)");
    expect(begin.indexOf('if (permission !== "granted")')).toBeLessThan(
      begin.indexOf("startSession({"),
    );
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

  it("gives the true denied origin one precise site-control action", () => {
    expect(card).toContain("Microphone is blocked for this site");
    expect(card).toContain("Open this page's Site controls");
    expect(card).toContain("Chrome will not show another microphone question");
    expect(card).not.toContain("I TURNED IT ON");
    expect(card).not.toContain("phone Settings");
  });
});
