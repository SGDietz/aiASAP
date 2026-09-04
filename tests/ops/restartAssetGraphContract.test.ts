import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const helper = readFileSync(
  resolve(__dirname, "../../ops/scheduled/restart_aiasap_dev_3001.ps1"),
  "utf8",
);

describe("protected aiASAP runtime restart contract", () => {
  it("does not treat a 200 root as healthy until every referenced Next asset is 200", () => {
    const rootProbe = helper.indexOf('Say "HTTP $($r.StatusCode) on /');
    const assetProbe = helper.indexOf("$assetRefs = @([regex]::Matches(");
    const finalOk = helper.lastIndexOf('Say "OK"');

    expect(rootProbe).toBeGreaterThan(-1);
    expect(assetProbe).toBeGreaterThan(rootProbe);
    expect(finalOk).toBeGreaterThan(assetProbe);
    expect(helper).toContain("/_next/static/");
    expect(helper).toContain("if ($assetRefs.Count -eq 0)");
    expect(helper).toContain("if ($assetFailures.Count -gt 0)");
    expect(helper).toContain("asset graph $($assetRefs.Count)/$($assetRefs.Count) HTTP 200");
    expect(helper.match(/exit 5/g)?.length).toBe(2);
  });
});
