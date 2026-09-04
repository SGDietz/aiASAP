import { createHash } from "node:crypto";
import { sendTelegramAlert, type TelegramAlertResult } from "./telegramAlert";

export type OperationalSeverity = "warning" | "critical" | "resolved";

export type OperationalIncident = {
  stage: string;
  severity: OperationalSeverity;
  errorCode: string;
  safeDetail?: unknown;
  correlationId?: string | null;
};

const SECRET_OR_PII = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  /\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g,
  /\bhttps?:\/\/\S+/gi,
  /\b(?:sk-|xox[baprs]-|ghp_|Bearer\s+)[A-Za-z0-9._-]+/gi,
  /\b(?:password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
];

export function safeOperationalDetail(raw: unknown): string {
  let text = raw instanceof Error ? raw.message : String(raw ?? "unknown failure");
  for (const pattern of SECRET_OR_PII) text = text.replace(pattern, "[redacted]");
  return text.replace(/[\r\n\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function operationalIncidentId(stage: string, errorCode: string): string {
  return createHash("sha256").update(`aiASAP\0${stage}\0${errorCode}`).digest("hex").slice(0, 16);
}

export function formatOperationalAlert(incident: OperationalIncident): { key: string; text: string } {
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
  const incidentId = operationalIncidentId(incident.stage, incident.errorCode);
  const lines = [
    `[aiASAP ${incident.severity.toUpperCase()}] ${incident.stage}`,
    `Incident: ${incidentId}`,
    `Environment: ${environment}`,
    `Error: ${safeOperationalDetail(incident.errorCode)}`,
  ];
  if (incident.safeDetail) lines.push(`Detail: ${safeOperationalDetail(incident.safeDetail)}`);
  if (incident.correlationId) lines.push(`Correlation: ${safeOperationalDetail(incident.correlationId)}`);
  return { key: `aiasap:${incident.stage}:${incidentId}:${incident.severity}`, text: lines.join("\n") };
}

export async function sendOperationalAlert(incident: OperationalIncident): Promise<TelegramAlertResult> {
  const alert = formatOperationalAlert(incident);
  return sendTelegramAlert(alert.key, alert.text);
}
