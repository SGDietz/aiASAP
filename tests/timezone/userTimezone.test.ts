// Timezone-by-voice suite (2026-06-11, G: "6 should always be on the time
// zone of the user"). The hijack tests matter most: place names in ordinary
// conversation must NEVER claim the turn.
import { describe, expect, it } from "vitest";
import {
  extractSpokenZip,
  formatLocalTime,
  humanZoneName,
  isValidTimezone,
  resolveSpokenLocation,
  TZ_WRONG_RE,
  zipToTimezone,
} from "../../src/lib/timezone/userTimezone";

describe("zipToTimezone — the prefix table", () => {
  it("Maryland 21093 is Eastern", () => {
    expect(zipToTimezone("21093")).toBe("America/New_York");
  });
  it("Chicago 60601 is Central", () => {
    expect(zipToTimezone("60601")).toBe("America/Chicago");
  });
  it("Denver 80202 is Mountain", () => {
    expect(zipToTimezone("80202")).toBe("America/Denver");
  });
  it("Phoenix 85001 is Arizona (no DST)", () => {
    expect(zipToTimezone("85001")).toBe("America/Phoenix");
  });
  it("Los Angeles 90001 is Pacific", () => {
    expect(zipToTimezone("90001")).toBe("America/Los_Angeles");
  });
  it("El Paso 79901 is Mountain — the Texas exception", () => {
    expect(zipToTimezone("79901")).toBe("America/Denver");
  });
  it("Pensacola 32501 is Central — the Florida panhandle exception", () => {
    expect(zipToTimezone("32501")).toBe("America/Chicago");
  });
  it("Nashville 37201 is Central; Knoxville 37901 is Eastern", () => {
    expect(zipToTimezone("37201")).toBe("America/Chicago");
    expect(zipToTimezone("37901")).toBe("America/New_York");
  });
  it("Honolulu 96813", () => {
    expect(zipToTimezone("96813")).toBe("Pacific/Honolulu");
  });
  it("Anchorage 99501", () => {
    expect(zipToTimezone("99501")).toBe("America/Anchorage");
  });
  it("junk input returns null", () => {
    expect(zipToTimezone("123")).toBe(null);
    expect(zipToTimezone("abcde")).toBe(null);
    expect(zipToTimezone("00000")).toBe(null);
  });
});

describe("resolveSpokenLocation — purposeful speech only", () => {
  it("zip sentence always fires", () => {
    const r = resolveSpokenLocation("My zip code is 21093.");
    expect(r).toEqual({ kind: "tz", tz: "America/New_York", placeName: "ZIP 21093" });
  });
  it("spoken-word zip digits fire", () => {
    const r = resolveSpokenLocation("zip code is two one zero nine three");
    expect(r?.kind).toBe("tz");
    expect(r && "tz" in r && r.tz).toBe("America/New_York");
  });
  it("place + time context fires", () => {
    const r = resolveSpokenLocation("I'm in Arizona, fix the time");
    expect(r && "tz" in r && r.tz).toBe("America/Phoenix");
  });
  it("HIJACK GUARD: a place mid-story does NOT fire", () => {
    expect(resolveSpokenLocation("I'm from New York originally but moved here")).toBe(null);
    expect(resolveSpokenLocation("I live in Maryland and I love it")).toBe(null);
    expect(resolveSpokenLocation("I'm in trouble")).toBe(null);
    expect(resolveSpokenLocation("I'm in the middle of something")).toBe(null);
  });
  it("bare answers fire ONLY inside the asked window", () => {
    expect(resolveSpokenLocation("21093.", { allowBare: true })?.kind).toBe("tz");
    expect(resolveSpokenLocation("21093.")).toBe(null);
    expect(resolveSpokenLocation("Toronto.", { allowBare: true })).toEqual({
      kind: "tz",
      tz: "America/Toronto",
      placeName: "Toronto",
    });
    expect(resolveSpokenLocation("Toronto.")).toBe(null);
  });
  it("bare window still ignores ordinary replies", () => {
    expect(resolveSpokenLocation("That's awesome.", { allowBare: true })).toBe(null);
    expect(resolveSpokenLocation("Make them smaller.", { allowBare: true })).toBe(null);
  });
  it("single-zone country resolves; multi-zone country asks for a city", () => {
    const de = resolveSpokenLocation("I'm in Germany, what time is it");
    expect(de && "tz" in de && de.tz).toBe("Europe/Berlin");
    const ca = resolveSpokenLocation("I'm in Canada, my time zone is wrong");
    expect(ca?.kind).toBe("multi");
  });
});

