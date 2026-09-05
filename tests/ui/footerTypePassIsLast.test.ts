import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

/**
 * G, 2026-09-04: "make the legal text smaller ... and WildWorks the website dot
 * live and the phone number make them larger ... taller, wider, more dominant",
 * on everything except mobile, iPad included.
 *
 * THE TRAP THIS GUARDS: the block was first written in the middle of the file
 * and changed NOTHING. A @media query adds no specificity, so the later
 * unscoped `--public-contact-height: 44px` and `font-size: 23.1px !important`
 * won purely on source order. Measured on the real page, before and after -
 * the rules existed and simply lost. Keep this block last.
 */
describe("footer type pass", () => {
  it("sits after the declarations it is meant to override", () => {
    const pass = css.indexOf("FOOTER TYPE PASS - MUST STAY LAST");
    expect(pass).toBeGreaterThan(-1);
    // Match the real DECLARATIONS, not the same names quoted in this block's
    // own comment - the first version of this guard matched its own prose.
    expect(pass).toBeGreaterThan(css.lastIndexOf("--public-contact-height: 44px;"));
    expect(pass).toBeGreaterThan(css.lastIndexOf("font-size: 23.1px !important;"));
    expect(pass).toBeGreaterThan(css.lastIndexOf("transform: translateY(2px) scaleX(0.909091)"));
  });

  it("quiets Legal and enlarges the contact pair from 768px up", () => {
    const tail = css.slice(css.indexOf("FOOTER TYPE PASS - MUST STAY LAST"));
    expect(tail).toContain("@media (min-width: 768px)");
    expect(tail).toContain("font-size: 15px !important");   // Legal, was 19.8px
    expect(tail).toContain("font-size: 29px !important");   // contact, was 23.1px
    expect(tail).toContain("scaleX(1)");                    // the 0.909 squeeze is released
    expect(tail).toContain("font-weight: 700");
  });

  it("leaves the approved 44px touch row alone", () => {
    // Growing the row to 52px pushed the pair into Legal - only ~73px exist
    // below the rim for both. Dominance comes from type, not the hit box.
    const tail = css.slice(css.indexOf("FOOTER TYPE PASS - MUST STAY LAST"));
    expect(tail).not.toContain("--public-contact-height: 52px");
  });

  it("does not touch phone sizing", () => {
    // Only the footer pass itself is under test. Later "MUST STAY LAST" blocks
    // (phone framing, open-control sizing, chest anchor) legitimately carry
    // phone rules of their own and none of them restyle the footer.
    const start = css.indexOf("FOOTER TYPE PASS - MUST STAY LAST");
    const next = css.indexOf("MUST STAY LAST", start + 40);
    const block = css.slice(start, next === -1 ? undefined : next);
    expect(block).not.toContain("max-width: 767px");
    expect(block).not.toContain("aiasap-phone-portrait-canvas");
  });
});
