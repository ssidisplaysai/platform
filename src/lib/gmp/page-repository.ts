/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  GmpContentPlan,
  GmpInternalLinkPlan,
  GmpPage,
  GmpPageBrief,
  GmpPageKnowledgeReference,
  GmpPageReadinessAssessment,
  GmpPageRelationship,
  GmpPageSection,
  GmpPageSourceReference,
} from "./page-models";

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function asJson(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function mapPage(row: any): GmpPage {
  return {
    pageId: row.pageId,
    projectId: row.projectId,
    siteId: row.siteId,
    parentPageId: row.parentPageId ?? undefined,
    pageType: row.pageType,
    pageTemplateType: row.pageTemplateType,
    name: row.name,
    slug: row.slug,
    canonicalUrl: row.canonicalUrl,
    proposedUrl: row.proposedUrl ?? undefined,
    title: row.title,
    workingTitle: row.workingTitle ?? undefined,
    summary: row.summary ?? undefined,
    purpose: row.purpose ?? undefined,
    primaryObjective: row.primaryObjective ?? undefined,
    secondaryObjectives: asStringArray(row.secondaryObjectives),
    lifecycleState: row.lifecycleState,
    contentState: row.contentState,
    seoState: row.seoState,
    publishingState: row.publishingState,
    priority: row.priority,
    locale: row.locale,
    language: row.language,
    audienceReferences: asStringArray(row.audienceReferences),
    productReferences: asStringArray(row.productReferences),
    serviceReferences: asStringArray(row.serviceReferences),
    industryReferences: asStringArray(row.industryReferences),
    applicationReferences: asStringArray(row.applicationReferences),
    knowledgeWorkspaceVersion: row.knowledgeWorkspaceVersion,
    brandProfileVersion: row.brandProfileVersion,
    currentBriefId: row.currentBriefId ?? undefined,
    currentContentPlanId: row.currentContentPlanId ?? undefined,
    currentApprovedRevisionId: row.currentApprovedRevisionId ?? undefined,
    publishingConnectionId: row.publishingConnectionId ?? undefined,
    intent: asJson(row.intent) ?? {},
    createdBy: row.createdBy,
    metadata: asJson(row.metadata),
    version: row.version,
    archivedAt: iso(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapBrief(row: any): GmpPageBrief {
  return {
    briefId: row.briefId,
    projectId: row.projectId,
    pageId: row.pageId,
    briefVersion: row.briefVersion,
    status: row.status,
    purpose: row.purpose ?? undefined,
    audience: row.audience ?? undefined,
    userNeed: row.userNeed ?? undefined,
    businessGoal: row.businessGoal ?? undefined,
    primaryTopic: row.primaryTopic ?? undefined,
    secondaryTopics: asStringArray(row.secondaryTopics),
    primaryKeyword: row.primaryKeyword ?? undefined,
    secondaryKeywords: asStringArray(row.secondaryKeywords),
    searchIntent: row.searchIntent ?? undefined,
    funnelStage: row.funnelStage ?? undefined,
    valueProposition: row.valueProposition ?? undefined,
    requiredClaims: asStringArray(row.requiredClaims),
    requiredProofPoints: asStringArray(row.requiredProofPoints),
    requiredProductsOrServices: asStringArray(row.requiredProductsOrServices),
    requiredApplications: asStringArray(row.requiredApplications),
    requiredIndustries: asStringArray(row.requiredIndustries),
    requiredTechnicalSpecifications: asStringArray(row.requiredTechnicalSpecifications),
    requiredFaqs: asStringArray(row.requiredFaqs),
    restrictedMessaging: asStringArray(row.restrictedMessaging),
    conversionGoal: row.conversionGoal ?? undefined,
    primaryCta: row.primaryCta ?? undefined,
    secondaryCta: row.secondaryCta ?? undefined,
    competitorContext: asJson(row.competitorContext) ?? {},
    toneGuidance: row.toneGuidance ?? undefined,
    evidenceRequirements: asStringArray(row.evidenceRequirements),
    knowledgeRecordReferences: asStringArray(row.knowledgeRecordReferences),
    sourceReferences: asStringArray(row.sourceReferences),
    approvedAt: iso(row.approvedAt),
    approvedBy: row.approvedBy ?? undefined,
    metadata: asJson(row.metadata),
    archivedAt: iso(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapPlan(row: any): GmpContentPlan {
  const range = asJson(row.targetWordRange) ?? { min: 900, max: 1300 };
  return {
    contentPlanId: row.contentPlanId,
    projectId: row.projectId,
    pageId: row.pageId,
    pageBriefId: row.pageBriefId,
    planVersion: row.planVersion,
    status: row.status,
    planningModelVersion: row.planningModelVersion,
    targetWordRange: {
      min: Number(range.min ?? 900),
      max: Number(range.max ?? 1300),
    },
    readingLevel: row.readingLevel ?? undefined,
    requiredSectionCount: row.requiredSectionCount,
    optionalSectionCount: row.optionalSectionCount,
    sectionOrder: asStringArray(row.sectionOrder),
    internalLinkRequirements: (Array.isArray(row.internalLinkRequirements) ? row.internalLinkRequirements : []) as Array<Record<string, unknown>>,
    externalEvidenceRequirements: asStringArray(row.externalEvidenceRequirements),
    structuredDataRequirements: asStringArray(row.structuredDataRequirements),
    mediaRequirements: asStringArray(row.mediaRequirements),
    ctaRequirements: asStringArray(row.ctaRequirements),
    seoRequirements: asStringArray(row.seoRequirements),
    accessibilityRequirements: asStringArray(row.accessibilityRequirements),
    approvalRequirements: asStringArray(row.approvalRequirements),
    readinessScore: row.readinessScore,
    approvedAt: iso(row.approvedAt),
    approvedBy: row.approvedBy ?? undefined,
    metadata: asJson(row.metadata),
    archivedAt: iso(row.archivedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSection(row: any): GmpPageSection {
  const range = asJson(row.targetWordRange) ?? { min: 100, max: 180 };
  return {
    sectionId: row.sectionId,
    projectId: row.projectId,
    pageId: row.pageId,
    contentPlanId: row.contentPlanId,
    parentSectionId: row.parentSectionId ?? undefined,
    sectionType: row.sectionType,
    sectionKey: row.sectionKey,
    position: row.position,
    headingLevel: row.headingLevel,
    workingHeading: row.workingHeading ?? undefined,
    purpose: row.purpose ?? undefined,
    audienceNeed: row.audienceNeed ?? undefined,
    requiredKnowledgeRecords: asStringArray(row.requiredKnowledgeRecords),
    requiredClaims: asStringArray(row.requiredClaims),
    requiredEvidence: asStringArray(row.requiredEvidence),
    requiredProducts: asStringArray(row.requiredProducts),
    requiredServices: asStringArray(row.requiredServices),
    requiredSpecifications: asStringArray(row.requiredSpecifications),
    requiredFaqs: asStringArray(row.requiredFaqs),
    targetWordRange: { min: Number(range.min ?? 100), max: Number(range.max ?? 180) },
    ctaType: row.ctaType ?? undefined,
    mediaRequirement: asJson(row.mediaRequirement) ?? {},
    internalLinkRequirement: asJson(row.internalLinkRequirement) ?? {},
    structuredDataContribution: asJson(row.structuredDataContribution) ?? {},
    optional: Boolean(row.optional),
    status: row.status,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRelationship(row: any): GmpPageRelationship {
  return {
    relationshipId: row.relationshipId,
    projectId: row.projectId,
    sourcePageId: row.sourcePageId,
    targetPageId: row.targetPageId,
    relationshipType: row.relationshipType,
    priority: row.priority,
    reason: row.reason ?? undefined,
    status: row.status,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapInternalLink(row: any): GmpInternalLinkPlan {
  return {
    internalLinkPlanId: row.internalLinkPlanId,
    projectId: row.projectId,
    sourcePageId: row.sourcePageId,
    targetPageId: row.targetPageId,
    sourcePageRefId: row.sourcePageRefId,
    targetPageRefId: row.targetPageRefId,
    linkPurpose: row.linkPurpose,
    anchorTextGuidance: row.anchorTextGuidance ?? undefined,
    requirementLevel: row.requirementLevel,
    sectionPlacement: row.sectionPlacement ?? undefined,
    priority: row.priority,
    status: row.status,
    reason: row.reason ?? undefined,
    knowledgeRelationship: row.knowledgeRelationship ?? undefined,
    seoRelationship: row.seoRelationship ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapReadiness(row: any): GmpPageReadinessAssessment {
  return {
    pageReadinessAssessmentId: row.pageReadinessAssessmentId,
    projectId: row.projectId,
    pageId: row.pageId,
    scoringModelVersion: row.scoringModelVersion,
    overallScore: row.overallScore,
    planningReadiness: row.planningReadiness,
    knowledgeReadiness: row.knowledgeReadiness,
    seoReadiness: row.seoReadiness,
    evidenceReadiness: row.evidenceReadiness,
    linkingReadiness: row.linkingReadiness,
    blockingIssues: asStringArray(row.blockingIssues),
    warnings: asStringArray(row.warnings),
    recommendations: asStringArray(row.recommendations),
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapKnowledgeReference(row: any): GmpPageKnowledgeReference {
  return {
    pageKnowledgeReferenceId: row.pageKnowledgeReferenceId,
    projectId: row.projectId,
    pageId: row.pageId,
    pageBriefId: row.pageBriefId ?? undefined,
    contentPlanId: row.contentPlanId ?? undefined,
    knowledgeWorkspaceId: row.knowledgeWorkspaceId,
    knowledgeRecordId: row.knowledgeRecordId,
    knowledgeRecordVersion: row.knowledgeRecordVersion,
    required: row.required,
    role: row.role ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSourceReference(row: any): GmpPageSourceReference {
  return {
    pageSourceReferenceId: row.pageSourceReferenceId,
    projectId: row.projectId,
    pageId: row.pageId,
    pageBriefId: row.pageBriefId ?? undefined,
    contentPlanId: row.contentPlanId ?? undefined,
    sourceId: row.sourceId,
    required: row.required,
    role: row.role ?? undefined,
    metadata: asJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

export type GmpPageRepository = {
  createPage: (page: GmpPage) => Promise<GmpPage>;
  updatePage: (pageId: string, changes: Partial<GmpPage>) => Promise<GmpPage | null>;
  getPageById: (pageId: string) => Promise<GmpPage | null>;
  listPagesForProject: (projectId: string, includeArchived?: boolean) => Promise<GmpPage[]>;

  createBrief: (brief: Omit<GmpPageBrief, "briefId" | "briefVersion" | "createdAt" | "updatedAt">) => Promise<GmpPageBrief>;
  updateBrief: (briefId: string, changes: Partial<GmpPageBrief>) => Promise<GmpPageBrief | null>;
  getBriefById: (briefId: string) => Promise<GmpPageBrief | null>;
  listBriefsForPage: (pageId: string) => Promise<GmpPageBrief[]>;
  listBriefVersions: (briefId: string) => Promise<Array<{ versionNumber: number; previousValue?: Record<string, unknown>; newValue: Record<string, unknown>; changeReason?: string; changedBy: string; changedAt: string }>>;
  createBriefVersion: (version: { briefId: string; versionNumber: number; previousValue?: Record<string, unknown>; newValue: Record<string, unknown>; changeReason?: string; changedBy: string }) => Promise<void>;

  createContentPlan: (plan: Omit<GmpContentPlan, "contentPlanId" | "planVersion" | "createdAt" | "updatedAt">) => Promise<GmpContentPlan>;
  updateContentPlan: (contentPlanId: string, changes: Partial<GmpContentPlan>) => Promise<GmpContentPlan | null>;
  getContentPlanById: (contentPlanId: string) => Promise<GmpContentPlan | null>;
  listContentPlansForPage: (pageId: string) => Promise<GmpContentPlan[]>;
  listContentPlanVersions: (contentPlanId: string) => Promise<Array<{ versionNumber: number; previousValue?: Record<string, unknown>; newValue: Record<string, unknown>; changeReason?: string; changedBy: string; changedAt: string }>>;
  createContentPlanVersion: (version: { contentPlanId: string; versionNumber: number; previousValue?: Record<string, unknown>; newValue: Record<string, unknown>; changeReason?: string; changedBy: string }) => Promise<void>;

  replaceSectionsForPlan: (contentPlanId: string, pageId: string, projectId: string, sections: Omit<GmpPageSection, "sectionId" | "createdAt" | "updatedAt">[]) => Promise<GmpPageSection[]>;
  listSectionsForPlan: (contentPlanId: string) => Promise<GmpPageSection[]>;
  updateSection: (sectionId: string, changes: Partial<GmpPageSection>) => Promise<GmpPageSection | null>;
  deleteSection: (sectionId: string) => Promise<boolean>;
  reorderSections: (contentPlanId: string, orderedSectionIds: string[]) => Promise<GmpPageSection[]>;

  upsertRelationship: (relationship: Omit<GmpPageRelationship, "relationshipId" | "createdAt">) => Promise<GmpPageRelationship>;
  listRelationshipsForPage: (pageId: string) => Promise<GmpPageRelationship[]>;
  deleteRelationship: (relationshipId: string) => Promise<boolean>;

  replaceInternalLinksForPage: (pageId: string, links: Omit<GmpInternalLinkPlan, "internalLinkPlanId" | "createdAt" | "updatedAt">[]) => Promise<GmpInternalLinkPlan[]>;
  listInternalLinksForPage: (pageId: string) => Promise<GmpInternalLinkPlan[]>;
  updateInternalLink: (linkId: string, changes: Partial<GmpInternalLinkPlan>) => Promise<GmpInternalLinkPlan | null>;
  deleteInternalLink: (linkId: string) => Promise<boolean>;

  createReadinessAssessment: (assessment: Omit<GmpPageReadinessAssessment, "pageReadinessAssessmentId" | "createdAt">) => Promise<GmpPageReadinessAssessment>;
  getLatestReadinessAssessment: (pageId: string) => Promise<GmpPageReadinessAssessment | null>;

  replaceKnowledgeReferencesForPlan: (pageId: string, contentPlanId: string, projectId: string, references: Omit<GmpPageKnowledgeReference, "pageKnowledgeReferenceId" | "createdAt" | "projectId" | "pageId" | "contentPlanId">[]) => Promise<GmpPageKnowledgeReference[]>;
  listKnowledgeReferencesForPage: (pageId: string) => Promise<GmpPageKnowledgeReference[]>;

  replaceSourceReferencesForPlan: (pageId: string, contentPlanId: string, projectId: string, references: Omit<GmpPageSourceReference, "pageSourceReferenceId" | "createdAt" | "projectId" | "pageId" | "contentPlanId">[]) => Promise<GmpPageSourceReference[]>;
  listSourceReferencesForPage: (pageId: string) => Promise<GmpPageSourceReference[]>;
};

export function createPrismaGmpPageRepository(prisma: PrismaClient = getPrismaClient()): GmpPageRepository {
  const db = prisma as unknown as Record<string, any>;

  return {
    async createPage(page) {
      const created = await db.gmpPage.create({ data: { ...page, archivedAt: page.archivedAt ? new Date(page.archivedAt) : null } });
      return mapPage(created);
    },

    async updatePage(pageId, changes) {
      const existing = await db.gmpPage.findUnique({ where: { pageId } });
      if (!existing) return null;
      const updated = await db.gmpPage.update({
        where: { pageId },
        data: {
          parentPageId: changes.parentPageId,
          name: changes.name,
          slug: changes.slug,
          canonicalUrl: changes.canonicalUrl,
          proposedUrl: changes.proposedUrl,
          title: changes.title,
          workingTitle: changes.workingTitle,
          summary: changes.summary,
          purpose: changes.purpose,
          primaryObjective: changes.primaryObjective,
          secondaryObjectives: changes.secondaryObjectives,
          lifecycleState: changes.lifecycleState,
          contentState: changes.contentState,
          seoState: changes.seoState,
          publishingState: changes.publishingState,
          priority: changes.priority,
          audienceReferences: changes.audienceReferences,
          productReferences: changes.productReferences,
          serviceReferences: changes.serviceReferences,
          industryReferences: changes.industryReferences,
          applicationReferences: changes.applicationReferences,
          knowledgeWorkspaceVersion: changes.knowledgeWorkspaceVersion,
          brandProfileVersion: changes.brandProfileVersion,
          currentBriefId: changes.currentBriefId,
          currentContentPlanId: changes.currentContentPlanId,
          currentApprovedRevisionId: changes.currentApprovedRevisionId,
          publishingConnectionId: changes.publishingConnectionId,
          intent: changes.intent,
          metadata: changes.metadata,
          archivedAt: changes.archivedAt === undefined ? undefined : changes.archivedAt ? new Date(changes.archivedAt) : null,
          version: existing.version + 1,
        },
      });
      return mapPage(updated);
    },

    async getPageById(pageId) {
      const row = await db.gmpPage.findUnique({ where: { pageId } });
      return row ? mapPage(row) : null;
    },

    async listPagesForProject(projectId, includeArchived = false) {
      const rows = await db.gmpPage.findMany({
        where: { projectId, archivedAt: includeArchived ? undefined : null },
        orderBy: [{ updatedAt: "desc" }],
      });
      return rows.map(mapPage);
    },

    async createBrief(brief) {
      const created = await db.gmpPageBrief.create({
        data: {
          briefId: `gmpbr_${randomUUID()}`,
          ...brief,
          briefVersion: 1,
          approvedAt: brief.approvedAt ? new Date(brief.approvedAt) : null,
          archivedAt: brief.archivedAt ? new Date(brief.archivedAt) : null,
        },
      });
      return mapBrief(created);
    },

    async updateBrief(briefId, changes) {
      const existing = await db.gmpPageBrief.findUnique({ where: { briefId } });
      if (!existing) return null;
      const updated = await db.gmpPageBrief.update({
        where: { briefId },
        data: {
          ...changes,
          approvedAt: changes.approvedAt === undefined ? undefined : changes.approvedAt ? new Date(changes.approvedAt) : null,
          archivedAt: changes.archivedAt === undefined ? undefined : changes.archivedAt ? new Date(changes.archivedAt) : null,
          briefVersion: existing.briefVersion + 1,
        },
      });
      return mapBrief(updated);
    },

    async getBriefById(briefId) {
      const row = await db.gmpPageBrief.findUnique({ where: { briefId } });
      return row ? mapBrief(row) : null;
    },

    async listBriefsForPage(pageId) {
      const rows = await db.gmpPageBrief.findMany({ where: { pageId }, orderBy: [{ updatedAt: "desc" }] });
      return rows.map(mapBrief);
    },

    async listBriefVersions(briefId) {
      const rows = await db.gmpPageBriefVersion.findMany({ where: { briefId }, orderBy: [{ versionNumber: "desc" }] });
      return rows.map((row: any) => ({
        versionNumber: row.versionNumber,
        previousValue: asJson(row.previousValue),
        newValue: asJson(row.newValue) ?? {},
        changeReason: row.changeReason ?? undefined,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
      }));
    },

    async createBriefVersion(version) {
      await db.gmpPageBriefVersion.create({
        data: {
          briefVersionId: `gmpbrv_${randomUUID()}`,
          projectId: (await db.gmpPageBrief.findUnique({ where: { briefId: version.briefId } }))?.projectId ?? "",
          pageId: (await db.gmpPageBrief.findUnique({ where: { briefId: version.briefId } }))?.pageId ?? "",
          briefId: version.briefId,
          versionNumber: version.versionNumber,
          previousValue: version.previousValue ?? undefined,
          newValue: version.newValue,
          changeReason: version.changeReason,
          changedBy: version.changedBy,
          changedAt: new Date(),
          metadata: {},
        },
      });
    },

    async createContentPlan(plan) {
      const created = await db.gmpContentPlan.create({
        data: {
          contentPlanId: `gmpcp_${randomUUID()}`,
          ...plan,
          planVersion: 1,
          approvedAt: plan.approvedAt ? new Date(plan.approvedAt) : null,
          archivedAt: plan.archivedAt ? new Date(plan.archivedAt) : null,
        },
      });
      return mapPlan(created);
    },

    async updateContentPlan(contentPlanId, changes) {
      const existing = await db.gmpContentPlan.findUnique({ where: { contentPlanId } });
      if (!existing) return null;
      const updated = await db.gmpContentPlan.update({
        where: { contentPlanId },
        data: {
          ...changes,
          approvedAt: changes.approvedAt === undefined ? undefined : changes.approvedAt ? new Date(changes.approvedAt) : null,
          archivedAt: changes.archivedAt === undefined ? undefined : changes.archivedAt ? new Date(changes.archivedAt) : null,
          planVersion: existing.planVersion + 1,
        },
      });
      return mapPlan(updated);
    },

    async getContentPlanById(contentPlanId) {
      const row = await db.gmpContentPlan.findUnique({ where: { contentPlanId } });
      return row ? mapPlan(row) : null;
    },

    async listContentPlansForPage(pageId) {
      const rows = await db.gmpContentPlan.findMany({ where: { pageId }, orderBy: [{ updatedAt: "desc" }] });
      return rows.map(mapPlan);
    },

    async listContentPlanVersions(contentPlanId) {
      const rows = await db.gmpContentPlanVersion.findMany({ where: { contentPlanId }, orderBy: [{ versionNumber: "desc" }] });
      return rows.map((row: any) => ({
        versionNumber: row.versionNumber,
        previousValue: asJson(row.previousValue),
        newValue: asJson(row.newValue) ?? {},
        changeReason: row.changeReason ?? undefined,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
      }));
    },

    async createContentPlanVersion(version) {
      await db.gmpContentPlanVersion.create({
        data: {
          contentPlanVersionId: `gmpcpv_${randomUUID()}`,
          projectId: (await db.gmpContentPlan.findUnique({ where: { contentPlanId: version.contentPlanId } }))?.projectId ?? "",
          pageId: (await db.gmpContentPlan.findUnique({ where: { contentPlanId: version.contentPlanId } }))?.pageId ?? "",
          contentPlanId: version.contentPlanId,
          versionNumber: version.versionNumber,
          previousValue: version.previousValue ?? undefined,
          newValue: version.newValue,
          changeReason: version.changeReason,
          changedBy: version.changedBy,
          changedAt: new Date(),
          metadata: {},
        },
      });
    },

    async replaceSectionsForPlan(contentPlanId, pageId, projectId, sections) {
      await db.gmpPageSection.deleteMany({ where: { contentPlanId } });
      const created: GmpPageSection[] = [];
      for (const section of sections) {
        const row = await db.gmpPageSection.create({ data: { sectionId: `gmpps_${randomUUID()}`, projectId, pageId, contentPlanId, ...section } });
        created.push(mapSection(row));
      }
      return created.sort((a, b) => a.position - b.position);
    },

    async listSectionsForPlan(contentPlanId) {
      const rows = await db.gmpPageSection.findMany({ where: { contentPlanId }, orderBy: [{ position: "asc" }] });
      return rows.map(mapSection);
    },

    async updateSection(sectionId, changes) {
      const existing = await db.gmpPageSection.findUnique({ where: { sectionId } });
      if (!existing) return null;
      const updated = await db.gmpPageSection.update({
        where: { sectionId },
        data: {
          ...changes,
          optional: changes.optional,
          metadata: changes.metadata,
        },
      });
      return mapSection(updated);
    },

    async deleteSection(sectionId) {
      await db.gmpPageSection.delete({ where: { sectionId } });
      return true;
    },

    async reorderSections(contentPlanId, orderedSectionIds) {
      const rows = await db.gmpPageSection.findMany({ where: { contentPlanId } });
      const byId = new Map(rows.map((row: any) => [row.sectionId, row]));
      const updated: GmpPageSection[] = [];
      let position = 1;
      for (const sectionId of orderedSectionIds) {
        const current = byId.get(sectionId);
        if (!current) continue;
        const row = await db.gmpPageSection.update({ where: { sectionId }, data: { position, updatedAt: new Date() } });
        updated.push(mapSection(row));
        position += 1;
      }
      return updated.sort((a, b) => a.position - b.position);
    },

    async upsertRelationship(relationship) {
      const existing = await db.gmpPageRelationship.findFirst({
        where: {
          sourcePageId: relationship.sourcePageId,
          targetPageId: relationship.targetPageId,
          relationshipType: relationship.relationshipType,
        },
      });

      if (existing) {
        const updated = await db.gmpPageRelationship.update({
          where: { relationshipId: existing.relationshipId },
          data: {
            priority: relationship.priority,
            reason: relationship.reason,
            status: relationship.status,
            metadata: relationship.metadata,
          },
        });
        return mapRelationship(updated);
      }

      const created = await db.gmpPageRelationship.create({ data: { relationshipId: `gmprel_${randomUUID()}`, ...relationship } });
      return mapRelationship(created);
    },

    async listRelationshipsForPage(pageId) {
      const rows = await db.gmpPageRelationship.findMany({
        where: { OR: [{ sourcePageId: pageId }, { targetPageId: pageId }] },
        orderBy: [{ createdAt: "desc" }],
      });
      return rows.map(mapRelationship);
    },

    async deleteRelationship(relationshipId) {
      await db.gmpPageRelationship.delete({ where: { relationshipId } });
      return true;
    },

    async replaceInternalLinksForPage(pageId, links) {
      await db.gmpInternalLinkPlan.deleteMany({ where: { sourcePageId: pageId } });
      const created: GmpInternalLinkPlan[] = [];
      for (const link of links) {
        const row = await db.gmpInternalLinkPlan.create({
          data: {
            internalLinkPlanId: `gmplink_${randomUUID()}`,
            ...link,
          },
        });
        created.push(mapInternalLink(row));
      }
      return created;
    },

    async listInternalLinksForPage(pageId) {
      const rows = await db.gmpInternalLinkPlan.findMany({ where: { sourcePageId: pageId }, orderBy: [{ priority: "desc" }] });
      return rows.map(mapInternalLink);
    },

    async updateInternalLink(linkId, changes) {
      const existing = await db.gmpInternalLinkPlan.findUnique({ where: { internalLinkPlanId: linkId } });
      if (!existing) return null;
      const updated = await db.gmpInternalLinkPlan.update({ where: { internalLinkPlanId: linkId }, data: { ...changes } });
      return mapInternalLink(updated);
    },

    async deleteInternalLink(linkId) {
      await db.gmpInternalLinkPlan.delete({ where: { internalLinkPlanId: linkId } });
      return true;
    },

    async createReadinessAssessment(assessment) {
      const created = await db.gmpPageReadinessAssessment.create({
        data: {
          pageReadinessAssessmentId: `gmprdy_${randomUUID()}`,
          ...assessment,
        },
      });
      return mapReadiness(created);
    },

    async getLatestReadinessAssessment(pageId) {
      const row = await db.gmpPageReadinessAssessment.findFirst({ where: { pageId }, orderBy: [{ createdAt: "desc" }] });
      return row ? mapReadiness(row) : null;
    },

    async replaceKnowledgeReferencesForPlan(pageId, contentPlanId, projectId, references) {
      await db.gmpPageKnowledgeReference.deleteMany({ where: { pageId, contentPlanId } });
      const created: GmpPageKnowledgeReference[] = [];
      for (const reference of references) {
        const row = await db.gmpPageKnowledgeReference.create({
          data: {
            pageKnowledgeReferenceId: `gmpkrf_${randomUUID()}`,
            projectId,
            pageId,
            contentPlanId,
            ...reference,
          },
        });
        created.push(mapKnowledgeReference(row));
      }
      return created;
    },

    async listKnowledgeReferencesForPage(pageId) {
      const rows = await db.gmpPageKnowledgeReference.findMany({ where: { pageId }, orderBy: [{ createdAt: "desc" }] });
      return rows.map(mapKnowledgeReference);
    },

    async replaceSourceReferencesForPlan(pageId, contentPlanId, projectId, references) {
      await db.gmpPageSourceReference.deleteMany({ where: { pageId, contentPlanId } });
      const created: GmpPageSourceReference[] = [];
      for (const reference of references) {
        const row = await db.gmpPageSourceReference.create({
          data: {
            pageSourceReferenceId: `gmpsrf_${randomUUID()}`,
            projectId,
            pageId,
            contentPlanId,
            ...reference,
          },
        });
        created.push(mapSourceReference(row));
      }
      return created;
    },

    async listSourceReferencesForPage(pageId) {
      const rows = await db.gmpPageSourceReference.findMany({ where: { pageId }, orderBy: [{ createdAt: "desc" }] });
      return rows.map(mapSourceReference);
    },
  };
}

export function createInMemoryGmpPageRepository(): GmpPageRepository {
  const pages = new Map<string, GmpPage>();
  const briefs = new Map<string, GmpPageBrief>();
  const briefVersions = new Map<string, Array<{ versionNumber: number; previousValue?: Record<string, unknown>; newValue: Record<string, unknown>; changeReason?: string; changedBy: string; changedAt: string }>>();
  const plans = new Map<string, GmpContentPlan>();
  const planVersions = new Map<string, Array<{ versionNumber: number; previousValue?: Record<string, unknown>; newValue: Record<string, unknown>; changeReason?: string; changedBy: string; changedAt: string }>>();
  const sections = new Map<string, GmpPageSection>();
  const relationships = new Map<string, GmpPageRelationship>();
  const links = new Map<string, GmpInternalLinkPlan>();
  const readiness = new Map<string, GmpPageReadinessAssessment[]>();
  const knowledgeRefs = new Map<string, GmpPageKnowledgeReference>();
  const sourceRefs = new Map<string, GmpPageSourceReference>();

  return {
    async createPage(page) {
      pages.set(page.pageId, { ...page });
      return { ...page };
    },

    async updatePage(pageId, changes) {
      const existing = pages.get(pageId);
      if (!existing) return null;
      const updated: GmpPage = { ...existing, ...changes, version: existing.version + 1, updatedAt: nowIso() };
      pages.set(pageId, updated);
      return { ...updated };
    },

    async getPageById(pageId) {
      const row = pages.get(pageId);
      return row ? { ...row } : null;
    },

    async listPagesForProject(projectId, includeArchived = false) {
      return [...pages.values()].filter((page) => page.projectId === projectId && (includeArchived || !page.archivedAt));
    },

    async createBrief(brief) {
      const timestamp = nowIso();
      const created: GmpPageBrief = {
        briefId: `gmpbr_${randomUUID()}`,
        briefVersion: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...brief,
      };
      briefs.set(created.briefId, created);
      briefVersions.set(created.briefId, [{ versionNumber: 1, newValue: created as unknown as Record<string, unknown>, changedBy: "system", changedAt: timestamp }]);
      return { ...created };
    },

    async updateBrief(briefId, changes) {
      const existing = briefs.get(briefId);
      if (!existing) return null;
      const updated: GmpPageBrief = { ...existing, ...changes, briefVersion: existing.briefVersion + 1, updatedAt: nowIso() };
      briefs.set(briefId, updated);
      const versions = briefVersions.get(briefId) ?? [];
      versions.unshift({ versionNumber: updated.briefVersion, previousValue: existing as unknown as Record<string, unknown>, newValue: updated as unknown as Record<string, unknown>, changedBy: "system", changedAt: updated.updatedAt });
      briefVersions.set(briefId, versions);
      return { ...updated };
    },

    async getBriefById(briefId) {
      const row = briefs.get(briefId);
      return row ? { ...row } : null;
    },

    async listBriefsForPage(pageId) {
      return [...briefs.values()].filter((brief) => brief.pageId === pageId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async listBriefVersions(briefId) {
      return [...(briefVersions.get(briefId) ?? [])];
    },

    async createBriefVersion(version) {
      const versions = briefVersions.get(version.briefId) ?? [];
      versions.unshift({
        versionNumber: version.versionNumber,
        previousValue: version.previousValue,
        newValue: version.newValue,
        changeReason: version.changeReason,
        changedBy: version.changedBy,
        changedAt: nowIso(),
      });
      briefVersions.set(version.briefId, versions);
    },

    async createContentPlan(plan) {
      const timestamp = nowIso();
      const created: GmpContentPlan = {
        contentPlanId: `gmpcp_${randomUUID()}`,
        planVersion: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...plan,
      };
      plans.set(created.contentPlanId, created);
      planVersions.set(created.contentPlanId, [{ versionNumber: 1, newValue: created as unknown as Record<string, unknown>, changedBy: "system", changedAt: timestamp }]);
      return { ...created };
    },

    async updateContentPlan(contentPlanId, changes) {
      const existing = plans.get(contentPlanId);
      if (!existing) return null;
      const updated: GmpContentPlan = { ...existing, ...changes, planVersion: existing.planVersion + 1, updatedAt: nowIso() };
      plans.set(contentPlanId, updated);
      const versions = planVersions.get(contentPlanId) ?? [];
      versions.unshift({ versionNumber: updated.planVersion, previousValue: existing as unknown as Record<string, unknown>, newValue: updated as unknown as Record<string, unknown>, changedBy: "system", changedAt: updated.updatedAt });
      planVersions.set(contentPlanId, versions);
      return { ...updated };
    },

    async getContentPlanById(contentPlanId) {
      const row = plans.get(contentPlanId);
      return row ? { ...row } : null;
    },

    async listContentPlansForPage(pageId) {
      return [...plans.values()].filter((plan) => plan.pageId === pageId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async listContentPlanVersions(contentPlanId) {
      return [...(planVersions.get(contentPlanId) ?? [])];
    },

    async createContentPlanVersion(version) {
      const versions = planVersions.get(version.contentPlanId) ?? [];
      versions.unshift({
        versionNumber: version.versionNumber,
        previousValue: version.previousValue,
        newValue: version.newValue,
        changeReason: version.changeReason,
        changedBy: version.changedBy,
        changedAt: nowIso(),
      });
      planVersions.set(version.contentPlanId, versions);
    },

    async replaceSectionsForPlan(contentPlanId, _pageId, _projectId, nextSections) {
      for (const key of [...sections.keys()]) {
        const section = sections.get(key);
        if (section?.contentPlanId === contentPlanId) {
          sections.delete(key);
        }
      }
      const created = nextSections.map((section) => {
        const timestamp = nowIso();
        const entry: GmpPageSection = {
          sectionId: `gmpps_${randomUUID()}`,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...section,
        };
        sections.set(entry.sectionId, entry);
        return entry;
      });
      return created.sort((a, b) => a.position - b.position);
    },

    async listSectionsForPlan(contentPlanId) {
      return [...sections.values()].filter((section) => section.contentPlanId === contentPlanId).sort((a, b) => a.position - b.position);
    },

    async updateSection(sectionId, changes) {
      const current = sections.get(sectionId);
      if (!current) return null;
      const updated: GmpPageSection = { ...current, ...changes, updatedAt: nowIso() };
      sections.set(sectionId, updated);
      return updated;
    },

    async deleteSection(sectionId) {
      return sections.delete(sectionId);
    },

    async reorderSections(contentPlanId, orderedSectionIds) {
      const updated: GmpPageSection[] = [];
      orderedSectionIds.forEach((sectionId, index) => {
        const current = sections.get(sectionId);
        if (!current || current.contentPlanId !== contentPlanId) return;
        const next = { ...current, position: index + 1, updatedAt: nowIso() };
        sections.set(sectionId, next);
        updated.push(next);
      });
      return updated;
    },

    async upsertRelationship(relationship) {
      const found = [...relationships.values()].find((entry) =>
        entry.sourcePageId === relationship.sourcePageId
        && entry.targetPageId === relationship.targetPageId
        && entry.relationshipType === relationship.relationshipType,
      );
      if (found) {
        const updated = { ...found, ...relationship };
        relationships.set(found.relationshipId, updated);
        return updated;
      }
      const created: GmpPageRelationship = {
        relationshipId: `gmprel_${randomUUID()}`,
        createdAt: nowIso(),
        ...relationship,
      };
      relationships.set(created.relationshipId, created);
      return created;
    },

    async listRelationshipsForPage(pageId) {
      return [...relationships.values()].filter((relationship) => relationship.sourcePageId === pageId || relationship.targetPageId === pageId);
    },

    async deleteRelationship(relationshipId) {
      return relationships.delete(relationshipId);
    },

    async replaceInternalLinksForPage(pageId, nextLinks) {
      for (const key of [...links.keys()]) {
        if (links.get(key)?.sourcePageId === pageId) links.delete(key);
      }
      const created = nextLinks.map((link) => {
        const timestamp = nowIso();
        const entry: GmpInternalLinkPlan = {
          internalLinkPlanId: `gmplink_${randomUUID()}`,
          createdAt: timestamp,
          updatedAt: timestamp,
          ...link,
        };
        links.set(entry.internalLinkPlanId, entry);
        return entry;
      });
      return created;
    },

    async listInternalLinksForPage(pageId) {
      return [...links.values()].filter((link) => link.sourcePageId === pageId);
    },

    async updateInternalLink(linkId, changes) {
      const current = links.get(linkId);
      if (!current) return null;
      const updated: GmpInternalLinkPlan = { ...current, ...changes, updatedAt: nowIso() };
      links.set(linkId, updated);
      return updated;
    },

    async deleteInternalLink(linkId) {
      return links.delete(linkId);
    },

    async createReadinessAssessment(assessment) {
      const created: GmpPageReadinessAssessment = {
        pageReadinessAssessmentId: `gmprdy_${randomUUID()}`,
        createdAt: nowIso(),
        ...assessment,
      };
      const existing = readiness.get(assessment.pageId) ?? [];
      readiness.set(assessment.pageId, [created, ...existing]);
      return created;
    },

    async getLatestReadinessAssessment(pageId) {
      return readiness.get(pageId)?.[0] ?? null;
    },

    async replaceKnowledgeReferencesForPlan(pageId, contentPlanId, projectId, references) {
      for (const key of [...knowledgeRefs.keys()]) {
        const entry = knowledgeRefs.get(key);
        if (entry?.pageId === pageId && entry.contentPlanId === contentPlanId) knowledgeRefs.delete(key);
      }

      const created = references.map((reference) => {
        const entry: GmpPageKnowledgeReference = {
          pageKnowledgeReferenceId: `gmpkrf_${randomUUID()}`,
          projectId,
          pageId,
          contentPlanId,
          createdAt: nowIso(),
          ...reference,
        };
        knowledgeRefs.set(entry.pageKnowledgeReferenceId, entry);
        return entry;
      });
      return created;
    },

    async listKnowledgeReferencesForPage(pageId) {
      return [...knowledgeRefs.values()].filter((entry) => entry.pageId === pageId);
    },

    async replaceSourceReferencesForPlan(pageId, contentPlanId, projectId, references) {
      for (const key of [...sourceRefs.keys()]) {
        const entry = sourceRefs.get(key);
        if (entry?.pageId === pageId && entry.contentPlanId === contentPlanId) sourceRefs.delete(key);
      }

      const created = references.map((reference) => {
        const entry: GmpPageSourceReference = {
          pageSourceReferenceId: `gmpsrf_${randomUUID()}`,
          projectId,
          pageId,
          contentPlanId,
          createdAt: nowIso(),
          ...reference,
        };
        sourceRefs.set(entry.pageSourceReferenceId, entry);
        return entry;
      });
      return created;
    },

    async listSourceReferencesForPage(pageId) {
      return [...sourceRefs.values()].filter((entry) => entry.pageId === pageId);
    },
  };
}
