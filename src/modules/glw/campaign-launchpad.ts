import { evaluateProductReadiness } from "@/modules/foundation/product-readiness";
import { evaluateSiteReadiness } from "@/modules/foundation/site-readiness";
import type { PermissionAction, ProductConfiguration, ProductReadinessResult, SiteConfiguration, SiteReadinessResult } from "@/modules/foundation/types";
import { getGlwCampaignOwnershipForTarget, type GlwCampaignAuthoritySnapshot } from "./campaign-authority";
import { GLW_CITIES, GLW_STATES, createDefaultGlwGenerationInput, createGlwCanonicalPath, getGlwCitiesForState, type GlwGenerationProduct, type GlwGenerationSite } from "./page-generation";
import { resolveGlwN8nEngineProductSlug } from "./page-execution";
import { planGlwPageMatrix, type GlwPlannedPage } from "./matrix-planner";
import type { GlwTargetPreflightResult } from "./target-preflight";
import type { GlwCampaignPublicationPolicy } from "./campaign-types";
import { classifyGlwCampaignOwnership, classifyGlwCannibalization, classifyGlwExecutionOwnership, type GlwCampaignOwnershipAssessment, type GlwCannibalizationAssessment, type GlwExecutionAuthority, type GlwExecutionOwnershipAssessment } from "./launchpad-planning-authority";
import { createGlwTargetIntentIdentity, evaluateGlwTargetIntentOwnership } from "./target-intent-authority";

export type GlwCampaignReach = "NATIONWIDE" | "STATE" | "MULTI_STATE_REGION" | "METRO_LOCAL" | "CUSTOM";
export type GlwCampaignReadiness = "READY" | "READY_WITH_REVIEW" | "AUTHORITY_REQUIRED" | "TARGET_CONFLICTS" | "UNRECONCILED" | "UNSUPPORTED" | "ANALYSIS_FAILED";
export type GlwLaunchpadBlocker = {
  code: string;
  scope: "SITE" | "PRODUCT" | "SOURCE" | "CAMPAIGN" | "EXECUTION" | "TARGET" | "CANNIBALIZATION";
  severity: "BLOCKING" | "WARNING";
  message: string;
  authoritySource: string;
  repairableByExistingWorkflow: boolean | null;
};
export type GlwCampaignLaunchpadInput = { reach: GlwCampaignReach; productUrl: string; stateCodes?: readonly string[]; metro?: string };
export type GlwCampaignLaunchpadV3Handoff = {
  siteId: string;
  productId: string;
  reach: GlwCampaignReach;
  selectedTargetIdentities: readonly { canonicalPath: string; stateCode: string; citySlug: string }[];
  publicationPolicy: GlwCampaignPublicationPolicy | "UNAVAILABLE";
  selectedBatchSize: number;
};
export type GlwCampaignLaunchpadTarget = { stateCode: string; stateName: string; citySlug: string; cityName: string; canonicalPath: string };
export type GlwTargetPrimaryDisposition = "EXISTING_COVERAGE" | "EXECUTION_OWNED" | "CAMPAIGN_OWNED" | "CANNIBALIZATION_CONFLICT" | "AUTHORITY_BLOCKED" | "UNRECONCILED" | "UNSUPPORTED" | "SAFE";
export type GlwLaunchpadTargetAssessment = GlwCampaignLaunchpadTarget & {
  canonicalState: GlwTargetPreflightResult["state"];
  siteReadiness: "READY" | "BLOCKED";
  productReadiness: "READY" | "BLOCKED";
  sourceReadiness: "READY" | "BLOCKED";
  executionOwnership: GlwExecutionOwnershipAssessment;
  campaignOwnership: GlwCampaignOwnershipAssessment;
  cannibalization: GlwCannibalizationAssessment;
  primaryDisposition: GlwTargetPrimaryDisposition;
  blockers: readonly GlwLaunchpadBlocker[];
  safe: boolean;
};
export type GlwLaunchpadExcludedTarget = {
  target: string;
  canonicalPath: string;
  group: Exclude<GlwTargetPrimaryDisposition, "SAFE">;
  reason: string;
  existingOwner: string | null;
  jobId: string | null;
  executionId: string | null;
  campaignId: string | null;
};
export type GlwCampaignLaunchpadCounts = {
  potentialCount: number;
  existingCoverageCount: number;
  executionOwnedCount: number;
  campaignOwnedCount: number;
  cannibalizationConflictCount: number;
  authorityBlockedCount: number;
  unreconciledCount: number;
  unsupportedCount: number;
  maximumSafeReachCount: number;
};
export type GlwCampaignLaunchpadPreflight = {
  site: { id: string; name: string };
  product: { id: string; name: string } | null;
  canonicalProductUrl: string;
  productAuthorityState: "READY" | "REQUIRES_AUTHORITY";
  sourceAuthorityState: "READY" | "REQUIRES_AUTHORITY";
  desiredReach: GlwCampaignReach;
  existingCoverage: number;
  existingCampaignConflicts: number | "UNAVAILABLE";
  duplicateTargetsExcluded: number;
  cannibalizationConflicts: number | "UNAVAILABLE";
  availableEligibleTargets: number;
  authorityBlockedTargets: number;
  potentialReach: number;
  recommendedInitialBatch: number;
  maximumSafeReach: number;
  publicationPolicy: GlwCampaignPublicationPolicy | "UNAVAILABLE";
  readiness: GlwCampaignReadiness;
  blockers: readonly string[];
  readinessBlockers: readonly GlwLaunchpadBlocker[];
  targets: readonly GlwCampaignLaunchpadTarget[];
  targetAssessments: readonly GlwLaunchpadTargetAssessment[];
  excludedTargets: readonly GlwLaunchpadExcludedTarget[];
  counts: GlwCampaignLaunchpadCounts;
  diagnostics: { exactCanonicalConflictCount: number; campaignAuthorityAvailable: boolean; broaderIntentAuthorityAvailable: boolean };
  technicalDetails: { targetAuthority: "AUTHORITATIVE" | "PARTIAL" | "UNAVAILABLE"; sourceMode: "PRODUCT_CANONICAL" };
};
export type GlwCampaignLaunchpadValidation = { valid: boolean; issues: readonly { field: "productUrl" | "reach" | "stateCodes" | "metro"; message: string }[] };

