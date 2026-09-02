import "server-only";

import {
  evaluateGlwResearchContractCompatibility,
} from "@/modules/glw/site-enrichment-contract-guard";
import type {
  GlwResearchExecutionRequest,
} from "@/modules/glw/site-enrichment-research-executor";
import type {
  GlwSiteEnrichmentRecord,
} from "@/modules/glw/site-enrichment-repository";

export const GLW_RESEARCH_BATCH_CONFIRMATION =
  "EXECUTE_LED_WAREHOUSE_INDOOR_SPHERE_RESEARCH_BATCH_V1" as const;

export const GLW_RESEARCH_BATCH_CAMPAIGN_ID =
  "campaign-led-display-warehouse-site-led-display-warehouse-production-indoor-led-sphere-50-states" as const;
export const GLW_RESEARCH_BATCH_SITE_ID =
  "site-led-display-warehouse-production" as const;
export const GLW_RESEARCH_BATCH_ORGANIZATION_ID =
  "led-display-warehouse" as const;
export const GLW_RESEARCH_BATCH_PRODUCT_ID =
  "prod-indoor-digital-sphere" as const;

export const GLW_RESEARCH_BATCH_ALLOWED_STATES = [
  "AK", "AL", "AR", "AZ", "CT", "DE", "FL", "GA", "HI",
] as const;

const allowedStates = new Set<string>(GLW_RESEARCH_BATCH_ALLOWED_STATES);

export type GlwResearchBatchEnvelope = {
  confirm: typeof GLW_RESEARCH_BATCH_CONFIRMATION;
  requests: readonly GlwResearchExecutionRequest[];
};

function exactIdentity(
  record: GlwSiteEnrichmentRecord,
  request: GlwResearchExecutionRequest,
): boolean {
  return record.organizationId === request.organizationId
    && record.siteId === request.siteId
    && record.campaignId === request.campaignId
    && record.productId === request.productId
    && record.stateCode === request.stateCode.trim().toUpperCase()
    && record.canonicalPath === request.canonicalPath
    && record.jobId === request.jobId
    && record.wordpressObjectId === request.wordpressObjectId;
}

export function validateGlwResearchBatch(input: {
  envelope: GlwResearchBatchEnvelope;
  records: readonly GlwSiteEnrichmentRecord[];
}): readonly GlwResearchExecutionRequest[] {
  if (input.envelope.confirm !== GLW_RESEARCH_BATCH_CONFIRMATION) {
    throw new Error("Exact GLW bounded research batch confirmation is required.");
  }
  if (input.envelope.requests.length === 0 || input.envelope.requests.length > 9) {
    throw new Error("GLW bounded research batch requires between one and nine requests.");
  }

  const byPath = new Map(input.records.map((record) => [record.canonicalPath, record]));
  const seenStates = new Set<string>();
  const seenPaths = new Set<string>();

  for (const request of input.envelope.requests) {
    const stateCode = request.stateCode.trim().toUpperCase();
    if (stateCode === "CO") throw new Error("Colorado is excluded from the bounded research batch.");
    if (!allowedStates.has(stateCode)) throw new Error(`State ${stateCode} is not authorized for this bounded research batch.`);
    if (seenStates.has(stateCode) || seenPaths.has(request.canonicalPath)) {
      throw new Error("GLW bounded research batch contains a duplicate state or canonical path.");
    }
    seenStates.add(stateCode);
    seenPaths.add(request.canonicalPath);

    if (
      request.organizationId !== GLW_RESEARCH_BATCH_ORGANIZATION_ID
      || request.siteId !== GLW_RESEARCH_BATCH_SITE_ID
      || request.campaignId !== GLW_RESEARCH_BATCH_CAMPAIGN_ID
      || request.productId !== GLW_RESEARCH_BATCH_PRODUCT_ID
    ) {
      throw new Error(`Research batch identity is outside the certified campaign boundary for ${stateCode}.`);
    }

    const record = byPath.get(request.canonicalPath);
    if (!record || !exactIdentity(record, request)) {
      throw new Error(`Research batch identity does not match persisted record for ${stateCode}.`);
    }
    if (record.status !== "research_pending") {
      throw new Error(`Research batch requires research_pending status for ${stateCode}; found ${record.status}.`);
    }
    if (!evaluateGlwResearchContractCompatibility(record).compatible) {
      throw new Error(`Research contract is incompatible for ${stateCode}; provider invocation blocked.`);
    }
  }

  return input.envelope.requests.map((request) => ({
    ...request,
    stateCode: request.stateCode.trim().toUpperCase(),
  }));
}
