import { NextResponse } from "next/server";
import { assertAllowedOrigin } from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { getUserId } from "../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../src/lib/supabaseAdmin";
import { captureServerError } from "../../../src/lib/observability/serverLogger";
import { sendPurposeEmail } from "../../../src/lib/emailSenders";

// r30 (G 2026-06-12, email system round): when a user tells 6 something nice
// or pitches an idea ("you should add...", "I wish you could..."), that's
// gold — save it to public.user_feedback and email G from UserFeedback@.
// Same shape as /api/bug-report on purpose: one pattern, two tables.

const TO = process.env.AIASAP_FOUNDER_REPORT_EMAIL || "";
const MAX_TRIGGER = 1000;
const MAX_TRANSCRIPT_LINES = 16;
const MAX_LINE = 400;

type TranscriptLine = { role?: unknown; text?: unknown };

function cleanTranscript(
  raw: unknown,
): Array<{ role: string; text: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-MAX_TRANSCRIPT_LINES)
    .map((l: TranscriptLine) => ({
      role: typeof l?.role === "string" ? l.role.slice(0, 20) : "?",
      text: typeof l?.text === "string" ? l.text.slice(0, MAX_LINE) : "",
    }))
    .filter((l) => l.text)
    // r33 (G: "why is so much written twice?"): consecutive identical lines
    // are double-writer artifacts — the email shows each line once.
    .filter(
      (l, i, arr) =>
        i === 0 || l.text !== arr[i - 1].text || l.role !== arr[i - 1].role,
    );
}

function plainEnglishReport(args: {
  trigger: string;
  transcript: Array<{ role: string; text: string }>;
  device: Record<string, unknown> | null;
  sessionId: string | null;
  userId: string | null;
}): string {
  const when = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const lines: string[] = [];
  lines.push("6 here - a user just gave us feedback worth reading.");
  lines.push("");
  lines.push(`When: ${when} (Eastern)`);
  lines.push(`What they said: "${args.trigger}"`);
  lines.push(`Session: ${args.sessionId ?? "unknown"}`);
  lines.push(`Signed in: ${args.userId ? "yes" : "no"}`);
  if (args.device) {
    const d = args.device;
    lines.push(
      `Device: ${String(d.deviceKind ?? "?")}, mode ${String(d.mode ?? "?")}`,
    );
  }
  if (args.transcript.length > 0) {
    lines.push("");
    lines.push("The talk around it (oldest first):");
    for (const l of args.transcript) {
      lines.push(`  ${l.role === "user" ? "User" : "6"}: ${l.text}`);
    }
  }
  lines.push("");
  lines.push("Full row saved in Supabase table user_feedback.");
  return lines.join("\n");
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  let body: {
    trigger_text?: unknown;
    session_id?: unknown;
    transcript?: unknown;
    device?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const trigger =
    typeof body.trigger_text === "string"
      ? body.trigger_text.slice(0, MAX_TRIGGER)
      : "";
  if (!trigger.trim()) {
    return NextResponse.json(
      { error: "trigger_text required" },
      { status: 400 },
    );
  }

  const sessionId =
    typeof body.session_id === "string" ? body.session_id.slice(0, 200) : null;
  const transcript = cleanTranscript(body.transcript);
  const device =
    body.device && typeof body.device === "object"
      ? (body.device as Record<string, unknown>)
      : null;
  const userId = await getUserId();

  const report = plainEnglishReport({
    trigger,
    transcript,
    device,
    sessionId,
    userId,
  });

  let emailed = false;
  let emailError: string | null = null;
  // r35: same testing gate as bug emails — rows always land.
  if (process.env.BUG_EMAILS_ENABLED === "false") {
    emailError = "emails off for testing (BUG_EMAILS_ENABLED=false)";
  } else if (TO) {
    const sent = await sendPurposeEmail({
      purpose: "feedback",
      to: TO,
      subject: `6 here - user feedback: "${trigger.slice(0, 50)}"`,
      text: report,
    });
    emailed = sent.ok;
    emailError = sent.error;
  } else {
    emailError = "founder email not configured";
  }

  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    await fetch(`${url}/rest/v1/user_feedback`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        trigger_text: trigger,
        report,
        transcript,
        device,
        emailed,
        email_error: emailError,
      }),
    });
  } catch (e) {
    await captureServerError({
      message: "user_feedback insert failed",
      error: e,
      route: "/api/user-feedback",
      session_id: sessionId,
    });
  }

  return NextResponse.json({ ok: true, emailed });
}
