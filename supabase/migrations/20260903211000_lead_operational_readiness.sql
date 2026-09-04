-- aiASAP lead/email operational evidence ledger.
-- LOCAL PREPARATION ONLY. Do not apply remotely without G's separate,
-- explicit production Supabase migration authorization.

begin;

create table if not exists public.lead_consent_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  opportunity_id uuid references public.visitor_opportunities(id) on delete cascade,
  session_id text not null,
  event_kind text not null check (event_kind in (
    'contact_readback_confirmed', 'follow_up_authorized',
    'follow_up_declined', 'unrelated_decline'
  )),
  contact_method text check (contact_method in ('email', 'phone')),
  correlation_id text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_consent_events_opportunity_time
  on public.lead_consent_events (opportunity_id, occurred_at);
create index if not exists idx_lead_consent_events_session_time
  on public.lead_consent_events (session_id, occurred_at);

create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.opportunity_notification_outbox(id) on delete cascade,
  event_kind text not null,
  status text not null check (status in ('detected','queued','sending','sent','failed','dead_letter','acknowledged')),
  attempt_count integer not null default 0,
  provider_id text,
  safe_error text,
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  correlation_id text not null,
  idempotency_key text not null,
  recorded_at timestamptz not null default now(),
  unique (outbox_id, status, attempt_count)
);

create index if not exists idx_notification_delivery_attempts_outbox_time
  on public.notification_delivery_attempts (outbox_id, recorded_at);
create index if not exists idx_notification_delivery_attempts_failed
  on public.notification_delivery_attempts (recorded_at)
  where status in ('failed', 'dead_letter');

create or replace function public.audit_opportunity_notification_transition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.attempt_count is distinct from old.attempt_count then
    insert into public.notification_delivery_attempts (
      outbox_id, event_kind, status, attempt_count, provider_id, safe_error,
      next_attempt_at, lease_expires_at, correlation_id, idempotency_key
    ) values (
      new.id, new.event_kind, new.status, coalesce(new.attempt_count, 0), new.provider_id,
      left(regexp_replace(coalesce(new.error, ''), E'[\\r\\n]+', ' ', 'g'), 300),
      new.next_attempt_at, new.lease_expires_at,
      new.id::text, new.dedupe_key
    ) on conflict (outbox_id, status, attempt_count) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists opportunity_notification_transition_audit on public.opportunity_notification_outbox;
create trigger opportunity_notification_transition_audit
after insert or update of status, attempt_count on public.opportunity_notification_outbox
for each row execute function public.audit_opportunity_notification_transition();

-- The existing follow_up_requested outbox write is the single durable boundary
-- for an authorized follow-up. Mirror its already-validated chronology into the
-- consent ledger without storing contact values or depending on a second app write.
create or replace function public.capture_lead_consent_from_outbox()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  captured_session_id text := nullif(new.payload ->> 'sessionId', '');
  captured_method text := new.payload ->> 'contactMethod';
  readback_at timestamptz;
  authorized_at timestamptz;
begin
  if new.event_kind <> 'follow_up_requested' or captured_session_id is null then
    return new;
  end if;

  begin
    readback_at := (new.payload ->> 'readbackConfirmedAt')::timestamptz;
    authorized_at := (new.payload ->> 'followUpAuthorizedAt')::timestamptz;
  exception when others then
    return new;
  end;

  if readback_at is null or authorized_at is null or readback_at > authorized_at then
    return new;
  end if;

  insert into public.lead_consent_events (
    event_id, opportunity_id, session_id, event_kind, contact_method,
    correlation_id, occurred_at
  ) values
    (
      concat(new.id, ':contact_readback_confirmed'), new.opportunity_id,
      captured_session_id, 'contact_readback_confirmed',
      case when captured_method in ('email', 'phone') then captured_method end,
      new.id::text, readback_at
    ),
    (
      concat(new.id, ':follow_up_authorized'), new.opportunity_id,
      captured_session_id, 'follow_up_authorized',
      case when captured_method in ('email', 'phone') then captured_method end,
      new.id::text, authorized_at
    )
  on conflict (event_id) do nothing;

  return new;
end;
$$;

drop trigger if exists opportunity_notification_consent_audit on public.opportunity_notification_outbox;
create trigger opportunity_notification_consent_audit
after insert on public.opportunity_notification_outbox
for each row execute function public.capture_lead_consent_from_outbox();

alter table public.lead_consent_events enable row level security;
alter table public.notification_delivery_attempts enable row level security;
revoke all on public.lead_consent_events from anon, authenticated;
revoke all on public.notification_delivery_attempts from anon, authenticated;
grant all on public.lead_consent_events to service_role;
grant all on public.notification_delivery_attempts to service_role;

-- Record signing provenance and expiry, never the signed URL or token itself.
alter table public.media_events
  add column if not exists last_signed_at timestamptz,
  add column if not exists signed_link_expires_at timestamptz,
  add column if not exists signer_version text;

commit;
