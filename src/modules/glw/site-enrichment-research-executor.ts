import "server-only";

import {
  type GlwEnrichmentClaim,
  type GlwEnrichmentLink,
  type GlwEnrichmentPlan,
  type GlwEnrichmentSource,
  type GlwEnrichmentSourceTier,
} from "@/modules/glw/site-enrichment-authority";
import {
  assertGlwResearchContractCompatible,
} from "@/modules/glw/site-enrichment-contract-guard";
import {
  applyGlwSiteEnrichmentResearchEvidence,
  getGlwSiteEnrichmentRecord,
  type GlwResearchRequirement,
  type GlwSiteEnrichmentRecord,
} from "@/modules/glw/site-enrichment-repository";

export type GlwResearchExecutionRequest = {
  organizationId: string;
  siteId: string;
  campaignId: string;
  productId: string;
  stateCode: string;
  canonicalPath: string;
  jobId: string;
  wordpressObjectId: string;
};

export type GlwResearchAcquisition = {
  organizationId: string;
  siteId: string;
  campaignId: string;
  productId: string;
  stateCode: string;
  canonicalPath: string;
  jobId: string;
  wordpressObjectId: string;
  sources: readonly GlwEnrichmentSource[];
  claims: readonly GlwEnrichmentClaim[];
  links: readonly GlwEnrichmentLink[];
  fulfillment: Readonly<Record<string, { sourceIds?: readonly string[]; linkIds?: readonly string[] }>>;
};

export type GlwResearchProvider = {
  research(input: GlwResearchExecutionRequest): Promise<GlwResearchAcquisition>;
};

export type GlwResearchExecutionResult = {
  record: GlwSiteEnrichmentRecord;
  providerInvoked: true;
  researchReady: boolean;
  wordpressMutationPerformed: false;
  generationPerformed: false;
  publicationPerformed: false;
  certificationPerformed: false;
};

function normalizedDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].replace(/\.$/, "");
}

function urlDomain(value: string): string | null {
  try {
    return normalizedDomain(new URL(value).hostname);
  } catch {
    return null;
  }
}

function assertExecutionIdentity(record: GlwSiteEnrichmentRecord, request: GlwResearchExecutionRequest): void {
  if (
    record.organizationId !== request.organizationId
    || record.siteId !== request.siteId
    || record.campaignId !== request.campaignId
    || record.productId !== request.productId
    || record.stateCode !== request.stateCode.trim().toUpperCase()
    || record.canonicalPath !== request.canonicalPath
    || record.jobId !== request.jobId
    || record.wordpressObjectId !== request.wordpressObjectId
  ) {
    throw new Error("Research execution identity does not match the persisted enrichment work item.");
  }
}

function assertAcquisitionIdentity(request: GlwResearchExecutionRequest, acquisition: GlwResearchAcquisition): void {
  if (
    acquisition.organizationId !== request.organizationId
    || acquisition.siteId !== request.siteId
    || acquisition.campaignId !== request.campaignId
    || acquisition.productId !== request.productId
    || acquisition.stateCode !== request.stateCode.trim().toUpperCase()
    || acquisition.canonicalPath !== request.canonicalPath
    || acquisition.jobId !== request.jobId
    || acquisition.wordpressObjectId !== request.wordpressObjectId
  ) {
    throw new Error("Research provider returned evidence for a different page identity.");
  }
}

function assertUniqueIds(values: readonly string[], label: string): void {
  const unique = new Set(values);
  if (unique.size !== values.length) throw new Error(`Research provider returned duplicate ${label} identifiers.`);
  if (values.some((value) => !value.trim())) throw new Error(`Research provider returned an empty ${label} identifier.`);
}

function assertSources(sources: readonly GlwEnrichmentSource[]): Map<string, GlwEnrichmentSource> {
  assertUniqueIds(sources.map((source) => source.sourceId), "source");
  const sourceMap = new Map<string, GlwEnrichmentSource>();
  for (const source of sources) {
    const domain = urlDomain(source.url);
    if (!source.url.startsWith("https://") || !domain || domain !== normalizedDomain(source.domain)) {
      throw new Error(`Research source ${source.sourceId} has an invalid HTTPS URL/domain identity.`);
    }
    if (!source.title.trim() || !source.publisher.trim() || !source.retrievedAt.trim()) {
      throw new Error(`Research source ${source.sourceId} is missing required provenance.`);
    }
    sourceMap.set(source.sourceId, source);
  }
  return sourceMap;
}

function assertClaims(claims: readonly GlwEnrichmentClaim[], sourceMap: ReadonlyMap<string, GlwEnrichmentSource>): void {
  assertUniqueIds(claims.map((claim) => claim.claimId), "claim");
  for (const claim of claims) {
    if (!claim.statement.trim() || claim.evidenceSourceIds.length === 0) throw new Error(`Research claim ${claim.claimId} has no evidence.`);
    for (const sourceId of claim.evidenceSourceIds) {
      if (!sourceMap.has(sourceId)) throw new Error(`Research claim ${claim.claimId} references unknown evidence ${sourceId}.`);
    }
  }
}

