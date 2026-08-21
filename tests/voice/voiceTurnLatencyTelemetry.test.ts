import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const textChat = readFileSync(
  resolve(root, "src/liveavatar/useTextChat.ts"),
  "utf8",
);
const avatarSession = readFileSync(
  resolve(root, "src/components/LiveAvatarSession.tsx"),
  "utf8",
);

describe("voice-turn latency telemetry contract", () => {
  it("correlates brain and HeyGen dispatch stages to the accepted utterance", () => {
    for (const eventType of [
      "voice_brain_request_started",
      "voice_brain_response_ready",
      "voice_avatar_repeat_dispatched",
      "voice_avatar_repeat_failed",
    ]) {
      expect(textChat).toContain(eventType);
    }
    expect(textChat).toContain("utteranceId");
    expect(textChat).toContain('provider: "openai"');
    expect(textChat).toContain('provider: "heygen"');
  });

  it("records HeyGen speech start without reusing a stale turn id", () => {
    expect(avatarSession).toContain("pendingSpeechUtteranceIdRef");
    expect(avatarSession).toContain("voice_avatar_speak_started");
    expect(avatarSession).toContain("consumePendingSpeechUtteranceId(");
    expect(avatarSession).toContain('stage: "sdk_speak_started"');
    expect(avatarSession).toContain(
      'eventId: `${utteranceId}:avatar-speak-started`',
    );
  });
});
