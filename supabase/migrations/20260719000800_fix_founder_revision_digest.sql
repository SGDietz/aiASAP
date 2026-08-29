-- Qualify pgcrypto's digest function because the founder append function uses
-- an empty search_path and Supabase installs pgcrypto in the extensions schema.
-- Required follow-up to 20260718224000; no table or user-data mutation.

begin;

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

commit;
