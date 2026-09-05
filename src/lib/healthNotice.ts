export type MonitorNotice = { fingerprint: string; at: string };
export function shouldNotifyFailure(findings: string[], previous: MonitorNotice | null, now = Date.now()): boolean {
  if (!findings.length) return false;
  const fingerprint = JSON.stringify([...findings].sort());
  return !previous || previous.fingerprint !== fingerprint || now - Date.parse(previous.at) >= 24 * 60 * 60_000;
}

/** Read and record compact health state in the project's existing event table. */
export async function runHealthNotice(args: {
  company: "aiasap" | "isolve"; url: string; key: string; findings: string[];
  detail: string; dryRun?: boolean; send: (text: string) => Promise<{ sent: boolean }>;
}) {
  const environment = process.env.VERCEL_ENV ?? "local";
  const headers = { apikey: args.key, Authorization: `Bearer ${args.key}`, "Content-Type": "application/json" };
  const legacy = args.company === "isolve";
  const query = new URLSearchParams(legacy
    ? { select: "context", event: "eq.cloud_watch_heartbeat", env: `eq.${environment}`, order: "created_at.desc", limit: "1" }
    : { select: "payload", event_type: "eq.cloud_watch_heartbeat", surface: "eq.aiasap", "payload->>monitor_environment": `eq.${environment}`, order: "created_at.desc", limit: "1" });
  let previous: MonitorNotice | null = null;
  let stateRead = false;
  try {
    const r = await fetch(`${args.url}/rest/v1/app_events?${query}`, { headers, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      stateRead = true;
      const rows = await r.json(); const candidate = rows?.[0]?.[legacy ? "context" : "payload"]?.last_notice;
      if (candidate && typeof candidate.fingerprint === "string" && Number.isFinite(Date.parse(candidate.at))) previous = candidate;
    }
  } catch { /* Current failures still need attention when the event store is down. */ }
  if (args.dryRun) return { sent: false, stateRead, recorded: false };
  if (!args.findings.length) previous = null; // Silent recovery re-arms recurrence.
  let sent = false;
  if (shouldNotifyFailure(args.findings, previous)) {
    sent = (await args.send(args.detail)).sent;
    if (sent) previous = { fingerprint: JSON.stringify([...args.findings].sort()), at: new Date().toISOString() };
  }
  const payload = { monitor_environment: environment, monitor_version: "2026-09-05-errors-only", findings: args.findings, last_notice: previous, notification_sent: sent };
  const row = legacy ? { event: "cloud_watch_heartbeat", env: environment, context: payload }
    : { event_type: "cloud_watch_heartbeat", severity: "low", surface: "aiasap", route: "/api/cron/health", outcome: args.findings.length ? "findings" : "clean", payload };
  try {
    const r = await fetch(`${args.url}/rest/v1/app_events`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(row), signal: AbortSignal.timeout(5000) });
    return { sent, stateRead, recorded: r.ok };
  } catch { return { sent, stateRead, recorded: false }; }
}
