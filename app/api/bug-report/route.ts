import { NextResponse } from "next/server";
import { assertAllowedOrigin } from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { getUserId } from "../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../src/lib/supabaseAdmin";
import { captureServerError } from "../../../src/lib/observability/serverLogger";

// r29 (2026-06-12, G's order): "when a user says, that doesn't work right...
// that should key 6 in and then he should auto launch a bug report that gets
// emailed to me automatically with a plain english full report." Re-enabled
// from the 410 beta stub. Row lands in public.bug_reports either way; the
// email is best-effort on top.

const FROM = process.env.BUG_REPORT_FROM_EMAIL || "";
const TO = process.env.AIASAP_FOUNDER_REPORT_EMAIL || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

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
    .filter((l) => l.text);
}

function plainEnglishReport(args: {
  trigger: string;
  transcript: Array<{ role: string; text: string }>;
  listSnapshot: unknown;
  device: Record<string, unknown> | null;
  sessionId: string | null;
  userId: string | null;
}): string {
  const when = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const lines: string[] = [];
  lines.push("6 here - caught a bug.");
  lines.push("");
  lines.push("A user hit a problem on aiASAP. I grabbed everything below so the team can fix it.");
  lines.push("");
  lines.push(`When: ${when} (Eastern)`);
  lines.push(`What they said: "${args.trigger}"`);
  lines.push(`Session: ${args.sessionId ?? "unknown"}`);
  lines.push(`Signed in: ${args.userId ? "yes" : "no"}`);
  if (args.device) {
    const d = args.device;
    lines.push(
      `Device: ${String(d.deviceKind ?? "?")}, screen ${String(d.screen ?? "?")}, viewport ${String(d.viewport ?? "?")}, mode ${String(d.mode ?? "?")}`,
    );
    lines.push(`Browser: ${String(d.userAgent ?? "?")}`);
  }
  if (Array.isArray(args.listSnapshot) && args.listSnapshot.length > 0) {
    lines.push("");
    lines.push("What was on the screen list:");
    for (const item of args.listSnapshot.slice(0, 30)) {
      lines.push(`  - ${String(item).slice(0, 200)}`);
    }
  }
  if (args.transcript.length > 0) {
    lines.push("");
    lines.push("The talk right before the problem (oldest first):");
    for (const l of args.transcript) {
      lines.push(`  ${l.role === "user" ? "User" : "6"}: ${l.text}`);
    }
  }
  lines.push("");
  lines.push(
    "Full row saved in Supabase table bug_reports with the same session id.",
  );
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
    list_snapshot?: unknown;
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
  const listSnapshot = Array.isArray(body.list_snapshot)
    ? body.list_snapshot
    : null;
  const userId = await getUserId();

  const report = plainEnglishReport({
    trigger,
    transcript,
    listSnapshot,
    device,
    sessionId,
    userId,
  });

  // 1) Email G (best-effort).
  let emailed = false;
  let emailError: string | null = null;
  if (RESEND_API_KEY && FROM && TO) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          subject: `6 here - caught a bug: "${trigger.slice(0, 50)}"`,
          text: report,
        }),
      });
      emailed = resp.ok;
      if (!resp.ok) emailError = `resend ${resp.status}`;
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
    }
  } else {
    emailError = "email env not configured";
  }

  // 2) Persist the row (also best-effort, but logged loudly on failure).
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    await fetch(`${url}/rest/v1/bug_reports`, {
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
        list_snapshot: listSnapshot,
        device,
        emailed,
        email_error: emailError,
      }),
    });
  } catch (e) {
    await captureServerError({
      message: "bug_reports insert failed",
      error: e,
      route: "/api/bug-report",
      session_id: sessionId,
    });
  }

  return NextResponse.json({ ok: true, emailed });
}
