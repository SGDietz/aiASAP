// User timezone by voice (2026-06-11, G: "6 should always be on the time zone
// of the user... maybe 6 asks them, if he does not know... what is your zip
// code. and maybe zip code equivalent, country.")
//
// The LADDER (privacy-minimal, zero-friction first):
//   1. Device clock — the browser sends its IANA zone with every session and
//      reminder automatically. Nobody is ever asked. This covers ~everyone.
//   2. Account memory — a zone the user SET BY VOICE sticks to the account
//      (user_metadata.timezone) and beats the device until they change it.
//   3. Voice fallback — when the user says the time is wrong (or we somehow
//      have nothing): a US ZIP, a US state, a country, or a big city, spoken
//      in one sentence. Parsed here, PURE and testable; no third-party API,
//      no address stored — at most a coarse IANA zone string.
import { US_ZIP3_TO_TZ, COUNTRY_SINGLE_TZ, MULTI_TZ_COUNTRIES } from "./tzData";

/** Dominant IANA zone per US state/territory (split states use the zone most
 *  of their population lives in — a spoken ZIP beats this when it matters). */
export const US_STATE_TO_TZ: Record<string, string> = {
  alabama: "America/Chicago",
  alaska: "America/Anchorage",
  arizona: "America/Phoenix",
  arkansas: "America/Chicago",
  california: "America/Los_Angeles",
  colorado: "America/Denver",
  connecticut: "America/New_York",
  delaware: "America/New_York",
  florida: "America/New_York",
  georgia: "America/New_York",
  hawaii: "Pacific/Honolulu",
  idaho: "America/Boise",
  illinois: "America/Chicago",
  indiana: "America/Indiana/Indianapolis",
  iowa: "America/Chicago",
  kansas: "America/Chicago",
  kentucky: "America/Kentucky/Louisville",
  louisiana: "America/Chicago",
  maine: "America/New_York",
  maryland: "America/New_York",
  massachusetts: "America/New_York",
  michigan: "America/Detroit",
  minnesota: "America/Chicago",
  mississippi: "America/Chicago",
  missouri: "America/Chicago",
  montana: "America/Denver",
  nebraska: "America/Chicago",
  nevada: "America/Los_Angeles",
  "new hampshire": "America/New_York",
  "new jersey": "America/New_York",
  "new mexico": "America/Denver",
  "new york": "America/New_York",
  "north carolina": "America/New_York",
  "north dakota": "America/Chicago",
  ohio: "America/New_York",
  oklahoma: "America/Chicago",
  oregon: "America/Los_Angeles",
  pennsylvania: "America/New_York",
  "rhode island": "America/New_York",
  "south carolina": "America/New_York",
  "south dakota": "America/Chicago",
  tennessee: "America/Chicago",
  texas: "America/Chicago",
  utah: "America/Denver",
  vermont: "America/New_York",
  virginia: "America/New_York",
  washington: "America/Los_Angeles",
  "washington dc": "America/New_York",
  "washington d c": "America/New_York",
  dc: "America/New_York",
  "west virginia": "America/New_York",
  wisconsin: "America/Chicago",
  wyoming: "America/Denver",
  "puerto rico": "America/Puerto_Rico",
  guam: "Pacific/Guam",
};

