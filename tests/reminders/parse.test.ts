// Never Forget reminders — parser suite (2026-06-10). The clock is pinned to
// WEDNESDAY 2026-06-10 14:00 local so weekday math is deterministic.
import { describe, expect, it } from "vitest";
import {
  parseReminder,
  parseTimeOnly,
  REMINDER_LIST_RE,
  REMINDER_TRIGGER_RE,
} from "../../src/lib/reminders/parse";

const NOW = new Date(2026, 5, 10, 14, 0, 0); // Wed Jun 10 2026, 2:00 PM local

describe("parseReminder — the spoken shapes people actually use", () => {
  it("tomorrow with a morning hour", () => {
    const r = parseReminder("Remind me to call the dentist tomorrow at 9", NOW);
    expect(r?.title).toBe("call the dentist");
    expect(r?.dueAt).toEqual(new Date(2026, 5, 11, 9, 0, 0));
    expect(r?.whenSpoken).toBe("tomorrow at 9:00 AM");
  });

  it("tonight defaults to 8 PM", () => {
    const r = parseReminder("remind me to take out the trash tonight", NOW);
    expect(r?.title).toBe("take out the trash");
    expect(r?.dueAt).toEqual(new Date(2026, 5, 10, 20, 0, 0));
  });

  it("month + day (the birthday case) defaults to 9 AM", () => {
    const r = parseReminder(
      "Don't let me forget mom's birthday on June 15",
      NOW,
    );
    expect(r?.title).toBe("mom's birthday");
    expect(r?.dueAt).toEqual(new Date(2026, 5, 15, 9, 0, 0));
  });

  it("relative minutes", () => {
    const r = parseReminder("remind me to check the oven in 20 minutes", NOW);
    expect(r?.title).toBe("check the oven");
    expect(r?.dueAt).toEqual(new Date(2026, 5, 10, 14, 20, 0));
  });

  it("'in an hour' + trailing task keeps a clean title", () => {
    const r = parseReminder("remind me in an hour to flip the laundry", NOW);
    expect(r?.title).toBe("flip the laundry");
    expect(r?.dueAt).toEqual(new Date(2026, 5, 10, 15, 0, 0));
  });

  it("weekday + bare small hour reads as afternoon", () => {
    const r = parseReminder(
      "set a reminder to pay the water bill on Friday at 5",
      NOW,
    );
    expect(r?.title).toBe("pay the water bill");
    expect(r?.dueAt).toEqual(new Date(2026, 5, 12, 17, 0, 0));
    expect(r?.whenSpoken).toBe("Friday at 5:00 PM");
  });

  it("a weekday whose time already passed rolls to next week", () => {
    // Wednesday 9 AM is already past at Wed 2 PM → next Wednesday.
    const r = parseReminder("remind me to water plants Wednesday at 9", NOW);
    expect(r?.dueAt).toEqual(new Date(2026, 5, 17, 9, 0, 0));
  });

  it("no time spoken → dueAt null so 6 asks", () => {
    const r = parseReminder("remind me to stretch", NOW);
    expect(r?.title).toBe("stretch");
    expect(r?.dueAt).toBe(null);
    expect(r?.whenSpoken).toBe(null);
  });

  it("non-reminder speech returns null", () => {
    expect(parseReminder("what's the weather like", NOW)).toBe(null);
  });

  it("a bare clock with a past hour rolls to tomorrow", () => {
    const r = parseReminder("remind me to stand up at 8 am", NOW);
    expect(r?.dueAt).toEqual(new Date(2026, 5, 11, 8, 0, 0)); // 8 AM passed
    expect(r?.whenSpoken).toBe("tomorrow at 8:00 AM");
  });
});

describe("negation + email-me triggers (G's 2026-06-11 session)", () => {
  it("G's verbatim negation does NOT create a reminder", () => {
    expect(
      parseReminder(
        "No, you're not going to remind me. You're going to send an email",
        NOW,
      ),
    ).toBe(null);
    expect(parseReminder("don't remind me about that", NOW)).toBe(null);
    expect(parseReminder("you won't remind me, will you", NOW)).toBe(null);
  });

  it("coaching 6's own send lines does NOT create a reminder", () => {
    expect(
      parseReminder(
        "You're going to say, do you want me to send an email in 5 minutes?",
        NOW,
      ),
    ).toBe(null);
    expect(
      parseReminder("I will send you an email at 9:50 PM Eastern", NOW),
    ).toBe(null);
  });

  it("'email me at 9:50 PM to take out the trash' IS a reminder", () => {
    const r = parseReminder("email me at 9:50 PM to take out the trash", NOW);
    expect(r?.title).toBe("take out the trash");
    expect(r?.dueAt).toEqual(new Date(2026, 5, 10, 21, 50, 0));
  });

  it("'send me an email tomorrow at 9 to call Bob' IS a reminder", () => {
    const r = parseReminder("can you send me an email tomorrow at 9 to call Bob", NOW);
    expect(r?.title).toBe("call Bob");
    expect(r?.dueAt).toEqual(new Date(2026, 5, 11, 9, 0, 0));
  });

  it("'email me your pricing' (no time) is NOT a reminder", () => {
    expect(parseReminder("email me your pricing", NOW)).toBe(null);
  });
});

