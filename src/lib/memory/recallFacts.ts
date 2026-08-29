import { getSupabaseAdminConfig } from "../supabaseAdmin";
import { embedText } from "./embed";
import type { StoredMemoryFact, MemoryFactKind } from "./types";

const DEFAULT_MATCH_COUNT = 5;
const DEFAULT_MIN_SIMILARITY = 0.2;
const MIN_QUERY_LEN = 4;

/**
 * READ-SIDE cleanup (2026-06-10, G's smoke "no, that's not my name"): the
 * table holds legacy duplicate copies (one fact stored 23×) and superseded
 * names ("Scott"/"Greg" piles under a newer "G"). We keep the rows (never
 * migrate toward less data) and instead make recall immune:
 *   - collapse exact copies (case-insensitive kind+content), keeping the
 *     highest-similarity hit;
 *   - for the "name" kind, the NEWEST name wins — older names are dropped
 *     entirely so 6 never greets with a stale one.
 * storeFacts also dedupes on write now, so the pile stops growing.
 */
export function collapseRecalledFacts(
  rows: StoredMemoryFact[],
  limit: number,
): StoredMemoryFact[] {
  const newestName = rows
    .filter((r) => r.kind === "name")
    .reduce<StoredMemoryFact | null>(
      (best, r) =>
        !best || new Date(r.created_at) > new Date(best.created_at) ? r : best,
      null,
    );
  const seen = new Set<string>();
  const out: StoredMemoryFact[] = [];
  for (const row of rows) {
    if (row.kind === "name" && newestName && row.id !== newestName.id) continue;
    const key = `${row.kind} ${row.content.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Top-K similarity search over user_memory_facts. Returns [] on any
 * failure — recall is best-effort and must never break the chat reply.
 */
export async function recallFacts(args: {
  userId: string;
  query: string;
  matchCount?: number;
  minSimilarity?: number;
}): Promise<StoredMemoryFact[]> {
  if (!args.userId) return [];
  if (!args.query || args.query.trim().length < MIN_QUERY_LEN) return [];

  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return [];
  }

  const queryEmbedding = await embedText(args.query);
  if (!queryEmbedding) return [];

  const limit = args.matchCount ?? DEFAULT_MATCH_COUNT;
  // Over-fetch so the post-collapse result can still fill all `limit` slots
  // even when the raw top hits are copies of each other (legacy dups).
  const fetchCount = Math.max(limit * 3, 15);

  try {
    const res = await fetch(`${url}/rest/v1/rpc/match_user_memory_facts`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_user_id: args.userId,
        query_embedding: queryEmbedding,
        match_count: fetchCount,
        min_similarity: args.minSimilarity ?? DEFAULT_MIN_SIMILARITY,
      }),
    });
    if (!res.ok) {
      console.error(
        "recallFacts: rpc failed",
        res.status,
        await res.text().catch(() => ""),
      );
      return [];
    }
    const rows = (await res.json()) as Array<{
      id: string;
      kind: MemoryFactKind;
      content: string;
      similarity: number;
      created_at: string;
    }>;
    if (!Array.isArray(rows)) return [];
    return collapseRecalledFacts(
      rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        content: r.content,
        similarity: r.similarity,
        created_at: r.created_at,
      })),
      limit,
    );
  } catch (e) {
    console.error("recallFacts: throw", e);
    return [];
  }
}

/**
 * Format recalled facts into a system-prompt-friendly text block.
 * Returns an empty string when there's nothing useful — so callers
 * can safely template it in without conditional logic.
 */
export function formatRecalledFactsForPrompt(
  facts: StoredMemoryFact[],
): string {
  if (facts.length === 0) return "";
  const lines = facts.map((f) => `- [${f.kind}] ${f.content}`);
  return `What you remember about this user from prior conversations (highest-relevance first):\n${lines.join("\n")}\n\nUse these naturally — don't read them out verbatim or announce that you remember them. Only mention what's relevant to the current message.`;
}
