import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type {
  CapabilityEvidenceState,
  EvidenceAuthority,
  EvidenceStrength,
  OpportunityDecision,
  SiteIntelligenceEvidence,
  SiteOpportunity,
} from "./site-intelligence";
import { isUnsafePublicAddress } from "./public-network-address";

export const SITE_INTELLIGENCE_PROVIDER_CONTRACT_VERSION = "SITE_INTELLIGENCE_PROVIDER_CONTRACT_V1" as const;
export const SITE_INTELLIGENCE_WORKFLOW_ID = "genesis-site-intelligence-v1" as const;
export const SITE_INTELLIGENCE_PROVIDER_ID = "n8n-site-intelligence-v1" as const;
export const SITE_INTELLIGENCE_OBJECTIVES = ["market_competitors", "verticals_niches", "search_terminology", "competitor_structure"] as const;
export const MAX_RESPONSE_BYTES = 1_000_000;
export const SITE_INTELLIGENCE_PROVIDER_LIMITS = { maxResponseBytes: MAX_RESPONSE_BYTES, maxEvidence: 100, maxOpportunities: 25, maxCompetitorEntitiesPerOpportunity: 20, maxEvidenceIdsPerOpportunity: 25, maxStringLengthGeneral: 10_000, maxIdLength: 200, maxShortStringLength: 500, maxDomainLength: 253 } as const;
export type SiteIntelligenceExecutionMode = "INITIAL" | "OPPORTUNITY_CONTINUATION";
export type SiteIntelligenceProviderContractErrorCode = "RESEARCH_PROVIDER_CONTRACT_MISMATCH" | "RESEARCH_PROVIDER_RESPONSE_INVALID" | "RESEARCH_PROVIDER_RESPONSE_TOO_LARGE" | "RESEARCH_PROVIDER_IDENTITY_MISMATCH";

export class SiteIntelligenceProviderContractError extends Error {
  constructor(public readonly code: SiteIntelligenceProviderContractErrorCode, public readonly detail: string) {
    super(`${code}:${detail}`);
    this.name = "SiteIntelligenceProviderContractError";
  }
}

export type SiteIntelligenceProviderRequestV1 = {
  contractVersion: typeof SITE_INTELLIGENCE_PROVIDER_CONTRACT_VERSION;
  workflowId: typeof SITE_INTELLIGENCE_WORKFLOW_ID;
  executionMode: SiteIntelligenceExecutionMode;
  identity: { executionId: string; organizationId: string; siteId: string };
  authority: { organizationId: string; siteId: string; domain: string; publicBrandIdentity: string; brandProfileId: string; seoProfileId: string; promptProfileId: string; imageProfileId: string };
  focusOpportunityId: string | null;
  objectives: typeof SITE_INTELLIGENCE_OBJECTIVES;
};

export type SiteIntelligenceProviderResponseV1 = {
  contractVersion: typeof SITE_INTELLIGENCE_PROVIDER_CONTRACT_VERSION;
  provider: { providerId: typeof SITE_INTELLIGENCE_PROVIDER_ID; providerExecutionId: string; completedAt: string };
  organizationId: string;
  siteId: string;
  executionId: string;
  evidence: SiteIntelligenceEvidence[];
  opportunities: SiteOpportunity[];
};

type Address = { address: string; family: number };
export type ProviderContractDependencies = { resolveHost?: (hostname: string) => Promise<Address[]> };

