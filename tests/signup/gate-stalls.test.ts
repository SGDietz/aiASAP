import { describe, it } from "vitest";
import {
  accountSetupSpeechFlow,
  takesEmailFastPath,
  type SignupFlags,
} from "../../src/lib/signup/machine";
import { makeFakeWorld } from "./fakePorts";

const FLAGS: SignupFlags = {
  accountBetaDisabled: false,
  emailTypedFallbackEnabled: false,
};

async function replayTurn(ports: any, userText: string): Promise<string> {
  console.log("replayTurn:", userText, "takesEmailFastPath=", takesEmailFastPath(ports, FLAGS, userText));
  if (takesEmailFastPath(ports, FLAGS, userText)) {
    if (await accountSetupSpeechFlow(ports, FLAGS, userText)) return "fastpath";
  }
  if (await accountSetupSpeechFlow(ports, FLAGS, userText)) return "handled";
  return "unhandled";
}

describe("trace through dispatcher", () => {
  it("email via replayTurn dispatcher", async () => {
    const w = makeFakeWorld({ userName: "G" });

    await replayTurn(w.ports, "set up an account");
    console.log("After trigger: awaitingReady=", w.ports.awaitingReady);

    await replayTurn(w.ports, "yes");
    console.log("After 'yes': awaitingEmail=", w.ports.awaitingEmail);

    const result = await replayTurn(w.ports, "example@pm.me");
    console.log("After 'example@pm.me': result=", result, "pendingEmail=", w.ports.pendingEmail);
  });
});
