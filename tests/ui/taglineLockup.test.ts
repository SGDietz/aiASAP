import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("shared aiASAP stage tagline", () => {
  it("restores the exact selected tagline through every stage owner", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const lockup = source("src/components/StageBrandLockup.tsx");
    const loadingCopy = source("src/components/TaglineText.tsx");
    const css = source("app/globals.css");

    expect(demo).toContain("if (showsSharedIdle)");
    expect(demo).toContain('if (mode === "VOICE")');
    expect(demo.match(/<StageBrandLockup \/>/g)).toHaveLength(4);
    expect(session).toContain("<StageBrandLockup>");
    expect(demo).not.toContain("TaglineText");
    expect(lockup).toContain('import { TaglineText } from "./TaglineText"');
    expect(lockup).toContain("<TaglineText />");
    expect(lockup).toContain("aiasap-tablet-idle-tagline");
    expect(lockup).toContain('data-stage-tagline="1"');
    expect(lockup).toContain("whitespace-nowrap opacity-100");
    // G, 2026-09-04 20:50, typed word for word, FOURTH revision and the current
    // one: "Beautiful Brilliant Cheap Autopilot" - four words, no operators.
    // (TaglineText.tsx carries the history of the three before it.)
    expect(loadingCopy).toContain("Beautiful Brilliant Cheap Autopilot");
    expect(loadingCopy.match(/Beautiful Brilliant Cheap Autopilot/g)).toHaveLength(1);
    expect(loadingCopy).toContain('data-stage-tagline-ink="1"');
    // A second 10% squeeze on G's word, 2026-09-04: 0.9 -> 0.81, horizontal
    // only. The type size is deliberately unchanged.
    expect(loadingCopy).toContain("origin-center scale-x-[0.9]");
    expect(loadingCopy).toContain("text-[1.6632em]");
    expect(loadingCopy).toContain("md:text-[1.32em]");
    expect(lockup).toContain("text-[calc(var(--stage-width)*0.10)]");
    expect(css).toContain("font-size: calc(var(--stage-width) * 0.1045)");
  });

  it("keeps LOADING on its independent copy owner", () => {
    const loader = source("src/components/SixLoadingIndicator.tsx");
    const tagline = source("src/components/TaglineText.tsx");

    expect(loader).toContain("<LoadingText />");
    expect(loader).not.toContain("<TaglineText />");
    expect(tagline).toContain("export function LoadingText");
    expect(tagline).toContain(
      '<LoadingRest>OADING<span data-six-loading-phone-dots="1">...</span></LoadingRest>',
    );
  });
});
