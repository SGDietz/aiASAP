export type MutableRefLike<T> = { current: T };

type AssistantMode = "CUSTOM" | "FULL";

type RecordAssistantTurnOptions = {
  mode: AssistantMode;
  text: string;
  utteranceId: string | null;
  pendingSpeechUtteranceIdRef: MutableRefLike<string | null>;
  logTurn: (
    role: "assistant",
    text: string,
    utteranceId: string | null,
  ) => void;
  rememberLine: (role: "assistant", text: string) => void;
};

/**
 * One authoritative assistant-turn boundary: correlate CUSTOM speech before
 * logging it, then keep both modes in local conversation history.
 */
export function recordAssistantTurn({
  mode,
  text,
  utteranceId,
  pendingSpeechUtteranceIdRef,
  logTurn,
  rememberLine,
}: RecordAssistantTurnOptions): void {
  if (mode === "CUSTOM") {
    if (utteranceId) {
      pendingSpeechUtteranceIdRef.current = utteranceId;
    }
    logTurn("assistant", text, utteranceId);
  }
  rememberLine("assistant", text);
}

/** Consume once so unrelated SDK speech cannot inherit a stale turn ID. */
export function consumePendingSpeechUtteranceId(
  pendingSpeechUtteranceIdRef: MutableRefLike<string | null>,
): string | null {
  const utteranceId = pendingSpeechUtteranceIdRef.current;
  pendingSpeechUtteranceIdRef.current = null;
  return utteranceId;
}