type ReadinessEvaluation = { siteResult: SiteReadinessResult; productResult: ProductReadinessResult | null; blockers: readonly GlwLaunchpadBlocker[] };
const READINESS_PERMISSION = "products:evaluate_readiness" satisfies PermissionAction;
const SITE_PERMISSION = "sites:manage_integrations" satisfies PermissionAction;

function conditionCode(prefix: "SITE" | "PRODUCT", key: string): string {
  const normalized = key.toUpperCase();
  return normalized.startsWith(`${prefix}_`) ? normalized : `${prefix}_${normalized}`;
}

function evaluateCanonicalReadiness(input: { site: SiteConfiguration; product: ProductConfiguration | null; organizationActive: boolean; permissions: Set<PermissionAction> }): ReadinessEvaluation {
  const siteResult = evaluateSiteReadiness({ site: input.site, organizationActive: input.organizationActive, requiredPermission: SITE_PERMISSION, permissions: input.permissions, intent: "publish", requireWorkflowReference: true });
  const productResult = input.product ? evaluateProductReadiness({ product: input.product, requiredPermission: READINESS_PERMISSION, permissions: input.permissions }) : null;
  const blockers: GlwLaunchpadBlocker[] = [];
  blockers.push(...siteResult.checkedConditions.filter((condition) => !condition.passed).map((condition) => ({ code: conditionCode("SITE", condition.key), scope: "SITE" as const, severity: "BLOCKING" as const, message: condition.details, authoritySource: "SITE_READINESS", repairableByExistingWorkflow: true })));
  blockers.push(...siteResult.warnings.map((message) => ({ code: "SITE_READINESS_WARNING", scope: "SITE" as const, severity: "WARNING" as const, message, authoritySource: "SITE_READINESS", repairableByExistingWorkflow: true })));
  if (!input.product) {
    blockers.push({ code: "PRODUCT_NOT_REGISTERED", scope: "PRODUCT", severity: "BLOCKING", message: "The URL does not resolve to a registered product assigned to this site.", authoritySource: "PRODUCT_REPOSITORY", repairableByExistingWorkflow: true });
  } else if (productResult) {
    blockers.push(...productResult.checkedConditions.filter((condition) => !condition.passed).map((condition) => ({ code: conditionCode("PRODUCT", condition.key), scope: "PRODUCT" as const, severity: "BLOCKING" as const, message: condition.details, authoritySource: "PRODUCT_READINESS", repairableByExistingWorkflow: true })));
    blockers.push(...productResult.warnings.map((message) => ({ code: "PRODUCT_READINESS_WARNING", scope: "PRODUCT" as const, severity: "WARNING" as const, message, authoritySource: "PRODUCT_READINESS", repairableByExistingWorkflow: true })));
    if (!input.product.sourceEvidenceReference) blockers.push({ code: "SOURCE_AUTHORITY_INSUFFICIENT", scope: "SOURCE", severity: "BLOCKING", message: "Product source authority is not available.", authoritySource: "PRODUCT_SOURCE_EVIDENCE", repairableByExistingWorkflow: null });
  }
  return { siteResult, productResult, blockers };
}

