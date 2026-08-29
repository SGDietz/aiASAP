-- Permanent founder account retention and append-only meaningful 6 history.
-- Remote application requires G's separate explicit authorization.
-- Authorized on 2026-07-18 for aiASAP project wqszxsqzkaatghyrqviv; UUID seed remains separate.
-- This migration intentionally contains no protected-account seed row.
-- Privacy contract: revisions must not contain raw transcripts, raw messages,
-- third-party contact/profile payloads, or credentials/provider tokens.

begin;

create extension if not exists pgcrypto;

create table if not exists public.protected_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  canonical_email text not null unique,
  protection_class text not null default 'founder_permanent'
    check (protection_class = 'founder_permanent'),
  reason text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  check (canonical_email = lower(btrim(canonical_email)))
);

comment on table public.protected_accounts is
  'UUID-authoritative permanent-account registry. Email is discovery metadata only.';

create table if not exists public.founder_six_revisions (
  id uuid primary key default gen_random_uuid(),
  founder_user_id uuid not null references public.protected_accounts(user_id) on delete restrict,
  revision bigint not null,
  kind text not null check (kind in (
    'baseline', 'persona', 'behavior_rule', 'memory_correction', 'prompt',
    'configuration', 'feature_flag', 'evaluation', 'rollback'
  )),
  subject text not null check (char_length(subject) between 1 and 160),
  label text not null check (char_length(label) between 1 and 160),
  reason text not null check (char_length(reason) between 1 and 2000),
  verdict text check (verdict is null or char_length(verdict) <= 1000),
  parent_revision bigint,
  rollback_of_revision bigint,
  before_ref jsonb not null default '{}'::jsonb check (jsonb_typeof(before_ref) = 'object'),
  after_ref jsonb not null default '{}'::jsonb check (jsonb_typeof(after_ref) = 'object'),
  state_snapshot jsonb not null check (jsonb_typeof(state_snapshot) = 'object'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  code_ref text check (code_ref is null or char_length(code_ref) <= 240),
  linked_revisions bigint[] not null default '{}'::bigint[],
  schema_version integer not null default 1 check (schema_version > 0),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  founder_only boolean not null default true check (founder_only),
  created_at timestamptz not null default now(),
  unique (founder_user_id, revision),
  unique (founder_user_id, idempotency_key),
  foreign key (founder_user_id, parent_revision)
    references public.founder_six_revisions(founder_user_id, revision) on delete restrict,
  foreign key (founder_user_id, rollback_of_revision)
    references public.founder_six_revisions(founder_user_id, revision) on delete restrict
);

comment on table public.founder_six_revisions is
  'Immutable meaningful founder 6 iterations; never a raw transcript/message archive.';

create table if not exists public.founder_six_current (
  founder_user_id uuid primary key references public.protected_accounts(user_id) on delete restrict,
  revision bigint not null,
  updated_at timestamptz not null default now(),
  foreign key (founder_user_id, revision)
    references public.founder_six_revisions(founder_user_id, revision) on delete restrict
);

create table if not exists public.founder_six_audit_events (
  id uuid primary key default gen_random_uuid(),
  founder_user_id uuid not null references public.protected_accounts(user_id) on delete restrict,
  revision bigint not null,
  event_type text not null check (event_type in (
    'revision_appended', 'current_pointer_moved', 'rollback_appended'
  )),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (founder_user_id, revision)
    references public.founder_six_revisions(founder_user_id, revision) on delete restrict
);

create index if not exists founder_six_revisions_latest_idx
  on public.founder_six_revisions (founder_user_id, revision desc);
create index if not exists founder_six_revisions_kind_idx
  on public.founder_six_revisions (founder_user_id, kind, created_at desc);
create index if not exists founder_six_audit_order_idx
  on public.founder_six_audit_events (founder_user_id, created_at, id);

create or replace function public.reject_immutable_founder_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'permanent founder retention rows are append-only and immutable'
    using errcode = '55000';
end;
$$;

drop trigger if exists protected_accounts_immutable on public.protected_accounts;
create trigger protected_accounts_immutable
before update or delete on public.protected_accounts
for each row execute function public.reject_immutable_founder_row();

drop trigger if exists founder_six_revisions_immutable on public.founder_six_revisions;
create trigger founder_six_revisions_immutable
before update or delete on public.founder_six_revisions
for each row execute function public.reject_immutable_founder_row();

drop trigger if exists founder_six_audit_immutable on public.founder_six_audit_events;
create trigger founder_six_audit_immutable
before update or delete on public.founder_six_audit_events
for each row execute function public.reject_immutable_founder_row();

-- Defense in depth below the application: direct REST/service-role SQL may not
-- delete a protected founder's rows or detach them by changing user_id.
create or replace function public.reject_protected_owned_row_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.protected_accounts where user_id = old.user_id
  ) then
    if tg_op = 'DELETE' then
      raise exception 'protected founder data cannot be deleted'
        using errcode = '55000';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'protected founder data ownership cannot be changed'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.user_id is distinct from old.user_id
     and exists (
       select 1 from public.protected_accounts where user_id = new.user_id
     ) then
    raise exception 'rows cannot be reassigned into a protected founder account'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Attach to all known UUID-owned stores that exist now. Keeping media_events in
