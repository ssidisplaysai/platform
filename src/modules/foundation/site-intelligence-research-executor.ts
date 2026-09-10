import "server-only";

import type { SiteIntelligenceEvidence, SiteOpportunity } from "./site-intelligence";
import { queueSiteResearchExecution, updateSiteResearchExecution } from "./site-intelligence-repository";

export type SiteResearchAuthority = { organizationId: string; siteId: string; domain: string; publicBrandIdentity: string; brandProfileId: string; seoProfileId: string; promptProfileId: string; imageProfileId: string };
export type SiteResearchProviderOutput = { organizationId: string; siteId: string; executionId: string; evidence: SiteIntelligenceEvidence[]; opportunities: SiteOpportunity[] };
export type SiteResearchProvider = { providerId: string; execute(input: { executionId: string; authority: SiteResearchAuthority; focusOpportunityId: string | null; signal: AbortSignal }): Promise<SiteResearchProviderOutput> };

function validateOutput(output: SiteResearchProviderOutput, executionId: string, authority: SiteResearchAuthority) {
  if (output.executionId !== executionId || output.siteId !== authority.siteId || output.organizationId !== authority.organizationId) throw new Error("RESEARCH_PROVIDER_IDENTITY_MISMATCH");
  const evidenceIds = new Set(output.evidence.map((item) => item.evidenceId));
  if (output.evidence.length === 0 || output.opportunities.length === 0) throw new Error("RESEARCH_PROVIDER_EVIDENCE_REQUIRED");
  for (const opportunity of output.opportunities) {
    if (opportunity.evidenceIds.length === 0 || opportunity.evidenceIds.some((id) => !evidenceIds.has(id))) throw new Error("RESEARCH_PROVIDER_PROVENANCE_MISMATCH");
    opportunity.capabilityState = "OWNER_VALIDATION_REQUIRED"; opportunity.capabilityEvidenceIds = []; opportunity.ownerDecision = "PENDING"; opportunity.decidedAt = null; opportunity.decidedBy = null;
  }
  return output;
}

export async function executeSiteIntelligenceResearch(input: { authority: SiteResearchAuthority; provider: SiteResearchProvider; actor: string; expectedRevision: number; focusOpportunityId?: string | null; timeoutMs?: number; maxAttempts?: number }) {
  let workspace = queueSiteResearchExecution({ organizationId: input.authority.organizationId, siteId: input.authority.siteId, expectedRevision: input.expectedRevision, actor: input.actor, reason: input.focusOpportunityId ? "Owner requested focused opportunity research." : "Owner explicitly started site intelligence.", providerReference: input.provider.providerId, kind: input.focusOpportunityId ? "OPPORTUNITY_CONTINUATION" : "INITIAL", focusOpportunityId: input.focusOpportunityId, timeoutMs: input.timeoutMs ?? 120_000, maxAttempts: input.maxAttempts ?? 2 });
  const execution = (workspace.researchExecutions ?? []).at(-1)!;
  if (execution.state !== "QUEUED") return workspace;
  for (let attempt = 1; attempt <= execution.maxAttempts; attempt += 1) {
    workspace = updateSiteResearchExecution({ organizationId: input.authority.organizationId, siteId: input.authority.siteId, expectedRevision: workspace.revision, actor: input.actor, reason: `Research attempt ${attempt}.`, executionId: execution.executionId, state: "RESEARCHING", attemptCount: attempt });
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), execution.timeoutMs);
    try {
      const output = validateOutput(await input.provider.execute({ executionId: execution.executionId, authority: input.authority, focusOpportunityId: input.focusOpportunityId ?? null, signal: controller.signal }), execution.executionId, input.authority);
      clearTimeout(timeout);
      return updateSiteResearchExecution({ organizationId: input.authority.organizationId, siteId: input.authority.siteId, expectedRevision: workspace.revision, actor: input.actor, reason: "Evidence-backed research ready for owner review.", executionId: execution.executionId, state: "READY_FOR_REVIEW", attemptCount: attempt, evidence: output.evidence, opportunities: output.opportunities });
    } catch (error) {
      clearTimeout(timeout);
      if (attempt === execution.maxAttempts) return updateSiteResearchExecution({ organizationId: input.authority.organizationId, siteId: input.authority.siteId, expectedRevision: workspace.revision, actor: input.actor, reason: "Bounded research attempts exhausted.", executionId: execution.executionId, state: "RECOVERABLE", attemptCount: attempt, errorCode: error instanceof DOMException && error.name === "AbortError" ? "PROVIDER_TIMEOUT" : "PROVIDER_FAILED", errorMessage: error instanceof Error ? error.message : "Provider failed." });
    }
  }
  return workspace;
}