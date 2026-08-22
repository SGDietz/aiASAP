import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE SCHEDULED SCRIPTS MUST NOT DRIFT FROM THEIR VERSIONED COPIES.
 *
 * aiASAP's Windows scheduled tasks run from a folder outside this repo that is
 * not under version control and is not in the nightly GitHub backup. Copies now
 * live in ops/scheduled/ so the automation has history and can be recovered.
 *
 * A second copy that silently diverges is WORSE than no copy: it looks like a
 * backup while being a lie, and somebody restoring from it would quietly
 * install an older watchdog. This test is what makes the copy trustworthy.
 *
 * It SKIPS when the live folder is not present, so the suite still passes on a
 * different machine or in CI. That is deliberate: the test guards drift on the
 * box that actually runs the tasks, and must not fail anywhere else.
 */

const LIVE_DIR = "C:\\Users\\sgdie\\Documents\\Claude\\Scheduled";
const REPO_DIR = resolve(__dirname, "../../ops/scheduled");

/** Line endings are not drift - git normalizes them on checkout. */
const norm = (s: string) => s.replace(/\r\n/g, "\n").trimEnd();

const scripts = readdirSync(REPO_DIR).filter(
  (f) => f.endsWith(".ps1") || f.endsWith(".vbs"),
);

describe("ops/scheduled copies match what actually runs", () => {
  it("has copies to check in the first place", () => {
    // Guards the guard: an empty folder would make every test below vacuously
    // pass, and the drift check would be dead without anyone noticing.
    expect(scripts.length).toBeGreaterThan(0);
  });

  const liveExists = existsSync(LIVE_DIR);

  for (const name of scripts) {
    it.skipIf(!liveExists)(`${name} is identical to the live copy`, () => {
      const livePath = join(LIVE_DIR, name);

      // A copy in the repo with no live counterpart means the task was
      // renamed or removed and this file is now a fossil - worth failing on,
      // because a fossil is exactly what somebody would restore by mistake.
      expect(
        existsSync(livePath),
        `${name} exists in ops/scheduled but NOT at ${LIVE_DIR}. ` +
          `Either it was renamed live (update the copy) or it is dead (delete it).`,
      ).toBe(true);

      const live = norm(readFileSync(livePath, "utf8"));
      const repo = norm(readFileSync(join(REPO_DIR, name), "utf8"));
      expect(
        repo,
        `${name} has DRIFTED. The live script and the versioned copy differ. ` +
          `Change one, change both - see ops/scheduled/README.md.`,
      ).toBe(live);
    });
  }

  it.skipIf(!liveExists)(
    "the hidden-window wrapper still points at a script that exists",
    () => {
      // The .vbs hard-codes the PowerShell path. If the .ps1 is ever moved or
      // renamed, the wrapper keeps exiting 0 while running nothing - the task
      // reports success forever and the watchdog is silently dead. That is the
      // worst failure mode in this whole arrangement, so it gets its own test.
      const vbsPath = join(REPO_DIR, "aiasap_failure_watch_hidden.vbs");
      if (!existsSync(vbsPath)) return;
      const vbs = readFileSync(vbsPath, "utf8");
      const m = vbs.match(/"([A-Z]:\\\\?[^"]*\.ps1)"/i);
      expect(m, "could not find a .ps1 path inside the wrapper").not.toBeNull();
      const target = m![1].replace(/\\\\/g, "\\");
      expect(
        existsSync(target),
        `the wrapper points at ${target}, which does not exist. ` +
          `The watcher would exit 0 while running nothing.`,
      ).toBe(true);
    },
  );
});
