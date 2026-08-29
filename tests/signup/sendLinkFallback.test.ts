import { describe, expect, it } from "vitest";
import { resolveSendLinkFallbackStatus } from "../../src/lib/signup/sendLinkFallback";

describe("send-link fallback honesty", () => {
  it("shows sent only for confirmed delivery or a confirmed recent send", () => {
    expect(resolveSendLinkFallbackStatus({ emailSent: true })).toBe("sent");
    expect(resolveSendLinkFallbackStatus({ alreadySentRecently: true })).toBe("sent");
  });

  it("never claims sent for failed, missing, or unconfirmed outcomes", () => {
    expect(resolveSendLinkFallbackStatus({ emailSent: false })).toBe("failed");
    expect(resolveSendLinkFallbackStatus({})).toBe("failed");
    expect(resolveSendLinkFallbackStatus({ emailSent: undefined })).toBe("failed");
  });
});
