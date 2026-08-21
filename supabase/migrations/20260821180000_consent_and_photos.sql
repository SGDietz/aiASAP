-- ============================================================================
-- PROPOSED — NOT APPLIED. Needs G's explicit yes before it runs anywhere.
--
-- The file extension is deliberately `.sql.PROPOSED` so no migration runner
-- picks it up by accident. Rename to `202608210001_consent_and_photos.sql`
-- only when G has approved it.
--
-- Covers the two pieces of Ara's Job 10 + Job 11 that could NOT be installed
-- today, because both need schema and one needs a storage bucket:
--   1. voice_consents — proof that somebody said yes to being recorded.
--   2. account_photos — where brand photos live once there is an upload path.
--
-- Everything else from those two packets is already installed: 6's spoken
-- record notice, his photo lines, and the plain-English terms section.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. voice_consents
--
-- Ara's point, and it is right: a spoken "yes" is only worth something if we
-- can show it later. Today 6 asks and nothing is written down, so the consent
-- exists only in a transcript nobody reads line by line.
--
-- notice_version matters. When the wording of the spoken notice changes, what
-- somebody agreed to changes with it, and "they consented" is meaningless
-- unless we know WHICH notice they heard.
-- ----------------------------------------------------------------------------
create table if not exists public.voice_consents (
  id            uuid primary key default gen_random_uuid(),
  account_email text        not null,
  session_id    text,
  utterance_id  text,
  -- The exact notice they heard, e.g. 'voice-notice-v1'.
  notice_version text       not null,
  -- true = they agreed. false = they declined. Both are worth keeping: a
  -- recorded "no" is what stops us publishing them by mistake later.
  granted       boolean     not null,
  -- Their actual words, so a later dispute is settled by what they said and
  -- not by our summary of it.
  spoken_text   text,
  said_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists voice_consents_email_idx
  on public.voice_consents (account_email, said_at desc);

-- Service-role only, same posture as account_email_links. RLS on with no
-- policies means nothing reaches this table except our server.
alter table public.voice_consents enable row level security;

comment on table public.voice_consents is
  'Proof that a user heard the spoken record notice and answered. One row per answer, never updated in place — a later change of mind is a NEW row, so the history stays intact.';


-- ----------------------------------------------------------------------------
-- 2. account_photos
--
-- Ara''s design: QR on the laptop -> upload page on the phone, because the
-- pictures are on the phone and the person is talking to 6 on a laptop.
-- consent_public is separate from the record notice on purpose — agreeing to
-- be transcribed is NOT agreeing to have your face on a public page.
-- ----------------------------------------------------------------------------
create table if not exists public.account_photos (
  id             uuid primary key default gen_random_uuid(),
  account_email  text        not null,
  storage_path   text        not null unique,
  -- 'qr-upload' | 'email-link' | 'manual' — how it reached us.
  source         text        not null default 'qr-upload',
  content_type   text,
  bytes          bigint,
  -- Defaults FALSE. A photo is private to the build until somebody says yes.
  consent_public boolean     not null default false,
  consent_at     timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists account_photos_email_idx
  on public.account_photos (account_email, created_at desc);

alter table public.account_photos enable row level security;

comment on table public.account_photos is
  'Brand photos a user sent from their phone. consent_public defaults false — nothing is publishable until they say yes out loud and that yes is recorded in voice_consents.';


-- ----------------------------------------------------------------------------
-- 3. The storage bucket — NOT created here.
--
-- Run this by hand in the Supabase dashboard, or via the CLI, only after G
-- approves:
--
--   bucket id:  brand-photos
--   public:     NO. Private. Serve through signed URLs only.
--   limits:     10 MB per file; allowed types image/jpeg, image/png,
--               image/webp, image/heic
--
-- A public bucket would put every uploaded photo on the open internet the
-- moment it landed, before anybody consented to publishing it. That is the
-- exact failure this whole migration exists to prevent, so the bucket must be
-- private and this comment is here so nobody "fixes" it later.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- ROLLBACK
--   drop table if exists public.account_photos;
--   drop table if exists public.voice_consents;
-- Do NOT drop these once real consents are recorded — a dropped consent table
-- destroys the only evidence that somebody agreed. Archive first.
-- ----------------------------------------------------------------------------
