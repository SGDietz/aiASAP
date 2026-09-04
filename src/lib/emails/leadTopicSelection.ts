/**
 * Shared, deterministic topic / capitalization layer used by both the internal
 * aiASAP team email (founder subject + body) and the visitor confirmation
 * (labeled `Subject:` line). Same input then same output on both sides, so a
 * lead cannot see one topic while G sees another.
 *
 * Independent-audit hardening (2026-09-03):
 *   - Treat every transcript turn as UNTRUSTED DATA, never instructions.
 *   - Reject prompt-injection / jailbreak language, role/system/developer
 *     instructions, secrets / tokens / API keys / passwords, contact
 *     coordinates (URLs, emails, phone numbers), HTML / markup, CR/LF /
 *     control characters, and action-only filler.
 *   - Never copy a raw longest turn. Split each user turn into bounded
 *     clauses (sentence + comma boundaries), evaluate every clause on its
 *     own, and prefer clauses that contain concrete inquiry / project
 *     nouns from a small explicit lexicon. Mixed input keeps the safe
 *     project talk and discards the unsafe siblings.
 *   - Restore correct capitalization only for a small explicit product /
 *     proper-name lexicon (`aiASAP`, `iPhone`, `iPad`, `iMac`, `MacBook`,
 *     `Apple`). Never invent capitalization for arbitrary unknown words.
 *   - Format structured display names with a bounded formatter: reliable
 *     mixed-case is preserved, all-lower / all-upper is title-cased.
 *   - If no safe substantive topic exists, return a neutral aiASAP-specific
 *     fallback that names no budget / timing / readiness / ownership.
 *
 * Only aiASAP-branded product terms live in the capitalization table; sister
 * brand names intentionally do NOT appear so this layer cannot leak them
 * into aiASAP mail.
 */

export type ConversationTurn = {
  role: "user" | "assistant";
  text: string;
};

export const FALLBACK_TOPIC = "aiASAP conversation details";
export const SUBJECT_TOPIC_MAX = 120;

