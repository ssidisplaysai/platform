jest.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOUSTON_APPROVED_PREVIEW_COMMIT, HOUSTON_H1, HOUSTON_SEO, evaluateHoustonThemeIntegration, freezeHoustonApprovedPreviewIdentity } from "../houston-approved-preview-draft";
import { evaluateHoustonPreviewDraftDrift, renderApprovedHoustonWordPress } from "../houston-approved-preview-render";

const roles = ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"];
const local = { bundleId: "local-theming-houston-southeast-texas-v1", context: { contextId: "local-context-houston-southeast-texas-r1", identity: { pageId: "target-campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities-tx-houston", jobId: null }, facts: [] }, links: { graphId: "local-links-houston-southeast-texas-r1", links: [{ linkId: "product", url: "https://projectorenclosure.com/fan-cooled-projector-enclosures/", role: "INTERNAL_PRODUCT", anchorIntent: "Product", reason: "Product" }, { linkId: "quote", url: "https://projectorenclosure.com/contact-us-projection-enclosure/", role: "INTERNAL_CONVERSION", anchorIntent: "Quote", reason: "Quote" }, { linkId: "climate-controlled", url: "https://projectorenclosure.com/climate-controlled-projector-enclosures/", role: "INTERNAL_CAPABILITY", anchorIntent: "Climate", reason: "Climate" }, { linkId: "outdoor", url: "https://projectorenclosure.com/ip65-projector-enclosures-for-outdoor-applications/", role: "INTERNAL_CAPABILITY", anchorIntent: "Outdoor", reason: "Outdoor" }] }, theme: { profileId: "local-theme-houston-southeast-texas-r1", localizationLevel: 2 }, applications: { authorityId: "applications-houston-southeast-texas-r1" }, composition: { planId: "composition-plan-houston-market-informed-v1", validationState: "READY_FOR_OWNER_REVIEW" }, media: roles.map((role, index) => ({ role, mediaId: `houston-${index}`, source: index ? "GENERATED_CANDIDATE" : "APPROVED_EXISTING", sha256: index ? String(index).repeat(64) : "685495793be84b3a9d1a7e902087d63ae7a636e2042e6c0d592f5ba83e767078" })) };
const market = { bundleId: "market-match-houston-southeast-texas-v1", pageStrategy: { pageId: local.context.identity.pageId, primaryApplication: "COMMERCIAL_AV", supportingApplications: ["EVENT_VENUE", "PROJECTION_MAPPING"], crossSellCatalogItemIds: [] }, intelligence: { intelligenceId: "market-intelligence-houston-southeast-texas-r1" }, opportunities: [{ confidence: "HIGH", applicationId: "COMMERCIAL_AV", whyProduct: "Indoor, covered, or mild environments." }, { confidence: "MEDIUM", applicationId: "EVENT_VENUE", whyProduct: "Covered venue fit review." }, { confidence: "MEDIUM", applicationId: "PROJECTION_MAPPING", whyProduct: "Bounded supporting use." }] };
const visualCapture = (viewportWidth: number) => ({ viewportWidth, horizontalOverflow: 0, media: roles.map((semanticRole) => ({ semanticRole, rendered: true })) });
const visual = { bundleId: local.bundleId, certificationId: "houston-preview-certification", state: "READY_FOR_OWNER_REVIEW", captures: [1440, 1024, 768, 375].map(visualCapture) };

