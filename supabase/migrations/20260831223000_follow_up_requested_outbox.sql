-- aiASAP follow_up_requested outbox kind + sending status.
--
-- LOCAL PREPARATION ONLY. Do not apply remotely without G's separate,
-- explicit database-migration authorization.
--
-- Existing CHECK only allows event_kind in (new_visitor, unfinished_opportunity)
-- and status in (detected, queued, sent, failed, acknowledged). Durable founder
-- follow-up needs follow_up_requested and queued -> sending -> sent|failed.

begin;

alter table public.opportunity_notification_outbox
  drop constraint if exists opportunity_notification_outbox_event_kind_check;
alter table public.opportunity_notification_outbox
  add constraint opportunity_notification_outbox_event_kind_check
  check (event_kind in ('new_visitor', 'unfinished_opportunity', 'follow_up_requested'));

alter table public.opportunity_notification_outbox
  drop constraint if exists opportunity_notification_outbox_status_check;
alter table public.opportunity_notification_outbox
  add constraint opportunity_notification_outbox_status_check
  check (status in ('detected', 'queued', 'sending', 'sent', 'failed', 'acknowledged'));

commit;

