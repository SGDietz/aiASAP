import crypto from "crypto";
import { getSupabaseAdminConfig } from "./supabaseAdmin";

/**
 * Stateless, time-limited download-link token (G 2026-06-07). We email the
 * account owner a link carrying this token; the /api/account/download route
 * verifies it and serves their export. Signed with HMAC-SHA256 keyed by the
 * server-only service-role secret (never leaves the server), so it can't be
 * forged. Valid until it expires (default 24h) — like an S3 presigned URL.
 */

export type DownloadClaims = { uid: string; email: string | null; exp: number };

function secret(): string {
  return getSupabaseAdminConfig().serviceRoleKey;
}

export function signDownloadToken(
  uid: string,
  email: string | null,
  ttlMs = 24 * 60 * 60 * 1000,
): string {
  const claims: DownloadClaims = { uid, email, exp: Date.now() + ttlMs };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyDownloadToken(token: string): DownloadClaims | null {
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
    ) as DownloadClaims;
    if (!claims || typeof claims.uid !== "string" || typeof claims.exp !== "number") {
      return null;
    }
    if (Date.now() > claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}
