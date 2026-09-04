import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractContactDetails } from "../src/lib/contactExtraction";
import { allowsOnlineLookup } from "../src/lib/onlineLookupPolicy";
import { SIX_SYSTEM_PROMPT } from "../src/lib/brain/sixSystemPrompt";
import { formatSixSpeechForTts } from "../src/lib/voice/speechBrand";

describe("CUSTOM sales-flow repair", () => {
  it("does not turn an occupation into a prospect name", () => {
    expect(extractContactDetails("I'm a landscaper").fullName).toBeNull();
    expect(extractContactDetails("I am an electrician").fullName).toBeNull();
    expect(extractContactDetails("I'm Alice").fullName).toBe("Alice");
    expect(extractContactDetails("My name is Jane Smith").fullName).toBe("Jane Smith");
  });

  it("does not extract a name from the im inside him", () => {
    expect(extractContactDetails("have him help me").fullName).toBeNull();
    for (const collision of [
      "help the victim please",
      "watch him swim",
      "trim the hedge",
      "the dim hallway",
    ]) {
      expect(extractContactDetails(collision).fullName, collision).toBeNull();
    }
    expect(extractContactDetails("I'm Scott").fullName).toBe("Scott");
    expect(extractContactDetails("im Scott").fullName).toBe("Scott");
  });

  it("keeps local lookup in FULL and out of CUSTOM sales turns", () => {
    expect(allowsOnlineLookup("CUSTOM")).toBe(false);
    expect(allowsOnlineLookup("FULL")).toBe(true);
    const sessionSource = readFileSync(
      resolve(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );
    expect(sessionSource).toContain("if (!allowsOnlineLookup(mode)) return false;");
    expect(sessionSource).toContain("if (!allowsOnlineLookup(mode)) {");
  });

  it("keeps the prompt's idea, price, and forward-motion sales doctrine", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("WHEN THEY ASK FOR IDEAS");
    expect(SIX_SYSTEM_PROMPT).toContain("three or four vivid, specific possibilities");
    expect(SIX_SYSTEM_PROMPT).toContain("Never invent or guarantee a price, customer, income, return, result");
    expect(SIX_SYSTEM_PROMPT).toContain("best practical next move or one focused choice");
    expect(SIX_SYSTEM_PROMPT).toContain("PRICE RULE:");
    expect(SIX_SYSTEM_PROMPT).toContain("starting prices: custom avatar salesperson starts at $3,000; full website starts at $5,000");
    expect(SIX_SYSTEM_PROMPT).toContain("CONCRETE-WORK PIVOT:");
    expect(SIX_SYSTEM_PROMPT).toContain("building landscapes and stone walls");
    expect(SIX_SYSTEM_PROMPT).toContain("do not loop through generic customer, package, pricing, or service-menu questions");
    expect(SIX_SYSTEM_PROMPT).toContain("profit engine, pain bottleneck, paying buyer, or first offer");
    expect(SIX_SYSTEM_PROMPT).toContain("Never force brand, website, avatar, or social work");
    expect(SIX_SYSTEM_PROMPT).toContain("Never invent or guarantee a price, customer, income, return, result");
    expect(SIX_SYSTEM_PROMPT).toContain("COACHING AND CONNECTION CONSENT:");
    expect(SIX_SYSTEM_PROMPT).toContain("not consent to contact");
    expect(SIX_SYSTEM_PROMPT).toContain("connection with the team here at aiASAP");
    const routeSource = readFileSync(
      resolve(process.cwd(), "app/api/openai-chat-complete/route.ts"),
      "utf8",
    );
    expect(routeSource).toContain('import { SIX_SYSTEM_PROMPT }');
    expect(routeSource).toContain("const SYSTEM_PROMPT = SIX_SYSTEM_PROMPT;");
    expect(routeSource).toContain("hasExplicitPersonalConnectionRequest");
    expect(routeSource).not.toContain("hasExplicitBuildRequest");
  });

  it("welcomes a genuinely learned name once and keeps 6 as the ongoing guide", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("NAME WELCOME AND GUIDE:");
    // 2026-09-04: the re-introduction is GONE. It was G's single most repeated
    // complaint across five rides - "You're 6, the number, not the word"
    // (09-03, twice), "Not the word 6" and "The name's 6, the number, not the
    // letter" (08-23), and on 09-04, after hearing it twice inside one minute,
    // "Twice now, and you shouldn't do that." 6 is already introduced by the
    // opener; saying it again on the name welcome is a SECOND introduction.
    expect(SIX_SYSTEM_PROMPT).toContain('"Good to meet you, [name]."');
    expect(SIX_SYSTEM_PROMPT).not.toContain('"Good to meet you, [name]. I\'m 6 - the number."');
    expect(SIX_SYSTEM_PROMPT).toContain("THAT IS THE WHOLE LINE");
    expect(SIX_SYSTEM_PROMPT).toContain("Then continue the guided conversation");
    expect(SIX_SYSTEM_PROMPT).toContain("You, 6, remain their ongoing guide");
    expect(SIX_SYSTEM_PROMPT).toContain("Never claim that connection already happened");
    expect(SIX_SYSTEM_PROMPT).toContain("never force contact capture");
  });

  it("speaks the brand as a-i-ASAP, only at the TTS boundary", () => {
    // G locked this on 2026-09-04 as a standing order: "when he says aiASAP
    // lock this in, needs a-i-ASAP and everything else such as this, the
    // dashes. all sites... no deviation." He had already rejected the
    // six-letter spelling mid-ride on 09-03 ("you don't say A-I-A-S-A-P so
    // well... you have the dashes, A dash I dash ASAP"), and his brain prompt
    // forbade it - but this formatter still forced it, overriding the brain at
    // the last boundary. His ears are the authority; do not revert on a single
    // bad-sounding ride, raise it with him.
    expect(formatSixSpeechForTts("aiASAP builds brands")).toBe("a-i-ASAP builds brands");
    // already in the spoken form - formatting again must not double-convert
    expect(formatSixSpeechForTts("a-i-ASAP builds brands")).toBe("a-i-ASAP builds brands");
    // the RETIRED six-letter spelling is corrected forward, not preserved, so
    // stored lines carrying it are not stranded in the wrong pronunciation
    expect(formatSixSpeechForTts("A-I-A-S-A-P builds brands")).toBe("a-i-ASAP builds brands");
    // idempotent: the formatter runs at more than one speech boundary
    expect(formatSixSpeechForTts(formatSixSpeechForTts("aiASAP is here"))).toBe(
      "a-i-ASAP is here",
    );
    // written copy is untouched everywhere else
    expect("aiASAP").toBe("aiASAP");
    const sessionSource = readFileSync(
      resolve(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );
    expect(sessionSource).toContain("formatSixSpeechForTts(text)");
  });

  it("keeps the generated runtime prompt synchronized with its editable source", () => {
    const source = readFileSync(resolve(process.cwd(), "tools/cw_6af8624c_prompt.txt"), "utf8")
      .replace(/\r\n/g, "\n");
    expect(SIX_SYSTEM_PROMPT).toBe(source);
  });
});
