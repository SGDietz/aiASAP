-- Durable aiASAP completed/partial founder follow-up lifecycle.
-- LOCAL PREPARATION ONLY. Do not apply remotely without G's separate,
-- explicit database-migration authorization.

begin;

alter table public.opportunity_notification_outbox
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz;

alter table public.opportunity_notification_outbox
  drop constraint if exists opportunity_notification_outbox_event_kind_check;
alter table public.opportunity_notification_outbox
  add constraint opportunity_notification_outbox_event_kind_check
  check (event_kind in (
    'new_visitor',
    'unfinished_opportunity',
    'follow_up_requested',
    'partial_follow_up_requested',
    'visitor_confirmation',
    'account_created_notification'
  ));

-- account_created_notification originates at /api/account/start, which is not
-- scoped to a visitor_opportunities row. Drop the NOT NULL on opportunity_id
-- but keep the FK biting for every other event kind via an equivalent CHECK.
alter table public.opportunity_notification_outbox
  alter column opportunity_id drop not null;

alter table public.opportunity_notification_outbox
  drop constraint if exists opportunity_notification_outbox_opportunity_id_required;
alter table public.opportunity_notification_outbox
  add constraint opportunity_notification_outbox_opportunity_id_required
  check (
    opportunity_id is not null
    or event_kind = 'account_created_notification'
  );

alter table public.opportunity_notification_outbox
  drop constraint if exists opportunity_notification_outbox_status_check;
alter table public.opportunity_notification_outbox
  add constraint opportunity_notification_outbox_status_check
  check (status in (
    'detected', 'queued', 'sending', 'sent', 'failed', 'dead_letter', 'acknowledged'
  ));

create index if not exists idx_opportunity_follow_up_due
  on public.opportunity_notification_outbox (next_attempt_at, created_at)
  where event_kind in ('follow_up_requested', 'partial_follow_up_requested')
    and status in ('queued', 'failed', 'sending');

create index if not exists idx_opportunity_follow_up_lease
  on public.opportunity_notification_outbox (lease_expires_at)
  where status = 'sending';

-- Serializes complete-vs-partial arbitration per opportunity before any
-- provider call. Complete wins over an unclaimed partial; once a partial send
-- is already claimed/sent, the later complete row is retired instead, so the
-- founder never receives both event types for one opportunity.
create or replace function public.claim_opportunity_follow_up(
  p_dedupe_key text,
  p_now timestamptz,
  p_lease_token uuid,
  p_lease_expires_at timestamptz
)
returns setof public.opportunity_notification_outbox
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target public.opportunity_notification_outbox%rowtype;
  target_opportunity_id uuid;
begin
  select opportunity_id into target_opportunity_id
    from public.opportunity_notification_outbox
   where dedupe_key = p_dedupe_key;
  if not found then return; end if;
  -- Take the shared opportunity lock before any row lock. Two competing event
  -- kinds must not each hold one sibling row while waiting for the other.
  perform pg_advisory_xact_lock(hashtextextended(target_opportunity_id::text, 0));

  -- Read under the opportunity lock because a competing claimant may have
  -- changed this row while we waited.
  select * into target
    from public.opportunity_notification_outbox
   where dedupe_key = p_dedupe_key
   for update;
  if target.status in ('sent', 'dead_letter') then return; end if;
  if target.status = 'queued' and target.next_attempt_at is not null and target.next_attempt_at > p_now then return; end if;
  if target.status = 'failed' and target.next_attempt_at is not null and target.next_attempt_at > p_now then return; end if;
  if target.status = 'sending' and target.lease_expires_at is not null and target.lease_expires_at > p_now then return; end if;

  if target.event_kind = 'partial_follow_up_requested' then
    if exists (
      select 1 from public.opportunity_notification_outbox
       where opportunity_id = target.opportunity_id
         and event_kind = 'follow_up_requested'
         and status <> 'dead_letter'
    ) then
      update public.opportunity_notification_outbox
         set status = 'dead_letter', error = 'superseded_by_complete_lead', next_attempt_at = null
       where id = target.id;
      return;
    end if;
  else
    if exists (
      select 1 from public.opportunity_notification_outbox
       where opportunity_id = target.opportunity_id
         and event_kind = 'partial_follow_up_requested'
         and status in ('sending', 'sent')
    ) then
      update public.opportunity_notification_outbox
         set status = 'dead_letter', error = 'partial_delivery_already_claimed', next_attempt_at = null
       where id = target.id;
      return;
    end if;
    update public.opportunity_notification_outbox
       set status = 'dead_letter', error = 'superseded_by_complete_lead', next_attempt_at = null
     where opportunity_id = target.opportunity_id
       and event_kind = 'partial_follow_up_requested'
       and status in ('queued', 'failed');
  end if;

  return query
  update public.opportunity_notification_outbox
     set status = 'sending',
         attempt_count = attempt_count + 1,
         error = null,
         lease_token = p_lease_token,
         lease_expires_at = p_lease_expires_at
   where id = target.id
  returning *;
end;
$$;

revoke all on function public.claim_opportunity_follow_up(text,timestamptz,uuid,timestamptz) from public;
grant execute on function public.claim_opportunity_follow_up(text,timestamptz,uuid,timestamptz) to service_role;

commit;
