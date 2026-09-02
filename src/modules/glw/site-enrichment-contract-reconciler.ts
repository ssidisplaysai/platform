import "server-only";

import {
  GLW_STATE_SERVICE_RESEARCH_CONTRACT_VERSION,
  evaluateGlwResearchContractCompatibility,
} from "@/modules/glw/site-enrichment-contract-guard";
import type {
  GlwResearchRequirement,
  GlwSiteEnrichmentRecord,
} from "@/modules/glw/site-enrichment-repository";
import {
  buildGlwStateServiceResearchPlan,
  type GlwStateServiceResearchPlanInput,
} from "@/modules/glw/site-enrichment-research-planner";

export type GlwResearchContractReconciliation = {
  siteId: string;
  canonicalPath: string;
  stateCode: string;
  status: GlwSiteEnrichmentRecord["status"];
  compatibleBefore: boolean;
  contractVersion: typeof GLW_STATE_SERVICE_RESEARCH_CONTRACT_VERSION;
  missingRequirementIds: readonly string[];
  obsoleteRequirementIds: readonly string[];
  duplicateRequirementIds: readonly string[];
  requirementsBefore: number;
  requirementsAfter: number;
  changed: boolean;
  nextRequirements: readonly GlwResearchRequirement[];
};

function preserveFulfillment(
  planned: readonly GlwResearchRequirement[],
  existing: readonly GlwResearchRequirement[],
): readonly GlwResearchRequirement[] {
  const existingById = new Map(
    existing.map((requirement) => [
      requirement.requirementId,
      requirement,
    ]),
  );

  return planned.map((requirement) => {
    const previous = existingById.get(
      requirement.requirementId,
    );

    if (!previous) return requirement;

    return {
      ...requirement,
      fulfilledSourceIds:
        requirement.kind === "source"
          ? [...previous.fulfilledSourceIds]
          : [],
      fulfilledLinkIds:
        requirement.kind === "source"
          ? []
          : [...previous.fulfilledLinkIds],
    };
  });
}

export function previewGlwResearchContractReconciliation(input: {
  record: GlwSiteEnrichmentRecord;
  plannerInput: GlwStateServiceResearchPlanInput;
}): GlwResearchContractReconciliation {
  const { record, plannerInput } = input;

  if (
    record.organizationId !== plannerInput.organizationId
    || record.siteId !== plannerInput.siteId
    || record.productId !== plannerInput.productId
    || record.campaignId !== plannerInput.campaignId
    || record.stateCode !== plannerInput.stateCode.trim().toUpperCase()
    || record.canonicalPath !== plannerInput.canonicalPath
    || record.jobId !== plannerInput.jobId
    || record.wordpressObjectId !== plannerInput.wordpressObjectId
  ) {
    throw new Error(
      "Research contract reconciliation identity does not match the persisted record.",
    );
  }

  if (record.pageType !== "state_service") {
    throw new Error(
      "Research contract reconciliation supports state_service records only.",
    );
  }

  if (record.status === "enriched") {
    throw new Error(
      "Certified enrichment cannot be contract-reconciled in place.",
    );
  }

  const compatibility =
    evaluateGlwResearchContractCompatibility(record);
  const planned = buildGlwStateServiceResearchPlan(
    plannerInput,
  );
  const nextRequirements = preserveFulfillment(
    planned.researchRequirements,
    record.researchRequirements,
  );

  const actualIds = record.researchRequirements.map(
    (requirement) => requirement.requirementId,
  );
  const nextIds = nextRequirements.map(
    (requirement) => requirement.requirementId,
  );

  return {
    siteId: record.siteId,
    canonicalPath: record.canonicalPath,
    stateCode: record.stateCode,
    status: record.status,
    compatibleBefore: compatibility.compatible,
    contractVersion: GLW_STATE_SERVICE_RESEARCH_CONTRACT_VERSION,
    missingRequirementIds:
      compatibility.missingRequirementIds,
    obsoleteRequirementIds:
      compatibility.obsoleteRequirementIds,
    duplicateRequirementIds:
      compatibility.duplicateRequirementIds,
    requirementsBefore:
      record.researchRequirements.length,
    requirementsAfter:
      nextRequirements.length,
    changed:
      actualIds.length !== nextIds.length
      || actualIds.some(
        (requirementId, index) =>
          requirementId !== nextIds[index],
      ),
    nextRequirements,
  };
}

export function assertGlwResearchMigrationScope(input: {
  preview: readonly GlwResearchContractReconciliation[];
  authorizedCanonicalPaths: readonly string[];
}): void {
  const authorized = new Set(
    input.authorizedCanonicalPaths,
  );
  const changed = input.preview.filter(
    (item) => item.changed,
  );

  for (const item of changed) {
    if (!authorized.has(item.canonicalPath)) {
      throw new Error(
        `Research contract migration scope violation for ${item.canonicalPath}.`,
      );
    }
  }

  const changedPaths = new Set(
    changed.map((item) => item.canonicalPath),
  );
  for (const path of authorized) {
    if (!changedPaths.has(path)) {
      throw new Error(
        `Authorized research contract migration path ${path} does not require reconciliation.`,
      );
    }
  }
}
