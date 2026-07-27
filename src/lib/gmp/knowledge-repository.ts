/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  GmpBusinessKnowledgeWorkspace,
  GmpContextAssemblyRecord,
  GmpKnowledgeApproval,
  GmpKnowledgeCompletenessAssessment,
  GmpKnowledgeConflict,
  GmpKnowledgeConflictMember,
  GmpKnowledgeDomain,
  GmpKnowledgeEvidenceLink,
  GmpKnowledgeRecord,
  GmpKnowledgeRecordVersion,
  GmpKnowledgeReview,
  GmpKnowledgeSource,
} from "./knowledge-models";
import { buildKnowledgeWorkspace } from "./knowledge-models";

type JsonRecord = Record<string, unknown>;

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function asJson(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" ? (value as JsonRecord) : undefined;
}

function mapWorkspace(row: any): GmpBusinessKnowledgeWorkspace {
  return {
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    projectId: row.projectId,
    workspaceVersion: row.workspaceVersion,
    status: row.status,
    lifecycleState: row.lifecycleState,
    completenessScore: row.completenessScore,
    confidenceScore: row.confidenceScore,
    lastReviewedAt: iso(row.lastReviewedAt),
    lastApprovedAt: iso(row.lastApprovedAt),
    approvedBy: row.approvedBy,
    version: row.version,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRecord(row: any): GmpKnowledgeRecord {
  return {
    knowledgeRecordId: row.knowledgeRecordId,
    projectId: row.projectId,
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    domain: row.domain,
    recordType: row.recordType,
    canonicalKey: row.canonicalKey,
    title: row.title,
    summary: row.summary ?? undefined,
    structuredValue: (row.structuredValue ?? {}) as JsonRecord,
    normalizedValue: asJson(row.normalizedValue),
    status: row.status,
    confidence: row.confidence,
    priority: row.priority,
    effectiveFrom: iso(row.effectiveFrom),
    effectiveUntil: iso(row.effectiveUntil),
    sourceCount: row.sourceCount,
    conflictState: row.conflictState,
    reviewState: row.reviewState,
    parentRecordId: row.parentRecordId ?? undefined,
    supersededByRecordId: row.supersededByRecordId ?? undefined,
    version: row.version,
    archivedAt: iso(row.archivedAt),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRecordVersion(row: any): GmpKnowledgeRecordVersion {
  return {
    knowledgeRecordVersionId: row.knowledgeRecordVersionId,
    knowledgeRecordId: row.knowledgeRecordId,
    projectId: row.projectId,
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    versionNumber: row.versionNumber,
    previousValue: asJson(row.previousValue),
    newValue: (row.newValue ?? {}) as JsonRecord,
    changeReason: row.changeReason ?? undefined,
    changedBy: row.changedBy,
    changedAt: row.changedAt.toISOString(),
    sourceImpact: asJson(row.sourceImpact),
    approvalImpact: asJson(row.approvalImpact),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSource(row: any): GmpKnowledgeSource {
  return {
    sourceId: row.sourceId,
    projectId: row.projectId,
    sourceType: row.sourceType,
    displayName: row.displayName,
    locationReference: row.locationReference ?? undefined,
    externalIdentifier: row.externalIdentifier ?? undefined,
    checksum: row.checksum ?? undefined,
    sourceVersion: row.sourceVersion ?? undefined,
    capturedAt: iso(row.capturedAt),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapEvidence(row: any): GmpKnowledgeEvidenceLink {
  return {
    knowledgeEvidenceLinkId: row.knowledgeEvidenceLinkId,
    projectId: row.projectId,
    knowledgeRecordId: row.knowledgeRecordId,
    sourceId: row.sourceId,
    evidenceLocation: row.evidenceLocation ?? undefined,
    evidenceSummary: row.evidenceSummary ?? undefined,
    extractionMethod: row.extractionMethod ?? undefined,
    confidence: row.confidence,
    verifiedBy: row.verifiedBy ?? undefined,
    verifiedAt: iso(row.verifiedAt),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapReview(row: any): GmpKnowledgeReview {
  return {
    knowledgeReviewId: row.knowledgeReviewId,
    projectId: row.projectId,
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    knowledgeRecordId: row.knowledgeRecordId,
    assignedTo: row.assignedTo ?? undefined,
    reviewState: row.reviewState,
    operatorNotes: row.operatorNotes ?? undefined,
    reviewNotes: row.reviewNotes ?? undefined,
    requestedBy: row.requestedBy ?? undefined,
    requestedAt: iso(row.requestedAt),
    completedBy: row.completedBy ?? undefined,
    completedAt: iso(row.completedAt),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapApproval(row: any): GmpKnowledgeApproval {
  return {
    knowledgeApprovalId: row.knowledgeApprovalId,
    projectId: row.projectId,
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    knowledgeRecordId: row.knowledgeRecordId,
    decision: row.decision,
    approvalNotes: row.approvalNotes ?? undefined,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt.toISOString(),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapConflict(row: any): GmpKnowledgeConflict {
  return {
    knowledgeConflictId: row.knowledgeConflictId,
    projectId: row.projectId,
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    conflictGroup: row.conflictGroup,
    conflictReason: row.conflictReason,
    severity: row.severity,
    resolutionStatus: row.resolutionStatus,
    selectedRecordId: row.selectedRecordId ?? undefined,
    resolutionNotes: row.resolutionNotes ?? undefined,
    resolvedBy: row.resolvedBy ?? undefined,
    resolvedAt: iso(row.resolvedAt),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapConflictMember(row: any): GmpKnowledgeConflictMember {
  return {
    knowledgeConflictMemberId: row.knowledgeConflictMemberId,
    projectId: row.projectId,
    knowledgeConflictId: row.knowledgeConflictId,
    knowledgeRecordId: row.knowledgeRecordId,
    role: row.role ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCompleteness(row: any): GmpKnowledgeCompletenessAssessment {
  return {
    knowledgeCompletenessAssessmentId: row.knowledgeCompletenessAssessmentId,
    projectId: row.projectId,
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    scoringModelVersion: row.scoringModelVersion,
    overallScore: row.overallScore,
    domainScores: (row.domainScores ?? {}) as Record<string, number>,
    missingCriticalFields: (row.missingCriticalFields ?? []) as string[],
    missingRecommendedFields: (row.missingRecommendedFields ?? []) as string[],
    conflictedFields: (row.conflictedFields ?? []) as string[],
    unapprovedFields: (row.unapprovedFields ?? []) as string[],
    expiredFields: (row.expiredFields ?? []) as string[],
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapAssembly(row: any): GmpContextAssemblyRecord {
  return {
    contextAssemblyRecordId: row.contextAssemblyRecordId,
    projectId: row.projectId,
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    siteId: row.siteId ?? undefined,
    operationType: row.operationType,
    previewMode: row.previewMode,
    inputMetadata: asJson(row.inputMetadata),
    assembledContext: (row.assembledContext ?? {}) as JsonRecord,
    schemaVersion: row.schemaVersion,
    knowledgeWorkspaceVersion: row.knowledgeWorkspaceVersion,
    recordVersions: (row.recordVersions ?? {}) as Record<string, number>,
    gopExecutionId: row.gopExecutionId ?? undefined,
    createdBy: row.createdBy ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

export type GmpKnowledgeRepository = {
  ensureWorkspace: (projectId: string) => Promise<GmpBusinessKnowledgeWorkspace>;
  getWorkspaceByProjectId: (projectId: string) => Promise<GmpBusinessKnowledgeWorkspace | null>;
  updateWorkspace: (workspaceId: string, changes: Partial<GmpBusinessKnowledgeWorkspace>) => Promise<GmpBusinessKnowledgeWorkspace | null>;

  createRecord: (record: Omit<GmpKnowledgeRecord, "knowledgeRecordId" | "version" | "createdAt" | "updatedAt">) => Promise<GmpKnowledgeRecord>;
  updateRecord: (recordId: string, changes: Partial<GmpKnowledgeRecord>) => Promise<GmpKnowledgeRecord | null>;
  getRecordById: (recordId: string) => Promise<GmpKnowledgeRecord | null>;
  listRecords: (projectId: string, filters?: { domain?: GmpKnowledgeDomain; includeArchived?: boolean }) => Promise<GmpKnowledgeRecord[]>;
  archiveRecord: (recordId: string) => Promise<GmpKnowledgeRecord | null>;
  restoreRecord: (recordId: string) => Promise<GmpKnowledgeRecord | null>;

  createRecordVersion: (version: Omit<GmpKnowledgeRecordVersion, "knowledgeRecordVersionId" | "createdAt">) => Promise<GmpKnowledgeRecordVersion>;
  listRecordVersions: (recordId: string) => Promise<GmpKnowledgeRecordVersion[]>;

  createSource: (source: Omit<GmpKnowledgeSource, "sourceId" | "createdAt" | "updatedAt">) => Promise<GmpKnowledgeSource>;
  listSources: (projectId: string) => Promise<GmpKnowledgeSource[]>;

  createEvidenceLink: (link: Omit<GmpKnowledgeEvidenceLink, "knowledgeEvidenceLinkId" | "createdAt" | "updatedAt">) => Promise<GmpKnowledgeEvidenceLink>;
  listEvidenceForRecord: (recordId: string) => Promise<GmpKnowledgeEvidenceLink[]>;

  createReview: (review: Omit<GmpKnowledgeReview, "knowledgeReviewId" | "createdAt" | "updatedAt">) => Promise<GmpKnowledgeReview>;
  listReviewQueue: (projectId: string) => Promise<GmpKnowledgeReview[]>;

  createApproval: (approval: Omit<GmpKnowledgeApproval, "knowledgeApprovalId" | "createdAt">) => Promise<GmpKnowledgeApproval>;

  listConflicts: (projectId: string) => Promise<Array<{ conflict: GmpKnowledgeConflict; members: GmpKnowledgeConflictMember[] }>>;
  upsertConflict: (conflict: Omit<GmpKnowledgeConflict, "knowledgeConflictId" | "createdAt" | "updatedAt">, memberRecordIds: string[]) => Promise<GmpKnowledgeConflict>;
  resolveConflict: (conflictId: string, input: { selectedRecordId?: string; resolutionNotes?: string; resolvedBy: string }) => Promise<GmpKnowledgeConflict | null>;

  createCompletenessAssessment: (assessment: Omit<GmpKnowledgeCompletenessAssessment, "knowledgeCompletenessAssessmentId" | "createdAt">) => Promise<GmpKnowledgeCompletenessAssessment>;
  getLatestCompletenessAssessment: (projectId: string) => Promise<GmpKnowledgeCompletenessAssessment | null>;

  createContextAssemblyRecord: (record: Omit<GmpContextAssemblyRecord, "contextAssemblyRecordId" | "createdAt">) => Promise<GmpContextAssemblyRecord>;
  listContextAssemblyRecords: (projectId: string) => Promise<GmpContextAssemblyRecord[]>;
};

export function createPrismaGmpKnowledgeRepository(prisma: PrismaClient = getPrismaClient()): GmpKnowledgeRepository {
  const db = prisma as unknown as Record<string, any>;

  return {
    async ensureWorkspace(projectId) {
      const existing = await db.gmpBusinessKnowledgeWorkspace.findUnique({ where: { projectId } });
      if (existing) {
        return mapWorkspace(existing);
      }

      const workspace = buildKnowledgeWorkspace(projectId);
      const created = await db.gmpBusinessKnowledgeWorkspace.create({
        data: {
          ...workspace,
          lastReviewedAt: workspace.lastReviewedAt ? new Date(workspace.lastReviewedAt) : null,
          lastApprovedAt: workspace.lastApprovedAt ? new Date(workspace.lastApprovedAt) : null,
        },
      });
      return mapWorkspace(created);
    },

    async getWorkspaceByProjectId(projectId) {
      const row = await db.gmpBusinessKnowledgeWorkspace.findUnique({ where: { projectId } });
      return row ? mapWorkspace(row) : null;
    },

    async updateWorkspace(workspaceId, changes) {
      const existing = await db.gmpBusinessKnowledgeWorkspace.findUnique({ where: { knowledgeWorkspaceId: workspaceId } });
      if (!existing) return null;
      const updated = await db.gmpBusinessKnowledgeWorkspace.update({
        where: { knowledgeWorkspaceId: workspaceId },
        data: {
          workspaceVersion: changes.workspaceVersion,
          status: changes.status,
          lifecycleState: changes.lifecycleState,
          completenessScore: changes.completenessScore,
          confidenceScore: changes.confidenceScore,
          lastReviewedAt: changes.lastReviewedAt === undefined ? undefined : changes.lastReviewedAt ? new Date(changes.lastReviewedAt) : null,
          lastApprovedAt: changes.lastApprovedAt === undefined ? undefined : changes.lastApprovedAt ? new Date(changes.lastApprovedAt) : null,
          approvedBy: changes.approvedBy,
          metadata: changes.metadata,
          version: existing.version + 1,
        },
      });
      return mapWorkspace(updated);
    },

    async createRecord(record) {
      const created = await db.gmpKnowledgeRecord.create({ data: { knowledgeRecordId: `gmpkr_${randomUUID()}`, ...record } });
      return mapRecord(created);
    },

    async updateRecord(recordId, changes) {
      const existing = await db.gmpKnowledgeRecord.findUnique({ where: { knowledgeRecordId: recordId } });
      if (!existing) return null;
      const updated = await db.gmpKnowledgeRecord.update({
        where: { knowledgeRecordId: recordId },
        data: {
          domain: changes.domain,
          recordType: changes.recordType,
          canonicalKey: changes.canonicalKey,
          title: changes.title,
          summary: changes.summary,
          structuredValue: changes.structuredValue,
          normalizedValue: changes.normalizedValue,
          status: changes.status,
          confidence: changes.confidence,
          priority: changes.priority,
          effectiveFrom: changes.effectiveFrom === undefined ? undefined : changes.effectiveFrom ? new Date(changes.effectiveFrom) : null,
          effectiveUntil: changes.effectiveUntil === undefined ? undefined : changes.effectiveUntil ? new Date(changes.effectiveUntil) : null,
          sourceCount: changes.sourceCount,
          conflictState: changes.conflictState,
          reviewState: changes.reviewState,
          parentRecordId: changes.parentRecordId,
          supersededByRecordId: changes.supersededByRecordId,
          archivedAt: changes.archivedAt === undefined ? undefined : changes.archivedAt ? new Date(changes.archivedAt) : null,
          metadata: changes.metadata,
          version: existing.version + 1,
        },
      });
      return mapRecord(updated);
    },

    async getRecordById(recordId) {
      const row = await db.gmpKnowledgeRecord.findUnique({ where: { knowledgeRecordId: recordId } });
      return row ? mapRecord(row) : null;
    },

    async listRecords(projectId, filters) {
      const rows = await db.gmpKnowledgeRecord.findMany({
        where: {
          projectId,
          domain: filters?.domain,
          archivedAt: filters?.includeArchived ? undefined : null,
        },
        orderBy: [{ updatedAt: "desc" }],
      });
      return rows.map(mapRecord);
    },

    async archiveRecord(recordId) {
      return this.updateRecord(recordId, { status: "ARCHIVED", archivedAt: nowIso() });
    },

    async restoreRecord(recordId) {
      return this.updateRecord(recordId, { status: "DRAFT", archivedAt: null });
    },

    async createRecordVersion(version) {
      const created = await db.gmpKnowledgeRecordVersion.create({
        data: {
          knowledgeRecordVersionId: `gmpkrv_${randomUUID()}`,
          ...version,
          changedAt: new Date(version.changedAt),
        },
      });
      return mapRecordVersion(created);
    },

    async listRecordVersions(recordId) {
      const rows = await db.gmpKnowledgeRecordVersion.findMany({
        where: { knowledgeRecordId: recordId },
        orderBy: [{ versionNumber: "desc" }],
      });
      return rows.map(mapRecordVersion);
    },

    async createSource(source) {
      const created = await db.gmpKnowledgeSource.create({
        data: {
          sourceId: `gmpsrc_${randomUUID()}`,
          ...source,
          capturedAt: source.capturedAt ? new Date(source.capturedAt) : null,
        },
      });
      return mapSource(created);
    },

    async listSources(projectId) {
      const rows = await db.gmpKnowledgeSource.findMany({ where: { projectId }, orderBy: [{ createdAt: "desc" }] });
      return rows.map(mapSource);
    },

    async createEvidenceLink(link) {
      const created = await db.gmpKnowledgeEvidenceLink.create({
        data: {
          knowledgeEvidenceLinkId: `gmpevi_${randomUUID()}`,
          ...link,
          verifiedAt: link.verifiedAt ? new Date(link.verifiedAt) : null,
        },
      });
      return mapEvidence(created);
    },

    async listEvidenceForRecord(recordId) {
      const rows = await db.gmpKnowledgeEvidenceLink.findMany({
        where: { knowledgeRecordId: recordId },
        orderBy: [{ createdAt: "desc" }],
      });
      return rows.map(mapEvidence);
    },

    async createReview(review) {
      const created = await db.gmpKnowledgeReview.create({
        data: {
          knowledgeReviewId: `gmprvw_${randomUUID()}`,
          ...review,
          requestedAt: review.requestedAt ? new Date(review.requestedAt) : null,
          completedAt: review.completedAt ? new Date(review.completedAt) : null,
        },
      });
      return mapReview(created);
    },

    async listReviewQueue(projectId) {
      const rows = await db.gmpKnowledgeReview.findMany({
        where: { projectId, reviewState: { in: ["REQUIRES_REVIEW", "UNDER_REVIEW"] } },
        orderBy: [{ updatedAt: "desc" }],
      });
      return rows.map(mapReview);
    },

    async createApproval(approval) {
      const created = await db.gmpKnowledgeApproval.create({
        data: {
          knowledgeApprovalId: `gmpapr_${randomUUID()}`,
          ...approval,
          decidedAt: new Date(approval.decidedAt),
        },
      });
      return mapApproval(created);
    },

    async listConflicts(projectId) {
      const conflicts = await db.gmpKnowledgeConflict.findMany({
        where: { projectId },
        orderBy: [{ updatedAt: "desc" }],
      });

      const conflictIds = conflicts.map((entry: any) => entry.knowledgeConflictId);
      const members = conflictIds.length === 0 ? [] : await db.gmpKnowledgeConflictMember.findMany({
        where: { knowledgeConflictId: { in: conflictIds } },
      });
      const membersByConflict = new Map<string, GmpKnowledgeConflictMember[]>();
      for (const member of members) {
        const key = member.knowledgeConflictId as string;
        const bucket = membersByConflict.get(key) ?? [];
        bucket.push(mapConflictMember(member));
        membersByConflict.set(key, bucket);
      }

      return conflicts.map((conflict: any) => ({
        conflict: mapConflict(conflict),
        members: membersByConflict.get(conflict.knowledgeConflictId) ?? [],
      }));
    },

    async upsertConflict(conflict, memberRecordIds) {
      const existing = await db.gmpKnowledgeConflict.findFirst({
        where: {
          projectId: conflict.projectId,
          knowledgeWorkspaceId: conflict.knowledgeWorkspaceId,
          conflictGroup: conflict.conflictGroup,
          resolutionStatus: "OPEN",
        },
      });

      const persisted = existing
        ? await db.gmpKnowledgeConflict.update({
          where: { knowledgeConflictId: existing.knowledgeConflictId },
          data: {
            conflictReason: conflict.conflictReason,
            severity: conflict.severity,
            resolutionStatus: conflict.resolutionStatus,
            selectedRecordId: conflict.selectedRecordId,
            resolutionNotes: conflict.resolutionNotes,
            resolvedBy: conflict.resolvedBy,
            resolvedAt: conflict.resolvedAt ? new Date(conflict.resolvedAt) : null,
            metadata: conflict.metadata,
          },
        })
        : await db.gmpKnowledgeConflict.create({
          data: {
            knowledgeConflictId: `gmpcfl_${randomUUID()}`,
            ...conflict,
            resolvedAt: conflict.resolvedAt ? new Date(conflict.resolvedAt) : null,
          },
        });

      await db.gmpKnowledgeConflictMember.deleteMany({ where: { knowledgeConflictId: persisted.knowledgeConflictId } });
      if (memberRecordIds.length > 0) {
        await db.gmpKnowledgeConflictMember.createMany({
          data: memberRecordIds.map((recordId) => ({
            knowledgeConflictMemberId: `gmpcfm_${randomUUID()}`,
            projectId: conflict.projectId,
            knowledgeConflictId: persisted.knowledgeConflictId,
            knowledgeRecordId: recordId,
          })),
        });
      }

      return mapConflict(persisted);
    },

    async resolveConflict(conflictId, input) {
      const existing = await db.gmpKnowledgeConflict.findUnique({ where: { knowledgeConflictId: conflictId } });
      if (!existing) return null;
      const updated = await db.gmpKnowledgeConflict.update({
        where: { knowledgeConflictId: conflictId },
        data: {
          resolutionStatus: "RESOLVED",
          selectedRecordId: input.selectedRecordId,
          resolutionNotes: input.resolutionNotes,
          resolvedBy: input.resolvedBy,
          resolvedAt: new Date(),
        },
      });
      return mapConflict(updated);
    },

    async createCompletenessAssessment(assessment) {
      const created = await db.gmpKnowledgeCompletenessAssessment.create({
        data: {
          knowledgeCompletenessAssessmentId: `gmpcmp_${randomUUID()}`,
          ...assessment,
        },
      });
      return mapCompleteness(created);
    },

    async getLatestCompletenessAssessment(projectId) {
      const row = await db.gmpKnowledgeCompletenessAssessment.findFirst({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }],
      });
      return row ? mapCompleteness(row) : null;
    },

    async createContextAssemblyRecord(record) {
      const created = await db.gmpContextAssemblyRecord.create({
        data: {
          contextAssemblyRecordId: `gmpctx_${randomUUID()}`,
          ...record,
        },
      });
      return mapAssembly(created);
    },

    async listContextAssemblyRecords(projectId) {
      const rows = await db.gmpContextAssemblyRecord.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }],
      });
      return rows.map(mapAssembly);
    },
  };
}

export function createInMemoryGmpKnowledgeRepository(seed?: {
  workspaces?: GmpBusinessKnowledgeWorkspace[];
  records?: GmpKnowledgeRecord[];
  versions?: GmpKnowledgeRecordVersion[];
  sources?: GmpKnowledgeSource[];
  evidenceLinks?: GmpKnowledgeEvidenceLink[];
  reviews?: GmpKnowledgeReview[];
  approvals?: GmpKnowledgeApproval[];
  conflicts?: GmpKnowledgeConflict[];
  conflictMembers?: GmpKnowledgeConflictMember[];
  completeness?: GmpKnowledgeCompletenessAssessment[];
  assemblies?: GmpContextAssemblyRecord[];
}): GmpKnowledgeRepository {
  const workspaces = new Map((seed?.workspaces ?? []).map((entry) => [entry.knowledgeWorkspaceId, entry]));
  const workspacesByProject = new Map((seed?.workspaces ?? []).map((entry) => [entry.projectId, entry.knowledgeWorkspaceId]));
  const records = new Map((seed?.records ?? []).map((entry) => [entry.knowledgeRecordId, entry]));
  const versions = [...(seed?.versions ?? [])];
  const sources = new Map((seed?.sources ?? []).map((entry) => [entry.sourceId, entry]));
  const evidenceLinks = new Map((seed?.evidenceLinks ?? []).map((entry) => [entry.knowledgeEvidenceLinkId, entry]));
  const reviews = new Map((seed?.reviews ?? []).map((entry) => [entry.knowledgeReviewId, entry]));
  const approvals = new Map((seed?.approvals ?? []).map((entry) => [entry.knowledgeApprovalId, entry]));
  const conflicts = new Map((seed?.conflicts ?? []).map((entry) => [entry.knowledgeConflictId, entry]));
  const conflictMembers = new Map((seed?.conflictMembers ?? []).map((entry) => [entry.knowledgeConflictMemberId, entry]));
  const completeness = [...(seed?.completeness ?? [])];
  const assemblies = [...(seed?.assemblies ?? [])];

  return {
    async ensureWorkspace(projectId) {
      const workspaceId = workspacesByProject.get(projectId);
      if (workspaceId) {
        return workspaces.get(workspaceId)!;
      }

      const created = buildKnowledgeWorkspace(projectId);
      workspaces.set(created.knowledgeWorkspaceId, created);
      workspacesByProject.set(projectId, created.knowledgeWorkspaceId);
      return created;
    },
    async getWorkspaceByProjectId(projectId) {
      const workspaceId = workspacesByProject.get(projectId);
      return workspaceId ? (workspaces.get(workspaceId) ?? null) : null;
    },
    async updateWorkspace(workspaceId, changes) {
      const current = workspaces.get(workspaceId);
      if (!current) return null;
      const updated = {
        ...current,
        ...changes,
        version: current.version + 1,
        updatedAt: nowIso(),
      };
      workspaces.set(workspaceId, updated);
      return updated;
    },

    async createRecord(record) {
      const created: GmpKnowledgeRecord = {
        ...record,
        knowledgeRecordId: `gmpkr_${randomUUID()}`,
        version: 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      records.set(created.knowledgeRecordId, created);
      return created;
    },
    async updateRecord(recordId, changes) {
      const current = records.get(recordId);
      if (!current) return null;
      const updated: GmpKnowledgeRecord = {
        ...current,
        ...changes,
        version: current.version + 1,
        updatedAt: nowIso(),
      };
      records.set(recordId, updated);
      return updated;
    },
    async getRecordById(recordId) {
      return records.get(recordId) ?? null;
    },
    async listRecords(projectId, filters) {
      return [...records.values()]
        .filter((record) => record.projectId === projectId)
        .filter((record) => (filters?.domain ? record.domain === filters.domain : true))
        .filter((record) => (filters?.includeArchived ? true : !record.archivedAt))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async archiveRecord(recordId) {
      return this.updateRecord(recordId, { status: "ARCHIVED", archivedAt: nowIso() });
    },
    async restoreRecord(recordId) {
      return this.updateRecord(recordId, { status: "DRAFT", archivedAt: null });
    },

    async createRecordVersion(version) {
      const created: GmpKnowledgeRecordVersion = {
        ...version,
        knowledgeRecordVersionId: `gmpkrv_${randomUUID()}`,
        createdAt: nowIso(),
      };
      versions.push(created);
      return created;
    },
    async listRecordVersions(recordId) {
      return versions
        .filter((entry) => entry.knowledgeRecordId === recordId)
        .sort((left, right) => right.versionNumber - left.versionNumber);
    },

    async createSource(source) {
      const created: GmpKnowledgeSource = {
        ...source,
        sourceId: `gmpsrc_${randomUUID()}`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      sources.set(created.sourceId, created);
      return created;
    },
    async listSources(projectId) {
      return [...sources.values()].filter((entry) => entry.projectId === projectId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },

    async createEvidenceLink(link) {
      const created: GmpKnowledgeEvidenceLink = {
        ...link,
        knowledgeEvidenceLinkId: `gmpevi_${randomUUID()}`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      evidenceLinks.set(created.knowledgeEvidenceLinkId, created);
      return created;
    },
    async listEvidenceForRecord(recordId) {
      return [...evidenceLinks.values()].filter((entry) => entry.knowledgeRecordId === recordId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },

    async createReview(review) {
      const created: GmpKnowledgeReview = {
        ...review,
        knowledgeReviewId: `gmprvw_${randomUUID()}`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      reviews.set(created.knowledgeReviewId, created);
      return created;
    },
    async listReviewQueue(projectId) {
      return [...reviews.values()]
        .filter((entry) => entry.projectId === projectId && (entry.reviewState === "REQUIRES_REVIEW" || entry.reviewState === "UNDER_REVIEW"))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async createApproval(approval) {
      const created: GmpKnowledgeApproval = {
        ...approval,
        knowledgeApprovalId: `gmpapr_${randomUUID()}`,
        createdAt: nowIso(),
      };
      approvals.set(created.knowledgeApprovalId, created);
      return created;
    },

    async listConflicts(projectId) {
      const conflictRows = [...conflicts.values()].filter((entry) => entry.projectId === projectId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return conflictRows.map((conflict) => ({
        conflict,
        members: [...conflictMembers.values()].filter((member) => member.knowledgeConflictId === conflict.knowledgeConflictId),
      }));
    },
    async upsertConflict(conflict, memberRecordIds) {
      const existing = [...conflicts.values()].find((entry) => entry.projectId === conflict.projectId && entry.conflictGroup === conflict.conflictGroup && entry.resolutionStatus === "OPEN");
      const next: GmpKnowledgeConflict = {
        knowledgeConflictId: existing?.knowledgeConflictId ?? `gmpcfl_${randomUUID()}`,
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
        ...conflict,
      };
      conflicts.set(next.knowledgeConflictId, next);

      for (const member of [...conflictMembers.values()]) {
        if (member.knowledgeConflictId === next.knowledgeConflictId) {
          conflictMembers.delete(member.knowledgeConflictMemberId);
        }
      }
      for (const recordId of memberRecordIds) {
        const member: GmpKnowledgeConflictMember = {
          knowledgeConflictMemberId: `gmpcfm_${randomUUID()}`,
          projectId: conflict.projectId,
          knowledgeConflictId: next.knowledgeConflictId,
          knowledgeRecordId: recordId,
          createdAt: nowIso(),
        };
        conflictMembers.set(member.knowledgeConflictMemberId, member);
      }

      return next;
    },
    async resolveConflict(conflictId, input) {
      const current = conflicts.get(conflictId);
      if (!current) return null;
      const updated: GmpKnowledgeConflict = {
        ...current,
        resolutionStatus: "RESOLVED",
        selectedRecordId: input.selectedRecordId,
        resolutionNotes: input.resolutionNotes,
        resolvedBy: input.resolvedBy,
        resolvedAt: nowIso(),
        updatedAt: nowIso(),
      };
      conflicts.set(conflictId, updated);
      return updated;
    },

    async createCompletenessAssessment(assessment) {
      const created: GmpKnowledgeCompletenessAssessment = {
        ...assessment,
        knowledgeCompletenessAssessmentId: `gmpcmp_${randomUUID()}`,
        createdAt: nowIso(),
      };
      completeness.push(created);
      return created;
    },
    async getLatestCompletenessAssessment(projectId) {
      const rows = completeness.filter((entry) => entry.projectId === projectId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return rows[0] ?? null;
    },

    async createContextAssemblyRecord(record) {
      const created: GmpContextAssemblyRecord = {
        ...record,
        contextAssemblyRecordId: `gmpctx_${randomUUID()}`,
        createdAt: nowIso(),
      };
      assemblies.push(created);
      return created;
    },
    async listContextAssemblyRecords(projectId) {
      return assemblies.filter((entry) => entry.projectId === projectId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
  };
}
