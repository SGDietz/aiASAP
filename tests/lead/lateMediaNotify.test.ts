import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LATE_MEDIA_QUIET_MS,
  decideLateMediaSend,
} from "../../src/lib/lateMediaNotify";
import { mediaRowFromStorageName } from "../../src/lib/emails/leadMediaManifest";

const src = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// G, 2026-09-05: "Then I upload some pictures. Then the system needs to send me
// a follow-up email ... so when I reach out to the people, I know everything."
describe("late media -> G's inbox", () => {
  const T0 = Date.parse("2026-09-05T14:00:00Z");

  it("mails on the first file after the lead went out", () => {
    expect(decideLateMediaSend({ marker: null, count: 1, final: false, now: T0 })).toEqual({
      send: true,
      reason: "first_late_upload",
    });
  });

  it("stays quiet for ten minutes after a mail, then mails again on new files", () => {
    const marker = { lastSentAt: new Date(T0).toISOString(), count: 1 };
    expect(decideLateMediaSend({ marker, count: 2, final: false, now: T0 + 60_000 })).toEqual({
      send: false,
      reason: "quiet_window",
    });
    expect(
      decideLateMediaSend({ marker, count: 2, final: false, now: T0 + LATE_MEDIA_QUIET_MS + 1 }),
    ).toEqual({ send: true, reason: "quiet_window_over" });
  });

  it("never mails twice about the same files", () => {
    const marker = { lastSentAt: new Date(T0).toISOString(), count: 3 };
    expect(decideLateMediaSend({ marker, count: 3, final: false, now: T0 + 3_600_000 }).send).toBe(false);
    expect(decideLateMediaSend({ marker, count: 3, final: true, now: T0 + 3_600_000 }).send).toBe(false);
    expect(decideLateMediaSend({ marker: null, count: 0, final: true, now: T0 }).send).toBe(false);
  });

  it("the end of the conversation flushes files the quiet window held back", () => {
    const marker = { lastSentAt: new Date(T0).toISOString(), count: 1 };
    expect(decideLateMediaSend({ marker, count: 3, final: true, now: T0 + 30_000 })).toEqual({
      send: true,
      reason: "new_files_final",
    });
  });

  it("reads the capture route's file names back into rows, skipping sidecars and markers", () => {
    const sid = "755f063f-6466-4647-8ec0-d195a1bc0be2";
    const row = mediaRowFromStorageName(sid, "2026-09", {
      name: "gallery_image-2026-09-05T12-36-34-643Z-eywcutuu.png",
      id: "x",
      created_at: "2026-09-05T12:36:34.693Z",
      metadata: { size: 1440822, mimetype: "image/png" },
    });
    expect(row).toMatchObject({
      source: "gallery_image",
      mime_type: "image/png",
      size_bytes: 1440822,
      storage_path: `${sid}/2026-09/gallery_image-2026-09-05T12-36-34-643Z-eywcutuu.png`,
    });
    expect(
      mediaRowFromStorageName(sid, "2026-09", {
        name: "gallery_image-2026-09-05T12-36-34-643Z-eywcutuu.json",
        id: "y",
        metadata: { size: 793, mimetype: "application/json" },
      }),
    ).toBeNull();
    expect(mediaRowFromStorageName(sid, "_notify", { name: "media.json", id: "z" })).toBeNull();
    expect(mediaRowFromStorageName(sid, "2026-09", { name: "stray.png", id: "w" })).toBeNull();
  });

  it("is wired at both ends: every upload, and the end-of-session sync", () => {
    const capture = src("app/api/media/capture/route.ts");
    expect(capture).toContain("notifyLateMedia({ url, serviceRoleKey, sessionId, final: false })");
    const sync = src("app/api/liveavatar/session-transcript/sync/route.ts");
    expect(sync).toContain("const endOfSession = body.endOfSession === true;");
    expect(sync).toContain("final: true,");
    const session = src("src/components/LiveAvatarSession.tsx");
    expect(session).toContain("endOfSession: true,");
    // The lead email's own media section reads the bucket when the table is empty.
    const manifest = src("src/lib/emails/leadMediaManifest.ts");
    expect(manifest).toContain("const fromBucket = await listSessionMediaFromStorage(url, key, sessionId);");
  });
});
