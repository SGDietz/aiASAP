import { describe, expect, it } from "vitest";
import {
  isPostgrestMissingColumnError,
  parseAppEventEnvelope,
  parseClientTimestamp,
} from "../src/lib/appEventEnvelope";

describe("parseAppEventEnvelope", () => {
  it("preserves bounded audit and list-mutation identifiers", () => {
    expect(
      parseAppEventEnvelope({
        event_id: "turn-1:list:add:grocery",
        utterance_id: "turn-1",
        trace_id: "trace-1",
        parent_event_id: "parent-1",
        idempotency_key: "turn-1:list:add:grocery",
        mutation_version: 9,
        outcome: "changed",
        error_code: null,
        status_code: 200,
        duration_ms: 42,
        provider_request_id: "req-1",
      }),
    ).toEqual({
      event_id: "turn-1:list:add:grocery",
      utterance_id: "turn-1",
      trace_id: "trace-1",
      parent_event_id: "parent-1",
      idempotency_key: "turn-1:list:add:grocery",
      mutation_version: 9,
      outcome: "changed",
      error_code: null,
      status_code: 200,
      duration_ms: 42,
      provider_request_id: "req-1",
    });
  });

  it("drops invalid numbers and bounds untrusted text", () => {
    const parsed = parseAppEventEnvelope({
      event_id: ` ${"x".repeat(250)} `,
      mutation_version: -1,
      status_code: 999,
      duration_ms: Number.NaN,
      outcome: 7,
    });

    expect(parsed.event_id).toHaveLength(200);
    expect(parsed.mutation_version).toBeNull();
    expect(parsed.status_code).toBeNull();
    expect(parsed.duration_ms).toBeNull();
    expect(parsed.outcome).toBeNull();
  });
});

describe("PostgREST compatibility helpers", () => {
  it("allows legacy fallback only for a named missing column", () => {
    const detail = JSON.stringify({
      code: "PGRST204",
      message: "Could not find the 'event_id' column of 'app_events' in the schema cache",
    });
    expect(isPostgrestMissingColumnError(400, detail, ["event_id"])).toBe(true);
    expect(isPostgrestMissingColumnError(401, detail, ["event_id"])).toBe(false);
    expect(isPostgrestMissingColumnError(400, "duplicate key", ["event_id"])).toBe(false);
    expect(isPostgrestMissingColumnError(400, detail, ["tester_label"])).toBe(false);
  });

  it("normalizes valid client timestamps and rejects junk", () => {
    expect(parseClientTimestamp("2026-07-18T01:02:03-04:00")).toBe(
      "2026-07-18T05:02:03.000Z",
    );
    expect(parseClientTimestamp("yesterday-ish")).toBeNull();
  });
});
