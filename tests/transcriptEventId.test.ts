import { describe, expect, it } from "vitest";
import { transcriptEventId } from "../src/lib/voice/transcriptEventId";

describe("transcriptEventId", () => {
  it("deduplicates retries of each accepted user turn", () => {
    expect(transcriptEventId("utt-1", "user", "Add milk")).toBe(
      "utt-1:transcript:user",
    );
  });

  it("deduplicates one assistant line without collapsing different lines", () => {
    const first = transcriptEventId("utt-1", "assistant", "Added Milk.");
    expect(transcriptEventId("utt-1", "assistant", "Added Milk.")).toBe(first);
    expect(transcriptEventId("utt-1", "assistant", "Anything else?")).not.toBe(
      first,
    );
  });
});
