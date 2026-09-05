// Read-side memory collapse (2026-06-10): legacy duplicate facts and stale
// names stay in the table (never migrate toward less data) but must never
// reach 6's 5 recall slots. From G's smoke: 6 greeted him "Greg"/"Scott"
// off old name facts after he said "My name is G".
import { describe, expect, it } from "vitest";
import { collapseRecalledFacts } from "../../src/lib/memory/recallFacts";
import type { StoredMemoryFact } from "../../src/lib/memory/types";

const fact = (
  id: string,
  kind: StoredMemoryFact["kind"],
  content: string,
  created_at: string,
  similarity = 0.9,
): StoredMemoryFact => ({ id, kind, content, created_at, similarity });

describe("collapseRecalledFacts", () => {
  it("collapses exact copies so dups can't hog the slots", () => {
    const rows = [
      fact("1", "contact", "user's email is wildworks@pm.me", "2026-06-09T10:00:00Z"),
      fact("2", "contact", "User's email is wildworks@pm.me", "2026-06-09T11:00:00Z"),
      fact("3", "contact", "user's email is wildworks@pm.me", "2026-06-09T12:00:00Z"),
      fact("4", "other", "building the WildWorks website", "2026-06-09T13:00:00Z"),
    ];
    const out = collapseRecalledFacts(rows, 5);
    expect(out.map((r) => r.id)).toEqual(["1", "4"]);
  });

  it("the NEWEST name wins — stale names never reach 6 (the Greg/Scott bug)", () => {
    const rows = [
      fact("a", "name", "Scott", "2026-06-09T10:00:00Z", 0.99),
      fact("b", "name", "Scott", "2026-06-09T11:00:00Z", 0.98),
      fact("c", "name", "G", "2026-06-10T12:00:00Z", 0.7),
      fact("d", "address", "lives in Springfield, Illinois", "2026-06-10T12:01:00Z", 0.8),
    ];
    const out = collapseRecalledFacts(rows, 5);
    const names = out.filter((r) => r.kind === "name");
    expect(names).toHaveLength(1);
    expect(names[0].content).toBe("G");
    expect(out.some((r) => r.content === "Scott")).toBe(false);
  });

  it("respects the slot limit after collapsing", () => {
    const rows = [
      fact("1", "other", "alpha", "2026-06-09T10:00:00Z"),
      fact("2", "other", "alpha", "2026-06-09T10:01:00Z"),
      fact("3", "other", "beta", "2026-06-09T10:02:00Z"),
      fact("4", "other", "gamma", "2026-06-09T10:03:00Z"),
      fact("5", "other", "delta", "2026-06-09T10:04:00Z"),
    ];
    const out = collapseRecalledFacts(rows, 3);
    expect(out.map((r) => r.content)).toEqual(["alpha", "beta", "gamma"]);
  });
});
