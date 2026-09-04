"use client";

import { ContactStatusCard } from "../../src/components/ContactStatusCard";
import { DormantStageControls } from "../../src/components/StageControls";
import type { BuildInterestState } from "../../src/lib/buildInterestFlow";

// ---------------------------------------------------------------------------
// FREE EYES ON THE CAPTURE CARD.
//
// The card only exists inside a live session, and a live session is real money
// (a click on [data-aiasap-early-start="1"] mints; nothing else on the page
// does). So every round of "is it right yet?" used to cost a ride. This route
// mounts the same component in a chosen state with no session, no provider and
// no avatar, so the card can be measured and screenshotted for nothing.
//
// It carries no start control and no early-start attribute, so loading it or
// clicking anywhere on it cannot mint. Dev only - the page 404s in production.
//
// The dormant control cluster is here too, with the REAL stage variables read
// off the live front door, so "the box covers the top two buttons" (G, ride
// cb2dde76) can be measured instead of eyeballed.
// ---------------------------------------------------------------------------

// Placeholder, not a real address: this repo is public and git history is
// permanent. Same seven-letter shape as the address it replaced, so the card
// still shrinks and wraps exactly as it does on a real ride.
const EMAIL = "example@pm.me";
const PHONE = "4105550123";

export const FIXTURE_STATES: Record<string, BuildInterestState> = {
  contact_method: { stage: "contact_method", method: null, value: null },
  // G, 19:41: "the email box just came up way too early... it should not have
  // come up yet either." An empty capture shows NOTHING.
  contact_capture: { stage: "contact_capture", method: "email", value: null },
  // ...and it joins in the moment there are heard characters to show.
  contact_capture_partial: { stage: "contact_capture", method: "email", value: "sgdie" },
  confirming: { stage: "confirming", method: "email", value: EMAIL },
  permission: { stage: "permission", method: "email", value: EMAIL },
  permission_phone: { stage: "permission", method: "phone", value: PHONE },
  permission_long: {
    stage: "permission",
    method: "email",
    value: "wildworkslandscaping@gmail.com",
  },
  saving: { stage: "saving", method: "email", value: EMAIL },
  submitted: { stage: "submitted", method: "email", value: EMAIL },
  failed: { stage: "failed", method: "email", value: EMAIL },
  // Controls with NO card up - the baseline the cover is measured against.
  none: { stage: "exploring", method: null, value: null },
};

export function ContactCardFixture({ stage }: { stage: string }) {
  const state = FIXTURE_STATES[stage] ?? FIXTURE_STATES.permission;
  return (
    <div
      data-contact-card-fixture={stage}
      style={{
        // Deliberately NO --stage-* here. globals.css sets them on :root for
        // every breakpoint, so the cluster and the card land exactly where
        // they do on the real front door. An earlier version copied the
        // phone values onto this wrapper and moved the whole cluster 29px,
        // which made the cover measurement lie.
        minHeight: "100vh",
        background: "linear-gradient(#3a2108, #1a0f04)",
      }}
    >
      <p
        data-fixture-label="1"
        style={{
          position: "fixed",
          top: 8,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#d7a05a",
          font: "700 12px ui-monospace, monospace",
          letterSpacing: "0.08em",
        }}
      >
        {stage}
      </p>
      <DormantStageControls />
      <ContactStatusCard state={state} onStep={() => {}} />
    </div>
  );
}