describe("recall + trigger patterns", () => {
  it("list asks are recall, not creation", () => {
    expect(REMINDER_LIST_RE.test("show me my reminders")).toBe(true);
    expect(REMINDER_LIST_RE.test("what reminders do I have")).toBe(true);
    expect(REMINDER_TRIGGER_RE.test("show me my reminders")).toBe(false);
  });
});

describe("parseTimeOnly — the bare answer after 'When should I remind you?'", () => {
  it("G's verbatim 2026-06-11 reply that never merged", () => {
    const r = parseTimeOnly("So yeah, 9 AM tomorrow.", NOW);
    expect(r?.dueAt).toEqual(new Date(2026, 5, 11, 9, 0, 0));
    expect(r?.whenSpoken).toBe("tomorrow at 9:00 AM");
  });

  it("'tomorrow at 9' (at-form)", () => {
    const r = parseTimeOnly("tomorrow at 9", NOW);
    expect(r?.dueAt).toEqual(new Date(2026, 5, 11, 9, 0, 0));
  });

  it("bare evening clock with filler", () => {
    const r = parseTimeOnly("uh, let's say 5:30 pm", NOW);
    expect(r?.dueAt).toEqual(new Date(2026, 5, 10, 17, 30, 0));
  });

  it("'tonight'", () => {
    const r = parseTimeOnly("tonight", NOW);
    expect(r?.dueAt).toEqual(new Date(2026, 5, 10, 20, 0, 0));
  });

  it("'in 2 hours'", () => {
    const r = parseTimeOnly("in 2 hours", NOW);
    expect(r?.dueAt).toEqual(new Date(2026, 5, 10, 16, 0, 0));
  });

  it("'Friday at noon'", () => {
    const r = parseTimeOnly("Friday at noon", NOW);
    expect(r?.dueAt).toEqual(new Date(2026, 5, 12, 12, 0, 0));
  });

  it("'in the morning' becomes tomorrow 9 AM when 9 already passed", () => {
    const r = parseTimeOnly("in the morning", NOW); // it's 2 PM
    expect(r?.dueAt).toEqual(new Date(2026, 5, 11, 9, 0, 0));
  });

  it("a sentence that merely contains a time word does NOT fire", () => {
    expect(parseTimeOnly("Tomorrow I'm going to the store", NOW)).toBe(null);
  });

  it("ordinary replies do NOT fire", () => {
    expect(parseTimeOnly("That's awesome.", NOW)).toBe(null);
    expect(parseTimeOnly("Make them smaller.", NOW)).toBe(null);
    expect(parseTimeOnly("Yes.", NOW)).toBe(null);
  });

  it("a full 'remind me to...' is NOT a time-only answer", () => {
    expect(
      parseTimeOnly("remind me to call Bob tomorrow at 9", NOW),
    ).toBe(null);
  });
});

// G 2026-06-14: "they will be reminded every day until they stop it."
describe("daily recurring reminders", () => {
  it("G's trash phrasing repeats daily and keeps a clean title", () => {
    const r = parseReminder("remind me to take the trash out every day at 10am", NOW);
    expect(r?.title).toBe("take the trash out");
    expect(r?.recurrence).toBe("daily");
    expect(r?.dueAt).toEqual(new Date(2026, 5, 11, 10, 0, 0));
    expect(r?.whenSpoken).toBe("every day at 10:00 AM");
  });

  it("morning/night daily phrasing works without an explicit clock", () => {
    const morning = parseReminder("remind me to take vitamins every morning", NOW);
    expect(morning?.title).toBe("take vitamins");
    expect(morning?.recurrence).toBe("daily");
    expect(morning?.dueAt).toEqual(new Date(2026, 5, 11, 9, 0, 0));
    expect(morning?.whenSpoken).toBe("every morning at 9:00 AM");

    const night = parseReminder("remind me to lock the door each night", NOW);
    expect(night?.title).toBe("lock the door");
    expect(night?.recurrence).toBe("daily");
    expect(night?.dueAt).toEqual(new Date(2026, 5, 10, 20, 0, 0));
    expect(night?.whenSpoken).toBe("every night at 8:00 PM");
  });

  it("one-shot reminders keep recurrence null", () => {
    const r = parseReminder("remind me to call Bob tomorrow at 9", NOW);
    expect(r?.recurrence).toBe(null);
  });
});
