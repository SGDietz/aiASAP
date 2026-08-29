export type AppEventEnvelopeRow = {
  event_id: string | null;
  utterance_id: string | null;
  trace_id: string | null;
  parent_event_id: string | null;
  idempotency_key: string | null;
  mutation_version: number | null;
  outcome: string | null;
  error_code: string | null;
  status_code: number | null;
  duration_ms: number | null;
  provider_request_id: string | null;
};

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return null;
  return value >= minimum && value <= maximum ? value : null;
}

/**
 * Keep the audit envelope queryable while bounding all untrusted client fields.
 * Event-specific content remains in the existing sanitized payload column.
 */
export function parseAppEventEnvelope(
  body: Record<string, unknown>,
): AppEventEnvelopeRow {
  return {
    event_id: boundedText(body.event_id, 200),
    utterance_id: boundedText(body.utterance_id, 200),
    trace_id: boundedText(body.trace_id, 200),
    parent_event_id: boundedText(body.parent_event_id, 200),
    idempotency_key: boundedText(body.idempotency_key, 300),
    mutation_version: boundedInteger(body.mutation_version, 0, Number.MAX_SAFE_INTEGER),
    outcome: boundedText(body.outcome, 80),
    error_code: boundedText(body.error_code, 160),
    status_code: boundedInteger(body.status_code, 100, 599),
    duration_ms: boundedInteger(body.duration_ms, 0, 86_400_000),
    provider_request_id: boundedText(body.provider_request_id, 300),
  };
}

/**
 * PostgREST reports an additive migration gap as a 400/PGRST204 response.
 * Only that exact class is safe to retry with legacy columns; auth, policy,
 * outage, conflict, and validation failures must retain the original error.
 */
export function isPostgrestMissingColumnError(
  status: number,
  detail: string,
  expectedColumns: readonly string[],
): boolean {
  if (status !== 400 || !detail) return false;
  const lower = detail.toLowerCase();
  const isSchemaCacheMiss =
    lower.includes("pgrst204") ||
    (lower.includes("could not find") && lower.includes("column"));
  return (
    isSchemaCacheMiss &&
    expectedColumns.some((column) => lower.includes(column.toLowerCase()))
  );
}

export function parseClientTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString();
}
