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
  useRef: <T,>(value: T) => ({ current: value }),
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

  it("releases the CUSTOM turn after speech dispatch rather than avatar speech completion", async () => {
    let finishSpeech: (() => void) | undefined;
    mocks.sessionRepeat.mockImplementation(
      () => new Promise<void>((resolve) => {
        finishSpeech = resolve;
      }),
    );
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => ({ response: "Right here." }),
    })));

    const { sendMessage } = useTextChat("CUSTOM");
    let completed = false;
    const turn = sendMessage("What do you mean by that?", null, "utt-normal")
      .then(() => {
        completed = true;
      });

    // Yield one task: the request/JSON path is async, while the deliberately
    // unresolved avatar speech promise must not control `turn`.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.sessionRepeat).toHaveBeenCalledWith("Right here.");
    expect(completed).toBe(true);

    finishSpeech?.();
    await turn;
  });

  it("does not dispatch an older brain reply after the user has started a newer turn", async () => {
    const pending = new Map<string, (value: { json: () => Promise<{ response: string }> }) => void>();
    vi.stubGlobal("fetch", vi.fn((_: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { message?: string };
      return new Promise<{ json: () => Promise<{ response: string }> }>((resolve) => {
        pending.set(body.message ?? "", resolve);
      });
    }));
    const current = { id: "utt-new" };
    const onAssistantText = vi.fn();
    const { sendMessage } = useTextChat(
      "CUSTOM",
      onAssistantText,
      undefined,
      undefined,
      undefined,
      undefined,
      (utteranceId) => utteranceId === current.id,
    );

    const oldTurn = sendMessage("old question", null, "utt-old");
    pending.get("old question")?.({ json: async () => ({ response: "old reply" }) });
    await oldTurn;

    expect(onAssistantText).not.toHaveBeenCalled();
    expect(mocks.sessionRepeat).not.toHaveBeenCalled();
  });

  it("passes accepted utterance IDs through the LiveAvatarSession call path", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "return sessionSendMessage(text, imageAnalysisRef.current, utteranceId);",
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

describe("useTextChat supersedes an in-flight brain request when a newer turn arrives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionRepeat.mockResolvedValue(undefined);
  });

  it("aborts the older request and speaks only the newest reply (ride c25f52ab: 29 requests, 22 spoken)", async () => {
    const signals: Array<AbortSignal | undefined> = [];
    const pending = new Map<string, (value: { json: () => Promise<{ response: string }> }) => void>();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      // logAppEvent also calls fetch (telemetry rows); only the brain calls matter here.
      if (!String(url).includes("openai-chat-complete")) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { message?: string };
      signals.push(init?.signal ?? undefined);
      return new Promise<{ json: () => Promise<{ response: string }> }>((resolve, reject) => {
        pending.set(body.message ?? "", resolve);
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const onAssistantText = vi.fn();
    const newest = "utt-second";
    const { sendMessage } = useTextChat("CUSTOM", onAssistantText, undefined, undefined, undefined, undefined, (id) => id === newest);

    const first = sendMessage("first", null, "utt-first");
    const second = sendMessage("second", null, "utt-second");
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    pending.get("second")?.({ json: async () => ({ response: "second reply" }) });
    await Promise.all([first, second]);

    expect(onAssistantText).toHaveBeenCalledTimes(1);
    expect(onAssistantText).toHaveBeenCalledWith("second reply", { utteranceId: "utt-second" });
    expect(mocks.sessionRepeat).toHaveBeenCalledTimes(1);
    expect(mocks.sessionRepeat).toHaveBeenCalledWith("second reply");
  });

  it("does not cancel anything when no newest-wins guard was supplied", async () => {
    const signals: Array<AbortSignal | undefined> = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes("openai-chat-complete")) signals.push(init?.signal ?? undefined);
      return Promise.resolve({ ok: true, json: async () => ({ response: "ok" }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { sendMessage } = useTextChat("CUSTOM", vi.fn());
    await Promise.all([sendMessage("a", null, "utt-a"), sendMessage("b", null, "utt-b")]);
    expect(signals.every((s) => s === undefined)).toBe(true);
  });
});
