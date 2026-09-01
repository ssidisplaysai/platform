import "server-only";

import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

import {
  evaluateGlwEnrichmentPlan,
  type GlwEnrichmentPlan,
  type GlwEnrichmentQaResult,
  type GlwEnrichmentSourceTier,
} from "@/modules/glw/site-enrichment-authority";

const PERSISTENCE_NAMESPACE =
  "glw-site-enrichment-repository";

export type GlwResearchRequirementKind =
  | "source"
  | "internal_link"
  | "external_link"
  | "upstream_link";

export type GlwResearchRequirement = {
  requirementId: string;
  kind: GlwResearchRequirementKind;
  label: string;
  description: string;
  required: boolean;
  sourceTier?: GlwEnrichmentSourceTier | null;
  minimumCount: number;
  fulfilledSourceIds: readonly string[];
  fulfilledLinkIds: readonly string[];
};

export type GlwSiteEnrichmentRecordStatus =
  | "research_pending"
  | "research_ready"
  | "qa_failed"
  | "enriched";

export type GlwSiteEnrichmentRecord = {
  enrichmentId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  campaignId: string;
  stateCode: string;
  pageType: "state_service";
  canonicalPath: string;
  jobId: string;
  wordpressObjectId: string;
  upstreamAuthorityDomains: readonly string[];
  status: GlwSiteEnrichmentRecordStatus;
  researchRequirements:
    readonly GlwResearchRequirement[];
  plan: GlwEnrichmentPlan;
  qa: GlwEnrichmentQaResult | null;
  createdAt: string;
  updatedAt: string;
};

type RepositoryState = {
  records: GlwSiteEnrichmentRecord[];
};

const recordStore =
  new Map<string, GlwSiteEnrichmentRecord>();

let stateRevision = 0;

function key(
  siteId: string,
  canonicalPath: string,
): string {
  return `${siteId}::${canonicalPath}`;
}

function applyState(
  state: RepositoryState,
): void {
  recordStore.clear();

  for (const record of state.records) {
    recordStore.set(
      key(
        record.siteId,
        record.canonicalPath,
      ),
      deepClone(record),
    );
  }
}

function snapshotState(): RepositoryState {
  return {
    records: Array.from(
      recordStore.values(),
      (record) => deepClone(record),
    ),
  };
}

function loadState(): void {
  const loaded =
    loadPersistedState<RepositoryState>({
      namespace: PERSISTENCE_NAMESPACE,
      seedFactory: () => ({
        records: [],
      }),
    });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistState(): void {
  const saved = savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });

  stateRevision = saved.revision;
}

function requirementFulfilled(
  requirement: GlwResearchRequirement,
): boolean {
  const fulfillmentCount =
    requirement.kind === "source"
      ? requirement.fulfilledSourceIds.length
      : requirement.fulfilledLinkIds.length;

  return fulfillmentCount >= requirement.minimumCount;
}

function allRequiredResearchFulfilled(
  requirements:
    readonly GlwResearchRequirement[],
): boolean {
  return requirements
    .filter((requirement) => requirement.required)
    .every(requirementFulfilled);
}

loadState();

export function resetGlwSiteEnrichmentRepositoryForTests(): void {
  resetPersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: () => ({
      records: [],
    }),
  });

  loadState();
}

export function listGlwSiteEnrichmentRecords(
  input: {
    campaignId?: string;
    siteId?: string;
  } = {},
): readonly GlwSiteEnrichmentRecord[] {
  loadState();

  return Array.from(recordStore.values())
    .filter((record) =>
      !input.campaignId
      || record.campaignId === input.campaignId,
    )
    .filter((record) =>
      !input.siteId
      || record.siteId === input.siteId,
    )
    .map((record) => deepClone(record));
}

export function getGlwSiteEnrichmentRecord(
  input: {
    siteId: string;
    canonicalPath: string;
  },
): GlwSiteEnrichmentRecord | null {
  loadState();

  const record = recordStore.get(
    key(
      input.siteId,
      input.canonicalPath,
    ),
  );

  return record
    ? deepClone(record)
    : null;
}

