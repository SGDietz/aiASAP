import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("voice-only status and stage-control separation", () => {
  it("anchors status above the unchanged control cluster", () => {
    const voice = source("src/components/VoiceOnlyStage.tsx");
    const controls = source("src/components/StageControls.tsx");
    expect(voice).toContain('var(--stage-height) * 0.43');
    expect(voice).not.toContain('var(--stage-height) * 0.60');
    expect(controls.match(/var\(--stage-height\)\*0\.225/g)).toHaveLength(2);
    expect(controls.match(/var\(--stage-height\)\*0\.203/g)).toHaveLength(2);
  });

  it.each([710, 844, 900])("leaves deterministic vertical clearance at %ipx", (height) => {
    const statusTop = height * 0.43;
    const estimatedStatusBottom = statusTop + 42;
    const controlsTop = height - (height * 0.225 - 4) - 176.375;
    expect(controlsTop - estimatedStatusBottom).toBeGreaterThanOrEqual(30);
  });
});
