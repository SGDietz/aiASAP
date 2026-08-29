-- 20260821215900 — Reconcile the legacy repo bug_reports contract with the
-- verified live/current route contract. Additive and data-preserving. This
-- migration intentionally sorts before the 22:00 hardening batch because the
-- hot-reloaded bug-report route already writes these canonical columns.

begin;

alter table public.bug_reports
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists summary text,
  add column if not exists trigger_text text,
  add column if not exists report text,
  add column if not exists page_url text,
  add column if not exists active_list jsonb,
  add column if not exists list_snapshot jsonb,
  add column if not exists device jsonb,
  add column if not exists emailed boolean not null default false,
  add column if not exists email_error text,
  add column if not exists recipient_title text not null default 'Creator/Builder/Founder/Financier/CEO aiASAP',
  add column if not exists email_to text,
  add column if not exists source text not null default 'six_voice',
  add column if not exists status text not null default 'new',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- The active route stores a transcript array. Convert the legacy text baseline
-- without discarding its content; JSON/JSONB live columns remain JSONB.
do $$
declare
  transcript_type text;
begin
  select data_type
    into transcript_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'bug_reports'
    and column_name = 'transcript';

  if transcript_type is null then
    alter table public.bug_reports add column transcript jsonb;
  elsif transcript_type = 'text' then
    alter table public.bug_reports
      alter column transcript type jsonb
      using case when transcript is null then null else to_jsonb(transcript) end;
  elsif transcript_type = 'json' then
    alter table public.bug_reports
      alter column transcript type jsonb using transcript::jsonb;
  elsif transcript_type <> 'jsonb' then
    raise exception 'Unsupported bug_reports.transcript type: %', transcript_type;
  end if;
end
$$;

alter table public.bug_reports alter column summary drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bug_reports'::regclass
      and conname = 'bug_reports_status_check'
  ) then
    alter table public.bug_reports
      add constraint bug_reports_status_check
      check (status in ('new', 'triaged', 'fixed', 'closed')) not valid;
  end if;
end
$$;

alter table public.bug_reports
  validate constraint bug_reports_status_check;

update public.bug_reports
set
  summary = coalesce(summary, trigger_text, left(report, 1000)),
  trigger_text = coalesce(trigger_text, summary, left(report, 1000)),
  report = coalesce(report, summary, trigger_text),
  active_list = coalesce(active_list, list_snapshot),
  list_snapshot = coalesce(list_snapshot, active_list)
where summary is null
   or trigger_text is null
   or report is null
   or active_list is null
   or list_snapshot is null;

create or replace function public.sync_bug_report_aliases()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.summary := coalesce(new.summary, new.trigger_text, left(new.report, 1000));
  new.trigger_text := coalesce(new.trigger_text, new.summary);
  new.report := coalesce(new.report, new.summary);
  new.active_list := coalesce(new.active_list, new.list_snapshot);
  new.list_snapshot := coalesce(new.list_snapshot, new.active_list);
  return new;
end
$$;

drop trigger if exists bug_reports_sync_aliases on public.bug_reports;
create trigger bug_reports_sync_aliases
  before insert or update on public.bug_reports
  for each row execute function public.sync_bug_report_aliases();

drop trigger if exists bug_reports_touch_updated_at on public.bug_reports;
create trigger bug_reports_touch_updated_at
  before update on public.bug_reports
  for each row execute function public.touch_updated_at();

create index if not exists idx_bug_reports_user_id
  on public.bug_reports (user_id) where user_id is not null;
create index if not exists idx_bug_reports_created_at
  on public.bug_reports (created_at desc);

commit;