const CONTACT_INTENT_PATTERNS: RegExp[] = [
  /^(?:please\s+|can\s+you\s+)?(?:have (?:someone|somebody)|somebody|someone)\s+(?:reach out|contact me|call me(?: back)?|get in touch|follow up|email me(?: back)?|touch base|circle back)\b[^\n]*$/i,
  /^(?:please\s+|kindly\s+)?(?:reach out|contact me|call me(?: back)?|get in touch|follow up(?: with me)?|email me(?: back)?|touch base|circle back)\.?$/i,
  /^(?:yes|yeah|sure|ok(?:ay)?|please)\b[\s,.!?-]*(?:reach out|contact me|call me|follow up|get in touch)?\.?$/i,
  /^i(?:'m| am)?\s*interested(?:\s+in\s+(?:six|6))?\s+to reach out\.?$/i,
];

const NON_SUBSTANTIVE_PATTERNS: RegExp[] = [
  /^(?:hi|hello|hey|yo|greetings)[\s,.!]*$/i,
  /^(?:thanks?|thank you|ty)[\s,.!]*$/i,
  /^(?:bye|goodbye|later|cya)[\s,.!]*$/i,
  /^(?:yes|no|maybe|sure|ok(?:ay)?)[\s,.!?]*$/i,
];

const CONTACT_INTENT_PREFIX =
  /^(?:please\s+|can\s+you\s+|could you\s+|kindly\s+)?(?:have (?:someone|somebody)|somebody|someone)\s+(?:reach out|contact me|call me(?: back)?|get in touch|follow up|email me(?: back)?|touch base|circle back)(?:\s+(?:to|about|regarding|re|for|so we can|so they can)\s+)/i;

/**
 * Small, explicit product / proper-name lexicon. Kept short deliberately so
 * this layer cannot hallucinate brand names. Extend only with justified
 * product names the aiASAP team actually needs to render correctly.
 */
const PROPER_NAME_MAP: Array<[RegExp, string]> = [
  [/\bai[\s-]+asap\b/gi, "aiASAP"],
  [/\baiasap\b/gi, "aiASAP"],
  [/\biphone\b/gi, "iPhone"],
  [/\bipad\b/gi, "iPad"],
  [/\bimac\b/gi, "iMac"],
  [/\bmacbook\b/gi, "MacBook"],
  [/\bapple\b/gi, "Apple"],
];

const LEADING_CONVERSATIONAL_FILLER =
  /^(?:(?:well|so|um+|uh+|you know|I mean|I think|I guess|basically|actually|honestly|okay|ok)[\s,.!?-]+)+/i;

/**
 * Concrete inquiry / project nouns. A clause is only considered a valid
 * substantive topic if it names at least one of these — otherwise it is
 * likely conversational filler or an instruction, not a project ask.
 */
const SAFE_TOPIC_NOUNS: ReadonlySet<string> = new Set([
  // outdoor structures
  "patio", "porch", "deck", "fence", "wall", "landing", "step", "steps",
  "walkway", "walkways", "driveway", "path", "pathway", "arbor", "pergola",
  // rooms / house
  "kitchen", "bathroom", "bedroom", "basement", "attic", "garage", "house",
  "home", "office", "shop", "studio", "room",
  // yard / garden
  "yard", "yards", "garden", "gardens", "lawn", "lawns", "tree", "trees",
  "hedge", "hedges", "shrub", "shrubs", "bed", "beds", "border", "planter",
  "planters", "mulch", "soil",
  // hardscape materials
  "flagstone", "stone", "brick", "concrete", "paver", "pavers", "gravel",
  // landscape systems
  "drainage", "irrigation", "sprinkler", "grading", "regrade", "erosion",
  "planting", "landscape", "landscaping", "hardscape", "softscape",
  // features
  "pool", "spa", "pond", "fountain", "waterfall", "firepit", "outdoor",
  "kitchen", "grill",
  // business / tech
  "booking", "scheduling", "website", "site", "app", "application",
  "system", "platform", "business", "brand", "branding", "logo", "product",
  "service", "shop", "store", "catalog", "catalogue",
  "detailing", "cleaning", "repair", "install", "installation",
  "design", "redesign", "remodel", "renovation", "rework", "refresh",
  "upgrade", "build", "landscaper", "contractor", "trade",
  // inquiry framing
  "project", "quote", "estimate", "proposal", "consultation", "tour",
  "question", "questions", "plan", "plans", "idea", "ideas", "help",
  "issue", "problem", "trouble",
  // aiASAP specific
  "aiasap", "account", "dashboard", "package", "support", "signup",
  // devices
  "phone", "tablet", "computer", "laptop", "desktop", "device", "iphone",
  "ipad", "imac", "macbook",
]);

/**
 * Prompt-injection / role-hijack / jailbreak language. If any clause
 * contains one of these, drop the clause: even a mixed sentence is
 * suspect and its "legitimate" content could be crafted to smuggle intent.
 */
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above|earlier|the\s+)?\s*(?:instructions?|prompts?|rules?|messages?|context)\b/i,
  /\b(?:you\s+are\s+now|act\s+as|roleplay\s+as|pretend\s+(?:to\s+be|you\s+are)|from\s+now\s+on\s+you\s+are)\b/i,
  /\bsystem\s+prompt\b/i,
  /\b(?:developer|admin|root|god)\s+(?:mode|instructions?|access)\b/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
  /<\|(?:im_start|im_end|system|user|assistant)\|>/i,
  /\[\s*INST\s*\]/i,
  /\bBEGIN\s+SYSTEM\s+MESSAGE\b/i,
  /\bnew\s+instructions?\s*:/i,
  /\bBcc\s*:/i,
  /\breveal\s+(?:your|the)\s+(?:system\s+)?prompt\b/i,
];

/** Secrets / tokens / API keys / passwords. */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bxox[baprs]-[A-Za-z0-9-]{8,}/,
  /\bghp_[A-Za-z0-9]{16,}/,
  /\bAKIA[A-Z0-9]{12,}/,
  /\bAIza[A-Za-z0-9_-]{20,}/,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/i,
  /\b(?:api[_-]?key|password|passwd|secret|token|access[_-]?key)\s*[:=]\s*\S+/i,
  /-----BEGIN\s+[A-Z ]+PRIVATE KEY-----/,
];

