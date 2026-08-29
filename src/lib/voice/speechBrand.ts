/** Converts the written brand to the explicitly approved spoken form only. */
export function formatSixSpeechForTts(text: string): string {
  return text.replace(/\baiASAP\b/g, "a-i-ASAP");
}
