import { describe, expect, it } from "vitest";
import {
  computeFounderIterationContentHash,
  isStateBearingFounderIterationKind,
  normalizeFounderIterationInput,
} from "../../src/lib/founderSixRevisioning";

const baseInput = {
  kind: "persona",
  subject: "Conversation warmth",
  label: "Founder 6 warm-but-direct v1",
  reason: "G explicitly evaluated the defined behavior version.",
  verdict: "keep",
  before_ref: { prompt_sha256: "a".repeat(64) },
  after_ref: { prompt_sha256: "b".repeat(64) },
  state_snapshot: {
    persona_rules: ["Be warm", "Be direct"],
    prompt: { sha256: "b".repeat(64), source: "tools/founder-prompt.txt" },
    configuration: { model: "configured-model", provider: "configured-provider" },
  },
  evidence_refs: [{ type: "app_event", id: "evt-redacted-1" }],
  code_ref: "local:founder-six-v1",
  linked_revisions: [],
  schema_version: 1,
  founder_only: true,
};

describe("meaningful founder 6 iteration history", () => {
  it("accepts a deliberate privacy-reviewed behavior iteration", () => {
    expect(normalizeFounderIterationInput(baseInput)).toEqual(baseInput);
  });

  it.each([
    "persona",
    "behavior_rule",
    "memory_correction",
    "prompt",
    "configuration",
    "feature_flag",
    "evaluation",
    "rollback",
    "baseline",
  ])("recognizes %s as a deliberate iteration kind", (kind) => {
    expect(isStateBearingFounderIterationKind(kind)).toBe(
      kind !== "evaluation",
    );
  });

  it("rejects ordinary chat messages as revisions", () => {
    expect(() =>
      normalizeFounderIterationInput({
        ...baseInput,
        kind: "message",
        subject: "ordinary turn",
      }),
    ).toThrow(/kind/i);
  });

  it("requires explicit founder-only retention", () => {
    expect(() =>
      normalizeFounderIterationInput({ ...baseInput, founder_only: false }),
    ).toThrow(/founder_only/i);
  });

  it.each([
    { state_snapshot: { messages: [{ role: "user", content: "private" }] } },
    { state_snapshot: { raw_transcript: "private conversation" } },
    { state_snapshot: { contact_profile: { name: "Third Party" } } },
    { state_snapshot: { provider_token: "secret-value" } },
    { state_snapshot: { api_key: "secret-value" } },
  ])("rejects raw third-party or secret-bearing snapshots: %j", (override) => {
    expect(() =>
      normalizeFounderIterationInput({ ...baseInput, ...override }),
    ).toThrow(/privacy|secret|prohibited/i);
  });

  it("permits opaque evidence references without copying raw conversations", () => {
    const parsed = normalizeFounderIterationInput({
      ...baseInput,
      evidence_refs: [
        { type: "conversation_message", id: "opaque-message-id" },
        { type: "feedback_event", id: "opaque-feedback-id" },
      ],
    });
    expect(parsed.evidence_refs).toHaveLength(2);
  });

  it("computes the same SHA-256 for semantically identical key order", async () => {
    const left = normalizeFounderIterationInput(baseInput);
    const right = normalizeFounderIterationInput({
      founder_only: true,
      schema_version: 1,
      linked_revisions: [],
      code_ref: "local:founder-six-v1",
      evidence_refs: [{ id: "evt-redacted-1", type: "app_event" }],
      state_snapshot: {
        configuration: { provider: "configured-provider", model: "configured-model" },
        prompt: { source: "tools/founder-prompt.txt", sha256: "b".repeat(64) },
        persona_rules: ["Be warm", "Be direct"],
      },
      after_ref: { prompt_sha256: "b".repeat(64) },
      before_ref: { prompt_sha256: "a".repeat(64) },
      verdict: "keep",
      reason: "G explicitly evaluated the defined behavior version.",
      label: "Founder 6 warm-but-direct v1",
      subject: "Conversation warmth",
      kind: "persona",
    });
    await expect(computeFounderIterationContentHash(left)).resolves.toBe(
      await computeFounderIterationContentHash(right),
    );
  });
});