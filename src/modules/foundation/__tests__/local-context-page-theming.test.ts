import {
  APPLICATION_AUTHORITY_CONTRACT,
  LOCAL_CONTEXT_CONTRACT,
  LOCAL_LINK_GRAPH_CONTRACT,
  deriveLocalThemeProfile,
  validateApplicationAuthority,
  validateLocalContext,
  validateLocalLinkGraph,
  validateLocalizedMedia,
  validateLocalThemeProfile,
  type SitePageApplicationAuthority,
  type SitePageLocalContext,
} from "../local-context-page-theming";

const identity = { organizationId: "org", siteId: "site", pageId: "page", jobId: "job", pageRevisionIdentity: "revision-2" };
const evidence = { evidenceId: "official-climate", url: "https://www.weather.gov/lot/", title: "Local climate", publisher: "National Weather Service", sourceClass: "GOVERNMENT" as const, retrievedAt: "2026-09-13T00:00:00.000Z", verifiedAt: "2026-09-13T00:00:00.000Z", httpStatus: 200, observedClaim: "Official regional climate observations are available." };
const context: SitePageLocalContext = { contract: LOCAL_CONTEXT_CONTRACT, schemaVersion: 1, contextId: "context-chicago", identity, geography: { city: "Chicago", state: "Illinois", region: "Great Lakes", countryCode: "US" }, researchRevision: 1, evidence: [evidence], facts: [{ factId: "climate", kind: "CLIMATE_ENVIRONMENT", statement: "Regional planning should use official climate observations.", evidenceIds: [evidence.evidenceId] }], prohibitedInferences: ["local office", "customer installation"], createdAt: "2026-09-13T00:00:00.000Z" };
const applications: SitePageApplicationAuthority = { contract: APPLICATION_AUTHORITY_CONTRACT, schemaVersion: 1, authorityId: "applications-chicago", identity, productId: "product", researchRevision: 1, applications: [{ applicationId: "COMMERCIAL_AV", label: "Commercial AV", compatibility: "SUPPORTED", relationship: "The approved product protects projection equipment used in commercial AV environments.", evidenceIds: [evidence.evidenceId], internalDestinationUrl: null }], createdAt: "2026-09-13T00:00:00.000Z" };

