import { isGarbageNameCandidate } from "../contactExtraction";
import type { StoredMemoryFact } from "../memory/types";

type AuthUserLike = {
  user_metadata?: Record<string, unknown> | null;
} | null;

export type ResolvedPersonName = {
  name: string | null;
  source: "supabase_auth" | "account" | "client" | "memory" | "none";
};

export function normalizePersonName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  if (!name || name.length > 100 || name.includes("@")) return null;
  if (isGarbageNameCandidate(name)) return null;
  if (
    /^(?:ok(?:ay)?|yes|yeah|yep|yup|no|nope|perfect|great|good|fine|right|correct|sure|exactly|absolutely|thanks|thank you|sounds good|got it)$/i.test(
      name,
    ) ||
    /^(?:add|remove|delete|open|close|create|make|show|find|search|remember|remind)\b/i.test(
      name,
    )
  ) {
    return null;
  }
  return name;
}

/**
 * Supabase Auth metadata is the canonical identity source for signed-in users.
 * OAuth providers commonly use `full_name` or `name`; aiASAP signup has also
 * written `fullName`, so keep all known shapes in an explicit priority order.
 */
export function getSupabaseAuthName(user: AuthUserLike): string | null {
  const metadata = user?.user_metadata;
  if (!metadata) return null;

  for (const key of ["full_name", "fullName", "name", "display_name"] as const) {
    const candidate = normalizePersonName(metadata[key]);
    if (candidate) return candidate;
  }
  return null;
}

function newestMemoryName(facts: StoredMemoryFact[]): string | null {
  let newest: { name: string; timestamp: number; index: number } | null = null;
  for (let index = 0; index < facts.length; index += 1) {
    const fact = facts[index];
    if (!fact || fact.kind !== "name") continue;
    const name = normalizePersonName(fact.content);
    if (!name) continue;
    const parsed = Date.parse(fact.created_at);
    const timestamp = Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    if (
      !newest ||
      timestamp > newest.timestamp ||
      (timestamp === newest.timestamp && index > newest.index)
    ) {
      newest = { name, timestamp, index };
    }
  }
  return newest ? newest.name : null;
}

/**
 * Resolve identity once, with recalled semantic-memory names deliberately last.
 * This prevents a stale vector fact from overriding the signed-in account.
 */
export function resolvePersonName(args: {
  authUser?: AuthUserLike;
  accountName?: unknown;
  clientName?: unknown;
  memoryFacts?: StoredMemoryFact[];
}): ResolvedPersonName {
  const authName = getSupabaseAuthName(args.authUser ?? null);
  if (authName) return { name: authName, source: "supabase_auth" };

  const accountName = normalizePersonName(args.accountName);
  if (accountName) return { name: accountName, source: "account" };

  const clientName = normalizePersonName(args.clientName);
  if (clientName) return { name: clientName, source: "client" };

  const memoryName = newestMemoryName(args.memoryFacts ?? []);
  if (memoryName) return { name: memoryName, source: "memory" };

  return { name: null, source: "none" };
}

/**
 * When identity came from a stronger source, remove all recalled name facts from
 * the prompt. They remain stored in Supabase; this is a read-side conflict guard.
 */
export function filterNameFactsForResolvedName(
  facts: StoredMemoryFact[],
  resolvedName: ResolvedPersonName,
): StoredMemoryFact[] {
  if (!resolvedName.name || resolvedName.source === "memory") return facts;
  return facts.filter((fact) => fact.kind !== "name");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resume memory contains raw pre-signup conversation lines, not just structured
 * facts. Remove explicit name exchanges (and known conflicting names) when a
 * stronger identity source is available, while preserving the actual topic.
 */
export function filterResumeSummaryForResolvedName(
  summary: string,
  resolvedName: ResolvedPersonName,
  possibleConflictingNames: unknown[] = [],
): string {
  if (!summary || !resolvedName.name || resolvedName.source === "memory") {
    return summary;
  }

  const canonical = resolvedName.name.toLocaleLowerCase();
  const conflictingNames = possibleConflictingNames
    .map(normalizePersonName)
    .filter((name): name is string => Boolean(name))
    .filter((name) => name.toLocaleLowerCase() !== canonical);
  const conflictingNameAtStart = conflictingNames.map(
    (name) =>
      new RegExp(
        `^${escapeRegExp(name)}(?:[^\\p{L}\\p{N}]|$)`,
        "iu",
      ),
  );
  const beginsWithConflictingName = (value: string): boolean =>
    conflictingNameAtStart.some((pattern) => pattern.test(value.trimStart()));
  const identityValueFollows = (
    content: string,
    prefixes: RegExp[],
  ): boolean =>
    prefixes.some((prefix) => {
      const match = content.match(prefix);
      return Boolean(
        match && beginsWithConflictingName(content.slice(match[0].length)),
      );
    });
  const transcriptLine = /^\s*(user|6|assistant)\s*:\s*(.*)$/i;
  const userIdentityPrefixes = [
    /^my name is\s+/i,
    /^call me\s+/i,
    /^you can call me\s+/i,
  ];
  const assistantIdentityPrefixes = [
    /^(?:nice|good|great|pleasure)\s+to\s+meet\s+you\s*[,!]?\s+/i,
    /^(?:i(?:'ll| will)|we(?:'ll| will))\s+call\s+you\s+/i,
    /^(?:their|your)\s+name\s+is\s+/i,
    /^(?:thanks|thank you|welcome|got it|understood|okay|ok|alright)(?:\s*[,!]\s*|\s+)/i,
  ];

  return summary
    .split("\n")
    .filter((line) => {
      const match = line.match(transcriptLine);
      if (!match) return true;
      const speaker = match[1]?.toLocaleLowerCase();
      const content = match[2] ?? "";
      if (speaker === "user") {
        return !identityValueFollows(content, userIdentityPrefixes);
      }
      return !identityValueFollows(content, assistantIdentityPrefixes);
    })
    .join("\n")
    .trim();
}
