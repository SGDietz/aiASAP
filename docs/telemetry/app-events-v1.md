# App events telemetry v1

Status: local plan/migration only. Do not apply to remote Supabase until G approves the exact SQL.

## Why this shape

aiASAP needs product telemetry that can answer what testers actually did without storing sensitive prompt bodies or overfitting the DB around one UI experiment. The v1 direction is one append-only `public.app_events` table rather than separate `visitor_sessions`, `visitor_devices`, `visitor_actions`, `feedback_events`, and `preference_candidates` write paths.

The remote DB currently exposes older telemetry tables, including `app_events` and visitor/feedback/preference tables, but the current source-of-truth repo does not have an app-events writer endpoint. This plan treats v1 as a consolidation/upgrade, not a restoration of a prior five-table design.

## Source-of-truth repo facts Herm inspected

- Repo: `C:/Users/sgdie/Documents/Claude/projects/ai-asap-may06-prod`
- Linked Supabase project: `aiASAP` / `wqszxsqzkaatghyrqviv`
- Remote already has 2,473 `app_events` rows across observed event types; Herm saved a read-only event-type count at `.hermes-supabase-readonly/app-events-event-types-full-20260529.json`.
- Remote already has `app_events`, `visitor_sessions`, `visitor_devices`, `visitor_actions`, `feedback_events`, and `preference_candidates`.
- Existing local migration pending remotely: `20260525_add_tester_label.sql`
- Remote-only migrations seen via `supabase migration list`: `20260515`, `20260516`
- No local `app/api/app-events/log/route.ts` found at prep time.
- Reusable helpers present:
  - `src/lib/testerAttribution.ts`
  - `src/lib/supabaseAdmin.ts`
  - `src/lib/apiRouteSecurity.ts`
  - `src/lib/rateLimit.ts`

## Table contract

`public.app_events` is append-only product telemetry.

Core columns:

- `id uuid primary key default gen_random_uuid()`
- `event_type text not null`
- `surface text not null default 'aiasap'`
- `session_id text`
- `visitor_id text` canonical visitor id for new writes
- `anonymous_visitor_id text` retained for compatibility with older telemetry shape; readers should use `coalesce(visitor_id, anonymous_visitor_id)` during transition
- `user_id uuid references auth.users(id) on delete set null`
- `tester_label text`
- `route text`
- `referrer text`
- `provider text` retained for compatibility
- `severity text not null default 'info'` retained for compatibility
- `status_code integer` retained for compatibility
- `user_visible_state text` retained for compatibility
- `client_timestamp timestamptz`
- `server_timestamp timestamptz not null default now()`
- `created_at timestamptz not null default now()` retained for compatibility
- `payload jsonb not null default '{}'::jsonb`
- `client_meta jsonb not null default '{}'::jsonb`

## Event type allowlist v1

- `page_view`
- `card_shown`
- `card_clicked`
- `mic_started`
- `mic_stopped`
- `transcript_partial`
- `transcript_final`
- `six_response_start`
- `six_response_end`
- `silence_timeout`
- `interruption`
- `barge_in`
- `page_close`
- `feedback_chip_clicked`

Hard copy rule: UI labels and telemetry labels should use digit `6`, never the word `Six`.

## Existing remote event types observed read-only

Remote `app_events` already contained 2,473 rows when inspected on 2026-05-29. The migration allowlist includes the v1 taxonomy plus these existing values so the new check does not unexpectedly block continuation of known current events:

