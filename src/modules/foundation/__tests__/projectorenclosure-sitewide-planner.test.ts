jest.mock("server-only", () => ({}));

import { classifyDisposition, contentSha256, contentTokenOverlap, createSnapshotId, detectClaimFlags, findOwnershipConflicts, inferIntent, mapProductAuthority, parseContentSignals, scoreOpportunity, type SitewideInventoryAsset } from "../projectorenclosure-sitewide-planner";

describe("ProjectorEnclosure sitewide planner", () => {
  test("parses headings, links, media, words, and stable hashes", () => {
    const html = '<h1>Outdoor Movie</h1><p>Plan a projector enclosure.</p><a href="https://projectorenclosure.com/contact/">Contact</a><a href="https://example.com/">External</a><img src="hero.jpg" alt="Hero">';
    expect(parseContentSignals(html)).toMatchObject({ headings: [{ level: 1, text: "Outdoor Movie" }], internalLinks: ["https://projectorenclosure.com/contact/"], externalLinks: ["https://example.com/"], mediaUrls: ["hero.jpg"], wordCount: 8 });
    expect(contentSha256(html)).toMatch(/^[a-f0-9]{64}$/);
  });

  test("detects unsupported claim families and maps verified product authority", () => {
    expect(detectClaimFlags("Weatherproof IP-rated lockable enclosure fits every projector")).toEqual(["ENVIRONMENTAL_ABSOLUTE", "SECURITY_CLAIM", "COMPATIBILITY_CLAIM"]);
    expect(mapProductAuthority({ title: "Homeline", slug: "homeline-projector-enclosure", text: "fan-cooled" })).toEqual({ productIds: ["prod-ssi-homeline-projector-enclosure", "prod-ssi-fan-cooled-projector-enclosures"], state: "VERIFIED" });
    expect(mapProductAuthority({ title: "Defender", slug: "defender", text: "commercial" }).state).toBe("PRODUCT_AUTHORITY_MISSING");
  });

  test("preserves certified ownership and classifies deterministic remediation", () => {
    expect(inferIntent({ sourceId: 12809, title: "Anything", slug: "anything", yoastFocus: "", text: "" })).toEqual({ intent: "broad commercial architectural projection mapping", confidence: "CERTIFIED" });
    expect(classifyDisposition({ status: "publish", robots: { index: "index" }, wordCount: 500, claimFlags: ["SECURITY_CLAIM"], brokenLinks: [], trackedLinks: [], mediaQuality: "STRONG", ownershipConfidence: "HIGH", productAuthorityState: "VERIFIED", duplicate: false, redirect: false })).toMatchObject({ disposition: "ENHANCE", safetyClass: "A" });
    expect(classifyDisposition({ status: "publish", robots: { index: "index" }, wordCount: 500, claimFlags: [], brokenLinks: [], trackedLinks: [], mediaQuality: "STRONG", ownershipConfidence: "HIGH", productAuthorityState: "PRODUCT_AUTHORITY_MISSING", duplicate: false, redirect: false })).toMatchObject({ disposition: "PRODUCT_AUTHORITY_MISSING", safetyClass: "D" });
    expect(classifyDisposition({ status: "publish", robots: { index: "index" }, wordCount: 20, claimFlags: [], brokenLinks: [], trackedLinks: [], mediaQuality: "MISSING", ownershipConfidence: "LOW", productAuthorityState: "NOT_APPLICABLE", duplicate: false, redirect: false, unrelated: true })).toMatchObject({ disposition: "RETIRE", safetyClass: "C" });
  });

  test("scores opportunities and rejects unbounded dimensions", () => {
    expect(scoreOpportunity({ searchRelevance: 8, audienceSize: 7, productFit: 9, commercialIntent: 8, escalationValue: 9, internalLinkLeverage: 7, ecosystemAdjacency: 8, competitionGap: 6, authorityReadiness: 8 })).toBe(70);
    expect(() => scoreOpportunity({ searchRelevance: 11, audienceSize: 0, productFit: 0, commercialIntent: 0, escalationValue: 0, internalLinkLeverage: 0, ecosystemAdjacency: 0, competitionGap: 0, authorityReadiness: 0 })).toThrow();
  });

  test("finds indexable ownership conflicts and creates stable snapshot IDs", () => {
    const asset = (sourceId: number): SitewideInventoryAsset => ({ inventoryId: `pe-posts-${sourceId}`, sourceId, collection: "posts", status: "publish", title: "A", slug: `a-${sourceId}`, url: `https://projectorenclosure.com/a-${sourceId}/`, canonical: `https://projectorenclosure.com/a-${sourceId}/`, robots: { index: "index" }, yoastFocus: "", yoastTitle: "", yoastMeta: "", featuredMediaId: 0, contentHash: String(sourceId), wordCount: 500, headings: [], internalLinks: [], externalLinks: [], mediaUrls: [], publishedAt: null, modifiedAt: null, parentId: 0, publicHttpStatus: 200, redirect: { exists: false, destination: null }, apparentIntent: "same intent", ownershipConfidence: "HIGH", competingAssetIds: [], productIds: [], productAuthorityState: "NOT_APPLICABLE", claimFlags: [], brokenLinks: [], trackedLinks: [], mediaQuality: "STRONG", disposition: "KEEP", safetyClass: "A", recommendedActions: [], risk: "LOW", dependencies: [], authorityTimestamp: "2026-09-04T00:00:00.000Z" });
    expect(findOwnershipConflicts([asset(1), asset(2)])).toEqual([{ intent: "same intent", assetIds: [1, 2] }]);
    expect(createSnapshotId("2026-09-04T00:00:00.000Z", [asset(2), asset(1)])).toBe(createSnapshotId("2026-09-04T12:00:00.000Z", [asset(1), asset(2)]));
  });

  test("requires strong content evidence for duplicate classification", () => {
    expect(contentTokenOverlap("projector enclosure planning for airflow and fitment", "projector enclosure planning for airflow and fitment")).toBe(1);
    expect(contentTokenOverlap("projector enclosure planning for airflow", "projector enclosure products for museums")).toBeLessThan(0.9);
  });
});