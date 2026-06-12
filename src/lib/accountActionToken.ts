import crypto from "crypto";
import { getSupabaseAdminConfig } from "./supabaseAdmin";

/**
 * Signed account-action token (G 2026-06-07) for the links inside the deletion
 * emails: "cancel" (stop the deletion) and "delete-now" (skip the rest of the
 * grace window and purge immediately). HMAC-SHA256 keyed by the server-only
 * service-role secret, so the links can't be forged. Long TTL (31 days) so a
 * link from the day-0 email still works at the end of the grace window.
 */
export type AccountAction = "cancel" | "delete-now";
export type ActionClaims = {
  action: AccountAction;
  uid: string;
  email: string | null;
  exp: number;
};

function secret(): string {
  return getSupabaseAdminConfig().serviceRoleKey;
}

export function signActionToken(
  action: AccountAction,
  uid: string,
  email: string | null,
  ttlMs = 31 * 24 * 60 * 60 * 1000,
): string {
  const claims: ActionClaims = { action, uid, email, exp: Date.now() + ttlMs };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyActionToken(
  token: string,
  expectedAction: AccountAction,
): ActionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ActionClaims;
    if (!claims || typeof claims.uid !== "string" || typeof claims.exp !== "number") {
      return null;
    }
    if (claims.action !== expectedAction) return null;
    if (Date.now() > claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}
