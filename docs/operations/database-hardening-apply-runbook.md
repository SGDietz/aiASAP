# Database repair apply runbook

Chief is the sole installer and verifier for this aiASAP repair set. This
runbook authorizes no deploy, push, commit, provider or LiveAvatar change,
Supabase Auth-setting change, or unrelated database mutation.

## Deterministic order

Supabase records migrations by their numeric filename prefix. Apply one file
at a time in this exact order, stopping for the corresponding check after each:

1. `20260821215900_bug_reports_canonical_superset.sql`
   - This additive migration intentionally runs first because the hot-reloaded
     bug-report route already writes canonical columns that were absent live.
   - Verify all 11 pre-existing rows remain, `transcript` is `jsonb`, the
     canonical and legacy columns coexist, and `bug_reports_status_check` is
     present and validated.
2. `20260821220000_security_hardening.sql`
   - Verify the three views use `security_invoker=true`; vector is in
     `extensions`; function search paths and RPC grants match the migration.
3. `20260821220100_rls_policy_uid_scalar_subselect.sql`
   - Verify the nine advisor-flagged policies retain their table, role, command,
     USING, and WITH CHECK contracts and now use scalar `SELECT auth.uid()`.
   - Separately verify the four founder/protected policies remain unchanged,
     scalar invariants; this migration must not drop or recreate them.
4. `20260821220200_app_events_dedupe_created_at_index.sql`
   - Verify exactly one equivalent single-column B-tree `created_at` index
     remains and all non-equivalent indexes are untouched.

## Pre-apply gates

- Reconfirm linked migration inventory and exact live schema/data counts.
- Verify the encrypted current-state snapshot hash and DPAPI decrypt round trip,
  the narrow logical rollback script, and a completed physical backup.
- Run the four migrations inside one live transaction ending in `ROLLBACK`,
  with assertions inside the transaction. Recheck that the pre-state was fully
  restored after rollback. This is the structural rehearsal when no disposable
  local Supabase stack is available.
- Run a linked dry-run and confirm only the four files above are pending.

## One-at-a-time apply

Use a fresh staged Supabase work directory for each step. Each stage contains
all already-applied migration files plus only the next pending file. Confirm
the stage's linked `db push --dry-run` lists exactly that one file, then run
`db push` so the CLI applies the SQL and records its migration-history row as
one managed operation. Immediately verify both that row and the stated
postcondition. Do not expose the next migration until the current check passes.

Do not run a migration body through `db query` and then manually insert a
`supabase_migrations.schema_migrations` row. Those two writes can split, leaving
schema and history inconsistent. Manual history insertion is rejected for this
runbook.

On any unexpected result, stop. Capture read-only drift evidence and do not
fix forward or execute the rollback without a separate, evidence-backed
decision.

## Residual duplicate index (applied and verified)

After the four-step apply, the advisor found equivalent
`bug_reports_created_at_idx` (live-only legacy name) and
`idx_bug_reports_created_at` (repo-canonical name). The four-step authorization
does not cover another write, so live work stopped.

G separately authorized `20260821220400_bug_reports_dedupe_created_at_index.sql`.
It targets the exact pair, asserts both are valid, ready, live,
non-unique single-column B-tree indexes on `public.bug_reports(created_at)`
with identical opclass, collation, and sort options, then drops only the
live-only legacy name. It refuses constraint-backed indexes, raises on unsafe
drift, and logs a clear no-op when either named index is absent.

The staged CLI push completed and recorded history. Post-state retained all 11
bug-report rows and exactly three indexes: the primary key, repo-canonical
`idx_bug_reports_created_at`, and partial `idx_bug_reports_user_id`. Performance
advisors reported no issues. Narrow rollback SQL is:
`create index bug_reports_created_at_idx on public.bug_reports (created_at desc);`

The applied source did not contain `set local lock_timeout = '5s'`; that late
review note arrived after the push. The reviewed execution remained bounded:
the quiet preflight showed zero events in five minutes and zero session starts
in thirty minutes, the table had 11 rows, both indexes were valid and
non-constraint-backed, the transaction-only rehearsal passed, and the actual
CLI push completed immediately with the expected DROP notice and matching
history/post-state. Do not rewrite this applied migration. Future live DDL
migrations should set a short local lock timeout before lock-taking statements.

## Deferred items

- The 1,082 existing orphan conversation session IDs are not backfilled and no
  foreign key is added. The local route attempts the parent first, still
  captures the child if that upsert fails, and returns `parentPersisted:false`.
- Leaked-password protection is a hosted Auth setting documented separately;
  these migrations do not change it.
- `media_events` is excluded because no matching policy exists in the current
  live policy catalog or advisor queue.
