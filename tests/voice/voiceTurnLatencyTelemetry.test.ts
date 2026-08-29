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
const customVoiceDelivery = readFileSync(
  resolve(root, "src/liveavatar/customVoiceDelivery.ts"),
  "utf8",
);
const audioPresentation = readFileSync(
  resolve(root, "src/liveavatar/avatarAudioPresentation.ts"),
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

  it("keeps provider start separate from observable browser audio presentation", () => {
    const handlerStart = customVoiceDelivery.indexOf("const handleStarted");
    const providerHandler = customVoiceDelivery.slice(
      handlerStart,
      customVoiceDelivery.indexOf("const onStarted", handlerStart),
    );
    expect(providerHandler).toContain("providerStarted = true");
    expect(providerHandler).not.toContain("noteSixAudioActive");
    expect(customVoiceDelivery).toContain('emitPresentation("media_presented"');
    expect(audioPresentation).toContain("liveAudioTrack");
    expect(audioPresentation).toContain("unmutedAudioTrack");
    expect(audioPresentation).toContain("enabledAudioTrack");
    expect(audioPresentation).toContain("playStatus");
    expect(audioPresentation).toContain("nonZeroAudioSamples");
  });

  it("logs safe media evidence and limits recovery to existing tracks/playback", () => {
    const telemetryStart = textChat.indexOf(
      '"voice_avatar_media_presentation"',
    );
    const telemetryBlock = textChat.slice(telemetryStart, telemetryStart + 900);
    expect(telemetryBlock).toContain("presentation.evidence");
    expect(telemetryBlock).not.toContain("chatResponseText");
    expect(audioPresentation).toContain("session.attach(element)");
    expect(audioPresentation).toContain("await element.play()");
    expect(audioPresentation).not.toContain("session.repeat(");
  });

  it("does not discard a completed browser final while the avatar is speaking", () => {
    expect(avatarSession).not.toContain(
      "if (isAvatarTalkingRef.current) return;\n      const transcript",
    );
    expect(avatarSession).toContain("void latestInterruptRef.current();");
    expect(avatarSession).toContain(
      'dispatchAuthoritativeAvatarSpeech("app_browser", { text: transcript });',
    );
  });
});
