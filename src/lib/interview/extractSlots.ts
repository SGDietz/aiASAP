/**
 * THE EXTRACTOR - the half of the ledger that fills it in.
 *
 * The ledger records what is known about somebody's $5,000 interview and
 * whispers the next hole to 6. Without this, nothing ever writes to it and it
 * is a filing cabinet nobody files into.
 *
 * Modelled deliberately on src/lib/memory/extractFacts.ts, which already does
 * exactly this shape for durable facts: a cheap model, JSON-only, temperature
 * 0, fire-and-forget after the reply has gone out. Copying a proven pattern
 * rather than inventing a second one.
 *
 * TWO RULES THAT MATTER MORE THAN COVERAGE:
 *
 * 1. NEVER GUESS. A slot filled with SAID is treated by the done tests as
 *    something the person actually told us, and a whole interview can be
 *    marked buildable on it. A brand then gets built on a hallucination. When
 *    unsure, omit - a missing slot costs one more question; a wrong one costs
 *    somebody's business description being wrong on their own public page.
 *
 * 2. OUT OF ORDER IS NORMAL. People answer part 5 while 6 is asking part 2.
 *    The extractor fills whatever part the words belong to, never only the
 *    part 6 happens to be on. One sentence can legitimately fill two parts.
 */

import { OPENAI_API_KEY } from "../../../app/api/secrets";

const EXTRACTOR_MODEL = process.env.OPENAI_EXTRACTOR_MODEL || "gpt-4o-mini";

/** The slot names the ledger's done tests actually read. */
export const SLOT_KEYS = {
  1: ["name", "barbecue_do", "love_flag"],
  2: ["yesterday_beats"],
  3: ["typical_blocks", "last_week_event", "next_week"],
  4: ["must_do", "wants_help"],
  5: ["offer", "last_pay", "pay_band", "money_refused", "no_money_yet"],
  6: ["reach_path", "yes_looks_like", "reach_publish"],
  7: ["payer", "what_they_said", "empty_ok", "free_or_future_name"],
  8: ["feel_good_number", "should_run_itself"],
  9: ["recap_confirmed"],
} as const;

/**
 * Whether this turn was them answering the spoken record notice.
 * "none" is by far the most common answer and must stay the default - reading
 * an ordinary "yeah" as consent would manufacture permission nobody gave.
 */
export type NoticeDecision = "granted" | "declined" | "none";

export type ExtractedTurn = {
  slots: ExtractedSlot[];
  notice: NoticeDecision;
};

export type ExtractedSlot = {
  part: number;
  key: string;
  /** For list slots, several items; the caller joins them with the separator. */
  values: string[];
};

const SYSTEM = `You read ONE turn of a spoken conversation and record what the PERSON said, as interview slots. You are not talking to anybody. You output JSON only.

The conversation is a nine-part interview that ends in building somebody a brand and a website.

PARTS AND THEIR SLOTS:
1 who they are: name, barbecue_do (a concrete thing they DO, never a bare job title like "sales"), love_flag ("true" only if they audibly lit up about something)
2 yesterday: yesterday_beats (ordered real actions from ONE real day - a list)
3 their week: typical_blocks (recurring parts of a normal week - a list), last_week_event, next_week
4 what they must get done: must_do, wants_help ("true"/"false")
5 where money comes in: offer (what they sell), last_pay (a number they named), pay_band (hundred|thousand|tens), money_refused ("true" if they declined to discuss money), no_money_yet ("true" if they have never been paid for it)
6 the way in: reach_path (phone|email|dm|in_person|other), yes_looks_like (what saying yes costs a customer), reach_publish ("true"/"false" ONLY if they said whether that contact may go on a public page)
7 proof: payer (who paid them), what_they_said, empty_ok ("true" if nobody has paid yet), free_or_future_name (somebody they did it free for, or a first hoped-for customer)
8 more money: feel_good_number, should_run_itself
9 say it back: recap_confirmed ("true" only if they confirmed 6's summary was right)

THE RECORD NOTICE. Separately from the slots, 6 sometimes reads a short notice
saying the conversation is recorded and asks if that is okay. Set "notice":
- "granted" ONLY if this turn is them agreeing to THAT notice.
- "declined" ONLY if this turn is them refusing it.
- "none" for everything else, including any ordinary yes or no about anything
  else. This is the normal answer. An agreement to something else is NOT
  consent to being recorded, and recording a "granted" that never happened
  manufactures permission a real person did not give.

HARD RULES:
- STRICT JSON only. No prose, no markdown fences.
- Schema: {"notice":"granted|declined|none","slots":[{"part":<1-9>,"key":"<slot>","values":["..."]}]}
- ONLY what the person actually said. NEVER infer, guess, round, or tidy into business language. If unsure, leave it out.
- Use THEIR words. Do not rewrite "I mow the rich folks' ditches" into "landscaping services".
- A turn may fill slots on ANY part, not just the one being asked. Fill every part the words genuinely answer.
- One sentence may fill two parts. That is fine and expected.
- yesterday_beats and typical_blocks take several values. Everything else takes one.
- yesterday_beats is ONLY for a specific real day. "I usually start at seven" is NOT a beat.
- Boolean-ish slots take exactly "true" or "false" and nothing else.
- If the turn is small talk, a question back, or the person is only reacting, return {"notice":"none","slots":[]}.
- Never record anything about the account, the email, the magic link, or the price. Those are not interview answers.
- Never record health, money troubles, family problems, or anything said in passing that is not about the work.`;

