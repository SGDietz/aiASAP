import { describe, expect, it } from "vitest";
import { buildConversationMessages } from "../src/lib/brain/conversationMessages";

describe("buildConversationMessages", () => {
  it("does not duplicate the current user turn when history already ends with it", () => {
    expect(
      buildConversationMessages(
        "system",
        [
          { role: "user", content: "Earlier" },
          { role: "assistant", content: "Reply" },
          { role: "user", content: "Add milk" },
        ],
        "Add milk",
      ),
    ).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "Earlier" },
      { role: "assistant", content: "Reply" },
      { role: "user", content: "Add milk" },
    ]);
  });

  it("appends the current user turn when history ends elsewhere", () => {
    const messages = buildConversationMessages(
      "system",
      [{ role: "assistant", content: "What should I add?" }],
      "Milk",
    );
    expect(messages.at(-1)).toEqual({ role: "user", content: "Milk" });
  });
});
