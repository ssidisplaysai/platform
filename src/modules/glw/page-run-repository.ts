import "server-only";

import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import {
  GlwPageRunTransitionError,
  advanceGlwPageRun,
  createGlwPageRun,
  isGlwPageRunTerminal,
  type GlwPageRunRecord,
  type GlwPageRunRepository,
  type GlwPageRunStatus,
  type GlwPageRunTransition,
} from "./page-run";

const PERSISTENCE_NAMESPACE = "glw-page-run-repository-v1";

type RepositoryState = {
  runs: GlwPageRunRecord[];
  activeRunIdByTargetId: Record<string, string>;
};

let stateRevision = 0;
const runStore = new Map<string, GlwPageRunRecord>();
const activeRunIdByTargetId = new Map<string, string>();

function applyState(state: RepositoryState): void {
  runStore.clear();
  activeRunIdByTargetId.clear();

  for (const run of state.runs) {
    runStore.set(run.runId, deepClone(run));
  }

  for (const [targetId, runId] of Object.entries(state.activeRunIdByTargetId)) {
    if (runStore.has(runId)) activeRunIdByTargetId.set(targetId, runId);
  }
}

function snapshotState(): RepositoryState {
  return {
    runs: Array.from(runStore.values(), (run) => deepClone(run)),
    activeRunIdByTargetId: Object.fromEntries(activeRunIdByTargetId.entries()),
  };
}

function reloadState(): void {
  const loaded = loadPersistedState<RepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: () => ({ runs: [], activeRunIdByTargetId: {} }),
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

function getRequiredRun(runId: string): GlwPageRunRecord {
  const run = runStore.get(runId);
  if (!run) throw new GlwPageRunTransitionError(`Unknown PageRun: ${runId}`);
  return run;
}

reloadState();

export const glwPageRunRepository: GlwPageRunRepository = {
  async create(record) {
    reloadState();
    if (runStore.has(record.runId)) {
      throw new GlwPageRunTransitionError(`PageRun already exists: ${record.runId}`);
    }

    const activeRunId = activeRunIdByTargetId.get(record.targetId);
    if (activeRunId) {
      const active = runStore.get(activeRunId);
      if (active && !isGlwPageRunTerminal(active.status)) {
        throw new GlwPageRunTransitionError("Target already has an active PageRun.");
      }
    }

    runStore.set(record.runId, deepClone(record));
    activeRunIdByTargetId.set(record.targetId, record.runId);
    persistState();
    return deepClone(record);
  },

  async getById(runId) {
    reloadState();
    const record = runStore.get(runId);
    return record ? deepClone(record) : null;
  },

  async getActiveByTarget(targetId) {
    reloadState();
    const runId = activeRunIdByTargetId.get(targetId);
    if (!runId) return null;
    const record = runStore.get(runId);
    return record ? deepClone(record) : null;
  },

  async listByCampaign(campaignId) {
    reloadState();
    return Array.from(runStore.values())
      .filter((record) => record.campaignId === campaignId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((record) => deepClone(record));
  },

  async transition(runId, expectedStatus, transition) {
    reloadState();
    const record = getRequiredRun(runId);

    if (record.status !== expectedStatus) {
      throw new GlwPageRunTransitionError(
        `PageRun status changed: expected ${expectedStatus}, found ${record.status}`,
      );
    }

    const updated = advanceGlwPageRun(record, transition);
    runStore.set(runId, updated);
    persistState();
    return deepClone(updated);
  },

  async abandonAndReplace(input) {
    reloadState();
    const current = getRequiredRun(input.activeRunId);

    if (activeRunIdByTargetId.get(current.targetId) !== current.runId) {
      throw new GlwPageRunTransitionError("PageRun is no longer active for its target.");
    }
    if (current.wordpressObjectId) {
      throw new GlwPageRunTransitionError(
        "Discard and regenerate is blocked after WordPress draft creation; resolve the draft first.",
      );
    }
    if (isGlwPageRunTerminal(current.status)) {
      throw new GlwPageRunTransitionError("Terminal PageRun cannot be abandoned.");
    }

    const abandoned = advanceGlwPageRun(current, {
      to: "ABANDONED",
      reason: input.reason,
    });

    const replacement = createGlwPageRun({
      runId: input.replacementRunId,
      identity: current,
      previousRunId: current.runId,
    });

    runStore.set(current.runId, abandoned);
    runStore.set(replacement.runId, replacement);
    activeRunIdByTargetId.set(current.targetId, replacement.runId);
    persistState();

    return deepClone(replacement);
  },
};

export function assertGlwPageRunStatus(
  record: GlwPageRunRecord,
  expectedStatus: GlwPageRunStatus,
): GlwPageRunRecord {
  if (record.status !== expectedStatus) {
    throw new GlwPageRunTransitionError(
      `PageRun status mismatch: expected ${expectedStatus}, found ${record.status}`,
    );
  }
  return record;
}

export async function transitionGlwPageRun(
  runId: string,
  expectedStatus: GlwPageRunStatus,
  transition: GlwPageRunTransition,
): Promise<GlwPageRunRecord> {
  return glwPageRunRepository.transition(runId, expectedStatus, transition);
}
