import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import { buildBgeEventStreamId } from "@/platform/gop/bge-event-authority";
import { getGenesisEventStore } from "@/platform/gop/runtime/event-store";
import type {
  BgeApproval,
  BgeCanonicalObject,
  BgeEvent,
  BgeEvidenceRecord,
  BgeProposal,
  BgeRelationship,
  BgeVersion,
} from "./models";
import type { BgeRepository } from "./repository";

type BgeObject = BgeCanonicalObject | BgeEvidenceRecord;
type BgePrismaClient = PrismaClient | Prisma.TransactionClient;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapVersion(row: {
  versionId: string;
  actorType: string;
  actorId: string;
  actorDisplayName: string | null;
  evidenceIds: unknown;
  policyIds: unknown;
  payload: unknown;
  reason: string;
  rollbackOfVersionId: string | null;
  createdAt: Date;
}): BgeVersion {
  return {
    version_id: row.versionId,
    created_at: row.createdAt.toISOString(),
    actor: {
      actor_type: row.actorType as BgeVersion["actor"]["actor_type"],
      actor_id: row.actorId,
      display_name: row.actorDisplayName ?? undefined,
    },
    evidence_ids: (row.evidenceIds as string[]) ?? [],
    policy_ids: (row.policyIds as string[]) ?? [],
    payload: (row.payload as Record<string, unknown>) ?? {},
    reason: row.reason,
    rollback_of_version_id: row.rollbackOfVersionId ?? undefined,
  };
}

function mapObject(row: {
  objectId: string;
  tenantId: string;
  objectType: string;
  canonicalStatus: string;
  currentVersionId: string;
  effectiveAt: Date | null;
  deprecatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  versions: Array<{
    versionId: string;
    actorType: string;
    actorId: string;
    actorDisplayName: string | null;
    evidenceIds: unknown;
    policyIds: unknown;
    payload: unknown;
    reason: string;
    rollbackOfVersionId: string | null;
    createdAt: Date;
  }>;
}): BgeCanonicalObject {
  return {
    object_id: row.objectId,
    tenant_id: row.tenantId,
    object_type: row.objectType as BgeCanonicalObject["object_type"],
    lifecycle_state: row.canonicalStatus.toLowerCase() as BgeCanonicalObject["lifecycle_state"],
    canonical_status: row.canonicalStatus as BgeCanonicalObject["canonical_status"],
    current_version_id: row.currentVersionId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    effective_at: row.effectiveAt?.toISOString() ?? null,
    deprecated_at: row.deprecatedAt?.toISOString() ?? null,
    versions: row.versions.map(mapVersion),
  };
}

