import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("initial Six idle entry", () => {
  it("shows still Six and controls without tap-anywhere authority", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const start = demo.indexOf("if (showsSharedIdle)");
    const end = demo.indexOf('// VOICE ONLY (2026-08-21)', start);
    const idle = demo.slice(start, end);

    expect(idle).toContain('data-six-initial-idle="1"');
    expect(idle).toContain('src="/startscreen-noband.png"');
    expect(idle).toContain("<StageControls");
    expect(idle).toContain('running={false}');
    expect(idle).toContain("? handleStartFromStopped");
    expect(idle).toContain(": () => void beginSessionFromStart()");
    expect(idle).not.toMatch(/Tap\/Click|click anywhere|tap anywhere|To Talk To 6/i);
    expect(idle).not.toContain('role="button"');
    expect(idle).not.toContain("tabIndex=");
    expect(idle).not.toContain("onKeyDown=");
    expect(idle).not.toContain("onClick=");
  });

  it("keeps actual loading separate and dormant after Start", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const start = demo.indexOf("if (!sessionToken && hasTappedToStart");
    const end = demo.indexOf("// One literal idle render", start);
    const loading = demo.slice(start, end);
    expect(loading).toContain("<SixLoadingIndicator />");
    expect(loading).not.toContain("<StageControls");
    expect(loading).not.toMatch(/Tap\/Click|click anywhere|tap anywhere/i);
  });

  it("removes obsolete prompt styling", () => {
    const css = source("app/globals.css");
    expect(css).not.toContain("aiasap-idle-start-prompt");
    expect(css).not.toContain("aiasap-idle-prompt-breathe");
  });
});