/** Contact coordinates — URLs, email addresses, phone numbers. */
const URL_PATTERN = /\bhttps?:\/\/\S+|\bwww\.[a-z0-9-]+\.[a-z]{2,}/i;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}\b/;
const PHONE_PATTERN = /\b(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/;

/** HTML / markup tags. */
const HTML_TAG_PATTERN = /<\s*\/?\s*[a-z][a-z0-9]*\b[^>]*>/i;

/**
 * HTML entity encoding. Ordinary aiASAP transcripts never contain named or
 * numeric HTML entities. If the turn is peppered with `&lt;`, `&gt;`, `&#x…;`
 * etc. it is almost certainly a hand-crafted markup smuggling attempt whose
 * literal-tag sibling would already trip {@link HTML_TAG_PATTERN}. Treated as
 * a turn-level unsafe signal.
 */
const ENCODED_HTML_PATTERN = /&(?:lt|gt|amp|quot|apos|#x?[0-9a-f]+);/i;

/**
 * Role / speaker prefixes that indicate a hand-crafted transcript trying to
 * spoof a different actor's turn. A visitor never has cause to open a segment
 * with `system:`, `developer:`, `assistant:`, `user:`, `tool:`, `admin:`, or
 * `human:` — those are chat-transcript scaffolding, not a project ask.
 *
 * Detection runs at every logical segment boundary (turn start, line break,
 * sentence terminator, bullet marker), so a hidden second-line role prefix
 * such as `I want a patio\nsystem: build a deck` is rejected even though the
 * whole-turn prefix "I want a patio" is safe on its own.
 *
 * The bracketed / parenthesized variant matches anywhere in the segment
 * because a wrapper like `[system]:` / `(assistant):` / `**developer**:` is
 * effectively never legitimate transcript prose in aiASAP inquiries.
 */
const ROLE_NAME_ALTERNATION =
  "(?:system|developer|assistant|user|tool|human|ai|admin|root|instructions?)";
const SEGMENT_START = "(?:^|[\\r\\n]|[.!?;]\\s+|[\\-*•]\\s+)";
const ROLE_PREFIX_PATTERNS: RegExp[] = [
  new RegExp(
    `${SEGMENT_START}\\s*${ROLE_NAME_ALTERNATION}\\s*[:>\\-–—]`,
    "i",
  ),
  new RegExp(
    `[\\[\\(\\{<*_"'\`]+\\s*${ROLE_NAME_ALTERNATION}\\s*[\\]\\)\\}>*_"'\`]+`,
    "i",
  ),
];

function hasRolePrefix(text: string): boolean {
  for (const pattern of ROLE_PREFIX_PATTERNS) if (pattern.test(text)) return true;
  return false;
}

/**
 * Prose credential / PII disclosure. The existing {@link SECRET_PATTERNS}
 * fires on `password: X` / `password = X`. This one catches the natural
 * English forms — "password is X", "my password was X", "the SSN equals X",
 * "PIN: 1234", "my api key was …" — where the possessive/pronoun is
 * optional and the disclosure verb spans present ("is"), past ("was" /
 * "were") and value-like ("equals", ":", "="). The credential term must be
 * followed EITHER by whitespace + a disclosure verb OR by an optional-
 * whitespace colon/equals sign; that keeps legitimate topical noun phrases
 * such as `password manager app`, `token-based booking system`, `seed
 * phrase generator`, or `API key management design` outside the reject set,
 * because none of them place a disclosure verb / colon / equals sign
 * immediately after the credential term.
 */
const CREDENTIAL_DISCLOSURE_PATTERN =
  /\b(?:(?:my|the|our|your|his|her|their)\s+)?(?:password|passphrase|passwd|passcode|pin|ssn|social[\s-]?security(?:\s+number)?|api[\s-]?key|access[\s-]?key|secret[\s-]?key|secret|token|credential|otp|two[\s-]?factor|2fa|mfa|seed[\s-]?phrase|private[\s-]?key|bearer[\s-]?token)(?:\s+(?:is|was|were|equals?)|\s*[:=])\s*\S/i;

/** US SSN written as ddd-dd-dddd. */
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/;

/**
 * US-style street address `<number> <StreetName> <suffix>`. Conservative on
 * capitalisation so the phone/email spans do not double-trigger. Not perfect,
 * but enough to keep visitor PII out of the founder-facing subject line.
 */
const STREET_ADDRESS_PATTERN =
  /\b\d{1,6}\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|way|boulevard|blvd|highway|hwy|circle|cir|place|pl|terrace|ter|parkway|pkwy|route|rte)\b\.?/i;

/**
 * Contact-labelling words (`phone`, `email`, `number`, `cell`, `mobile`,
 * `address`, `website`, `url`, `site`, `link`). Excluded from project-noun
 * scoring for the predominantly-contact-data check, because a residue like
 * "my phone is" or "our website is" after a redacted coordinate is ALL
 * label — never a substantive project ask.
 */
const CONTACT_LABEL_TOKENS: ReadonlySet<string> = new Set([
  "phone", "email", "number", "cell", "mobile", "address",
  "website", "site", "url", "link",
]);

/** Combined check used by extraction and the display-name formatter. */
export function containsUnsafeContent(raw: string): boolean {
  if (typeof raw !== "string") return true;
  for (const pattern of PROMPT_INJECTION_PATTERNS) if (pattern.test(raw)) return true;
  for (const pattern of SECRET_PATTERNS) if (pattern.test(raw)) return true;
  if (URL_PATTERN.test(raw)) return true;
  if (EMAIL_PATTERN.test(raw)) return true;
  if (PHONE_PATTERN.test(raw)) return true;
  if (HTML_TAG_PATTERN.test(raw)) return true;
  return false;
}

/**
 * Bounded safety-normalization. Percent-encoding and a small set of HTML
 * entities are decoded to a fixed point (max 3 passes, output capped at
 * {@link SAFETY_DECODE_MAX_LEN} chars) so that a hand-crafted
 * `%3Cscript%3E…%3C/script%3E`, `&lt;script&gt;…`, or percent-double-encoded
 * (`%253Cscript%253E`) payload exposes its literal markup / role form to the
 * regular {@link HTML_TAG_PATTERN} / {@link hasRolePrefix} / injection checks.
 * The decoded string is INSPECTION-ONLY — never rendered, never scored,
 * never assembled into a subject line.
 */
const SAFETY_DECODE_MAX_PASSES = 3;
const SAFETY_DECODE_MAX_LEN = 4096;

function decodeForSafetyInspection(raw: string): string {
  let out = raw.length > SAFETY_DECODE_MAX_LEN ? raw.slice(0, SAFETY_DECODE_MAX_LEN) : raw;
  for (let pass = 0; pass < SAFETY_DECODE_MAX_PASSES; pass++) {
    const prev = out;
    out = out.replace(/%[0-9A-Fa-f]{2}/g, (match) => {
      try {
        return decodeURIComponent(match);
      } catch {
        return match;
      }
    });
    out = out
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) && code >= 0 && code < 0x110000
          ? String.fromCodePoint(code)
          : "";
      })
      .replace(/&#(\d+);/g, (_m, dec: string) => {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) && code >= 0 && code < 0x110000
          ? String.fromCodePoint(code)
          : "";
      })
      // `&amp;` MUST decode last — an earlier pass would otherwise rewind
      // already-decoded named/numeric entities into a raw `&lt;` shape.
      .replace(/&amp;/gi, "&");
    if (out.length > SAFETY_DECODE_MAX_LEN) out = out.slice(0, SAFETY_DECODE_MAX_LEN);
    if (out === prev) break;
  }
  return out;
}