export function validateGlwCampaignLaunchpadInput(input: GlwCampaignLaunchpadInput): GlwCampaignLaunchpadValidation {
  const issues: { field: "productUrl" | "reach" | "stateCodes" | "metro"; message: string }[] = [];
  try {
    const url = new URL(input.productUrl);
    if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) issues.push({ field: "productUrl", message: "Enter a public HTTP or HTTPS product URL without credentials." });
  } catch {
    issues.push({ field: "productUrl", message: "Enter a valid product URL." });
  }
  const stateCodes = input.stateCodes ?? [];
  if ((input.reach === "STATE" || input.reach === "MULTI_STATE_REGION") && stateCodes.length === 0) issues.push({ field: "stateCodes", message: "Select at least one supported state." });
  if (stateCodes.some((code) => !GLW_STATES.some((state) => state.code === code))) issues.push({ field: "stateCodes", message: "One or more selected states are not supported." });
  if (input.reach === "METRO_LOCAL" && !input.metro?.trim()) issues.push({ field: "metro", message: "Select a supported metro." });
  if (input.reach === "CUSTOM") issues.push({ field: "reach", message: "Custom reach is not yet supported by the current campaign target authority." });
  return { valid: issues.length === 0, issues };
}

function normalizeOrigin(url: string): string | null {
  try { return new URL(url).origin.toLowerCase(); } catch { return null; }
}

export function resolveGlwLaunchpadSite(productUrl: string, sites: readonly SiteConfiguration[], organizationId: string): SiteConfiguration | null {
  const origin = normalizeOrigin(productUrl);
  if (!origin) return null;
  return sites.find((site) => site.organizationId === organizationId && [site.canonicalUrl, site.domain ? `https://${site.domain}` : null].some((candidate) => candidate && normalizeOrigin(candidate) === origin)) ?? null;
}

export function resolveGlwLaunchpadProduct(productUrl: string, site: SiteConfiguration, products: readonly ProductConfiguration[]): ProductConfiguration | null {
  const segments = new URL(productUrl).pathname.split("/").filter(Boolean);
  return products.find((product) => {
    const assignment = product.siteAssignments.find((item) => item.siteId === site.siteId);
    let engineSlug: string | null = null;
    try { engineSlug = resolveGlwN8nEngineProductSlug(product.productId); } catch { engineSlug = null; }
    const slugs = [assignment?.siteSpecificSlug, product.slug, engineSlug].filter(Boolean);
    return product.organizationId === site.organizationId && product.assignedSiteIds.includes(site.siteId) && slugs.some((slug) => segments.includes(slug!));
  }) ?? null;
}

