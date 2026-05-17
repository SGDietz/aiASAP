-- aiASAP Supabase schema
-- Run this in the aiASAP Supabase SQL editor, not the iSolve project.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aiasap-accounts',
  'aiasap-accounts',
  false,
  1048576,
  array['application/json']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.ai_users (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  preferred_contact_method text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_users
  add column if not exists email_verified_at timestamptz;

create unique index if not exists idx_ai_users_email
  on public.ai_users (email)
  where email is not null;

create table if not exists public.account_email_links (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  session_id text,
  token_hash text not null unique,
  captured_lists jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.account_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ai_users(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.conversation_sessions (
  session_id text primary key,
  user_id uuid references public.ai_users(id) on delete set null,
  liveavatar_session_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  source text not null default 'liveavatar'
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  role text not null check (role in ('user', 'assistant')),
  message text not null,
  la_absolute_timestamp bigint,
  source text not null default 'app',
  created_at timestamptz not null default now(),
  unique (session_id, role, la_absolute_timestamp)
);

create table if not exists public.transcript_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  transcript text not null,
  extracted_email text,
  extracted_phone text,
  extracted_name text,
  follow_up_intent text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  anonymous_visitor_id text,
  event_type text not null,
  severity text not null default 'low'
    check (severity in ('critical', 'high', 'medium', 'low')),
  provider text,
  route text,
  status_code integer,
  user_visible_state text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  anonymous_visitor_id text,
  sentiment text not null
    check (sentiment in ('negative', 'positive')),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  phrase text not null,
  route text,
  viewport text,
  active_sticky_note text,
  visible_items jsonb not null default '[]'::jsonb,
  sticky_note_index integer,
  sticky_note_count integer,
  recent_actions jsonb not null default '[]'::jsonb,
  mode text not null default 'full-liveavatar',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.preference_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  anonymous_visitor_id text,
  category text not null default 'preference',
  signal text not null,
  source_text text,
  confidence numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_entities (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  full_name text,
  email text,
  phone text,
  source_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_sessions (
  session_id text primary key,
  consent_status text not null default 'unknown'
    check (consent_status in ('unknown', 'accepted', 'declined')),
  full_name text,
  email text,
  phone text,
  last_prompted_field text,
  last_prompted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.ai_users(id) on delete set null,
  session_id text,
  category text not null default 'general',
  note text not null,
  source_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ai_users(id) on delete cascade,
  client_list_id text not null,
  title text not null,
  kind text not null default 'custom'
    check (kind in ('grocery', 'shopping', 'todo', 'custom')),
  items jsonb not null default '[]'::jsonb,
  display_style text not null default 'numbered'
    check (display_style in ('numbered', 'bulleted')),
  accent_color text not null default 'amber'
    check (accent_color in ('amber', 'blue', 'green', 'rose', 'purple', 'white')),
  created_at_client timestamptz,
  updated_at_client timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_list_id)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.ai_users(id) on delete set null,
  session_id text,
  title text not null,
  raw_text text,
  due_at timestamptz,
  timezone text,
  recurrence text,
  urgency text not null default 'normal'
    check (urgency in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'pending'
    check (status in ('pending', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.ai_users(id) on delete cascade,
  channel text not null
    check (channel in ('sms', 'email', 'phone', 'telegram', 'messenger', 'whatsapp', 'signal', 'push')),
  destination text,
  enabled boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel, destination)
);

create index if not exists idx_conversation_messages_session_id
  on public.conversation_messages (session_id);

create index if not exists idx_conversation_messages_created_at
  on public.conversation_messages (created_at desc);

create index if not exists idx_transcript_events_session_id
  on public.transcript_events (session_id);

create index if not exists idx_app_events_created_at
  on public.app_events (created_at desc);

create index if not exists idx_app_events_session_id
  on public.app_events (session_id);

create index if not exists idx_app_events_type_severity
  on public.app_events (event_type, severity);

create index if not exists idx_feedback_events_created_at
  on public.feedback_events (created_at desc);

create index if not exists idx_feedback_events_session_id
  on public.feedback_events (session_id);

create index if not exists idx_feedback_events_severity
  on public.feedback_events (severity);

create index if not exists idx_preference_candidates_created_at
  on public.preference_candidates (created_at desc);

create index if not exists idx_preference_candidates_session_id
  on public.preference_candidates (session_id);

create index if not exists idx_contact_entities_session_id
  on public.contact_entities (session_id);

create index if not exists idx_account_email_links_email
  on public.account_email_links (email);

create index if not exists idx_account_email_links_expires_at
  on public.account_email_links (expires_at desc);

create index if not exists idx_account_sessions_user_id
  on public.account_sessions (user_id);

create index if not exists idx_lead_sessions_updated_at
  on public.lead_sessions (updated_at desc);

create index if not exists idx_assistant_lists_user_updated
  on public.assistant_lists (user_id, updated_at_client desc);

create index if not exists idx_reminders_user_due
  on public.reminders (user_id, due_at);

create index if not exists idx_reminders_session_id
  on public.reminders (session_id);

alter table public.ai_users enable row level security;
alter table public.account_email_links enable row level security;
alter table public.account_sessions enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.transcript_events enable row level security;
alter table public.app_events enable row level security;
alter table public.feedback_events enable row level security;
alter table public.preference_candidates enable row level security;
alter table public.contact_entities enable row level security;
alter table public.lead_sessions enable row level security;
alter table public.memory_notes enable row level security;
alter table public.assistant_lists enable row level security;
alter table public.reminders enable row level security;
alter table public.notification_preferences enable row level security;

-- No public RLS policies yet. The app writes through server routes using SUPABASE_SERVICE_ROLE_KEY.
