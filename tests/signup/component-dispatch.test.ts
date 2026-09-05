import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  arbitrateAvatarSpeechSource,
  selectAvatarSpeechSource,
  shouldUseBrowserSpeechRecognition,
  type AvatarSpeechSource,
} from "../../src/lib/speech/sourceAuthority";
import { isDuplicateUtterance } from "../../src/lib/speech/dedupe";

describe("LiveAvatar account-turn dispatch authority", () => {
  it("selects one deterministic source by mode with an explicit CUSTOM fallback", () => {
    expect(selectAvatarSpeechSource("CUSTOM", true)).toBe("app_browser");
    expect(selectAvatarSpeechSource("CUSTOM", false)).toBe("liveavatar_sdk");
    expect(selectAvatarSpeechSource("FULL", true)).toBe("liveavatar_sdk");
    expect(selectAvatarSpeechSource("FULL", false)).toBe("liveavatar_sdk");
  });

  it("uses the stable SDK transcript on mobile and keeps desktop fallback intact", () => {
    expect(
      shouldUseBrowserSpeechRecognition(
        "CUSTOM",
        "Mozilla/5.0 (Linux; Android 10; K) Chrome/151 Mobile Safari/537.36",
      ),
    ).toBe(false);
    expect(
      shouldUseBrowserSpeechRecognition(
        "CUSTOM",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151 Safari/537.36",
      ),
    ).toBe(true);
    expect(shouldUseBrowserSpeechRecognition("FULL", "desktop")).toBe(false);
  });

  it("locks the session to one transcript source", () => {
    let authority: AvatarSpeechSource = selectAvatarSpeechSource("CUSTOM", true);

    // The authority is still one source and the loser still never jumps the
    // queue. What changed on 2026-09-04 (G's ride 48c99dfa): the loser is
    // handed back as a BACKFILL CANDIDATE instead of being discarded. The
    // browser recognizer turned only 14-39% of his speech into turns across
    // five rides, and both of his answers - "yeah you may send that email off"
    // and "Yes." - existed only on the SDK side. Dropping them is why nothing
    // ever sent.
    const competing = arbitrateAvatarSpeechSource(authority, "liveavatar_sdk");
    expect(competing).toEqual({
      accepted: false,
      authoritativeSource: "app_browser",
      backfillCandidate: true,
    });

    // The winner is never a backfill - it goes straight through.
    expect(
      arbitrateAvatarSpeechSource(authority, "app_browser").backfillCandidate,
    ).toBe(false);

    const sameSourceNextTurn = arbitrateAvatarSpeechSource(
      authority,
      "app_browser",
    );
    expect(sameSourceNextTurn.accepted).toBe(true);
  });

  it("does not globally suppress legitimate rapid suffix-shaped follow-ups", () => {
    expect(
      isDuplicateUtterance(
        "Please read me back my email.",
        1_000,
        "my email.",
        1_700,
      ),
    ).toBe(false);
    expect(
      isDuplicateUtterance(
        "Please send the link.",
        1_000,
        "send the link.",
        1_700,
      ),
    ).toBe(false);
  });

  it("wires source arbitration into the real component without suffix dropping", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );

    expect(source).toContain("dispatchAuthoritativeAvatarSpeech");
    expect(source).toContain("selectAvatarSpeechSource(mode");
    expect(source).toContain(
      'dispatchAuthoritativeAvatarSpeech("liveavatar_sdk", event)',
    );
    expect(source).toContain(
      'dispatchAuthoritativeAvatarSpeech("app_browser", { text: transcript })',
    );
    const dispatchStart = source.indexOf(
      "const dispatchAuthoritativeAvatarSpeech",
    );
    const validation = source.indexOf(
      "if (!text || isInternalSignal(text)) return;",
      dispatchStart,
    );
    const arbitration = source.indexOf(
      "arbitrateAvatarSpeechSource(",
      dispatchStart,
    );
    expect(dispatchStart).toBeGreaterThan(-1);
    expect(validation).toBeGreaterThan(dispatchStart);
    expect(validation).toBeLessThan(arbitration);
    expect(source).toContain(
      'prevUserSpeechRef.current = { text: "", at: 0 };',
    );
    expect(source).toContain("hasExplicitAccountSendOnCloseIntent(lastUser)");
    const avatarReadbackStart = source.indexOf(
      "const onAvatarTranscription",
    );
    const avatarReadbackEnd = source.indexOf(
      "AgentEventsEnum.AVATAR_TRANSCRIPTION",
      avatarReadbackStart,
    );
    const avatarReadbackBlock = source.slice(
      avatarReadbackStart,
      avatarReadbackEnd,
    );
    expect(avatarReadbackBlock).not.toContain(
      "accountSetupAwaitingEmailRef.current = true;",
    );
    expect(avatarReadbackBlock).not.toContain(
      "accountSetupPendingEmailRef.current = parsed;",
    );
    expect(source).toContain("const recoverableRecognitionError");
    expect(source).toContain(
      'console.warn("Custom speech recognition restart failed:", error);',
    );
    expect(source).not.toContain("isTrailingUtteranceShard");
    expect(source).not.toContain("account_trailing_shard");
  });
});
