import "server-only";

import {
  evaluateGlwResearchContractCompatibility,
  type GlwResearchContractCompatibility,
} from "@/modules/glw/site-enrichment-contract-guard";
import {
  assertGlwResearchMigrationScope,
  previewGlwResearchContractReconciliation,
  type GlwResearchContractReconciliation,
} from "@/modules/glw/site-enrichment-contract-reconciler";
import type {
  GlwStateServiceResearchPlanInput,
} from "@/modules/glw/site-enrichment-research-planner";
import type {
  GlwSiteEnrichmentRecord,
} from "@/modules/glw/site-enrichment-repository";

export type GlwCampaignResearchContractDryRunItem = {
  stateCode: string;
  canonicalPath: string;
  status: GlwSiteEnrichmentRecord["status"];
  compatibility: GlwResearchContractCompatibility;
  reconciliation: GlwResearchContractReconciliation;
};

export type GlwCampaignResearchContractDryRun = {
  campaignId: string;
  siteId: string;
  totalRecords: number;
  compatibleRecords: number;
  incompatibleRecords: number;
  changedRecords: number;
  changedCanonicalPaths: readonly string[];
  providerInvocationAllowed: boolean;
  items: readonly GlwCampaignResearchContractDryRunItem[];
};

function assertPlannerIdentity(
  record: GlwSiteEnrichmentRecord,
  plannerInput: GlwStateServiceResearchPlanInput,
): void {
  if (
    plannerInput.organizationId !== record.organizationId
    || plannerInput.siteId !== record.siteId
    || plannerInput.productId !== record.productId
    || plannerInput.campaignId !== record.campaignId
    || plannerInput.stateCode.trim().toUpperCase() !== record.stateCode
    || plannerInput.canonicalPath !== record.canonicalPath
    || plannerInput.jobId !== record.jobId
    || plannerInput.wordpressObjectId !== record.wordpressObjectId
  ) {
    throw new Error(
      `Campaign contract dry-run planner identity mismatch for ${record.canonicalPath}.`,
    );
  }
}

export function buildGlwCampaignResearchContractDryRun(input: {
  records: readonly GlwSiteEnrichmentRecord[];
  plannerInputForRecord: (
    record: GlwSiteEnrichmentRecord,
  ) => GlwStateServiceResearchPlanInput;
}): GlwCampaignResearchContractDryRun {
  if (input.records.length === 0) {
    throw new Error("Campaign contract dry-run requires at least one record.");
  }

  const campaignId = input.records[0].campaignId;
  const siteId = input.records[0].siteId;

  if (
    input.records.some(
      (record) =>
        record.campaignId !== campaignId
        || record.siteId !== siteId,
    )
  ) {
    throw new Error(
      "Campaign contract dry-run cannot mix campaigns or sites.",
    );
  }

  const seenPaths = new Set<string>();
  const items = input.records
    .map((record) => {
      if (seenPaths.has(record.canonicalPath)) {
        throw new Error(
          `Campaign contract dry-run contains duplicate canonical path ${record.canonicalPath}.`,
        );
      }
      seenPaths.add(record.canonicalPath);

      const plannerInput = input.plannerInputForRecord(record);
      assertPlannerIdentity(record, plannerInput);

      return {
        stateCode: record.stateCode,
        canonicalPath: record.canonicalPath,
        status: record.status,
        compatibility: evaluateGlwResearchContractCompatibility(record),
        reconciliation: previewGlwResearchContractReconciliation({
          record,
          plannerInput,
        }),
      };
    })
    .sort((left, right) =>
      left.stateCode.localeCompare(right.stateCode),
    );

  const changedCanonicalPaths = items
    .filter((item) => item.reconciliation.changed)
    .map((item) => item.canonicalPath)
    .sort();

  return {
    campaignId,
    siteId,
    totalRecords: items.length,
    compatibleRecords: items.filter(
      (item) => item.compatibility.compatible,
    ).length,
    incompatibleRecords: items.filter(
      (item) => !item.compatibility.compatible,
    ).length,
    changedRecords: changedCanonicalPaths.length,
    changedCanonicalPaths,
    providerInvocationAllowed:
      items.every((item) => item.compatibility.compatible),
    items,
  };
}

export function assertGlwCampaignResearchMigrationScope(input: {
  dryRun: GlwCampaignResearchContractDryRun;
  authorizedCanonicalPaths: readonly string[];
}): void {
  assertGlwResearchMigrationScope({
    preview: input.dryRun.items.map(
      (item) => item.reconciliation,
    ),
    authorizedCanonicalPaths: input.authorizedCanonicalPaths,
  });
}
