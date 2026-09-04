-- aiASAP early-stage visitor/opportunity watchdog.
--
-- LOCAL PREPARATION ONLY. Do not apply remotely without G's separate,
-- explicit database-migration authorization.
--
-- Privacy contract:
-- - one canonical row per browser/session opportunity;
-- - summaries/outbox payloads contain concise business facts and internal
--   references, never raw transcripts, raw IP addresses, or raw contact values;
-- - raw speech remains in the existing secured conversation/transcript tables;
-- - follow-up consent is purpose-limited and is not marketing consent.

begin;

create table if not exists public.visitor_opportunities (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  conversation_session_id text,
  user_id uuid references auth.users(id) on delete set null,
  tester_label text,
  operator_excluded boolean not null default false,
  visitor_state text not null default 'detected'
    check (visitor_state in ('detected','exploring','engaged','stopped','idle_timeout','disconnected','abandoned','completed')),
  opportunity_state text not null default 'none'
    check (opportunity_state in ('none','draft','build_interest','contact_captured','account_created','submitted','declined','abandoned')),
  contact_state text not null default 'absent'
    check (contact_state in ('absent','captured','confirming','saving','failed','submitted')),
  account_state text not null default 'anonymous'
    check (account_state in ('anonymous','offered','declined','created')),
  build_request_state text not null default 'none'
    check (build_request_state in ('none','detected','declined','submitted')),
  discovery_stage text not null default 'arrival',
  summary jsonb not null default '{}'::jsonb,
  end_reason text,
  terminal_at timestamptz,
  grace_until timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunity_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.visitor_opportunities(id) on delete cascade,
  event_kind text not null check (event_kind in ('new_visitor','unfinished_opportunity')),
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('detected','queued','sent','failed','acknowledged')),
  attempt_count integer not null default 0,
  provider_id text,
  error text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_visitor_opportunities_terminal
  on public.visitor_opportunities (grace_until)
  where terminal_at is not null and opportunity_state in ('draft','build_interest','contact_captured');
create index if not exists idx_opportunity_outbox_retry
  on public.opportunity_notification_outbox (status, next_attempt_at)
  where status in ('queued','failed');

alter table public.visitor_opportunities enable row level security;
alter table public.opportunity_notification_outbox enable row level security;
-- No public policies: all reads/writes go through service-role routes.

create or replace function public.touch_visitor_opportunity_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists visitor_opportunities_touch_updated_at on public.visitor_opportunities;
create trigger visitor_opportunities_touch_updated_at
before update on public.visitor_opportunities
for each row execute function public.touch_visitor_opportunity_updated_at();

drop trigger if exists opportunity_outbox_touch_updated_at on public.opportunity_notification_outbox;
create trigger opportunity_outbox_touch_updated_at
before update on public.opportunity_notification_outbox
for each row execute function public.touch_visitor_opportunity_updated_at();

-- Atomic, retry-safe confirmation path. The caller must already have read the
-- value back and received explicit confirmation. Contact stays in the existing
-- contact/lead authorities; the opportunity summary stores method/status only.
create or replace function public.submit_opportunity_contact(
  p_session_id text,
  p_conversation_session_id text,
  p_method text,
  p_value text,
  p_full_name text default null,
  p_source_text text default null,
  p_tester_label text default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_opportunity public.visitor_opportunities;
  v_email text := null;
  v_phone text := null;
begin
  if p_method not in ('email','phone') or nullif(trim(p_value), '') is null then
    raise exception 'verified email or phone required';
  end if;
  if p_method = 'email' then v_email := lower(trim(p_value)); else v_phone := trim(p_value); end if;

  update public.contact_entities set
    full_name = coalesce(nullif(trim(p_full_name),''), full_name),
    email = coalesce(v_email, email), phone = coalesce(v_phone, phone),
    source_text = p_source_text, tester_label = coalesce(p_tester_label, tester_label),
    updated_at = now()
  where session_id = coalesce(nullif(p_conversation_session_id,''), p_session_id);
  if not found then
    insert into public.contact_entities(session_id, full_name, email, phone, source_text, tester_label)
    values (coalesce(nullif(p_conversation_session_id,''), p_session_id), nullif(trim(p_full_name),''), v_email, v_phone, p_source_text, p_tester_label);
  end if;

  insert into public.lead_sessions(session_id, consent_status, full_name, email, phone, last_prompted_field, last_prompted_at, tester_label)
  values (coalesce(nullif(p_conversation_session_id,''), p_session_id), 'accepted', nullif(trim(p_full_name),''), v_email, v_phone, 'build_follow_up_submitted', now(), p_tester_label)
  on conflict (session_id) do update set
    consent_status = 'accepted',
    full_name = coalesce(excluded.full_name, lead_sessions.full_name),
    email = coalesce(excluded.email, lead_sessions.email),
    phone = coalesce(excluded.phone, lead_sessions.phone),
    last_prompted_field = excluded.last_prompted_field,
    last_prompted_at = excluded.last_prompted_at,
    tester_label = coalesce(excluded.tester_label, lead_sessions.tester_label),
    updated_at = now();

  insert into public.visitor_opportunities(session_id, conversation_session_id, tester_label, visitor_state, opportunity_state, contact_state, build_request_state, discovery_stage, summary)
  values (p_session_id, p_conversation_session_id, p_tester_label, 'completed', 'submitted', 'submitted', 'submitted', 'follow_up_submitted', jsonb_build_object('contact_method',p_method,'contact_present',true))
  on conflict (session_id) do update set
    conversation_session_id = coalesce(excluded.conversation_session_id, visitor_opportunities.conversation_session_id),
    visitor_state = 'completed', opportunity_state = 'submitted', contact_state = 'submitted',
    build_request_state = 'submitted', discovery_stage = 'follow_up_submitted',
    summary = visitor_opportunities.summary || jsonb_build_object('contact_method',p_method,'contact_present',true),
    terminal_at = null, grace_until = null
  returning * into v_opportunity;

  return jsonb_build_object('ok',true,'opportunity_id',v_opportunity.id,'state','submitted');
end;
$$;

revoke all on function public.submit_opportunity_contact(text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_opportunity_contact(text,text,text,text,text,text,text) to service_role;

commit;