export function failSiteIntelligenceProviderContract(code: SiteIntelligenceProviderContractErrorCode, detail: string): never { throw new SiteIntelligenceProviderContractError(code, detail); }
const fail = failSiteIntelligenceProviderContract;
function record(value: unknown, path: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_object_required`); return value as Record<string, unknown>; }
function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string) { const unknown = Object.keys(value).filter((key) => !allowed.includes(key)); if (unknown.length) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_unexpected_${unknown[0]}`); }
function text(value: unknown, path: string, max = SITE_INTELLIGENCE_PROVIDER_LIMITS.maxStringLengthGeneral): string { if (typeof value !== "string" || !value.trim() || value.length > max) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_invalid`); return value.trim(); }
function nullableText(value: unknown, path: string, max = SITE_INTELLIGENCE_PROVIDER_LIMITS.maxShortStringLength): string | null { if (value === null) return null; return text(value, path, max); }
function finiteConfidence(value: unknown, path: string): number { if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_invalid`); return value; }
function bool(value: unknown, path: string): boolean { if (typeof value !== "boolean") fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_invalid`); return value; }
function enumeration<T extends string>(value: unknown, values: readonly T[], path: string): T { if (typeof value !== "string" || !values.includes(value as T)) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_invalid`); return value as T; }
function iso(value: unknown, path: string): string { const result = text(value, path, 64); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(result) || !Number.isFinite(Date.parse(result))) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_invalid`); return result; }
function stringArray(value: unknown, path: string, maxItems: number, maxString = SITE_INTELLIGENCE_PROVIDER_LIMITS.maxShortStringLength): string[] { if (!Array.isArray(value) || value.length > maxItems) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_invalid`); const result = value.map((item, index) => text(item, `${path}_${index}`, maxString)); if (new Set(result).size !== result.length) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_duplicate`); return result; }

async function publicHttpsSource(value: unknown, path: string, dependencies: ProviderContractDependencies): Promise<string> { const source = text(value, path); let url: URL; try { url = new URL(source); } catch { fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_url`); } if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port || url.hostname === "localhost" || url.hostname.endsWith(".localhost") || (isIP(url.hostname) !== 0 && isUnsafePublicAddress(url.hostname))) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_unsafe`); const resolveHost = dependencies.resolveHost ?? (async (hostname: string) => lookup(hostname, { all: true, verbatim: true })); let addresses: Address[]; try { addresses = await resolveHost(url.hostname); } catch { fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_dns`); } if (!addresses.length || addresses.some((item) => isUnsafePublicAddress(item.address))) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", `${path}_private`); return url.toString(); }

export function buildSiteIntelligenceProviderRequestV1(input: { executionId: string; executionMode: SiteIntelligenceExecutionMode; organizationId: string; siteId: string; domain: string; publicBrandIdentity: string; brandProfileId: string; seoProfileId: string; promptProfileId: string; imageProfileId: string; focusOpportunityId: string | null }): SiteIntelligenceProviderRequestV1 { if (input.executionMode !== "INITIAL" && input.executionMode !== "OPPORTUNITY_CONTINUATION") fail("RESEARCH_PROVIDER_CONTRACT_MISMATCH", "execution_mode"); const focus = input.focusOpportunityId === null ? null : text(input.focusOpportunityId, "focusOpportunityId", SITE_INTELLIGENCE_PROVIDER_LIMITS.maxIdLength); if ((input.executionMode === "INITIAL" && focus !== null) || (input.executionMode === "OPPORTUNITY_CONTINUATION" && focus === null)) fail("RESEARCH_PROVIDER_CONTRACT_MISMATCH", "execution_mode_focus"); const request = { contractVersion: SITE_INTELLIGENCE_PROVIDER_CONTRACT_VERSION, workflowId: SITE_INTELLIGENCE_WORKFLOW_ID, executionMode: input.executionMode, identity: { executionId: text(input.executionId, "identity.executionId", 200), organizationId: text(input.organizationId, "identity.organizationId", 100), siteId: text(input.siteId, "identity.siteId", 200) }, authority: { organizationId: text(input.organizationId, "authority.organizationId", 100), siteId: text(input.siteId, "authority.siteId", 200), domain: text(input.domain, "authority.domain", 253).toLowerCase(), publicBrandIdentity: text(input.publicBrandIdentity, "authority.publicBrandIdentity", 200), brandProfileId: text(input.brandProfileId, "authority.brandProfileId", 200), seoProfileId: text(input.seoProfileId, "authority.seoProfileId", 200), promptProfileId: text(input.promptProfileId, "authority.promptProfileId", 200), imageProfileId: text(input.imageProfileId, "authority.imageProfileId", 200) }, focusOpportunityId: focus, objectives: SITE_INTELLIGENCE_OBJECTIVES }; return request; }