-- this allowlist makes the contract explicit even when that later table is not
-- present in an older remote schema.
do $protected_owned_triggers$
declare
  v_table text;
begin
  foreach v_table in array array[
    'user_memory_facts',
    'conversation_messages',
    'transcript_events',
    'media_events',
    'lead_sessions',
    'contact_entities'
  ]
  loop
    if to_regclass('public.' || v_table) is not null
       and exists (
         select 1
         from information_schema.columns as c
         where c.table_schema = 'public'
           and c.table_name = v_table
           and c.column_name = 'user_id'
       ) then
      execute format(
        'drop trigger if exists protected_account_delete_guard on public.%I',
        v_table
      );
      execute format(
        'create trigger protected_account_delete_guard before delete on public.%I for each row execute function public.reject_protected_owned_row_mutation()',
        v_table
      );
      execute format(
        'drop trigger if exists protected_account_owner_guard on public.%I',
        v_table
      );
      execute format(
        'create trigger protected_account_owner_guard before update of user_id on public.%I for each row execute function public.reject_protected_owned_row_mutation()',
        v_table
      );
    end if;
  end loop;
end;
$protected_owned_triggers$;

-- account_email_links is keyed by email rather than UUID. Preserve the founder's
-- captured signup/resume state and prevent changing the canonical association.
create or replace function public.reject_protected_email_link_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.protected_accounts
    where canonical_email = lower(btrim(old.email))
  ) then
    if tg_op = 'DELETE' then
      raise exception 'protected founder account-link state cannot be deleted'
        using errcode = '55000';
    end if;
    if lower(btrim(new.email)) is distinct from lower(btrim(old.email)) then
      raise exception 'protected founder account-link identity cannot be changed'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and lower(btrim(new.email)) is distinct from lower(btrim(old.email))
     and exists (
       select 1
       from public.protected_accounts
       where canonical_email = lower(btrim(new.email))
     ) then
    raise exception 'account-link state cannot be reassigned into a protected founder account'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $protected_email_link_triggers$
begin
  if to_regclass('public.account_email_links') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'account_email_links'
         and column_name = 'email'
     ) then
    drop trigger if exists protected_account_email_link_delete_guard
      on public.account_email_links;
    create trigger protected_account_email_link_delete_guard
      before delete on public.account_email_links
      for each row execute function public.reject_protected_email_link_mutation();
    drop trigger if exists protected_account_email_link_identity_guard
      on public.account_email_links;
    create trigger protected_account_email_link_identity_guard
      before update of email on public.account_email_links
      for each row execute function public.reject_protected_email_link_mutation();
  end if;
end;
$protected_email_link_triggers$;

-- The UUID FK already rejects auth deletion. These auth triggers make the
-- permanent identity rule explicit and also lock its canonical email.
create or replace function public.reject_protected_auth_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_canonical_email text;
begin
  select canonical_email into v_canonical_email
  from public.protected_accounts
  where user_id = old.id;

  if found then
    if tg_op = 'DELETE' then
      raise exception 'protected founder auth identity cannot be deleted'
        using errcode = '55000';
    end if;
    if lower(btrim(new.email)) is distinct from v_canonical_email then
      raise exception 'protected founder canonical email cannot be changed'
        using errcode = '55000';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protected_auth_delete_guard on auth.users;
create trigger protected_auth_delete_guard
before delete on auth.users
for each row execute function public.reject_protected_auth_identity_mutation();

drop trigger if exists protected_auth_email_guard on auth.users;
create trigger protected_auth_email_guard
before update of email on auth.users
for each row execute function public.reject_protected_auth_identity_mutation();

