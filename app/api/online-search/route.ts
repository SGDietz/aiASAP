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
const MAX_ANSWER_CHARS = 420;

type OnlineSearchPayload = {
  query?: unknown;
  location?: unknown;
};

type OnlineSearchSource = {
  title: string;
  url: string;
};

function cleanString(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = truncateUtf8String(value.replace(/\s+/g, " ").trim(), maxChars);
  return cleaned ? cleaned : null;
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
    answer: answer ? truncateUtf8String(answer, MAX_ANSWER_CHARS) : null,
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
    const location = cleanString(body.location, MAX_LOCATION_CHARS);
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
              "You help a-i-ASAP's voice assistant, 6, find current online information. Return 3 or 4 short, useful starter ideas near the supplied location, formatted as plain numbered lines. Be practical and spoken-friendly. Never dump a top 10 list. Never assume a city, state, or country that was not supplied by the location field or current search results. If the location is vague or insufficient, say you need a ZIP code or city. Do not invent addresses, hours, closures, fees, or safety conditions. Do not include markdown links or tell the user to click links.",
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
