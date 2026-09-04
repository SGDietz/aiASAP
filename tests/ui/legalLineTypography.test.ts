import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("shared legal-line typography and semantics", () => {
  it("uses one semantic line with doubled non-collapsing separator gaps", () => {
    const footer = source("src/components/StageLegalFooter.tsx");
    const lineStart = footer.indexOf('data-stage-legal-line="1"');
    const line = footer.slice(lineStart, footer.indexOf("</nav>", lineStart) + 6);

    expect(lineStart).toBeGreaterThan(0);
    expect(line).toContain("-translate-y-[4px]");
    expect(line).toContain("md:translate-y-0");
    expect(line).toContain("gap-[clamp(2px,0.8vw,6px)]");
    expect(line).toContain("©2026 aiASAP All Rights Reserved");
    expect(line.match(/aria-hidden[\s\S]*?>\s*\|\s*<\/span>/g)).toHaveLength(2);
    expect(line).toContain('href="/your-rights"');
    expect(line).toContain("You Own");
    expect(line).toContain('href="/legal"');
    expect(line).toContain("Terms/Legal");
    expect(line).not.toContain("Terms / Legal");
  });

  it("preserves opacity, navigation, height, safe-area, and breakpoint geometry", () => {
    const footer = source("src/components/StageLegalFooter.tsx");

    expect(footer.match(/opacity-100/g)).toHaveLength(2);
    expect(footer).toContain('const ink = "aiasap-legal-ink"');
    expect(footer).toContain("handleLegalNavigation(event, \"/your-rights\")");
    expect(footer).toContain("handleLegalNavigation(event, \"/legal\")");
    expect(footer).toContain('aria-label="Open You Own"');
    expect(footer).toContain('aria-label="Open aiASAP Terms and Legal"');
    expect(footer).toContain("inline-flex items-center justify-center px-1 py-2");
    expect(footer).not.toContain("h-full w-full");
    expect(footer).toContain("window.location.assign(destination)");
    expect(footer).toContain("h-[29px]");
    expect(footer).toContain("md:h-auto md:w-auto md:bg-transparent");
    expect(footer).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(footer).toContain('"fixed inset-x-0 bottom-0"');
  });

  it("is reused by idle, loading, active, and post-Stop wrappers", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");

    expect(demo.match(/<StageLegalFooter/g)?.length).toBeGreaterThanOrEqual(5);
    expect(session.match(/<StageLegalFooter/g)?.length).toBe(2);
    expect(demo).not.toContain("Terms/Legal");
    expect(session).not.toContain("Terms/Legal");
  });
});
