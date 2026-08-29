-- aiASAP audit envelope and derived ledgers (local migration; remote apply requires G).
-- Additive only: legacy app_events writers remain valid.

alter table if exists public.app_events
  add column if not exists event_id text,
  add column if not exists utterance_id text,
  add column if not exists trace_id text,
  add column if not exists parent_event_id text,
  add column if not exists idempotency_key text,
  add column if not exists mutation_version bigint,
  add column if not exists outcome text,
  add column if not exists error_code text,
  add column if not exists duration_ms integer,
  add column if not exists provider_request_id text;

-- The 20260529 migration installed v1 allow-list constraints whose event and
-- severity vocabularies are incompatible with the current audit envelope.
-- Remove both legacy names before installing the current severity contract.
alter table if exists public.app_events
  drop constraint if exists app_events_event_type_v1_check;
alter table if exists public.app_events
  drop constraint if exists app_events_severity_v1_check;

DO $$
BEGIN
  IF to_regclass('public.app_events') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.app_events'::regclass
         AND conname = 'app_events_severity_audit_check'
     ) THEN
    ALTER TABLE public.app_events
      ADD CONSTRAINT app_events_severity_audit_check
      CHECK (severity IN (
        'debug', 'info', 'warn', 'error',
        'critical', 'high', 'medium', 'low'
      )) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.app_events') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.app_events'::regclass
         AND conname = 'app_events_event_id_key'
     ) THEN
    ALTER TABLE public.app_events
      ADD CONSTRAINT app_events_event_id_key UNIQUE (event_id);
  END IF;
END $$;

create index if not exists idx_app_events_utterance_id
  on public.app_events (utterance_id, server_timestamp)
  where utterance_id is not null;

create index if not exists idx_app_events_trace_id
  on public.app_events (trace_id, server_timestamp)
  where trace_id is not null;

create index if not exists idx_app_events_session_mutation_version
  on public.app_events (session_id, mutation_version)
  where mutation_version is not null;

create index if not exists idx_app_events_provider_status
  on public.app_events (provider, status_code, server_timestamp desc)
  where provider is not null;

-- CUSTOM-mode transcript writes can be delivered more than once by browser
-- retries. The route supplies a deterministic event_id per utterance/role.
DO $$
BEGIN
  IF to_regclass('public.conversation_messages') IS NOT NULL THEN
    ALTER TABLE public.conversation_messages
      ADD COLUMN IF NOT EXISTS event_id text,
      ADD COLUMN IF NOT EXISTS utterance_id text;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.conversation_messages'::regclass
        AND conname = 'conversation_messages_event_id_key'
    ) THEN
      ALTER TABLE public.conversation_messages
        ADD CONSTRAINT conversation_messages_event_id_key UNIQUE (event_id);
    END IF;

    CREATE INDEX IF NOT EXISTS idx_conversation_messages_utterance_id
      ON public.conversation_messages (utterance_id)
      WHERE utterance_id IS NOT NULL;
  END IF;
END $$;

-- Durable session history derived from append-only lifecycle events.
create or replace view public.app_session_ledger as
select
  session_id,
  min(server_timestamp) filter (
    where event_type in ('session_started', 'session_live')
  ) as started_at,
  max(server_timestamp) filter (where event_type = 'session_ended') as ended_at,
  max(duration_ms) filter (where event_type = 'session_ended') as duration_ms,
  (array_agg(outcome order by server_timestamp desc)
    filter (where event_type = 'session_ended'))[1] as end_outcome,
  count(*) filter (where event_type = 'user_turn_accepted') as accepted_user_turns,
  count(*) filter (where event_type = 'user_turn_dropped') as dropped_user_turns
from public.app_events
where session_id is not null
group by session_id;

-- Provider observability/cost input. Dollar values are only summed when a route
-- recorded a configured rate; token/character units remain authoritative.
create or replace view public.provider_cost_rollup as
select
  session_id,
  provider,
  date_trunc('day', server_timestamp) as usage_day,
  count(*) as call_count,
  count(*) filter (where status_code between 200 and 299) as success_count,
  count(*) filter (where status_code >= 400) as failure_count,
  coalesce(sum(duration_ms), 0) as total_duration_ms,
  coalesce(sum(
    case when payload->>'input_tokens' ~ '^\d+$'
      then (payload->>'input_tokens')::bigint else 0 end
  ), 0) as input_tokens,
  coalesce(sum(
    case when payload->>'output_tokens' ~ '^\d+$'
      then (payload->>'output_tokens')::bigint else 0 end
  ), 0) as output_tokens,
  coalesce(sum(
    case when payload->>'input_characters' ~ '^\d+$'
      then (payload->>'input_characters')::bigint else 0 end
  ), 0) as input_characters,
  coalesce(sum(
    case when payload->>'cost_usd' ~ '^\d+(\.\d+)?$'
      then (payload->>'cost_usd')::numeric else 0 end
  ), 0)::numeric(14,6) as cost_usd
from public.app_events
where event_type = 'provider_call'
group by session_id, provider, date_trunc('day', server_timestamp);

create or replace view public.list_mutation_audit as
select
  event_id,
  session_id,
  utterance_id,
  mutation_version,
  idempotency_key,
  outcome,
  server_timestamp,
  payload->>'listId' as list_id,
  payload->'itemsBefore' as items_before,
  payload->'itemsAfter' as items_after,
  payload->'added' as added,
  payload->'removed' as removed
from public.app_events
where event_type = 'list_action';
