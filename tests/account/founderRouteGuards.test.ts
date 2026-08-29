import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function expectGuardBefore(
  text: string,
  action: string,
  destructiveMarker: string,
): void {
  const guardIndex = text.indexOf(`"${action}"`);
  const destructiveIndex = text.indexOf(destructiveMarker);
  expect(guardIndex, `${action} guard missing`).toBeGreaterThanOrEqual(0);
  expect(destructiveIndex, `${destructiveMarker} missing`).toBeGreaterThanOrEqual(0);
  expect(guardIndex, `${action} guard must run before destructive call`).toBeLessThan(
    destructiveIndex,
  );
  expect(
    text.includes("protection.allowed === false") ||
      text.includes("assertDestructiveActionAllowed"),
    `${action} guard must fail closed`,
  ).toBe(true);
}

describe("founder destructive-route guard coverage", () => {
  it("guards single/all memory fact deletion before the DELETE request", () => {
    expectGuardBefore(
      source("app/api/account/memory/route.ts"),
      "memory_fact_delete",
      'method: "DELETE"',
    );
  });

  it("guards unconfirmed-auth cleanup before deleting an auth user", () => {
    expectGuardBefore(
      source("app/api/auth/cleanup-unconfirmed/route.ts"),
      "unconfirmed_cleanup",
      'method: "DELETE"',
    );
  });

  it("guards the central purge primitive before any table or auth deletion", () => {
    expectGuardBefore(
      source("src/lib/purgeUserData.ts"),
      "direct_purge",
      'method: "DELETE"',
    );
  });

  it("guards account-deletion scheduling before writing metadata", () => {
    expectGuardBefore(
      source("src/lib/accountDeletionSchedule.ts"),
      "account_delete_schedule",
      "const now = Date.now()",
    );
  });

  it("guards delete-now and day-30 purge routes", () => {
    expectGuardBefore(
      source("app/api/account/delete-now/route.ts"),
      "delete_now",
      "await purgeUserData",
    );
    expectGuardBefore(
      source("app/api/cron/purge-deletions/route.ts"),
      "cron_purge",
      "await purgeUserData",
    );
  });
});
