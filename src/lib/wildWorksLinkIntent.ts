export const WILDWORKS_LIVE_URL = "https://wildworks.live/";
export const WILDWORKS_LINK_OFFER_RESPONSE =
  "Would you like me to put the WildWorks link on the screen so you can see the site?";
export const WILDWORKS_LINK_SHOWN_RESPONSE =
  "The www.WildWorks.Live link is on the screen. Tap it to see his website.";
export const WILDWORKS_LINK_DECLINED_RESPONSE = "No problem.";
export const AVATAR_SITE_RESPONSE =
  "You're on one. That's me. This is an avatar site—purpose-built to sell and make money.";

export type WildWorksOfferState = "idle" | "pending" | "shown";

export type WildWorksOfferTransition = {
  nextState: WildWorksOfferState;
  handled: boolean;
  spoken: string | null;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9.'\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isWildWorksOfferInterest(text: string): boolean {
  const wildWorks = String.raw`wild\s*works(?:\s*(?:\.|dot)\s*live)?`;
  const namedSite = String.raw`(?:${wildWorks}|g(?:'s|s)?\s+(?:site|website)|scott(?:'s|s)?\s+(?:site|website))`;
  if (/\b(?:don't|do not|dont|never|not now|no need to)\b/i.test(text)) {
    return false;
  }
  const patterns = [
    new RegExp(
      String.raw`\bshow\s+(?:me|us)\s+(?:the\s+)?${namedSite}(?:\s+(?:site|website|page))?\b`,
      "i",
    ),
    new RegExp(
      String.raw`\b(?:can|could|may)\s+(?:i|we)\s+(?:see|view|visit|open|go\s+to)\s+(?:the\s+)?${namedSite}\b`,
      "i",
    ),
    new RegExp(
      String.raw`\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:show\s+(?:me|us)|open|visit|take\s+(?:me|us)\s+to)\s+(?:the\s+)?${namedSite}\b`,
      "i",
    ),
    new RegExp(
      String.raw`\b(?:open|visit|view|see|go\s+to|take\s+(?:me|us)\s+to)\s+(?:the\s+)?${namedSite}\b`,
      "i",
    ),
    new RegExp(
      String.raw`\b(?:i|we)\s+(?:want|would\s+like|'d\s+like)\s+to\s+(?:see|view|visit|open|go\s+to)\s+(?:the\s+)?${namedSite}\b`,
      "i",
    ),
    new RegExp(
      String.raw`\b(?:give|send|show)\s+(?:me|us)\s+(?:the\s+)?${namedSite}\s+(?:site|website\s+)?link\b`,
      "i",
    ),
    /\b(?:can|could|may)\s+(?:i|we)\s+(?:see|view)\s+(?:g(?:'s|s)?|his|your)\s+(?:portfolio|work|examples?)\b/i,
    /\b(?:show|let)\s+(?:me|us)\s+(?:see\s+)?(?:g(?:'s|s)?|his|your)\s+(?:portfolio|work|examples?)\b/i,
    /\bdo\s+you\s+have\s+(?:a\s+)?(?:portfolio|example\s+site)\b/i,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Two-step, current-session-only consent gate. An interest turn offers the
 * link; only the immediately context-bound reply may approve showing it.
 */
export function resolveWildWorksLinkTurn(
  userText: string,
  state: WildWorksOfferState,
): WildWorksOfferTransition | null {
  const text = normalize(userText);
  if (!text) return null;

  if (state === "pending") {
    if (/^(?:yes|yeah|yep|yup|sure|okay|ok|please|please do|do it|go ahead|show it|put it (?:up|on (?:the )?screen))\b/i.test(text)) {
      return { nextState: "shown", handled: true, spoken: WILDWORKS_LINK_SHOWN_RESPONSE };
    }
    if (/^(?:no|nope|nah|not now|don't|do not|never mind)\b/i.test(text)) {
      return { nextState: "idle", handled: true, spoken: WILDWORKS_LINK_DECLINED_RESPONSE };
    }
    // A non-answer expires the offer so a later unrelated "yes" cannot show it.
    return { nextState: "idle", handled: false, spoken: null };
  }

  if (!isWildWorksOfferInterest(text)) return null;
  if (state === "shown") {
    return { nextState: "shown", handled: true, spoken: WILDWORKS_LINK_SHOWN_RESPONSE };
  }
  return { nextState: "pending", handled: true, spoken: WILDWORKS_LINK_OFFER_RESPONSE };
}

/** Answers questions about the kind of avatar website this page demonstrates. */
export function resolveAvatarSiteIntent(userText: string): string | null {
  const text = normalize(userText);
  if (!text || /\b(?:movie|film|game|gaming|blue people|james cameron)\b/i.test(text)) {
    return null;
  }

  const avatarSite = String.raw`avatar\s+(?:site|website)`;
  const patterns = [
    new RegExp(String.raw`\b(?:what|how)\s+(?:is|does|would|could)\s+(?:an?\s+)?${avatarSite}\b`, "i"),
    new RegExp(String.raw`\bwhat\s+(?:an?\s+)?${avatarSite}\s+(?:is|looks?\s+like|could\s+look\s+like)\b`, "i"),
    new RegExp(String.raw`\b(?:show|tell)\s+me\s+(?:about\s+)?(?:an?\s+)?${avatarSite}\b`, "i"),
    new RegExp(String.raw`\b(?:can|could|will|would)\s+(?:ai\s*asap|you|the\s+team)\s+(?:build|make|create)\s+(?:me\s+|us\s+)?(?:an?\s+)?${avatarSite}\b`, "i"),
    new RegExp(String.raw`\b(?:is|does)\s+this\s+(?:an?\s+)?${avatarSite}\b`, "i"),
  ];

  return patterns.some((pattern) => pattern.test(text))
    ? AVATAR_SITE_RESPONSE
    : null;
}
