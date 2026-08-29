import { NextResponse } from "next/server";
import {
  listPendingDeletions,
  markReminderSent,
} from "../../../../src/lib/accountDeletionSchedule";
import { purgeUserData } from "../../../../src/lib/purgeUserData";
import { signActionToken } from "../../../../src/lib/accountActionToken";
import { sendResendEmail } from "../../../../src/lib/sendResendEmail";
import {
  buildDeletionWeekBeforeEmailHtml,
  buildDeletionDayBeforeEmailHtml,
  buildDeletionDoneEmailHtml,
} from "../../../../src/lib/accountDeletionEmails";

/**
 * Daily auto-cleanup (G 2026-06-07). For every account in the 30-day grace:
 *   - 1 week left  -> send the "1 week" email (with Delete-now + Cancel) once
 *   - 1 day left   -> send the "1 day" email once
 *   - past the date -> PURGE everything + delete the account + send "done" email
 *
 * Runs daily via Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`; we also accept ?key=<CRON_SECRET> for
 * manual testing on preview (Vercel Cron only fires on production deployments).
 */
export const maxDuration = 300;

function authorized(request: Request): boolean {
  // Vercel cron calls carry this User-Agent (same pattern as the existing
  // cleanup-unconfirmed cron), so the daily job authorizes in production with no
  // extra config. Also accept a CRON_SECRET via Bearer or ?key= for manual runs.
  // Low blast radius: only purges deletions already past their 30-day window.
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

function purgeDateText(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const origin = (() => {
    try {
      return new URL(request.url).origin;
    } catch {
      return "";
    }
  })();
  const now = Date.now();
  const pending = await listPendingDeletions();
  const actions: Array<Record<string, unknown>> = [];

  for (const p of pending) {
    const purgeAt = Date.parse(p.schedule.purge_at);
    const msLeft = purgeAt - now;
    const daysLeft = msLeft / 86_400_000;

    if (msLeft <= 0) {
      const { checkDestructiveActionAllowed } = await import(
        "../../../../src/lib/accountProtection"
      );
      const protection = await checkDestructiveActionAllowed(
        p.userId,
        "cron_purge",
      );
      if (protection.allowed === false) {
        actions.push({ action: "protected_skip", code: protection.code });
        continue;
      }
      const result = await purgeUserData(p.userId, p.email, true);
      if (p.email) {
        await sendResendEmail({
          to: p.email,
          subject: "Your aiASAP data has been deleted",
          html: buildDeletionDoneEmailHtml(),
          idempotencyKey: `del-done:${p.userId}`,
        });
      }
      actions.push({
        uid: p.userId.slice(0, 8),
        action: "purged",
        accountClosed: result.accountClosed,
      });
    } else if (daysLeft <= 1 && !p.schedule.reminder_day_sent) {
      if (p.email) {
        const cancelLink = `${origin}/api/account/cancel-deletion?token=${encodeURIComponent(
          signActionToken("cancel", p.userId, p.email),
        )}`;
        await sendResendEmail({
          to: p.email,
          subject: "1 day until your aiASAP data is deleted",
          html: buildDeletionDayBeforeEmailHtml(cancelLink, purgeDateText(p.schedule.purge_at)),
          idempotencyKey: `del-day:${p.userId}`,
        });
      }
      await markReminderSent(p.userId, "day");
      actions.push({ uid: p.userId.slice(0, 8), action: "reminded_day" });
    } else if (daysLeft <= 7 && !p.schedule.reminder_week_sent) {
      if (p.email) {
        const cancelLink = `${origin}/api/account/cancel-deletion?token=${encodeURIComponent(
          signActionToken("cancel", p.userId, p.email),
        )}`;
        await sendResendEmail({
          to: p.email,
          subject: "1 week until your aiASAP data is deleted",
          html: buildDeletionWeekBeforeEmailHtml(
            cancelLink,
            purgeDateText(p.schedule.purge_at),
          ),
          idempotencyKey: `del-week:${p.userId}`,
        });
      }
      await markReminderSent(p.userId, "week");
      actions.push({ uid: p.userId.slice(0, 8), action: "reminded_week" });
    }
  }

  console.log(
    `[cron/purge-deletions] pending=${pending.length} actions=${JSON.stringify(actions)}`,
  );
  return NextResponse.json({ ok: true, pending: pending.length, actions });
}
