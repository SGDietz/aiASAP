import { describe, expect, it } from "vitest";
import {
  filterNameFactsForResolvedName,
  filterResumeSummaryForResolvedName,
  normalizePersonName,
  resolvePersonName,
} from "../../src/lib/auth/resolveUserName";
import type { StoredMemoryFact } from "../../src/lib/memory/types";

const nameFact = (content: string, created_at: string): StoredMemoryFact => ({
  id: `${content}-${created_at}`,
  kind: "name",
  content,
  created_at,
  similarity: 0.9,
});

const otherFact = (content: string): StoredMemoryFact => ({
  id: content,
  kind: "other",
  content,
  created_at: "2026-07-14T12:00:00Z",
  similarity: 0.8,
});

describe("resolvePersonName", () => {
  it.each([
    "okay",
    "perfect",
    "yes",
    "sounds good",
    "such a loser",
    "add milk",
  ])("rejects non-identity write candidate %s", (candidate) => {
    expect(normalizePersonName(candidate)).toBeNull();
  });

  it("preserves legitimate short and full names", () => {
    expect(normalizePersonName("G")).toBe("G");
    expect(normalizePersonName("Scott Dietz")).toBe("Scott Dietz");
  });

  it("uses Supabase Auth full_name over stale client, account-link, and memory names", () => {
    const result = resolvePersonName({
      authUser: {
        user_metadata: {
          full_name: "G Dietz",
          name: "Wrong OAuth Alias",
        },
      },
      accountName: "Scott",
      clientName: "Greg",
      memoryFacts: [nameFact("Herm", "2026-07-14T12:00:00Z")],
    });

    expect(result).toEqual({ name: "G Dietz", source: "supabase_auth" });
  });

  it("uses a captured account name before a client/device name", () => {
    const result = resolvePersonName({
      authUser: { user_metadata: {} },
      accountName: "G",
      clientName: "Scott",
      memoryFacts: [nameFact("Greg", "2026-07-14T12:00:00Z")],
    });

    expect(result).toEqual({ name: "G", source: "account" });
  });

  it("uses the client name before memory and memory only as the final fallback", () => {
    expect(
      resolvePersonName({
        authUser: null,
        clientName: "G",
        memoryFacts: [nameFact("Scott", "2026-07-14T12:00:00Z")],
      }),
    ).toEqual({ name: "G", source: "client" });

    expect(
      resolvePersonName({
        authUser: null,
        memoryFacts: [
          nameFact("Scott", "2026-07-13T12:00:00Z"),
          nameFact("G", "2026-07-14T12:00:00Z"),
        ],
      }),
    ).toEqual({ name: "G", source: "memory" });
  });

  it("rejects an unsafe identity value from every persisted source", () => {
    expect(
      resolvePersonName({
        authUser: { user_metadata: { full_name: "Such A Loser" } },
        accountName: "such a loser",
        clientName: "such a loser",
        memoryFacts: [nameFact("such a loser", "2026-07-18T03:36:05Z")],
      }),
    ).toEqual({ name: null, source: "none" });
  });

  it("drops recalled name facts whenever a stronger name source is known", () => {
    const facts = [
      nameFact("Scott", "2026-07-13T12:00:00Z"),
      otherFact("prefers concise answers"),
    ];

    expect(
      filterNameFactsForResolvedName(facts, {
        name: "G",
        source: "supabase_auth",
      }),
    ).toEqual([facts[1]]);
    expect(
      filterNameFactsForResolvedName(facts, { name: "Scott", source: "memory" }),
    ).toEqual(facts);
  });

  it("removes stale name exchanges from raw resume conversation", () => {
    const summary = [
      "You've talked with this user before.",
      "User: My name is Scott.",
      "6: Good to meet you, Scott.",
      "User: The deck railing is loose.",
    ].join("\n");

    expect(
      filterResumeSummaryForResolvedName(
        summary,
        { name: "G", source: "supabase_auth" },
        ["Scott"],
      ),
    ).toBe(
      "You've talked with this user before.\nUser: The deck railing is loose.",
    );
  });

  it("preserves topic lines that only happen to contain a conflicting name", () => {
    const summary = [
      "User: My name is Rose.",
      "6: Good to meet you, Rose.",
      "User: The rose bush has black spots.",
      "User: My contractor Scott says the railing is unsafe.",
      "User: Call me when the plumber arrives.",
      "User: What should I call this pipe fitting?",
      "User: My contractor says your name is on the permit.",
      "6: Thanks, the Scott valve is compatible.",
    ].join("\n");

    expect(
      filterResumeSummaryForResolvedName(
        summary,
        { name: "G", source: "supabase_auth" },
        ["Rose", "Scott"],
      ),
    ).toBe(
      [
        "User: The rose bush has black spots.",
        "User: My contractor Scott says the railing is unsafe.",
        "User: Call me when the plumber arrives.",
        "User: What should I call this pipe fitting?",
        "User: My contractor says your name is on the permit.",
        "6: Thanks, the Scott valve is compatible.",
      ].join("\n"),
    );
  });
});