/**
 * Turn-level rejection gate. When ANY of the following are present anywhere in
 * a candidate turn's raw OR bounded-decoded text, drop the ENTIRE turn
 * instead of trying to sanitise it clause-by-clause into apparently-safe
 * residue:
 *
 *   - role/speaker prefixes (`system:`, `developer:`, `assistant:`, bracketed
 *     `[developer]`, `(assistant)`, and hidden second-line variants)
 *   - literal or entity-encoded HTML/markup (once decoded, real markup surfaces)
 *   - prompt-injection / jailbreak language
 *   - secret / credential / PII disclosure (keys, tokens, "password is …",
 *     "my password was …", `PIN: 1234`, SSN, street address)
 *   - "predominantly contact data": the turn's substance is a contact
 *     coordinate (phone / email / URL) plus contact-label filler, leaving no
 *     concrete inquiry noun behind after redaction
 *
 * Ordinary mixed input — a real project clause sharing a turn with an email or
 * phone number — is NOT rejected here; the safe clause survives the per-clause
 * pipeline below.
 */
export function isTurnUnsafe(raw: string): boolean {
  if (typeof raw !== "string") return true;
  const text = raw.trim();
  if (!text) return false;
  const decoded = decodeForSafetyInspection(text);
  const forms = decoded === text ? [text] : [text, decoded];
  for (const candidate of forms) {
    if (hasRolePrefix(candidate)) return true;
    if (HTML_TAG_PATTERN.test(candidate)) return true;
    if (ENCODED_HTML_PATTERN.test(candidate)) return true;
    for (const pattern of PROMPT_INJECTION_PATTERNS) if (pattern.test(candidate)) return true;
    for (const pattern of SECRET_PATTERNS) if (pattern.test(candidate)) return true;
    if (CREDENTIAL_DISCLOSURE_PATTERN.test(candidate)) return true;
    if (SSN_PATTERN.test(candidate)) return true;
    if (STREET_ADDRESS_PATTERN.test(candidate)) return true;
  }
  const hasContactCoord =
    URL_PATTERN.test(text) || EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text);
  if (hasContactCoord) {
    let residue = text;
    for (const pattern of REDACT_SPAN_PATTERNS) residue = residue.replace(pattern, " ");
    const residueTokens = residue.toLowerCase().match(/[a-z][a-z0-9]*/g) ?? [];
    const substantiveNouns = residueTokens.filter(
      (token) => SAFE_TOPIC_NOUNS.has(token) && !CONTACT_LABEL_TOKENS.has(token),
    );
    if (substantiveNouns.length === 0) return true;
  }
  return false;
}

