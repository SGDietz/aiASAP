// The harness body for the signup machine: same SignupPorts the component
// implements over its refs, here implemented over a plain object + effect log.
// Replaying a transcript through the machine with THESE ports exercises the
// exact decision code that runs on the site — no browser, no avatar, no
// LiveAvatar credits.
import type { SignupPorts } from "../../src/lib/signup/machine";

export interface FakeSignupWorld {
  ports: SignupPorts;
  /** Every spoken line, in order. */
  said: string[];
  /** Every magic-link send the machine requested. */
  sentTo: string[];
  /** Coarse effect log for ordering assertions. */
  effects: string[];
  /** Mutable context knobs (signed-in, avatar talking, name…). */
  ctx: {
    signedIn: boolean;
    avatarTalking: boolean;
    userName: string | null;
    greetingCount: number;
  };
  /** Fake clock (ms). Frozen by default; bump it to step past echo windows. */
  clock: { ms: number };
}

export function makeFakeWorld(
  init?: Partial<FakeSignupWorld["ctx"]>,
): FakeSignupWorld {
  const ctx = {
    signedIn: false,
    avatarTalking: false,
    userName: null as string | null,
    greetingCount: 0,
    ...init,
  };
  const state = {
    awaitingReady: false,
    awaitingEmail: false,
    awaitingName: false,
    awaitingSend: false,
    pendingEmail: null as string | null,
    rejectedEmail: null as string | null,
    confirmedEmail: null as string | null,
    sendEmail: null as string | null,
    emailMissCount: 0,
    offerMade: false,
    declinedAt: 0,
    lastParsedEmail: null as string | null,
    sendArmedAt: 0,
    sendArmedByText: null as string | null,
    chestText: "",
  };
  const said: string[] = [];
  const sentTo: string[] = [];
  const effects: string[] = [];
  const clock = { ms: 1_000_000 };

  const ports: SignupPorts = {
    get awaitingReady() { return state.awaitingReady; },
    set awaitingReady(v: boolean) { state.awaitingReady = v; },
    get awaitingEmail() { return state.awaitingEmail; },
    set awaitingEmail(v: boolean) { state.awaitingEmail = v; },
    get awaitingName() { return state.awaitingName; },
    set awaitingName(v: boolean) { state.awaitingName = v; },
    get awaitingSend() { return state.awaitingSend; },
    set awaitingSend(v: boolean) { state.awaitingSend = v; },
    get pendingEmail() { return state.pendingEmail; },
    set pendingEmail(v: string | null) { state.pendingEmail = v; },
    get rejectedEmail() { return state.rejectedEmail; },
    set rejectedEmail(v: string | null) { state.rejectedEmail = v; },
    get confirmedEmail() { return state.confirmedEmail; },
    set confirmedEmail(v: string | null) { state.confirmedEmail = v; },
    get sendEmail() { return state.sendEmail; },
    set sendEmail(v: string | null) { state.sendEmail = v; },
    get emailMissCount() { return state.emailMissCount; },
    set emailMissCount(v: number) { state.emailMissCount = v; },
    get offerMade() { return state.offerMade; },
    set offerMade(v: boolean) { state.offerMade = v; },
    get declinedAt() { return state.declinedAt; },
    set declinedAt(v: number) { state.declinedAt = v; },
    get lastParsedEmail() { return state.lastParsedEmail; },
    set lastParsedEmail(v: string | null) { state.lastParsedEmail = v; },
    get sendArmedAt() { return state.sendArmedAt; },
    set sendArmedAt(v: number) { state.sendArmedAt = v; },
    get sendArmedByText() { return state.sendArmedByText; },
    set sendArmedByText(v: string | null) { state.sendArmedByText = v; },
    get signedIn() { return ctx.signedIn; },
    get avatarTalking() { return ctx.avatarTalking; },
    get userName() { return ctx.userName; },
    get greetingCount() { return ctx.greetingCount; },
    get chestText() { return state.chestText; },
    say: async (text) => {
      said.push(text);
      effects.push(`say:${text}`);
    },
    saveName: (name) => {
      ctx.userName = name;
      effects.push(`saveName:${name}`);
    },
    showChest: () => {
      effects.push("showChest");
    },
    setChestDisplay: (text) => {
      state.chestText = text;
      effects.push(`chest:${text}`);
    },
    revealChars: async (fromText, addedChars) => {
      // The component animates letter-by-letter; settled result is identical.
      state.chestText = `${fromText}${addedChars}`;
      effects.push(`reveal:${fromText}+${addedChars}`);
    },
    clearRevealActive: () => {},
    openTypedBox: () => {
      effects.push("openTypedBox");
    },
    closeTypedBox: () => {},
    setTypedEmail: () => {},
    startAccountSetup: async (email) => {
      sentTo.push(email);
      effects.push(`SEND:${email}`);
      return true;
    },
    clearEntry: () => {
      state.awaitingReady = false;
      state.awaitingEmail = false;
      state.awaitingName = false;
      state.pendingEmail = null;
      state.rejectedEmail = null;
      state.confirmedEmail = null;
      state.awaitingSend = false;
      state.sendEmail = null;
      state.emailMissCount = 0;
      state.lastParsedEmail = null;
      state.chestText = "";
      effects.push("clearEntry");
    },
    now: () => clock.ms,
  };

  return { ports, said, sentTo, effects, ctx, clock };
}
