import { getIntegrationProfileById } from "@/modules/foundation/integration-profile-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import type { SiteConfiguration } from "@/modules/foundation/types";
import type { GlwGenerationRequest } from "./page-generation";
import type { GlwN8nDraftRequest } from "./page-execution";

const DEFAULT_PAGEENGINES_WORDPRESS_HOST = "staging.pageengines.com";
const PAGEENGINES_HOMEPAGE_CONTRACT_MARKERS = [
  "pageengines_homepage_contract_v1",
  "distinctive hero section",
  "platform positioning",
  "responsive mobile and desktop layout",
  "clear ctas",
  "no fabricated results",
] as const;
const MAX_APPROVED_INSTRUCTIONS_BYTES = 48_000;

type PageenginesAuthorityBinding = {
  organizationId: string;
  siteId: string;
  productId: string;
  workflowProfileReference: string;
  wordpressCredentialReference: string;
  wordpressHost: string;
  workflowId: string;
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function toInstructionLines(value: string | null | undefined): string[] {
  if (!value) return [];
  const lines = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return Array.from(new Set(lines));
}

function approvedInstructionsRequired(environment: NodeJS.ProcessEnv): boolean {
  const flag = nonEmpty(environment.GENESIS_V2_N8N_REQUIRE_APPROVED_INSTRUCTIONS)?.toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function normalizeHost(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (!trimmed.includes("://")) return trimmed.toLowerCase();
  try {
    return new URL(trimmed).host.toLowerCase();
  } catch {
    return null;
  }
}

function expectedWordPressHost(environment: NodeJS.ProcessEnv): string {
  return (nonEmpty(environment.GENESIS_PAGEENGINES_WORDPRESS_HOST) ?? DEFAULT_PAGEENGINES_WORDPRESS_HOST).toLowerCase();
}

function siteLooksLikePageengines(input: {
  workspaceId: string;
  siteId: string;
  siteDomain: string | null;
  siteCanonicalUrl: string | null;
  siteWordPressApiBaseUrl: string | null;
  expectedWordPressHost: string;
}): boolean {
  const identityHints = [input.workspaceId, input.siteId]
    .map((value) => value.toLowerCase());
  if (identityHints.some((value) => value.includes("pageengines"))) {
    return true;
  }
  const hosts = [
    normalizeHost(input.siteDomain),
    normalizeHost(input.siteCanonicalUrl),
    normalizeHost(input.siteWordPressApiBaseUrl),
  ].filter((value): value is string => Boolean(value));
  if (hosts.some((host) => host === input.expectedWordPressHost)) {
    return true;
  }
  return hosts.some((host) => host.includes("pageengines"));
}

function assertPageenginesHostMatches(input: {
  expectedHost: string;
  siteDomain: string | null | undefined;
  siteCanonicalUrl: string | null | undefined;
  siteWordPressApiBaseUrl: string | null | undefined;
}): void {
  const domainHost = normalizeHost(input.siteDomain);
  const canonicalHost = normalizeHost(input.siteCanonicalUrl);
  const wordpressHost = normalizeHost(input.siteWordPressApiBaseUrl);
  if (domainHost !== input.expectedHost) {
    throw new Error("PageEngines authority requires the exact staging.pageengines.com site domain.");
  }
  if (canonicalHost !== input.expectedHost) {
    throw new Error("PageEngines authority requires a canonical URL scoped to staging.pageengines.com.");
  }
  if (wordpressHost !== input.expectedHost) {
    throw new Error("PageEngines authority requires a WordPress API target scoped to staging.pageengines.com.");
  }
}

function assertPageenginesCompositionContract(additionalInstructions: string | null | undefined): void {
  const normalized = (additionalInstructions ?? "").trim().toLowerCase();
  const missing = PAGEENGINES_HOMEPAGE_CONTRACT_MARKERS.filter((marker) => !normalized.includes(marker));
  if (missing.length > 0) {
    throw new Error(
      "PageEngines homepage generation requires the full PAGEENGINES_HOMEPAGE_CONTRACT_V1 composition instructions.",
    );
  }
}

function resolvePageenginesBindingFromFoundation(input: {
  organizationId: string;
  siteId: string;
  productId: string;
  fallbackWorkflowId: string;
  environment: NodeJS.ProcessEnv;
}): PageenginesAuthorityBinding {
  const site = getSiteById(input.siteId);
  if (!site) {
    throw new Error("PageEngines authority rejected missing site foundation record.");
  }

  if (site.organizationId !== input.organizationId) {
    throw new Error("PageEngines dispatch rejected organization scope mismatch.");
  }

  const workflowProfileReference = nonEmpty(site.integrations.workflowReference);
  if (!workflowProfileReference) {
    throw new Error("PageEngines authority rejected missing workflow profile binding.");
  }

  const wordpressCredentialReference = nonEmpty(site.integrations.wordpressCredentialReference);
  if (!wordpressCredentialReference) {
    throw new Error("PageEngines authority rejected missing WordPress credential binding.");
  }

  const profile = getIntegrationProfileById(workflowProfileReference);
  if (!profile || profile.organizationId !== input.organizationId || profile.profileType !== "workflow" || !profile.enabled || profile.status !== "active") {
    throw new Error("PageEngines authority rejected workflow profile mismatch.");
  }

  if (!profile.assignedSiteIds.includes(site.siteId)) {
    throw new Error("PageEngines authority rejected workflow profile site assignment mismatch.");
  }

  if (profile.references.providerReference !== "provider-n8n") {
    throw new Error("PageEngines authority rejected workflow provider scope mismatch.");
  }

  const workflowCredentialReference = nonEmpty(profile.references.credentialReference);
  if (!workflowCredentialReference || workflowCredentialReference !== wordpressCredentialReference) {
    throw new Error("PageEngines authority rejected credential scope mismatch.");
  }

  const workflowId = nonEmpty(profile.references.workflowReference);
  if (!workflowId) {
    throw new Error("PageEngines dispatch requires a workflow profile workflow reference.");
  }
  if (workflowId === input.fallbackWorkflowId) {
    throw new Error("PageEngines dispatch rejected LED Warehouse workflow binding.");
  }

  const product = getProductById(input.productId);
  if (!product || product.organizationId !== input.organizationId) {
    throw new Error("PageEngines authority rejected product mismatch.");
  }
  if (!product.assignedSiteIds.includes(site.siteId)) {
    throw new Error("PageEngines authority rejected product-to-site assignment mismatch.");
  }

  return {
    organizationId: input.organizationId,
    siteId: site.siteId,
    productId: input.productId,
    workflowProfileReference,
    wordpressCredentialReference,
    wordpressHost: expectedWordPressHost(input.environment),
    workflowId,
  };
}

function assertDispatchConstraints(input: {
  request: GlwN8nDraftRequest;
  binding: PageenginesAuthorityBinding;
}): void {
  if (input.request.workspaceId !== input.binding.organizationId) {
    throw new Error("PageEngines dispatch rejected organization scope mismatch.");
  }
  if (input.request.site.id !== input.binding.siteId) {
    throw new Error("PageEngines dispatch rejected site scope mismatch.");
  }
  if (input.request.page.productId !== input.binding.productId) {
    throw new Error("PageEngines dispatch rejected product scope mismatch.");
  }
  if (input.request.page.pageType !== "general_service") {
    throw new Error("PageEngines dispatch requires general_service page type for the first homepage draft.");
  }
  if (input.request.operation !== "CREATE_GENERAL" || input.request.wordpressObjectId) {
    throw new Error("PageEngines dispatch requires create-only authority with no WordPress object override.");
  }
  if (input.request.publishingSettings.status !== "draft" || input.request.page.status !== "draft") {
    throw new Error("PageEngines dispatch rejected non-draft publication intent.");
  }
  assertPageenginesCompositionContract(input.request.workflowContext.additionalInstructions);
  assertPageenginesHostMatches({
    expectedHost: input.binding.wordpressHost,
    siteDomain: input.request.site.domain,
    siteCanonicalUrl: input.request.site.canonicalUrl,
    siteWordPressApiBaseUrl: input.request.site.wordpressApiBaseUrl,
  });
}

export function resolveWorkflowIdForDispatch(input: {
  request: GlwN8nDraftRequest;
  environment?: NodeJS.ProcessEnv;
  fallbackWorkflowId: string;
}): string {
  const environment = input.environment ?? process.env;
  const configuredHost = expectedWordPressHost(environment);
  const isPageenginesCandidate = siteLooksLikePageengines({
    workspaceId: input.request.workspaceId,
    siteId: input.request.site.id,
    siteDomain: input.request.site.domain,
    siteCanonicalUrl: input.request.site.canonicalUrl,
    siteWordPressApiBaseUrl: input.request.site.wordpressApiBaseUrl,
    expectedWordPressHost: configuredHost,
  });
  if (!isPageenginesCandidate) return input.fallbackWorkflowId;

  const binding = resolvePageenginesBindingFromFoundation({
    organizationId: input.request.workspaceId,
    siteId: input.request.site.id,
    productId: input.request.page.productId,
    fallbackWorkflowId: input.fallbackWorkflowId,
    environment,
  });

  assertDispatchConstraints({
    request: input.request,
    binding,
  });

  return binding.workflowId;
}

export function resolveApprovedInstructionsForDispatch(input: {
  request: GlwN8nDraftRequest;
  environment?: NodeJS.ProcessEnv;
  fallbackWorkflowId: string;
}): GlwN8nDraftRequest["approvedInstructions"] | undefined {
  const environment = input.environment ?? process.env;
  const configuredHost = expectedWordPressHost(environment);
  const isPageenginesCandidate = siteLooksLikePageengines({
    workspaceId: input.request.workspaceId,
    siteId: input.request.site.id,
    siteDomain: input.request.site.domain,
    siteCanonicalUrl: input.request.site.canonicalUrl,
    siteWordPressApiBaseUrl: input.request.site.wordpressApiBaseUrl,
    expectedWordPressHost: configuredHost,
  });
  if (!isPageenginesCandidate) return undefined;

  const binding = resolvePageenginesBindingFromFoundation({
    organizationId: input.request.workspaceId,
    siteId: input.request.site.id,
    productId: input.request.page.productId,
    fallbackWorkflowId: input.fallbackWorkflowId,
    environment,
  });
  assertDispatchConstraints({ request: input.request, binding });

  const site = getSiteById(binding.siteId);
  if (!site) throw new Error("PageEngines authority rejected missing site foundation record.");
  const strictMode = approvedInstructionsRequired(environment);
  const brandProfileId = nonEmpty(site.profiles.brandProfileReference);
  const seoProfileId = nonEmpty(site.profiles.seoProfileReference);
  const promptProfileId = nonEmpty(site.profiles.promptProfileReference);
  const imageProfileId = nonEmpty(site.profiles.imageProfileReference);
  if (!brandProfileId || !seoProfileId || !promptProfileId || !imageProfileId) {
    if (strictMode) {
      throw new Error("PageEngines approved instructions require brand/seo/prompt/image profile bindings.");
    }
    return undefined;
  }

  const profileRecords = {
    brand: getIntegrationProfileById(brandProfileId),
    seo: getIntegrationProfileById(seoProfileId),
    prompt: getIntegrationProfileById(promptProfileId),
    image: getIntegrationProfileById(imageProfileId),
  } as const;
  if (!profileRecords.brand || !profileRecords.seo || !profileRecords.prompt || !profileRecords.image) {
    if (strictMode) throw new Error("PageEngines approved instruction profiles are missing.");
    return undefined;
  }

  const requestSiteId = input.request.site.id;
  const expectedOrgId = input.request.workspaceId;
  const validateProfile = (name: keyof typeof profileRecords, expectedType: "brand" | "seo" | "prompt" | "image") => {
    const profile = profileRecords[name]!;
    if (profile.organizationId !== expectedOrgId) throw new Error(`PageEngines ${name} profile organization mismatch.`);
    if (profile.profileType !== expectedType) throw new Error(`PageEngines ${name} profile type mismatch.`);
    if (profile.status !== "active" || !profile.enabled) throw new Error(`PageEngines ${name} profile is not ready.`);
    if (!profile.assignedSiteIds.includes(requestSiteId)) throw new Error(`PageEngines ${name} profile site assignment mismatch.`);
  };
  validateProfile("brand", "brand");
  validateProfile("seo", "seo");
  validateProfile("prompt", "prompt");
  validateProfile("image", "image");

  const approvedInstructions: GlwN8nDraftRequest["approvedInstructions"] = {
    source: {
      organizationId: expectedOrgId,
      siteId: requestSiteId,
      brandProfileId,
      seoProfileId,
      promptProfileId,
      imageProfileId,
    },
    brand: toInstructionLines(profileRecords.brand.notes),
    seo: toInstructionLines(profileRecords.seo.notes),
    prompt: toInstructionLines(profileRecords.prompt.notes),
    image: toInstructionLines(profileRecords.image.notes),
    constraints: [
      "Draft-only output. Never publish.",
      "Approved PageEngines profiles only; reject cross-organization content.",
    ],
  };
  if (!approvedInstructions.brand.length
    || !approvedInstructions.seo.length
    || !approvedInstructions.prompt.length
    || !approvedInstructions.image.length) {
    throw new Error("PageEngines approved instructions must include all profile instruction groups.");
  }
  const sizeBytes = Buffer.byteLength(JSON.stringify(approvedInstructions), "utf8");
  if (sizeBytes > MAX_APPROVED_INSTRUCTIONS_BYTES) {
    throw new Error("PageEngines approved instructions payload exceeds limit.");
  }
  return approvedInstructions;
}

function assertMutationConstraints(input: {
  request: GlwGenerationRequest;
  binding: PageenginesAuthorityBinding;
  siteRecord: SiteConfiguration;
}): void {
  if (input.request.organizationId !== input.binding.organizationId || input.siteRecord.organizationId !== input.binding.organizationId) {
    throw new Error("PageEngines authority rejected organization mismatch.");
  }
  if (input.request.siteId !== input.binding.siteId || input.siteRecord.siteId !== input.binding.siteId) {
    throw new Error("PageEngines authority rejected site mismatch.");
  }
  if (input.request.productId !== input.binding.productId) {
    throw new Error("PageEngines authority rejected product mismatch.");
  }
  if (input.siteRecord.integrations.workflowReference !== input.binding.workflowProfileReference) {
    throw new Error("PageEngines authority rejected workflow profile mismatch.");
  }
  if (input.siteRecord.integrations.wordpressCredentialReference !== input.binding.wordpressCredentialReference) {
    throw new Error("PageEngines authority rejected credential scope mismatch.");
  }
  assertPageenginesHostMatches({
    expectedHost: input.binding.wordpressHost,
    siteDomain: input.siteRecord.domain,
    siteCanonicalUrl: input.siteRecord.canonicalUrl,
    siteWordPressApiBaseUrl: input.siteRecord.integrations.wordpressApiBaseUrl,
  });
  if (input.request.publicationIntent !== "draft") {
    throw new Error("PageEngines authority rejected non-draft publication intent.");
  }
  if (input.request.pageType !== "general_service") {
    throw new Error("PageEngines authority requires general_service page type for the first homepage draft.");
  }
  if (input.request.plannedOperation !== "CREATE_GENERAL" || input.request.wordpressObjectId) {
    throw new Error("PageEngines authority requires create-only homepage draft initialization.");
  }
  assertPageenginesCompositionContract(input.request.additionalInstructions);
}

export function assertPageenginesMutationAuthorityBinding(input: {
  request: GlwGenerationRequest;
  siteRecord: SiteConfiguration;
  environment?: NodeJS.ProcessEnv;
}): void {
  const environment = input.environment ?? process.env;
  const configuredHost = expectedWordPressHost(environment);
  const candidate = siteLooksLikePageengines({
    workspaceId: input.request.organizationId,
    siteId: input.request.siteId,
    siteDomain: input.siteRecord.domain,
    siteCanonicalUrl: input.siteRecord.canonicalUrl,
    siteWordPressApiBaseUrl: input.siteRecord.integrations.wordpressApiBaseUrl,
    expectedWordPressHost: configuredHost,
  });
  if (!candidate) return;

  const binding = resolvePageenginesBindingFromFoundation({
    organizationId: input.request.organizationId,
    siteId: input.request.siteId,
    productId: input.request.productId,
    fallbackWorkflowId: "__not_used_for_mutation_guard__",
    environment,
  });

  assertMutationConstraints({
    request: input.request,
    binding,
    siteRecord: input.siteRecord,
  });
}
