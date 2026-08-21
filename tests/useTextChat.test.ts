import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reportActivity: vi.fn(),
  sessionMessage: vi.fn(),
  sessionRepeat: vi.fn(),
  registerSixSpokenLine: vi.fn(),
  deliverCustomTtsAudio: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: <T extends (...args: any[]) => any>(callback: T) => callback,
}));

vi.mock("../src/liveavatar/context", () => ({
  useLiveAvatarContext: () => ({
    sessionRef: {
      current: {
        message: mocks.sessionMessage,
        repeat: mocks.sessionRepeat,
      },
    },
    reportActivity: mocks.reportActivity,
  }),
}));

vi.mock("../src/liveavatar/customVoiceDelivery", () => ({
  deliverCustomTtsAudio: mocks.deliverCustomTtsAudio,
  registerSixSpokenLine: mocks.registerSixSpokenLine,
  // 2026-08-21: useTextChat no longer calls repeat() directly — it goes through
  // speakThroughAvatar, which wraps repeat() in the AVATAR_SPEAK_STARTED
  // watchdog that catches 6 being accepted-then-ignored. Still routed to
  // sessionRepeat here so the correlation assertions below keep testing the
  // same thing they always did.
  speakThroughAvatar: (
    session: { repeat: (text: string) => unknown },
    text: string,
  ) => session.repeat(text),
}));

import { useTextChat } from "../src/liveavatar/useTextChat";

describe("useTextChat assistant-turn correlation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionRepeat.mockResolvedValue(undefined);
  });

  it("keeps each accepted utterance ID attached when replies resolve out of order", async () => {
    const pending = new Map<
      string,
      (value: { json: () => Promise<{ response: string }> }) => void
    >();
    const fetchMock = vi.fn((_: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { message?: string };
      return new Promise<{ json: () => Promise<{ response: string }> }>((resolve) => {
        pending.set(body.message ?? "", resolve);
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const onAssistantText = vi.fn();
    const { sendMessage } = useTextChat("CUSTOM", onAssistantText);

    const first = sendMessage("first", null, "utt-first");
    const second = sendMessage("second", null, "utt-second");

    pending.get("second")?.({
      json: async () => ({ response: "second reply" }),
    });
    await second;
    pending.get("first")?.({
      json: async () => ({ response: "first reply" }),
    });
    await first;

    expect(onAssistantText).toHaveBeenNthCalledWith(1, "second reply", {
      utteranceId: "utt-second",
    });
    expect(onAssistantText).toHaveBeenNthCalledWith(2, "first reply", {
      utteranceId: "utt-first",
    });
    expect(mocks.sessionRepeat).toHaveBeenNthCalledWith(1, "second reply");
    expect(mocks.sessionRepeat).toHaveBeenNthCalledWith(2, "first reply");
  });

  it("passes accepted utterance IDs through the LiveAvatarSession call path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "return sessionSendMessage(text, undefined, utteranceId);",
    );
    expect(
      source.match(
        /sendMessage\(buildMemoryAugmentedMessage\(userText\), utteranceId\)/g,
      ),
    ).toHaveLength(3);
    expect(source).toContain("recordAssistantTurn({");
    expect(source).toContain("utteranceId: context.utteranceId,");
    expect(source).toContain("logTurn: voiceLogTurn,");
  });
});