function mapProposal(row: {
  proposalId: string;
  tenantId: string;
  objectType: string;
  objectId: string | null;
  operation: string;
  patch: unknown;
  relationship: unknown;
  evidenceIds: unknown;
  policyIds: unknown;
  reason: string;
  initiatorActorType: string;
  initiatorActorId: string;
  initiatorDisplayName: string | null;
  status: string;
  confidenceScore: Prisma.Decimal | null;
  confidenceReference: string | null;
  expiresAt: Date | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}): BgeProposal {
  return {
    proposal_id: row.proposalId,
    tenant_id: row.tenantId,
    object_type: row.objectType as BgeProposal["object_type"],
    object_id: row.objectId ?? undefined,
    operation: row.operation as BgeProposal["operation"],
    patch: (row.patch as Record<string, unknown> | null) ?? undefined,
    relationship: (row.relationship as BgeProposal["relationship"] | null) ?? undefined,
    evidence_ids: (row.evidenceIds as string[]) ?? [],
    policy_ids: (row.policyIds as string[]) ?? [],
    reason: row.reason,
    initiator: {
      actor_type: row.initiatorActorType as BgeProposal["initiator"]["actor_type"],
      actor_id: row.initiatorActorId,
      display_name: row.initiatorDisplayName ?? undefined,
    },
    status: row.status as BgeProposal["status"],
    confidence_score: row.confidenceScore == null ? undefined : Number(row.confidenceScore),
    confidence_reference: row.confidenceReference ?? undefined,
    expires_at: row.expiresAt?.toISOString() ?? null,
    idempotency_key: row.idempotencyKey,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapApproval(row: {
  approvalId: string;
  tenantId: string;
  proposalId: string;
  decision: string;
  reason: string;
  approverActorType: string;
  approverActorId: string;
  approverDisplayName: string | null;
  policyIds: unknown;
  resultingObjectId: string | null;
  resultingVersionId: string | null;
  resultingRelationshipId: string | null;
  idempotencyKey: string;
  decidedAt: Date;
  createdAt: Date;
}): BgeApproval {
  return {
    approval_id: row.approvalId,
    proposal_id: row.proposalId,
    tenant_id: row.tenantId,
    decision: row.decision as BgeApproval["decision"],
    approver: {
      actor_type: row.approverActorType as BgeApproval["approver"]["actor_type"],
      actor_id: row.approverActorId,
      display_name: row.approverDisplayName ?? undefined,
    },
    reason: row.reason,
    policy_ids: (row.policyIds as string[]) ?? [],
    resulting_object_id: row.resultingObjectId ?? undefined,
    resulting_version_id: row.resultingVersionId ?? undefined,
    resulting_relationship_id: row.resultingRelationshipId ?? undefined,
    idempotency_key: row.idempotencyKey,
    decided_at: row.decidedAt.toISOString(),
    created_at: row.createdAt.toISOString(),
  };
}

function mapRelationship(row: {
  relationshipId: string;
  tenantId: string;
  relationshipType: string;
  sourceObjectId: string;
  targetObjectId: string;
  status: string;
  createdByActorType: string;
  createdByActorId: string;
  createdByDisplayName: string | null;
  evidenceIds: unknown;
  policyIds: unknown;
  effectiveAt: Date | null;
  deprecatedAt: Date | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}): BgeRelationship {
  return {
    relationship_id: row.relationshipId,
    tenant_id: row.tenantId,
    relationship_type: row.relationshipType as BgeRelationship["relationship_type"],
    source_object_id: row.sourceObjectId,
    target_object_id: row.targetObjectId,
    status: row.status as BgeRelationship["status"],
    created_by: {
      actor_type: row.createdByActorType as "HUMAN" | "AI" | "SYSTEM",
      actor_id: row.createdByActorId,
      display_name: row.createdByDisplayName ?? undefined,
    },
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    effective_at: row.effectiveAt?.toISOString() ?? null,
    deprecated_at: row.deprecatedAt?.toISOString() ?? null,
    evidence_ids: (row.evidenceIds as string[]) ?? [],
    policy_ids: (row.policyIds as string[]) ?? [],
    idempotency_key: row.idempotencyKey,
  };
}

function mapEvidenceFromMetadata(metadata: unknown): BgeEvidenceRecord | null {
  return ((metadata as { evidenceRecord?: BgeEvidenceRecord } | null)?.evidenceRecord) ?? null;
}

async function findEvidenceRowByField(prisma: BgePrismaClient, field: "evidence_id" | "object_id", value: string, tenantId?: string) {
  const tenantCondition = tenantId ? Prisma.sql` AND (metadata->'evidenceRecord'->>'tenant_id') = ${tenantId}` : Prisma.empty;
  const rows = field === "evidence_id"
    ? await prisma.$queryRaw<Array<{ metadata: unknown }>>`
        SELECT metadata
        FROM "GopJobEvent"
        WHERE "eventType" = 'BG.EVENT.INGESTED'
          AND (metadata->'evidenceRecord'->>'evidence_id') = ${value}
          ${tenantCondition}
        ORDER BY "sequence" DESC
        LIMIT 1
      `
    : await prisma.$queryRaw<Array<{ metadata: unknown }>>`
        SELECT metadata
        FROM "GopJobEvent"
        WHERE "eventType" = 'BG.EVENT.INGESTED'
          AND (metadata->'evidenceRecord'->>'object_id') = ${value}
          ${tenantCondition}
        ORDER BY "sequence" DESC
        LIMIT 1
      `;
  return rows[0] ?? null;
}

export function createPrismaBgeRepository(prisma: BgePrismaClient = getPrismaClient()): BgeRepository {
  return {
    async createEvidence(evidence) {
      return evidence;
    },

    async getEvidenceById(evidenceId, tenantId) {
      const row = await findEvidenceRowByField(prisma, "evidence_id", evidenceId, tenantId);
      return row ? mapEvidenceFromMetadata(row.metadata) : null;
    },

    async getObjectById(objectId, tenantId) {
      const row = await prisma.bgeCanonicalObject.findFirst({
        where: {
          objectId,
          tenantId: tenantId ?? undefined,
        },
        include: {
          versions: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (row) {
        return mapObject(row);
      }

      const evidenceRow = await findEvidenceRowByField(prisma, "object_id", objectId, tenantId);
      return evidenceRow ? mapEvidenceFromMetadata(evidenceRow.metadata) : null;
    },

    async saveCanonicalObject(object) {
      await prisma.bgeCanonicalObject.upsert({
        where: { objectId: object.object_id },
        update: {
          tenantId: object.tenant_id,
          objectType: object.object_type,
          canonicalStatus: object.lifecycle_state.toUpperCase(),
          currentVersionId: object.current_version_id,
          effectiveAt: object.effective_at ? new Date(object.effective_at) : undefined,
          deprecatedAt: object.deprecated_at ? new Date(object.deprecated_at) : null,
        },
        create: {
          objectId: object.object_id,
          tenantId: object.tenant_id,
          objectType: object.object_type,
          canonicalStatus: object.lifecycle_state.toUpperCase(),
          currentVersionId: object.current_version_id,
          effectiveAt: object.effective_at ? new Date(object.effective_at) : undefined,
          deprecatedAt: object.deprecated_at ? new Date(object.deprecated_at) : null,
          createdAt: object.created_at ? new Date(object.created_at) : undefined,
        },
      });

      for (const version of object.versions) {
        await prisma.bgeCanonicalObjectVersion.upsert({
          where: { versionId: version.version_id },
          update: {
            tenantId: object.tenant_id,
            objectType: object.object_type,
            actorType: version.actor.actor_type,
            actorId: version.actor.actor_id,
            actorDisplayName: version.actor.display_name ?? null,
            evidenceIds: toJsonValue(version.evidence_ids),
            policyIds: toJsonValue(version.policy_ids),
            payload: toJsonValue(version.payload),
            reason: version.reason,
            rollbackOfVersionId: version.rollback_of_version_id ?? null,
          },
          create: {
            versionId: version.version_id,
            objectId: object.object_id,
            tenantId: object.tenant_id,
            objectType: object.object_type,
            actorType: version.actor.actor_type,
            actorId: version.actor.actor_id,
            actorDisplayName: version.actor.display_name ?? null,
            evidenceIds: toJsonValue(version.evidence_ids),
            policyIds: toJsonValue(version.policy_ids),
            payload: toJsonValue(version.payload),
            reason: version.reason,
            rollbackOfVersionId: version.rollback_of_version_id ?? null,
            createdAt: new Date(version.created_at),
          },
        });
      }

      const persisted = await prisma.bgeCanonicalObject.findUniqueOrThrow({
        where: { objectId: object.object_id },
        include: {
          versions: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return mapObject(persisted);
    },

    async createProposal(proposal) {
      const persisted = await prisma.bgeCanonicalProposal.upsert({
        where: {
          tenantId_idempotencyKey: {
            tenantId: proposal.tenant_id,
            idempotencyKey: proposal.idempotency_key ?? proposal.proposal_id,
          },
        },
        update: {},
        create: {
          proposalId: proposal.proposal_id,
          tenantId: proposal.tenant_id,
          objectType: proposal.object_type,
          objectId: proposal.object_id ?? null,
          operation: proposal.operation,
          patch: proposal.patch ? toJsonValue(proposal.patch) : Prisma.JsonNull,
          relationship: proposal.relationship ? toJsonValue(proposal.relationship) : Prisma.JsonNull,
          evidenceIds: toJsonValue(proposal.evidence_ids),
          policyIds: toJsonValue(proposal.policy_ids),
          reason: proposal.reason,
          initiatorActorType: proposal.initiator.actor_type,
          initiatorActorId: proposal.initiator.actor_id,
          initiatorDisplayName: proposal.initiator.display_name ?? null,
          status: proposal.status,
          confidenceScore: proposal.confidence_score == null ? null : new Prisma.Decimal(proposal.confidence_score),
          confidenceReference: proposal.confidence_reference ?? null,
          expiresAt: proposal.expires_at ? new Date(proposal.expires_at) : null,
          idempotencyKey: proposal.idempotency_key ?? proposal.proposal_id,
          createdAt: new Date(proposal.created_at),
        },
      });

      return mapProposal(persisted);
    },

    async findProposalByIdempotencyKey(tenantId, idempotencyKey) {
      const row = await prisma.bgeCanonicalProposal.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey,
          },
        },
      });
      return row ? mapProposal(row) : null;
    },

    async getProposalById(proposalId, tenantId) {
      const row = await prisma.bgeCanonicalProposal.findFirst({
        where: {
          proposalId,
          tenantId: tenantId ?? undefined,
        },
      });
      return row ? mapProposal(row) : null;
    },

    async saveProposal(proposal) {
      const row = await prisma.bgeCanonicalProposal.update({
        where: { proposalId: proposal.proposal_id },
        data: {
          status: proposal.status,
          objectId: proposal.object_id ?? null,
          patch: proposal.patch ? toJsonValue(proposal.patch) : Prisma.JsonNull,
          relationship: proposal.relationship ? toJsonValue(proposal.relationship) : Prisma.JsonNull,
          confidenceScore: proposal.confidence_score == null ? null : new Prisma.Decimal(proposal.confidence_score),
          confidenceReference: proposal.confidence_reference ?? null,
          expiresAt: proposal.expires_at ? new Date(proposal.expires_at) : null,
        },
      });
      return mapProposal(row);
    },

    async createApproval(approval) {
      const row = await prisma.bgeCanonicalApproval.upsert({
        where: {
          tenantId_idempotencyKey: {
            tenantId: approval.tenant_id,
            idempotencyKey: approval.idempotency_key ?? approval.approval_id,
          },
        },
        update: {
          resultingObjectId: approval.resulting_object_id ?? null,
          resultingVersionId: approval.resulting_version_id ?? null,
          resultingRelationshipId: approval.resulting_relationship_id ?? null,
        },
        create: {
          approvalId: approval.approval_id,
          tenantId: approval.tenant_id,
          proposalId: approval.proposal_id,
          decision: approval.decision,
          reason: approval.reason,
          approverActorType: approval.approver.actor_type,
          approverActorId: approval.approver.actor_id,
          approverDisplayName: approval.approver.display_name ?? null,
          policyIds: toJsonValue(approval.policy_ids ?? []),
          resultingObjectId: approval.resulting_object_id ?? null,
          resultingVersionId: approval.resulting_version_id ?? null,
          resultingRelationshipId: approval.resulting_relationship_id ?? null,
          idempotencyKey: approval.idempotency_key ?? approval.approval_id,
          decidedAt: new Date(approval.decided_at ?? approval.created_at),
          createdAt: new Date(approval.created_at),
        },
      });
      return mapApproval(row);
    },

    async findApprovalByIdempotencyKey(tenantId, idempotencyKey) {
      const row = await prisma.bgeCanonicalApproval.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey,
          },
        },
      });
      return row ? mapApproval(row) : null;
    },

    async createRelationship(relationship) {
      const row = await prisma.bgeCanonicalRelationship.upsert({
        where: {
          tenantId_idempotencyKey: {
            tenantId: relationship.tenant_id,
            idempotencyKey: relationship.idempotency_key ?? relationship.relationship_id,
          },
        },
        update: {},
        create: {
          relationshipId: relationship.relationship_id,
          tenantId: relationship.tenant_id,
          relationshipType: relationship.relationship_type,
          sourceObjectId: relationship.source_object_id,
          targetObjectId: relationship.target_object_id,
          status: relationship.status ?? "ACTIVE",
          createdByActorType: relationship.created_by?.actor_type ?? "SYSTEM",
          createdByActorId: relationship.created_by?.actor_id ?? "system",
          createdByDisplayName: relationship.created_by?.display_name ?? null,
          evidenceIds: toJsonValue(relationship.evidence_ids),
          policyIds: toJsonValue(relationship.policy_ids),
          effectiveAt: relationship.effective_at ? new Date(relationship.effective_at) : undefined,
          deprecatedAt: relationship.deprecated_at ? new Date(relationship.deprecated_at) : null,
          idempotencyKey: relationship.idempotency_key ?? relationship.relationship_id,
          createdAt: new Date(relationship.created_at),
        },
      });
      return mapRelationship(row);
    },

    async findRelationshipByIdempotencyKey(tenantId, idempotencyKey) {
      const row = await prisma.bgeCanonicalRelationship.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey,
          },
        },
      });
      return row ? mapRelationship(row) : null;
    },

    async getRelationshipById(relationshipId, tenantId) {
      const row = await prisma.bgeCanonicalRelationship.findFirst({
        where: {
          relationshipId,
          tenantId: tenantId ?? undefined,
        },
      });
      return row ? mapRelationship(row) : null;
    },

    async appendEvent(event) {
      const store = getGenesisEventStore();
      await store.appendEventIdempotently({
        eventId: event.event_id,
        jobId: buildBgeEventStreamId(event.tenant_id, event.object_id),
        moduleId: "bge.runtime",
        jobType: "BUSINESS_GENOME_COMPILATION",
        type: event.event_type,
        label: event.event_type,
        stage: event.object_type,
        status: "RUNNING",
        message: event.change_summary,
        source: event.reason,
        occurredAt: event.occurred_at,
        sequence: event.sequence_in_chain,
        actorId: event.actor.actor_id,
        actorName: event.actor.display_name,
        correlationId: event.correlation_id,
        causationId: event.causation_id,
        idempotencyKey: `${event.object_id}:${event.sequence_in_chain}:${event.event_type}`,
        metadata: {
          bgeEvent: event,
        },
      });
    },

    async listEventsForObject(objectId, tenantId) {
      if (!tenantId) {
        return [];
      }

      const rows = await prisma.$queryRaw<Array<{ metadata: unknown }>>`
        SELECT metadata
        FROM "GopJobEvent"
        WHERE "jobId" = ${buildBgeEventStreamId(tenantId, objectId)}
        ORDER BY "sequence" ASC
      `;

      return rows
        .map((row) => ((row.metadata as { bgeEvent?: BgeEvent } | null)?.bgeEvent ?? null))
        .filter((event): event is BgeEvent => event !== null);
    },

    async withTransaction<T>(operation: (repository: BgeRepository) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe('SET CONSTRAINTS "BgeCanonicalObject_currentVersionId_fkey" DEFERRED');
        return operation(createPrismaBgeRepository(transaction));
      });
    },
  };
}