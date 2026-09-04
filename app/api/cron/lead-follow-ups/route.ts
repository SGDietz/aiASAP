import { NextResponse } from "next/server";
import {
  createHttpFollowUpOutbox,
  createResendFollowUpTransport,
  drainDueFollowUps,
} from "../../../../src/lib/leadFollowUpNotify";
import {
  createHttpVisitorReceiptOutbox,
  createResendVisitorReceiptTransport,
  drainDueVisitorReceipts,
} from "../../../../src/lib/visitorConfirmation";
import {
  createHttpAccountNotifyOutbox,
  createResendAccountNotifyTransport,
  drainDueAccountNotifications,
} from "../../../../src/lib/accountCreatedNotify";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { sendOperationalAlert } from "../../../../src/lib/operationalAlert";

export const maxDuration = 120;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const followUps = await drainDueFollowUps({
      store: createHttpFollowUpOutbox(url, serviceRoleKey),
      transport: createResendFollowUpTransport(),
    });
    const visitors = await drainDueVisitorReceipts({
      store: createHttpVisitorReceiptOutbox(url, serviceRoleKey),
      transport: createResendVisitorReceiptTransport(),
    });
    const accounts = await drainDueAccountNotifications({
      store: createHttpAccountNotifyOutbox(url, serviceRoleKey),
      transport: createResendAccountNotifyTransport(),
    });
    const groups = { follow_ups: followUps, visitor_receipts: visitors, account_notifications: accounts };
    const flat = [...followUps, ...visitors, ...accounts];
    const failed = flat.filter((result) => result.status === "failed");
    // Retryable single-row failures stay quiet. A cluster in one drain run is
    // an operational incident and gets one deduplicated, PII-free alert.
    if (failed.length >= 3) {
      await sendOperationalAlert({
        stage: "notification-drain",
        severity: "critical",
        errorCode: "multiple_delivery_failures",
        safeDetail: `${failed.length} durable notification rows failed in one reconciliation run`,
      });
    }
    return NextResponse.json({
      ok: flat.every((result) => result.status === "sent" || result.status === "dead_letter"),
      examined: flat.length,
      sent: flat.filter((result) => result.status === "sent").length,
      failed: flat.filter((result) => result.status === "failed").length,
      sending: flat.filter((result) => result.status === "sending").length,
      dead_letter: flat.filter((result) => result.status === "dead_letter").length,
      groups: Object.fromEntries(
        Object.entries(groups).map(([kind, list]) => [
          kind,
          {
            examined: list.length,
            sent: list.filter((result) => result.status === "sent").length,
            failed: list.filter((result) => result.status === "failed").length,
            sending: list.filter((result) => result.status === "sending").length,
            dead_letter: list.filter((result) => result.status === "dead_letter").length,
          },
        ]),
      ),
    });
  } catch (error) {
    console.error("[cron:lead-follow-ups] failed", error);
    await sendOperationalAlert({
      stage: "notification-drain",
      severity: "critical",
      errorCode: "drain_unavailable",
      safeDetail: error,
    });
    return NextResponse.json({ ok: false, error: "lead follow-up drain failed" }, { status: 500 });
  }
}
