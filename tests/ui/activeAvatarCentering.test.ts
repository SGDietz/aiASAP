import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8");

describe("active avatar state geometry", () => {
  it("centers the live avatar with the same desktop/tablet flex authority as idle and Stop", () => {
    const session = source("src/components/LiveAvatarSession.tsx");
    const demo = source("src/components/LiveAvatarDemo.tsx");

    expect(session).toContain(
      "relative w-full flex-1 overflow-hidden md:flex md:items-center md:justify-center md:overflow-visible md:px-8",
    );
    expect(session).toContain(
      "md:relative md:inset-auto md:m-0 md:object-cover",
    );
    expect(demo).toContain(
      "aiasap-tablet-idle-media relative w-full flex-1 overflow-hidden md:flex md:items-center md:justify-center",
    );
    expect(demo).toContain(
      "relative w-full flex-1 flex items-center justify-center pb-[8svh] md:pb-0 md:px-8",
    );
  });

  it("keeps phone full-bleed centering and does not alter control/footer anchors", () => {
    const session = source("src/components/LiveAvatarSession.tsx");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const controls = source("src/components/StageControls.tsx");

    expect(session).toContain(
      "absolute inset-0 h-full w-full object-cover object-top rounded-none border-0",
    );
    expect(demo).toContain(
      "aiasap-tablet-idle-stage relative w-full h-[100svh] min-h-0 flex flex-col overflow-hidden",
    );
    expect(demo).toContain("[--stage-height:100svh]");
    expect(demo).toContain('phoneStackPaddingBottom="12px"');
    expect(demo).not.toContain('phoneStackPaddingBottom="calc(env(safe-area-inset-bottom) + 8px)"');
    expect(demo).not.toContain("aiasap-tablet-idle-stage fixed inset-0");
    expect(controls).toContain("var(--stage-height)*0.225");
    expect(controls).toContain("var(--stage-height)*0.203");
  });
});
