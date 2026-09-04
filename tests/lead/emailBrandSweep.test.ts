import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SIX_PHOTO_URL } from "../../src/lib/emailTheme";

// ---------------------------------------------------------------------------
// EVERY aiASAP EMAIL, NOT JUST THE SHARED ONE.
//
// G, 2026-09-04: "i dont think we need the full avatar look in the emails, but
// all emails should have the top of 6, his face at least. and it is no longer
// take the leap, change that too."
//
// The email design is hand-copied into SIX places that never went through
// emailTheme - the magic link (layout-locked), the reminders cron, reminder
// cancel, account deletion, data download, and device check. Changing the
// shared theme fixed none of them. This test is the sweep: no aiASAP source
// file may carry the retired tagline or the full-body portrait, wherever the
// markup happens to live.
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const RETIRED_TAGLINE = "Take the Leap";
const FULL_BODY_ASSET = "startscreen_trim.png";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = [...sourceFiles(join(ROOT, "src")), ...sourceFiles(join(ROOT, "app"))];

describe("every aiASAP email carries the current brand", () => {
  it("finds the source tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no file still says the retired tagline", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes(RETIRED_TAGLINE));
    expect(offenders.map((f) => f.replace(ROOT, ""))).toEqual([]);
  });

  it("no email still points at the full-body portrait", () => {
    const offenders = files.filter((f) => {
      const text = readFileSync(f, "utf8");
      if (!text.includes(FULL_BODY_ASSET)) return false;
      // emailTheme's own comment explains that the old object is left in place
      // on purpose; a comment is not a rendered image.
      return text
        .split("\n")
        .some((line) => line.includes(FULL_BODY_ASSET) && !line.trim().startsWith("*") && !line.trim().startsWith("//"));
    });
    expect(offenders.map((f) => f.replace(ROOT, ""))).toEqual([]);
  });

  it("every hand-rolled email header uses the same face asset as the shared theme", () => {
    const face = SIX_PHOTO_URL.split("/").pop();
    expect(face).toBe("six_face.png");
    const withPortrait = files.filter((f) => readFileSync(f, "utf8").includes("email-assets/"));
    expect(withPortrait.length).toBeGreaterThan(3);
    for (const f of withPortrait) {
      const text = readFileSync(f, "utf8");
      const rendered = text
        .split("\n")
        .filter((l) => l.includes("email-assets/") && !l.trim().startsWith("*") && !l.trim().startsWith("//"));
      for (const line of rendered) {
        expect(line, f.replace(ROOT, "")).toContain(String(face));
      }
    }
  });
});
