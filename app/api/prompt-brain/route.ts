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
  "Build Relationships",
  "Financial Freedom",
  "Set & Track Goals",
  "Build Your Socials",
];

const BLOCKED_PROMPT_RE =
  /\b(?:contact|contacts|named g|for g|with g|call g|text g|email g|remind|reminder|notify|notification|g's|change subject|confirm understanding|review key points|check understanding|develop\s+\w+\s+strateg|learn\s+\w+\s+tip|practice\s+\w+\s+technique|to\s+do\s+list|grocery\s+list|walmart\s+list|shopping\s+list|gift\s+list|honey[-\s]?do\s+list|christmas\s+list|birthday\s+list)\b/i;

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
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.length > 0
        ? body.sessionId
        : null;

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
          "You are the on-screen idea brain for aiASAP's voice assistant, 6. Return JSON only, shaped like {\"prompts\":[\"\",\"\",\"\",\"\"]}. Generate exactly four short tappable conversation prompts that fit what the user is discussing right now. The prompts are buttons that lead the user FORWARD into the next part of the conversation — they pull the user forward, they do NOT summarize what just happened.\n\naiASAP's CORE TOPICS (use these as your default voice and style):\n\nLOCKED TOP 4 (the always-available defaults when no specific topic dominates): Build Relationships, Financial Freedom, Set & Track Goals, Build Your Socials.\n\nCORE POOL (sprinkle these in when the topic fits): Build a Better Life, Make More Money, Find Your Life Partner, Build a Business, Build Friendships, Build Your Brand, Market Yourself, Plan Your Weekend, Market Your Product, Market Your Service, Next Vacation Ideas.\n\nSTYLE RULES — every prompt must match this style:\n- 2 to 4 words. Title case. Keep the brand exactly aiASAP. Keep small connector words lowercase: a, an, and, for, of, the, this, to, with.\n- Start with an action verb when natural: Build, Create, Set, Find, Make, Market, Plan, Grow.\n- Aspirational and personal: 'Your Brand', 'Your Socials', 'Your Life Partner', 'Your Sound'.\n- Warm, inviting, real-life. NOT clinical, NOT technical, NOT therapist-y.\n\nNEVER use these dry/clinical patterns:\n- 'Develop X Strategies', 'Learn X Tips', 'Practice X Techniques', 'Explore X Options', 'Discuss X', 'Review X', 'Plan X Steps', 'Confirm X', 'Check X', 'Master X', 'Improve X Skills'.\n\nNEVER use list-creation prompts (the v1 beta has NO visible list UI):\n- 'To Do List', 'Start a Grocery List', 'Add to Grocery List', 'Walmart List', 'Shopping List', 'Birthday Gift List', 'Honey Do List', 'Christmas List', 'Plan a Gift'.\n\nNEVER use: reminders, notifications, 'Set Reminder', 'Notify Me', 'Save for Later'. NEVER use contact-G prompts ('Call G', 'Text G', 'Email G' — G is the Founder/Builder, not a contact). NEVER use 'Change Subject', 'Confirm Understanding', 'Review Key Points'.\n\nDYNAMIC TOPIC HANDLING — the user can talk about ANYTHING (cooking, fitness, gardening, parenting, music, faith, travel, work, retirement, hobbies, sports, grief, kids, in-laws, anxiety, sleep — any real-life thing). For any topic, generate 4 prompts that lead forward in the aiASAP action-verb + warm + aspirational style.\n\nExamples:\n- User talking about anxiety: 'Build Calm Habits', 'Find What Helps', 'Set Small Wins', 'Build Better Sleep' (NOT 'Develop Coping Strategies').\n- User talking about a parent: 'Build That Bond', 'Plan a Visit', 'Set Better Talks', 'Find Common Ground'.\n- User talking about music: 'Find Your Sound', 'Build Your Audience', 'Plan Your First Show', 'Market Your Music'.\n- User talking about fitness: 'Set Fitness Goals', 'Build a Routine', 'Find Your Sport', 'Plan Your Week'.\n\nMIX: Top 4 + relevant pool entries should appear roughly 50-70% of the time across a conversation. Custom prompts in the same warm action-verb style fill the rest, fitted to the user's specific topic. All four prompts must lead the user forward. If the conversation has moved on, replace stale prompts with new relevant ones in the same style.",
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

    // v1 brain output logging: fire-and-forget to Supabase conversation_messages
    // so we can query pillbox state alongside user/assistant turns.
    const supaUrl = process.env.SUPABASE_URL;
    const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(
      `[prompt-brain] returned ${prompts.length} prompts for sessionId=${sessionId ? sessionId.substring(0, 8) : "NULL"}: ${prompts.join(" | ")}`,
    );
    if (!supaUrl) console.error("[prompt-brain] SUPABASE_URL missing");
    if (!supaKey) console.error("[prompt-brain] SUPABASE_SERVICE_ROLE_KEY missing");
    if (!sessionId) console.warn("[prompt-brain] no sessionId in request body — log skipped");
    if (supaUrl && supaKey && sessionId) {
      void fetch(`${supaUrl}/rest/v1/conversation_messages`, {
        method: "POST",
        headers: {
          apikey: supaKey,
          Authorization: `Bearer ${supaKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          session_id: sessionId,
          role: "brain_output",
          message: JSON.stringify({ latestUserText, prompts }),
          source: "prompt_brain_v1",
          la_absolute_timestamp: Math.floor(Date.now() / 1000),
        }),
      }).catch((err) =>
        console.error("[prompt-brain] supabase log failed:", err),
      );
    }

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
