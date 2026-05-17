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
const MAX_ANSWER_CHARS = 520;

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

const WEEKEND_BACKFILL_OPTIONS: Array<{ pattern: RegExp; lines: string[] }> = [
  {
    pattern: /\b(?:21093|timonium|towson|baltimore county)\b/i,
    lines: [
      "Oregon Ridge Park trails in Cockeysville",
      "Hampton National Historic Site in Towson",
      "The Senator Theatre movie night in Baltimore",
      "Baltimore Museum of Art weekend visit",
    ],
  },
];

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
    .replace(/^\s*(?:[-*]|\d{1,2}[.)])\s*/, "")
    .replace(/^#+\s*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\bEllicott City,?\s+MD\b(?=.*\b21093\b)/gi, "Timonium, MD")
    .replace(/,\s*Low:.*$/i, "")
    .replace(/,\s*High:\s*/i, ", ")
    .replace(/,\s*\d{1,5}\s+[a-z0-9 .'-]+?\s+(?:st|street|rd|road|ave|avenue|blvd|drive|dr|lane|ln|pike|way|court|ct)\b.*$/i, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\([^)]*$/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.()\-–—]+|[\s:;,.()\-–—]+$/g, "")
    .trim();
  if (!cleaned) return null;
  if (
    /^(?:here are|here is|i found|these are|some options|events? happening|weather for|current conditions|i need a zip code|need a zip code|please provide a zip|tell me your zip code)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  if (
    /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|\w+\s+\d)/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  if (
    /\b(?:church|school|community center|event center)\b/i.test(cleaned) &&
    !/\b(?:concert|music|comedy|festival|market|show|movie|theater|theatre|trail|park|museum|historic site|visit|game|food)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  const repeatedName = cleaned.match(
    /^(.{3,60}?):\s*(?:explore|visit|enjoy|check out)\s+(?:the\s+)?\1\b(?:\s+.*)?$/i,
  );
  if (repeatedName?.[1]) return repeatedName[1].trim();
  return cleaned.length > 95 ? `${cleaned.slice(0, 92).trim()}...` : cleaned;
}

function normalizeAnswer(answer: string, query: string, location: string): string {
  const lines = answer
    .replace(/\r/g, "")
    .split(/\n+|(?=\b\d{1,2}[.)]\s+)/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d{1,2}[.)])\s*/, ""))
    .map(cleanAnswerLine)
    .filter((line): line is string => Boolean(line))
    .slice(0, 4);
  const selected =
    lines.length > 0
      ? lines
      : [cleanAnswerLine(answer)].filter(
          (line): line is string => Boolean(line),
        );
  const queryMatched = selected.filter((line) => answerLineMatchesQuery(line, query));
  let finalLines = queryMatched.length > 0 ? queryMatched : selected;
  if (
    isWeekendEventQuery(query) &&
    !/\b(?:craft|gem|jewelry|garden|painting|beer|bourbon|wine|bar crawl)\b/i.test(query)
  ) {
    const nonNicheLines = finalLines.filter((line) => !looksLikeNicheEvent(line));
    if (nonNicheLines.length > 0) {
      finalLines = nonNicheLines;
    }
    if (finalLines.length < 4) {
      const backfill =
        WEEKEND_BACKFILL_OPTIONS.find((entry) => entry.pattern.test(location))
          ?.lines ?? [];
      for (const line of backfill) {
        if (finalLines.length >= 4) break;
        const key = line.toLowerCase();
        if (!finalLines.some((existing) => existing.toLowerCase().includes(key))) {
          finalLines.push(line);
        }
      }
    }
  }
  return truncateUtf8String(
    finalLines.map((line, index) => `${index + 1}. ${line}`).join("\n"),
    MAX_ANSWER_CHARS,
  );
}

function isWeatherQuery(query: string): boolean {
  return /\b(?:weather|forecast)\b/i.test(query);
}

function isConcertQuery(query: string): boolean {
  return /\b(?:concert|concerts|live music|music|band|bands|show|shows)\b/i.test(
    query,
  );
}

