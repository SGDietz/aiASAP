import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SIX_SYSTEM_PROMPT } from "../src/lib/brain/sixSystemPrompt";

describe("training, legal, and sales boundaries", () => {
  it("discloses training control and the paid-project assignment boundaries", () => {
    const legal = readFileSync("app/legal/page.tsx", "utf8");
    for (const text of [
      "Training Mode",
      "Public visitors cannot",
      "review learned items",
      "Client-Specific Material",
      "springing written assignment",
      "Effective automatically only when aiASAP has completed the agreed services and received the full agreed price for that specific Deliverable in settled, cleared funds",
      "aiASAP hereby assigns to Client all right, title, and interest that aiASAP owns",
      "clickwrap agreement electronically accepted by the customer and electronically executed by aiASAP or its authorized signatory",
      "affirmative acceptance control must start unchecked",
      "exact terms, version and hash",
      "aiASAP authorized countersignature",
      "customer's clickwrap assent does not by itself execute a transfer",
      "assignment never vests for that affected unpaid Deliverable",
      "limited, nonexclusive, nontransferable license to review and evaluate",
      "does not automatically suspend, rescind, or claw back",
      "does not reach the client's pre-existing business",
      "Work-made-for-hire status is not the sole transfer mechanism",
      "employee, contractor, or subcontractor in the contribution chain",
      "Delivery of editable or source files is separate from copyright ownership",
      "Background Materials",
      "worldwide, nonexclusive, royalty-free license",
      "digit 6 character and brand",
      "AI-generated elements may be uncopyrightable or nonexclusive",
      "no aiASAP equity, royalty, revenue share, profit share, success fee",
    ]) expect(legal).toContain(text);
    expect(legal).not.toMatch(/one year|time-bound license|perpetual|renewal|irrevocable/i);
    expect(legal).not.toContain("lease-like right");
    expect(legal).not.toContain("payment alone transfers copyright");
    expect(legal).not.toMatch(/portfolio license|performance-data|performance data/i);
  });
  it("keeps the new fixer-upper position non-guaranteeing", () => {
    const editable = readFileSync("tools/cw_6af8624c_prompt.txt", "utf8");
    expect(editable).toContain("6 is the quicker fixer-upper");
    expect(editable).toContain("never as a guarantee");
    expect(SIX_SYSTEM_PROMPT).toBe(editable.replace(/\r\n/g, "\n"));
  });
});
