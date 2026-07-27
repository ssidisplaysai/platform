/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  GmpContentApproval,
  GmpContentAssembly,
  GmpContentDraft,
  GmpContentReview,
  GmpContentValidation,
  GmpGenerationLineage,
  GmpGenerationRequest,
  GmpSectionContent,
  GmpSectionContentRevision,
  GmpSectionValidation,
} from "./content-models";

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function asJson(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function mapDraft(row: any): GmpContentDraft {
  return {
    contentDraftId: row.contentDraftId,
    projectId: row.projectId,
    siteId: row.siteId,
    pageId: row.pageId,
    pageVersion: row.pageVersion,
    pageBriefId: row.pageBriefId,
    pageBriefVersion: row.pageBriefVersion,
    contentPlanId: row.contentPlanId,
    contentPlanVersion: row.contentPlanVersion,
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    knowledgeWorkspaceVersion: row.knowledgeWorkspaceVersion,
    brandProfileVersion: row.brandProfileVersion,
    generationRequestId: row.generationRequestId ?? undefined,
    generationStatus: row.generationStatus,
    editorialStatus: row.editorialStatus,
    approvalStatus: row.approvalStatus,
    language: row.language,
    locale: row.locale,
    provider: row.provider,
    modelIdentifier: row.modelIdentifier,
    generationPolicyVersion: row.generationPolicyVersion,
    promptAdapterVersion: row.promptAdapterVersion,
    createdBy: row.createdBy,
    submittedAt: iso(row.submittedAt),
    approvedAt: iso(row.approvedAt),
    approvedBy: row.approvedBy ?? undefined,
    rejectedAt: iso(row.rejectedAt),
    rejectedBy: row.rejectedBy ?? undefined,
    supersededAt: iso(row.supersededAt),
    metadata: asJson(row.metadata),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapGenerationRequest(row: any): GmpGenerationRequest {
  return {
    generationRequestId: row.generationRequestId,
    projectId: row.projectId,
    pageId: row.pageId,
    contentDraftId: row.contentDraftId,
    operationType: row.operationType,
    requestedSections: asStringArray(row.requestedSections),
    generationMode: row.generationMode,
    providerPreference: row.providerPreference ?? undefined,
    modelPreference: row.modelPreference ?? undefined,
    temperature: row.temperature ?? undefined,
    maximumOutputPolicy: row.maximumOutputPolicy ?? undefined,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    startedAt: iso(row.startedAt),
    completedAt: iso(row.completedAt),
    failedAt: iso(row.failedAt),
    failureReason: row.failureReason ?? undefined,
    retryCount: row.retryCount,
    gopExecutionId: row.gopExecutionId ?? undefined,
    contextPackageReference: row.contextPackageReference ?? undefined,
    inputFingerprint: row.inputFingerprint,
    status: row.status,
    metadata: asJson(row.metadata),
  };
}

function mapSectionContent(row: any): GmpSectionContent {
  return {
    sectionContentId: row.sectionContentId,
    contentDraftId: row.contentDraftId,
    pageSectionId: row.pageSectionId,
    pageSectionStableKey: row.pageSectionStableKey,
    sectionType: row.sectionType,
    position: row.position,
    heading: row.heading ?? undefined,
    bodyContent: row.bodyContent ?? undefined,
    structuredContent: asJson(row.structuredContent) ?? {},
    ctaContent: asJson(row.ctaContent) ?? {},
    mediaGuidance: asJson(row.mediaGuidance) ?? {},
    internalLinkSuggestions: Array.isArray(row.internalLinkSuggestions) ? row.internalLinkSuggestions as Array<Record<string, unknown>> : [],
    externalEvidenceReferences: asStringArray(row.externalEvidenceReferences),
    knowledgeRecordReferences: Array.isArray(row.knowledgeRecordReferences) ? row.knowledgeRecordReferences.map((entry: any) => ({ knowledgeRecordId: String(entry.knowledgeRecordId), version: Number(entry.version ?? 1) })) : [],
    claimReferences: asStringArray(row.claimReferences),
    sourceReferences: asStringArray(row.sourceReferences),
    restrictionEvaluation: asJson(row.restrictionEvaluation) ?? {},
    generationStatus: row.generationStatus,
    editorialStatus: row.editorialStatus,
    approvalStatus: row.approvalStatus,
    wordCount: row.wordCount,
    readingLevel: row.readingLevel ?? undefined,
    metadata: asJson(row.metadata),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRevision(row: any): GmpSectionContentRevision {
  return {
    sectionContentRevisionId: row.sectionContentRevisionId,
    sectionContentId: row.sectionContentId,
    contentDraftId: row.contentDraftId,
    revisionType: row.revisionType,
    instruction: row.instruction ?? undefined,
    reason: row.reason ?? undefined,
    previousContent: asJson(row.previousContent) ?? {},
    newContent: asJson(row.newContent) ?? {},
    changedBy: row.changedBy,
    changedAt: row.changedAt.toISOString(),
    provider: row.provider ?? undefined,
    modelIdentifier: row.modelIdentifier ?? undefined,
    inputFingerprint: row.inputFingerprint ?? undefined,
    knowledgeImpact: asJson(row.knowledgeImpact) ?? {},
    evidenceImpact: asJson(row.evidenceImpact) ?? {},
    validationResult: asJson(row.validationResult) ?? {},
    metadata: asJson(row.metadata),
  };
}

function mapReview(row: any): GmpContentReview {
  return {
    contentReviewId: row.contentReviewId,
    projectId: row.projectId,
    pageId: row.pageId,
    contentDraftId: row.contentDraftId,
    sectionContentId: row.sectionContentId ?? undefined,
    assignedTo: row.assignedTo ?? undefined,
    reviewState: row.reviewState,
    requestedBy: row.requestedBy ?? undefined,
    requestedAt: iso(row.requestedAt),
    completedBy: row.completedBy ?? undefined,
    completedAt: iso(row.completedAt),
    reviewNotes: row.reviewNotes ?? undefined,
    sectionNotes: row.sectionNotes ?? undefined,
    approvalNotes: row.approvalNotes ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapApproval(row: any): GmpContentApproval {
  return {
    contentApprovalId: row.contentApprovalId,
    projectId: row.projectId,
    pageId: row.pageId,
    contentDraftId: row.contentDraftId,
    sectionContentId: row.sectionContentId ?? undefined,
    decision: row.decision,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt.toISOString(),
    notes: row.notes ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapContentValidation(row: any): GmpContentValidation {
  return {
    contentValidationId: row.contentValidationId,
    projectId: row.projectId,
    pageId: row.pageId,
    contentDraftId: row.contentDraftId,
    validationModelVersion: row.validationModelVersion,
    overallScore: row.overallScore,
    blockingIssues: asStringArray(row.blockingIssues),
    warnings: asStringArray(row.warnings),
    recommendations: asStringArray(row.recommendations),
    sectionScores: Array.isArray(row.sectionScores) ? row.sectionScores.map((entry: any) => ({ sectionContentId: String(entry.sectionContentId), score: Number(entry.score ?? 0) })) : [],
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSectionValidation(row: any): GmpSectionValidation {
  return {
    sectionValidationId: row.sectionValidationId,
    projectId: row.projectId,
    pageId: row.pageId,
    contentDraftId: row.contentDraftId,
    sectionContentId: row.sectionContentId,
    validationModelVersion: row.validationModelVersion,
    editorialScore: row.editorialScore,
    blockingIssues: asStringArray(row.blockingIssues),
    warnings: asStringArray(row.warnings),
    recommendations: asStringArray(row.recommendations),
    claimClassifications: Array.isArray(row.claimClassifications) ? row.claimClassifications.map((entry: any) => ({ statement: String(entry.statement ?? ""), classification: entry.classification, reason: String(entry.reason ?? "") })) : [],
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapLineage(row: any): GmpGenerationLineage {
  return {
    generationLineageId: row.generationLineageId,
    projectId: row.projectId,
    pageId: row.pageId,
    contentDraftId: row.contentDraftId,
    sectionContentId: row.sectionContentId ?? undefined,
    pageVersion: row.pageVersion,
    pageBriefId: row.pageBriefId,
    pageBriefVersion: row.pageBriefVersion,
    contentPlanId: row.contentPlanId,
    contentPlanVersion: row.contentPlanVersion,
    pageSectionId: row.pageSectionId ?? undefined,
    pageSectionStableKey: row.pageSectionStableKey ?? undefined,
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    knowledgeWorkspaceVersion: row.knowledgeWorkspaceVersion,
    knowledgeRecordVersions: Array.isArray(row.knowledgeRecordVersions) ? row.knowledgeRecordVersions as Array<{ knowledgeRecordId: string; version: number }> : [],
    evidenceReferences: asStringArray(row.evidenceReferences),
    claims: asStringArray(row.claims),
    restrictions: asStringArray(row.restrictions),
    provider: row.provider,
    modelIdentifier: row.modelIdentifier,
    promptAdapterVersion: row.promptAdapterVersion,
    inputFingerprint: row.inputFingerprint,
    generationRequestId: row.generationRequestId,
    gopExecutionId: row.gopExecutionId ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapAssembly(row: any): GmpContentAssembly {
  return {
    contentAssemblyId: row.contentAssemblyId,
    projectId: row.projectId,
    pageId: row.pageId,
    contentDraftId: row.contentDraftId,
    assemblyType: row.assemblyType,
    assembledDocument: asJson(row.assembledDocument) ?? {},
    validationSummary: asJson(row.validationSummary) ?? {},
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type GmpContentRepository = {
  createDraft: (draft: Omit<GmpContentDraft, "contentDraftId" | "createdAt" | "updatedAt" | "version">) => Promise<GmpContentDraft>;
  updateDraft: (contentDraftId: string, changes: Partial<GmpContentDraft>) => Promise<GmpContentDraft | null>;
  getDraftById: (contentDraftId: string) => Promise<GmpContentDraft | null>;
  listDraftsForPage: (pageId: string) => Promise<GmpContentDraft[]>;

  createGenerationRequest: (request: Omit<GmpGenerationRequest, "generationRequestId" | "requestedAt">) => Promise<GmpGenerationRequest>;
  updateGenerationRequest: (generationRequestId: string, changes: Partial<GmpGenerationRequest>) => Promise<GmpGenerationRequest | null>;
  getGenerationRequestById: (generationRequestId: string) => Promise<GmpGenerationRequest | null>;
  listGenerationRequestsForDraft: (contentDraftId: string) => Promise<GmpGenerationRequest[]>;

  createSectionContent: (section: Omit<GmpSectionContent, "sectionContentId" | "createdAt" | "updatedAt" | "version">) => Promise<GmpSectionContent>;
  updateSectionContent: (sectionContentId: string, changes: Partial<GmpSectionContent>) => Promise<GmpSectionContent | null>;
  getSectionContentById: (sectionContentId: string) => Promise<GmpSectionContent | null>;
  listSectionContentsForDraft: (contentDraftId: string) => Promise<GmpSectionContent[]>;

  createSectionRevision: (revision: Omit<GmpSectionContentRevision, "sectionContentRevisionId">) => Promise<GmpSectionContentRevision>;
  listSectionRevisions: (sectionContentId: string) => Promise<GmpSectionContentRevision[]>;

  createReview: (review: Omit<GmpContentReview, "contentReviewId" | "createdAt" | "updatedAt">) => Promise<GmpContentReview>;
  listReviewsForDraft: (contentDraftId: string) => Promise<GmpContentReview[]>;

  createApproval: (approval: Omit<GmpContentApproval, "contentApprovalId" | "createdAt">) => Promise<GmpContentApproval>;
  listApprovalsForDraft: (contentDraftId: string) => Promise<GmpContentApproval[]>;

  createContentValidation: (validation: Omit<GmpContentValidation, "contentValidationId" | "createdAt">) => Promise<GmpContentValidation>;
  getLatestContentValidation: (contentDraftId: string) => Promise<GmpContentValidation | null>;
  createSectionValidation: (validation: Omit<GmpSectionValidation, "sectionValidationId" | "createdAt">) => Promise<GmpSectionValidation>;
  getLatestSectionValidation: (sectionContentId: string) => Promise<GmpSectionValidation | null>;

  createLineage: (lineage: Omit<GmpGenerationLineage, "generationLineageId" | "createdAt">) => Promise<GmpGenerationLineage>;
  listLineageForDraft: (contentDraftId: string) => Promise<GmpGenerationLineage[]>;

  upsertAssembly: (assembly: Omit<GmpContentAssembly, "contentAssemblyId" | "createdAt" | "updatedAt"> & { contentAssemblyId?: string }) => Promise<GmpContentAssembly>;
  getAssemblyForDraft: (contentDraftId: string) => Promise<GmpContentAssembly | null>;
};

export function createPrismaGmpContentRepository(prisma: PrismaClient = getPrismaClient()): GmpContentRepository {
  const db = prisma as unknown as Record<string, any>;
  return {
    async createDraft(draft) {
      const created = await db.gmpContentDraft.create({ data: { contentDraftId: `gmpdr_${randomUUID()}`, ...draft, submittedAt: draft.submittedAt ? new Date(draft.submittedAt) : null, approvedAt: draft.approvedAt ? new Date(draft.approvedAt) : null, rejectedAt: draft.rejectedAt ? new Date(draft.rejectedAt) : null, supersededAt: draft.supersededAt ? new Date(draft.supersededAt) : null } });
      return mapDraft(created);
    },
    async updateDraft(contentDraftId, changes) {
      const existing = await db.gmpContentDraft.findUnique({ where: { contentDraftId } });
      if (!existing) return null;
      const updated = await db.gmpContentDraft.update({ where: { contentDraftId }, data: { ...changes, submittedAt: changes.submittedAt === undefined ? undefined : changes.submittedAt ? new Date(changes.submittedAt) : null, approvedAt: changes.approvedAt === undefined ? undefined : changes.approvedAt ? new Date(changes.approvedAt) : null, rejectedAt: changes.rejectedAt === undefined ? undefined : changes.rejectedAt ? new Date(changes.rejectedAt) : null, supersededAt: changes.supersededAt === undefined ? undefined : changes.supersededAt ? new Date(changes.supersededAt) : null, version: existing.version + 1 } });
      return mapDraft(updated);
    },
    async getDraftById(contentDraftId) {
      const row = await db.gmpContentDraft.findUnique({ where: { contentDraftId } });
      return row ? mapDraft(row) : null;
    },
    async listDraftsForPage(pageId) {
      const rows = await db.gmpContentDraft.findMany({ where: { pageId }, orderBy: [{ updatedAt: "desc" }] });
      return rows.map(mapDraft);
    },

    async createGenerationRequest(request) {
      const created = await db.gmpGenerationRequest.create({ data: { generationRequestId: `gmpgr_${randomUUID()}`, ...request, requestedAt: new Date(), startedAt: request.startedAt ? new Date(request.startedAt) : null, completedAt: request.completedAt ? new Date(request.completedAt) : null, failedAt: request.failedAt ? new Date(request.failedAt) : null } });
      return mapGenerationRequest(created);
    },
    async updateGenerationRequest(generationRequestId, changes) {
      const row = await db.gmpGenerationRequest.findUnique({ where: { generationRequestId } });
      if (!row) return null;
      const updated = await db.gmpGenerationRequest.update({ where: { generationRequestId }, data: { ...changes, startedAt: changes.startedAt === undefined ? undefined : changes.startedAt ? new Date(changes.startedAt) : null, completedAt: changes.completedAt === undefined ? undefined : changes.completedAt ? new Date(changes.completedAt) : null, failedAt: changes.failedAt === undefined ? undefined : changes.failedAt ? new Date(changes.failedAt) : null } });
      return mapGenerationRequest(updated);
    },
    async getGenerationRequestById(generationRequestId) {
      const row = await db.gmpGenerationRequest.findUnique({ where: { generationRequestId } });
      return row ? mapGenerationRequest(row) : null;
    },
    async listGenerationRequestsForDraft(contentDraftId) {
      const rows = await db.gmpGenerationRequest.findMany({ where: { contentDraftId }, orderBy: [{ requestedAt: "desc" }] });
      return rows.map(mapGenerationRequest);
    },

    async createSectionContent(section) {
      const created = await db.gmpSectionContent.create({ data: { sectionContentId: `gmpsc_${randomUUID()}`, ...section } });
      return mapSectionContent(created);
    },
    async updateSectionContent(sectionContentId, changes) {
      const existing = await db.gmpSectionContent.findUnique({ where: { sectionContentId } });
      if (!existing) return null;
      const updated = await db.gmpSectionContent.update({ where: { sectionContentId }, data: { ...changes, version: existing.version + 1 } });
      return mapSectionContent(updated);
    },
    async getSectionContentById(sectionContentId) {
      const row = await db.gmpSectionContent.findUnique({ where: { sectionContentId } });
      return row ? mapSectionContent(row) : null;
    },
    async listSectionContentsForDraft(contentDraftId) {
      const rows = await db.gmpSectionContent.findMany({ where: { contentDraftId }, orderBy: [{ position: "asc" }] });
      return rows.map(mapSectionContent);
    },

    async createSectionRevision(revision) {
      const created = await db.gmpSectionContentRevision.create({ data: { sectionContentRevisionId: `gmpscr_${randomUUID()}`, ...revision, changedAt: new Date(revision.changedAt) } });
      return mapRevision(created);
    },
    async listSectionRevisions(sectionContentId) {
      const rows = await db.gmpSectionContentRevision.findMany({ where: { sectionContentId }, orderBy: [{ changedAt: "desc" }] });
      return rows.map(mapRevision);
    },

    async createReview(review) {
      const created = await db.gmpContentReview.create({ data: { contentReviewId: `gmpcrv_${randomUUID()}`, ...review, requestedAt: review.requestedAt ? new Date(review.requestedAt) : null, completedAt: review.completedAt ? new Date(review.completedAt) : null } });
      return mapReview(created);
    },
    async listReviewsForDraft(contentDraftId) {
      const rows = await db.gmpContentReview.findMany({ where: { contentDraftId }, orderBy: [{ updatedAt: "desc" }] });
      return rows.map(mapReview);
    },

    async createApproval(approval) {
      const created = await db.gmpContentApproval.create({ data: { contentApprovalId: `gmpcap_${randomUUID()}`, ...approval, decidedAt: new Date(approval.decidedAt) } });
      return mapApproval(created);
    },
    async listApprovalsForDraft(contentDraftId) {
      const rows = await db.gmpContentApproval.findMany({ where: { contentDraftId }, orderBy: [{ decidedAt: "desc" }] });
      return rows.map(mapApproval);
    },

    async createContentValidation(validation) {
      const created = await db.gmpContentValidation.create({ data: { contentValidationId: `gmpcvd_${randomUUID()}`, ...validation } });
      return mapContentValidation(created);
    },
    async getLatestContentValidation(contentDraftId) {
      const row = await db.gmpContentValidation.findFirst({ where: { contentDraftId }, orderBy: [{ createdAt: "desc" }] });
      return row ? mapContentValidation(row) : null;
    },
    async createSectionValidation(validation) {
      const created = await db.gmpSectionValidation.create({ data: { sectionValidationId: `gmpsvd_${randomUUID()}`, ...validation } });
      return mapSectionValidation(created);
    },
    async getLatestSectionValidation(sectionContentId) {
      const row = await db.gmpSectionValidation.findFirst({ where: { sectionContentId }, orderBy: [{ createdAt: "desc" }] });
      return row ? mapSectionValidation(row) : null;
    },

    async createLineage(lineage) {
      const created = await db.gmpGenerationLineage.create({ data: { generationLineageId: `gmpgl_${randomUUID()}`, ...lineage } });
      return mapLineage(created);
    },
    async listLineageForDraft(contentDraftId) {
      const rows = await db.gmpGenerationLineage.findMany({ where: { contentDraftId }, orderBy: [{ createdAt: "desc" }] });
      return rows.map(mapLineage);
    },

    async upsertAssembly(assembly) {
      const existing = await db.gmpContentAssembly.findFirst({ where: { contentDraftId: assembly.contentDraftId } });
      if (!existing) {
        const created = await db.gmpContentAssembly.create({ data: { contentAssemblyId: assembly.contentAssemblyId ?? `gmpasm_${randomUUID()}`, ...assembly } });
        return mapAssembly(created);
      }
      const updated = await db.gmpContentAssembly.update({ where: { contentAssemblyId: existing.contentAssemblyId }, data: assembly });
      return mapAssembly(updated);
    },
    async getAssemblyForDraft(contentDraftId) {
      const row = await db.gmpContentAssembly.findFirst({ where: { contentDraftId }, orderBy: [{ updatedAt: "desc" }] });
      return row ? mapAssembly(row) : null;
    },
  };
}

export function createInMemoryGmpContentRepository(): GmpContentRepository {
  const drafts = new Map<string, GmpContentDraft>();
  const requests = new Map<string, GmpGenerationRequest>();
  const sections = new Map<string, GmpSectionContent>();
  const revisions = new Map<string, GmpSectionContentRevision>();
  const reviews = new Map<string, GmpContentReview>();
  const approvals = new Map<string, GmpContentApproval>();
  const contentValidations = new Map<string, GmpContentValidation>();
  const sectionValidations = new Map<string, GmpSectionValidation>();
  const lineages = new Map<string, GmpGenerationLineage>();
  const assemblies = new Map<string, GmpContentAssembly>();

  return {
    async createDraft(draft) {
      const createdAt = nowIso();
      const record: GmpContentDraft = { contentDraftId: `gmpdr_${randomUUID()}`, version: 1, createdAt, updatedAt: createdAt, ...draft };
      drafts.set(record.contentDraftId, record);
      return record;
    },
    async updateDraft(contentDraftId, changes) {
      const existing = drafts.get(contentDraftId);
      if (!existing) return null;
      const updated = { ...existing, ...changes, version: existing.version + 1, updatedAt: nowIso() };
      drafts.set(contentDraftId, updated);
      return updated;
    },
    async getDraftById(contentDraftId) { return drafts.get(contentDraftId) ?? null; },
    async listDraftsForPage(pageId) { return [...drafts.values()].filter((draft) => draft.pageId === pageId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },

    async createGenerationRequest(request) {
      const record: GmpGenerationRequest = { generationRequestId: `gmpgr_${randomUUID()}`, requestedAt: nowIso(), ...request };
      requests.set(record.generationRequestId, record);
      return record;
    },
    async updateGenerationRequest(generationRequestId, changes) {
      const existing = requests.get(generationRequestId);
      if (!existing) return null;
      const updated = { ...existing, ...changes };
      requests.set(generationRequestId, updated);
      return updated;
    },
    async getGenerationRequestById(generationRequestId) { return requests.get(generationRequestId) ?? null; },
    async listGenerationRequestsForDraft(contentDraftId) { return [...requests.values()].filter((request) => request.contentDraftId === contentDraftId).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)); },

    async createSectionContent(section) {
      const createdAt = nowIso();
      const record: GmpSectionContent = { sectionContentId: `gmpsc_${randomUUID()}`, version: 1, createdAt, updatedAt: createdAt, ...section };
      sections.set(record.sectionContentId, record);
      return record;
    },
    async updateSectionContent(sectionContentId, changes) {
      const existing = sections.get(sectionContentId);
      if (!existing) return null;
      const updated = { ...existing, ...changes, version: existing.version + 1, updatedAt: nowIso() };
      sections.set(sectionContentId, updated);
      return updated;
    },
    async getSectionContentById(sectionContentId) { return sections.get(sectionContentId) ?? null; },
    async listSectionContentsForDraft(contentDraftId) { return [...sections.values()].filter((section) => section.contentDraftId === contentDraftId).sort((a, b) => a.position - b.position); },

    async createSectionRevision(revision) {
      const record: GmpSectionContentRevision = { sectionContentRevisionId: `gmpscr_${randomUUID()}`, ...revision };
      revisions.set(record.sectionContentRevisionId, record);
      return record;
    },
    async listSectionRevisions(sectionContentId) { return [...revisions.values()].filter((revision) => revision.sectionContentId === sectionContentId).sort((a, b) => b.changedAt.localeCompare(a.changedAt)); },

    async createReview(review) {
      const createdAt = nowIso();
      const record: GmpContentReview = { contentReviewId: `gmpcrv_${randomUUID()}`, createdAt, updatedAt: createdAt, ...review };
      reviews.set(record.contentReviewId, record);
      return record;
    },
    async listReviewsForDraft(contentDraftId) { return [...reviews.values()].filter((review) => review.contentDraftId === contentDraftId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },

    async createApproval(approval) {
      const record: GmpContentApproval = { contentApprovalId: `gmpcap_${randomUUID()}`, createdAt: nowIso(), ...approval };
      approvals.set(record.contentApprovalId, record);
      return record;
    },
    async listApprovalsForDraft(contentDraftId) { return [...approvals.values()].filter((approval) => approval.contentDraftId === contentDraftId).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt)); },

    async createContentValidation(validation) {
      const record: GmpContentValidation = { contentValidationId: `gmpcvd_${randomUUID()}`, createdAt: nowIso(), ...validation };
      contentValidations.set(record.contentValidationId, record);
      return record;
    },
    async getLatestContentValidation(contentDraftId) { return [...contentValidations.values()].filter((validation) => validation.contentDraftId === contentDraftId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null; },
    async createSectionValidation(validation) {
      const record: GmpSectionValidation = { sectionValidationId: `gmpsvd_${randomUUID()}`, createdAt: nowIso(), ...validation };
      sectionValidations.set(record.sectionValidationId, record);
      return record;
    },
    async getLatestSectionValidation(sectionContentId) { return [...sectionValidations.values()].filter((validation) => validation.sectionContentId === sectionContentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null; },

    async createLineage(lineage) {
      const record: GmpGenerationLineage = { generationLineageId: `gmpgl_${randomUUID()}`, createdAt: nowIso(), ...lineage };
      lineages.set(record.generationLineageId, record);
      return record;
    },
    async listLineageForDraft(contentDraftId) { return [...lineages.values()].filter((lineage) => lineage.contentDraftId === contentDraftId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },

    async upsertAssembly(assembly) {
      const existing = [...assemblies.values()].find((entry) => entry.contentDraftId === assembly.contentDraftId);
      const createdAt = existing?.createdAt ?? nowIso();
      const record: GmpContentAssembly = { contentAssemblyId: existing?.contentAssemblyId ?? assembly.contentAssemblyId ?? `gmpasm_${randomUUID()}`, createdAt, updatedAt: nowIso(), ...assembly };
      assemblies.set(record.contentAssemblyId, record);
      return record;
    },
    async getAssemblyForDraft(contentDraftId) { return [...assemblies.values()].find((entry) => entry.contentDraftId === contentDraftId) ?? null; },
  };
}