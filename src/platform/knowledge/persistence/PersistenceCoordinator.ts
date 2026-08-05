import {
  KnowledgeError,
  createDefaultKnowledgeMetrics,
  createDefaultKnowledgePersistedState,
  type KnowledgeAuditRecord,
  type KnowledgeId,
  type KnowledgeMetrics,
  type KnowledgePersistedState,
  type KnowledgeRecord,
  type TenantId,
} from "../contracts";
import type { KnowledgeStore } from "./types";

function computeMetrics(state: KnowledgePersistedState): KnowledgeMetrics {
  const metrics = structuredClone(state.metrics ?? createDefaultKnowledgeMetrics());
  metrics.knowledgeTotal = state.knowledge.length;
  metrics.draftKnowledge = state.knowledge.filter((item) => item.lifecycle.status === "DRAFT").length;
  metrics.activeKnowledge = state.knowledge.filter((item) => item.lifecycle.status === "ACTIVE").length;
  metrics.archivedKnowledge = state.knowledge.filter((item) => item.lifecycle.status === "ARCHIVED").length;
  metrics.retiredKnowledge = state.knowledge.filter((item) => item.lifecycle.status === "RETIRED").length;
  metrics.registeredKnowledge = state.knowledge.filter((item) => item.governance.state === "REGISTERED").length;
  metrics.verifiedKnowledge = state.knowledge.filter((item) => item.governance.state === "VERIFIED").length;
  metrics.attestedKnowledge = state.knowledge.filter((item) => item.governance.state === "ATTESTED").length;
  metrics.auditEvents = state.audits.length;
  return metrics;
}

function validateStateOrThrow(state: KnowledgePersistedState): void {
  if (state.schemaVersion !== "1.0.0") {
    throw new KnowledgeError("STATE_CORRUPT", "unsupported knowledge state schema", false, true, "CRITICAL");
  }

  const knowledgeIds = new Set<string>();
  const identityKeys = new Set<string>();
  for (const item of state.knowledge) {
    if (!item.knowledgeId || !item.tenantId || !item.identityKey || !item.displayName) {
      throw new KnowledgeError("STATE_CORRUPT", `invalid knowledge record: ${item.knowledgeId}`, false, true, "CRITICAL");
    }
    if (knowledgeIds.has(item.knowledgeId)) {
      throw new KnowledgeError("STATE_CORRUPT", `duplicate knowledge id: ${item.knowledgeId}`, false, true, "CRITICAL");
    }

    const scopedKey = `${item.tenantId}:${item.identityKey}`;
    if (identityKeys.has(scopedKey)) {
      throw new KnowledgeError("STATE_CORRUPT", `duplicate identity key in tenant scope: ${scopedKey}`, false, true, "CRITICAL");
    }

    knowledgeIds.add(item.knowledgeId);
    identityKeys.add(scopedKey);
  }
}

export class PersistenceCoordinator {
  private state: KnowledgePersistedState = createDefaultKnowledgePersistedState();

  constructor(private readonly store: KnowledgeStore) {}

  async load(): Promise<void> {
    try {
      this.state = await this.store.load();
      validateStateOrThrow(this.state);
      this.state.metrics = computeMetrics(this.state);
      this.state.metrics.recoveryCount += 1;
      await this.store.save(this.state);
    } catch (error) {
      if (error instanceof KnowledgeError) {
        if (this.state?.metrics) {
          this.state.metrics.corruptStateCount += 1;
        }
        throw error;
      }
      throw new KnowledgeError("RECOVERY_FAILURE", "knowledge recovery failed", false, true, "CRITICAL");
    }
  }

  snapshot(): KnowledgePersistedState {
    return structuredClone(this.state);
  }

  listKnowledge(tenantId?: TenantId): KnowledgeRecord[] {
    return this.state.knowledge
      .filter((item) => (tenantId ? item.tenantId === tenantId : true))
      .map((item) => structuredClone(item));
  }

  getKnowledge(knowledgeId: KnowledgeId): KnowledgeRecord | undefined {
    const found = this.state.knowledge.find((item) => item.knowledgeId === knowledgeId);
    return found ? structuredClone(found) : undefined;
  }

  async mutate(mutator: (state: KnowledgePersistedState) => void): Promise<void> {
    const next = this.snapshot();
    mutator(next);
    validateStateOrThrow(next);
    next.metrics = computeMetrics(next);

    try {
      await this.store.save(next);
    } catch {
      throw new KnowledgeError("PERSISTENCE_FAILURE", "knowledge persistence save failed", true, true, "HIGH");
    }

    this.state = next;
  }

  async appendAudit(record: KnowledgeAuditRecord): Promise<void> {
    await this.mutate((state) => {
      state.audits.push(record);
    });
  }
}
