/** Explicitly approved by G for public display in aiASAP on 2026-09-02. */
export const AIASAP_PUBLIC_PHONE_DISPLAY = "1+443-797-2166";
export const AIASAP_PUBLIC_PHONE_HREF = "tel:+14437972166";
export const AIASAP_PUBLIC_WEBSITE_DISPLAY = "WildWorks.Live";
export const PUBLIC_CONTACT_SPOKEN_RESPONSE =
  "G's public phone number is plus one, 4 4 3, 7 9 7, 2 1 6 6. The phone and WildWorks.Live links are at the bottom of the screen.";

// RIDE cb2dde76 22:20:16: G said "you're supposed to say great, what's your
// name and tell me your email address" - coaching 6 on the script - and 6
// answered by reading out G's public phone number, mid-capture. "what's" +
// "your" + "email" is enough to trip the pattern below, so instruction
// framing has to be excluded before it runs.
const PUBLIC_CONTACT_COACHING_RE =
  /\b(?:you'?re supposed to|you should|you need to|you have to|you could|you might|say something like|instead of saying|supposed to say|ask me for|tell me your (?:name|email)|what'?s your name)\b/;

export function isPublicContactRequest(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9@.'\s-]+/g, " ");
  if (PUBLIC_CONTACT_COACHING_RE.test(normalized)) return false;
  if (/\b(?:have|get|ask)\b[\s\S]{0,30}\b(?:reach out|contact|call|email)\s+(?:me|us)\b/.test(normalized)) {
    return false;
  }
  return [
    /\bhow (?:do|can|could|should) i (?:contact|reach|call|email|text)\b/,
    /\b(?:what(?:'s| is)|give me|show me|put up)\b[\s\S]{0,35}\b(?:g|scott|his|your)\b[\s\S]{0,20}\b(?:phone|number|email|contact)\b/,
    /\b(?:phone|email|contact)\b[\s\S]{0,25}\b(?:for|to)\b[\s\S]{0,15}\b(?:g|scott)\b/,
  ].some((pattern) => pattern.test(normalized));
}
