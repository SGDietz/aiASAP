import {
  MAX_TRANSCRIPTION_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { getSupabaseAdminConfig } from "../../../src/lib/supabaseAdmin";

const AIASAP_FOUNDER_TITLE = "G Dietz, Creator and Builder of aiASAP";
const BUG_REPORT_BUCKET = process.env.AIASAP_ACCOUNT_BUCKET || "aiasap-accounts";
const MAX_BUG_SUMMARY_CHARS = 900;
const MAX_PAGE_URL_CHARS = 600;

type BugReportPayload = {
  sessionId?: unknown;
  summary?: unknown;
  transcript?: unknown;
  pageUrl?: unknown;
  activeList?: unknown;
};

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function storageHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function cleanOptionalString(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = truncateUtf8String(value.trim(), maxChars);
  return cleaned ? cleaned : null;
}

function cleanActiveList(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const maybe = value as Record<string, unknown>;
  const title = cleanOptionalString(maybe.title, 120);
  const displayStyle = cleanOptionalString(maybe.displayStyle, 40);
  const accentColor = cleanOptionalString(maybe.accentColor, 40);
  const accentHex = cleanOptionalString(maybe.accentHex, 20);
  const accentLabel = cleanOptionalString(maybe.accentLabel, 40);
  const items = Array.isArray(maybe.items)
    ? maybe.items
        .filter((item): item is string => typeof item === "string")
        .slice(0, 80)
        .map((item) => truncateUtf8String(item.trim(), 120))
        .filter(Boolean)
    : [];

  return { title, displayStyle, accentColor, accentHex, accentLabel, items };
}

async function storeBugReport(row: Record<string, unknown>) {
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const res = await fetch(`${url}/rest/v1/bug_reports`, {
      method: "POST",
      headers: supabaseHeaders(serviceRoleKey),
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      console.error("bug-report Supabase insert failed:", await res.text());
      return null;
    }

    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (error) {
    console.error("bug-report Supabase unavailable:", error);
    return null;
  }
}

async function storeBugReportFallback(row: Record<string, unknown>) {
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const iso = now.toISOString().replace(/[:.]/g, "-");
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `bug-reports/${yyyy}-${mm}/${iso}-${rand}.json`;
    const res = await fetch(
      `${url}/storage/v1/object/${BUG_REPORT_BUCKET}/${encodeURI(path)}`,
      {
        method: "POST",
        headers: {
          ...storageHeaders(serviceRoleKey),
          "x-upsert": "false",
        },
        body: JSON.stringify({ ...row, stored_at: now.toISOString() }),
      },
    );
    if (!res.ok) {
      console.error("bug-report storage fallback failed:", await res.text());
      return null;
    }
    return path;
  } catch (error) {
    console.error("bug-report storage fallback unavailable:", error);
    return null;
  }
}

async function emailBugReport(report: {
  summary: string;
  sessionId: string | null;
  pageUrl: string | null;
  founderEmail: string;
  storedId: string | null;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.BUG_REPORT_FROM_EMAIL || "aiASAP <bugs@aiasap.ai>";
  if (!resendApiKey || !report.founderEmail) return false;

  const body = [
    `For: ${AIASAP_FOUNDER_TITLE}`,
    report.storedId ? `Note ID: ${report.storedId}` : null,
    report.sessionId ? `Session ID: ${report.sessionId}` : null,
    report.pageUrl ? `Page: ${report.pageUrl}` : null,
    "",
    report.summary,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "aiASAP/1.0",
      },
      body: JSON.stringify({
        from,
        to: report.founderEmail,
        subject: `aiASAP note for ${AIASAP_FOUNDER_TITLE}`,
        text: body,
      }),
    });

    if (!res.ok) {
      console.error("bug-report email failed:", await res.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("bug-report email unavailable:", error);
    return false;
  }
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = (await request.json()) as BugReportPayload;
    const summary = cleanOptionalString(body.summary, MAX_BUG_SUMMARY_CHARS);
    if (!summary) {
      return new Response(JSON.stringify({ error: "summary is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rawSessionId = body.sessionId;
    const sessionId =
      typeof rawSessionId === "string" && isSafeTranscriptionSessionId(rawSessionId)
        ? rawSessionId.trim()
        : null;
    const transcript = cleanOptionalString(
      body.transcript,
      MAX_TRANSCRIPTION_TEXT_CHARS,
    );
    const pageUrl = cleanOptionalString(body.pageUrl, MAX_PAGE_URL_CHARS);
    const activeList = cleanActiveList(body.activeList);
    const founderEmail =
      process.env.AIASAP_FOUNDER_REPORT_EMAIL ||
      process.env.BUG_REPORT_TO_EMAIL ||
      "sgdietz@pm.me";

    const stored = await storeBugReport({
      session_id: sessionId,
      summary,
      transcript,
      page_url: pageUrl,
      active_list: activeList,
      recipient_title: AIASAP_FOUNDER_TITLE,
      email_to: founderEmail || null,
      source: "six_voice",
    });

    const storedId =
      stored && typeof stored.id === "string" ? (stored.id as string) : null;
    const fallbackPath = storedId
      ? null
      : await storeBugReportFallback({
          session_id: sessionId,
          summary,
          transcript,
          page_url: pageUrl,
          active_list: activeList,
          recipient_title: AIASAP_FOUNDER_TITLE,
          email_to: founderEmail || null,
          source: "six_voice",
        });
    const emailSent = await emailBugReport({
      summary,
      sessionId,
      pageUrl,
      founderEmail,
      storedId: storedId ?? fallbackPath,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        stored: Boolean(storedId || fallbackPath),
        noteId: storedId,
        reportId: storedId,
        storagePath: fallbackPath,
        emailSent,
        recipientTitle: AIASAP_FOUNDER_TITLE,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("bug-report route failed:", error);
    return new Response(JSON.stringify({ error: "Failed to file note" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
