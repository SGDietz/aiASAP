import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { checkLocalLimit } from "../../../../src/lib/localRateLimit";
import { notifyTeam, type TeamNotifyKind } from "../../../../src/lib/teamNotify";

/**
 * "Tell the team something happened."
 *
 * G, 2026-08-21: "when anything new comes in that the team needs to know about,
 * an auto email is sent with all the important info."
 *
 * Signup already notifies from the server, where it belongs. But the events
 * that matter most are things 6 HEARS - somebody saying yes to the five
 * thousand, somebody finishing the interview, somebody giving feedback on a
 * build. Those only exist in the browser, so they need a door.
 *
 * Ara's step 3 in the after-yes sequence is exactly this: "6 (or the laptop)
 * pings Scott: name, email, yes to the five thousand package." Without it the
 * whole sale sits in a transcript nobody reads and G never learns it happened.
 *
 * DELIBERATELY NARROW. Only a fixed list of kinds, only short strings, rate
 * limited, same-origin, and it never touches a paid provider. The worst a
 * caller can do with it is send G an email he was going to get anyway.
 */

const ALLOWED: ReadonlySet<string> = new Set<TeamNotifyKind>([
  "interview_complete",
  "interview_stopped_early",
  "photos_received",
  "build_feedback",
  "mission_answered",
  "consent_declined",
  // new_account is fired server-side by /api/account/start, not from here.
]);

/** Six an hour per caller is far above real use and far below worth abusing. */
const NOTIFY_LIMIT = { windowMs: 60 * 60_000, maxRequests: 6, maxCost: 6 };

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s ? s : null;
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;

  const verdict = checkLocalLimit(request, "team-notify", 1, [NOTIFY_LIMIT]);
  if (!verdict.allowed) {
    console.warn(`[team-notify] rejected (${verdict.reason})`);
    return new Response(JSON.stringify({ ok: false, error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(verdict.retryAfterSeconds),
      },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const kind = clean(body.kind, 40);
  if (!kind || !ALLOWED.has(kind)) {
    return new Response(JSON.stringify({ ok: false, error: "unknown kind" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const who = clean(body.who, 200) ?? "Someone";
  const email = clean(body.email, 254);
  const sessionId = clean(body.sessionId, 128);
  const note = clean(body.note, 2000);

  // The caller may pass a few extra facts, but only as short label/value pairs —
  // never a free-form blob that could turn the email into someone else's payload.
  const facts: Array<[string, string | null]> = [];
  if (Array.isArray(body.facts)) {
    for (const f of (body.facts as unknown[]).slice(0, 8)) {
      if (!Array.isArray(f) || f.length < 2) continue;
      const label = clean(f[0], 60);
      const value = clean(f[1], 400);
      if (label && value) facts.push([label, value]);
    }
  }
  if (note) facts.push(["What they said", note]);

  const result = await notifyTeam({
    kind: kind as TeamNotifyKind,
    who,
    email,
    facts,
    sessionId,
    // One event per session per kind. A retry, a double-click or a re-render
    // cannot tell G twice about the same thing.
    dedupeKey: `${sessionId ?? "nosession"}:${email ?? who}`,
  });

  // Always 200: the caller is 6's browser mid-conversation and a failed
  // notification must never surface to the person he is talking to.
  return new Response(JSON.stringify({ ok: result.emailed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