function isWeekendEventQuery(query: string): boolean {
  return /\b(?:weekend|things to do|cool things|places to go|events?)\b/i.test(
    query,
  );
}

function looksLikeNicheEvent(line: string): boolean {
  return /\b(?:beer|bourbon|wine|bar crawl|craft|crafts|craft market|crafts galore|gem|jewelry|garden show|antique|toy expo|car show|home and garden|painting|paint night|vendor fair|flea market)\b/i.test(
    line,
  );
}

function answerLineMatchesQuery(line: string, query: string): boolean {
  if (isConcertQuery(query)) {
    const hasMusicSignal =
      /\b(?:concert|music|live music|band|bands|singer|songwriter|orchestra|symphony|jazz|blues|rock|folk|country|performance|theater|theatre|venue)\b/i.test(
        line,
      );
    return hasMusicSignal || !looksLikeNicheEvent(line);
  }
  if (isWeekendEventQuery(query)) {
    const hasBroadAppealSignal =
      /\b(?:concert|music|comedy|stand[-\s]?up|show|festival|food|restaurant|sports|game|hike|trail|park|outdoor|family|movie|theater|theatre|museum|farmers market)\b/i.test(
        line,
      );
    return hasBroadAppealSignal || !looksLikeNicheEvent(line);
  }
  return true;
}

function extractResponse(
  data: Record<string, unknown>,
  query: string,
  location: string,
): {
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
    answer: answer ? normalizeAnswer(answer, query, location) : null,
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
    const weatherQuery = isWeatherQuery(query);
    const easternDate = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());

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
              weatherQuery
                ? "You help a-i-ASAP's voice assistant, 6, check current weekend weather. Return exactly 3 short lines for the supplied location, formatted as plain numbered lines. Line 1 is Saturday. Line 2 is Sunday. Line 3 is the best quick weekend call. Do not include Monday or weekday forecasts. No intro line. No markdown links, source names, URLs, or click language. Each line must be under 75 characters and spoken-friendly. Never invent a forecast; use current search results. ZIP 21093 is Timonium, Maryland."
                : "You help a-i-ASAP's voice assistant, 6, find current online information. Return exactly 4 short, useful starter ideas near the supplied location, formatted as plain numbered lines. Each line must start with the actual event, place, or option name. No intro line. No labels like When, Where, Host, or Link. Each line must be under 80 characters. Be practical and spoken-friendly. Never dump a top 10 list. Never assume a city, state, or country that was not supplied by the location field or current search results. If the location is vague or insufficient, say you need a ZIP code or city. For broad weekend/events/things-to-do queries, assume a brand-new user and prioritize broadly useful options like live music, comedy, outdoor/family plans, sports, food, museums, or notable local events; if the exact town lacks enough suitable options, widen to nearby Baltimore County, Towson, or Baltimore within a normal local drive. Exclude alcohol-first events such as beer, bourbon, wine, and bar crawls unless the user asked for them. Exclude niche craft markets, gem/jewelry shows, garden shows, painting classes, vendor fairs, car shows, and toy expos unless the user asked for them. For concert, show, band, or live music queries, return only actual music/performance options; exclude craft markets, gem/jewelry shows, garden shows, car shows, toy expos, generic markets, and expos unless live music is the main event. Do not invent addresses, hours, closures, fees, or safety conditions. Do not include markdown links, source names, URLs, or tell the user to click links. ZIP 21093 is Timonium, Maryland.",
          },
          {
            role: "user",
            content: weatherQuery
              ? `Current Eastern date: ${easternDate}. Find the upcoming Saturday and Sunday weekend weather forecast near: ${location}. Query: ${query}. Return only the forecast lines.`
              : `Current Eastern date: ${easternDate}. For weekend queries, use the upcoming Saturday and Sunday after this date. Find useful current options for: ${query}. Search near: ${location}.`,
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
    const { answer, sources } = extractResponse(data, query, location);
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
