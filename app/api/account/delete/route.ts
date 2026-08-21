import { NextResponse } from "next/server";
import { getUser } from "../../../../src/lib/auth/getUser";
import { purgeUserData } from "../../../../src/lib/purgeUserData";
import { scheduleAccountDeletion } from "../../../../src/lib/accountDeletionSchedule";
import { signActionToken } from "../../../../src/lib/accountActionToken";
import { buildDeletionScheduledEmailHtml } from "../../../../src/lib/accountDeletionEmails";
import { sendResendEmail } from "../../../../src/lib/sendResendEmail";

/**
 * User-initiated deletion (G 2026-06-07). Two scopes:
 *   - scope="memory"  : wipe their data NOW but KEEP the account (a clean slate;
 *                       they're staying, just forgetting). No grace period.
 *   - scope="account" : 30-DAY GRACE. We do NOT wipe now — we schedule the purge
 *                       30 days out, keep everything safe, and email a countdown
 *                       + cancel link. The daily cron purges at day 30. The user
 *                       can cancel anytime (link or by signing back in), or use
 *                       "delete now" to skip the wait.
 *
 * SAFETY: only ever touches the signed-in caller's OWN data. Requires confirm:true.
 */
export const maxDuration = 60;

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

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const userId = user.id;
  const email = user.email ?? null;

  let scope: "memory" | "account" = "memory";
  let confirmed = false;
  try {
    const body = await request.json();
    if (body?.scope === "account") scope = "account";
    confirmed = body?.confirm === true;
  } catch {
    // no body / bad json — treated as unconfirmed below
  }

  if (!confirmed) {
    return NextResponse.json(
      { error: "confirmation required", hint: "POST { confirm: true, scope }" },
      { status: 400 },
    );
  }

  const { checkDestructiveActionAllowed } = await import(
    "../../../../src/lib/accountProtection"
  );
  const protection = await checkDestructiveActionAllowed(
    userId,
    scope === "memory" ? "memory_wipe" : "account_delete",
  );
  if (protection.allowed === false) {
    return NextResponse.json(
      {
        error:
          protection.code === "protected_account"
            ? "This permanent account cannot be deleted or wiped"
            : "Deletion stopped because account protection could not be verified",
        code: protection.code,
      },
      { status: protection.code === "protected_account" ? 423 : 503 },
    );
  }

  // MEMORY scope = wipe data now, keep the account. No grace (they're staying).
  if (scope === "memory") {
    const result = await purgeUserData(userId, email, false);
    return NextResponse.json({
      ok: result.ok,
      scope,
      accountClosed: false,
      deleted: result.deleted,
    });
  }

  // ACCOUNT scope = 30-day grace. Schedule, don't wipe yet, email the countdown.
  const schedule = await scheduleAccountDeletion(userId, 30);
  if (!schedule) {
    return NextResponse.json(
      { error: "could not schedule deletion" },
      { status: 500 },
    );
  }

  let emailSent = false;
  if (email) {
    const origin = (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return "";
      }
    })();
    const cancelToken = signActionToken("cancel", userId, email);
    const cancelLink = `${origin}/api/account/cancel-deletion?token=${encodeURIComponent(cancelToken)}`;
    emailSent = await sendResendEmail({
      to: email,
      subject: "Your aiASAP account will close in 30 days",
      html: buildDeletionScheduledEmailHtml(cancelLink, purgeDateText(schedule.purge_at)),
      idempotencyKey: `del-scheduled:${userId}:${schedule.scheduled_at}`,
    });
  }

  return NextResponse.json({
    ok: true,
    scope,
    scheduled: true,
    purge_at: schedule.purge_at,
    emailSent,
  });
}
