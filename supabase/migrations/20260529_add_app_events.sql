-- 20260529_add_app_events.sql
--
-- aiASAP app telemetry v1.
--
-- LOCAL ONLY until G approves the exact SQL. Do not push/apply remotely without
-- G's explicit Supabase push approval.
--
-- Intent:
-- - Consolidate product telemetry into one append-only public.app_events table.
-- - Keep legacy visitor_* / feedback_* / preference_* remote tables untouched.
-- - Do not store raw full transcripts or sensitive prompt bodies by default.
-- - Feedback/event copy must use digit `6`, never the word "Six".
-- - Writes are expected to go through a server-side service-role route.

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  surface text not null default 'aiasap',
  session_id text,
  visitor_id text,
  anonymous_visitor_id text,
  user_id uuid references auth.users(id) on delete set null,
  tester_label text,
  route text,
  referrer text,
  provider text,
  severity text not null default 'info',
  status_code integer,
  user_visible_state text,
  client_timestamp timestamptz,
  server_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  client_meta jsonb not null default '{}'::jsonb
);

-- Existing remote aiASAP already has an app_events table from older telemetry work.
-- Keep this migration additive/idempotent so it safely upgrades that shape instead
-- of assuming an empty database.
alter table public.app_events
  add column if not exists surface text not null default 'aiasap';
alter table public.app_events
  add column if not exists visitor_id text;
alter table public.app_events
  add column if not exists anonymous_visitor_id text;
alter table public.app_events
  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.app_events
  add column if not exists tester_label text;
alter table public.app_events
  add column if not exists route text;
alter table public.app_events
  add column if not exists referrer text;
alter table public.app_events
  add column if not exists provider text;
alter table public.app_events
  add column if not exists severity text not null default 'info';
alter table public.app_events
  add column if not exists status_code integer;
alter table public.app_events
  add column if not exists user_visible_state text;
alter table public.app_events
  add column if not exists client_timestamp timestamptz;
alter table public.app_events
  add column if not exists server_timestamp timestamptz not null default now();
alter table public.app_events
  add column if not exists created_at timestamptz not null default now();
alter table public.app_events
  add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.app_events
  add column if not exists client_meta jsonb not null default '{}'::jsonb;

comment on table public.app_events is
  'Append-only aiASAP product telemetry v1. Store small metadata/events, not raw transcripts. Feedback copy uses digit 6, never Six.';
comment on column public.app_events.payload is
  'Small event-specific JSON only. Do not store raw full transcripts or sensitive prompt bodies by default.';
comment on column public.app_events.client_meta is
  'Low-sensitivity client metadata such as user agent family, timezone, locale, viewport/screen, and feature flags.';

create index if not exists idx_app_events_session_id
  on public.app_events (session_id)
  where session_id is not null;

create index if not exists idx_app_events_visitor_id_server_timestamp
  on public.app_events (visitor_id, server_timestamp desc)
  where visitor_id is not null;

create index if not exists idx_app_events_anonymous_visitor_id_server_timestamp
  on public.app_events (anonymous_visitor_id, server_timestamp desc)
  where anonymous_visitor_id is not null;

create index if not exists idx_app_events_event_type
  on public.app_events (event_type);

create index if not exists idx_app_events_tester_label
  on public.app_events (tester_label)
  where tester_label is not null;

create index if not exists idx_app_events_server_timestamp
  on public.app_events (server_timestamp desc);

-- Converge legacy anonymous ids into the canonical visitor_id without dropping
-- anonymous_visitor_id. This is an additive backfill; readers should still use
-- coalesce(visitor_id, anonymous_visitor_id) during the transition.
update public.app_events
set visitor_id = anonymous_visitor_id
where visitor_id is null
  and anonymous_visitor_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_events_event_type_v1_check'
      and conrelid = 'public.app_events'::regclass
  ) then
    alter table public.app_events
      add constraint app_events_event_type_v1_check
      check (
        event_type in (
          -- Product telemetry v1
          'page_view',
          'card_shown',
          'card_clicked',
          'mic_started',
          'mic_stopped',
          'transcript_partial',
          'transcript_final',
          'six_response_start',
          'six_response_end',
          'silence_timeout',
          'interruption',
          'barge_in',
          'page_close',
          'feedback_chip_clicked',
          -- Existing remote aiASAP event types observed read-only on 2026-05-29
          'account_start_email_sent',
          'account_verify_success',
          'browser_error',
          'browser_unhandled_rejection',
          'codex_post_deploy_timing_smoke',
          'codex_schema_smoke',
          'elevenlabs_post_intro_start_requested',
          'elevenlabs_primary_state',
          'family_invite_invalid',
          'initial_voice_autostart',
          'liveavatar_session_stopped_ignored',
          'liveavatar_session_token_created',
          'liveavatar_transcript_synced',
          'liveavatar_visual_start_timeout',
          'performance_navigation',
          'startup_android_external_chrome_blank_open_attempted',
          'startup_android_external_chrome_handoff_requested',
          'startup_android_external_chrome_link_clicked',
          'startup_begin',
          'startup_manual_probe',
          'startup_manual_probe_after_loopback_patch',
          'startup_mic_permission_denied',
          'startup_mic_permission_granted',
          'startup_mic_permission_preblocked',
          'startup_mic_permission_request',
          'startup_native_mic_permission_avatar_start_fallback',
          'startup_native_mic_permission_blocked_start_aborted',
          'startup_native_mic_permission_failed',
          'startup_native_mic_permission_fallback_session',
          'startup_native_mic_permission_granted',
          'startup_native_mic_permission_hold',
          'startup_native_mic_permission_native_app_handoff',
          'startup_native_mic_permission_provider_deferred',
          'startup_native_mic_permission_requested',
          'startup_native_mic_permission_skipped',
          'startup_preview_smoke_after_spinner_fix',
          'startup_preview_smoke_intro_fix_20260513',
          'startup_preview_smoke_stdin',
          'startup_provider_voice_start_dispatched',
          'startup_session_token_request',
          'startup_token_ready',
          'startup_voice_bootstrap_requested',
          'voice_start_audio_output_ready',
          'voice_start_mic_warmup_skipped',
          'voice_start_permission_blocked',
          'voice_start_permission_retryable',
          'voice_start_provider_intro',
          'voice_start_timing',
          -- Explicit escape hatches for future server-side normalized events
          'legacy',
          'other'
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_events_severity_v1_check'
      and conrelid = 'public.app_events'::regclass
  ) then
    alter table public.app_events
      add constraint app_events_severity_v1_check
      check (severity in ('debug', 'info', 'warn', 'error')) not valid;
  end if;
end
$$;

alter table public.app_events enable row level security;

drop policy if exists "app_events: owner-select" on public.app_events;
create policy "app_events: owner-select"
  on public.app_events
  for select
  to authenticated
  using (user_id = auth.uid());

-- No anon INSERT/SELECT policy: telemetry writes should flow through the
-- server-side service-role route, which bypasses RLS. Revoke direct insert for
-- defense-in-depth, then grant authenticated SELECT so the owner-select policy
-- can work for future account views.
revoke insert on public.app_events from anon;
revoke insert on public.app_events from authenticated;
grant select on public.app_events to authenticated;
