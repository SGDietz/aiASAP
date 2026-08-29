export type TranscriptRole = "user" | "assistant";

function stableTextFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (const character of text.trim()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Idempotent transcript identity within one accepted utterance. Assistant text
 * is included because one accepted turn can legitimately produce more than one
 * assistant line; duplicate delivery of the same line still resolves to one row.
 */
export function transcriptEventId(
  utteranceId: string,
  role: TranscriptRole,
  message: string,
): string {
  if (role === "user") return `${utteranceId}:transcript:user`;
  return `${utteranceId}:transcript:assistant:${stableTextFingerprint(message)}`;
}
