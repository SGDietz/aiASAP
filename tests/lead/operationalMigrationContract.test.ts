import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260903211000_lead_operational_readiness.sql"), "utf8");

describe("aiASAP lead operational migration (unapplied)", () => {
  it("keeps consent chronology event-scoped and delivery attempts append-only", () => {
    expect(sql).toContain("lead_consent_events");
    expect(sql).toContain("contact_readback_confirmed");
    expect(sql).toContain("follow_up_authorized");
    expect(sql).toContain("notification_delivery_attempts");
    expect(sql).toContain("opportunity_notification_transition_audit");
    expect(sql).toContain("capture_lead_consent_from_outbox");
    expect(sql).toContain("new.event_kind <> 'follow_up_requested'");
    expect(sql).toContain("readback_at > authorized_at");
  });

  it("records secure-link provenance without storing a signed URL", () => {
    expect(sql).toContain("last_signed_at");
    expect(sql).toContain("signed_link_expires_at");
    expect(sql).toContain("signer_version");
    expect(sql).not.toMatch(/signed_url|storage_url|access_token/i);
  });

  it("is service-role only and explicitly local preparation", () => {
    expect(sql).toContain("LOCAL PREPARATION ONLY");
    expect(sql).toContain("revoke all on public.lead_consent_events from anon, authenticated");
    expect(sql).toContain("grant all on public.notification_delivery_attempts to service_role");
  });
});
