import { afterEach, describe, expect, it, vi } from "vitest";
import { formatOperationalAlert, operationalIncidentId, safeOperationalDetail } from "../src/lib/operationalAlert";

afterEach(() => vi.unstubAllEnvs());

describe("aiASAP operational alerts", () => {
  it("uses stable company/stage/error incident identity", () => {
    expect(operationalIncidentId("notification-drain", "provider_timeout"))
      .toBe(operationalIncidentId("notification-drain", "provider_timeout"));
  });

  it("redacts customer PII, URLs, credentials, and multiline provider bodies", () => {
    const safe = safeOperationalDetail("sam@example.com 410-555-0199 https://storage.invalid/x token=secret\nraw body");
    expect(safe).not.toMatch(/sam@|410-555|storage\.invalid|secret/);
    expect(safe).not.toMatch(/[\r\n]/);
  });

  it("formats bounded actionable company/environment/stage alerts without customer data", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const alert = formatOperationalAlert({
      stage: "supabase-outbox-claim",
      severity: "critical",
      errorCode: "lease_timeout",
      safeDetail: "user@example.com timed out",
      correlationId: "corr-123",
    });
    expect(alert.text).toContain("aiASAP CRITICAL");
    expect(alert.text).toContain("Environment: preview");
    expect(alert.text).toContain("supabase-outbox-claim");
    expect(alert.text).toContain("Correlation: corr-123");
    expect(alert.text).not.toContain("user@example.com");
  });
});