revoke all on function public.reject_protected_owned_row_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.reject_protected_email_link_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.reject_protected_auth_identity_mutation()
  from public, anon, authenticated, service_role;

create or replace function public.assert_founder_revision_privacy(p_value jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  pair record;
  item jsonb;
begin
  if p_value is null then return; end if;
  if jsonb_typeof(p_value) = 'object' then
    for pair in select key, value from jsonb_each(p_value)
    loop
      if lower(pair.key) ~ '(^|_)(messages?|raw_?transcript|transcript|contacts?|contact_?profile|api_?key|access_?token|refresh_?token|provider_?token|token|secret|password|authorization|cookie)($|_)' then
        raise exception 'founder revision contains prohibited privacy or credential field'
          using errcode = '22023';
      end if;
      perform public.assert_founder_revision_privacy(pair.value);
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for item in select value from jsonb_array_elements(p_value)
    loop
      perform public.assert_founder_revision_privacy(item);
    end loop;
  elsif jsonb_typeof(p_value) = 'string' and p_value #>> '{}' ~* '(bearer\s+\S+|sk-[a-z0-9_-]{16,}|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)' then
    raise exception 'founder revision contains credential-shaped data'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.append_founder_six_revision(
  p_founder_user_id uuid,
  p_kind text,
  p_subject text,
  p_label text,
  p_reason text,
  p_verdict text,
  p_before_ref jsonb,
  p_after_ref jsonb,
  p_state_snapshot jsonb,
  p_evidence_refs jsonb,
  p_code_ref text,
  p_linked_revisions bigint[],
  p_schema_version integer,
  p_founder_only boolean,
  p_rollback_of_revision bigint,
  p_idempotency_key text
)
returns public.founder_six_revisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_revision bigint;
  v_next_revision bigint;
  v_content_hash text;
  v_existing public.founder_six_revisions;
  v_inserted public.founder_six_revisions;
  v_snapshot jsonb := coalesce(p_state_snapshot, '{}'::jsonb);
  v_after_ref jsonb := coalesce(p_after_ref, '{}'::jsonb);
begin
  if not exists (
    select 1 from public.protected_accounts
    where user_id = p_founder_user_id and protection_class = 'founder_permanent'
  ) then
    raise exception 'account is not in the protected founder registry'
      using errcode = '42501';
  end if;
  if p_founder_only is distinct from true then
    raise exception 'founder_only must be true' using errcode = '22023';
  end if;
  if p_kind not in (
    'baseline', 'persona', 'behavior_rule', 'memory_correction', 'prompt',
    'configuration', 'feature_flag', 'evaluation', 'rollback'
  ) then
    raise exception 'invalid meaningful founder iteration kind' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key)) not between 1 and 200 then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_founder_user_id::text, 0));

  select revision into v_current_revision
  from public.founder_six_current
  where founder_user_id = p_founder_user_id;

  if p_kind = 'rollback' then
    if p_rollback_of_revision is null then
      raise exception 'rollback requires a target revision' using errcode = '22023';
    end if;
    select state_snapshot, after_ref
      into v_snapshot, v_after_ref
    from public.founder_six_revisions
    where founder_user_id = p_founder_user_id
      and revision = p_rollback_of_revision;
    if not found then
      raise exception 'rollback target revision does not exist' using errcode = '22023';
    end if;
  elsif p_rollback_of_revision is not null then
    raise exception 'rollback target is only valid for rollback revisions' using errcode = '22023';
  end if;

  perform public.assert_founder_revision_privacy(coalesce(p_before_ref, '{}'::jsonb));
  perform public.assert_founder_revision_privacy(v_after_ref);
  perform public.assert_founder_revision_privacy(v_snapshot);
  perform public.assert_founder_revision_privacy(coalesce(p_evidence_refs, '[]'::jsonb));

  select coalesce(max(revision), 0) + 1 into v_next_revision
  from public.founder_six_revisions
  where founder_user_id = p_founder_user_id;

  v_content_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'kind', p_kind,
          'subject', btrim(p_subject),
          'label', btrim(p_label),
          'reason', btrim(p_reason),
          'verdict', p_verdict,
          'before_ref', coalesce(p_before_ref, '{}'::jsonb),
          'after_ref', v_after_ref,
          'state_snapshot', v_snapshot,
          'evidence_refs', coalesce(p_evidence_refs, '[]'::jsonb),
          'code_ref', p_code_ref,
          'linked_revisions', to_jsonb(coalesce(p_linked_revisions, '{}'::bigint[])),
          'schema_version', p_schema_version,
          'founder_only', true,
          'rollback_of_revision', p_rollback_of_revision
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select * into v_existing
  from public.founder_six_revisions
  where founder_user_id = p_founder_user_id
    and idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.content_hash <> v_content_hash then
      raise exception 'idempotency key was already used for different content'
        using errcode = '23505';
    end if;
    return v_existing;
  end if;

  insert into public.founder_six_revisions (
    founder_user_id, revision, kind, subject, label, reason, verdict,
    parent_revision, rollback_of_revision, before_ref, after_ref,
    state_snapshot, evidence_refs, code_ref, linked_revisions,
    schema_version, content_hash, idempotency_key, founder_only
  ) values (
    p_founder_user_id, v_next_revision, p_kind, btrim(p_subject), btrim(p_label),
    btrim(p_reason), nullif(btrim(coalesce(p_verdict, '')), ''),
    v_current_revision, p_rollback_of_revision, coalesce(p_before_ref, '{}'::jsonb),
    v_after_ref, v_snapshot, coalesce(p_evidence_refs, '[]'::jsonb),
    nullif(btrim(coalesce(p_code_ref, '')), ''), coalesce(p_linked_revisions, '{}'::bigint[]),
    p_schema_version, v_content_hash, btrim(p_idempotency_key), true
  ) returning * into v_inserted;

  insert into public.founder_six_audit_events (
    founder_user_id, revision, event_type, details
  ) values (
    p_founder_user_id,
    v_next_revision,
    case when p_kind = 'rollback' then 'rollback_appended' else 'revision_appended' end,
    jsonb_build_object('kind', p_kind, 'label', btrim(p_label), 'content_hash', v_content_hash)
  );

  if p_kind <> 'evaluation' then
    insert into public.founder_six_current (founder_user_id, revision, updated_at)
    values (p_founder_user_id, v_next_revision, now())
    on conflict (founder_user_id) do update
      set revision = excluded.revision, updated_at = excluded.updated_at;
    insert into public.founder_six_audit_events (
      founder_user_id, revision, event_type, details
    ) values (
      p_founder_user_id,
      v_next_revision,
      'current_pointer_moved',
      jsonb_build_object('from_revision', v_current_revision, 'to_revision', v_next_revision)
    );
  end if;

  return v_inserted;
