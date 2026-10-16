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

export type PageenginesDispatchConfiguration = {
  organizationId: string;
  siteId: string;
  productId: string;
  workflowProfileReference: string;
  wordpressCredentialReference: string;
  wordpressHost: string;
  workflowId: string | null;
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
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

export function resolvePageenginesDispatchConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): PageenginesDispatchConfiguration | null {
  const organizationId = nonEmpty(environment.GENESIS_PAGEENGINES_ORGANIZATION_ID);
  const siteId = nonEmpty(environment.GENESIS_PAGEENGINES_SITE_ID);
  const productId = nonEmpty(environment.GENESIS_PAGEENGINES_PRODUCT_ID);
  const workflowProfileReference = nonEmpty(environment.GENESIS_PAGEENGINES_WORKFLOW_PROFILE_REFERENCE);
  const wordpressCredentialReference = nonEmpty(environment.GENESIS_PAGEENGINES_WORDPRESS_CREDENTIAL_REFERENCE);
  const workflowId = nonEmpty(environment.GENESIS_PAGEENGINES_N8N_MCP_WORKFLOW_ID);
  const wordpressHost = expectedWordPressHost(environment);

  if (
    !organizationId
    || !siteId
    || !productId
    || !workflowProfileReference
    || !wordpressCredentialReference
  ) {
    return null;
  }

  return {
    organizationId,
    siteId,
    productId,
    workflowProfileReference,
    wordpressCredentialReference,
    wordpressHost,
    workflowId,
  };
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

  const configuration = resolvePageenginesDispatchConfiguration(environment);
  if (!configuration) {
    throw new Error(
      "PageEngines dispatch authority is not configured. Configure GENESIS_PAGEENGINES_ORGANIZATION_ID, GENESIS_PAGEENGINES_SITE_ID, GENESIS_PAGEENGINES_PRODUCT_ID, GENESIS_PAGEENGINES_WORKFLOW_PROFILE_REFERENCE, and GENESIS_PAGEENGINES_WORDPRESS_CREDENTIAL_REFERENCE before dispatch.",
    );
  }

  if (input.request.workspaceId !== configuration.organizationId) {
    throw new Error("PageEngines dispatch rejected organization scope mismatch.");
  }
  if (input.request.site.id !== configuration.siteId) {
    throw new Error("PageEngines dispatch rejected site scope mismatch.");
  }
  if (input.request.page.productId !== configuration.productId) {
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
    expectedHost: configuration.wordpressHost,
    siteDomain: input.request.site.domain,
    siteCanonicalUrl: input.request.site.canonicalUrl,
    siteWordPressApiBaseUrl: input.request.site.wordpressApiBaseUrl,
  });

  const workflowId = configuration.workflowId;
  if (!workflowId) {
    throw new Error("PageEngines dispatch requires GENESIS_PAGEENGINES_N8N_MCP_WORKFLOW_ID.");
  }
  if (workflowId === input.fallbackWorkflowId) {
    throw new Error("PageEngines dispatch rejected LED Warehouse workflow binding.");
  }
  return workflowId;
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

  const configuration = resolvePageenginesDispatchConfiguration(environment);
  if (!configuration) {
    throw new Error(
      "PageEngines authority binding is incomplete. Configure GENESIS_PAGEENGINES_ORGANIZATION_ID, GENESIS_PAGEENGINES_SITE_ID, GENESIS_PAGEENGINES_PRODUCT_ID, GENESIS_PAGEENGINES_WORKFLOW_PROFILE_REFERENCE, and GENESIS_PAGEENGINES_WORDPRESS_CREDENTIAL_REFERENCE.",
    );
  }

  if (input.request.organizationId !== configuration.organizationId || input.siteRecord.organizationId !== configuration.organizationId) {
    throw new Error("PageEngines authority rejected organization mismatch.");
  }
  if (input.request.siteId !== configuration.siteId || input.siteRecord.siteId !== configuration.siteId) {
    throw new Error("PageEngines authority rejected site mismatch.");
  }
  if (input.request.productId !== configuration.productId) {
    throw new Error("PageEngines authority rejected product mismatch.");
  }
  if (input.siteRecord.integrations.workflowReference !== configuration.workflowProfileReference) {
    throw new Error("PageEngines authority rejected workflow profile mismatch.");
  }
  if (input.siteRecord.integrations.wordpressCredentialReference !== configuration.wordpressCredentialReference) {
    throw new Error("PageEngines authority rejected credential scope mismatch.");
  }
  assertPageenginesHostMatches({
    expectedHost: configuration.wordpressHost,
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
