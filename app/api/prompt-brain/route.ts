import {
  MAX_OPENAI_USER_MESSAGE_CHARS,
  assertAllowedOrigin,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { OPENAI_API_KEY } from "../secrets";

const OPENAI_MODEL =
  process.env.OPENAI_PROMPT_BRAIN_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini";

const FALLBACK_PROMPTS = [
  "Plan This Weekend",
  "To Do List",
  "Start a Grocery List",
  "Explore aiASAP",
];

const BLOCKED_PROMPT_RE =
  /\b(?:contact|contacts|named g|for g|with g|call g|text g|email g|remind|reminder|notify|notification|g's|change subject|confirm understanding|review key points|check understanding)\b/i;

const LOWERCASE_TITLE_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
]);

function toPromptTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (/^aiasap$/i.test(word) || /^ai[-\s]?asap$/i.test(word)) {
        return "aiASAP";
      }
      if (lower === "todo" || lower === "to-do") {
        return "To Do";
      }
      const previousLower = value.split(" ")[index - 1]?.toLowerCase();
      const nextLower = value.split(" ")[index + 1]?.toLowerCase();
      if (lower === "to" && nextLower === "do") {
        return "To";
      }
      if (lower === "do" && previousLower === "to") {
        return "Do";
      }
      if (index > 0 && LOWERCASE_TITLE_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function cleanPrompt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/^\s*(?:\d+[\).:-]?|[-*])\s*/u, "")
    .replace(/\bAI\s+ASAP\b/g, "aiASAP")
    .replace(/\bai[-\s]?asap\b/gi, "aiASAP")
    .replace(/\bto[-\s]?do\b/gi, "To Do")
    .replace(/\bCreate\s+To\s+Do\s+List\b/gi, "To Do List")
    .replace(/\bactivities\b/gi, "plans")
    .replace(/\bactivity\b/gi, "plan")
    .replace(/[.!?。！？]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2 || wordCount > 4) return null;
  if (cleaned.length < 3 || cleaned.length > 32) return null;
  if (BLOCKED_PROMPT_RE.test(cleaned)) return null;
  return toPromptTitleCase(cleaned);
}

function keepExploreAiASAPLow(prompts: string[]): string[] {
  const explore = prompts.find((prompt) => /^explore\s+aiasap$/i.test(prompt));
  if (!explore) return prompts;
  return [
    ...prompts.filter((prompt) => !/^explore\s+aiasap$/i.test(prompt)),
    "Explore aiASAP",
  ];
}

function normalizePrompts(value: unknown): string[] {
  if (!Array.isArray(value)) return FALLBACK_PROMPTS;

  const prompts = value
    .map(cleanPrompt)
    .filter((prompt): prompt is string => Boolean(prompt));

  const unique = [...new Set(prompts)];
  return keepExploreAiASAPLow([...unique, ...FALLBACK_PROMPTS])
    .filter((prompt, index, all) => all.indexOf(prompt) === index)
    .filter((prompt) => !/^change subject$/i.test(prompt))
    .slice(0, 4);
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ prompts: FALLBACK_PROMPTS }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const latestUserText =
      typeof body.latestUserText === "string"
        ? truncateUtf8String(
            body.latestUserText.trim(),
            MAX_OPENAI_USER_MESSAGE_CHARS,
          )
        : "";
    const recentUserTexts = Array.isArray(body.recentUserTexts)
      ? body.recentUserTexts
          .filter((item: unknown): item is string => typeof item === "string")
          .slice(-8)
          .map((item: string) => truncateUtf8String(item.trim(), 600))
          .filter(Boolean)
      : [];
    const currentPrompts = Array.isArray(body.currentPrompts)
      ? body.currentPrompts
          .filter((item: unknown): item is string => typeof item === "string")
          .slice(0, 4)
          .map((item: string) => truncateUtf8String(item.trim(), 120))
          .filter(Boolean)
      : [];

    if (!latestUserText && recentUserTexts.length === 0) {
      return new Response(JSON.stringify({ prompts: FALLBACK_PROMPTS }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are the quiet on-screen idea brain for aiASAP's voice assistant, 6. Return JSON only, shaped like {\"prompts\":[\"\",\"\",\"\",\"\"]}. Generate exactly four tappable conversation prompts for what the user is discussing right now. No numbering. No labels. No quotes. No punctuation at the end. Keep each prompt 2 to 4 words. Use title case, but keep the brand exactly aiASAP and keep small connector words lowercase, such as a, an, and, for, of, the, this, and to. All four prompts should be useful: tightly related to the topic, or a natural segue toward improving the user's life. Never use Change Subject, Confirm Understanding, Review Key Points, or labels that describe what 6 is thinking. The prompts are for leading the user to the next helpful action. Avoid the word activities; say plans, cool things to do, places, or plain words that fit. Prefer concrete, practical help that improves daily life: lists, To Do lists, errands, birthday plans, weekend plans, hikes, cool things to do, follow-ups, small next steps, useful personal organization, and ethical ways to make more money. Keep Explore aiASAP as a lower-priority default; only put it first when the user is directly asking what aiASAP is or how 6 works. Keep Start a Grocery List as a useful option, but do not put it first unless the user is clearly discussing groceries, shopping, or store errands. Keep Plan This Weekend as a strong proactive option when weekend, free time, family, friends, energy, health, or getting out of the house fits. The exact prompt To Do List is preferred whenever tasks, chores, plans, work, family, or open loops are in the conversation. If the user already has or is building a grocery list, prefer Add to Grocery List over Start a Grocery List. Do not create reminder prompts, notification prompts, or prompts about adding contacts named G, setting reminders for G, calling G, texting G, or emailing G; G is the Creator/Builder/Founder/Financier/CEO aiASAP, not a random contact. Avoid stale ideas, vague coaching, sales language, or entertainment-only ideas. If the conversation changed, replace stale ideas with new relevant ones.",
      },
      {
        role: "user",
        content: JSON.stringify({
          latestUserText,
          recentUserTexts,
          currentPrompts,
          responseShape: { prompts: ["", "", "", ""] },
        }),
      },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.35,
        max_tokens: 180,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("Prompt brain OpenAI error:", await res.text());
      return new Response(JSON.stringify({ prompts: FALLBACK_PROMPTS }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : {};
    const prompts = normalizePrompts(parsed.prompts);

    return new Response(JSON.stringify({ prompts }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Prompt brain failed:", error);
    return new Response(JSON.stringify({ prompts: FALLBACK_PROMPTS }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