const NOTHING: ExtractedTurn = { slots: [], notice: "none" };

export async function extractInterviewSlots(args: {
  userMessage: string;
  assistantReply: string;
}): Promise<ExtractedTurn> {
  if (!OPENAI_API_KEY) return NOTHING;
  const text = (args.userMessage || "").trim();
  // Short answers still matter here: "yes, that's fine" is how somebody
  // accepts the record notice, and it is well under the old 12-char floor
  // that existed when this only looked for interview answers.
  if (text.length < 3) return NOTHING;

  const user = `WHAT THE PERSON SAID:\n${text}\n\nWHAT 6 SAID BACK (context only - never extract 6's words as their answers):\n${args.assistantReply}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EXTRACTOR_MODEL,
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("extractInterviewSlots: openai", res.status);
      return NOTHING;
    }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return NOTHING;
    return sanitize(raw);
  } catch (e) {
    // Never throw into the caller: this runs after the reply has gone out and
    // a failed extraction must never surface to the person talking.
    console.error("extractInterviewSlots threw", e);
    return NOTHING;
  }
}

/**
 * Everything the model returned is untrusted until it matches a real slot.
 * A typo'd key would otherwise sit in the ledger forever meaning nothing, and
 * a part the done tests never read would look like progress that is not there.
 */
export function sanitize(raw: string): ExtractedTurn {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { slots: [], notice: "none" };
  }

  // Anything but the two exact words is "none". Consent is the one field here
  // where a loose read has a legal cost, so it gets the strictest check.
  const rawNotice = (parsed as { notice?: unknown })?.notice;
  const notice: NoticeDecision =
    rawNotice === "granted" ? "granted" : rawNotice === "declined" ? "declined" : "none";

  const slots = (parsed as { slots?: unknown })?.slots;
  if (!Array.isArray(slots)) return { slots: [], notice };

  const out: ExtractedSlot[] = [];
  for (const s of slots.slice(0, 24)) {
    const part = Number((s as { part?: unknown })?.part);
    if (!Number.isInteger(part) || part < 1 || part > 9) continue;
    const key = String((s as { key?: unknown })?.key ?? "").trim();
    const allowed = SLOT_KEYS[part as keyof typeof SLOT_KEYS] as readonly string[];
    if (!allowed.includes(key)) continue;

    const rawVals = (s as { values?: unknown })?.values;
    const values = (Array.isArray(rawVals) ? rawVals : [rawVals])
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      // A whole paragraph is not a slot value - it is the model narrating.
      .map((v) => (v.length > 400 ? v.slice(0, 400) : v))
      .slice(0, 12);
    if (!values.length) continue;

    // Boolean-ish slots must be exactly true/false or they are silently wrong:
    // the ledger's strict flag reader would treat "yes probably" as false.
    const BOOLISH = [
      "love_flag", "wants_help", "money_refused", "no_money_yet",
      "empty_ok", "reach_publish", "recap_confirmed",
    ];
    if (BOOLISH.includes(key)) {
      const v = values[0].toLowerCase();
      if (v !== "true" && v !== "false") continue;
      out.push({ part, key, values: [v] });
      continue;
    }

    // Only these two are lists. Everything else takes one value, and a model
    // returning several means it was unsure - take the first, do not merge.
    const isList = key === "yesterday_beats" || key === "typical_blocks";
    out.push({ part, key, values: isList ? values : [values[0]] });
  }
  return { slots: out, notice };
}
