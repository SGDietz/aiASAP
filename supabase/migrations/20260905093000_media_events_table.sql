-- aiASAP media_events: the table app/api/media/capture/route.ts has inserted
-- into since the route was written, and which has NEVER existed in the live
-- database (proven 2026-09-05: `relation "public.media_events" does not
-- exist`; the 20260514 migration only ALTERs it IF it exists). Every gallery
-- photo and camera frame therefore stored its file + a JSON sidecar in the
-- aiasap-media bucket and then logged "media/capture insert skipped" - the
-- storage sidecar is the only record so far. This table matches that sidecar
-- one to one, so the route needs no change.
--
-- LOCAL PREPARATION ONLY. Do not apply remotely without G's separate,
-- explicit production Supabase migration authorization.

begin;

create table if not exists public.media_events (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  source text not null check (source in (
    'gallery_image', 'gallery_video', 'camera_snapshot', 'go_live_frame',
    'video_recording'
  )),
  storage_path text not null,
  metadata_path text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  gemini_analysis text,
  problem_at_time text,
  error text,
  tester_label text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_media_events_session_time
  on public.media_events (session_id, created_at);
create index if not exists idx_media_events_created_at
  on public.media_events (created_at);
create index if not exists idx_media_events_user_id
  on public.media_events (user_id);

-- Service-role writes only (the route uses the service key). No anon or
-- authenticated policy: a visitor's photo analysis is never readable from
-- the browser through this table.
alter table public.media_events enable row level security;
revoke all on public.media_events from anon, authenticated;

comment on table public.media_events is
  'One row per visitor photo/video/frame captured by /api/media/capture. Mirrors the JSON sidecar stored beside the file in the aiasap-media bucket.';

commit;
