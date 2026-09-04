export type MicrophoneRecoveryState =
  | "denied"
  | "dismissed"
  | "unavailable"
  | "insecure";

type MicrophoneRecoveryCardProps = {
  onCheckAgain: () => void;
  /** Which blocked outcome the immediately preceding request produced. */
  state?: MicrophoneRecoveryState;
  /** Set while a true site-deny re-check is in flight. */
  busy?: boolean;
  /** True when Chrome still reports this exact origin as denied. */
  stillBlocked?: boolean;
};

type RecoveryCopy = {
  title: string;
  body: string;
  /** Second paragraph, used where the visitor needs steps as well as a reason. */
  body2?: string;
  button: string | null;
};

/**
 * Android reports three different blocked outcomes and only one of them is a
 * site-level deny.
 *
 * The "denied" copy is the important one. A confirmed origin-level deny cannot
 * show another Chrome prompt on the same address. Its button therefore performs
 * a free Permissions re-read after the visitor changes the page's Site controls.
 * Dismissed/prompt recovery remains the real fresh getUserMedia path.
 *
 * "dismissed" is the case where a retry genuinely can prompt again, so it keeps
 * the original wording. It is also where an Android browser-app-level block
 * lands: getUserMedia rejects while Permissions.query still answers "prompt",
 * because the site setting was never touched.
 */
const RECOVERY_COPY: Record<MicrophoneRecoveryState, RecoveryCopy> = {
  denied: {
    title: "Microphone is blocked for this site",
    body:
      "Chrome will not show another microphone question on this address. Open this page's Site controls, set Microphone to Allow, then tap CHECK AGAIN.",
    button: "CHECK AGAIN",
  },
  dismissed: {
    title: "Microphone access did not go through",
    body:
      "Tap CHECK MIC AGAIN to make one fresh microphone request. Answer the browser's question if it appears. If it does not, the browser refused the request and aiASAP cannot override it.",
    button: "CHECK MIC AGAIN",
  },
  unavailable: {
    // Covers both "no capture device" and "the device is held by something
    // else" — getUserMedia rejects for both, and the page cannot tell a missing
    // microphone from a busy one. Say both plainly rather than guess wrong.
    title: "No microphone available",
    body:
      "Either this device has no microphone the browser can reach, or another app is holding it. Close anything that might be recording or on a call, then try again.",
    button: "CHECK MIC AGAIN",
  },
  insecure: {
    title: "This page is not secure",
    body:
      "A browser only shares the microphone on a secure page. Open https://aiasap.ai and start again.",
    button: null,
  },
};

/**
 * Mobile-only recovery surface for the immediately preceding user-owned
 * request. The app cannot reset browser permission, but it can make exactly
 * one fresh request without leaving stale warning text over the stage.
 */
export function MicrophoneRecoveryCard({
  onCheckAgain,
  state = "denied",
  busy = false,
  stillBlocked = false,
}: MicrophoneRecoveryCardProps) {
  const copy = RECOVERY_COPY[state] ?? RECOVERY_COPY.denied;

  return (
    <section
      data-microphone-recovery="blocked"
      data-microphone-recovery-state={state}
      role="alert"
      className="fixed left-1/2 z-[70] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[#e0aa62]/70 bg-[#1d1108]/95 px-4 py-3 text-center shadow-[0_14px_36px_rgba(0,0,0,0.58)] bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.43)] md:hidden"
    >
      <p className="text-sm font-black text-[#ffe9c2]">{copy.title}</p>
      <p className="mt-1 text-xs leading-snug text-[#f1c477]">{copy.body}</p>
      {copy.body2 && (
        <p className="mt-2 text-xs leading-snug text-[#f1c477]">{copy.body2}</p>
      )}
      {stillBlocked && (
        <p
          data-microphone-recovery-retry="still-blocked"
          className="mt-2 text-xs font-bold leading-snug text-[#ffd7a0]"
        >
          Still blocked for this address. Chrome cannot ask again until Site
          controls says Allow.
        </p>
      )}
      {copy.button && (
        <button
          type="button"
          onClick={onCheckAgain}
          disabled={busy}
          className="btn-inset mt-3 rounded-lg px-4 py-2 text-xs font-black tracking-[0.08em] text-[#ffe9c2] disabled:opacity-60"
        >
          {busy ? "CHECKING…" : copy.button}
        </button>
      )}
    </section>
  );
}
