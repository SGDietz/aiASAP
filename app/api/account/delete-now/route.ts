import { verifyActionToken } from "../../../../src/lib/accountActionToken";
import { purgeUserData } from "../../../../src/lib/purgeUserData";
import { buildDeletionDoneEmailHtml } from "../../../../src/lib/accountDeletionEmails";
import { sendResendEmail } from "../../../../src/lib/sendResendEmail";
import { actionResultPage } from "../../../../src/lib/actionResultPage";

/**
 * "Delete now" (G 2026-06-07) — skip the rest of the 30-day grace and purge
 * immediately. The button in the 1-week-left email points here. Signed token IS
 * the auth. (More user-friendly than Google/Meta, who make the grace mandatory.)
 */
export const maxDuration = 60;

function html(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const claims = verifyActionToken(token, "delete-now");
  if (!claims) {
    return html(
      actionResultPage(
        "This link has expired",
        "We couldn't delete from this link. If you still want your account gone, sign in and ask 6 to do it.",
      ),
      401,
    );
  }
  const { checkDestructiveActionAllowed } = await import(
    "../../../../src/lib/accountProtection"
  );
  const protection = await checkDestructiveActionAllowed(claims.uid, "delete_now");
  if (protection.allowed === false) {
    return html(
      actionResultPage(
        "Deletion stopped",
        protection.code === "protected_account"
          ? "This is a permanent account. Its identity, memory, and history cannot be deleted."
          : "We could not verify account protection, so nothing was deleted. Please try again later.",
      ),
      protection.code === "protected_account" ? 423 : 503,
    );
  }
  await purgeUserData(claims.uid, claims.email, true);
  if (claims.email) {
    await sendResendEmail({
      to: claims.email,
      subject: "Your aiASAP data has been deleted",
      html: buildDeletionDoneEmailHtml(),
      idempotencyKey: `del-done:${claims.uid}`,
    });
  }
  return html(
    actionResultPage(
      "Your data has been deleted",
      "Your aiASAP account and everything in it are gone for good. It was good knowing you — you're always welcome to start fresh. \u{1F49B}",
    ),
    200,
  );
}
