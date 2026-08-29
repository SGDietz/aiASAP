import { NextResponse } from "next/server";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { sendTelegramAlert } from "../../../../src/lib/telegramAlert";
import { notifyTeam } from "../../../../src/lib/teamNotify";
import { ABANDONED_AFTER_MS } from "../../../../src/lib/interview/ledger";

/**
 * THE CLOUD WATCHER. G, 2026-08-21:
 *
 *   "You are on a desktop always-on computer. Doesn't matter though because a
 *    lot of times it's off... The laptop is off eighty percent of the time. So
 *    it cannot be counted on for anything. Yes. We want everything set up
 *    cloud based first and foremost."
 *
 * That is a correction to how the alerting was built. Scheduled\aiasap_failure_watch.ps1
 * runs on a machine that is off most of the time, so it cannot be the primary
 * watcher - a watcher that is usually asleep reports "all clear" by being
 * silent, which is indistinguishable from everything being on fire.
 *
 * This runs on Vercel, which is always on. The Windows task stays as the third
 * leg, not the first. G's rule: "two is one, one is none."
 *
 * WHY SILENCE IS A FINDING. Once a day this fires with ?daily=1 and reports
 * even when nothing is wrong. A quiet phone then means the watcher is alive
 * and found nothing, rather than dead. Without that, the most dangerous state
 * in the whole system - watcher down, site down, nobody told - looks exactly
 * like a good day.
 */

export const maxDuration = 60;

/** Overlaps the 15-minute schedule on purpose: better a repeat than a gap. */
const LOOKBACK_MINUTES = 20;

