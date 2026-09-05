import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");

describe("6 current product role", () => {
  it("ships the voice-first individualized money-diagnosis role", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("voice-first money diagnosis");
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Your primary job is to help this person improve financial success",
    );
    expect(SIX_SYSTEM_PROMPT).toContain("The team here at aiASAP can help you turn what you love and do well into a practical money path");
    expect(SIX_SYSTEM_PROMPT).toContain("A brand or site is never the automatic answer");
    expect(SIX_SYSTEM_PROMPT).toContain("Never answer a value question with only \"yes or no.\"");
    expect(SIX_SYSTEM_PROMPT).toContain("Do not ask about passion once and abandon it");
    expect(SIX_SYSTEM_PROMPT).toContain("Answer first, then lead");
  });

  it("states the current human-team service without selling future social or ad execution", () => {
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Right now, the human team at aiASAP builds websites and avatar sites for clients, and every project helps us build the automation system behind them. Fully managed social media is not live yet. We're building toward it, and I'll tell you plainly what we can do today and what's still coming.",
    );
    expect(SIX_SYSTEM_PROMPT).toContain("Fully managed social-media execution and automation are not a present service");
    expect(SIX_SYSTEM_PROMPT).toContain("do not claim the team currently runs or manages Google, Facebook or Meta");
    expect(SIX_SYSTEM_PROMPT).not.toContain("the team here at aiASAP can help plan, create, budget, run, test, and improve");
  });

  it("removes the stale general and dating lanes", () => {
    for (const stale of [
      "a real personal assistant who helps people build a more wonderful life",
      "relationships, money, goals, your socials, a business, errands",
      "DATING help is also contextual",
      'The first four idea boxes are: "Build Friendships,"',
    ]) {
      expect(SIX_SYSTEM_PROMPT).not.toContain(stale);
    }
  });

  it("proves the CUSTOM LiveAvatar path consumes this local prompt authority", () => {
    const editable = source("tools/cw_6af8624c_prompt.txt");
    const route = source("app/api/openai-chat-complete/route.ts");
    const customMint = source("app/api/start-custom-session/route.ts");
    expect(SIX_SYSTEM_PROMPT).toBe(editable);
    expect(route).toContain('import { SIX_SYSTEM_PROMPT }');
    expect(route).toContain("const SYSTEM_PROMPT = SIX_SYSTEM_PROMPT;");
    expect(customMint).not.toContain("context_id:");
  });

  it("locks G's exact one-line greeting, digit name, and four-word brand phrase", () => {
    const session = source("src/components/LiveAvatarSession.tsx");
    const greeting =
      "6 here. Tell me what you love doing, and what you're good at, what you know. Together, we're gonna build a money-making machine that's gonna set you free to live the life you want to live. Start here, tell me what you love doing most in this world.";
    const oldGreeting =
      "6 here, ready to Turbo Charge Your Life. What do you love to do? What is your passion? Let's talk about that. Then we'll figure out how to make money from it and set you free to live the life that you want to live.";

    expect(session).toContain(JSON.stringify(greeting));
    // 2026-09-04: the opener text is DELIBERATELY NOT in the prompt any more.
    // It was, and 6 copied it - twice as a "demo" on 09-03, then the whole
    // line six minutes into a conversation on 09-04 (the transcript row carries
    // an utterance_id, so it was a REPLY, not the app). Three prohibitions did
    // not stop him while the words sat there to copy. A line he cannot see is a
    // line he cannot repeat. The greeting is locked in the COMPONENT, which is
    // where it is actually spoken from.
    expect(SIX_SYSTEM_PROMPT).not.toContain(greeting);
    expect(SIX_SYSTEM_PROMPT).toContain("ITS EXACT WORDS ARE DELIBERATELY NOT WRITTEN HERE");
    // and the specific trigger that set it off is answered
    expect(SIX_SYSTEM_PROMPT).toContain('"go ahead", "carry on", or "what were you saying"');
    expect(session).not.toContain(oldGreeting);
    expect(SIX_SYSTEM_PROMPT).not.toContain(oldGreeting);
    expect(session.match(new RegExp(JSON.stringify(greeting).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(1);
    expect(session).toContain("claimSessionGreeting(anonymousGreetingSpokenRef)");
    expect(session).not.toContain("GREETING_COMPLETION_POOL");
    expect(session).not.toContain("pickGreetingCompletion");
    expect(SIX_SYSTEM_PROMPT).toContain('"What do you love?" first, then "What do you know and do well?"');
    expect(SIX_SYSTEM_PROMPT).toContain('brand phrase is exactly four words: "Turbo Charge Your Life."');

    for (const stale of [
      "Hi, I'm 6, your a-i-buddy",
      "how can I make your life a little bit better today",
      "TurboCharge Your Life",
      "Turbo Charging Your Life",
      "I'm Six",
      "yourself, Six",
      "S-I-X",
    ]) {
      expect(session).not.toContain(stale);
      expect(SIX_SYSTEM_PROMPT).not.toContain(stale);
    }
  });
});
