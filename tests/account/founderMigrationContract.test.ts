import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718224000_founder_account_retention.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("founder retention migration contract (static local gate)", () => {
  it("binds the protected-account registry to the auth UUID with delete restriction", () => {
    expect(sql).toMatch(/create table[^;]+protected_accounts/is);
    expect(sql).toMatch(/user_id\s+uuid\s+primary key/is);
    expect(sql).toMatch(/references\s+auth\.users\s*\(\s*id\s*\)\s+on delete restrict/is);
    expect(sql).toMatch(/protection_class/is);
    expect(sql).not.toMatch(/insert\s+into\s+public\.protected_accounts/is);
  });

  it("creates an immutable append-only revision ledger and mutable current pointer", () => {
    expect(sql).toMatch(/create table[^;]+founder_six_revisions/is);
    expect(sql).toMatch(/unique\s*\(\s*founder_user_id\s*,\s*revision\s*\)/is);
    expect(sql).toMatch(/founder_only\s+boolean\s+not null\s+default true/is);
    expect(sql).toMatch(/create table[^;]+founder_six_current/is);
  });

  it("makes revision and audit rows immutable to service-role mutation", () => {
    expect(sql).toMatch(/reject_immutable_founder_row/is);
    expect(sql).toMatch(/before update or delete on public\.founder_six_revisions/is);
    expect(sql).toMatch(/revoke\s+insert\s*,\s*update\s*,\s*delete/is);
  });

  it("blocks direct deletion or ownership detachment across every current founder data store", () => {
    expect(sql).toMatch(/reject_protected_owned_row_mutation/is);
    for (const table of [
      "user_memory_facts",
      "conversation_messages",
      "transcript_events",
      "media_events",
      "lead_sessions",
      "contact_entities",
    ]) {
      expect(sql).toContain(`'${table}'`);
    }
    expect(sql).toMatch(/reject_protected_email_link_mutation/is);
    expect(sql).toContain("'account_email_links'");
  });

  it("locks the protected auth UUID and canonical email against direct identity mutation", () => {
    expect(sql).toMatch(/reject_protected_auth_identity_mutation/is);
    expect(sql).toMatch(/before delete on auth\.users/is);
    expect(sql).toMatch(/before update of email on auth\.users/is);
  });

  it("uses a controlled transactional append function with audit and rollback semantics", () => {
    expect(sql).toMatch(/append_founder_six_revision/is);
    expect(sql).toMatch(/security definer/is);
    expect(sql).toMatch(/founder_six_audit_events/is);
    expect(sql).toMatch(/rollback/is);
    expect(sql).toMatch(/idempotency_key/is);
    expect(sql).toMatch(/extensions\.digest\(/is);
  });

  it("documents privacy exclusions instead of copying raw conversation data", () => {
    expect(sql).toMatch(/raw transcript/is);
    expect(sql).toMatch(/third-party/is);
    expect(sql).toMatch(/credential/is);
  });
});
