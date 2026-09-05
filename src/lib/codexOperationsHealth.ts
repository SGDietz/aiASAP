type OperatorRow = { created_at?: string; payload?: { pending_count?: number; oldest_pending_at?: string; active_incidents?: Array<{ status?: string; first_seen?: string; claim_until?: string }> }; context?: OperatorRow["payload"] };
type OperatorFinding = { code: string; detail: string };
export function operatorHealthFindings(row: OperatorRow | undefined, now = Date.now()): OperatorFinding[] {
  const age = now - Date.parse(row?.created_at ?? "");
  if (!Number.isFinite(age) || age > 30 * 60_000) return [{ code: "codex_not_checking_in", detail: "Codex has not recorded an operational check within 30 minutes. Automatic repairs may be stopped; check Mission-Control and the Codex scheduled task." }];
  const detail = row?.payload ?? row?.context;
  const incidents = detail?.active_incidents ?? [], findings: OperatorFinding[] = [];
  if (incidents.some(i => i.status === "working" && Date.parse(i.claim_until ?? "") < now)) findings.push({ code: "codex_repair_stalled", detail: "A Codex repair has passed its working lease without a progress update. The incident needs attention." });
  if (incidents.some(i => i.status === "open" && now - Date.parse(i.first_seen ?? "") > 20 * 60_000)) findings.push({ code: "codex_incident_unclaimed", detail: "An incident has waited over 20 minutes without Codex claiming the repair." });
  if ((detail?.pending_count ?? 0) > 0 && now - Date.parse(detail?.oldest_pending_at ?? "") > 10 * 60_000) findings.push({ code: "codex_alerts_undelivered", detail: "Operational notices have remained undelivered for over 10 minutes, including fallback delivery. Check the alert channels and Codex task history." });
  return findings;
}
/** The cloud checks the operator independently of Mission-Control and the Codex app. */
export async function readCodexOperationsHealth(company: "wildworks" | "aiasap" | "isolve", url: string, key: string): Promise<OperatorFinding[]> {
  if (process.env.CODEX_OPERATIONS_ENABLED !== "true") return [];
  const query = new URLSearchParams(company === "isolve"
    ? { select: "created_at,context", event: "eq.codex_operator_heartbeat", env: "eq.production", order: "created_at.desc", limit: "1" }
    : company === "wildworks" ? { select: "created_at,payload", event_type: "eq.codex_operator_heartbeat", "payload->>company": "eq.wildworks", "payload->>environment": "eq.production", order: "created_at.desc", limit: "1" }
    : { select: "created_at,payload", event_type: "eq.codex_operator_heartbeat", surface: `eq.${company}`, "payload->>environment": "eq.production", order: "created_at.desc", limit: "1" });
  try {
    const r = await fetch(`${url.trim().replace(/\/$/, "")}/rest/v1/app_events?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error("Operator state unavailable");
    const rows = await r.json(); return operatorHealthFindings(rows?.[0]);
  } catch { return [{ code: "codex_heartbeat_unreadable", detail: "The cloud monitor cannot read Codex's operational heartbeat." }]; }
}
