import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(__dirname, "../supabase/migrations/20260822090000_visitor_opportunity_watchdog.sql"), "utf8");

describe("local-only opportunity persistence contract", () => {
  it("has one canonical opportunity and one outbox event per dedupe key", () => {
    expect(migration).toMatch(/session_id text not null unique/i);
    expect(migration).toMatch(/dedupe_key text not null unique/i);
  });
  it("keeps operator, visitor, contact, account, terminal and delivery states distinct", () => {
    for (const term of ["operator_excluded", "contact_state", "account_state", "grace_until", "queued", "sent", "failed", "acknowledged"]) {
      expect(migration).toContain(term);
    }
  });
  it("documents and enforces service-role-only privacy boundaries", () => {
    expect(migration).toMatch(/never raw transcripts, raw IP addresses, or raw contact values/i);
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/revoke all on function public\.submit_opportunity_contact/i);
    expect(migration).toMatch(/grant execute on function public\.submit_opportunity_contact[^;]+to service_role/i);
    expect(migration.trim()).toMatch(/^--[\s\S]*\bbegin;[\s\S]*commit;$/i);
  });
});
