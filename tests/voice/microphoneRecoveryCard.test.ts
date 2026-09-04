import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const card = fs.readFileSync(
  path.join(process.cwd(), "src/components/MicrophoneRecoveryCard.tsx"),
  "utf8",
);

describe("blocked Android microphone recovery card", () => {
  it("offers one in-app re-check without inventing a browser settings deep link", () => {
    expect(card).toContain("Tap CHECK MIC AGAIN to make one fresh microphone request.");
    expect(card).toContain("CHECK MIC AGAIN");
    expect(card).toContain('data-microphone-recovery="blocked"');
    expect(card).not.toMatch(/intent:|chrome:\/\/settings|settings:/i);
  });
});
