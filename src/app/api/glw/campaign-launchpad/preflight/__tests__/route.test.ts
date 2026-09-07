import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseGlwCampaignLaunchpadRequest } from "../route";

describe("Campaign Launchpad preflight API validation", () => {
  test("accepts a bounded nationwide request", () => {
    expect(parseGlwCampaignLaunchpadRequest({ reach: "NATIONWIDE", productUrl: "https://example.com/widget" })).toMatchObject({
      input: { reach: "NATIONWIDE", productUrl: "https://example.com/widget" }, error: null,
    });
  });

  test("rejects unknown reach values", () => {
    expect(parseGlwCampaignLaunchpadRequest({ reach: "EVERYWHERE", productUrl: "https://example.com/widget" }).input).toBeNull();
  });

  test("rejects non-network and credential-bearing URLs", () => {
    expect(parseGlwCampaignLaunchpadRequest({ reach: "NATIONWIDE", productUrl: "file:///etc/passwd" }).input).toBeNull();
    expect(parseGlwCampaignLaunchpadRequest({ reach: "NATIONWIDE", productUrl: "https://user:pass@example.com/widget" }).input).toBeNull();
  });

  test("keeps the preflight route free of campaign and WordPress mutations", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/campaign-launchpad/preflight/route.ts"), "utf8");
    expect(source).not.toMatch(/\.create\(|\.update\(|\.delete\(|publicationIntent:\s*["']publish|method:\s*["'](?:PUT|PATCH|DELETE)["']/);
    expect(source).toContain("glwPageExecutionRepository.list()");
    expect(source).toContain("readGlwTargetPreflight");
  });
});