/**
 * Contact-coordinate + markup spans, redacted to a single space BEFORE
 * clause splitting so that periods inside a URL / email / decimal contact
 * pattern do not fool the sentence splitter. Prompt-injection and secret
 * strings are NOT redacted — they are treated as an intent signal at the
 * per-clause `containsUnsafeContent` check and drop the clause outright.
 */
const REDACT_SPAN_PATTERNS: RegExp[] = [
  /\bhttps?:\/\/\S+/gi,
  /\bwww\.[a-z0-9-]+\.[a-z]{2,}\b/gi,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}\b/g,
  /\b(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/g,
  /<\s*\/?\s*[a-z][a-z0-9]*\b[^>]*>/gi,
];

function redactUnsafeSpans(text: string): string {
  let out = text;
  for (const pattern of REDACT_SPAN_PATTERNS) out = out.replace(pattern, " ");
  return out;
}

function stripConversationalFiller(raw: string): string {
  let out = raw.trim();
  while (LEADING_CONVERSATIONAL_FILLER.test(out)) {
    out = out.replace(LEADING_CONVERSATIONAL_FILLER, "").trim();
  }
  return out;
}

const CONTROL_AND_HEADER_INJECTION = new RegExp("[\\u0000-\\u001F\\u007F<>]", "g");

