// Spoken phone capture (2026-06-10, SMS reminders).
import { describe, expect, it } from "vitest";
import {
  fmtPhoneSpoken,
  parseSpokenPhone,
  PHONE_GIVE_RE,
  SMS_OPT_IN_RE,
} from "../../src/lib/reminders/phone";

describe("parseSpokenPhone", () => {
  it("plain digits with separators", () => {
    expect(parseSpokenPhone("my number is 410-555-1234")).toBe("+14105551234");
    expect(parseSpokenPhone("it's (410) 555.1234")).toBe("+14105551234");
  });
  it("spoken digit words", () => {
    expect(
      parseSpokenPhone(
        "my number is four one zero five five five one two three four",
      ),
    ).toBe("+14105551234");
  });
  it("11 digits with leading 1", () => {
    expect(parseSpokenPhone("1 410 555 1234")).toBe("+14105551234");
  });
  it("no clean number → null (never guess)", () => {
    expect(parseSpokenPhone("text me my reminders")).toBe(null);
    expect(parseSpokenPhone("my number is 555 12")).toBe(null);
  });
  it("formats for speech", () => {
    expect(fmtPhoneSpoken("+14105551234")).toBe("410-555-1234");
  });
});

describe("triggers", () => {
  it("opt-in phrases", () => {
    expect(SMS_OPT_IN_RE.test("text me my reminders")).toBe(true);
    expect(SMS_OPT_IN_RE.test("send it by text")).toBe(true);
    expect(SMS_OPT_IN_RE.test("remind me to call Bob")).toBe(false);
  });
  it("the coached follow-up stands alone", () => {
    expect(PHONE_GIVE_RE.test("my number is 410 555 1234")).toBe(true);
    expect(PHONE_GIVE_RE.test("my cell number is 410 555 1234")).toBe(true);
  });
});