describe("Genesis local context and page theming", () => {
  test("represents a second geography without Dallas or Texas logic", () => {
    expect(validateLocalContext(context)).toMatchObject({ geography: { city: "Chicago", region: "Great Lakes" }, researchRevision: 1 });
    expect(validateApplicationAuthority(applications, context).applications[0]).toMatchObject({ applicationId: "COMMERCIAL_AV", compatibility: "SUPPORTED" });
  });

  test("requires provenance and rejects stale context, graph, and application authority", () => {
    expect(() => validateLocalContext({ ...context, facts: [{ ...context.facts[0], evidenceIds: [] }] })).toThrow("LOCAL_FACT_PROVENANCE_REQUIRED");
    expect(() => validateLocalContext(context, "revision-3")).toThrow("LOCAL_CONTEXT_PAGE_REVISION_STALE");
    const graph = { contract: LOCAL_LINK_GRAPH_CONTRACT, schemaVersion: 1 as const, graphId: "links", identity, researchRevision: 1, links: [{ linkId: "weather", url: evidence.url, destinationIdentity: null, role: "REGIONAL_REFERENCE" as const, anchorIntent: "Regional climate data", reason: "Supports environmental planning.", evidenceIds: [evidence.evidenceId], validation: { state: "VERIFIED" as const, httpStatus: 200, checkedAt: evidence.verifiedAt } }], createdAt: evidence.retrievedAt };
    expect(validateLocalLinkGraph(graph, context).links).toHaveLength(1);
    expect(() => validateLocalLinkGraph({ ...graph, researchRevision: 2 }, context)).toThrow("LOCAL_LINK_GRAPH_AUTHORITY_STALE");
    expect(() => validateLocalLinkGraph({ ...graph, links: [{ ...graph.links[0], validation: { ...graph.links[0].validation, state: "BLOCKED" as const } }] }, context)).toThrow("LOCAL_LINK_UNVERIFIED_OR_UNJUSTIFIED");
    expect(() => validateApplicationAuthority({ ...applications, researchRevision: 2 }, context)).toThrow("APPLICATION_AUTHORITY_STALE");
  });

  test("preserves brand precedence and requires evidence for landmark-level localization", () => {
    const input = { profileId: "theme", context, applications, brandAuthorityReference: "profile-brand-owner", expression: { heroAtmosphere: "Urban commercial architecture", environmentalCharacter: ["dense urban streets"], materialCues: ["steel", "glass"], accentGuidance: "Retain approved brand accents.", visualDensity: "Editorial", terminology: ["regional"], compositionEmphasis: ["product truth"] }, antiClicheTerms: ["sports stereotype"], createdAt: evidence.retrievedAt };
    const profile = deriveLocalThemeProfile({ ...input, localizationLevel: 2 });
    expect(profile.safeguards.brandAuthorityPrecedence).toBe(true);
    expect(() => validateLocalThemeProfile({ ...profile, researchRevision: 2 }, { context, applications })).toThrow("LOCAL_THEME_PROFILE_STALE");
    expect(() => deriveLocalThemeProfile({ ...input, localizationLevel: 2, expression: { ...input.expression, heroAtmosphere: "sports stereotype" } })).toThrow("LOCAL_THEME_CLICHE_PROHIBITED");
    expect(() => deriveLocalThemeProfile({ ...input, localizationLevel: 2, expression: { ...input.expression, heroAtmosphere: "our Chicago office" } })).toThrow("LOCAL_THEME_FALSE_PROXIMITY_PROHIBITED");
    expect(() => deriveLocalThemeProfile({ ...input, localizationLevel: 3 })).toThrow("LOCALIZATION_LEVEL_3_EVIDENCE_REQUIRED");
  });

  test("keeps media roles and claim classes distinct and blocks false proximity", () => {
    const base = { mediaId: "media", source: "GENERATED_CANDIDATE" as const, productTruthReference: "wordpress-media:42", applicationId: null, localContextId: context.contextId, generationPrompt: "Conceptual regional commercial environment; no real installation or customer.", sha256: "a".repeat(64), url: "/preview/media.webp", altText: "Concept visualization of a protected projector in a commercial AV environment", ownerReviewState: "PENDING" as const };
    expect(validateLocalizedMedia({ ...base, role: "CONTEXTUAL_IN_USE", claimClass: "CONCEPTUAL_CONTEXTUAL" }, { context, applications }).role).toBe("CONTEXTUAL_IN_USE");
    expect(validateLocalizedMedia({ ...base, mediaId: "atmosphere", role: "LOCAL_CONTEXTUAL_ATMOSPHERE", claimClass: "ATMOSPHERIC", productTruthReference: null }, { context, applications }).claimClass).toBe("ATMOSPHERIC");
    expect(() => validateLocalizedMedia({ ...base, altText: "Our Dallas office projector installation", role: "CONTEXTUAL_IN_USE", claimClass: "CONCEPTUAL_CONTEXTUAL" }, { context, applications })).toThrow("LOCAL_MEDIA_FALSE_PROXIMITY_CLAIM");
    expect(() => validateLocalizedMedia({ ...base, role: "CONTEXTUAL_IN_USE", claimClass: "CONCEPTUAL_CONTEXTUAL", productTruthReference: null }, { context, applications })).toThrow("LOCAL_IN_USE_PRODUCT_GROUNDING_REQUIRED");
    expect(() => validateLocalizedMedia({ ...base, role: "APPLICATION_EXPERIENCE", claimClass: "APPLICATION_VISUALIZATION", applicationId: "PROJECTION_MAPPING" }, { context, applications })).toThrow("LOCAL_APPLICATION_MEDIA_AUTHORITY_REQUIRED");
    expect(() => validateLocalizedMedia({ ...base, role: "PRODUCT_AUTHORITY", claimClass: "DOCUMENTARY" }, { context, applications })).toThrow("LOCAL_PRODUCT_AUTHORITY_MUST_REMAIN_APPROVED");
  });
});