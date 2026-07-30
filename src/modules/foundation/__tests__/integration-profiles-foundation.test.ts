import {
  createIntegrationProfile,
  evaluateProfileReadiness,
  getEffectiveProfileAssignments,
  getProfileUsage,
  listIntegrationProfiles,
  resetIntegrationProfileRepositoryForTests,
  upsertProfileAssignment,
  validateProfileAssignmentIntegrity,
} from "@/modules/foundation/integration-profile-repository";

describe("GCP-0002F integration profiles foundation", () => {
  beforeEach(() => {
    resetIntegrationProfileRepositoryForTests();
  });

  test("fixture-backed profile registry includes all required profile types", () => {
    const profiles = listIntegrationProfiles();
    const types = new Set(profiles.map((profile) => profile.profileType));

    expect(types.has("publishing")).toBe(true);
    expect(types.has("wordpress")).toBe(true);
    expect(types.has("workflow")).toBe(true);
    expect(types.has("prompt")).toBe(true);
    expect(types.has("image")).toBe(true);
    expect(types.has("seo")).toBe(true);
    expect(types.has("brand")).toBe(true);
    expect(types.has("analytics")).toBe(true);
  });

  test("profile creation rejects secret-like values", () => {
    const result = createIntegrationProfile({
      profileId: "profile-test-secret",
      profileType: "workflow",
      organizationId: "led-display-warehouse",
      profileName: "Invalid Secret Profile",
      description: null,
      status: "active",
      enabled: true,
      version: "1.0.0",
      assignedSiteIds: [],
      defaultForOrganization: false,
      references: {
        credentialReference: "raw_password_123",
        workflowReference: "workflowref-x",
        promptReference: null,
        providerReference: "provider-n8n",
        brandReference: null,
        workflowProfileReference: null,
        wordpressProfileReference: null,
        promptProfileReference: null,
        imageProfileReference: null,
        seoProfileReference: null,
        analyticsProfileReference: null,
        titleStrategyReference: null,
        metaStrategyReference: null,
        schemaReference: null,
        openGraphReference: null,
        slugStrategyReference: null,
        canonicalPolicyReference: null,
        logoReference: null,
        colorPaletteReference: null,
        typographyReference: null,
        voiceReference: null,
        defaultCtaReference: null,
        assetReference: null,
        baseUrlReference: null,
        authorReference: null,
        categoryReference: null,
        postStatusReference: null,
        featuredImagePolicyReference: null,
        imageInsertionPolicyReference: null,
        yoastPolicyReference: null,
        inputContractReference: null,
        outputContractReference: null,
        retryPolicyReference: null,
        executionTimeoutReference: null,
        environmentReference: null,
      },
      notes: null,
    });

    expect(result.validation.valid).toBe(false);
  });

  test("wordpress readiness blocks when credential reference is missing", () => {
    const created = createIntegrationProfile({
      profileId: "profile-wordpress-missing-credential",
      profileType: "wordpress",
      organizationId: "led-display-warehouse",
      profileName: "WordPress Missing Credential",
      description: null,
      status: "active",
      enabled: true,
      version: "1.0.0",
      assignedSiteIds: ["site-led-display-warehouse-production"],
      defaultForOrganization: false,
      references: {
        credentialReference: null,
        workflowReference: null,
        promptReference: null,
        providerReference: "provider-wordpress",
        brandReference: null,
        workflowProfileReference: null,
        wordpressProfileReference: null,
        promptProfileReference: null,
        imageProfileReference: null,
        seoProfileReference: null,
        analyticsProfileReference: null,
        titleStrategyReference: null,
        metaStrategyReference: null,
        schemaReference: null,
        openGraphReference: null,
        slugStrategyReference: null,
        canonicalPolicyReference: null,
        logoReference: null,
        colorPaletteReference: null,
        typographyReference: null,
        voiceReference: null,
        defaultCtaReference: null,
        assetReference: null,
        baseUrlReference: "urlref-ledw-wordpress-api",
        authorReference: null,
        categoryReference: null,
        postStatusReference: null,
        featuredImagePolicyReference: null,
        imageInsertionPolicyReference: null,
        yoastPolicyReference: null,
        inputContractReference: null,
        outputContractReference: null,
        retryPolicyReference: null,
        executionTimeoutReference: null,
        environmentReference: null,
      },
      notes: null,
    });

    expect(created.validation.valid).toBe(true);
    const readiness = evaluateProfileReadiness("profile-wordpress-missing-credential");
    expect(readiness?.ready).toBe(false);
    expect(
      readiness?.blockers.some((blocker) => blocker.includes("credential reference")),
    ).toBe(true);
  });

  test("publishing readiness requires linked profile assignments", () => {
    const readiness = evaluateProfileReadiness("profile-publishing-ledw-default");
    expect(readiness).toBeDefined();
    expect(readiness?.ready).toBe(true);
  });

  test("assignment inheritance resolves from site to product", () => {
    const assignments = getEffectiveProfileAssignments({
      organizationId: "led-display-warehouse",
      targetType: "product",
      targetId: "prod-outdoor-led-video-wall",
      siteId: "site-led-display-warehouse-production",
    });

    const inheritedPublishing = assignments.find((assignment) => assignment.profileType === "publishing");
    expect(inheritedPublishing?.effectiveProfileId).toBe("profile-publishing-ledw-default");
    expect(inheritedPublishing?.inheritanceSource).toBe("site");
  });

  test("direct assignment overrides inherited profile", () => {
    const before = getEffectiveProfileAssignments({
      organizationId: "led-display-warehouse",
      targetType: "product",
      targetId: "prod-indoor-led-video-wall",
      siteId: "site-led-display-warehouse-production",
    });

    expect(before.find((entry) => entry.profileType === "prompt")?.effectiveProfileId).toBe(
      "profile-prompt-technical-datasheet",
    );

    const upserted = upsertProfileAssignment({
      organizationId: "led-display-warehouse",
      targetType: "product",
      targetId: "prod-indoor-led-video-wall",
      siteId: "site-led-display-warehouse-production",
      profileType: "prompt",
      profileId: "profile-prompt-commercial-product",
      notes: null,
    });

    expect(upserted.validation.valid).toBe(true);

    const after = getEffectiveProfileAssignments({
      organizationId: "led-display-warehouse",
      targetType: "product",
      targetId: "prod-indoor-led-video-wall",
      siteId: "site-led-display-warehouse-production",
    });

    expect(after.find((entry) => entry.profileType === "prompt")?.effectiveProfileId).toBe(
      "profile-prompt-commercial-product",
    );
    expect(after.find((entry) => entry.profileType === "prompt")?.inheritanceSource).toBe("direct");
  });

  test("profile usage reports direct and inherited targets", () => {
    const usage = getProfileUsage("profile-publishing-ledw-default");
    expect(usage.length).toBeGreaterThan(0);
    expect(usage.some((entry) => entry.targetType === "site" && !entry.inherited)).toBe(true);
    expect(usage.some((entry) => entry.targetType === "product" && entry.inherited)).toBe(true);
  });

  test("assignment integrity validation passes for baseline fixtures", () => {
    const validation = validateProfileAssignmentIntegrity();
    expect(validation.valid).toBe(true);
  });
});
