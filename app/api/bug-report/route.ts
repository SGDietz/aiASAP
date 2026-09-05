import { NextResponse } from "next/server";
import { assertAllowedOrigin } from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { getUserId } from "../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../src/lib/supabaseAdmin";
import { captureServerError } from "../../../src/lib/observability/serverLogger";
import { sendPurposeEmail } from "../../../src/lib/emailSenders";
import {
  emailShell,
  emailRows,
  emailQuote,
  emailChat,
  emailDivider,
  emailFine,
  emailParagraph,
} from "../../../src/lib/emailTheme";

// r29 (2026-06-12, G's order): "when a user says, that doesn't work right...
// that should key 6 in and then he should auto launch a bug report that gets
// emailed to me automatically with a plain english full report." Re-enabled
// from the 410 beta stub. Row lands in public.bug_reports either way; the
// email is best-effort on top.

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

/**
 * The HTML half of the bug mail. The plain-text `plainEnglishReport` above is
 * unchanged and still goes out as text/plain - this only decides how the same
 * facts are PAINTED, per G 2026-09-04: "make these beautiful."
 *
 * Order is deliberate. What the person actually said leads, because that is
 * the only part a human has to read to know what went wrong; the machine
 * facts follow as rows, and the conversation sits at the bottom for when the
 * quote alone is not enough.
 */
function bugReportHtml(args: {
  trigger: string;
  transcript: Array<{ role: string; text: string }>;
  device: Record<string, unknown> | null;
  sessionId: string | null;
  userId: string | null;
}): string {
  const when = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const d = args.device;
  return [
    emailParagraph("Someone hit a problem on aiASAP. Here is everything I grabbed."),
    emailQuote(args.trigger),
    emailRows([
      ["When", when + " Eastern"],
      ["Session", args.sessionId ?? "unknown"],
      ["Signed in", args.userId ? "yes" : "no"],
      [
        "Device",
        d
          ? `${String(d.deviceKind ?? "?")} - screen ${String(d.screen ?? "?")}, viewport ${String(d.viewport ?? "?")}, mode ${String(d.mode ?? "?")}`
          : null,
      ],
      ["Browser", d ? String(d.userAgent ?? "?") : null],
    ]),
    args.transcript.length
      ? emailParagraph("<strong>The talk right before it</strong> (oldest first)")
      : "",
    emailChat(args.transcript.slice(-12)),
    emailDivider(),
    emailFine(
      "The full row is in Supabase table bug_reports under the same session id.",
    ),
  ].join("");
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

  // 1) Email G (best-effort, via the purpose-routed sender catalog).
  // r35 (G 2026-06-12 21:58: "I'm getting a lot of emails about bugs...
  // that needs to be turned off while we're testing"): BUG_EMAILS_ENABLED
  // gates the EMAIL only — the row always lands in bug_reports.
  let emailed = false;
  let emailError: string | null = null;
  if (process.env.BUG_EMAILS_ENABLED === "false") {
    emailError = "emails off for testing (BUG_EMAILS_ENABLED=false)";
  } else if (TO) {
    const sent = await sendPurposeEmail({
      purpose: "bug",
      to: TO,
      subject: `6 here - caught a bug: "${trigger.slice(0, 50)}"`,
      text: report,
      // G 2026-08-25: aiASAP theme colours. Copy unchanged - only painted.
      html: emailShell({
        title: `6 here - caught a bug`,
        heading: "6 caught a bug.",
        align: "left",
        // G, 2026-09-04: "make these beautiful." The plain-text `report` still
        // goes out as the text/plain part untouched - this only paints the HTML
        // one, so the visitor's own words lead instead of sitting in the middle
        // of a wall of machine facts.
        bodyHtml: bugReportHtml({
          trigger,
          transcript,
          device,
          sessionId,
          userId,
        }),
      }),
    });
    emailed = sent.ok;
    emailError = sent.error;
  } else {
    emailError = "founder email not configured";
  }

  // 2) Persist the row. Email remains best-effort, but persistence must never
  // report success on a Supabase 4xx/5xx.
  let persisted = false;
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const res = await fetch(`${url}/rest/v1/bug_reports`, {
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
        summary: trigger,
        trigger_text: trigger,
        report,
        transcript,
        active_list: listSnapshot,
        list_snapshot: listSnapshot,
        device,
        emailed,
        email_error: emailError,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      await captureServerError({
        message: "bug_reports insert non-2xx",
        error: new Error(
          `status=${res.status} body=${detail.slice(0, 400)}`,
        ),
        route: "/api/bug-report",
        session_id: sessionId,
      });
    } else {
      persisted = true;
    }
  } catch (e) {
    await captureServerError({
      message: "bug_reports insert failed",
      error: e,
      route: "/api/bug-report",
      session_id: sessionId,
    });
  }

  return NextResponse.json(
    persisted
      ? { ok: true, emailed, persisted: true }
      : {
          ok: false,
          emailed,
          persisted: false,
          error: "Bug report could not be saved",
        },
    { status: persisted ? 200 : 500 },
  );
}
