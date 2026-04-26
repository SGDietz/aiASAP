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
  "Start a grocery list",
  "Remember a birthday",
  "Plan this weekend",
  "Don't forget something",
];

function cleanPrompt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/^\s*(?:\d+[\).:-]?|[-*])\s*/u, "")
    .replace(/[.!?。！？]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount < 3 || wordCount > 4) return null;
  if (cleaned.length < 3 || cleaned.length > 42) return null;
  return cleaned;
}

function normalizePrompts(value: unknown): string[] {
  if (!Array.isArray(value)) return FALLBACK_PROMPTS;

  const prompts = value
    .map(cleanPrompt)
    .filter((prompt): prompt is string => Boolean(prompt));

  const unique = [...new Set(prompts)];
  return [...unique, ...FALLBACK_PROMPTS].slice(0, 4);
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
          "You are the quiet on-screen idea brain for aiASAP's voice assistant, 6. Return JSON only, shaped like {\"prompts\":[\"\",\"\",\"\",\"\"]}. Generate exactly four tappable conversation prompts ranked from most useful to least useful for what the user is discussing now. No numbering. No labels. No quotes. No punctuation at the end. Keep each prompt exactly 3 or 4 words. Prefer concrete, practical help that improves daily life: reminders, lists, plans, errands, birthdays, follow-ups, small next steps, and useful personal organization. Avoid vague coaching, sales language, or entertainment-only ideas. If the conversation changed, replace stale ideas with new relevant ones.",
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
