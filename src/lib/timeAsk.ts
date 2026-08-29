// "What time is it?" — the APP answers, deterministically (2026-06-11, r18).
// G's 8:47 AM session: 6 said "I don't have the exact current time, it was
// 8:44 when we started" — the brain only had the session-start stamp. A clock
// question must never depend on the LLM having a fresh stamp; the device knows
// the time. Narrow on purpose: statements ABOUT time ("you should have the
// real time") and scheduling phrases ("at what time") stay with the brain.
export const TIME_ASK_RE =
  /\bwhat time is it\b|\bwhat(?:'s| is) the (?:real |current |actual |exact )?time\b|\bdo you know the (?:real |current |actual |exact )?time\b|\bgot the time\b|\btime check\b|\btell me the (?:current |real )?time\b|\bwhat time (?:do you have|you got)\b/i;

/** Spoken clock line in the user's zone — "It's 8:47 AM." */
export function spokenTimeNow(now: Date, timeZone?: string | null): string {
  try {
    const t = now.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    });
    return `It's ${t}.`;
  } catch {
    // A junk zone string must never crash the turn — device-local fallback.
    const t = now.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
    return `It's ${t}.`;
  }
}
