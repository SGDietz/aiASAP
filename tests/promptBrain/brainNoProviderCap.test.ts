import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

/**
 * G, 2026-08-21: "get the context window off of live avatar and into the code
 * base so that we don't have a sixty three thousand character limit. It can be
 * unlimited."
 *
 * 6's brain lives in the codebase and is sent whole to the model. The old
 * 65,535-character ceiling was LiveAvatar's, and it only ever reached this
 * repo through tools/update_liveavatar_context.py, which refused to PATCH above
 * it. Production does not read the provider context at all (CUSTOM mode sends
 * no context_id), so that ceiling was a provider constraint leaking into a file
 * the provider never reads.
 *
 * These tests exist so nobody quietly puts the ceiling back.
 */
const PROVIDER_TRUNCATES_AT = 65535;
const repoFile = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

describe("6's brain has no provider character cap", () => {
  it("is already larger than LiveAvatar's 65,535-char limit, and that is fine", () => {
    // If this ever fails because the prompt SHRANK below the cap, that is not a
    // bug in itself — but check nobody trimmed it to satisfy the provider.
    expect(SIX_SYSTEM_PROMPT.length).toBeGreaterThan(PROVIDER_TRUNCATES_AT);
  });

  it("reaches the model whole — nothing in the brain path truncates it", () => {
    const route = repoFile("app/api/openai-chat-complete/route.ts");
    // The prompt is used as-is: imported, aliased, and pushed into systemSections.
    expect(route).toContain("import { SIX_SYSTEM_PROMPT }");
    expect(route).toContain("const SYSTEM_PROMPT = SIX_SYSTEM_PROMPT;");
    expect(route).toContain("const systemSections: string[] = [SYSTEM_PROMPT];");
    // No slicing/truncating of the system prompt on its way to the model.
    expect(route).not.toMatch(/SYSTEM_PROMPT\s*\.\s*(slice|substring|substr)\s*\(/);
    expect(route).not.toMatch(/truncate\w*\(\s*SYSTEM_PROMPT/);
  });

  it("the legacy provider mirror stays OFF by default", () => {
    const mirror = repoFile("tools/update_liveavatar_context.py");
    // Mirroring must require an explicit opt-in flag; a bare run must not PATCH.
    expect(mirror).toContain("--force-legacy-mirror");
    expect(mirror).toContain("MIRRORING IS OFF");
    // And the old hard refusal that capped the file must be gone.
    expect(mirror).not.toContain("REFUSING TO PATCH");
  });

  it("the generated brain still matches its source file exactly", () => {
    // CRLF in the .txt collapses to LF through Python's universal newlines, which
    // is what the generator writes. Normalize before comparing.
    const source = repoFile("tools/cw_6af8624c_prompt.txt").replace(/\r\n/g, "\n");
    expect(SIX_SYSTEM_PROMPT).toEqual(source);
  });
});