/** Big cities people actually say for multi-zone countries ("I'm in Toronto"). */
export const CITY_TO_TZ: Record<string, string> = {
  toronto: "America/Toronto",
  ottawa: "America/Toronto",
  montreal: "America/Toronto",
  quebec: "America/Toronto",
  halifax: "America/Halifax",
  winnipeg: "America/Winnipeg",
  calgary: "America/Edmonton",
  edmonton: "America/Edmonton",
  vancouver: "America/Vancouver",
  "mexico city": "America/Mexico_City",
  guadalajara: "America/Mexico_City",
  monterrey: "America/Monterrey",
  tijuana: "America/Tijuana",
  cancun: "America/Cancun",
  "sao paulo": "America/Sao_Paulo",
  "são paulo": "America/Sao_Paulo",
  rio: "America/Sao_Paulo",
  "rio de janeiro": "America/Sao_Paulo",
  brasilia: "America/Sao_Paulo",
  manaus: "America/Manaus",
  sydney: "Australia/Sydney",
  melbourne: "Australia/Melbourne",
  brisbane: "Australia/Brisbane",
  perth: "Australia/Perth",
  adelaide: "Australia/Adelaide",
  canberra: "Australia/Sydney",
  moscow: "Europe/Moscow",
  "saint petersburg": "Europe/Moscow",
  vladivostok: "Asia/Vladivostok",
  jakarta: "Asia/Jakarta",
  bali: "Asia/Makassar",
  santiago: "America/Santiago",
  "buenos aires": "America/Argentina/Buenos_Aires",
  london: "Europe/London",
  paris: "Europe/Paris",
  berlin: "Europe/Berlin",
  madrid: "Europe/Madrid",
  rome: "Europe/Rome",
  tokyo: "Asia/Tokyo",
  seoul: "Asia/Seoul",
  beijing: "Asia/Shanghai",
  shanghai: "Asia/Shanghai",
  "hong kong": "Asia/Hong_Kong",
  mumbai: "Asia/Kolkata",
  delhi: "Asia/Kolkata",
  dubai: "Asia/Dubai",
};

/** Friendly zone names for spoken confirms ("set you to Eastern time"). */
const TZ_HUMAN: Record<string, string> = {
  "America/New_York": "Eastern time",
  "America/Detroit": "Eastern time",
  "America/Indiana/Indianapolis": "Eastern time",
  "America/Kentucky/Louisville": "Eastern time",
  "America/Chicago": "Central time",
  "America/Menominee": "Central time",
  "America/Denver": "Mountain time",
  "America/Boise": "Mountain time",
  "America/Phoenix": "Arizona time",
  "America/Los_Angeles": "Pacific time",
  "America/Anchorage": "Alaska time",
  "Pacific/Honolulu": "Hawaii time",
  "America/Puerto_Rico": "Puerto Rico time",
};

export function humanZoneName(tz: string): string {
  if (TZ_HUMAN[tz]) return TZ_HUMAN[tz];
  const city = tz.split("/").pop() ?? tz;
  return `${city.replace(/_/g, " ")} time`;
}

/** True when `tz` is a zone this runtime can actually format with. */
export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "Wednesday, June 10, 8:55 PM" in the user's zone — for 6's session context. */
export function formatLocalTime(tz: string, now: Date = new Date()): string {
  try {
    return now.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
    });
  } catch {
    return "";
  }
}

/** US ZIP (5 digits) → IANA zone via the 3-digit prefix table. */
export function zipToTimezone(zip: string): string | null {
  const m = zip.match(/^(\d{3})\d{2}$/);
  if (!m) return null;
  return US_ZIP3_TO_TZ[m[1]] ?? null;
}

// ---- Voice patterns (stateless — each fires on its own, no armed gates) ----

/** "my zip code is 21093" / "zip 21093" — the word "zip" is required so a
 *  random 5-digit number can never hijack a turn. */
export const ZIP_GIVE_RE =
  /\bzip(?:\s*code)?(?:\s+is)?[\s:,-]*(\d{5})(?:-\d{4})?\b/i;

/** Spelled/spoken digits after "zip code is": "two one zero nine three". */
const DIGIT_WORDS: Record<string, string> = {
  zero: "0", oh: "0", o: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};
const ZIP_WORDS_RE = /\bzip(?:\s*code)?(?:\s+is)?[\s:,-]*((?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)[\s,-]*){5})\b/i;