export function selectGlwLaunchpadTargets(input: GlwCampaignLaunchpadInput): readonly Omit<GlwCampaignLaunchpadTarget, "canonicalPath">[] {
  const mapCity = (city: (typeof GLW_CITIES)[number]) => ({ stateCode: city.stateCode, stateName: GLW_STATES.find((state) => state.code === city.stateCode)?.name ?? city.stateCode, citySlug: city.slug, cityName: city.name });
  if (input.reach === "NATIONWIDE") return GLW_CITIES.map(mapCity);
  if (input.reach === "STATE" || input.reach === "MULTI_STATE_REGION") return (input.stateCodes ?? []).flatMap((code) => getGlwCitiesForState(code).map(mapCity));
  if (input.reach === "METRO_LOCAL") return GLW_CITIES.filter((city) => city.metro.toLowerCase() === input.metro?.trim().toLowerCase()).map(mapCity);
  return [];
}

function matrixPlansForTargets(input: { targets: readonly GlwCampaignLaunchpadTarget[]; results: readonly GlwTargetPreflightResult[]; product: GlwGenerationProduct }): ReadonlyMap<string, GlwPlannedPage> {
  const existingPages = new Set<string>();
  input.targets.forEach((target, index) => {
    const result = input.results[index];
    if (result.canonicalParentId) existingPages.add(createGlwCanonicalPath({ productSlug: input.product.slug, stateCode: target.stateCode }));
    if (result.state === "EXISTS_DRAFT" || result.state === "EXISTS_PUBLISHED") existingPages.add(target.canonicalPath);
  });
  const citySlugsByState = Object.fromEntries(GLW_STATES.map((state) => [state.code, input.targets.filter((target) => target.stateCode === state.code).map((target) => target.citySlug)]));
  const plans = planGlwPageMatrix({ products: [input.product], stateCodes: [...new Set(input.targets.map((target) => target.stateCode))], citySlugsByState, existingPages: [...existingPages].map((canonicalPath) => ({ canonicalPath })) });
  return new Map(plans.filter((plan) => plan.citySlug).map((plan) => [plan.canonicalPath, plan]));
}