- `account_start_email_sent`
- `account_verify_success`
- `browser_error`
- `browser_unhandled_rejection`
- `codex_post_deploy_timing_smoke`
- `codex_schema_smoke`
- `elevenlabs_post_intro_start_requested`
- `elevenlabs_primary_state`
- `family_invite_invalid`
- `initial_voice_autostart`
- `liveavatar_session_stopped_ignored`
- `liveavatar_session_token_created`
- `liveavatar_transcript_synced`
- `liveavatar_visual_start_timeout`
- `performance_navigation`
- `startup_android_external_chrome_blank_open_attempted`
- `startup_android_external_chrome_handoff_requested`
- `startup_android_external_chrome_link_clicked`
- `startup_begin`
- `startup_manual_probe`
- `startup_manual_probe_after_loopback_patch`
- `startup_mic_permission_denied`
- `startup_mic_permission_granted`
- `startup_mic_permission_preblocked`
- `startup_mic_permission_request`
- `startup_native_mic_permission_avatar_start_fallback`
- `startup_native_mic_permission_blocked_start_aborted`
- `startup_native_mic_permission_failed`
- `startup_native_mic_permission_fallback_session`
- `startup_native_mic_permission_granted`
- `startup_native_mic_permission_hold`
- `startup_native_mic_permission_native_app_handoff`
- `startup_native_mic_permission_provider_deferred`
- `startup_native_mic_permission_requested`
- `startup_native_mic_permission_skipped`
- `startup_preview_smoke_after_spinner_fix`
- `startup_preview_smoke_intro_fix_20260513`
- `startup_preview_smoke_stdin`
- `startup_provider_voice_start_dispatched`
- `startup_session_token_request`
- `startup_token_ready`
- `startup_voice_bootstrap_requested`
- `voice_start_audio_output_ready`
- `voice_start_mic_warmup_skipped`
- `voice_start_permission_blocked`
- `voice_start_permission_retryable`
- `voice_start_provider_intro`
- `voice_start_timing`
- `legacy`
- `other`

## Payload guidance

Do store:

- small event-specific metadata
- card ids/slugs
- elapsed milliseconds
- boolean flags
- normalized feedback chip ids
- short route/surface/tester/visitor/session identifiers

Do not store by default:

- raw full transcripts
- sensitive prompt bodies
- full user messages
- contact details unless they are already part of the consented lead-capture flow

## Writer endpoint contract recommendation

Recommended route: `app/api/app-events/log/route.ts`

Server-side behavior:

1. `POST` only.
2. `assertAllowedOrigin(request)` in production.
3. `checkRateLimit(request)` before Supabase write.
4. Normalize/sanitize incoming body:
   - event_type must be in allowlist.
   - session_id text only; LiveAvatar session ids are not UUIDs.
   - tester_label via `normalizeTesterLabel`.
   - payload/client_meta bounded in size.
   - transcript fields truncated or omitted.
5. Insert via `getSupabaseAdminConfig()` and service-role REST call to `/rest/v1/app_events` with `Prefer: return=minimal`.
6. Never throw telemetry write failures into the user path; return a minimal success/failure response or fail closed depending on route policy.

## RLS / access model

- `alter table public.app_events enable row level security`
- Authenticated users may select only their own rows: `user_id = auth.uid()`.
- No anon `SELECT` policy.
- No anon `INSERT` policy for v1; writes go through the service-role route.
- Migration revokes direct `INSERT` on `public.app_events` from `anon` and `authenticated` for defense-in-depth.
- Service role bypasses RLS for server-side inserts.

## Indexes

- `session_id`
- `(visitor_id, server_timestamp desc)` where visitor_id is present
- `(anonymous_visitor_id, server_timestamp desc)` where anonymous_visitor_id is present
- `event_type`
- `tester_label` where tester_label is present
- `server_timestamp desc`

## Coordination notes

- This migration intentionally does not touch existing working tables such as `conversation_messages`, `lead_sessions`, `transcript_events`, or `contact_entities`.
- It does not apply the local `20260525_add_tester_label.sql`; that remains a separate pending migration decision.
- The SQL uses additive `if not exists` guards because remote aiASAP already exposes an older `app_events` table.
- Before any push, pull/reconcile remote-only migrations `20260515` and `20260516` or otherwise confirm their contents, because local history currently does not include them.
- Consider applying/reviewing `20260525_add_tester_label.sql` first as a separate tiny migration, because code already threads tester labels while remote core tables did not expose those columns during read-only inspection.
- The migration includes a one-time additive backfill from `anonymous_visitor_id` to `visitor_id`; this is a data update and must be part of G's exact SQL approval.
- A schema-only migration will not create telemetry rows. The writer endpoint must land before telemetry counts move.
- Do not conflate this telemetry lane with ElevenLabs / LiveAvatar turn-taking fixes. Telemetry helps measure those fixes later.
