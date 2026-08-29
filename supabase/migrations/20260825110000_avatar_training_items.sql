-- LOCAL AUTHORING ONLY: do not apply remotely without an approved migration run.
create table if not exists public.avatar_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  training_enabled boolean not null default false,
  client_schedule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists avatar_profiles_owner_created on public.avatar_profiles(owner_user_id, created_at desc);
alter table public.avatar_profiles enable row level security;
create policy "avatar profile owner only" on public.avatar_profiles for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

create table if not exists public.avatar_training_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  avatar_profile_id uuid not null references public.avatar_profiles(id) on delete cascade,
  kind text not null check (kind in ('preference','fact','sales_language','business_context')),
  content text not null check (char_length(content) between 3 and 1200),
  enabled boolean not null default true,
  source text not null default 'owner_training_conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists avatar_training_items_owner_created on public.avatar_training_items(owner_user_id, created_at desc);
create index if not exists avatar_training_items_profile_created on public.avatar_training_items(avatar_profile_id, created_at desc);
alter table public.avatar_training_items enable row level security;
create policy "avatar training owner only" on public.avatar_training_items for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
