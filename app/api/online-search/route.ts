import {
  MAX_OPENAI_USER_MESSAGE_CHARS,
  assertAllowedOrigin,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { OPENAI_API_KEY } from "../secrets";

const OPENAI_WEB_SEARCH_MODEL =
  process.env.OPENAI_WEB_SEARCH_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini";

const MAX_LOCATION_CHARS = 120;
const MAX_ANSWER_CHARS = 320;

type OnlineSearchPayload = {
  query?: unknown;
  location?: unknown;
};

type OnlineSearchSource = {
  title: string;
  url: string;
};

const ZIP_LOCATION_OVERRIDES: Record<string, string> = {
  "21093": "Timonium, MD 21093",
};

function cleanString(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = truncateUtf8String(value.replace(/\s+/g, " ").trim(), maxChars);
  return cleaned ? cleaned : null;
}

function normalizeLocation(value: string): string {
  const zip = value.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5);
  if (zip && ZIP_LOCATION_OVERRIDES[zip]) return ZIP_LOCATION_OVERRIDES[zip];
  return value;
}

function cleanAnswerLine(value: string): string | null {
  const cleaned = value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\bEllicott City,?\s+MD\b(?=.*\b21093\b)/gi, "Timonium, MD")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.()\-–—]+|[\s:;,.()\-–—]+$/g, "")
    .trim();
  if (!cleaned) return null;
  if (/^(?:here are|i found|these are|some options|events? happening)\b/i.test(cleaned)) {
    return null;
  }
  return cleaned.length > 95 ? `${cleaned.slice(0, 92).trim()}...` : cleaned;
}

function normalizeAnswer(answer: string): string {
  const lines = answer
    .replace(/\r/g, "")
    .split(/\n+|(?=\b\d{1,2}[.)]\s+)/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d{1,2}[.)])\s*/, ""))
    .map(cleanAnswerLine)
    .filter((line): line is string => Boolean(line))
    .slice(0, 3);
  const selected = lines.length > 0 ? lines : [cleanAnswerLine(answer)].filter((line): line is string => Boolean(line));
  return truncateUtf8String(
    selected.map((line, index) => `${index + 1}. ${line}`).join("\n"),
    MAX_ANSWER_CHARS,
  );
}

function extractResponse(data: Record<string, unknown>): {
  answer: string | null;
  sources: OnlineSearchSource[];
} {
  const sources = new Map<string, OnlineSearchSource>();
  let answer =
    typeof data.output_text === "string" ? data.output_text.trim() : "";

  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? ((item as { content: unknown[] }).content)
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const maybeText = (part as { text?: unknown }).text;
      if (!answer && typeof maybeText === "string") answer = maybeText.trim();
      const annotations = Array.isArray(
        (part as { annotations?: unknown }).annotations,
      )
        ? ((part as { annotations: unknown[] }).annotations)
        : [];
      for (const annotation of annotations) {
        if (!annotation || typeof annotation !== "object") continue;
        const citation =
          (annotation as { url_citation?: unknown }).url_citation ??
          annotation;
        if (!citation || typeof citation !== "object") continue;
        const rawUrl = (citation as { url?: unknown }).url;
        if (typeof rawUrl !== "string" || !rawUrl.startsWith("http")) continue;
        const rawTitle = (citation as { title?: unknown }).title;
        sources.set(rawUrl, {
          url: rawUrl,
          title:
            typeof rawTitle === "string" && rawTitle.trim()
              ? rawTitle.trim().slice(0, 120)
              : new URL(rawUrl).hostname,
        });
      }
    }
  }

  return {
    answer: answer ? normalizeAnswer(answer) : null,
    sources: [...sources.values()].slice(0, 4),
  };
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OpenAI API key not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const body = (await request.json()) as OnlineSearchPayload;
    const query = cleanString(body.query, MAX_OPENAI_USER_MESSAGE_CHARS);
    const rawLocation = cleanString(body.location, MAX_LOCATION_CHARS);
    const location = rawLocation ? normalizeLocation(rawLocation) : null;
    if (!query || !location) {
      return new Response(
        JSON.stringify({ error: "query and location are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_WEB_SEARCH_MODEL,
        tools: [{ type: "web_search" }],
        tool_choice: "auto",
        input: [
          {
            role: "system",
            content:
              "You help a-i-ASAP's voice assistant, 6, find current online information. Return exactly 3 short, useful starter ideas near the supplied location, formatted as plain numbered lines. Each line must start with the actual event, place, or option name. No intro line. No labels like When, Where, Host, or Link. Each line must be under 80 characters. Be practical and spoken-friendly. Never dump a top 10 list. Never assume a city, state, or country that was not supplied by the location field or current search results. If the location is vague or insufficient, say you need a ZIP code or city. Do not invent addresses, hours, closures, fees, or safety conditions. Do not include markdown links, source names, URLs, or tell the user to click links. ZIP 21093 is Timonium, Maryland.",
          },
          {
            role: "user",
            content: `Find useful current options for: ${query}. Search near: ${location}.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("online search OpenAI error:", await res.text());
      return new Response(
        JSON.stringify({ error: "Online lookup failed" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = (await res.json()) as Record<string, unknown>;
    const { answer, sources } = extractResponse(data);
    if (!answer) {
      return new Response(
        JSON.stringify({ error: "Online lookup returned no answer" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ answer, sources }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("online search route failed:", error);
    return new Response(JSON.stringify({ error: "Online lookup failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
