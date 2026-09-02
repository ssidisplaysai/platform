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
    const collisionGuard = source.indexOf('code: "CREATE_COLLISION"');
    const updateGuard = source.indexOf('code: "UPDATE_AUTHORITY_REQUIRED"');
    const authorityCheck = source.indexOf("const authority = await verifyMutationAuthority(generationRequest, siteRecord);");
    const dispatch = source.indexOf("service.execute(generationRequest)");
    expect(collisionGuard).toBeGreaterThan(0);
    expect(updateGuard).toBeGreaterThan(collisionGuard);
    expect(authorityCheck).toBeGreaterThan(updateGuard);
    expect(dispatch).toBeGreaterThan(authorityCheck);
    expect(source).toContain("Published WordPress targets cannot be updated under the draft-only release.");
    expect(source).toContain("Creation was stopped before any WordPress changes.");

    expect(source).toContain("generationOnly: true");
    expect(source).toContain("wordpressMutationPerformed: false");
    expect(source).toContain('continuationRequired: job.status === "CONTENT_READY"');

    const defaultDispatch = source.lastIndexOf("service.execute(generationRequest)");
    const defaultFinalize = source.indexOf(
      "finalizeContentReadyExecution",
      defaultDispatch,
    );

    expect(defaultDispatch).toBeGreaterThan(authorityCheck);
    expect(defaultFinalize).toBe(-1);
  });
});