function assertLinks(links: readonly GlwEnrichmentLink[], sourceMap: ReadonlyMap<string, GlwEnrichmentSource>): Map<string, GlwEnrichmentLink> {
  assertUniqueIds(links.map((link) => link.linkId), "link");
  const linkMap = new Map<string, GlwEnrichmentLink>();
  for (const link of links) {
    if (!link.href.trim() || !link.anchorText.trim()) throw new Error(`Research link ${link.linkId} is incomplete.`);
    if (link.kind === "internal") {
      if (!link.href.startsWith("/") || link.href.startsWith("//")) throw new Error(`Internal research link ${link.linkId} must be site-relative.`);
    } else {
      if (!link.href.startsWith("https://") || !urlDomain(link.href)) throw new Error(`External research link ${link.linkId} must use HTTPS.`);
      if (!link.sourceId || !sourceMap.has(link.sourceId)) throw new Error(`External research link ${link.linkId} must resolve to stored evidence.`);
    }
    linkMap.set(link.linkId, link);
  }
  return linkMap;
}

function sourceHasTier(sourceId: string, requiredTier: GlwEnrichmentSourceTier | null | undefined, sourceMap: ReadonlyMap<string, GlwEnrichmentSource>): boolean {
  return requiredTier ? sourceMap.get(sourceId)?.tier === requiredTier : sourceMap.has(sourceId);
}

function linkMatchesRequirement(requirement: GlwResearchRequirement, link: GlwEnrichmentLink, upstreamAuthorityDomains: readonly string[]): boolean {
  if (requirement.kind === "internal_link") return link.kind === "internal";
  if (requirement.kind === "external_link") return link.kind === "external_authority";
  if (requirement.kind === "upstream_link") {
    const domain = urlDomain(link.href);
    return link.kind === "upstream_source_of_truth" && Boolean(domain) && upstreamAuthorityDomains.map(normalizedDomain).includes(domain ?? "");
  }
  return false;
}

function fulfillRequirements(input: {
  requirements: readonly GlwResearchRequirement[];
  acquisition: GlwResearchAcquisition;
  sourceMap: ReadonlyMap<string, GlwEnrichmentSource>;
  linkMap: ReadonlyMap<string, GlwEnrichmentLink>;
  upstreamAuthorityDomains: readonly string[];
}): GlwResearchRequirement[] {
  const knownRequirementIds = new Set(input.requirements.map((requirement) => requirement.requirementId));
  for (const requirementId of Object.keys(input.acquisition.fulfillment)) {
    if (!knownRequirementIds.has(requirementId)) throw new Error(`Research provider attempted to fulfill unknown requirement ${requirementId}.`);
  }
  return input.requirements.map((requirement) => {
    const fulfillment = input.acquisition.fulfillment[requirement.requirementId];
    const sourceIds = Array.from(new Set(fulfillment?.sourceIds ?? []));
    const linkIds = Array.from(new Set(fulfillment?.linkIds ?? []));
    if (requirement.kind === "source") {
      for (const sourceId of sourceIds) {
        if (!sourceHasTier(sourceId, requirement.sourceTier, input.sourceMap)) throw new Error(`Research requirement ${requirement.requirementId} was fulfilled with an invalid source tier.`);
      }
      return { ...requirement, fulfilledSourceIds: sourceIds, fulfilledLinkIds: [] };
    }
    for (const linkId of linkIds) {
      const link = input.linkMap.get(linkId);
      if (!link || !linkMatchesRequirement(requirement, link, input.upstreamAuthorityDomains)) throw new Error(`Research requirement ${requirement.requirementId} was fulfilled with an invalid link.`);
    }
    return { ...requirement, fulfilledSourceIds: [], fulfilledLinkIds: linkIds };
  });
}

function mergeById<T>(existing: readonly T[], incoming: readonly T[], id: (value: T) => string): T[] {
  const merged = new Map<string, T>();
  for (const value of existing) merged.set(id(value), value);
  for (const value of incoming) merged.set(id(value), value);
  return [...merged.values()];
}

export async function executeGlwSiteEnrichmentResearch(input: {
  request: GlwResearchExecutionRequest;
  provider: GlwResearchProvider;
  now?: Date;
}): Promise<GlwResearchExecutionResult> {
  const record = getGlwSiteEnrichmentRecord({ siteId: input.request.siteId, canonicalPath: input.request.canonicalPath });
  if (!record) throw new Error("Research work item was not found.");
  if (record.status !== "research_pending") throw new Error(`Research execution requires research_pending status; found ${record.status}.`);

  assertExecutionIdentity(record, input.request);

  // Fail closed before any paid or external provider invocation. Persisted
  // requirements must match the currently certified state-service contract.
  assertGlwResearchContractCompatible(record);

  const acquisition = await input.provider.research(input.request);
  assertAcquisitionIdentity(input.request, acquisition);
  const sourceMap = assertSources(acquisition.sources);
  assertClaims(acquisition.claims, sourceMap);
  const linkMap = assertLinks(acquisition.links, sourceMap);
  const researchRequirements = fulfillRequirements({
    requirements: record.researchRequirements,
    acquisition,
    sourceMap,
    linkMap,
    upstreamAuthorityDomains: record.upstreamAuthorityDomains,
  });
  const plan: GlwEnrichmentPlan = {
    ...record.plan,
    sources: mergeById(record.plan.sources, acquisition.sources, (source) => source.sourceId),
    claims: mergeById(record.plan.claims, acquisition.claims, (claim) => claim.claimId),
    links: mergeById(record.plan.links, acquisition.links, (link) => link.linkId),
  };
  const updated = applyGlwSiteEnrichmentResearchEvidence({
    siteId: record.siteId,
    canonicalPath: record.canonicalPath,
    researchRequirements,
    plan,
    now: input.now,
  });
  return {
    record: updated,
    providerInvoked: true,
    researchReady: updated.status === "research_ready",
    wordpressMutationPerformed: false,
    generationPerformed: false,
    publicationPerformed: false,
    certificationPerformed: false,
  };
}
