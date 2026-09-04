import { mkdirSync, writeFileSync } from "node:fs";
import { it } from "vitest";

// A LOOK AT THE REAL EMAIL, not a guess at it. Writes the rendered shell to
// work-output so it can be screenshotted; G asked for the face crop and the
// new tagline on 2026-09-04 and both needed eyes, not assertions.
const OUT = "artifacts/emailpreview";
import { emailShell, emailParagraph, emailDivider, emailFine } from "../src/lib/emailTheme";

it("writes a preview of the aiASAP email shell", () => {
  const html = emailShell({
    title: "aiASAP: we got your details",
    heading: "We got it, Scott.",
    showSix: true,
    align: "center",
    bodyHtml: [
      emailParagraph("This is 6 from aiASAP. We received your details."),
      emailParagraph("<b>Subject:</b> aiASAP conversation details"),
      emailDivider(),
      emailFine("You are getting this because you asked us to reach out during a live conversation with 6 at aiASAP.ai."),
    ].join(""),
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/email-preview.html`, html, "utf8");
});
