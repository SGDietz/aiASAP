-- BUILD PAYMENTS - the three one-time payments that make up a $5,000 build.
--
-- Replaces the stripe_customers table the old subscription webhook wrote to.
-- That table was never created in this repo: no migration ever defined it, so
-- every write would have failed. It never ran, so it never hurt anybody.
--
-- aiASAP sells one build for $5,000, collected as deposit ($2,000, non-
-- refundable), second ($2,000) and final ($1,000). There is no subscription
-- and there is no self-serve checkout - Scott mints each payment link himself
-- after talking to the person.

create table if not exists public.build_payments (
  id                uuid primary key default gen_random_uuid(),

  -- Stripe retries webhooks. This is the idempotency anchor: the same event
  -- delivered five times must leave exactly one row.
  stripe_event_id   text not null unique,

  stripe_session_id text,
  payment_intent_id text,

  milestone         text not null
                      check (milestone in ('deposit', 'second', 'final', 'unknown')),
  amount_cents      integer,
  currency          text not null default 'usd',

  email             text,
  customer_name     text,
  -- Links the payment to an aiASAP account when we know which one. Deliberately
  -- NOT a foreign key: a payment must be recorded even if the account is gone.
  user_id           text,

  paid_at           timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists build_payments_email_idx
  on public.build_payments (lower(email));
create index if not exists build_payments_paid_at_idx
  on public.build_payments (paid_at desc);

-- RLS ON. This table holds what somebody paid and the email they paid with.
-- No policy is created on purpose, so nothing reachable from the browser can
-- read it - only the service role, which bypasses RLS, and that is exactly the
-- webhook and nothing else.
alter table public.build_payments enable row level security;

comment on table public.build_payments is
  'One row per completed Stripe payment toward a $5,000 build. Written only by /api/stripe/webhook using the service role. RLS on with no policies: service role only, never the browser.';
