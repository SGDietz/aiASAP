import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");
const source = (file: string) => fs.readFileSync(path.join(repoRoot, file), "utf8");

describe("direct spoken stop lifecycle (G 2026-08-25)", () => {
  it("routes a direct stop for Six through the existing returned-START pause path", () => {
    const session = source("src/components/LiveAvatarSession.tsx");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const directStopRoute = session.slice(
      session.indexOf("if (hasEndSessionIntent(userText))"),
      session.indexOf("if (await handleBuildInterestSpeech(userText))"),
    );

    expect(directStopRoute).toContain("isDirectAvatarStopCommand(userText) ? { pause: true } : undefined");
    expect(demo).toContain("const handlePause = () => {");
    expect(demo).toContain("setPausedOnStage(true);");
    expect(demo).not.toContain("const handlePause = () => {\n    setIsExited(true);");
  });
});
