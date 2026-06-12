// Languages switchboard tests (2026-06-10). The switchboard resolves WHICH
// language a session runs in; LiveAvatar is just the mouth and ears.
import { describe, expect, it } from "vitest";
import {
  localeLanguageName,
  mapLocaleToAvatarLanguage,
  parseRequestedLocale,
  pickFromAcceptLanguage,
} from "../../src/lib/i18n/avatarLanguage";

describe("parseRequestedLocale — URL/spoken forms", () => {
  it("accepts primary subtags", () => {
    expect(parseRequestedLocale("es")).toBe("es");
    expect(parseRequestedLocale("ZH")).toBe("zh");
  });
  it("strips region tags", () => {
    expect(parseRequestedLocale("es-MX")).toBe("es");
    expect(parseRequestedLocale("pt_BR")).toBe("pt");
  });
  it("accepts friendly names", () => {
    expect(parseRequestedLocale("spanish")).toBe("es");
    expect(parseRequestedLocale("Español")).toBe("es");
    expect(parseRequestedLocale("Deutsch")).toBe("de");
    expect(parseRequestedLocale("mandarin")).toBe("zh");
  });
  it("rejects unsupported / junk", () => {
    expect(parseRequestedLocale("klingon")).toBe(null);
    expect(parseRequestedLocale("")).toBe(null);
    expect(parseRequestedLocale(null)).toBe(null);
    expect(parseRequestedLocale("ja")).toBe(null);
  });
});

describe("pickFromAcceptLanguage — browser fallback", () => {
  it("first supported tag wins", () => {
    expect(pickFromAcceptLanguage("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
    expect(pickFromAcceptLanguage("ja,fr;q=0.7")).toBe("fr");
  });
  it("null when nothing matches", () => {
    expect(pickFromAcceptLanguage("ja,ko;q=0.9")).toBe(null);
    expect(pickFromAcceptLanguage(null)).toBe(null);
  });
});

describe("mapLocaleToAvatarLanguage — LiveAvatar gets primary subtags only", () => {
  it("maps locales straight through", () => {
    expect(mapLocaleToAvatarLanguage("es", "en")).toBe("es");
  });
  it("falls back to the env value (legacy sessions unchanged)", () => {
    expect(mapLocaleToAvatarLanguage(null, "en")).toBe("en");
    expect(mapLocaleToAvatarLanguage(null, "  en  ")).toBe("en");
    expect(mapLocaleToAvatarLanguage(null, "")).toBe("");
  });
});

describe("localeLanguageName — the brain directive value", () => {
  it("names every supported locale, English by default", () => {
    expect(localeLanguageName("es")).toBe("Spanish");
    expect(localeLanguageName("zh")).toBe("Chinese (Simplified)");
    expect(localeLanguageName(null)).toBe("English");
  });
});
