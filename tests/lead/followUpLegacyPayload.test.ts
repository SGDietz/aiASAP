/**
 * Regression: the founder follow-up transport must render historical/legacy
 * outbox payloads and mock-shaped payloads without dereferencing undefined
 * fields (transcriptEvidenceRef, sessionReviewRef, ownerMediaLinks entries).
 *
 * A payload queued before the media-link/topic fields shipped, or a test/mock
 * payload that only carries the durable core fields, must still deliver
 * successfully — never crash the transport, never surface malformed hrefs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryFollowUpOutbox,
  createResendFollowUpTransport,
  drainFollowUpRow,
  FOLLOW_UP_KIND,
  followUpDedupeKey,
  type FollowUpPayload,
} from "../../src/lib/leadFollowUpNotify";
import type { MediaLink } from "../../src/lib/emails/leadMediaManifest";

type SendPurposeEmailArgs = {
  purpose: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
  replyTo?: string;
};

const sendPurposeEmailMock = vi.fn(
  async (_args: SendPurposeEmailArgs) => ({ ok: true, error: null, id: "re_regression_1" }),
);

vi.mock("../../src/lib/emailSenders", () => ({
  sendPurposeEmail: (args: SendPurposeEmailArgs) => sendPurposeEmailMock(args),
}));

const baseLegacy: FollowUpPayload = {
  sessionReviewRef: "/admin/sessions/legacy-1",
  contactMethod: "email",
  contactValue: "legacy@example.invalid",
  fullName: "Legacy Visitor",
  sessionId: "legacy-1",
  // transcriptEvidenceRef intentionally missing — historical rows lack it.
  // sanitizedTopic / projectSummary / projectDetails / sanitizedName absent.
  // ownerMediaLinks / mediaSigningFailed absent.
};

function lastCall(): SendPurposeEmailArgs {
  const calls = sendPurposeEmailMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
}

describe("createResendFollowUpTransport legacy payload tolerance", () => {
  beforeEach(() => {
    sendPurposeEmailMock.mockClear();
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("AIASAP_FOUNDER_REPORT_EMAIL", "founder@example.invalid");
    vi.stubEnv("TEAM_EMAILS_ENABLED", "true");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("delivers a legacy payload that predates transcriptEvidenceRef / media fields", async () => {
    const transport = createResendFollowUpTransport();
    const res = await transport.send({
      dedupeKey: "follow_up_requested:legacy-1",
      idempotencyKey: "team:follow_up_requested:legacy-1",
      payload: { ...baseLegacy },
    });
    expect(res).toEqual({ providerId: "re_regression_1" });
    expect(sendPurposeEmailMock).toHaveBeenCalledTimes(1);
    const call = lastCall();
    expect(call.to).toBe("founder@example.invalid");
    // Falls back to sessionReviewRef for the conversation link — no undefined
    // interpolation and no crash inside absoluteInternal.
    expect(call.text).not.toContain("undefined");
    expect(call.html ?? "").not.toContain("undefined");
    expect(call.text).toContain("legacy-1");
  });

  it("tolerates a payload with sessionReviewRef ALSO missing (nothing thrown)", async () => {
    const transport = createResendFollowUpTransport();
    const stripped: FollowUpPayload = { ...baseLegacy };
    delete (stripped as Partial<FollowUpPayload>).sessionReviewRef;
    await expect(transport.send({
      dedupeKey: "follow_up_requested:legacy-2",
      idempotencyKey: "team:follow_up_requested:legacy-2",
      payload: stripped,
    })).resolves.toEqual({ providerId: "re_regression_1" });
    const call = lastCall();
    expect(call.text).not.toContain("undefined");
    expect(call.html ?? "").not.toContain("undefined");
  });

  it("skips malformed media link entries without exposing raw storage paths", async () => {
    const transport = createResendFollowUpTransport();
    const badLinks: MediaLink[] = [
      // missing href
      { label: "Camera photo", mime: "image/jpeg", sizeBytes: 1234, expiresAt: "2026-09-10T00:00:00.000Z" } as unknown as MediaLink,
      // non-http href (e.g. raw storage path)
      { label: "Camera photo", href: "storage/private/abc.jpg", mime: "image/jpeg", sizeBytes: 1234, expiresAt: "2026-09-10T00:00:00.000Z" },
      // empty label
      { label: "", href: "https://signed.example/x", mime: "image/jpeg", sizeBytes: 1234, expiresAt: "2026-09-10T00:00:00.000Z" },
      // valid — must survive
      { label: "Camera photo", href: "https://signed.example/ok", mime: "image/jpeg", sizeBytes: 1234, expiresAt: "2026-09-10T00:00:00.000Z" },
    ];
    const res = await transport.send({
      dedupeKey: "follow_up_requested:media-1",
      idempotencyKey: "team:follow_up_requested:media-1",
      payload: {
        ...baseLegacy,
        transcriptEvidenceRef: "/admin/sessions/media-1",
        ownerMediaLinks: badLinks,
      },
    });
    expect(res).toEqual({ providerId: "re_regression_1" });
    const call = lastCall();
    // Raw storage path must NEVER appear in the email body/html.
    expect(call.text).not.toContain("storage/private/abc.jpg");
    expect(call.html ?? "").not.toContain("storage/private/abc.jpg");
    // Exactly ONE upload entry rendered — the one valid link.
    expect(call.text).toContain("https://signed.example/ok");
    expect(call.text).toContain("1 file — button below, links good for 7 days");
    expect(call.text).toContain("Open file 1: https://signed.example/ok");
  });

  it("drains a legacy queued outbox row end-to-end without crashes or undefined", async () => {
    // Simulates a historical row inserted before the media / topic / evidence
    // fields shipped. Exercises the FULL drain — insertIgnoreDuplicate →
    // claim → transport.send → markSent — and re-drains to prove the lease /
    // idempotency transitions still fire correctly on a sparse payload.
    const store = createMemoryFollowUpOutbox();
    const transport = createResendFollowUpTransport();
    const opportunityId = "legacy-op-1";
    const method: "email" = "email";
    const value = "legacy@example.invalid";
    const dedupeKey = followUpDedupeKey(opportunityId, method, value);
    const legacyPayload: FollowUpPayload = {
      // No transcriptEvidenceRef, no topic/summary/details/name, no media
      // fields. Only the durable core fields a pre-migration row carried.
      opportunityId,
      sessionReviewRef: "/admin/sessions/legacy-op-1",
      contactMethod: method,
      contactValue: value,
      fullName: null,
      sessionId: "legacy-op-1",
    };
    await store.insertIgnoreDuplicate({
      opportunityId,
      eventKind: FOLLOW_UP_KIND,
      dedupeKey,
      payload: legacyPayload,
    });
    const first = await drainFollowUpRow(store, transport, dedupeKey, new Date("2026-09-03T21:20:00.000Z"));
    expect(first.status).toBe("sent");
    expect(first.providerId).toBe("re_regression_1");
    expect(first.duplicate).toBe(false);
    const stored = await store.getByDedupe(dedupeKey);
    expect(stored?.status).toBe("sent");
    expect(stored?.providerId).toBe("re_regression_1");
    expect(stored?.leaseToken).toBeNull();
    expect(stored?.leaseExpiresAt).toBeNull();
    const call = lastCall();
    expect(call.text).not.toContain("undefined");
    expect(call.html ?? "").not.toContain("undefined");
    // Idempotent re-drain of a `sent` row returns duplicate=true and does NOT
    // re-invoke the transport.
    sendPurposeEmailMock.mockClear();
    const second = await drainFollowUpRow(store, transport, dedupeKey, new Date("2026-09-03T21:25:00.000Z"));
    expect(second.status).toBe("sent");
    expect(second.duplicate).toBe(true);
    expect(second.providerId).toBe("re_regression_1");
    expect(sendPurposeEmailMock).not.toHaveBeenCalled();
  });

  it("drains a legacy row whose ownerMediaLinks carry malformed entries without leaking raw storage paths", async () => {
    const store = createMemoryFollowUpOutbox();
    const transport = createResendFollowUpTransport();
    const opportunityId = "legacy-op-2";
    const method: "phone" = "phone";
    const value = "410-555-0000";
    const dedupeKey = followUpDedupeKey(opportunityId, method, value);
    await store.insertIgnoreDuplicate({
      opportunityId,
      eventKind: FOLLOW_UP_KIND,
      dedupeKey,
      payload: {
        opportunityId,
        sessionReviewRef: "/admin/sessions/legacy-op-2",
        contactMethod: method,
        contactValue: value,
        fullName: null,
        sessionId: "legacy-op-2",
        // transcriptEvidenceRef intentionally missing.
        ownerMediaLinks: [
          // missing href
          { label: "Camera photo", mime: "image/jpeg", sizeBytes: 100, expiresAt: "2026-09-10T00:00:00.000Z" } as unknown as MediaLink,
          // non-http href (raw storage path)
          { label: "Camera photo", href: "storage/private/leak.jpg", mime: "image/jpeg", sizeBytes: 100, expiresAt: "2026-09-10T00:00:00.000Z" },
          // one valid link
          { label: "Camera photo", href: "https://signed.example/ok", mime: "image/jpeg", sizeBytes: 100, expiresAt: "2026-09-10T00:00:00.000Z" },
        ],
      },
    });
    const drain = await drainFollowUpRow(store, transport, dedupeKey, new Date("2026-09-03T21:30:00.000Z"));
    expect(drain.status).toBe("sent");
    const stored = await store.getByDedupe(dedupeKey);
    expect(stored?.status).toBe("sent");
    const call = lastCall();
    expect(call.text).not.toContain("undefined");
    expect(call.text).not.toContain("storage/private/leak.jpg");
    expect(call.html ?? "").not.toContain("storage/private/leak.jpg");
    expect(call.text).toContain("https://signed.example/ok");
    expect(call.text).toContain("1 file — button below, links good for 7 days");
    expect(call.text).toContain("Open file 1: https://signed.example/ok");
  });

  it("degrades to a safe review reference when signing failed and no links remain", async () => {
    const transport = createResendFollowUpTransport();
    const res = await transport.send({
      dedupeKey: "follow_up_requested:sign-fail-1",
      idempotencyKey: "team:follow_up_requested:sign-fail-1",
      payload: {
        ...baseLegacy,
        // transcriptEvidenceRef missing — must fall back to sessionReviewRef,
        // not to `undefined`.
        ownerMediaLinks: [],
        mediaSigningFailed: true,
      },
    });
    expect(res).toEqual({ providerId: "re_regression_1" });
    const call = lastCall();
    expect(call.text).toContain("Media was received but signed links could not be generated");
    expect(call.text).not.toContain("undefined");
    expect(call.html ?? "").not.toContain("undefined");
  });
});
