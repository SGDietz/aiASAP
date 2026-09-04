export type SendLinkFallbackStatus =
  | "hidden"
  | "pending"
  | "sending"
  | "sent"
  | "failed";

export function resolveSendLinkFallbackStatus(outcome: {
  alreadySentRecently?: boolean;
  emailSent?: boolean;
}): "sent" | "failed" {
  return outcome.alreadySentRecently || outcome.emailSent ? "sent" : "failed";
}
