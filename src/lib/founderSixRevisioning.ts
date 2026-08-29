import { getSupabaseAdminConfig } from "./supabaseAdmin";

export const FOUNDER_ITERATION_KINDS = [
  "baseline",
  "persona",
  "behavior_rule",
  "memory_correction",
  "prompt",
  "configuration",
  "feature_flag",
  "evaluation",
  "rollback",
] as const;

export type FounderIterationKind = (typeof FOUNDER_ITERATION_KINDS)[number];
export type JsonObject = Record<string, unknown>;

export type FounderIterationInput = {
  kind: FounderIterationKind;
  subject: string;
  label: string;
  reason: string;
  verdict: string | null;
  before_ref: JsonObject;
  after_ref: JsonObject;
  state_snapshot: JsonObject;
  evidence_refs: JsonObject[];
  code_ref: string | null;
  linked_revisions: number[];
  schema_version: number;
  founder_only: true;
  rollback_of_revision?: number | null;
};

const PROHIBITED_KEY =
  /(^|_)(messages?|raw_?transcript|transcript|contacts?|contact_?profile|api_?key|access_?token|refresh_?token|provider_?token|token|secret|password|authorization|cookie)($|_)/i;
const SECRET_VALUE =
  /(^|\s)(bearer\s+\S+|sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i;

function isPlainObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function boundedString(
  value: unknown,
  field: string,
  max: number,
  required = true,
): string | null {
  if (value === null || value === undefined) {
    if (!required) return null;
    throw new Error(`${field} is required`);
  }
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const normalized = value.trim();
  if (required && !normalized) throw new Error(`${field} is required`);
  if (normalized.length > max) throw new Error(`${field} is too long`);
  return normalized || null;
}

function assertPrivacySafe(value: unknown, path = "state_snapshot"): void {
  if (Array.isArray(value)) {
    if (value.length > 500) throw new Error(`${path} exceeds the privacy-reviewed size limit`);
    value.forEach((item, index) => assertPrivacySafe(item, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (PROHIBITED_KEY.test(key)) {
        throw new Error(`${path}.${key} is a prohibited privacy or secret field`);
      }
      assertPrivacySafe(nested, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && SECRET_VALUE.test(value)) {
    throw new Error(`${path} contains a prohibited credential-shaped value`);
  }
}

function asObject(value: unknown, field: string): JsonObject {
  if (!isPlainObject(value)) throw new Error(`${field} must be an object`);
  assertPrivacySafe(value, field);
  return value;
}

function asEvidenceRefs(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) throw new Error("evidence_refs must be an array");
  if (value.length > 200) throw new Error("evidence_refs is too large");
  return value.map((item, index) => {
    if (!isPlainObject(item)) throw new Error(`evidence_refs[${index}] must be an object`);
    const keys = Object.keys(item);
    if (keys.some((key) => !["type", "id", "session_ref", "note"].includes(key))) {
      throw new Error(`evidence_refs[${index}] contains a prohibited field`);
    }
    const type = boundedString(item.type, `evidence_refs[${index}].type`, 80);
    const id = boundedString(item.id, `evidence_refs[${index}].id`, 200);
    const sessionRef = boundedString(
      item.session_ref,
      `evidence_refs[${index}].session_ref`,
      200,
      false,
    );
    const note = boundedString(item.note, `evidence_refs[${index}].note`, 240, false);
    return {
      type,
      id,
      ...(sessionRef ? { session_ref: sessionRef } : {}),
      ...(note ? { note } : {}),
    };
  });
}

function asRevisionList(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error("linked_revisions must be an array");
  const revisions = value.map((item) => {
    if (!Number.isSafeInteger(item) || Number(item) < 1) {
      throw new Error("linked_revisions must contain positive integers");
    }
    return Number(item);
  });
  return Array.from(new Set(revisions));
}

export function isStateBearingFounderIterationKind(kind: string): boolean {
  return (
    (FOUNDER_ITERATION_KINDS as readonly string[]).includes(kind) &&
    kind !== "evaluation"
  );
}

export function normalizeFounderIterationInput(
  input: unknown,
): FounderIterationInput {
  if (!isPlainObject(input)) throw new Error("iteration must be an object");
  if (
    typeof input.kind !== "string" ||
    !(FOUNDER_ITERATION_KINDS as readonly string[]).includes(input.kind)
  ) {
    throw new Error("kind is not a meaningful founder iteration kind");
  }
  if (input.founder_only !== true) {
    throw new Error("founder_only must be explicitly true");
  }
  const schemaVersion = Number(input.schema_version);
  if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
    throw new Error("schema_version must be a positive integer");
  }
  const rollbackOf =
    input.rollback_of_revision === undefined || input.rollback_of_revision === null
      ? null
      : Number(input.rollback_of_revision);
  if (rollbackOf !== null && (!Number.isSafeInteger(rollbackOf) || rollbackOf < 1)) {
    throw new Error("rollback_of_revision must be a positive integer");
  }
  if (input.kind === "rollback" && rollbackOf === null) {
    throw new Error("rollback requires rollback_of_revision");
  }

  const normalized: FounderIterationInput = {
    kind: input.kind as FounderIterationKind,
    subject: boundedString(input.subject, "subject", 160) as string,
    label: boundedString(input.label, "label", 160) as string,
    reason: boundedString(input.reason, "reason", 2_000) as string,
    verdict: boundedString(input.verdict, "verdict", 1_000, false),
    before_ref: asObject(input.before_ref ?? {}, "before_ref"),
    after_ref: asObject(input.after_ref ?? {}, "after_ref"),
    state_snapshot: asObject(input.state_snapshot, "state_snapshot"),
    evidence_refs: asEvidenceRefs(input.evidence_refs ?? []),
    code_ref: boundedString(input.code_ref, "code_ref", 240, false),
    linked_revisions: asRevisionList(input.linked_revisions ?? []),
    schema_version: schemaVersion,
    founder_only: true,
  };
  if (rollbackOf !== null) normalized.rollback_of_revision = rollbackOf;
  return normalized;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export async function computeFounderIterationContentHash(
  input: FounderIterationInput,
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(input)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function adminHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function appendFounderSixRevision(
  founderUserId: string,
  input: unknown,
  idempotencyKey: string,
): Promise<Record<string, unknown>> {
  const normalized = normalizeFounderIterationInput(input);
  const key = boundedString(idempotencyKey, "idempotency_key", 200) as string;
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const response = await fetch(`${url}/rest/v1/rpc/append_founder_six_revision`, {
    method: "POST",
    headers: adminHeaders(serviceRoleKey),
    body: JSON.stringify({
      p_founder_user_id: founderUserId,
      p_kind: normalized.kind,
      p_subject: normalized.subject,
      p_label: normalized.label,
      p_reason: normalized.reason,
      p_verdict: normalized.verdict,
      p_before_ref: normalized.before_ref,
      p_after_ref: normalized.after_ref,
      p_state_snapshot: normalized.state_snapshot,
      p_evidence_refs: normalized.evidence_refs,
      p_code_ref: normalized.code_ref,
      p_linked_revisions: normalized.linked_revisions,
      p_schema_version: normalized.schema_version,
      p_founder_only: normalized.founder_only,
      p_rollback_of_revision: normalized.rollback_of_revision ?? null,
      p_idempotency_key: key,
    }),
  });
  if (!response.ok) {
    throw new Error(`founder revision append failed (${response.status})`);
  }
  const result = (await response.json()) as unknown;
  const row = Array.isArray(result) ? result[0] : result;
  if (!isPlainObject(row)) throw new Error("founder revision append returned no row");
  return row;
}

export async function gatherFounderSixRetentionExport(
  founderUserId: string,
): Promise<Record<string, unknown>> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const headers = adminHeaders(serviceRoleKey);
  const filters = `founder_user_id=eq.${encodeURIComponent(founderUserId)}`;
  const endpoints = {
    revisions: `${url}/rest/v1/founder_six_revisions?${filters}&order=revision.asc`,
    current: `${url}/rest/v1/founder_six_current?${filters}&limit=1`,
    audit: `${url}/rest/v1/founder_six_audit_events?${filters}&order=created_at.asc`,
  } as const;
  const entries = await Promise.all(
    Object.entries(endpoints).map(async ([key, endpoint]) => {
      const response = await fetch(endpoint, { method: "GET", headers, cache: "no-store" });
      if (!response.ok) throw new Error(`founder export ${key} failed (${response.status})`);
      return [key, await response.json()] as const;
    }),
  );
  return Object.fromEntries(entries);
}