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
});