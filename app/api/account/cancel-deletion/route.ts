import { verifyActionToken } from "../../../../src/lib/accountActionToken";
import { cancelAccountDeletion } from "../../../../src/lib/accountDeletionSchedule";
import { actionResultPage } from "../../../../src/lib/actionResultPage";

/**
 * Cancel a scheduled account deletion (G 2026-06-07). The "Keep my account" link
 * in every deletion email points here. The signed token IS the auth.
 */
function html(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const claims = verifyActionToken(token, "cancel");
  if (!claims) {
    return html(
      actionResultPage(
        "This link has expired",
        "We couldn't cancel from this link. If you still want to keep your account, just sign in and 6 can help.",
      ),
      401,
    );
  }
  const ok = await cancelAccountDeletion(claims.uid);
  if (!ok) {
    return html(
      actionResultPage(
        "Something went wrong",
        "We couldn't update your account just now. Please try again in a bit, or sign in and ask 6.",
      ),
      500,
    );
  }
  return html(
    actionResultPage(
      "You're all set \u{1F49B}",
      "Your account is staying right where it is — we canceled the deletion and nothing was removed. Welcome back any time.",
    ),
    200,
  );
}