function authorized(request: Request): boolean {
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  if (ua.includes("vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth === `Bearer ${secret}`) return true;
    if (new URL(request.url).searchParams.get("key") === secret) return true;
  }
  return false;
}

type Finding = { headline: string; detail: string };

async function query(
  path: string,
): Promise<{ rows: unknown[]; reachable: boolean }> {
  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return { rows: [], reachable: false };
  }
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      cache: "no-store",
    });
    // A 404 is a table that does not exist yet - a known state, not an outage.
    // Anything else non-OK means we genuinely could not see the database.
    if (res.status === 404) return { rows: [], reachable: true };
    if (!res.ok) return { rows: [], reachable: false };
    const rows = await res.json();
    return { rows: Array.isArray(rows) ? rows : [], reachable: true };
  } catch {
    return { rows: [], reachable: false };
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "not authorized" }, { status: 401 });
  }
  const daily = new URL(request.url).searchParams.get("daily") === "1";

  const now = Date.now();
  const since = new Date(now - LOOKBACK_MINUTES * 60_000).toISOString();
  const findings: Finding[] = [];
  let blind = false;

  // ── 1. errors the app logged itself ───────────────────────────────────────
  const errs = await query(
    `error_logs?select=message,route,created_at,level&created_at=gt.${since}` +
      `&level=in.(error,fatal)&order=created_at.desc&limit=50`,
  );
  if (!errs.reachable) blind = true;
  if (errs.rows.length > 0) {
    const r = errs.rows as Array<{ message?: string; route?: string }>;
    // Group by route: one broken route failing forty times is ONE problem, and
    // forty lines of the same thing trains G to stop reading the alerts.
    const byRoute = new Map<string, number>();
    for (const e of r) byRoute.set(e.route || "unknown", (byRoute.get(e.route || "unknown") ?? 0) + 1);
    const worst = [...byRoute.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    findings.push({
      headline: `${r.length} error${r.length === 1 ? "" : "s"} in the last ${LOOKBACK_MINUTES} minutes`,
      detail:
        worst.map(([route, n]) => `${route} x${n}`).join("\n") +
        `\n\nNewest: ${(r[0]?.message ?? "").slice(0, 300)}`,
    });
  }

  // ── 2. events the app itself called serious ───────────────────────────────
  const events = await query(
    `app_events?select=event_type,severity,route,error_code,created_at&created_at=gt.${since}` +
      `&severity=in.(high,critical)&order=created_at.desc&limit=50`,
  );
  if (!events.reachable) blind = true;
  if (events.rows.length > 0) {
    const r = events.rows as Array<{ event_type?: string; severity?: string; error_code?: string }>;
    const byType = new Map<string, number>();
    for (const e of r) byType.set(e.event_type || "unknown", (byType.get(e.event_type || "unknown") ?? 0) + 1);
    findings.push({
      headline: `${r.length} serious event${r.length === 1 ? "" : "s"}`,
      detail: [...byType.entries()].map(([t, n]) => `${t} x${n}`).join("\n"),
    });
  }

  // ── 3. 6 has gone quiet ──────────────────────────────────────────────────
  // Moved here from the Windows watcher. A silent 6 is the worst failure the
  // site has - the page looks fine, the person keeps talking, nothing answers -
  // and it was being watched by a machine that is off most of the time.
  const mute = await query(
    `app_events?select=created_at&event_type=eq.voice_avatar_repeat_failed` +
      `&created_at=gt.${since}&limit=50`,
  );
  if (!mute.reachable) blind = true;
  // One failure is a hiccup and self-heals. A cluster means he is not speaking.
  if (mute.rows.length >= 3) {
    findings.push({
      headline: `6 MAY BE MUTE - ${mute.rows.length} speech failures`,
      detail:
        "The avatar failed to speak repeatedly in the last " +
        `${LOOKBACK_MINUTES} minutes. To the person on the other end the site ` +
        "looks fine and nothing answers. Check before anything else.",
    });
  }

  // ── 4. interviews somebody walked away from ───────────────────────────────
  // Not a failure - a lead. Somebody told 6 about their business and never
  // came back, and nobody would ever know without this.
  const cutoff = new Date(now - ABANDONED_AFTER_MS).toISOString();
  const stale = await query(
    `interview_ledgers?select=user_id,updated_at,ledger&updated_at=lt.${cutoff}&limit=25`,
  );
  const abandoned = (stale.rows as Array<{ user_id?: string; ledger?: { status?: string } }>).filter(
    (row) => row?.ledger?.status !== "complete" && row?.ledger?.status !== "abandoned",
  );
  if (abandoned.length > 0) {
    findings.push({
      headline: `${abandoned.length} interview${abandoned.length === 1 ? "" : "s"} went quiet over a week ago`,
      detail:
        "Somebody started telling 6 about their business and never came back. " +
        "These are leads, not bugs - worth a note from Scott.",
    });
  }

  // ── 5. the worst state of all: we cannot see ──────────────────────────────
  if (blind) {
    findings.push({
      headline: "CANNOT READ THE DATABASE",
      detail:
        "The watcher ran but could not reach Supabase, so it does not know whether anything is wrong. " +
        "Treat this as louder than a normal error, not quieter.",
    });
  }

  const clean = findings.length === 0;

  if (!clean || daily) {
    const title = clean
      ? "aiASAP daily check: all clear"
      : `aiASAP: ${findings.length} thing${findings.length === 1 ? "" : "s"} to look at`;
    const body = clean
      ? `Nothing wrong in the last ${LOOKBACK_MINUTES} minutes. This message exists so a quiet phone means the watcher is alive, not dead.`
      : findings.map((f) => `${f.headline}\n${f.detail}`).join("\n\n");

    // Keyed so a route failing on a loop sends once, not on every run.
    await sendTelegramAlert(
      clean ? "aiasap-daily-allclear" : `aiasap-health:${findings[0].headline}`,
      `${title}

${body}`,
    );

    // Email carries the same news to a place that is still there tomorrow.
    // Only for real findings - a daily all-clear by email is how an inbox
    // teaches somebody to filter the alerts they actually need.
    if (!clean) {
      await notifyTeam({
        kind: "system_trouble",
        who: "The aiASAP watcher",
        facts: findings.map((f) => [f.headline, f.detail] as [string, string]),
        nextStep: "Check the site and the logs before anything else today.",
        dedupeKey: `health:${new Date().toISOString().slice(0, 13)}`,
      });
    }
  }

  // HEARTBEAT. This watcher cannot detect its own death - if Vercel stops
  // running the cron, the silence looks exactly like good news. So it stamps
  // every run, and a machine OUTSIDE Vercel watches for the stamp going stale.
  // That is the one job a sometimes-on laptop is genuinely better at than the
  // cloud: being somewhere else.
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    await fetch(`${url}/rest/v1/app_events`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_type: "cloud_watch_heartbeat",
        severity: "low",
        surface: "aiasap",
        route: "/api/cron/health",
        outcome: clean ? "clean" : "findings",
      }),
    });
  } catch {
    // A missed heartbeat is itself the alarm the outside watcher looks for,
    // so failing to write one needs no handling here.
  }

  // Always 200. A non-2xx makes Vercel retry, and a retry storm on a watcher
  // is a second outage on top of the first.
  return NextResponse.json({
    ok: true,
    clean,
    blind,
    findings: findings.map((f) => f.headline),
    checkedAt: new Date(now).toISOString(),
  });
}
