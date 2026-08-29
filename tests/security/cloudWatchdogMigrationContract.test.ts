import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260822221000_aiasap_independent_cloud_watchdog.sql"),
  "utf8",
);

describe("independent aiASAP cloud watchdog migration", () => {
  it("is aiASAP-namespaced, scheduled independently, and idempotent", () => {
    expect(migration).toContain("aiasap-cloud-heartbeat-watchdog");
    expect(migration).toContain("*/5 * * * *");
    expect(migration).toContain("cron.unschedule");
    expect(migration).toContain("cloud_watch_heartbeat");
    expect(migration).not.toContain("wildworks-watchdog");
  });

  it("uses durable incident state, stale detection, and throttling", () => {
    expect(migration).toContain("aiasap_cloud_watchdog_state");
    expect(migration).toContain("interval '35 minutes'");
    expect(migration).toContain("interval '60 minutes'");
    expect(migration).toContain("for update");
  });

  it("fails closed and contains no secret literals", () => {
    expect(migration).toContain("Delivery skipped: required Vault channel secrets are incomplete.");
    expect(migration).toContain("p_send boolean default true");
    expect(migration).toContain("p_send=false");
    expect(migration).not.toMatch(/\b\d{8,12}:[A-Za-z0-9_-]{20,}\b/);
    expect(migration).not.toMatch(/re_[A-Za-z0-9]{20,}/);
  });

  it("locks execution away from browser roles", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("revoke all on function public.aiasap_cloud_watchdog_tick(boolean) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.aiasap_cloud_watchdog_tick(boolean) to postgres, service_role");
  });
});