function targetBlockers(input: { execution: GlwExecutionOwnershipAssessment; campaign: GlwCampaignOwnershipAssessment; cannibalization: GlwCannibalizationAssessment }): readonly GlwLaunchpadBlocker[] {
  const blockers: GlwLaunchpadBlocker[] = [];
  if (input.execution.classification === "UNKNOWN") blockers.push({ code: "EXECUTION_OWNERSHIP_UNAVAILABLE", scope: "EXECUTION", severity: "BLOCKING", message: input.execution.reason, authoritySource: input.execution.authoritySource, repairableByExistingWorkflow: null });
  if (input.execution.classification === "UNRECONCILED") blockers.push({ code: "TARGET_EXECUTION_UNRECONCILED", scope: "TARGET", severity: "BLOCKING", message: input.execution.reason, authoritySource: input.execution.authoritySource, repairableByExistingWorkflow: null });
  if (input.campaign.classification === "UNKNOWN") blockers.push({ code: "CAMPAIGN_AUTHORITY_MISSING", scope: "CAMPAIGN", severity: "BLOCKING", message: input.campaign.reason, authoritySource: input.campaign.authoritySource, repairableByExistingWorkflow: null });
  if (input.campaign.classification === "UNRECONCILED") blockers.push({ code: "CAMPAIGN_TARGET_UNRECONCILED", scope: "CAMPAIGN", severity: "BLOCKING", message: input.campaign.reason, authoritySource: input.campaign.authoritySource, repairableByExistingWorkflow: null });
  if (input.campaign.classification === "OWNED_BY_ACTIVE_CAMPAIGN" || input.campaign.classification === "OWNED_BY_COMPLETED_CAMPAIGN") blockers.push({ code: "CAMPAIGN_TARGET_OWNED", scope: "CAMPAIGN", severity: "BLOCKING", message: input.campaign.reason, authoritySource: input.campaign.authoritySource, repairableByExistingWorkflow: false });
  if (input.cannibalization.classification === "UNAVAILABLE") blockers.push({ code: "CANNIBALIZATION_AUTHORITY_UNAVAILABLE", scope: "CANNIBALIZATION", severity: "BLOCKING", message: input.cannibalization.reason, authoritySource: input.cannibalization.authoritySource, repairableByExistingWorkflow: null });
  if (input.cannibalization.classification === "EXISTING_INTENT_OWNER") blockers.push({ code: "TARGET_INTENT_ALREADY_OWNED", scope: "CANNIBALIZATION", severity: "BLOCKING", message: input.cannibalization.reason, authoritySource: input.cannibalization.authoritySource, repairableByExistingWorkflow: false });
  if (input.cannibalization.classification === "PARENT_CHILD_CONFLICT") blockers.push({ code: "TARGET_PARENT_CHILD_CONFLICT", scope: "TARGET", severity: "BLOCKING", message: input.cannibalization.reason, authoritySource: input.cannibalization.authoritySource, repairableByExistingWorkflow: null });
  if (input.cannibalization.classification === "SAME_PRODUCT_GEO_CONFLICT") blockers.push({ code: "TARGET_GEO_CONFLICT", scope: "CANNIBALIZATION", severity: "BLOCKING", message: input.cannibalization.reason, authoritySource: input.cannibalization.authoritySource, repairableByExistingWorkflow: null });
  if (input.cannibalization.classification === "AMBIGUOUS") blockers.push({ code: "TARGET_INTENT_AMBIGUOUS", scope: "CANNIBALIZATION", severity: "BLOCKING", message: input.cannibalization.reason, authoritySource: input.cannibalization.authoritySource, repairableByExistingWorkflow: null });
  return blockers;
}

function resolvePrimaryDisposition(input: { canonicalState: GlwTargetPreflightResult["state"]; execution: GlwExecutionOwnershipAssessment; campaign: GlwCampaignOwnershipAssessment; cannibalization: GlwCannibalizationAssessment; canonicalReadiness: boolean }): GlwTargetPrimaryDisposition {
  if (input.canonicalState === "EXISTS_DRAFT" || input.canonicalState === "EXISTS_PUBLISHED") return "EXISTING_COVERAGE";
  if (input.execution.classification === "ACTIVE_EXECUTION" || input.execution.classification === "COMPLETED_EXECUTION") return "EXECUTION_OWNED";
  if (input.campaign.classification === "OWNED_BY_ACTIVE_CAMPAIGN" || input.campaign.classification === "OWNED_BY_COMPLETED_CAMPAIGN") return "CAMPAIGN_OWNED";
  if (!["CLEAR", "UNAVAILABLE"].includes(input.cannibalization.classification)) return "CANNIBALIZATION_CONFLICT";
  if (!input.canonicalReadiness) return "AUTHORITY_BLOCKED";
  if (input.execution.classification === "UNKNOWN" || input.execution.classification === "UNRECONCILED" || input.campaign.classification === "UNKNOWN" || input.campaign.classification === "UNRECONCILED" || input.cannibalization.classification === "UNAVAILABLE") return "UNRECONCILED";
  return "SAFE";
}

function exclusionReason(target: GlwLaunchpadTargetAssessment): string {
  if (target.primaryDisposition === "EXISTING_COVERAGE" || target.primaryDisposition === "CANNIBALIZATION_CONFLICT") return target.cannibalization.reason;
  if (target.primaryDisposition === "EXECUTION_OWNED") return target.executionOwnership.reason;
  if (target.primaryDisposition === "CAMPAIGN_OWNED") return target.campaignOwnership.reason;
  if (target.primaryDisposition === "AUTHORITY_BLOCKED") return "Canonical site, product, or source readiness is blocked.";
  return target.blockers[0]?.message ?? target.cannibalization.reason;
}

