-- 20260525_add_tester_label.sql
--
-- Adds a `tester_label text` column to active write-path tables so tester
-- sessions launched via clean tester links (e.g. https://aiasap.ai/?tester=john-tn)
-- are distinguishable in the data.
--
-- LOCAL ONLY. Do not apply to remote DB without G's explicit instruction.
-- All ALTERs and CREATE INDEXes use IF NOT EXISTS guards so the migration
-- is safe to run repeatedly.

alter table public.conversation_messages
  add column if not exists tester_label text;
alter table public.lead_sessions
  add column if not exists tester_label text;
alter table public.transcript_events
  add column if not exists tester_label text;
alter table public.contact_entities
  add column if not exists tester_label text;
alter table public.media_events
  add column if not exists tester_label text;

create index if not exists idx_conversation_messages_tester_label
  on public.conversation_messages (tester_label)
  where tester_label is not null;
create index if not exists idx_lead_sessions_tester_label
  on public.lead_sessions (tester_label)
  where tester_label is not null;
create index if not exists idx_transcript_events_tester_label
  on public.transcript_events (tester_label)
  where tester_label is not null;
create index if not exists idx_contact_entities_tester_label
  on public.contact_entities (tester_label)
  where tester_label is not null;
create index if not exists idx_media_events_tester_label
  on public.media_events (tester_label)
  where tester_label is not null;
