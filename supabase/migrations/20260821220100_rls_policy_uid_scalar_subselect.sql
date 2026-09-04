-- 20260821220100 — Cache auth.uid() once per statement in the 9 verified hot
-- policies. Roles, actions, USING clauses, and WITH CHECK semantics are kept.

begin;

drop policy if exists "users: self-select" on public.users;
create policy "users: self-select"
  on public.users for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "users: self-update" on public.users;
create policy "users: self-update"
  on public.users for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "transcript_events: owner-select" on public.transcript_events;
create policy "transcript_events: owner-select"
  on public.transcript_events for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "conversation_messages: owner-select" on public.conversation_messages;
create policy "conversation_messages: owner-select"
  on public.conversation_messages for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "lead_sessions: owner-select" on public.lead_sessions;
create policy "lead_sessions: owner-select"
  on public.lead_sessions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "contact_entities: owner-select" on public.contact_entities;
create policy "contact_entities: owner-select"
  on public.contact_entities for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_memory_facts: owner-select" on public.user_memory_facts;
create policy "user_memory_facts: owner-select"
  on public.user_memory_facts for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_memory_facts: owner-delete" on public.user_memory_facts;
create policy "user_memory_facts: owner-delete"
  on public.user_memory_facts for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "app_events: owner-select" on public.app_events;
create policy "app_events: owner-select"
  on public.app_events for select to authenticated
  using (user_id = (select auth.uid()));

commit;
