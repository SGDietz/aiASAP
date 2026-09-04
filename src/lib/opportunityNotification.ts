import { alertPayloadContainsPrivateRawData, type WatchdogAlertPayload } from "./opportunityWatchdog";

export type OpportunityDeliveryResult =
  | { status: "sent"; providerId: string }
  | { status: "failed"; error: string; retryAt: string }
  | { status: "queued"; reason: string };

export interface OpportunityTransport {
  send(args: { dedupeKey: string; kind: "new_visitor" | "unfinished_opportunity"; payload: WatchdogAlertPayload }): Promise<{ providerId: string }>;
}

/**
 * Outbox delivery gate. Local/dev defaults to queued dry-run. A real transport
 * must be injected by the separately authorized delivery worker.
 */
export async function deliverOpportunityNotification(args: {
  dedupeKey: string;
  kind: "new_visitor" | "unfinished_opportunity";
  payload: WatchdogAlertPayload;
  enabled: boolean;
  transport?: OpportunityTransport;
  now?: Date;
}): Promise<OpportunityDeliveryResult> {
  if (alertPayloadContainsPrivateRawData(args.payload)) {
    return {
      status: "failed",
      error: "private payload rejected",
      retryAt: new Date((args.now ?? new Date()).getTime() + 60 * 60 * 1000).toISOString(),
    };
  }
  if (!args.enabled || !args.transport) {
    return { status: "queued", reason: "delivery disabled; durable dry-run only" };
  }
  try {
    const sent = await args.transport.send({ dedupeKey: args.dedupeKey, kind: args.kind, payload: args.payload });
    return { status: "sent", providerId: sent.providerId };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 300) : "transport failed",
      retryAt: new Date((args.now ?? new Date()).getTime() + 15 * 60 * 1000).toISOString(),
    };
  }
}
