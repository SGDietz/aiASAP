# aiASAP lead system activation gates

This pass prepares code and schema only. It does not authorize or perform a production migration, provider send, Telegram send, deployment, or historical-row rewrite.

Before activation:

1. Review and apply `supabase/migrations/20260903092000_lead_follow_up_reliability.sql`, then `20260903211000_lead_operational_readiness.sql`, in an isolated/test database first.
2. Verify `opportunity_notification_outbox`, `notification_delivery_attempts`, and `lead_consent_events` are service-role only and have no `anon` or `authenticated` policies.
3. Verify `media_events` stores signing timestamps/version and expiry only—never signed URLs or tokens.
4. Configure the existing aiASAP alert bot variables; do not create or cross-wire another company bot. Keep `TELEGRAM_ALERTS_ENABLED=false` until a separately authorized activation smoke.
5. Use fake Resend/Telegram transports to prove owner and visitor idempotency, retry, partial retirement, cluster-alert thresholding, and PII redaction.
6. After separately authorized deployment, run one labeled non-customer smoke. Provider acceptance, inbox arrival, and physical-device behavior are separate acceptance facts.

Current local implementation deliberately remains compatible while these migrations are unapplied. Production Supabase and existing historical rows were not changed.
