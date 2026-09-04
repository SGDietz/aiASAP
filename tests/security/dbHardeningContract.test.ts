import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const migration = (name: string) =>
  readFileSync(path.join(root, "supabase", "migrations", name), "utf8");
const stripSqlComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\r\n]*/g, "");

describe("database hardening migration contracts", () => {
  it("sets all three advisor-flagged views to invoker semantics", () => {
    const sql = migration("20260821220000_security_hardening.sql");
    for (const view of [
      "app_session_ledger",
      "provider_cost_rollup",
      "list_mutation_audit",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `alter view if exists public\\.${view} set \\(security_invoker = true\\)`,
          "i",
        ),
      );
    }
  });

  it("pins function paths, moves only public vector, and removes client grants", () => {
    const sql = migration("20260821220000_security_hardening.sql");
    expect(sql).toContain(
      "alter function public.touch_updated_at() set search_path = pg_catalog",
    );
    expect(sql).toMatch(
      /if current_schema = 'public'[\s\S]*alter extension vector set schema extensions/i,
    );
    expect(sql).toContain("pg_catalog, extensions, public");
    expect(sql).toMatch(
      /revoke all on function %s from public, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /grant execute on function %s to service_role/i,
    );
  });

  it("rewrites exactly the nine named policies with scalar auth.uid calls", () => {
    const sql = migration(
      "20260821220100_rls_policy_uid_scalar_subselect.sql",
    );
    const policies = [
      "users: self-select",
      "users: self-update",
      "transcript_events: owner-select",
      "conversation_messages: owner-select",
      "lead_sessions: owner-select",
      "contact_entities: owner-select",
      "user_memory_facts: owner-select",
      "user_memory_facts: owner-delete",
      "app_events: owner-select",
    ];
    for (const policy of policies) expect(sql).toContain(`"${policy}"`);
    expect((sql.match(/create policy/gi) ?? [])).toHaveLength(9);
    const statements = sql.replace(/^--.*$/gm, "");
    expect(statements.match(/auth\.uid\(\)/gi) ?? []).toHaveLength(10);
    expect(statements.match(/select auth\.uid\(\)/gi) ?? []).toHaveLength(10);
  });

  it("deduplicates only equivalent single-column created_at indexes", () => {
    const sql = migration(
      "20260821220200_app_events_dedupe_created_at_index.sql",
    );
    for (const guard of [
      "am.oid",
      "am.amname = 'btree'",
      "i.indclass::text",
      "i.indcollation::text",
      "i.indpred is null",
      "i.indexprs is null",
      "i.indnkeyatts = 1",
      "i.indnatts = 1",
      "a.attname = 'created_at'",
    ]) {
      expect(sql).toContain(guard);
    }
  });

  it("builds a data-preserving bug-report superset with JSON transcript", () => {
    const sql = migration(
      "20260821215900_bug_reports_canonical_superset.sql",
    );
    for (const column of [
      "summary",
      "trigger_text",
      "report",
      "page_url",
      "active_list",
      "list_snapshot",
      "device",
      "emailed",
      "email_error",
    ]) {
      expect(sql).toMatch(
        new RegExp(`add column if not exists ${column}`, "i"),
      );
    }
    expect(sql).toMatch(/alter column transcript type jsonb/i);
    expect(sql).toContain("constraint bug_reports_status_check");
    expect(sql).toMatch(/validate constraint bug_reports_status_check/i);
    expect(sql).toContain("sync_bug_report_aliases");
    expect(sql).not.toMatch(/drop table|drop column/i);
  });

  it("asserts exact equivalence before dropping only the live-only bug-report index", () => {
    const sql = migration(
      "20260821220400_bug_reports_dedupe_created_at_index.sql",
    );
    const statements = stripSqlComments(sql);
    for (const guard of [
      "'public.bug_reports'::regclass",
      "am.amname",
      "indisunique",
      "indisprimary",
      "indisvalid",
      "indisready",
      "indislive",
      "pg_constraint",
      "conindid",
      "indnatts",
      "indnkeyatts",
      "indpred",
      "indexprs",
      "indclass",
      "indcollation",
      "indoption",
      "raise exception",
      "raise notice",
    ]) {
      expect(statements).toContain(guard);
    }
    expect(statements).toMatch(
      /^\s*drop index if exists public\.bug_reports_created_at_idx\s*;\s*$/im,
    );
    expect(statements).not.toMatch(
      /^\s*drop index if exists public\.idx_bug_reports_created_at\s*;\s*$/im,
    );
    expect((statements.match(/^\s*drop index\b/gim) ?? [])).toHaveLength(1);
    expect(statements).not.toMatch(/\bformat\s*\(|\|\|/i);
    expect(statements).not.toMatch(/\bexecute\s+(?:format\s*\(|['"])/i);
    expect(sql).toContain(
      "create index bug_reports_created_at_idx on public.bug_reports (created_at desc);",
    );
  });
});