/** "the time is wrong" / "wrong time zone" / "that's not my time zone". */
export const TZ_WRONG_RE =
  /\b(?:wrong|not my|isn'?t my|off on the)\s+time(?:\s*zone)?\b|\btime\s*zone\s+is\s+(?:wrong|off|incorrect)\b|\bfix\s+(?:my\s+)?time\s*zone\b|\bset\s+my\s+time\s*zone\b/i;

/** "I'm in Maryland" / "I live in Toronto" / "I'm from Germany". */
const PLACE_RE =
  /\b(?:i(?:'m| am)\s+(?:in|from)|i live in|my country is|my state is)\s+([a-zA-Z .'-]{2,40})/i;

export type SpokenLocation =
  | { kind: "tz"; tz: string; placeName: string }
  | { kind: "multi"; country: string }
  | null;

function cleanPlace(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?]+.*$/, "")
    .replace(/\b(?:right now|now|today|currently|by the way)\b.*$/, "")
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Match a cleaned place name against the state, city, and country tables. */
function lookupPlace(place: string): SpokenLocation {
  if (!place) return null;
  if (US_STATE_TO_TZ[place]) {
    return { kind: "tz", tz: US_STATE_TO_TZ[place], placeName: titleCase(place) };
  }
  if (CITY_TO_TZ[place]) {
    return { kind: "tz", tz: CITY_TO_TZ[place], placeName: titleCase(place) };
  }
  const country = COUNTRY_SINGLE_TZ.find(
    (c) => c.name.toLowerCase() === place || c.aliases.includes(place),
  );
  if (country) {
    return { kind: "tz", tz: country.tz, placeName: country.name };
  }
  if (MULTI_TZ_COUNTRIES.includes(place)) {
    return { kind: "multi", country: titleCase(place) };
  }
  return null;
}

/** The utterance itself talks about time/clocks/zones — makes a place-name
 *  mention purposeful ("I'm in Arizona, fix the time"). */
export const TIME_CONTEXT_RE = /\btime\s*zone\b|\btime\b|\bclock\b|\bzip\b/i;

/**
 * Resolve a spoken utterance to a timezone. Conservative by design:
 * - A ZIP (the word "zip" required) is always purposeful → always fires.
 * - "I'm in X / I live in X / my country is X" fires ONLY when the sentence
 *   also talks about time, or `allowBare` is true (6 just asked — a short
 *   relevance window, NOT an armed gate; non-matching turns flow through).
 *   Without that scope, "I'm from New York originally..." mid-story would
 *   hijack the turn with a time-zone confirm (the round-5 export-hijack
 *   lesson, applied here before it ever shipped broken).
 * - With `allowBare`, a bare table-member answer ("Toronto.") also resolves.
 */
export function resolveSpokenLocation(
  text: string,
  opts: { allowBare?: boolean } = {},
): SpokenLocation {
  const zipDigits = text.match(ZIP_GIVE_RE);
  if (zipDigits) {
    const tz = zipToTimezone(zipDigits[1]);
    if (tz) return { kind: "tz", tz, placeName: `ZIP ${zipDigits[1]}` };
  }
  const zipWords = text.match(ZIP_WORDS_RE);
  if (zipWords) {
    const digits = zipWords[1]
      .toLowerCase()
      .split(/[\s,-]+/)
      .filter(Boolean)
      .map((w) => DIGIT_WORDS[w] ?? "")
      .join("");
    if (digits.length === 5) {
      const tz = zipToTimezone(digits);
      if (tz) return { kind: "tz", tz, placeName: `ZIP ${digits}` };
    }
  }

  const purposeful = opts.allowBare === true || TIME_CONTEXT_RE.test(text);
  if (!purposeful) return null;

  const placeMatch = text.match(PLACE_RE);
  if (placeMatch) {
    const hit = lookupPlace(cleanPlace(placeMatch[1]));
    if (hit) return hit;
  }
  if (opts.allowBare === true) {
    // Short direct answer to 6's question: "21093." / "Toronto." / "Arizona".
    const bareZip = text.trim().match(/^(\d{5})(?:-\d{4})?[.!?]?$/);
    if (bareZip) {
      const tz = zipToTimezone(bareZip[1]);
      if (tz) return { kind: "tz", tz, placeName: `ZIP ${bareZip[1]}` };
    }
    if (text.trim().split(/\s+/).length <= 4) {
      return lookupPlace(cleanPlace(text));
    }
  }
  return null;
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
