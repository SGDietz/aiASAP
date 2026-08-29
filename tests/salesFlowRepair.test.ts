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
    expect(SIX_SYSTEM_PROMPT).toContain('"Good to meet you, [name]. I\'m 6 - the number."');
    expect(SIX_SYSTEM_PROMPT).toContain("Then continue the guided conversation");
    expect(SIX_SYSTEM_PROMPT).toContain("You, 6, remain their ongoing guide");
    expect(SIX_SYSTEM_PROMPT).toContain("Never claim that connection already happened");
    expect(SIX_SYSTEM_PROMPT).toContain("never force contact capture");
  });

  it("uses the dashed brand form only at the TTS boundary", () => {
    expect(formatSixSpeechForTts("aiASAP builds brands")).toBe("a-i-ASAP builds brands");
    expect(formatSixSpeechForTts("a-i-ASAP builds brands")).toBe("a-i-ASAP builds brands");
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
