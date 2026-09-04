-- 20260821220000 — Security hardening for the verified advisor queue.
-- Forward-only, local preparation. Production application remains gated.

begin;

alter view if exists public.app_session_ledger set (security_invoker = true);
alter view if exists public.provider_cost_rollup set (security_invoker = true);
alter view if exists public.list_mutation_audit set (security_invoker = true);

-- The body uses only pg_catalog.now(). An explicit immutable search path closes
-- the mutable-search-path advisor finding without trusting public objects.
alter function public.touch_updated_at() set search_path = pg_catalog;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Move only the verified unsafe placement. Do not relocate an extension that an
-- operator intentionally installed in some other non-public schema.
do $$
declare
  current_schema text;
begin
  select n.nspname
    into current_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'vector';

  if current_schema = 'public' then
    alter extension vector set schema extensions;
  end if;
end
$$;

-- Existing vector columns move by OID with the extension. Keep the privileged
-- RPC's operator lookup working, with trusted schemas searched before public.
do $$
declare
  signature regprocedure;
begin
  for signature in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'match_user_memory_facts'
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, extensions, public',
      signature
    );
  end loop;
end
$$;

-- These functions are not public RPCs. The auth trigger invokes
-- handle_new_user as its owner, so client EXECUTE grants are unnecessary.
do $$
declare
  signature regprocedure;
begin
  for signature in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('handle_new_user', 'match_user_memory_facts')
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      signature
    );
  end loop;
end
$$;

-- Preserve the legitimate server-side memory lookup and nothing broader.
do $$
declare
  signature regprocedure;
begin
  for signature in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'match_user_memory_facts'
  loop
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end
$$;

commit;
