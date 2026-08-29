-- Never Forget reminders (2026-06-10): the original reminders.user_id FK points
-- at public.ai_users, a legacy table nothing populates (0 rows). Real identity
-- lives in auth.users. ADDITIVE ONLY (schema append-only doctrine): a parallel
-- auth_user_id column the app + delivery cron use; the old column stays.
alter table public.reminders
  add column if not exists auth_user_id uuid;

create index if not exists idx_reminders_auth_user_due
  on public.reminders (auth_user_id, status, due_at);

-- Delivery log lives in public.notifications_sent (already live).
