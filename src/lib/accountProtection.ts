import { getSupabaseAdminConfig } from "./supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DestructiveAccountAction =
  | "memory_wipe"
  | "memory_fact_delete"
  | "account_delete"
  | "account_delete_schedule"
  | "delete_now"
  | "cron_purge"
  | "unconfirmed_cleanup"
  | "direct_purge";

export type AccountProtection = {
  userId: string;
  protectionClass: "founder_permanent";
};

export type DestructiveActionCheck =
  | { allowed: true }
  | {
      allowed: false;
      code: "protected_account" | "protection_lookup_failed";
      action: DestructiveAccountAction;
      protectionClass?: "founder_permanent";
    };

export class AccountProtectionLookupError extends Error {
  readonly code = "protection_lookup_failed" as const;

  constructor(message = "Account protection could not be verified") {
    super(message);
    this.name = "AccountProtectionLookupError";
  }
}

export class AccountProtectionBlockedError extends Error {
  readonly code: "protected_account" | "protection_lookup_failed";
  readonly action: DestructiveAccountAction;
  readonly protectionClass?: "founder_permanent";

  constructor(result: Exclude<DestructiveActionCheck, { allowed: true }>) {
    super(
      result.code === "protected_account"
        ? "This permanent account cannot be deleted or wiped"
        : "Destructive action stopped because account protection could not be verified",
    );
    this.name = "AccountProtectionBlockedError";
    this.code = result.code;
    this.action = result.action;
    this.protectionClass = result.protectionClass;
  }
}

type ProtectedAccountRow = {
  user_id?: unknown;
  protection_class?: unknown;
};

/**
 * Resolve protection by the authenticated Supabase Auth UUID only. Email,
 * session IDs, and legacy account IDs are deliberately not accepted here.
 */
export async function getAccountProtection(
  authUserId: string,
): Promise<AccountProtection | null> {
  if (!UUID_RE.test(authUserId)) {
    throw new AccountProtectionLookupError("Invalid authenticated user UUID");
  }

  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    throw new AccountProtectionLookupError();
  }

  let response: Response;
  try {
    response = await fetch(
      `${url}/rest/v1/protected_accounts?user_id=eq.${encodeURIComponent(
        authUserId,
      )}&select=user_id,protection_class&limit=2`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: "application/json",
        },
      },
    );
  } catch {
    throw new AccountProtectionLookupError();
  }

  if (!response.ok) {
    throw new AccountProtectionLookupError();
  }

  let rows: unknown;
  try {
    rows = await response.json();
  } catch {
    throw new AccountProtectionLookupError();
  }
  if (!Array.isArray(rows) || rows.length > 1) {
    throw new AccountProtectionLookupError("Ambiguous or invalid protection registry response");
  }
  if (rows.length === 0) return null;

  const row = rows[0] as ProtectedAccountRow;
  if (
    row.user_id !== authUserId ||
    row.protection_class !== "founder_permanent"
  ) {
    throw new AccountProtectionLookupError("Ambiguous or invalid protection registry row");
  }
  return { userId: authUserId, protectionClass: "founder_permanent" };
}

export async function checkDestructiveActionAllowed(
  authUserId: string,
  action: DestructiveAccountAction,
): Promise<DestructiveActionCheck> {
  try {
    const protection = await getAccountProtection(authUserId);
    if (!protection) return { allowed: true };
    return {
      allowed: false,
      code: "protected_account",
      action,
      protectionClass: protection.protectionClass,
    };
  } catch {
    return { allowed: false, code: "protection_lookup_failed", action };
  }
}

export async function assertDestructiveActionAllowed(
  authUserId: string,
  action: DestructiveAccountAction,
): Promise<void> {
  const result = await checkDestructiveActionAllowed(authUserId, action);
  if (result.allowed === false) throw new AccountProtectionBlockedError(result);
}

export function accountProtectionErrorPayload(error: unknown): {
  status: number;
  body: { error: string; code: string };
} | null {
  if (!(error instanceof AccountProtectionBlockedError)) return null;
  return {
    status: error.code === "protected_account" ? 423 : 503,
    body: { error: error.message, code: error.code },
  };
}