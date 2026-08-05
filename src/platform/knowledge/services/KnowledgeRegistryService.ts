import { randomUUID } from "node:crypto";
import {
  KnowledgeError,
  type KnowledgeActorContext,
  type KnowledgeId,
  type KnowledgeMetadata,
  type KnowledgeRecord,
  type KnowledgeLifecycleStatus,
  type TenantId,
} from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { KnowledgeAuditService } from "./KnowledgeAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeIdentityKey(input: string): string {
  return input.trim().toLowerCase();
}

export class KnowledgeRegistryService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: KnowledgeAuditService,
  ) {}

  listKnowledge(tenantId?: TenantId): KnowledgeRecord[] {
    return this.persistence.listKnowledge(tenantId);
  }

  getKnowledge(knowledgeId: KnowledgeId): KnowledgeRecord | undefined {
    return this.persistence.getKnowledge(knowledgeId);
  }

  async registerKnowledge(input: {
    tenantId: TenantId;
    identityKey: string;
    displayName: string;
    actor: KnowledgeActorContext;
    classification?: "POLICY" | "REFERENCE" | "CONTROL" | "EVIDENCE" | "OTHER";
    metadata?: KnowledgeMetadata;
  }): Promise<KnowledgeRecord> {
    if (!input.tenantId || !input.identityKey || !input.displayName) {
      throw new KnowledgeError("KNOWLEDGE_INVALID", "missing required knowledge registration fields", false, true, "HIGH");
    }

    const at = nowIso();
    const knowledgeId = `knowledge_${randomUUID()}`;
    const identityKey = normalizeIdentityKey(input.identityKey);

    const record: KnowledgeRecord = {
      knowledgeId,
      tenantId: input.tenantId,
      identityKey,
      displayName: input.displayName.trim(),
      classification: input.classification ?? "REFERENCE",
      metadata: structuredClone(input.metadata ?? {}),
      lifecycle: {
        status: "DRAFT",
        transitionedAt: at,
        transitionedBy: input.actor.actorId,
      },
      governance: {
        state: "REGISTERED",
      },
      createdAt: at,
      createdBy: input.actor.actorId,
      updatedAt: at,
      updatedBy: input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      const exists = state.knowledge.some((item) => item.tenantId === record.tenantId && item.identityKey === record.identityKey);
      if (exists) {
        throw new KnowledgeError("KNOWLEDGE_DUPLICATE", `duplicate identity key in tenant scope: ${record.identityKey}`, false, true, "HIGH");
      }
      state.knowledge.push(record);
    });

    await this.audit.append({
      eventType: "KNOWLEDGE_REGISTERED",
      tenantId: record.tenantId,
      knowledgeId: record.knowledgeId,
      actor: input.actor,
      message: `knowledge ${record.knowledgeId} registered`,
      details: {
        identityKey: record.identityKey,
        classification: record.classification,
      },
    });

    return this.requireKnowledge(record.knowledgeId);
  }

  async updateMetadata(input: {
    tenantId: TenantId;
    knowledgeId: KnowledgeId;
    metadata: KnowledgeMetadata;
    actor: KnowledgeActorContext;
  }): Promise<KnowledgeRecord> {
    await this.persistence.mutate((state) => {
      const record = state.knowledge.find((item) => item.knowledgeId === input.knowledgeId);
      if (!record) {
        throw new KnowledgeError("KNOWLEDGE_NOT_FOUND", `knowledge not found: ${input.knowledgeId}`, false, true, "MEDIUM");
      }
      if (record.tenantId !== input.tenantId) {
        throw new KnowledgeError("TENANT_MISMATCH", `tenant mismatch for knowledge ${input.knowledgeId}`, false, true, "HIGH");
      }

      record.metadata = structuredClone(input.metadata);
      record.updatedAt = nowIso();
      record.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "KNOWLEDGE_METADATA_UPDATED",
      tenantId: input.tenantId,
      knowledgeId: input.knowledgeId,
      actor: input.actor,
      message: `metadata updated for ${input.knowledgeId}`,
    });

    return this.requireKnowledge(input.knowledgeId);
  }

  async transitionLifecycle(input: {
    tenantId: TenantId;
    knowledgeId: KnowledgeId;
    status: KnowledgeLifecycleStatus;
    actor: KnowledgeActorContext;
    reason?: string;
  }): Promise<KnowledgeRecord> {
    await this.persistence.mutate((state) => {
      const record = state.knowledge.find((item) => item.knowledgeId === input.knowledgeId);
      if (!record) {
        throw new KnowledgeError("KNOWLEDGE_NOT_FOUND", `knowledge not found: ${input.knowledgeId}`, false, true, "MEDIUM");
      }
      if (record.tenantId !== input.tenantId) {
        throw new KnowledgeError("TENANT_MISMATCH", `tenant mismatch for knowledge ${input.knowledgeId}`, false, true, "HIGH");
      }

      if (record.lifecycle.status === "RETIRED" && input.status !== "RETIRED") {
        throw new KnowledgeError("LIFECYCLE_TRANSITION_INVALID", "retired knowledge cannot transition to another lifecycle state", false, true, "HIGH");
      }

      record.lifecycle.status = input.status;
      record.lifecycle.transitionedAt = nowIso();
      record.lifecycle.transitionedBy = input.actor.actorId;
      record.lifecycle.reason = input.reason;
      record.updatedAt = record.lifecycle.transitionedAt;
      record.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "KNOWLEDGE_LIFECYCLE_TRANSITIONED",
      tenantId: input.tenantId,
      knowledgeId: input.knowledgeId,
      actor: input.actor,
      message: `lifecycle transitioned for ${input.knowledgeId}`,
      details: {
        status: input.status,
        reason: input.reason,
      },
    });

    return this.requireKnowledge(input.knowledgeId);
  }

  async attestGovernance(input: {
    tenantId: TenantId;
    knowledgeId: KnowledgeId;
    state: "REGISTERED" | "VERIFIED" | "ATTESTED";
    actor: KnowledgeActorContext;
  }): Promise<KnowledgeRecord> {
    await this.persistence.mutate((state) => {
      const record = state.knowledge.find((item) => item.knowledgeId === input.knowledgeId);
      if (!record) {
        throw new KnowledgeError("KNOWLEDGE_NOT_FOUND", `knowledge not found: ${input.knowledgeId}`, false, true, "MEDIUM");
      }
      if (record.tenantId !== input.tenantId) {
        throw new KnowledgeError("TENANT_MISMATCH", `tenant mismatch for knowledge ${input.knowledgeId}`, false, true, "HIGH");
      }

      record.governance.state = input.state;
      if (input.state === "ATTESTED") {
        record.governance.attestedAt = nowIso();
        record.governance.attestedBy = input.actor.actorId;
      }
      record.updatedAt = nowIso();
      record.updatedBy = input.actor.actorId;
    });

    await this.audit.append({
      eventType: "KNOWLEDGE_GOVERNANCE_ATTESTED",
      tenantId: input.tenantId,
      knowledgeId: input.knowledgeId,
      actor: input.actor,
      message: `governance state set to ${input.state} for ${input.knowledgeId}`,
      details: {
        governanceState: input.state,
      },
    });

    return this.requireKnowledge(input.knowledgeId);
  }

  private requireKnowledge(knowledgeId: KnowledgeId): KnowledgeRecord {
    const found = this.persistence.getKnowledge(knowledgeId);
    if (!found) {
      throw new KnowledgeError("KNOWLEDGE_NOT_FOUND", `knowledge not found: ${knowledgeId}`, false, true, "MEDIUM");
    }
    return found;
  }
}