export async function buildGlwCampaignLaunchpadPreflight(input: {
  request: GlwCampaignLaunchpadInput;
  organizationId: string;
  organizationActive: boolean;
  permissions: Set<PermissionAction>;
  sites: readonly SiteConfiguration[];
  products: readonly ProductConfiguration[];
  executionAuthority: GlwExecutionAuthority;
  campaignSnapshot: GlwCampaignAuthoritySnapshot | null;
  readTarget: (target: GlwCampaignLaunchpadTarget, site: SiteConfiguration, product: ProductConfiguration) => Promise<GlwTargetPreflightResult>;
}): Promise<GlwCampaignLaunchpadPreflight> {
  const validation = validateGlwCampaignLaunchpadInput(input.request);
  if (!validation.valid) throw new Error(validation.issues[0]?.message ?? "Campaign input is invalid.");
  const site = resolveGlwLaunchpadSite(input.request.productUrl, input.sites, input.organizationId);
  if (!site) throw new Error("This URL does not match a registered site in the current workspace.");
  const product = resolveGlwLaunchpadProduct(input.request.productUrl, site, input.products);
  const selectedTargets = selectGlwLaunchpadTargets(input.request);
  if (selectedTargets.length === 0) throw new Error("No supported targets match the selected reach.");
  const generationProduct: GlwGenerationProduct | null = product ? { siteId: site.siteId, productId: product.productId, organizationId: product.organizationId, name: product.displayName, slug: product.siteAssignments.find((assignment) => assignment.siteId === site.siteId)?.siteSpecificSlug ?? product.slug, topic: product.productName, assignedSiteIds: product.assignedSiteIds } : null;
  const targets = selectedTargets.map((target) => ({ ...target, canonicalPath: createGlwCanonicalPath({ productSlug: generationProduct?.slug ?? "unknown-product", stateCode: target.stateCode, citySlug: target.citySlug }) }));
  const canonicalReadiness = evaluateCanonicalReadiness({ site, product, organizationActive: input.organizationActive, permissions: input.permissions });
  const globalBlockers = [...canonicalReadiness.blockers];
  const authorityCampaigns = product && input.campaignSnapshot
    ? input.campaignSnapshot.campaigns.filter((campaign) => campaign.organizationId === input.organizationId && campaign.siteId === site.siteId && campaign.productId === product.productId)
    : [];
  const publicationPolicies = [...new Set(authorityCampaigns.map((campaign) => campaign.publicationPolicy))];
  const imagePolicies = [...new Set(authorityCampaigns.map((campaign) => campaign.imageRequired))];
  const campaignPolicyAuthorityValid = authorityCampaigns.length > 0
    && publicationPolicies.length === 1
    && (publicationPolicies[0] === "draft_only" || publicationPolicies[0] === "publish_after_gates")
    && imagePolicies.length === 1
    && typeof imagePolicies[0] === "boolean";
  if (!campaignPolicyAuthorityValid) globalBlockers.push({ code: "CAMPAIGN_PUBLICATION_POLICY_AUTHORITY_CHANGED", scope: "CAMPAIGN", severity: "BLOCKING", message: "Existing campaign publication and image policy authority is missing or conflicted for this site and product.", authoritySource: "GLW_CAMPAIGN_PERSISTENCE", repairableByExistingWorkflow: null });
  if (input.executionAuthority.status === "UNAVAILABLE") globalBlockers.push({ code: "EXECUTION_OWNERSHIP_UNAVAILABLE", scope: "EXECUTION", severity: "BLOCKING", message: "GLW execution persistence was not available for this preflight.", authoritySource: "GLW_PAGE_EXECUTION_JOURNAL", repairableByExistingWorkflow: null });
  if (!input.campaignSnapshot) globalBlockers.push({ code: "CAMPAIGN_AUTHORITY_MISSING", scope: "CAMPAIGN", severity: "BLOCKING", message: "Authoritative campaign persistence is unavailable or could not be read.", authoritySource: "CAMPAIGN_PERSISTENCE", repairableByExistingWorkflow: null });
  if (!input.campaignSnapshot) globalBlockers.push({ code: "CANNIBALIZATION_AUTHORITY_UNAVAILABLE", scope: "CANNIBALIZATION", severity: "BLOCKING", message: "Deterministic product/geographic intent ownership persistence is unavailable.", authoritySource: "GLW_CAMPAIGN_TARGET_INTENT", repairableByExistingWorkflow: null });
  const targetResults = product ? await Promise.all(targets.map((target) => input.readTarget(target, site, product))) : [];
  const matrixPlans = generationProduct ? matrixPlansForTargets({ targets, results: targetResults, product: generationProduct }) : new Map<string, GlwPlannedPage>();
  const siteReady = canonicalReadiness.siteResult.ready;
  const productReady = canonicalReadiness.productResult?.ready ?? false;
  const sourceReady = Boolean(product?.sourceEvidenceReference);
  const authorityReady = siteReady && productReady && sourceReady;
  const targetAssessments = product ? targets.map((target, index): GlwLaunchpadTargetAssessment => {
    const canonical = targetResults[index];
    const executionOwnership = classifyGlwExecutionOwnership({ siteId: site.siteId, productId: product.productId, canonicalPath: target.canonicalPath, authority: input.executionAuthority });
    const campaignOwnership = input.campaignSnapshot
      ? getGlwCampaignOwnershipForTarget({ snapshot: input.campaignSnapshot, organizationId: input.organizationId, siteId: site.siteId, productId: product.productId, pageType: "city_service", stateCode: target.stateCode, citySlug: target.citySlug })
      : classifyGlwCampaignOwnership({ canonicalPath: target.canonicalPath, authority: { status: "UNAVAILABLE" } });
    const intentOwnership = evaluateGlwTargetIntentOwnership({ snapshot: input.campaignSnapshot, identity: createGlwTargetIntentIdentity({ siteId: site.siteId, productId: product.productId, stateCode: target.stateCode, citySlug: target.citySlug }) });
    const cannibalization = classifyGlwCannibalization({ target: canonical, matrixPlan: matrixPlans.get(target.canonicalPath) ?? null, intentOwnership });
    const disposition = resolvePrimaryDisposition({ canonicalState: canonical.state, execution: executionOwnership, campaign: campaignOwnership, cannibalization, canonicalReadiness: authorityReady });
    const blockers = targetBlockers({ execution: executionOwnership, campaign: campaignOwnership, cannibalization });
    return { ...target, canonicalState: canonical.state, siteReadiness: siteReady ? "READY" : "BLOCKED", productReadiness: productReady ? "READY" : "BLOCKED", sourceReadiness: sourceReady ? "READY" : "BLOCKED", executionOwnership, campaignOwnership, cannibalization, primaryDisposition: disposition, blockers, safe: disposition === "SAFE" };
  }) : [];
  const targetBlockerMap = new Map<string, GlwLaunchpadBlocker>();
  targetAssessments.flatMap((target) => target.blockers).forEach((entry) => targetBlockerMap.set(`${entry.scope}:${entry.code}`, entry));
  targetBlockerMap.forEach((entry, key) => {
    if (!globalBlockers.some((blocker) => `${blocker.scope}:${blocker.code}` === key)) globalBlockers.push(entry);
  });
  const dispositionCount = (disposition: GlwTargetPrimaryDisposition) => targetAssessments.filter((target) => target.primaryDisposition === disposition).length;
  const counts: GlwCampaignLaunchpadCounts = {
    potentialCount: targets.length,
    existingCoverageCount: dispositionCount("EXISTING_COVERAGE"),
    executionOwnedCount: dispositionCount("EXECUTION_OWNED"),
    campaignOwnedCount: dispositionCount("CAMPAIGN_OWNED"),
    cannibalizationConflictCount: dispositionCount("CANNIBALIZATION_CONFLICT"),
    authorityBlockedCount: dispositionCount("AUTHORITY_BLOCKED"),
    unreconciledCount: dispositionCount("UNRECONCILED"),
    unsupportedCount: dispositionCount("UNSUPPORTED"),
    maximumSafeReachCount: dispositionCount("SAFE"),
  };
  const primaryTotal = counts.existingCoverageCount + counts.executionOwnedCount + counts.campaignOwnedCount + counts.cannibalizationConflictCount + counts.authorityBlockedCount + counts.unreconciledCount + counts.unsupportedCount + counts.maximumSafeReachCount;
  if (primaryTotal !== counts.potentialCount) throw new Error("Launchpad primary disposition counts do not reconcile.");
  const excludedTargets = targetAssessments.filter((target) => !target.safe).map((target): GlwLaunchpadExcludedTarget => ({ target: `${target.cityName}, ${target.stateName}`, canonicalPath: target.canonicalPath, group: target.primaryDisposition as Exclude<GlwTargetPrimaryDisposition, "SAFE">, reason: exclusionReason(target), existingOwner: target.cannibalization.existingOwner, jobId: target.executionOwnership.jobId, executionId: target.executionOwnership.executionId, campaignId: target.campaignOwnership.campaignId }));
  const safeCount = counts.maximumSafeReachCount;
  const readiness: GlwCampaignReadiness = globalBlockers.some((entry) => ["SITE", "PRODUCT", "SOURCE", "CAMPAIGN"].includes(entry.scope) && entry.severity === "BLOCKING") ? "AUTHORITY_REQUIRED" : counts.unreconciledCount > 0 ? "UNRECONCILED" : safeCount > 0 ? (excludedTargets.length > 0 ? "READY_WITH_REVIEW" : "READY") : "TARGET_CONFLICTS";
  const policy = campaignPolicyAuthorityValid ? publicationPolicies[0] as GlwCampaignPublicationPolicy : "UNAVAILABLE";
  const exactCanonicalConflictCount = targetAssessments.filter((target) => target.cannibalization.classification === "EXACT_CANONICAL_EXISTS").length;
  return {
    site: { id: site.siteId, name: site.displayName }, product: product ? { id: product.productId, name: product.displayName } : null, canonicalProductUrl: new URL(input.request.productUrl).toString(),
    productAuthorityState: productReady ? "READY" : "REQUIRES_AUTHORITY", sourceAuthorityState: sourceReady ? "READY" : "REQUIRES_AUTHORITY", desiredReach: input.request.reach,
    existingCoverage: counts.existingCoverageCount, existingCampaignConflicts: input.campaignSnapshot ? counts.campaignOwnedCount : "UNAVAILABLE", duplicateTargetsExcluded: counts.existingCoverageCount,
    cannibalizationConflicts: input.campaignSnapshot ? counts.cannibalizationConflictCount : "UNAVAILABLE", availableEligibleTargets: safeCount, authorityBlockedTargets: counts.authorityBlockedCount,
    potentialReach: counts.potentialCount, recommendedInitialBatch: Math.min(25, safeCount), maximumSafeReach: safeCount, publicationPolicy: policy, readiness,
    blockers: globalBlockers.map((entry) => entry.message), readinessBlockers: globalBlockers, targets, targetAssessments, excludedTargets, counts,
    diagnostics: { exactCanonicalConflictCount, campaignAuthorityAvailable: Boolean(input.campaignSnapshot), broaderIntentAuthorityAvailable: Boolean(input.campaignSnapshot) },
    technicalDetails: { targetAuthority: targetAssessments.every((target) => target.canonicalState !== "UNKNOWN") ? "AUTHORITATIVE" : targetAssessments.length ? "PARTIAL" : "UNAVAILABLE", sourceMode: "PRODUCT_CANONICAL" },
  };
}

export function createGlwLaunchpadGenerationForm(target: GlwCampaignLaunchpadTarget, site: GlwGenerationSite, product: GlwGenerationProduct) {
  return createDefaultGlwGenerationInput(site, product, "city_service", target.stateCode, target.citySlug);
}
