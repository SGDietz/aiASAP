export type MicrophoneRecoveryState =
  | "denied"
  | "dismissed"
  | "unavailable"
  | "insecure";

type MicrophoneRecoveryCardProps = {
  onCheckAgain: () => void;
  /** Which blocked outcome the immediately preceding request produced. */
  state?: MicrophoneRecoveryState;
  /** Set while a re-check is in flight, so the button cannot be double-tapped. */
  busy?: boolean;
  /** True once a re-check ran and the site was still blocked. */
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
 * The "denied" copy is the important one, and it used to be wrong. It promised
 * "one fresh microphone request", but a browser will NOT prompt twice for a
 * site the visitor has blocked - getUserMedia just rejects. So the old button
 * could never succeed no matter how many times it was tapped, and on top of
 * that every tap fired a fresh /api/start-custom-session, which costs real
 * money. Reproduced headless with the mint held, 2026-08-28, after G hit
 * exactly this on his Android phone.
 *
 * A blocked site can only be recovered in the browser's own site settings, so
 * that is what the card now says. Its button re-READS the permission (free, no
 * prompt, no session) rather than re-requesting it.
 *
 * "dismissed" is the case where a retry genuinely can prompt again, so it keeps
 * the original wording. It is also where an Android browser-app-level block
 * lands: getUserMedia rejects while Permissions.query still answers "prompt",
 * because the site setting was never touched.
 */
const RECOVERY_COPY: Record<MicrophoneRecoveryState, RecoveryCopy> = {
  denied: {
    title: "Microphone is off for this site",
    body:
      "You probably did not do this. If a microphone pop-up gets tapped away a few times, a browser stops asking and treats the site as blocked on its own.",
    body2:
      "To turn it back on: if this page opened inside another app, open it in your full browser app first. Then open that browser's permissions for this page and set Microphone to Allow. If Microphone is not offered there, check your phone Settings, then Apps, then your browser, then Permissions.",
    button: "I TURNED IT ON",
  },
  dismissed: {
    title: "Microphone access did not go through",
    body:
      "Tap CHECK MIC AGAIN to make one fresh microphone request. If no pop-up appears at all, your browser app may not have microphone access. Open your phone Settings, find this browser in your apps, and turn Microphone on.",
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
          Still blocked. The change has not taken yet — make sure Microphone
          says Allow, then tap again.
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
