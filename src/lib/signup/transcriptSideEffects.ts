// LiveAvatar's official transcript is always observational. Account creation,
// correction, and magic-link delivery are owned exclusively by the client signup
// machine and /api/account/start; no request flag may re-enable a fallback sender.
export function allowsTranscriptSignupSideEffects(
  _clientManagedSignup: boolean,
): boolean {
  return false;
}