end;
$$;

alter table public.protected_accounts enable row level security;
alter table public.founder_six_revisions enable row level security;
alter table public.founder_six_current enable row level security;
alter table public.founder_six_audit_events enable row level security;

drop policy if exists protected_account_self_read on public.protected_accounts;
create policy protected_account_self_read on public.protected_accounts
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists founder_revisions_self_read on public.founder_six_revisions;
create policy founder_revisions_self_read on public.founder_six_revisions
for select to authenticated using ((select auth.uid()) = founder_user_id);
drop policy if exists founder_current_self_read on public.founder_six_current;
create policy founder_current_self_read on public.founder_six_current
for select to authenticated using ((select auth.uid()) = founder_user_id);
drop policy if exists founder_audit_self_read on public.founder_six_audit_events;
create policy founder_audit_self_read on public.founder_six_audit_events
for select to authenticated using ((select auth.uid()) = founder_user_id);

revoke all on public.protected_accounts from anon;
revoke all on public.founder_six_revisions from anon;
revoke all on public.founder_six_current from anon;
revoke all on public.founder_six_audit_events from anon;
revoke insert, update, delete on public.protected_accounts from authenticated;
revoke insert, update, delete on public.founder_six_revisions from authenticated;
revoke insert, update, delete on public.founder_six_current from authenticated;
revoke insert, update, delete on public.founder_six_audit_events from authenticated;
revoke insert, update, delete on public.protected_accounts from service_role;
revoke insert, update, delete on public.founder_six_revisions from service_role;
revoke insert, update, delete on public.founder_six_current from service_role;
revoke insert, update, delete on public.founder_six_audit_events from service_role;
grant select on public.protected_accounts to authenticated;
grant select on public.founder_six_revisions to authenticated;
grant select on public.founder_six_current to authenticated;
grant select on public.founder_six_audit_events to authenticated;

revoke all on function public.append_founder_six_revision(
  uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb,
  text, bigint[], integer, boolean, bigint, text
) from public, anon, authenticated;
grant execute on function public.append_founder_six_revision(
  uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb,
  text, bigint[], integer, boolean, bigint, text
) to service_role;

commit;