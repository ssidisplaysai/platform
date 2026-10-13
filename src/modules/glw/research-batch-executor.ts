import "server-only";

import {
  validateGlwResearchBatch,
  type GlwResearchBatchEnvelope,
} from "@/modules/glw/research-batch-authority";
import {
  executeGlwSiteEnrichmentResearch,
  type GlwResearchProvider,
} from "@/modules/glw/site-enrichment-research-executor";
import {
  listGlwSiteEnrichmentRecords,
} from "@/modules/glw/site-enrichment-repository";

export type GlwResearchBatchItemResult = {
  stateCode: string;
  canonicalPath: string;
  ok: boolean;
  providerInvoked: boolean;
  researchReady: boolean;
  status: string;
  error: string | null;
};

export type GlwResearchBatchResult = {
  total: number;
  succeeded: number;
  failed: number;
  researchReady: number;
  items: readonly GlwResearchBatchItemResult[];
  wordpressMutationPerformed: false;
  generationPerformed: false;
  certificationPerformed: false;
  publicationPerformed: false;
};

export async function executeGlwBoundedResearchBatch(input: {
  envelope: GlwResearchBatchEnvelope;
  provider: GlwResearchProvider;
}): Promise<GlwResearchBatchResult> {
  // Validate the complete batch before the first provider invocation.
  const records = listGlwSiteEnrichmentRecords({
    campaignId: input.envelope.requests[0]?.campaignId,
    siteId: input.envelope.requests[0]?.siteId,
  });
  const requests = validateGlwResearchBatch({
    envelope: input.envelope,
    records,
  });

  const items: GlwResearchBatchItemResult[] = [];

  // Deliberately sequential. Individual provider/evidence failures are isolated
  // to their state after the complete batch has passed the fail-closed preflight.
  for (const request of requests) {
    try {
      const result = await executeGlwSiteEnrichmentResearch({
        request,
        provider: input.provider,
      });
      items.push({
        stateCode: request.stateCode,
        canonicalPath: request.canonicalPath,
        ok: true,
        providerInvoked: result.providerInvoked,
        researchReady: result.researchReady,
        status: result.record.status,
        error: null,
      });
    } catch (error) {
      items.push({
        stateCode: request.stateCode,
        canonicalPath: request.canonicalPath,
        ok: false,
        providerInvoked: true,
        researchReady: false,
        status: "research_pending",
        error: error instanceof Error ? error.message : "Research execution failed.",
      });
    }
  }

  return {
    total: items.length,
    succeeded: items.filter((item) => item.ok).length,
    failed: items.filter((item) => !item.ok).length,
    researchReady: items.filter((item) => item.researchReady).length,
    items,
    wordpressMutationPerformed: false,
    generationPerformed: false,
    certificationPerformed: false,
    publicationPerformed: false,
  };
}
