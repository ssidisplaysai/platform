import { createHash } from "node:crypto";
import { bgeId, deterministicBgeId } from "./ids";
import type {
  CreateApprovalRequest,
  CreateProposalRequest,
} from "./contracts";
import type {
  BgeCanonicalObject,
  BgeEventType,
  BgeObjectType,
  BgeProposal,
  BgeRelationship,
  BgeVersion,
} from "./models";
import type { BgeRepository } from "./repository";
import type { BgeEventAuthority } from "@/platform/gop/bge-event-authority";

const CANONICAL_TYPES = new Set<BgeObjectType>([
  "BG.ORG.COMPANY",
  "BG.CATALOG.PRODUCT",
  "BG.KNOWLEDGE.DOCUMENT",
  "BG.CONTENT.WEBSITE",
  "BG.EVIDENCE.EVIDENCE_RECORD",
]);

function assertCanonicalType(objectType: string): asserts objectType is BgeObjectType {
  if (!CANONICAL_TYPES.has(objectType as BgeObjectType)) {
    throw new Error(`Unsupported object_type: ${objectType}`);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function createObjectIdForProposal(proposal: BgeProposal): string {
  return proposal.object_id ?? deterministicBgeId("bgobj_", proposal.proposal_id);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${key}:${stableSerialize(entryValue)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function proposalIdempotencyKey(input: CreateProposalRequest): string {
  return digest({
    tenant_id: input.tenant_id,
    object_type: input.object_type,
    object_id: input.object_id ?? null,
    operation: input.operation,
    patch: input.patch ?? null,
    relationship: input.relationship ?? null,
    evidence_ids: [...input.evidence_ids].sort(),
    policy_ids: [...input.policy_ids].sort(),
    reason: input.reason,
    initiator: input.initiator,
  });
}

function approvalIdempotencyKey(input: CreateApprovalRequest): string {
  return digest({
    tenant_id: input.tenant_id,
    proposal_id: input.proposal_id,
    decision: input.decision,
    approver: input.approver,
    reason: input.reason,
  });
}

function relationshipIdempotencyKey(input: {
  tenant_id: string;
  relationship_type: string;
  source_object_id: string;
  target_object_id: string;
  evidence_ids: string[];
  policy_ids: string[];
}): string {
  return digest({
    tenant_id: input.tenant_id,
    relationship_type: input.relationship_type,
    source_object_id: input.source_object_id,
    target_object_id: input.target_object_id,
    evidence_ids: [...input.evidence_ids].sort(),
    policy_ids: [...input.policy_ids].sort(),
  });
}

export class BgeObjectService {
  constructor(private readonly repository: BgeRepository) {}

  async getObject(objectId: string, tenantId?: string) {
    return this.repository.getObjectById(objectId, tenantId);
  }
}

export class BgeRelationshipService {
  constructor(private readonly repository: BgeRepository) {}

  async getRelationship(relationshipId: string, tenantId?: string) {
    return this.repository.getRelationshipById(relationshipId, tenantId);
  }
}

export class BgeProposalService {
  constructor(
    private readonly repository: BgeRepository,
    private readonly events: BgeEventAuthority,
  ) {}

  async createProposal(input: CreateProposalRequest): Promise<BgeProposal> {
    assertCanonicalType(input.object_type);

    const idempotencyKey = proposalIdempotencyKey(input);
    const existingProposal = await this.repository.findProposalByIdempotencyKey(input.tenant_id, idempotencyKey);
    if (existingProposal) {
      return existingProposal;
    }

    if (input.evidence_ids.length === 0) {
      throw new Error("evidence_ids must contain at least one evidence reference");
    }

    for (const evidenceId of input.evidence_ids) {
      const evidence = await this.repository.getEvidenceById(evidenceId, input.tenant_id);
      if (!evidence) {
        throw new Error(`Evidence not found for tenant: ${evidenceId}`);
      }
    }

    if (input.operation === "UPDATE_OBJECT" && input.object_id) {
      const existing = await this.repository.getObjectById(input.object_id, input.tenant_id);
      if (!existing || existing.object_type === "BG.EVIDENCE.EVIDENCE_RECORD") {
        throw new Error("Canonical object not found");
      }
    }

    if (input.operation === "RELATE_OBJECTS") {
      if (!input.relationship) {
        throw new Error("relationship payload is required for RELATE_OBJECTS");
      }

      const source = await this.repository.getObjectById(input.relationship.source_object_id, input.tenant_id);
      const target = await this.repository.getObjectById(input.relationship.target_object_id, input.tenant_id);
      if (!source || !target) {
        throw new Error("Relationship objects must exist in the same tenant");
      }
    }

    if (input.initiator.actor_type === "AI" && input.operation !== "CREATE_OBJECT" && input.operation !== "UPDATE_OBJECT" && input.operation !== "RELATE_OBJECTS") {
      throw new Error("AI may emit proposals only");
    }

    const proposal: BgeProposal = {
      proposal_id: bgeId("bgprop_"),
      tenant_id: input.tenant_id,
      object_type: input.object_type,
      object_id: input.object_id,
      operation: input.operation,
      patch: input.patch,
      relationship: input.relationship,
      evidence_ids: input.evidence_ids,
      policy_ids: input.policy_ids,
      reason: input.reason,
      initiator: input.initiator,
      confidence_score: input.evidence_ids.length > 0 ? 1 : 0,
      idempotency_key: idempotencyKey,
      created_at: nowIso(),
      status: "PENDING",
    };

    const persistedProposal = await this.repository.createProposal(proposal);

    await this.events.emit({
      event_type: "BG.EVENT.PROPOSED",
      tenant_id: persistedProposal.tenant_id,
      object_type: persistedProposal.object_type,
      object_id: createObjectIdForProposal(persistedProposal),
      object_version_id: bgeId("bgver_"),
      actor: persistedProposal.initiator,
      initiator: persistedProposal.initiator,
      policy_ids: persistedProposal.policy_ids,
      evidence_ids: persistedProposal.evidence_ids,
      proposal_id: persistedProposal.proposal_id,
      confidence_score: persistedProposal.confidence_score,
      change_summary: `Proposal created: ${persistedProposal.operation}`,
      reason: persistedProposal.reason,
    });

    return persistedProposal;
  }
}

export class BgeApprovalService {
  constructor(
    private readonly repository: BgeRepository,
    private readonly events: BgeEventAuthority,
  ) {}

  async decide(input: CreateApprovalRequest) {
    const idempotencyKey = approvalIdempotencyKey(input);
    const existingApproval = await this.repository.findApprovalByIdempotencyKey(input.tenant_id, idempotencyKey);
    if (existingApproval) {
      return { approval_id: existingApproval.approval_id, proposal_id: existingApproval.proposal_id, decision: existingApproval.decision };
    }

    if (input.approver.actor_type !== "HUMAN") {
      throw new Error("Approver must be HUMAN");
    }

    const proposal = await this.repository.getProposalById(input.proposal_id, input.tenant_id);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    if (proposal.tenant_id !== input.tenant_id) {
      throw new Error("Proposal tenant mismatch");
    }

    if (proposal.status !== "PENDING") {
      throw new Error("Proposal is not pending");
    }

    const approvalId = bgeId("bgappr_");
    const approvalCreatedAt = nowIso();
    const proposalStatus = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";

    const transactionResult = await this.repository.withTransaction(async (repository) => {
      const approval = await repository.createApproval({
        approval_id: approvalId,
        proposal_id: proposal.proposal_id,
        tenant_id: proposal.tenant_id,
        decision: input.decision,
        approver: input.approver,
        reason: input.reason,
        policy_ids: proposal.policy_ids,
        idempotency_key: idempotencyKey,
        decided_at: approvalCreatedAt,
        created_at: approvalCreatedAt,
      });

      const savedProposal = await repository.saveProposal({
        ...proposal,
        status: proposalStatus,
      });

      if (input.decision === "REJECT") {
        return {
          approval,
          proposal: savedProposal,
        };
      }

      const promoted = await this.promoteApprovedProposal(repository, savedProposal, input.approver);
      const updatedApproval = await repository.createApproval({
        ...approval,
        resulting_object_id: promoted.object_id,
        resulting_version_id: promoted.version_id,
        resulting_relationship_id: promoted.relationship_id,
      });

      return {
        approval: updatedApproval,
        proposal: savedProposal,
        promoted,
      };
    });

    const decisionEventType: BgeEventType = input.decision === "APPROVE" ? "BG.EVENT.APPROVED" : "BG.EVENT.REJECTED";

    const decisionEvent = await this.events.emit({
      event_type: decisionEventType,
      tenant_id: transactionResult.proposal.tenant_id,
      object_type: transactionResult.proposal.object_type,
      object_id: createObjectIdForProposal(transactionResult.proposal),
      object_version_id: bgeId("bgver_"),
      actor: input.approver,
      initiator: transactionResult.proposal.initiator,
      proposal_id: transactionResult.proposal.proposal_id,
      approval_id: transactionResult.approval.approval_id,
      policy_ids: transactionResult.proposal.policy_ids,
      evidence_ids: transactionResult.proposal.evidence_ids,
      confidence_score: transactionResult.proposal.confidence_score,
      change_summary: `Proposal ${transactionResult.proposal.status.toLowerCase()}`,
      reason: input.reason,
    });

    if (input.decision === "REJECT") {
      return { approval_id: transactionResult.approval.approval_id, proposal_id: transactionResult.proposal.proposal_id, decision: input.decision };
    }

    await this.emitPromotionEvents(
      transactionResult.proposal,
      input.approver,
      transactionResult.approval.approval_id,
      decisionEvent.event_id,
      transactionResult.promoted?.object_id,
      transactionResult.promoted?.version_id,
      transactionResult.promoted?.relationship_id,
    );

    return { approval_id: transactionResult.approval.approval_id, proposal_id: transactionResult.proposal.proposal_id, decision: input.decision };
  }

  private async promoteApprovedProposal(
    repository: BgeRepository,
    proposal: BgeProposal,
    approver: { actor_type: "HUMAN" | "AI" | "SYSTEM"; actor_id: string; display_name?: string },
  ): Promise<{ object_id?: string; version_id?: string; relationship_id?: string }> {
    if (proposal.operation === "RELATE_OBJECTS") {
      if (!proposal.relationship) {
        throw new Error("relationship payload is required for RELATE_OBJECTS");
      }

      const relationship: BgeRelationship = {
        relationship_id: bgeId("bgrel_"),
        tenant_id: proposal.tenant_id,
        relationship_type: proposal.relationship.relationship_type,
        source_object_id: proposal.relationship.source_object_id,
        target_object_id: proposal.relationship.target_object_id,
        status: "ACTIVE",
        created_by: approver,
        created_at: nowIso(),
        evidence_ids: proposal.evidence_ids,
        policy_ids: proposal.policy_ids,
        idempotency_key: relationshipIdempotencyKey({
          tenant_id: proposal.tenant_id,
          relationship_type: proposal.relationship.relationship_type,
          source_object_id: proposal.relationship.source_object_id,
          target_object_id: proposal.relationship.target_object_id,
          evidence_ids: proposal.evidence_ids,
          policy_ids: proposal.policy_ids,
        }),
      };

      const source = await repository.getObjectById(relationship.source_object_id, proposal.tenant_id);
      const target = await repository.getObjectById(relationship.target_object_id, proposal.tenant_id);
      if (!source || !target) {
        throw new Error("Relationship objects must exist in the same tenant");
      }

      const existing = await repository.findRelationshipByIdempotencyKey(proposal.tenant_id, relationship.idempotency_key ?? relationship.relationship_id);
      const persisted = existing ?? await repository.createRelationship(relationship);
      return { relationship_id: persisted.relationship_id };
    }

    if (proposal.object_type === "BG.EVIDENCE.EVIDENCE_RECORD") {
      throw new Error("Evidence records are immutable and cannot be promoted through proposals");
    }

    const objectType = proposal.object_type as BgeCanonicalObject["object_type"];

    if (proposal.operation === "CREATE_OBJECT") {
      const objectId = createObjectIdForProposal(proposal);
      const duplicate = await this.repository.getObjectById(objectId, proposal.tenant_id);
      if (duplicate) {
        throw new Error("Canonical object already exists");
      }

      const version = this.makeVersion(proposal, approver, "Created through approved proposal");
      const object: BgeCanonicalObject = {
        object_id: objectId,
        tenant_id: proposal.tenant_id,
        object_type: objectType,
        lifecycle_state: "active",
        current_version_id: version.version_id,
        versions: [version],
      };

      const persistedObject = await repository.saveCanonicalObject(object);
      return { object_id: persistedObject.object_id, version_id: version.version_id };
    }

    if (!proposal.object_id) {
      throw new Error("object_id is required for UPDATE_OBJECT");
    }

    const existing = await repository.getObjectById(proposal.object_id, proposal.tenant_id);
    if (!existing || existing.object_type === "BG.EVIDENCE.EVIDENCE_RECORD") {
      throw new Error("Canonical object not found");
    }

    const previousPayload = existing.versions[existing.versions.length - 1]?.payload ?? {};
    const mergedPayload = { ...previousPayload, ...(proposal.patch ?? {}) };
    const version = this.makeVersion(proposal, approver, "Updated through approved proposal", mergedPayload);

    existing.versions.push(version);
    existing.current_version_id = version.version_id;

    const persistedObject = await repository.saveCanonicalObject(existing);
    return { object_id: persistedObject.object_id, version_id: version.version_id };
  }

  private async emitPromotionEvents(
    proposal: BgeProposal,
    approver: { actor_type: "HUMAN" | "AI" | "SYSTEM"; actor_id: string; display_name?: string },
    approvalId: string,
    causationId: string,
    resultingObjectId?: string,
    resultingVersionId?: string,
    resultingRelationshipId?: string,
  ): Promise<void> {
    if (proposal.operation === "RELATE_OBJECTS") {
      if (!proposal.relationship || !resultingRelationshipId) {
        return;
      }

      await this.events.emit({
        event_type: "BG.EVENT.RELATED",
        tenant_id: proposal.tenant_id,
        object_type: proposal.object_type,
        object_id: proposal.relationship.source_object_id,
        object_version_id: bgeId("bgver_"),
        actor: approver,
        initiator: proposal.initiator,
        proposal_id: proposal.proposal_id,
        approval_id: approvalId,
        policy_ids: proposal.policy_ids,
        evidence_ids: proposal.evidence_ids,
        confidence_score: proposal.confidence_score,
        relationship_id: resultingRelationshipId,
        relationship_type: proposal.relationship.relationship_type,
        change_summary: "Canonical relationship created",
        reason: proposal.reason,
        causation_id: causationId,
      });
      return;
    }

    if (!resultingObjectId || !resultingVersionId) {
      return;
    }

    await this.events.emit({
      event_type: "BG.EVENT.VERSION_CREATED",
      tenant_id: proposal.tenant_id,
      object_type: proposal.object_type as BgeCanonicalObject["object_type"],
      object_id: resultingObjectId,
      object_version_id: resultingVersionId,
      actor: approver,
      initiator: proposal.initiator,
      proposal_id: proposal.proposal_id,
      approval_id: approvalId,
      policy_ids: proposal.policy_ids,
      evidence_ids: proposal.evidence_ids,
      confidence_score: proposal.confidence_score,
      change_summary: "Canonical object version created",
      reason: proposal.reason,
      causation_id: causationId,
    });

    await this.events.emit({
      event_type: proposal.operation === "CREATE_OBJECT" ? "BG.EVENT.CREATED" : "BG.EVENT.UPDATED",
      tenant_id: proposal.tenant_id,
      object_type: proposal.object_type as BgeCanonicalObject["object_type"],
      object_id: resultingObjectId,
      object_version_id: resultingVersionId,
      actor: approver,
      initiator: proposal.initiator,
      proposal_id: proposal.proposal_id,
      approval_id: approvalId,
      policy_ids: proposal.policy_ids,
      evidence_ids: proposal.evidence_ids,
      confidence_score: proposal.confidence_score,
      change_summary: proposal.operation === "CREATE_OBJECT" ? "Canonical object created" : "Canonical object updated",
      reason: proposal.reason,
      causation_id: causationId,
    });
  }

  private makeVersion(
    proposal: BgeProposal,
    actor: { actor_type: "HUMAN" | "AI" | "SYSTEM"; actor_id: string; display_name?: string },
    reason: string,
    payload?: Record<string, unknown>,
  ): BgeVersion {
    return {
      version_id: bgeId("bgver_"),
      created_at: nowIso(),
      actor,
      evidence_ids: proposal.evidence_ids,
      policy_ids: proposal.policy_ids,
      payload: payload ?? (proposal.patch ?? {}),
      reason,
    };
  }
}

export class BgeTimelineService {
  constructor(private readonly events: BgeEventAuthority) {}

  async getTimeline(objectId: string, tenantId: string) {
    const events = await this.events.timelineForObject(objectId, tenantId);
    return {
      tenant_id: tenantId,
      object_id: objectId,
      events,
    };
  }
}
