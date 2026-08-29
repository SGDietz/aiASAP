/**
 * TURNING A FINISHED LEDGER INTO THE BUILD CARD.
 *
 * buildCard.ts held the rules - the 350-word cap, the twelve sections, the
 * banned categories - and nothing called any of it. So the summary that is
 * supposed to replace the transcript did not exist, which made 6's promise
 * ("nobody reads it line by line, they only get a short summary") untrue at
 * the exact moment it is doing its job: buying somebody's honesty.
 *
 * This is what makes that sentence true.
 *
 * WHY THE LEDGER AND NOT THE TRANSCRIPT. The ledger already knows which
 * answers the person actually SAID and which were guessed. Feeding raw
 * conversation to a summariser throws that away, and a guess that reads like a
 * fact is how somebody's business ends up described wrongly on their own
 * public page. Everything below carries its confidence through.
 */

import { OPENAI_API_KEY } from "../../../app/api/secrets";
import { buildCardPrompt, checkBuildCard } from "../buildCard";
import type { BuildCardCheck } from "../buildCard";
import { ALL_PARTS, PART_NAMES, BEAT_SEPARATOR } from "./ledger";
import type { Ledger } from "./ledger";

const CARD_MODEL = process.env.OPENAI_CARD_MODEL || "gpt-4o";

/**
 * The ledger as text the summariser can read.
 *
 * MISSING is stated out loud rather than left blank. A blank section invites
 * the model to fill it in from nowhere; the word MISSING tells it not to.
 */
export function renderLedgerForCard(ledger: Ledger): string {
  const lines: string[] = [];
  for (const p of ALL_PARTS) {
    const rec = ledger.parts[p];
    const keys = Object.keys(rec.slots);
    lines.push(`## PART ${p} - ${PART_NAMES[p]}`);
    if (keys.length === 0) {
      lines.push("MISSING - they never answered this.");
      lines.push("");
      continue;
    }
    for (const k of keys) {
      const slot = rec.slots[k];
      if (!slot?.value) continue;
      const items = slot.value.split(BEAT_SEPARATOR).filter(Boolean);
      const body = items.length > 1 ? items.map((i) => `\n    - ${i}`).join("") : ` ${items[0]}`;
      lines.push(`- ${k} [${slot.confidence}]:${body}`);
    }
    if (rec.state === "moved_on_thin") {
      lines.push("(This part came out thin and was not pushed again.)");
    }
    lines.push("");
  }

  // The one permission that changes what may be BUILT, not just what is known.
  lines.push(
    ledger.publishOk
      ? "PUBLISH: they agreed their contact details may go on a public page."
      : "PUBLISH: they did NOT agree to their contact details going on a public page. DO-NOT-CALL must say so.",
  );
  return lines.join("\n");
}

export type GeneratedBuildCard = {
  card: string;
  check: BuildCardCheck;
};

/**
 * Write the card. Returns null rather than throwing - this runs after a reply
 * has already gone out to a person, and a summariser failing must never
 * surface in a conversation.
 */
export async function generateBuildCard(
  ledger: Ledger,
): Promise<GeneratedBuildCard | null> {
  if (!OPENAI_API_KEY) return null;

  const body = renderLedgerForCard(ledger);
  // Nothing to summarise is not a card worth sending. Guards against an empty
  // card landing in G's inbox looking like a finished interview.
  if (!body.includes("[SAID]")) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: CARD_MODEL,
        // Low but not zero: the card is prose for a human, and dead-flat
        // output reads like a form. The facts come from the ledger either way.
        temperature: 0.2,
        messages: [
          { role: "system", content: buildCardPrompt() },
          {
            role: "user",
            content: `Here is everything recorded from their interview.\n\n${body}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("generateBuildCard: openai", res.status);
      return null;
    }
    const data = await res.json();
    const card = data?.choices?.[0]?.message?.content;
    if (typeof card !== "string" || !card.trim()) return null;

    // The tripwire runs here rather than at the caller so a card can never be
    // sent without having been measured. A card that broke the caps still goes
    // out - Scott needs the lead - but it goes out with its problems named,
    // because a memo quietly calling itself a summary is the failure Ara
    // warned about.
    return { card: card.trim(), check: checkBuildCard(card) };
  } catch (e) {
    console.error("generateBuildCard threw", e);
    return null;
  }
}
