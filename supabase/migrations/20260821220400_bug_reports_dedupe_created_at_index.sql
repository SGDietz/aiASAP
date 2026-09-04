-- 20260821220400 — Remove the live-only legacy bug_reports created_at index
-- only after proving it is equivalent to the repo-canonical index. This is a
-- separately gated forward repair; it is not covered by the four-step apply.
-- Narrow rollback (run only after an explicit rollback decision):
-- create index bug_reports_created_at_idx on public.bug_reports (created_at desc);

begin;

do $$
declare
  canonical record;
  legacy record;
begin
  select
    i.indexrelid, i.indrelid, i.indisunique, i.indisprimary, i.indisvalid, i.indisready,
    i.indislive, i.indnatts, i.indnkeyatts, i.indpred, i.indexprs,
    i.indclass::text as indclass, i.indcollation::text as indcollation,
    i.indoption::text as indoption, am.amname, a.attname
  into canonical
  from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_am am on am.oid = c.relam
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
  where n.nspname = 'public' and c.relname = 'idx_bug_reports_created_at';

  select
    i.indexrelid, i.indrelid, i.indisunique, i.indisprimary, i.indisvalid, i.indisready,
    i.indislive, i.indnatts, i.indnkeyatts, i.indpred, i.indexprs,
    i.indclass::text as indclass, i.indcollation::text as indcollation,
    i.indoption::text as indoption, am.amname, a.attname
  into legacy
  from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_am am on am.oid = c.relam
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
  where n.nspname = 'public' and c.relname = 'bug_reports_created_at_idx';

  if canonical.indrelid is null and legacy.indrelid is null then
    raise notice 'bug_reports created_at dedupe no-op: both named indexes are absent';
    return;
  elsif canonical.indrelid is null then
    raise notice 'bug_reports created_at dedupe no-op: canonical index absent; legacy index left untouched';
    return;
  elsif legacy.indrelid is null then
    raise notice 'bug_reports created_at dedupe no-op: legacy index already absent';
    return;
  end if;

  if canonical.indrelid <> 'public.bug_reports'::regclass
     or legacy.indrelid <> 'public.bug_reports'::regclass then
    raise exception 'bug_reports created_at dedupe aborted: unexpected table';
  end if;
  if not canonical.indisvalid or not canonical.indisready or not canonical.indislive
     or not legacy.indisvalid or not legacy.indisready or not legacy.indislive then
    raise exception 'bug_reports created_at dedupe aborted: invalid or unready index';
  end if;
  if exists (
    select 1
    from pg_constraint
    where conindid in (canonical.indexrelid, legacy.indexrelid)
  ) then
    raise exception 'bug_reports created_at dedupe aborted: constraint-backed index present';
  end if;
  if canonical.amname <> 'btree' or legacy.amname <> 'btree'
     or canonical.indisunique or legacy.indisunique
     or canonical.indisprimary or legacy.indisprimary then
    raise exception 'bug_reports created_at dedupe aborted: access or uniqueness mismatch';
  end if;
  if canonical.indnatts <> 1 or legacy.indnatts <> 1
     or canonical.indnkeyatts <> 1 or legacy.indnkeyatts <> 1
     or canonical.indpred is not null or legacy.indpred is not null
     or canonical.indexprs is not null or legacy.indexprs is not null then
    raise exception 'bug_reports created_at dedupe aborted: composite, INCLUDE, partial, or expression index';
  end if;
  if canonical.attname <> 'created_at' or legacy.attname <> 'created_at'
     or canonical.indrelid <> legacy.indrelid
     or canonical.indclass <> legacy.indclass
     or canonical.indcollation <> legacy.indcollation
     or canonical.indoption <> legacy.indoption then
    raise exception 'bug_reports created_at dedupe aborted: definition mismatch';
  end if;

  drop index if exists public.bug_reports_created_at_idx;
  raise notice 'bug_reports created_at dedupe: removed live-only bug_reports_created_at_idx';
end
$$;

commit;