export function initializeGlwSiteEnrichmentRecord(
  input: {
    enrichmentId: string;
    organizationId: string;
    siteId: string;
    productId: string;
    campaignId: string;
    stateCode: string;
    canonicalPath: string;
    jobId: string;
    wordpressObjectId: string;
    upstreamAuthorityDomains:
      readonly string[];
    researchRequirements:
      readonly GlwResearchRequirement[];
    plan: GlwEnrichmentPlan;
    now?: Date;
  },
): GlwSiteEnrichmentRecord {
  loadState();

  const recordKey = key(
    input.siteId,
    input.canonicalPath,
  );

  const existing =
    recordStore.get(recordKey);

  if (existing) {
    const sameIdentity =
      existing.organizationId
        === input.organizationId
      && existing.productId
        === input.productId
      && existing.campaignId
        === input.campaignId
      && existing.stateCode
        === input.stateCode
          .trim()
          .toUpperCase()
      && existing.jobId === input.jobId
      && existing.wordpressObjectId
        === input.wordpressObjectId;

    if (!sameIdentity) {
      throw new Error(
        "Existing enrichment record does not match the supplied page identity.",
      );
    }

    return deepClone(existing);
  }

  const timestamp =
    (input.now ?? new Date())
      .toISOString();

  const record:
    GlwSiteEnrichmentRecord = {
      enrichmentId: input.enrichmentId,
      organizationId:
        input.organizationId,
      siteId: input.siteId,
      productId: input.productId,
      campaignId: input.campaignId,
      stateCode:
        input.stateCode
          .trim()
          .toUpperCase(),
      pageType: "state_service",
      canonicalPath:
        input.canonicalPath,
      jobId: input.jobId,
      wordpressObjectId:
        input.wordpressObjectId,
      upstreamAuthorityDomains: [
        ...input.upstreamAuthorityDomains,
      ],
      status: "research_pending",
      researchRequirements:
        deepClone(
          input.researchRequirements,
        ),
      plan: deepClone(input.plan),
      qa: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

  recordStore.set(
    recordKey,
    record,
  );

  persistState();

  return deepClone(record);
}

export function updateGlwSiteEnrichmentResearch(
  input: {
    siteId: string;
    canonicalPath: string;
    researchRequirements:
      readonly GlwResearchRequirement[];
    now?: Date;
  },
): GlwSiteEnrichmentRecord {
  loadState();

  const recordKey = key(
    input.siteId,
    input.canonicalPath,
  );

  const current =
    recordStore.get(recordKey);

  if (!current) {
    throw new Error(
      "Enrichment record was not found.",
    );
  }

  if (
    current.status === "enriched"
  ) {
    throw new Error(
      "Certified enrichment cannot return to research without a new enrichment revision.",
    );
  }

  const timestamp =
    (input.now ?? new Date())
      .toISOString();

  const researchRequirements =
    deepClone(
      input.researchRequirements,
    );

  const status:
    GlwSiteEnrichmentRecordStatus =
      allRequiredResearchFulfilled(
        researchRequirements,
      )
        ? "research_ready"
        : "research_pending";

  const updated:
    GlwSiteEnrichmentRecord = {
      ...current,
      researchRequirements,
      status,
      qa: null,
      updatedAt: timestamp,
    };

  recordStore.set(
    recordKey,
    updated,
  );

  persistState();

  return deepClone(updated);
}

export function certifyGlwSiteEnrichmentPlan(
  input: {
    siteId: string;
    canonicalPath: string;
    plan: GlwEnrichmentPlan;
    now?: Date;
  },
): GlwSiteEnrichmentRecord {
  loadState();

  const recordKey = key(
    input.siteId,
    input.canonicalPath,
  );

  const current =
    recordStore.get(recordKey);

  if (!current) {
    throw new Error(
      "Enrichment record was not found.",
    );
  }

  if (
    !allRequiredResearchFulfilled(
      current.researchRequirements,
    )
  ) {
    throw new Error(
      "Required research must be fulfilled before enrichment certification.",
    );
  }

  if (
    input.plan.organizationId
      !== current.organizationId
    || input.plan.siteId
      !== current.siteId
    || input.plan.canonicalPath
      !== current.canonicalPath
  ) {
    throw new Error(
      "Enrichment plan does not match the persisted page identity.",
    );
  }

  const qa =
    evaluateGlwEnrichmentPlan(
      input.plan,
    );

  const timestamp =
    (input.now ?? new Date())
      .toISOString();

  const updated:
    GlwSiteEnrichmentRecord = {
      ...current,
      plan: deepClone(input.plan),
      qa: deepClone(qa),
      status:
        qa.ok
          ? "enriched"
          : "qa_failed",
      updatedAt: timestamp,
    };

  recordStore.set(
    recordKey,
    updated,
  );

  persistState();

  return deepClone(updated);
}