function stripControlAndInjection(raw: string): string {
  return raw
    .replace(CONTROL_AND_HEADER_INJECTION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function capitalizeProperNames(raw: string): string {
  let out = raw;
  for (const [pattern, replacement] of PROPER_NAME_MAP) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function sanitizeSubjectFragment(raw: string, maxLen = SUBJECT_TOPIC_MAX): string {
  const cleaned = stripControlAndInjection(raw);
  const cased = capitalizeProperNames(cleaned);
  if (cased.length <= maxLen) return cased;
  const truncated = cased.slice(0, maxLen - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  const head = lastSpace > maxLen * 0.5 ? truncated.slice(0, lastSpace) : truncated;
  return head + "…";
}

/**
 * Bounded display-name formatter. Reliable mixed-case (e.g. "Sam Sample")
 * is preserved as-is; all-lower ("john doe") and all-upper ("JOHN DOE")
 * are title-cased. Unsafe content (URLs, emails, phones, injection) never
 * flows into a display name — the formatter returns null so the caller
 * falls back to the contact value or a neutral greeting.
 */
export function formatDisplayName(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.slice(0, 200);
  // Unsafe check runs on the RAW input so HTML angle brackets and other
  // markup characters are still visible. stripControlAndInjection would
  // otherwise turn "<script>x</script>" into "script x /script" and hide
  // the tag from HTML_TAG_PATTERN.
  if (containsUnsafeContent(trimmed)) return null;
  const cleaned = stripControlAndInjection(trimmed).trim();
  if (!cleaned) return null;
  const hasUpper = /[A-Z]/.test(cleaned);
  const hasLower = /[a-z]/.test(cleaned);
  if (hasUpper && hasLower) return capitalizeProperNames(cleaned);
  const titled = cleaned
    .split(/\s+/)
    .map((token) => {
      if (!token) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
  return capitalizeProperNames(titled);
}

export function isContactIntentFiller(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.split(/\s+/).length < 3) {
    if (NON_SUBSTANTIVE_PATTERNS.some((p) => p.test(trimmed))) return true;
    if (CONTACT_INTENT_PATTERNS.some((p) => p.test(trimmed))) return true;
  }
  for (const pattern of CONTACT_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  for (const pattern of NON_SUBSTANTIVE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function stripContactIntentPrefix(raw: string): string {
  const match = raw.match(CONTACT_INTENT_PREFIX);
  if (!match) return raw;
  const after = raw.slice(match[0].length).trim();
  return after.length >= 6 ? after : raw;
}

/**
 * Split a turn into bounded clauses. Sentence delimiters + commas + newlines,
 * so a comma-separated mixed sentence like
 *   "we need a patio, my email is bad@x.com, call 555-123-4567"
 * yields three clauses; the two unsafe ones are dropped independently while
 * the safe one survives.
 */
function splitClauses(raw: string): string[] {
  return raw
    .split(/[.!?;\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Score a clause on concrete-noun density plus a bounded length component.
 * A clause with zero concrete inquiry nouns is considered non-substantive
 * (score 0) regardless of length — this is what stops the extractor from
 * copying a raw longest turn full of filler.
 */
function scoreClause(clause: string): number {
  const normalized = clause.toLowerCase();
  const tokens = normalized.match(/[a-z][a-z0-9]*/g) ?? [];
  if (tokens.length < 3) return 0;
  let concreteNouns = 0;
  for (const token of tokens) if (SAFE_TOPIC_NOUNS.has(token)) concreteNouns += 1;
  if (concreteNouns === 0) return 0;
  const boundedLen = Math.min(tokens.length, 30);
  return concreteNouns * 10 + boundedLen;
}

export type SelectedTopic = {
  topic: string;
  source: "conversation" | "fallback";
};

export type ConversationProjectSummary = SelectedTopic & {
  /** Concise, sanitized multi-detail recap. Never raw transcript text. */
  summary: string;
  /** Distinct safe project/request details in conversation order. */
  details: string[];
};

function normalizeArticleGrammar(raw: string): string {
  return raw
    .replace(/\b(?:a\s+a|an\s+an|a\s+an|an\s+a)\b/gi, (match, offset: number) => {
      const following = raw.slice(offset + match.length).trim();
      return /^[aeiou]/i.test(following) ? "an" : "a";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function collectSafeClauses(turns: ReadonlyArray<ConversationTurn>): Array<{ text: string; score: number }> {
  const found: Array<{ text: string; score: number }> = [];
  const seen = new Set<string>();
  for (const turn of turns) {
    if (!turn || turn.role !== "user" || typeof turn.text !== "string") continue;
    // Reject the ENTIRE candidate turn when it carries role/instruction
    // markup, secret / credential disclosure, or is predominantly contact
    // data. Sanitising such a turn into "safe" residue is what let the
    // "my phone is 410-555-0199" and role-prefix probes leak through before.
    if (isTurnUnsafe(turn.text)) continue;
    for (const rawClause of splitClauses(redactUnsafeSpans(turn.text))) {
      const cleaned = normalizeArticleGrammar(
        stripConversationalFiller(stripContactIntentPrefix(rawClause)),
      );
      if (!cleaned || isContactIntentFiller(cleaned) || containsUnsafeContent(cleaned)) continue;
      const clauseScore = scoreClause(cleaned);
      if (clauseScore <= 0) continue;
      const normalized = cleaned.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      found.push({ text: sanitizeSubjectFragment(cleaned, 160), score: clauseScore });
    }
  }
  return found;
}

export function summarizeSubstantiveConversation(
  turns: ReadonlyArray<ConversationTurn>,
  maxDetails = 5,
): ConversationProjectSummary {
  const clauses = collectSafeClauses(turns);
  if (!clauses.length) {
    return { topic: FALLBACK_TOPIC, source: "fallback", summary: FALLBACK_TOPIC, details: [] };
  }
  const subject = clauses.reduce((best, candidate) => candidate.score > best.score ? candidate : best);
  const details = clauses.slice(0, Math.max(1, maxDetails)).map((entry) => entry.text);
  return {
    topic: sanitizeSubjectFragment(subject.text),
    source: "conversation",
    summary: sanitizeSubjectFragment(details.join("; "), 500),
    details,
  };
}

/** Defensive rendering boundary for durable/historical summary payloads. */
export function sanitizeProjectSummary(raw: string | null | undefined): string {
  if (!raw?.trim()) return FALLBACK_TOPIC;
  return summarizeSubstantiveConversation([{ role: "user", text: raw }]).summary;
}

export function selectSubstantiveTopic(
  turns: ReadonlyArray<ConversationTurn>,
): SelectedTopic {
  const result = summarizeSubstantiveConversation(turns, 5);
  return { topic: result.topic, source: result.source };
}