export async function parseSiteIntelligenceProviderResponseV1(value: unknown, expected: SiteIntelligenceProviderRequestV1, dependencies: ProviderContractDependencies = {}): Promise<SiteIntelligenceProviderResponseV1> {
  const root = record(value, "response"); exactKeys(root, ["contractVersion", "provider", "organizationId", "siteId", "executionId", "evidence", "opportunities"], "response");
  if (root.contractVersion !== SITE_INTELLIGENCE_PROVIDER_CONTRACT_VERSION) fail("RESEARCH_PROVIDER_CONTRACT_MISMATCH", "contractVersion");
  const provider = record(root.provider, "provider"); exactKeys(provider, ["providerId", "providerExecutionId", "completedAt"], "provider"); if (provider.providerId !== SITE_INTELLIGENCE_PROVIDER_ID) fail("RESEARCH_PROVIDER_CONTRACT_MISMATCH", "providerId");
  const organizationId = text(root.organizationId, "organizationId", 100); const siteId = text(root.siteId, "siteId", 200); const executionId = text(root.executionId, "executionId", 200); if (organizationId !== expected.identity.organizationId || siteId !== expected.identity.siteId || executionId !== expected.identity.executionId) fail("RESEARCH_PROVIDER_IDENTITY_MISMATCH", "identity");
  if (!Array.isArray(root.evidence) || root.evidence.length === 0 || root.evidence.length > SITE_INTELLIGENCE_PROVIDER_LIMITS.maxEvidence) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", "evidence_bounds");
  const evidence: SiteIntelligenceEvidence[] = []; const evidenceIds = new Set<string>();
  for (let index = 0; index < root.evidence.length; index += 1) { const item = record(root.evidence[index], `evidence_${index}`); exactKeys(item, ["evidenceId", "sourceReference", "sourceType", "observedClaim", "retrievedAt", "entity", "confidence", "strength", "authority"], `evidence_${index}`); const evidenceId = text(item.evidenceId, `evidence_${index}.evidenceId`, 200); if (evidenceIds.has(evidenceId)) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", "duplicate_evidence_id"); evidenceIds.add(evidenceId); const sourceType = enumeration(item.sourceType, ["WEB", "OWNER_URL", "OWNER_DOCUMENT", "OWNER_IMAGE", "CONNECTED_SOURCE", "PROVIDER_OUTPUT"] as const, `evidence_${index}.sourceType`); const authority = enumeration<EvidenceAuthority>(item.authority, ["OBSERVATION", "INFERENCE", "OWNER_SUPPLIED_AUTHORITY"], `evidence_${index}.authority`); if (authority === "OWNER_SUPPLIED_AUTHORITY") fail("RESEARCH_PROVIDER_RESPONSE_INVALID", "provider_owner_authority_forbidden"); const sourceReference = sourceType === "WEB" || sourceType === "OWNER_URL" ? await publicHttpsSource(item.sourceReference, `evidence_${index}.sourceReference`, dependencies) : text(item.sourceReference, `evidence_${index}.sourceReference`, 1000); evidence.push({ evidenceId, sourceReference, sourceType, observedClaim: text(item.observedClaim, `evidence_${index}.observedClaim`), retrievedAt: iso(item.retrievedAt, `evidence_${index}.retrievedAt`), entity: nullableText(item.entity, `evidence_${index}.entity`), confidence: finiteConfidence(item.confidence, `evidence_${index}.confidence`), strength: enumeration<EvidenceStrength>(item.strength, ["WEAK", "MODERATE", "STRONG"], `evidence_${index}.strength`), authority }); }
  if (!Array.isArray(root.opportunities) || root.opportunities.length === 0 || root.opportunities.length > SITE_INTELLIGENCE_PROVIDER_LIMITS.maxOpportunities) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", "opportunity_bounds");
  const opportunities: SiteOpportunity[] = []; const opportunityIds = new Set<string>();
  for (let index = 0; index < root.opportunities.length; index += 1) { const item = record(root.opportunities[index], `opportunity_${index}`); const keys = ["opportunityId", "name", "category", "buyer", "problemUseCase", "commercialValue", "demandSignal", "competitionLevel", "organizationFit", "evidenceStrength", "confidence", "geographicScope", "nationalRolloutPotential", "recurringReplacementPotential", "seoContentOpportunity", "rationale", "competitorEntities", "evidenceIds", "capabilityState", "capabilityEvidenceIds", "capabilityNotes", "recommendation", "ownerDecision", "decidedBy", "decidedAt"]; exactKeys(item, keys, `opportunity_${index}`); const opportunityId = text(item.opportunityId, `opportunity_${index}.opportunityId`, 200); if (opportunityIds.has(opportunityId)) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", "duplicate_opportunity_id"); opportunityIds.add(opportunityId); const refs = stringArray(item.evidenceIds, `opportunity_${index}.evidenceIds`, 25, 200); if (!refs.length || refs.some((id) => !evidenceIds.has(id))) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", "unknown_evidence_reference"); const capabilityRefs = stringArray(item.capabilityEvidenceIds, "capabilityEvidenceIds", 25, 200); if (capabilityRefs.some((id) => !evidenceIds.has(id))) fail("RESEARCH_PROVIDER_RESPONSE_INVALID", "unknown_capability_evidence_reference"); const competitors = stringArray(item.competitorEntities, `opportunity_${index}.competitorEntities`, 20); opportunities.push({ opportunityId, name: text(item.name, `opportunity_${index}.name`, 500), category: text(item.category, `opportunity_${index}.category`, 200), buyer: text(item.buyer, `opportunity_${index}.buyer`, 500), problemUseCase: text(item.problemUseCase, `opportunity_${index}.problemUseCase`), commercialValue: enumeration(item.commercialValue, ["LOW", "MODERATE", "HIGH", "UNKNOWN"] as const, "commercialValue"), demandSignal: text(item.demandSignal, "demandSignal"), competitionLevel: enumeration(item.competitionLevel, ["LOW", "MODERATE", "HIGH", "UNKNOWN"] as const, "competitionLevel"), organizationFit: enumeration(item.organizationFit, ["LOW", "MODERATE", "HIGH", "UNKNOWN"] as const, "organizationFit"), evidenceStrength: enumeration<EvidenceStrength>(item.evidenceStrength, ["WEAK", "MODERATE", "STRONG"], "evidenceStrength"), confidence: finiteConfidence(item.confidence, "confidence"), geographicScope: text(item.geographicScope, "geographicScope"), nationalRolloutPotential: bool(item.nationalRolloutPotential, "nationalRolloutPotential"), recurringReplacementPotential: bool(item.recurringReplacementPotential, "recurringReplacementPotential"), seoContentOpportunity: text(item.seoContentOpportunity, "seoContentOpportunity"), rationale: text(item.rationale, "rationale"), competitorEntities: competitors, evidenceIds: refs, capabilityState: enumeration<CapabilityEvidenceState>(item.capabilityState, ["INSUFFICIENT", "OWNER_VALIDATION_REQUIRED", "VERIFIED", "QUALIFIED", "REJECTED", "FUTURE_CAPABILITY"], "capabilityState"), capabilityEvidenceIds: capabilityRefs, capabilityNotes: nullableText(item.capabilityNotes, "capabilityNotes"), recommendation: text(item.recommendation, "recommendation"), ownerDecision: enumeration<OpportunityDecision>(item.ownerDecision, ["PENDING", "APPROVED", "RESEARCH_MORE", "HOLD", "REJECTED"], "ownerDecision"), decidedBy: nullableText(item.decidedBy, "decidedBy", 200), decidedAt: item.decidedAt === null ? null : iso(item.decidedAt, "decidedAt") }); }
  return { contractVersion: SITE_INTELLIGENCE_PROVIDER_CONTRACT_VERSION, provider: { providerId: SITE_INTELLIGENCE_PROVIDER_ID, providerExecutionId: text(provider.providerExecutionId, "provider.providerExecutionId", 200), completedAt: iso(provider.completedAt, "provider.completedAt") }, organizationId, siteId, executionId, evidence, opportunities };
}