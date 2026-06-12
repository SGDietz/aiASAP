// Languages switchboard (2026-06-10) — M1.6 parity pulled from the iSolve
// build per the 2.1 lock. LiveAvatar is the mouth and ears; THIS is the
// switchboard: resolve which language the session should run in, hand
// LiveAvatar the code it expects (avatar_persona.language), and hand the
// brain a plain-English name for its "respond in {language}" directive.
//
// aiASAP is URL/verbal-driven — NO language button (2.1 lock). The URL form
// is aiasap.ai/?lang=es (G can share per-language links). Signed-in users
// keep their last explicit choice in auth user_metadata.preferred_locale.

export const SUPPORTED_LOCALES = ["en", "es", "fr", "pt", "de", "zh"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "en";

const LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

// Friendly spellings people actually type/say in a URL or out loud.
const NAME_TO_LOCALE: Record<string, SupportedLocale> = {
  english: "en",
  spanish: "es",
  espanol: "es",
  french: "fr",
  francais: "fr",
  portuguese: "pt",
  portugues: "pt",
  german: "de",
  deutsch: "de",
  chinese: "zh",
  mandarin: "zh",
};

/**
 * Parse a requested language from a URL param / spoken form into a
 * supported locale. Accepts primary subtags ("es"), region tags
 * ("es-MX" → "es"), and friendly names ("spanish"). Null when the
 * request is absent or unsupported — callers fall through to the next
 * source, never guess.
 */
export function parseRequestedLocale(
  raw: string | null | undefined,
): SupportedLocale | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned || cleaned.length > 40) return null;
  const primary = cleaned.split(/[-_]/)[0];
  if (LOCALE_SET.has(primary)) return primary as SupportedLocale;
  // Fold accents so "español" / "français" match their plain spellings.
  const folded = cleaned
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  const named = NAME_TO_LOCALE[folded];
  return named ?? null;
}

/** First supported tag in an Accept-Language header, or null. */
export function pickFromAcceptLanguage(
  header: string | null | undefined,
): SupportedLocale | null {
  if (!header) return null;
  const tags = header
    .split(",")
    .map((piece) => piece.split(";")[0].trim().toLowerCase())
    .filter(Boolean);
  for (const tag of tags) {
    const primary = tag.split("-")[0];
    if (LOCALE_SET.has(primary)) return primary as SupportedLocale;
  }
  return null;
}

/**
 * LiveAvatar rejects IETF region tags ("en-US") with code 4000 on this
 * plan; it accepts primary subtags — same finding as the iSolve build.
 */
const LOCALE_TO_LIVEAVATAR: Record<SupportedLocale, string> = {
  en: "en",
  es: "es",
  fr: "fr",
  pt: "pt",
  de: "de",
  zh: "zh",
};

/**
 * LiveAvatar language code for a resolved locale, falling back to the
 * LIVEAVATAR_LANGUAGE env (legacy behavior) when no locale resolved.
 */
export function mapLocaleToAvatarLanguage(
  locale: SupportedLocale | null,
  envFallback: string,
): string {
  if (locale) return LOCALE_TO_LIVEAVATAR[locale];
  return envFallback.trim();
}

/** Plain-English language name for the brain's response directive. */
const LOCALE_TO_NAME: Record<SupportedLocale, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  zh: "Chinese (Simplified)",
};

export function localeLanguageName(locale: SupportedLocale | null): string {
  return locale ? LOCALE_TO_NAME[locale] : LOCALE_TO_NAME[DEFAULT_LOCALE];
}
