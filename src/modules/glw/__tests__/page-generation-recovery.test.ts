import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FOUNDATION_PRODUCTS } from "@/modules/foundation/catalog-fixtures";
import { FOUNDATION_SITE_FIXTURES } from "@/modules/foundation/site-fixtures";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  buildLocalGlwGenerationPreview,
  createDefaultGlwGenerationInput,
  createGlwCanonicalPath,
  getGlwCitiesForState,
} from "../page-generation";
import { planGlwPageMatrix } from "../matrix-planner";

const site = adaptSiteForGeneration(FOUNDATION_SITE_FIXTURES[0], 4);
const product = adaptProductForGeneration(FOUNDATION_PRODUCTS[0], site.siteId);

describe("GLW selective page generation recovery", () => {
  test("adapts a current site for generation", () => {
    expect(site.siteId).toBe(FOUNDATION_SITE_FIXTURES[0].siteId);
    expect(site.profileCount).toBe(4);
  });

  test("adapts a current product without creating a parallel catalog", () => {
    expect(product.productId).toBe(FOUNDATION_PRODUCTS[0].productId);
    expect(product.slug).toBe(FOUNDATION_PRODUCTS[0].siteAssignments[0].siteSpecificSlug);
  });

  test("validates a state page request", () => {
    const form = createDefaultGlwGenerationInput(site, product, "state_service", "TX", "");
    const result = buildLocalGlwGenerationPreview({ form, sites: [site], products: [product] });
    expect(result.validation.valid).toBe(true);
    expect(result.request?.plannedOperation).toBe("CREATE_STATE");
  });

  test("validates a city page request", () => {
    const form = createDefaultGlwGenerationInput(site, product, "city_service", "TX", "austin");
    const result = buildLocalGlwGenerationPreview({ form, sites: [site], products: [product] });
    expect(result.validation.valid).toBe(true);
    expect(result.request?.cityName).toBe("Austin");
  });

  test("rejects a city paired with another state", () => {
    const form = createDefaultGlwGenerationInput(site, product, "city_service", "CA", "austin");
    const result = buildLocalGlwGenerationPreview({ form, sites: [site], products: [product] });
    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues.some((issue) => issue.field === "citySlug")).toBe(true);
  });

  test("builds deterministic canonical product, state, and city paths", () => {
    expect(createGlwCanonicalPath({ productSlug: "Indoor LED Video Wall", stateCode: "TX", citySlug: "austin" }))
      .toBe("indoor-led-video-wall/texas/austin");
  });

  test("blocks duplicate matrix targets", () => {
    const statePath = createGlwCanonicalPath({ productSlug: product.slug, stateCode: "TX" });
    const plans = planGlwPageMatrix({ products: [product], stateCodes: ["TX"], citySlugsByState: { TX: [] }, existingPages: [{ canonicalPath: statePath }, { canonicalPath: statePath }] });
    expect(plans[0].action).toBe("BLOCKED_DUPLICATE");
  });

  test("enforces a unique parent state before city generation", () => {
    const plans = planGlwPageMatrix({ products: [product], stateCodes: ["TX"], citySlugsByState: { TX: ["austin"] }, existingPages: [] });
    expect(plans.some((plan) => plan.action === "BLOCKED_PARENT_STATE")).toBe(true);
  });

  test("plans one product across two states and three cities per state", () => {
    expect(getGlwCitiesForState("TX").length).toBeGreaterThanOrEqual(3);
    expect(getGlwCitiesForState("CA").length).toBeGreaterThanOrEqual(3);
    const statePaths = ["TX", "CA"].map((stateCode) => ({ canonicalPath: createGlwCanonicalPath({ productSlug: product.slug, stateCode }) }));
    const plans = planGlwPageMatrix({ products: [product], stateCodes: ["TX", "CA"], citySlugsByState: { TX: ["austin", "dallas", "houston"], CA: ["los-angeles", "san-diego", "san-francisco"] }, existingPages: statePaths });
    expect(plans.filter((plan) => plan.action === "CREATE_CITY")).toHaveLength(6);
  });

  test("planning creates semantic operations without external publication", () => {
    const source = readFileSync(resolve(process.cwd(), "src/modules/glw/matrix-planner.ts"), "utf8");
    expect(source).not.toMatch(/fetch\(|n8n|wordpress|child_process|Process\.Start/i);
    const plans = planGlwPageMatrix({ products: [product], stateCodes: ["TX"], citySlugsByState: { TX: [] }, existingPages: [] });
    expect(plans.every((plan) => plan.externalExecutionAllowed === false)).toBe(true);
  });

  test("publication intent remains non-executable request data", () => {
    const form = { ...createDefaultGlwGenerationInput(site, product), publicationIntent: "publish" as const };
    const result = buildLocalGlwGenerationPreview({ form, sites: [site], products: [product] });
    expect(result.request?.publicationIntent).toBe("publish");
    expect(result.request?.externalExecutionAllowed).toBe(false);
  });

  test("exposes the recovered workspace from the current Pages Center", () => {
    const source = readFileSync(resolve(process.cwd(), "src/modules/glw/GlwPagesCenter.tsx"), "utf8");
    expect(source).toContain("<GlwPageGenerationWorkspace");
    expect(source).toContain("listSites()");
    expect(source).toContain("listProducts()");
    expect(source).toContain("listIntegrationProfiles(");
    expect(source).toContain("resolvePermissions(");
  });

  test("exposes exact create/update authority and bounded execution results to operators", () => {
    const source = readFileSync(resolve(process.cwd(), "src/modules/glw/GlwPageGenerationWorkspace.tsx"), "utf8");
    expect(source).toContain('aria-label="Generation operation"');
    expect(source).toContain('aria-label="WordPress object ID"');
    expect(source).toContain("Update exact draft");
    expect(source).toContain("Update WordPress Draft");
    expect(source).toContain("execution.wordpressObjectId");
    expect(source).toContain("execution.wordpressUrl");
    expect(source).toContain("execution.qaStatus");
    expect(source).toContain("execution.featuredImagePresent");
    expect(source).toContain("execution.disposition");
    expect(source).toContain("execution.executionTransport");
  });

  test("shows canonical target preflight and blocks unavailable mutations", () => {
    const source = readFileSync(resolve(process.cwd(), "src/modules/glw/GlwPageGenerationWorkspace.tsx"), "utf8");
    expect(source).toContain("/api/glw/target-preflight");
    expect(source).toContain("WordPress Target");
    expect(source).toContain("Canonical WordPress path");
    expect(source).toContain("targetPreflight.target.applicationPath");
    expect(source).toContain("targetPreflight.target.canonicalPath");
    expect(source).toContain("targetPreflight.target.wordpressObjectId");
    expect(source).toContain("targetPreflight.target.wordpressStatus");
    expect(source).toContain("disabled={!createAvailable}");
    expect(source).toContain("disabled={!updateAvailable}");
    expect(source).toContain("!operationAvailable");
    expect(source).not.toContain('preview.request.wordpressObjectId ?? "New object"');
  });

  test("blocks canonical collisions and published updates before dispatch", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    const mutationGuard = source.indexOf('code: "WORDPRESS_MUTATION_NOT_AUTHORIZED"');
    const dispatch = source.indexOf("service.execute(preview.request)");
    const authorityCheck = source.lastIndexOf("verifyMutationAuthority(", dispatch);
    expect(mutationGuard).toBeGreaterThan(0);
    expect(authorityCheck).toBeGreaterThan(mutationGuard);
    expect(dispatch).toBeGreaterThan(authorityCheck);
    expect(source.slice(dispatch)).toContain("publicationPerformed: false");
  });

  test("preserves structured Product Intelligence evidence through completion", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    expect(source).toContain("productAuthority:");
    expect(source).toContain("internalLinks:");
    expect(source).toContain("externalReferences:");
    expect(source).toContain("mediaAuthority:");
    expect(source).toContain("const existingChecks");
    expect(source).toContain("...existingChecks");
  });

  test("persists guarded ProjectorEnclosure workbook SEO authority evidence", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    expect(source).toContain("loadProjectorEnclosureSeoAuthority().select");
    expect(source).toContain("projectorEnclosureSeoAuthority");
    expect(source).toContain("await glwPageExecutionRepository.list()");
    expect(source).toContain("existingOwners: input.keywordOwners");
    expect(source).toContain('input.request.plannedOperation.startsWith("UPDATE_")');
    expect(source).toContain("verifiedCompatibilityKeywords: []");
    expect(source).toContain("verifiedElectricalKeywords: []");
    expect(source).toContain("primaryKeyword: enrichment.seoAuthority.primaryKeyword?.keyword");
    expect(source).toContain("selectionRationale: enrichment.seoAuthority.selectionRationale");
    expect(source).toContain("cannibalization: enrichment.seoAuthority.cannibalization");
    expect(source).toContain("provenance: enrichment.seoAuthority.provenance");
    expect(source).toContain('errorCode: "SEO_AUTHORITY_INELIGIBLE"');
  });

  test("continues CONTENT_READY with exact target/job/execution fail-closed guards and without dispatch", () => {
    const routeSource = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    const lookupSource = readFileSync(resolve(process.cwd(), "src/modules/glw/campaign-continuation-target-lookup.ts"), "utf8");
    expect(routeSource).toContain('if (action === "continue")');
    expect(routeSource).toContain('const expectedTargetId = body.targetId?.trim() ?? "";');
    expect(routeSource).toContain('const expectedExecutionId = body.executionId?.trim() ?? "";');
    expect(routeSource).toContain('resolveExactContinuationCampaignTarget({');
    expect(routeSource).toContain('Published targets cannot continue through draft continuation.');
    expect(routeSource).toContain('publicationPerformed: false');
    expect(lookupSource).toContain('Campaign target does not match the exact existing job.');
    expect(lookupSource).toContain('Conflicting WordPress identity exists for this campaign target.');
    expect(lookupSource).toContain('Continuation request executionId does not match the exact existing execution.');
  });

  test("campaign reconcile reuses existing continue path for content-ready target continuation", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reconcile/route.ts"), "utf8");
    expect(source).toContain('targetId?: string;');
    expect(source).toContain('executionId?: string;');
    expect(source).toContain('Exact target continuation requires targetId, jobId, and executionId.');
    expect(source).toContain('action: "continue"');
    expect(source).toContain('reconcileGlwContentReadyTargetDraft');
    expect(source).toContain('action: "draft_ready"');
    expect(source).toContain('executionIdAfter: job.externalExecutionId ?? null');
  });

  test("renders approved GLW campaign internal links before generated-content QA", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/glw/page-generation/route.ts",
      ),
      "utf8",
    );

    const resolveAuthority =
      source.indexOf(
        "resolveGlwAllowedInternalLinks({",
      );

    const renderAuthority =
      source.indexOf(
        "renderGlwAllowedInternalLinks({",
      );

    const generatedQa =
      source.indexOf(
        "evaluateGlwGeneratedContentQa({",
        renderAuthority,
      );

    expect(resolveAuthority).toBeGreaterThan(0);
    expect(renderAuthority).toBeGreaterThan(
      resolveAuthority,
    );
    expect(generatedQa).toBeGreaterThan(
      renderAuthority,
    );
  });

  test("applies scoped host theme title suppression for persisted GLW drafts", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/app/api/glw/page-generation/route.ts",
      ),
      "utf8",
    );

    expect(source).toContain("applyScopedThemeTitleSuppression");
    expect(source).toContain("suppressionEligible = strictGeneratedContextualRequired");
    expect(source).toContain("preWriteSuppression");
    expect(source).toContain("postWriteSuppression");
    expect(source).toContain("generatedDraft: finalizedArtifact");
  });

  test("treats FAILED zero-authority canonicalization with generated draft as exact recoverable content failure", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    expect(source).toContain("function isExactRecoverableContentFailure(job: GlwPageExecutionRecord): boolean {");
    expect(source).toContain('|| job.errorCode === "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED"');
    expect(source).toContain("&& Boolean(job.generatedDraft);");
  });

  test("treats FAILED zero-authority canonicalization with generated draft as recoverable for finalization", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    expect(source).toContain("const recoverableQaFailure = input.recoveryContext?.qaFailure ?? isExactRecoverableContentFailure(input.job);");
    expect(source).toContain("const recoverableWordPressFailure = input.recoveryContext?.wordPressFailure ?? isExactRecoverableWordPressFailure(input.job);");
    expect(source).toContain("resolveFinalizationArtifactSource({");
  });

  test("production-shaped QA recovery continuation preserves FAILED GENERATED_CONTENT_QA_FAILED intent through post-enrichment bounded repair guard", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    expect(source).toContain("recoveryContext?: {");
    expect(source).toContain("qaFailure: boolean;");
    expect(source).toContain("wordPressFailure: boolean;");
    expect(source).toContain("qaFailure: isExactRecoverableContentFailure(currentJob)");
    expect(source).toContain("wordPressFailure: isExactRecoverableWordPressFailure(currentJob)");
    expect(source).toContain("qaFailure: exactRecoverableContentFailure");
    expect(source).toContain("wordPressFailure: exactRecoverableWordPressFailure");
    expect(source).toContain("&& recoverableQaFailure");

    const prepare = source.indexOf("prepareGeneratedContentForSite({");
    const qa = source.indexOf("let qa = evaluateGlwGeneratedContentQa({", prepare);
    const bounded = source.indexOf("const eligibleForBoundedRepair =", qa);
    const repair = source.indexOf("repairGlwStateContentToMinimum({", bounded);
    const dispatch = source.indexOf("service.execute(preview.request)", repair);

    expect(prepare).toBeGreaterThan(0);
    expect(qa).toBeGreaterThan(prepare);
    expect(bounded).toBeGreaterThan(qa);
    expect(repair).toBeGreaterThan(bounded);
    expect(dispatch).toBeGreaterThan(repair);
  });

  test("requests zero-authority fallback only for Outdoor Sphere LDW state-service scope", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    expect(source).toContain("function resolveZeroAuthorityFallbackPolicy(request: GlwGenerationRequest): GlwZeroAuthorityFallbackPolicy");
    expect(source).toContain('request.organizationId === "led-display-warehouse"');
    expect(source).toContain('request.siteId === "site-led-display-warehouse-production"');
    expect(source).toContain('request.productId === "prod-outdoor-digital-sphere"');
    expect(source).toContain('request.pageType === "state_service"');
    expect(source).toContain('return "OUTDOOR_SPHERE_STATE_SERVICE"');
    expect(source).toContain('return "STRICT"');
    expect(source).toContain("fallbackPolicy: resolveZeroAuthorityFallbackPolicy(input.request)");
  });

  test("keeps unrelated FAILED errors non-recoverable and continue path finalizes without generation dispatch", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    const recoverableFailure = source.indexOf('job.errorCode === "GENERATED_CONTENT_QA_FAILED"');
    const zeroAuthorityFailure = source.indexOf('job.errorCode === "ZERO_AUTHORITY_CANONICALIZATION_BLOCKED"', recoverableFailure);
    const contentRepairFailure = source.indexOf('job.errorCode?.startsWith("CONTENT_REPAIR_") === true', zeroAuthorityFailure);
    const continueBranch = source.indexOf('if (action === "continue")');
    const generateBranch = source.indexOf('if (action !== "generate")');
    const finalizeCall = source.indexOf("finalizeContentReadyExecution({", continueBranch);
    const dispatchCall = source.indexOf("service.execute(preview.request)", continueBranch);
    const unrelatedFailure = source.indexOf("WORDPRESS_HIERARCHY_READ_FAILED", recoverableFailure);

    expect(recoverableFailure).toBeGreaterThan(0);
    expect(zeroAuthorityFailure).toBeGreaterThan(recoverableFailure);
    expect(contentRepairFailure).toBeGreaterThan(zeroAuthorityFailure);
    expect(unrelatedFailure).toBeGreaterThan(contentRepairFailure);
    expect(finalizeCall).toBeGreaterThan(continueBranch);
    expect(dispatchCall).toBeGreaterThan(generateBranch);
  });

  test("recoverable FAILED content still reruns claim authority before WordPress draft persistence", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8");
    const recoverableFailure = source.indexOf("const recoverableQaFailure = input.recoveryContext?.qaFailure ?? isExactRecoverableContentFailure(input.job);");
    const continueBranch = source.indexOf('if (action === "continue")');
    const finalizeCall = source.indexOf("finalizeContentReadyExecution({", continueBranch);
    const claimAuthorityCheck = source.indexOf("if (claimAuthority && !claimAuthority.ok)", recoverableFailure);
    const claimFailureWrite = source.indexOf('errorMessage: `Unsupported factual claims detected under ${claimAuthority.policyVersion}.`', claimAuthorityCheck);
    const wordpressWrite = source.indexOf("writeGenesisWordPressDraft", claimFailureWrite);

    expect(recoverableFailure).toBeGreaterThan(0);
    expect(finalizeCall).toBeGreaterThan(continueBranch);
    expect(claimAuthorityCheck).toBeGreaterThan(recoverableFailure);
    expect(claimFailureWrite).toBeGreaterThan(claimAuthorityCheck);
    expect(wordpressWrite).toBeGreaterThan(claimFailureWrite);
  });

});