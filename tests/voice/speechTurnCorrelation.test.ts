import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  consumePendingSpeechUtteranceId,
  recordAssistantTurn,
} from "../../src/lib/voice/speechTurnCorrelation";

describe("assistant-to-speech correlation", () => {
  it("keeps a CUSTOM assistant utterance ID until speech-start consumes it", () => {
    const pending = { current: null as string | null };
    const logTurn = vi.fn();
    const rememberLine = vi.fn();

    recordAssistantTurn({
      mode: "CUSTOM",
      text: "Safe synthetic assistant line",
      utteranceId: "synthetic-utterance-1",
      pendingSpeechUtteranceIdRef: pending,
      logTurn,
      rememberLine,
    });

    expect(logTurn).toHaveBeenCalledWith(
      "assistant",
      "Safe synthetic assistant line",
      "synthetic-utterance-1",
    );
    expect(rememberLine).toHaveBeenCalledWith(
      "assistant",
      "Safe synthetic assistant line",
    );
    expect(consumePendingSpeechUtteranceId(pending)).toBe(
      "synthetic-utterance-1",
    );
    expect(consumePendingSpeechUtteranceId(pending)).toBeNull();
  });

  it("does not correlate FULL-mode assistant logging to CUSTOM speech", () => {
    const pending = { current: null as string | null };
    const logTurn = vi.fn();
    const rememberLine = vi.fn();

    recordAssistantTurn({
      mode: "FULL",
      text: "Remote brain line",
      utteranceId: "must-not-stick",
      pendingSpeechUtteranceIdRef: pending,
      logTurn,
      rememberLine,
    });

    expect(logTurn).not.toHaveBeenCalled();
    expect(rememberLine).toHaveBeenCalledWith("assistant", "Remote brain line");
    expect(consumePendingSpeechUtteranceId(pending)).toBeNull();
  });

  it("has one authoritative assistantLogRef assignment and truthful SDK stage", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );
    expect(source.match(/assistantLogRef\.current\s*=/g)).toHaveLength(1);
    expect(source).toContain('stage: "sdk_speak_started"');
    expect(source).not.toContain('stage: "audible_start"');
  });
});