describe("Houston approved preview to draft", () => {
  test("binds owner approval to the exact approved preview commit and identities", () => {
    expect(freezeHoustonApprovedPreviewIdentity({ local: local as never, market: market as never, visual: visual as never, previewCommit: HOUSTON_APPROVED_PREVIEW_COMMIT })).toMatchObject({ previewCommit: HOUSTON_APPROVED_PREVIEW_COMMIT, localContextId: "local-context-houston-southeast-texas-r1", localLinkGraphId: "local-links-houston-southeast-texas-r1", compositionPlanId: "composition-plan-houston-market-informed-v1" });
  });

  test("rejects stale preview commit, strategy, and visual evidence", () => {
    expect(() => freezeHoustonApprovedPreviewIdentity({ local: local as never, market: market as never, visual: visual as never, previewCommit: "wrong" })).toThrow("HOUSTON_OWNER_APPROVAL_IDENTITY_STALE");
    expect(() => freezeHoustonApprovedPreviewIdentity({ local: local as never, market: { ...market, pageStrategy: { ...market.pageStrategy, primaryApplication: "PROJECTION_MAPPING" } } as never, visual: visual as never, previewCommit: HOUSTON_APPROVED_PREVIEW_COMMIT })).toThrow("HOUSTON_OWNER_APPROVAL_IDENTITY_STALE");
    expect(() => freezeHoustonApprovedPreviewIdentity({ local: local as never, market: market as never, visual: { ...visual, captures: visual.captures.slice(1) } as never, previewCommit: HOUSTON_APPROVED_PREVIEW_COMMIT })).toThrow("HOUSTON_OWNER_APPROVAL_IDENTITY_STALE");
  });

  test("renders exact Houston strategy, climate boundary, links, roles, and one H1", () => {
    const html = renderApprovedHoustonWordPress({ local: local as never, market: market as never, mediaUrls: { PRODUCT_AUTHORITY: "https://example.com/product.webp", CONTEXTUAL_IN_USE: "https://example.com/in-use.jpg", APPLICATION_EXPERIENCE: "https://example.com/application.jpg", LOCAL_CONTEXTUAL_ATMOSPHERE: "https://example.com/atmosphere.jpg" } });
    expect((html.match(/<h1\b/g) ?? [])).toHaveLength(1); expect(html).toContain(HOUSTON_H1); expect(html).toContain('data-market-primary="COMMERCIAL_AV"'); expect(html).toContain("EVENT VENUE"); expect(html).toContain("PROJECTION MAPPING"); expect(html).toContain("climate-controlled"); expect(html).toContain("humidity"); for (const role of roles) expect(html).toContain(`data-media-role="${role}"`); expect(html).not.toMatch(/our Houston office|Houston customer|actual Houston installation/i);
  });

  test("requires exact theme-integrated geometry at all four viewports", () => {
    const captures = ["DESKTOP_1440", "DESKTOP_1024", "TABLET_768", "MOBILE_375"].map((viewport) => ({ viewport, horizontalOverflow: 0, mediaRolesRendered: roles, themeIntegration: { visibleH1Count: 1, visibleH1Texts: [HOUSTON_H1], duplicateThemeTitleVisible: false, duplicateThemeFeaturedMediaVisible: false, globalHeaderPresent: true, globalFooterPresent: true, headerActionsContained: true } }));
    expect(evaluateHoustonThemeIntegration(captures as never)).toEqual({ state: "PASS", failures: [] });
    expect(evaluateHoustonThemeIntegration(captures.map((item) => ({ ...item, themeIntegration: { ...item.themeIntegration, visibleH1Texts: ["Protected projection for Houston’s indoor and covered commercial spaces."] } })) as never)).toEqual({ state: "PASS", failures: [] });
    expect(evaluateHoustonThemeIntegration(captures.map((item) => item.viewport === "DESKTOP_1024" ? { ...item, horizontalOverflow: 1 } : item) as never).failures).toContain("DESKTOP_1024_OVERFLOW");
  });

  test("classifies exact approved body as minor theme-shell drift and rejects material changes", () => {
    const valid = { expectedBodyHash: "a", actualBodyHash: "a", expectedLinks: ["https://example.com"], actualLinks: ["https://example.com"], expectedRoles: roles, actualRoles: roles, actualHtml: '<main data-market-primary="COMMERCIAL_AV">EVENT VENUE PROJECTION MAPPING climate-controlled humidity covered</main>' };
    expect(evaluateHoustonPreviewDraftDrift(valid).drift).toBe("MINOR"); expect(evaluateHoustonPreviewDraftDrift({ ...valid, actualLinks: [] }).drift).toBe("MATERIAL"); expect(evaluateHoustonPreviewDraftDrift({ ...valid, actualBodyHash: "b" }).drift).toBe("CRITICAL");
  });

  test("uses direct CREATE with exact parent, SEO, theme title suppression, and duplicate prevention", () => {
    const service = readFileSync(join(process.cwd(), "src/modules/glw/houston-approved-preview-draft-service.ts"), "utf8");
    expect(service).toContain('operation: "CREATE"'); expect(service).toContain("parentId: 13083"); expect(service).toContain("HOUSTON_WORDPRESS_COLLISION"); expect(service).toContain("HOUSTON_SEO"); expect(service).toContain("featured_media: HOUSTON_PRODUCT_MEDIA_ID"); expect(service).toContain('hide_title: "yes"'); expect(service).toContain("HOUSTON_DRAFT_READBACK_MISMATCH"); expect(HOUSTON_SEO.seoTitle).toContain("Houston");
  });

  test("contains no scheduler, execution, campaign transition, or publication path", () => {
    const service = readFileSync(join(process.cwd(), "src/modules/glw/houston-approved-preview-draft-service.ts"), "utf8"); const route = readFileSync(join(process.cwd(), "src/app/api/glw/houston-approved-draft/route.ts"), "utf8");
    expect(service).not.toMatch(/leaseGlwCampaignTargets|reconcileGlwCampaignTarget|glwPageExecutionRepository|publishGenesisWordPressDraft|n8n/i); for (const marker of ["schedulerInvoked: false", "dispatchPerformed: false", "leaseCreated: false", "jobCreated: false", "executionCreated: false", "publicationPerformed: false", "campaignMutationPerformed: false"]) expect(`${service}\n${route}`).toContain(marker);
  });

  test("exposes comparison evidence with no publish control", () => {
    const ui = readFileSync(join(process.cwd(), "src/modules/glw/GlwHoustonDraftComparison.tsx"), "utf8"); expect(ui).toContain("Approved Houston preview vs actual theme-integrated draft"); expect(ui).toContain("OWNER DRAFT REVIEW REQUIRED"); expect(ui).toContain("NO PUBLISH CONTROL"); expect(ui).not.toMatch(/>Publish</);
  });
});
