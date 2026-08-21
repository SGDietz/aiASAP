-- INTERVIEW LEDGERS - what somebody has already told us about their build.
--
-- G's rule is that people brain-dump in the car, hang up mid-sentence, and
-- come back days later. The interview therefore has to survive being abandoned
-- and resumed on a different device, which means it cannot live in a browser
-- tab or in one session's history. One row per person, the whole ledger as
-- JSON.
--
-- Stored as jsonb rather than a column per slot on purpose: the nine parts and
-- their slots are still moving, and a shape change must never need a migration
-- in the middle of a live interview. src/lib/interview/ledgerStore.ts rebuilds
-- the skeleton on read, so an older row can never crash the whisper.

create table if not exists public.interview_ledgers (
  user_id    text primary key,
  ledger     jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists interview_ledgers_updated_at_idx
  on public.interview_ledgers (updated_at desc);

-- RLS ON, no policies. This holds everything a person said about their work,
-- their money and their week - the most personal data aiASAP stores. Only the
-- service role reaches it, which is the server and nothing else. Nothing
-- running in a browser can read one of these rows, including their own.
alter table public.interview_ledgers enable row level security;

comment on table public.interview_ledgers is
  'One row per person: the nine-part build interview, as JSON. Written only by the server via the service role. RLS on with no policies - never reachable from a browser.';
