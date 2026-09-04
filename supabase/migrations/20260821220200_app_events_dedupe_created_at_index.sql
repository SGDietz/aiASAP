-- 20260821220200 — Remove only truly equivalent duplicate non-unique indexes
-- on public.app_events(created_at). Only B-tree indexes with the same opclass
-- and collation are compared; ASC/DESC and NULLS ordering are interchangeable
-- through a backward B-tree scan. Composite, INCLUDE, expression, and partial
-- indexes are excluded. The oldest equivalent index is kept. Safe to rerun.

begin;

do $$
declare
  duplicate_index record;
begin
  for duplicate_index in
    with candidates as (
      select
        c.oid,
        c.relname,
        row_number() over (
          partition by
            am.oid,
            i.indclass::text,
            i.indcollation::text
          order by c.oid
        ) as equivalent_rank
      from pg_class c
      join pg_index i on i.indexrelid = c.oid
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_am am on am.oid = c.relam
      join pg_attribute a
        on a.attrelid = t.oid
       and a.attnum = i.indkey[0]
      where n.nspname = 'public'
        and t.relname = 'app_events'
        and am.amname = 'btree'
        and a.attname = 'created_at'
        and i.indisunique = false
        and i.indisprimary = false
        and i.indpred is null
        and i.indexprs is null
        and i.indnkeyatts = 1
        and i.indnatts = 1
    )
    select relname
    from candidates
    where equivalent_rank > 1
  loop
    execute format(
      'drop index if exists public.%I',
      duplicate_index.relname
    );
  end loop;
end
$$;

commit;
