/**
 * WHERE THE LEDGER LIVES BETWEEN TURNS.
 *
 * The ledger is the only thing that remembers an interview across a hung-up
 * call, a closed tab, or a week away. G's rule is that people come and go and
 * brain-dump in the car - so the interview has to survive being abandoned
 * mid-sentence and picked up on a different device.
 *
 * ONE RULE ABOVE ALL: THIS CAN NEVER BREAK 6.
 *
 * If Supabase is down, if the table has not been created yet, if the JSON is
 * garbage - every function here goes quiet and the conversation carries on
 * exactly as it does today, just without the whisper. A filing system that can
 * take the voice down is worse than no filing system. That is why nothing here
 * throws and why load returns null rather than an empty ledger on failure:
 * an empty ledger would look like a fresh interview and re-ask everything.
 */

import { getSupabaseAdminConfig } from "../supabaseAdmin";
import { newLedger, reconcile, ALL_PARTS } from "./ledger";
import type { Ledger, PartId, PartRecord } from "./ledger";

const TABLE = "interview_ledgers";

/**
 * Anything coming back out of the database is untrusted - it may predate a
 * shape change, or have been written by an older build. A ledger missing a
 * part would crash the whisper on its first loop, so rebuild the skeleton and
 * lay whatever survived on top of it.
 */
export function rehydrate(raw: unknown, now: number): Ledger | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Ledger>;
  if (!r.parts || typeof r.parts !== "object") return null;

  const fresh = newLedger(now);
  const parts = {} as Record<PartId, PartRecord>;
  for (const p of ALL_PARTS) {
    const got = (r.parts as Record<number, unknown>)[p];
    const rec = got && typeof got === "object" ? (got as PartRecord) : null;
    parts[p] = {
      state: rec?.state ?? "unreached",
      slots: rec && typeof rec.slots === "object" && rec.slots ? rec.slots : {},
      repromptUsed: rec?.repromptUsed === true,
      ...(rec?.compressedFromPart2 ? { compressedFromPart2: true } : {}),
    };
  }

  return reconcile({
    status: r.status ?? "running",
    noticeAccepted: r.noticeAccepted === true,
    // Defaults TRUE in newLedger, so only an explicit false turns it off -
    // reading a missing field as "no" would silently revoke permission.
    publishOk: r.publishOk !== false,
    parts,
    quotes: Array.isArray(r.quotes) ? r.quotes.slice(0, 200) : [],
    lastActivityAt:
      typeof r.lastActivityAt === "number" ? r.lastActivityAt : fresh.lastActivityAt,
    startedAt: typeof r.startedAt === "number" ? r.startedAt : fresh.startedAt,
  });
}

/** The person's ledger, or null if there isn't one or we couldn't reach it. */
export async function loadLedger(
  userId: string,
  now: number,
): Promise<Ledger | null> {
  if (!userId) return null;
  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return null;
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&select=ledger&limit=1`,
      {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      },
    );
    // A 404 here means the migration has not been applied yet. That is a
    // known, expected state - not an error worth shouting about.
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ ledger?: unknown }>;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rehydrate(rows[0]?.ledger, now);
  } catch {
    return null;
  }
}

/** Best-effort write. Never throws, never blocks a reply. */
export async function saveLedger(
  userId: string,
  ledger: Ledger,
): Promise<boolean> {
  if (!userId) return false;
  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return false;
  }

  try {
    const res = await fetch(`${url}/rest/v1/${TABLE}?on_conflict=user_id`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        ledger,
        updated_at: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
