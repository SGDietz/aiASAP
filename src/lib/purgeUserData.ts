import { getSupabaseAdminConfig } from "./supabaseAdmin";
import { assertDestructiveActionAllowed } from "./accountProtection";

/**
 * Shared user-data WIPE (G 2026-06-07). The one place that actually erases a
 * user's data — used by the immediate memory-wipe, the day-30 auto-purge cron,
 * and the "delete now" button. MIRRORS userDataExport's table list so we erase
 * exactly what we let people download.
 *
 * closeAccount=false : wipe their data, KEEP the auth user (memory reset).
 * closeAccount=true  : wipe their data AND delete the auth user (account closed).
 */
const USER_DATA_TABLES = [
  "user_memory_facts",
  "conversation_messages",
  "transcript_events",
  "media_events",
  "lead_sessions",
  "contact_entities",
] as const;

export type PurgeResult = {
  ok: boolean;
  accountClosed: boolean;
  deleted: Record<string, string>;
};

export async function purgeUserData(
  userId: string,
  email: string | null,
  closeAccount: boolean,
): Promise<PurgeResult> {
  // Guard the primitive itself so no route/admin caller can bypass the UUID
  // registry by calling this helper directly.
  await assertDestructiveActionAllowed(userId, "direct_purge");
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  } as const;

  const deleted: Record<string, string> = {};

  for (const table of USER_DATA_TABLES) {
    try {
      const res = await fetch(
        `${url}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}`,
        { method: "DELETE", headers },
      );
      deleted[table] = res.ok || res.status === 404 ? "ok" : `error:${res.status}`;
    } catch {
      deleted[table] = "error:throw";
    }
  }

  if (email) {
    try {
      const res = await fetch(
        `${url}/rest/v1/account_email_links?email=eq.${encodeURIComponent(email)}`,
        { method: "DELETE", headers },
      );
      deleted.account_email_links =
        res.ok || res.status === 404 ? "ok" : `error:${res.status}`;
    } catch {
      deleted.account_email_links = "error:throw";
    }
  }

  let accountClosed = false;
  if (closeAccount) {
    try {
      const res = await fetch(
        `${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
        { method: "DELETE", headers },
      );
      accountClosed = res.ok;
      deleted.auth_user = res.ok ? "ok" : `error:${res.status}`;
    } catch {
      deleted.auth_user = "error:throw";
    }
  }

  return { ok: true, accountClosed, deleted };
}
