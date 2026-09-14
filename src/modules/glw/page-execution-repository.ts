import "server-only";

import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import {
  GlwUnknownExecutionError,
  type GlwPageExecutionRecord,
  type GlwPageExecutionRepository,
} from "./page-execution";

const PERSISTENCE_NAMESPACE = "glw-page-execution-repository";

type RepositoryState = {
  records: GlwPageExecutionRecord[];
};

let stateRevision = 0;
const recordStore = new Map<string, GlwPageExecutionRecord>();

function applyState(state: RepositoryState) {
  recordStore.clear();
  state.records.forEach((record) => recordStore.set(record.jobId, deepClone(record)));
}

function snapshotState(): RepositoryState {
  return { records: Array.from(recordStore.values()).map((record) => deepClone(record)) };
}

const loaded = loadPersistedState<RepositoryState>({
  namespace: PERSISTENCE_NAMESPACE,
  seedFactory: () => ({ records: [] }),
});
applyState(loaded.state);
stateRevision = loaded.revision;

function reloadState() {
  const current = loadPersistedState<RepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: () => ({ records: [] }),
  });
  applyState(current.state);
  stateRevision = current.revision;
}

function persistState() {
  const saved = savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });
  stateRevision = saved.revision;
}

export const glwPageExecutionRepository: GlwPageExecutionRepository = {
  async create(record) {
    reloadState();
    if (recordStore.has(record.jobId)) {
      throw new Error(`GLW job already exists: ${record.jobId}`);
    }
    recordStore.set(record.jobId, deepClone(record));
    persistState();
    return deepClone(record);
  },
  async getById(jobId) {
    reloadState();
    const record = recordStore.get(jobId);
    return record ? deepClone(record) : null;
  },
  async list() {
    reloadState();
    return Array.from(recordStore.values(), (record) => deepClone(record));
  },
  async update(jobId, patch) {
    reloadState();
    const record = recordStore.get(jobId);
    if (!record) throw new GlwUnknownExecutionError(`Unknown GLW job: ${jobId}`);
    const updated = { ...record, ...deepClone(patch), jobId };
    recordStore.set(jobId, updated);
    persistState();
    return deepClone(updated);
  },
};

export async function reconcileGlwPageExecutionPublished(input: {
  jobId: string;
  wordpressObjectId: string;
  wordpressUrl: string | null;
  publicationVerification?: Readonly<Record<string, unknown>>;
}): Promise<GlwPageExecutionRecord> {
  const record = await glwPageExecutionRepository.getById(input.jobId);

  if (
    !record
    || record.status !== "COMPLETE"
    || record.wordpressStatus !== "draft"
    || record.wordpressObjectId !== input.wordpressObjectId
  ) {
    throw new Error(
      "Execution publication reconciliation requires the exact completed draft record.",
    );
  }

  return glwPageExecutionRepository.update(input.jobId, {
    wordpressStatus: "publish",
    wordpressUrl: input.wordpressUrl,
    qaChecks: input.publicationVerification
      ? {
          ...(record.qaChecks ?? {}),
          publicationVerification: input.publicationVerification,
        }
      : record.qaChecks,
    updatedAt: new Date().toISOString(),
  });
}

export async function reconcileGlwPageExecutionDraftAfterPublicationFailure(input: { jobId: string; wordpressObjectId: string; wordpressUrl: string | null; reason: string }): Promise<GlwPageExecutionRecord> {
  const record = await glwPageExecutionRepository.getById(input.jobId); if (!record || record.status !== "COMPLETE" || record.wordpressStatus !== "publish" || record.wordpressObjectId !== input.wordpressObjectId) throw new Error("Execution publication rollback requires the exact published record.");
  return glwPageExecutionRepository.update(input.jobId, { wordpressStatus: "draft", wordpressUrl: input.wordpressUrl, qaChecks: { ...(record.qaChecks ?? {}), publicationVerification: { state: "REVOKED", reason: input.reason, rolledBackAt: new Date().toISOString() } }, updatedAt: new Date().toISOString() });
}

export async function reconcileGlwOrphanedPageExecution(input: {
  jobId: string;
  externalExecutionId: string;
  n8nExecutionNotRetained: true;
  campaignTargetBindingAbsent: true;
  activeLeaseAbsent: true;
  reconciledBy: string;
  reconciledAt?: string;
}): Promise<GlwPageExecutionRecord> {
  const record = await glwPageExecutionRepository.getById(input.jobId);
  if (!record || (record.status !== "DISPATCHED" && record.status !== "RUNNING")) {
    throw new Error("Orphan reconciliation requires an exact dispatched or running execution record.");
  }
  if (!input.externalExecutionId.trim() || record.externalExecutionId !== input.externalExecutionId.trim()) {
    throw new Error("Orphan reconciliation requires the exact external execution identity.");
  }
  if (!input.reconciledBy.trim()) throw new Error("Orphan reconciliation requires an actor.");

  const reconciledAt = input.reconciledAt ?? new Date().toISOString();
  const receipt = {
    receiptId: `orphan-reconciliation-${record.jobId}`,
    classification: "ORPHANED" as const,
    priorStatus: record.status,
    externalExecutionId: record.externalExecutionId,
    n8nExecutionNotRetained: input.n8nExecutionNotRetained,
    campaignTargetBindingAbsent: input.campaignTargetBindingAbsent,
    activeLeaseAbsent: input.activeLeaseAbsent,
    wordpressMutationPerformed: false as const,
    dispatchPerformed: false as const,
    reconciledAt,
    reconciledBy: input.reconciledBy.trim(),
  };

  return glwPageExecutionRepository.update(record.jobId, {
    status: "FAILED",
    errorCode: "EXECUTION_ORPHANED",
    errorMessage: "The historical n8n execution is no longer retained and has no campaign target binding or active lease.",
    disposition: "FAILED",
    qaChecks: { ...(record.qaChecks ?? {}), operationalReconciliation: receipt },
    updatedAt: reconciledAt,
    completedAt: reconciledAt,
  });
}