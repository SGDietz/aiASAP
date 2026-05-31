-- 20260525_add_tester_label.sql
--
-- Adds a `tester_label text` column to active write-path tables so tester
-- sessions launched via clean tester links (e.g. https://aiasap.ai/?tester=john-tn)
-- are distinguishable in the data.
--
-- All ALTERs and CREATE INDEXes use existence guards so this migration is safe
-- to run against remote projects where older optional tables may not exist yet.

DO $$
BEGIN
  IF to_regclass('public.conversation_messages') IS NOT NULL THEN
    ALTER TABLE public.conversation_messages
      ADD COLUMN IF NOT EXISTS tester_label text;
    CREATE INDEX IF NOT EXISTS idx_conversation_messages_tester_label
      ON public.conversation_messages (tester_label)
      WHERE tester_label IS NOT NULL;
  END IF;

  IF to_regclass('public.lead_sessions') IS NOT NULL THEN
    ALTER TABLE public.lead_sessions
      ADD COLUMN IF NOT EXISTS tester_label text;
    CREATE INDEX IF NOT EXISTS idx_lead_sessions_tester_label
      ON public.lead_sessions (tester_label)
      WHERE tester_label IS NOT NULL;
  END IF;

  IF to_regclass('public.transcript_events') IS NOT NULL THEN
    ALTER TABLE public.transcript_events
      ADD COLUMN IF NOT EXISTS tester_label text;
    CREATE INDEX IF NOT EXISTS idx_transcript_events_tester_label
      ON public.transcript_events (tester_label)
      WHERE tester_label IS NOT NULL;
  END IF;

  IF to_regclass('public.contact_entities') IS NOT NULL THEN
    ALTER TABLE public.contact_entities
      ADD COLUMN IF NOT EXISTS tester_label text;
    CREATE INDEX IF NOT EXISTS idx_contact_entities_tester_label
      ON public.contact_entities (tester_label)
      WHERE tester_label IS NOT NULL;
  END IF;

  IF to_regclass('public.media_events') IS NOT NULL THEN
    ALTER TABLE public.media_events
      ADD COLUMN IF NOT EXISTS tester_label text;
    CREATE INDEX IF NOT EXISTS idx_media_events_tester_label
      ON public.media_events (tester_label)
      WHERE tester_label IS NOT NULL;
  END IF;
END
$$;
