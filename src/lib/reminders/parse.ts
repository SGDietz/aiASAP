// Never Forget reminders — voice capture parser (2026-06-10, G's night order:
// "First, the reminders... don't forget a birthday... all you gotta do is talk
// to six"). PURE and conservative: extract WHAT to remember and WHEN from one
// spoken utterance. If the time isn't clear we return dueAt null and let 6 ask
// — we never guess a date (same never-guess principle as the email capture).
// `now` is injected so the harness can pin the clock.

export const REMINDER_TRIGGER_RE =
  /\b(?:remind me|set (?:a |up a )?reminder|don'?t let me forget|help me remember|remember (?:for me )?to\b)/i;

// NEGATED trigger (2026-06-11): "No, you're NOT going to remind me. You're
// going to send an email..." matched `remind me` inside the negation and
// saved a junk reminder titled ". You're going to send an email" due the next
// day. Talking ABOUT not-reminding is never a reminder ask.
const REMINDER_NEGATION_RE =
  /\b(?:not|never|won'?t|wouldn'?t|can'?t|cannot|don'?t|do not|stop)\s+(?:going\s+to\s+|gonna\s+|need\s+to\s+|have\s+to\s+)?remind/i;

// "Email me / text me / send me an email at 9" is a reminder ask in plain
// clothes (2026-06-11, G's natural phrasing that fell to the brain and got a
// ghost promise). Requires ME right after the verb so coaching 6's own lines
// ("you're going to send an email", "want me to send an email?") never fires.
const EMAIL_ME_TRIGGER_RE =
  /\b(?:email me|text me|send me (?:an? )?(?:email|text|message|reminder)|shoot me (?:an? )?(?:email|text))\b/i;

/** "show/what are my reminders" — recall, not creation. */
export const REMINDER_LIST_RE =
  /\b(?:show|what(?:'s| are| is)?|list|see|open|pull up|read)\b[^.?!]{0,30}\breminders?\b|\breminders?\b[^.?!]{0,20}\b(?:do i have|list|show)\b/i;

export const REMINDER_DONE_RE =
  /\b(?:done with|finished|completed?|did|cancel|delete|remove|clear)\b[^.?!]{0,40}\breminder\b|\breminder\b[^.?!]{0,30}\b(?:done|finished|cancel(?:led)?|delete|remove)\b/i;

export type ReminderRecurrence = "daily";

export type ParsedReminder = {
  /** Cleaned task text, e.g. "call the dentist". Empty string = unparseable. */
  title: string;
  /** Local-time due date, or null when no clear time was spoken. */
  dueAt: Date | null;
  /** Human echo of the time phrase we understood ("tomorrow at 9 AM"). */
  whenSpoken: string | null;
  /** The channel the user EXPLICITLY asked for ("send me an email saying...").
   * Anonymous users who ask for email/text need the honest coaching line —
   * 6 promised G an email on 2026-06-11 that could never send. */
  askedChannel: "email" | "sms" | null;
  /** Repeat rule (G 2026-06-14: "every day until they stop it"). v1 = daily;
   * null = one-shot. */
  recurrence: ReminderRecurrence | null;
};

function detectAskedChannel(text: string): "email" | "sms" | null {
  if (/\b(?:text me|send me (?:a )?(?:text|message)|shoot me a text)\b/i.test(text)) return "sms";
  if (/\b(?:email me|send me (?:an? )?email|shoot me (?:an? )?email)\b/i.test(text)) return "email";
  return null;
}

// Daily recurrence (G 2026-06-14: "they will be reminded every day until they
// stop it"). v1 = daily only. A day-part word ("every morning") also sets a
// default clock so a no-time daily ask still fires.
type RecurrenceDetection = {
  recurrence: ReminderRecurrence | null;
  matched: string[];
  daypart: "morning" | "afternoon" | "evening" | "night" | null;
};

const NO_RECURRENCE: RecurrenceDetection = {
  recurrence: null,
  matched: [],
  daypart: null,
};

const DAILY_RECURRENCE_RE =
  /\b(?:every(?:\s+single)?\s+day|each\s+day|daily|every\s+morning|each\s+morning|every\s+afternoon|each\s+afternoon|every\s+evening|each\s+evening|every\s+night|each\s+night)\b/i;

function detectReminderRecurrence(text: string): RecurrenceDetection {
  const m = text.match(DAILY_RECURRENCE_RE);
  if (!m) return NO_RECURRENCE;
  const phrase = m[0];
  const lower = phrase.toLowerCase();
  const daypart = lower.includes("morning")
    ? "morning"
    : lower.includes("afternoon")
      ? "afternoon"
      : lower.includes("evening")
        ? "evening"
        : lower.includes("night")
          ? "night"
          : null;
  return { recurrence: "daily", matched: [phrase], daypart };
}

function defaultDailyDaypartClock(
  daypart: RecurrenceDetection["daypart"],
): { h: number; m: number; spoken: string } | null {
  if (daypart === "morning") return { h: 9, m: 0, spoken: "9:00 AM" };
  if (daypart === "afternoon") return { h: 15, m: 0, spoken: "3:00 PM" };
  if (daypart === "evening") return { h: 18, m: 0, spoken: "6:00 PM" };
  if (daypart === "night") return { h: 20, m: 0, spoken: "8:00 PM" };
  return null;
}

function recurrenceWhenSpoken(
  whenSpoken: string | null,
  recurrence: RecurrenceDetection,
): string | null {
  if (recurrence.recurrence !== "daily" || !whenSpoken) return whenSpoken;
  if (/^every\b/i.test(whenSpoken)) return whenSpoken;
  return whenSpoken.replace(/^(?:today|tomorrow) at /i, "every day at ");
}

// r18 (G's 12:48 session): "send me an email SAYING don't forget about 4th of
// July" saved the title "I need the reminder this morning. I need you to
// saying don't forget about 4th of July". The MESSAGE is what follows the
// saying-clause; everything before it is plumbing. And the delivery already
// opens with "Don't forget:" — a leading "don't forget about" in the title
// would read double.
const SAYING_CLAUSE_RE = /\b(?:saying|that says|to say|that tells? me|telling me)\b[\s,:]*/i;
const TITLE_LEAD_JUNK_RE =
  /^[\s,]*(?:i need you to|i want you to|i need (?:a |the )?reminder|you need to|you should)\b[\s,]*/i;
const TITLE_DONT_FORGET_RE = /^[\s,]*(?:don'?t forget|remember)\b[\s,]*(?:about|to)?\b[\s,]*/i;

function polishTitle(raw: string): string {
  let title = raw;
  const say = title.match(SAYING_CLAUSE_RE);
  if (say && say.index !== undefined) {
    title = title.slice(say.index + say[0].length);
  } else {
    for (;;) {
      const next = title.replace(TITLE_LEAD_JUNK_RE, "");
      if (next === title) break;
      title = next;
    }
  }
  title = title.replace(TITLE_DONT_FORGET_RE, "");
  title = title
    .replace(/[\s,]+/g, " ")
    .replace(/[.?!]+\s*$/g, "")
    .trim();
  // r32 (G live 2026-06-12 20:53: "I want you to remind me of something"
  // saved a junk card titled "something - whenever"): a placeholder is not a
  // task — empty title makes 6 ASK what to remind instead of saving fog.
  if (
    /^(?:of\s+)?(?:something|anything|stuff|things?|this|that|it)$/i.test(
      title,
    )
  ) {
    return "";
  }
  return title;
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, "forty-five": 45,
  fortyfive: 45, sixty: 60, "an": 1, "a": 1, half: 0.5,
};

function numFrom(tok: string): number | null {
  const n = Number(tok);
  if (Number.isFinite(n) && n > 0) return n;
  const w = NUM_WORDS[tok.toLowerCase()];
  return w !== undefined ? w : null;
}

/** Parse "at 5", "at 5:30", "at 5 pm", "at noon", "at midnight" → [h, m] 24h. */
function parseClock(text: string): { h: number; m: number; spoken: string } | null {
  if (/\bat\s+noon\b/i.test(text)) return { h: 12, m: 0, spoken: "noon" };
  if (/\bat\s+midnight\b/i.test(text)) return { h: 0, m: 0, spoken: "midnight" };
  const m = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|o'?clock)?\b/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (h < 1 || h > 23 || min > 59) return null;
  const suffix = (m[3] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (suffix.startsWith("p") && h < 12) h += 12;
  if (suffix.startsWith("a") && h === 12) h = 0;
  // Bare "at 5" with no am/pm: daytime assumption — 1-7 means afternoon/evening
  // (people rarely set 1-7 AM reminders by voice), 8-11 stays morning.
  if (!suffix.startsWith("a") && !suffix.startsWith("p") && h >= 1 && h <= 7) {
    h += 12;
  }
  const spoken = `${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  return { h, m: min, spoken };
}

function at(base: Date, h: number, m: number): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Extract WHEN from the utterance. Returns the due date, the matched time
 * phrase (so it can be stripped from the title), and a human echo.
 */
function parseWhen(
  text: string,
  now: Date,
  recurrence: RecurrenceDetection = NO_RECURRENCE,
): { dueAt: Date | null; matched: string[]; whenSpoken: string | null } {
  const matched: string[] = [];
  const clock = parseClock(text);
  if (clock) matched.push(text.match(/\bat\s+[^\s,.]+(?:\s*(?:a\.?m\.?|p\.?m\.?|o'?clock))?/i)?.[0] ?? "");

  // "every morning" / "each night" are real daily reminders even without an
  // explicit clock — give them a sensible default time.
  if (recurrence.recurrence === "daily" && recurrence.daypart) {
    const daypartClock = clock ?? defaultDailyDaypartClock(recurrence.daypart);
    if (daypartClock) {
      matched.push(...recurrence.matched);
      let dueAt = at(now, daypartClock.h, daypartClock.m);
      if (dueAt <= now) dueAt = at(addDays(now, 1), daypartClock.h, daypartClock.m);
      return {
        dueAt,
        matched,
        whenSpoken: `every ${recurrence.daypart} at ${daypartClock.spoken}`,
      };
    }
  }

  // "in 20 minutes / in two hours / in 3 days / in half an hour"
  const rel = text.match(
    /\bin\s+(half an hour|an hour|a minute|[\w-]+)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)?\b/i,
  );
  if (rel) {
    let qty: number | null;
    let unit: string;
    if (/half an hour/i.test(rel[1])) {
      qty = 30; unit = "minute";
    } else if (/an hour/i.test(rel[1])) {
      qty = 1; unit = "hour";
    } else if (/a minute/i.test(rel[1])) {
      qty = 1; unit = "minute";
    } else {
      qty = numFrom(rel[1]);
      unit = (rel[2] ?? "").toLowerCase();
    }
    if (qty !== null && unit) {
      const ms =
        unit.startsWith("min") ? qty * 60_000 :
        unit.startsWith("hour") || unit.startsWith("hr") ? qty * 3_600_000 :
        unit.startsWith("day") ? qty * 86_400_000 :
        unit.startsWith("week") ? qty * 7 * 86_400_000 : 0;
      if (ms > 0) {
        matched.push(rel[0]);
        const dueAt = new Date(now.getTime() + ms);
        return { dueAt, matched, whenSpoken: rel[0].replace(/^\s*in\s*/i, "in ") };
      }
    }
  }

  // tonight / today / tomorrow (+ optional clock)
  if (/\btonight\b/i.test(text)) {
    matched.push("tonight");
    const base = clock ? at(now, clock.h, clock.m) : at(now, 20, 0);
    const dueAt = base > now ? base : at(now, 20, 0);
    return { dueAt, matched, whenSpoken: clock ? `tonight at ${clock.spoken}` : "tonight at 8:00 PM" };
  }
  if (/\btomorrow\b/i.test(text)) {
    matched.push("tomorrow");
    const base = addDays(now, 1);
    const dueAt = clock ? at(base, clock.h, clock.m) : at(base, 9, 0);
    return { dueAt, matched, whenSpoken: clock ? `tomorrow at ${clock.spoken}` : "tomorrow at 9:00 AM" };
  }
  if (/\btoday\b/i.test(text) && clock) {
    matched.push("today");
    return { dueAt: at(now, clock.h, clock.m), matched, whenSpoken: `today at ${clock.spoken}` };
  }

  // Weekday: "on Friday" / "Friday" — next occurrence (a weekday said today
  // means NEXT week only if its time already passed).
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const re = new RegExp(`\\b(?:on\\s+|next\\s+)?${WEEKDAYS[i]}\\b`, "i");
    const m = text.match(re);
    if (m) {
      matched.push(m[0]);
      const explicitNext = /\bnext\b/i.test(m[0]);
      let delta = (i - now.getDay() + 7) % 7;
      if (delta === 0) delta = explicitNext ? 7 : 0;
      let base = addDays(now, delta);
      let dueAt = clock ? at(base, clock.h, clock.m) : at(base, 9, 0);
      if (dueAt <= now) {
        base = addDays(base, 7);
        dueAt = clock ? at(base, clock.h, clock.m) : at(base, 9, 0);
      }
      const dayName = WEEKDAYS[i][0].toUpperCase() + WEEKDAYS[i].slice(1);
      return {
        dueAt,
        matched,
        whenSpoken: `${dayName} at ${clock ? clock.spoken : "9:00 AM"}`,
      };
    }
  }

  // Month + day: "on June 15" / "June 15th"
  for (let i = 0; i < MONTHS.length; i++) {
    const re = new RegExp(`\\b(?:on\\s+)?${MONTHS[i]}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i");
    const m = text.match(re);
    if (m) {
      const day = parseInt(m[1], 10);
      if (day >= 1 && day <= 31) {
        matched.push(m[0]);
        let base = new Date(now.getFullYear(), i, day);
        let dueAt = clock ? at(base, clock.h, clock.m) : at(base, 9, 0);
        if (dueAt <= now) {
          base = new Date(now.getFullYear() + 1, i, day);
          dueAt = clock ? at(base, clock.h, clock.m) : at(base, 9, 0);
        }
        const monthName = MONTHS[i][0].toUpperCase() + MONTHS[i].slice(1);
        return {
          dueAt,
          matched,
          whenSpoken: `${monthName} ${day} at ${clock ? clock.spoken : "9:00 AM"}`,
        };
      }
    }
  }

  // A bare clock with no day = today (or tomorrow if already past).
  if (clock) {
    let dueAt = at(now, clock.h, clock.m);
    let dayWord = "today";
    if (dueAt <= now) {
      dueAt = at(addDays(now, 1), clock.h, clock.m);
      dayWord = "tomorrow";
    }
    return { dueAt, matched, whenSpoken: `${dayWord} at ${clock.spoken}` };
  }

  return { dueAt: null, matched, whenSpoken: null };
}

// Leading filler on a bare time answer — "So yeah, 9 AM tomorrow." (G's
// verbatim 2026-06-11 reply that never merged). Stripped one token at a time.
const TIME_ONLY_LEAD_RE =
  /^(?:so|yeah|yes|yep|ok(?:ay)?|um+|uh+|well|hmm+|right|sure|and|then|maybe|say|let'?s say|let'?s do|make it|how about|i guess|i'?d say)\b[\s,.-]*/i;

/**
 * Parse an utterance that is NOTHING BUT a time answer ("9 AM tomorrow",
 * "tonight", "in 2 hours", "Friday at noon") — the natural reply after 6 asks
 * "When should I remind you?". Conservative on purpose: a real sentence that
 * merely contains a time word ("Tomorrow I'm going to the store") returns
 * null and flows to the brain. A full "remind me to..." also returns null so
 * the normal create path wins. Same never-guess principle as everything else.
 */
export function parseTimeOnly(
  text: string,
  now: Date,
): { dueAt: Date; whenSpoken: string } | null {
  if (REMINDER_TRIGGER_RE.test(text)) return null;
  let t = String(text || "").trim();
  for (;;) {
    const next = t.replace(TIME_ONLY_LEAD_RE, "");
    if (next === t) break;
    t = next;
  }
  t = t.replace(/[.?!]+\s*$/g, "").trim();
  if (!t || t.length > 60) return null;

  // Day-part words → concrete clocks (parseWhen's rollover picks the day).
  t = t
    .replace(/\b(?:in the|this) morning\b/i, "at 9 am")
    .replace(/\b(?:in the|this) afternoon\b/i, "at 3 pm")
    .replace(/\b(?:in the|this) evening\b/i, "at 6 pm");
  // A bare clock with no "at" ("9 AM tomorrow") is the answer itself — feed
  // parseClock the shape it knows. Unmatched groups substitute as "".
  if (!/\bat\s+\d/i.test(t) && !/\bat\s+(?:noon|midnight)\b/i.test(t)) {
    t = t.replace(/\b(\d{1,2})(:\d{2})?\s*(a\.?m\.?|p\.?m\.?|o'?clock)\b/i, "at $1$2 $3");
    t = t.replace(/^(noon|midnight)\b/i, "at $1");
  }

  const when = parseWhen(t, now);
  if (!when.dueAt) return null;

  // The whole utterance must be ~only the time phrase — anything substantive
  // left over means it was a sentence, not an answer.
  let residue = t;
  for (const piece of when.matched) {
    if (piece) residue = residue.replace(piece, " ");
  }
  residue = residue
    .replace(/\bat\s+(?:noon|midnight|\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|o'?clock)?)\b/i, " ")
    .replace(/\b(?:at|on|the|next|this|coming)\b/gi, " ")
    .replace(/[^a-z0-9']+/gi, " ")
    .trim();
  if (residue && residue.split(/\s+/).length > 2) return null;

  return { dueAt: when.dueAt, whenSpoken: when.whenSpoken ?? "then" };
}

/** Card-friendly due text: "Fri, Jun 12, 5:00 PM". */
export function fmtReminderDue(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Parse one utterance into a reminder. Returns null when the utterance is not
 * a reminder ask at all. A reminder with dueAt null means "6 should ask when".
 */
export function parseReminder(text: string, now: Date): ParsedReminder | null {
  if (REMINDER_NEGATION_RE.test(text)) return null;
  const recurrence = detectReminderRecurrence(text);
  const emailMeAsk = EMAIL_ME_TRIGGER_RE.test(text);
  if (!REMINDER_TRIGGER_RE.test(text)) {
    // The email-me form only counts WITH a clear time — "email me your
    // pricing" is a conversation, "email me at 9 to take out the trash" is a
    // reminder.
    if (!emailMeAsk) return null;
    const when = parseWhen(text, now, recurrence);
    if (!when.dueAt) return null;
    let title = text
      .replace(EMAIL_ME_TRIGGER_RE, " ")
      .replace(/^[\s\S]*?\b(?:can|could|will|would|please)\s+you\b/i, " ");
    for (const piece of when.matched) {
      if (piece) title = title.replace(piece, " ");
    }
    for (const piece of recurrence.matched) {
      if (piece) title = title.replace(piece, " ");
    }
    title = polishTitle(
      title
        .replace(/\bat\s+(?:noon|midnight|\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|o'?clock)?)\b/i, " ")
        .replace(/\bthis (?:morning|afternoon|evening)\b/i, " ")
        .replace(/^[\s,]*(?:to say|that says|saying|reminding me to|reminding me|about|to|that)\b/i, " ")
        .replace(/^[\s,]*(?:please|can you|could you)\b/i, " "),
    );
    return {
      title,
      dueAt: when.dueAt,
      whenSpoken: recurrenceWhenSpoken(when.whenSpoken, recurrence),
      askedChannel: detectAskedChannel(text),
      recurrence: recurrence.recurrence,
    };
  }

  const when = parseWhen(text, now, recurrence);

  // TITLE: text after the trigger, minus the time phrases and lead-in filler.
  let title = text
    .replace(/^[\s\S]*?\b(?:remind me|set (?:a |up a )?reminder|don'?t let me forget|help me remember|remember (?:for me )?)\b/i, "")
    .replace(/^\s*(?:to|about|that|for)\b/i, "");
  for (const piece of when.matched) {
    if (piece) title = title.replace(piece, " ");
  }
  for (const piece of recurrence.matched) {
    if (piece) title = title.replace(piece, " ");
  }
  // The lead-in can reappear once the time phrase is gone ("remind me in an
  // hour TO flip the laundry") — strip it again after time removal.
  title = polishTitle(
    title
      .replace(/^[\s,]*(?:to|about|that|for)\b/i, "")
      .replace(/\bat\s*$/i, " ")
      .replace(/\bon\s*$/i, " "),
  );

  return {
    title,
    dueAt: when.dueAt,
    whenSpoken: recurrenceWhenSpoken(when.whenSpoken, recurrence),
    askedChannel: detectAskedChannel(text),
    recurrence: recurrence.recurrence,
  };
}
