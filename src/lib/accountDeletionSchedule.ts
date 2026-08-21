import { getSupabaseAdminConfig } from "./supabaseAdmin";

/**
 * The 30-day deletion grace schedule (G 2026-06-07). Stored on the Supabase auth
 * user's user_metadata.account_deletion — NO schema migration needed. The daily
 * cron reads pending schedules to send reminders + purge when due.
 */
export type DeletionSchedule = {
  scheduled_at: string;
  purge_at: string;
  status: "pending";
  reminder_week_sent?: boolean;
  reminder_day_sent?: boolean;
};

type AdminUser = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown> & {
    account_deletion?: DeletionSchedule | null;
  };
};

function cfg() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  return {
    url,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    } as const,
  };
}

async function getUserMetadata(userId: string): Promise<Record<string, unknown>> {
  const { url, headers } = cfg();
  const res = await fetch(
    `${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { headers },
  );
  if (!res.ok) return {};
  const u = (await res.json()) as AdminUser;
  return (u.user_metadata as Record<string, unknown>) ?? {};
}

// Always read-merge-write so we never clobber full_name / session_id etc.
async function writeUserMetadata(
  userId: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  const { url, headers } = cfg();
  const res = await fetch(
    `${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { method: "PUT", headers, body: JSON.stringify({ user_metadata: metadata }) },
  );
  return res.ok;
}

export async function scheduleAccountDeletion(
  userId: string,
  graceDays = 30,
): Promise<DeletionSchedule | null> {
  const { assertDestructiveActionAllowed } = await import("./accountProtection");
  await assertDestructiveActionAllowed(userId, "account_delete_schedule");
  const now = Date.now();
  const schedule: DeletionSchedule = {
    scheduled_at: new Date(now).toISOString(),
    purge_at: new Date(now + graceDays * 86_400_000).toISOString(),
    status: "pending",
  };
  const meta = await getUserMetadata(userId);
  const ok = await writeUserMetadata(userId, {
    ...meta,
    account_deletion: schedule,
  });
  return ok ? schedule : null;
}

export async function cancelAccountDeletion(userId: string): Promise<boolean> {
  const meta = await getUserMetadata(userId);
  const next = { ...meta };
  delete next.account_deletion;
  return writeUserMetadata(userId, next);
}

export async function markReminderSent(
  userId: string,
  which: "week" | "day",
): Promise<void> {
  const meta = await getUserMetadata(userId);
  const sched = meta.account_deletion as DeletionSchedule | undefined;
  if (!sched) return;
  const updated: DeletionSchedule = {
    ...sched,
    ...(which === "week"
      ? { reminder_week_sent: true }
      : { reminder_day_sent: true }),
  };
  await writeUserMetadata(userId, { ...meta, account_deletion: updated });
}

export async function getAccountDeletion(
  userId: string,
): Promise<DeletionSchedule | null> {
  const meta = await getUserMetadata(userId);
  return (meta.account_deletion as DeletionSchedule | null) ?? null;
}

export type PendingDeletion = {
  userId: string;
  email: string | null;
  schedule: DeletionSchedule;
};

// Page through admin users and return everyone with a pending deletion. Small
// user base, so a handful of pages at most.
export async function listPendingDeletions(): Promise<PendingDeletion[]> {
  const { url, headers } = cfg();
  const out: PendingDeletion[] = [];
  for (let page = 1; page <= 25; page++) {
    const res = await fetch(
      `${url}/auth/v1/admin/users?per_page=200&page=${page}`,
      { headers },
    );
    if (!res.ok) break;
    const body = await res.json();
    const users: AdminUser[] = Array.isArray(body) ? body : (body.users ?? []);
    if (!users.length) break;
    for (const u of users) {
      const sched = u.user_metadata?.account_deletion;
      if (sched && sched.status === "pending") {
        out.push({ userId: u.id, email: u.email ?? null, schedule: sched });
      }
    }
    if (users.length < 200) break;
  }
  return out;
}
