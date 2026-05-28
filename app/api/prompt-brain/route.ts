import {
  MAX_OPENAI_USER_MESSAGE_CHARS,
  assertAllowedOrigin,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { normalizeTesterLabel } from "../../../src/lib/testerAttribution";
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
  /\b(?:contact|contacts|named g|for g|with g|call g|text g|email g|remind|reminder|notify|notification|g's|change subject|confirm understanding|review key points|check understanding|develop\s+\w+\s+strateg|learn\s+\w+\s+tip|practice\s+\w+\s+technique|to\s+do\s+list|grocery\s+list|walmart\s+list|shopping\s+list|gift\s+list|honey[-\s]?do\s+list|christmas\s+list|birthday\s+list|meaningful|(?:that|our)\s+bond|common\s+ground|set\s+better|build\s+stronger|(?:find|build)\s+deeper|build\s+trust\s+daily|trust\s+daily|create\s+your\s+vision|next\s+move|money\s+moves|smart\s+investments|\bmvp\b|\bkpi\b|\bmrr\b|\barr\b|\broi\b|minimum\s+viable|build\s+your\s+faith|set\s+faith\s+goals|grow\s+your\s+belief|spiritual\s+(?:habits|goals)|faith\s+goals|build\s+faith|build\s+your\s+focus|clarify\s+your\s+\w+|find\s+your\s+priorities|find\s+priorities|focus\s+your\s+\w+|align\s+your\s+\w+|optimize\s+your\s+\w+|sharpen\s+your\s+\w+|streamline\s+your\s+\w+|find\s+(?:\w+\s+)?income|find\s+(?:\w+\s+)?hustle|find\s+(?:\w+\s+)?streams|explore\s+(?:\w+\s+)?ideas|explore\s+(?:passive|active|new)\s+\w+|find\s+(?:passive|active|new)\s+\w+|discover\s+(?:\w+\s+)?income|make\s+your\s+move|make\s+a\s+move|just\s+begin\s+now|just\s+begin|begin\s+now|start\s+small\s+today|start\s+small\s+now|start\s+small|ask\s+for\s+examples?|ai[-\s]?asap\s+style|build\s+real\s+connection|grow\s+real\s+connections?|plan\s+(?:a|your)\s+meetup|set\s+a\s+date|set\s+share\s+goals|talk\s+it\s+out|find\s+common\s+interests?)\b/i;

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
  if (wordCount < 2 || wordCount > 3) return null;
  if (cleaned.length < 3 || cleaned.length > 22) return null;
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

  // G 2026-05-27: always 4 topic-relevant pillboxes. If brain returns 0, use
  // FALLBACK_PROMPTS. If brain returns 1-3, pad to 4 with FALLBACK_PROMPTS
  // entries that are NOT exact duplicates of what brain returned (case-insensitive).
  // This prevents stale prior-render pillboxes from leaking through and ensures
  // a fresh 4-pill set on every brain call.
  if (unique.length === 0) {
    return keepExploreAiASAPLow([...FALLBACK_PROMPTS])
      .filter((prompt, index, all) => all.indexOf(prompt) === index)
      .filter((prompt) => !/^change subject$/i.test(prompt))
      .slice(0, 4);
  }

  // Pad to 4 with FALLBACK_PROMPTS minus exact duplicates of brain's output.
  const lowerSet = new Set(unique.map((p) => p.toLowerCase()));
  const padding = FALLBACK_PROMPTS.filter((p) => !lowerSet.has(p.toLowerCase()));
  const filled = [...unique, ...padding].slice(0, 4);

  return keepExploreAiASAPLow(filled)
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
    const testerLabel = normalizeTesterLabel(body.testerLabel);

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
          "You are the on-screen idea brain for aiASAP's voice assistant, 6. Return JSON only, shaped like {\"prompts\":[\"\",\"\",\"\",\"\"]}. Generate exactly four short tappable conversation prompts that fit what the user is discussing right now. The prompts are buttons that lead the user FORWARD into the next part of the conversation — they pull the user forward, they do NOT summarize what just happened.\n\naiASAP's CORE TOPICS (use these as your default voice and style):\n\nLOCKED TOP 4 (the always-available defaults when no specific topic dominates): Build Relationships, Financial Freedom, Set & Track Goals, Build Your Socials.\n\nCORE POOL (sprinkle these in when the topic fits): Build a Better Life, Make More Money, Find Your Life Partner, Build a Business, Build Friendships, Build Your Brand, Market Yourself, Plan Your Weekend, Market Your Product, Market Your Service, Next Vacation Ideas.\n\nSTYLE RULES — every prompt must match this style:\n- 2 to 4 words. Title case. Keep the brand exactly aiASAP. Keep small connector words lowercase: a, an, and, for, of, the, this, to, with.\n- Start with an action verb when natural: Build, Create, Set, Find, Make, Market, Plan, Grow.\n- Aspirational and personal: 'Your Brand', 'Your Socials', 'Your Life Partner', 'Your Sound'.\n- Warm, inviting, real-life. NOT clinical, NOT technical, NOT therapist-y.\n\nNEVER use these dry/clinical patterns:\n- 'Develop X Strategies', 'Learn X Tips', 'Practice X Techniques', 'Explore X Options', 'Discuss X', 'Review X', 'Plan X Steps', 'Confirm X', 'Check X', 'Master X', 'Improve X Skills'.\n\nNEVER use list-creation prompts (the v1 beta has NO visible list UI):\n- 'To Do List', 'Start a Grocery List', 'Add to Grocery List', 'Walmart List', 'Shopping List', 'Birthday Gift List', 'Honey Do List', 'Christmas List', 'Plan a Gift'.\n\nNEVER use: reminders, notifications, 'Set Reminder', 'Notify Me', 'Save for Later'. NEVER use contact-G prompts ('Call G', 'Text G', 'Email G' — G is the Founder/Builder, not a contact). NEVER use 'Change Subject', 'Confirm Understanding', 'Review Key Points'.\n\nDYNAMIC TOPIC HANDLING — the user can talk about ANYTHING (cooking, fitness, gardening, parenting, music, faith, travel, work, retirement, hobbies, sports, grief, kids, in-laws, anxiety, sleep — any real-life thing). For any topic, generate 4 prompts that lead forward in the aiASAP action-verb + warm + aspirational style.\n\nExamples:\n- User talking about anxiety: 'Build Calm Habits', 'Find What Helps', 'Set Small Wins', 'Build Better Sleep' (NOT 'Develop Coping Strategies').\n- User talking about a parent: 'Build That Bond', 'Plan a Visit', 'Set Better Talks', 'Find Common Ground'.\n- User talking about music: 'Find Your Sound', 'Build Your Audience', 'Plan Your First Show', 'Market Your Music'.\n- User talking about fitness: 'Set Fitness Goals', 'Build a Routine', 'Find Your Sport', 'Plan Your Week'.\n\nMIX: Top 4 + relevant pool entries should appear roughly 50-70% of the time across a conversation. Custom prompts in the same warm action-verb style fill the rest, fitted to the user's specific topic. All four prompts must lead the user forward. If the conversation has moved on, replace stale prompts with new relevant ones in the same style.\n\nCRITICAL — NO TOPIC ECHO: If the user is ALREADY actively discussing one of the Locked Top 4 themes (relationships, financial freedom, goals, socials), DO NOT include that exact default in your 4 prompts. The user is past that label — generate 4 FRESH variations specific to their next step. Example: user is talking about building relationships → return 4 specifics like 'Find Common Interests', 'Grow Your Network', 'Plan a Meetup', 'Build Real Connection' — NOT 'Build Relationships' itself. The pillboxes pull forward, not echo back what the user just named.\n\nHARD COUNT — return EXACTLY 4 prompts every time. Never 1, 2, or 3. If you can't find 4 strong topic-fits, generate aspirational variations in the same theme. 4 is the count, no exceptions.\n\nBANNED CORPORATE/MANAGEMENT-SPEAK LABELS (2026-05-27 — G hated these in testing): NEVER generate abstract management-consultant labels. These are the patterns to AVOID:\n- 'Build Your Focus' (vague, what does that mean?)\n- 'Clarify Your Challenge' (corporate SaaS-speak, NOT how a friend talks)\n- 'Find Your Priorities' (management-speak, abstract)\n- 'Align Your X', 'Optimize Your X', 'Sharpen Your X', 'Streamline Your X' (all corporate templates)\n- 'Clarify Your X', 'Focus Your X' (same problem)\n\nWHEN STUCK, USE CONCRETE TIER-1 LABELS — what a friend would actually say over coffee:\n- 'Pick One Thing', 'Make a Move', 'Start Small', 'Take the Next Step'\n- 'Try Something New', 'Get Started', 'Do The First Thing', 'Just Begin'\n- 'Talk It Out', 'Write It Down', 'Make a Plan', 'Set a Date'\n\nIF the LLM can't find 4 GOOD labels, it is BETTER to repeat a Locked Top 4 default than to ship a corporate-speak label. The no-echo rule above is a preference, not absolute — when the alternative is 'Clarify Your Challenge' or 'Build Your Focus', DEFAULT BACK to Top 4.\n\nVERB-NOUN FIT RULE (LOCKED 2026-05-27 — G's rejection: 'You don't FIND income, you BUILD it'): The action verb MUST naturally fit the noun. Wrong verb makes the label nonsense.\n\nBANNED MISMATCHES (G rejected these):\n- 'Find X Income' (you don't FIND income — you BUILD, CREATE, GROW, MAKE income)\n- 'Find X Hustle' or 'Find Side Hustles' (you BUILD a hustle, don't FIND one)\n- 'Find X Streams' (you BUILD/CREATE income streams, don't FIND them)\n- 'Explore X Ideas' (too vague — 'Brainstorm Ideas' or 'List Ideas' is concrete)\n- 'Explore Passive Income/Ideas' (action unclear)\n- 'Discover X Income' (same passive vibe — use BUILD/CREATE/MAKE)\n\nCORRECT VERB-NOUN PAIRINGS:\n- Income: BUILD, CREATE, GROW, MAKE (NOT find/discover/explore)\n- Side hustle: BUILD, START, LAUNCH (NOT find)\n- Money: MAKE, EARN, GROW, SAVE (NOT find)\n- Skills: BUILD, GROW, SHARPEN, LEARN (NOT find — though 'sharpen' is OK for skills)\n- Goals: SET, TRACK, HIT, REACH (NOT find)\n- Connections/friends: BUILD, MAKE, GROW, FIND (FIND is OK for people/friends)\n- Ideas: BRAINSTORM, LIST, WRITE DOWN (NOT 'explore' alone)\n\nGUT CHECK: Could a real American friend say this label naturally? 'Hey, want to find passive income?' sounds weird. 'Hey, want to build passive income?' sounds right. Use that mental test.",
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
          // conversation_messages has a CHECK constraint allowing only role
          // 'user' or 'assistant'. Brain output rides as 'assistant' with the
          // distinguishing source 'prompt_brain_v1' so smoke queries can
          // filter brain rows out from real voice turns.
          session_id: sessionId,
          role: "assistant",
          message: JSON.stringify({ latestUserText, prompts }),
          source: "prompt_brain_v1",
          la_absolute_timestamp: Math.floor(Date.now() / 1000),
          ...(testerLabel ? { tester_label: testerLabel } : {}),
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