describe("TZ_WRONG_RE — the complaint trigger", () => {
  it("matches the natural complaints", () => {
    expect(TZ_WRONG_RE.test("that's the wrong time zone")).toBe(true);
    expect(TZ_WRONG_RE.test("my time zone is wrong")).toBe(true);
    expect(TZ_WRONG_RE.test("set my time zone")).toBe(true);
  });
  it("ignores ordinary time talk", () => {
    expect(TZ_WRONG_RE.test("what time is it")).toBe(false);
    expect(TZ_WRONG_RE.test("remind me at 9")).toBe(false);
  });
});

describe("formatting helpers", () => {
  it("formats local time in the given zone", () => {
    const s = formatLocalTime("America/New_York", new Date("2026-06-11T13:00:00Z"));
    expect(s).toContain("June 11");
    expect(s).toContain("9:00 AM");
  });
  it("human zone names", () => {
    expect(humanZoneName("America/New_York")).toBe("Eastern time");
    expect(humanZoneName("America/Phoenix")).toBe("Arizona time");
    expect(humanZoneName("Europe/Berlin")).toBe("Berlin time");
  });
  it("isValidTimezone accepts IANA, rejects junk", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(isValidTimezone(42)).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
});

describe("extractSpokenZip — doubled/garbled ASR repair", () => {
  it("clean 5-digit passes through", () => {
    expect(extractSpokenZip("21093")).toBe("21093");
    expect(extractSpokenZip("my zip is 21093")).toBe("21093");
    expect(extractSpokenZip("60601")).toBe("60601");
  });
  it("collapses exact doubling", () => {
    expect(extractSpokenZip("21093 21093")).toBe("21093");
    expect(extractSpokenZip("2109321093")).toBe("21093");
    expect(extractSpokenZip("60601 60601")).toBe("60601");
  });
  it("pulls the ZIP out of dash-garbled doubling", () => {
    expect(extractSpokenZip("210-93-210-93")).toBe("21093");
  });
  it("six digits: trailing five is the real ZIP", () => {
    expect(extractSpokenZip("321093")).toBe("21093");
  });
  it("longer noise: first valid window", () => {
    expect(extractSpokenZip("210932109")).toBe("21093");
  });
  it("ignores embedded noise around a real ZIP", () => {
    expect(extractSpokenZip("it's 21093 thanks")).toBe("21093");
  });
  it("genuinely-bad input returns null (coach still fires)", () => {
    expect(extractSpokenZip("1093")).toBe(null);
    expect(extractSpokenZip("123")).toBe(null);
    expect(extractSpokenZip("")).toBe(null);
    expect(extractSpokenZip("abc")).toBe(null);
    expect(extractSpokenZip("my name is Bob")).toBe(null);
  });
});

describe("resolveSpokenLocation — garbled ZIP give path", () => {
  it("'zip' + doubled digits resolves", () => {
    expect(resolveSpokenLocation("my zip is 2109321093")).toEqual({
      kind: "tz",
      tz: "America/New_York",
      placeName: "ZIP 21093",
    });
    expect(resolveSpokenLocation("zip 321093")?.kind).toBe("tz");
  });
  it("bare window + garbled digits resolves; clean answer unchanged", () => {
    expect(resolveSpokenLocation("210-93-210-93", { allowBare: true })).toEqual({
      kind: "tz",
      tz: "America/New_York",
      placeName: "ZIP 21093",
    });
    expect(resolveSpokenLocation("21093.", { allowBare: true })?.kind).toBe("tz");
  });
  it("NO hijack: garbled digits without 'zip' and outside the window stay null", () => {
    expect(resolveSpokenLocation("2109321093")).toBe(null);
    expect(resolveSpokenLocation("321093")).toBe(null);
  });
});
