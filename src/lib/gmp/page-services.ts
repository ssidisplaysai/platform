import { createHash } from "node:crypto";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import { type GmpKnowledgeRecord } from "./knowledge-models";
import { createPrismaGmpKnowledgeRepository, type GmpKnowledgeRepository } from "./knowledge-repository";
import {
  GMP_PAGE_PLANNING_MODEL_VERSION,
  GMP_PAGE_READINESS_MODEL_VERSION,
  type GmpContentPlan,
  type GmpPage,
  type GmpPageBrief,
  type GmpPageReadinessAssessment,
  type GmpPageSection,
} from "./page-models";
import { createPrismaGmpPageRepository, type GmpPageRepository } from "./page-repository";

type PageSectionTemplate = {
  sectionType: GmpPageSection["sectionType"];
  key: string;
  heading: string;
  minWords: number;
  maxWords: number;
  optional?: boolean;
};

const PAGE_TEMPLATES: Record<string, PageSectionTemplate[]> = {
  home: [
    { sectionType: "hero", key: "hero", heading: "Headline", minWords: 30, maxWords: 90 },
    { sectionType: "overview", key: "overview", heading: "Overview", minWords: 120, maxWords: 220 },
    { sectionType: "benefits", key: "benefits", heading: "Key Benefits", minWords: 180, maxWords: 300 },
    { sectionType: "proof", key: "proof", heading: "Proof and Trust Signals", minWords: 120, maxWords: 200 },
    { sectionType: "cta", key: "cta", heading: "Next Step", minWords: 40, maxWords: 90 },
  ],
  product: [
    { sectionType: "hero", key: "hero", heading: "Product Outcome", minWords: 40, maxWords: 100 },
    { sectionType: "features", key: "features", heading: "Features", minWords: 200, maxWords: 350 },
    { sectionType: "specifications", key: "specifications", heading: "Technical Details", minWords: 200, maxWords: 400 },
    { sectionType: "use_cases", key: "use_cases", heading: "Applications", minWords: 150, maxWords: 260 },
    { sectionType: "faq", key: "faq", heading: "FAQ", minWords: 120, maxWords: 220, optional: true },
    { sectionType: "cta", key: "cta", heading: "Request Pricing", minWords: 40, maxWords: 100 },
  ],
};

const DEFAULT_TEMPLATE = PAGE_TEMPLATES.home;

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function approved(records: GmpKnowledgeRecord[]): GmpKnowledgeRecord[] {
  return records.filter((record) => record.reviewState === "APPROVED" && record.status === "APPROVED" && !record.archivedAt);
}

function templateForPage(page: GmpPage): PageSectionTemplate[] {
  return PAGE_TEMPLATES[page.pageType] ?? DEFAULT_TEMPLATE;
}

function toSections(page: GmpPage, planId: string, template: PageSectionTemplate[], brief: GmpPageBrief): Omit<GmpPageSection, "sectionId" | "createdAt" | "updatedAt">[] {
  return template.map((entry, index) => ({
    projectId: page.projectId,
    pageId: page.pageId,
    contentPlanId: planId,
    sectionType: entry.sectionType,
    sectionKey: entry.key,
    position: index + 1,
    headingLevel: index === 0 ? 1 : 2,
    workingHeading: entry.heading,
    purpose: brief.purpose,
    audienceNeed: brief.userNeed,
    requiredKnowledgeRecords: brief.knowledgeRecordReferences,
    requiredClaims: brief.requiredClaims,
    requiredEvidence: brief.requiredProofPoints,
    requiredProducts: brief.requiredProductsOrServices,
    requiredServices: brief.requiredProductsOrServices,
    requiredSpecifications: brief.requiredTechnicalSpecifications,
    requiredFaqs: brief.requiredFaqs,
    targetWordRange: { min: entry.minWords, max: entry.maxWords },
    ctaType: entry.sectionType === "cta" ? brief.primaryCta : undefined,
    mediaRequirement: { type: entry.sectionType === "hero" ? "image_or_video" : "optional" },
    internalLinkRequirement: { expected: entry.sectionType !== "hero" },
    structuredDataContribution: { sectionType: entry.sectionType },
    optional: Boolean(entry.optional),
    status: "PLANNED",
    metadata: {},
  }));
}

export type GmpPageServices = {
  generatePlanForPage: (input: { pageId: string; actorId: string; briefId?: string }) => Promise<{
    page: GmpPage;
    brief: GmpPageBrief;
    contentPlan: GmpContentPlan;
    sections: GmpPageSection[];
  } | null>;
  runReadinessAssessment: (pageId: string, actorId: string) => Promise<GmpPageReadinessAssessment | null>;
};

function createGopExecution(projectId: string, operationType: string, actorId: string, pageId: string) {
  const runtime = getGenesisOrchestrationRuntime();
  const execution = runtime.createExecution({
    executionType: "gmp_page_operation",
    workspaceId: "glw-led-display-warehouse",
    moduleId: "gmp.pages",
    jobType: "PAGE_GENERATION",
    executionClass: "AUTOMATED",
    priority: "NORMAL",
    input: { projectId, operationType, pageId },
    correlationId: `${projectId}:${operationType}:${Date.now()}`,
  });

  runtime.syncGlwExecutionState({
    jobId: execution.jobId ?? `gmp_page_${execution.executionId}`,
    status: "RUNNING",
    correlationId: execution.correlationId,
    result: { actorId, pageId, operationType },
  });

  return execution.executionId;
}

export function createGmpPageServices(dependencies?: {
  pageRepository?: GmpPageRepository;
  knowledgeRepository?: GmpKnowledgeRepository;
}): GmpPageServices {
  const pageRepository = dependencies?.pageRepository ?? createPrismaGmpPageRepository();
  const knowledgeRepository = dependencies?.knowledgeRepository ?? createPrismaGmpKnowledgeRepository();

  return {
    async generatePlanForPage({ pageId, actorId, briefId }) {
      const page = await pageRepository.getPageById(pageId);
      if (!page || page.archivedAt) return null;

      const selectedBrief = briefId
        ? await pageRepository.getBriefById(briefId)
        : (await pageRepository.listBriefsForPage(pageId))[0];
      if (!selectedBrief || selectedBrief.pageId !== page.pageId) {
        return null;
      }

      const records = await knowledgeRepository.listRecords(page.projectId, { includeArchived: false });
      const approvedRecords = approved(records);
      const template = templateForPage(page);

      const plan = await pageRepository.createContentPlan({
        projectId: page.projectId,
        pageId: page.pageId,
        pageBriefId: selectedBrief.briefId,
        status: "DRAFT",
        planningModelVersion: GMP_PAGE_PLANNING_MODEL_VERSION,
        targetWordRange: {
          min: template.reduce((total, section) => total + section.minWords, 0),
          max: template.reduce((total, section) => total + section.maxWords, 0),
        },
        readingLevel: "professional",
        requiredSectionCount: template.filter((entry) => !entry.optional).length,
        optionalSectionCount: template.filter((entry) => entry.optional).length,
        sectionOrder: template.map((entry) => entry.key),
        internalLinkRequirements: [{ strategy: "hub_and_spoke", minimum: Math.max(1, Math.floor(template.length / 3)) }],
        externalEvidenceRequirements: selectedBrief.evidenceRequirements,
        structuredDataRequirements: ["WebPage", "BreadcrumbList"],
        mediaRequirements: ["hero_media"],
        ctaRequirements: [selectedBrief.primaryCta ?? "contact_sales"],
        seoRequirements: ["title_tag", "meta_description", "h1_alignment", "internal_links"],
        accessibilityRequirements: ["semantic_headings", "alt_text", "link_context"],
        approvalRequirements: ["brief_approved", "knowledge_approved"],
        readinessScore: 0,
        metadata: {
          generator: "deterministic_planner",
          contextHash: stableHash({
            briefId: selectedBrief.briefId,
            briefVersion: selectedBrief.briefVersion,
            approvedRecordIds: approvedRecords.map((record) => record.knowledgeRecordId).sort(),
            pageType: page.pageType,
          }),
        },
        archivedAt: null,
      });

      const plannedSections = await pageRepository.replaceSectionsForPlan(
        plan.contentPlanId,
        page.pageId,
        page.projectId,
        toSections(page, plan.contentPlanId, template, selectedBrief),
      );

      const knowledgeRecordIds = new Set(selectedBrief.knowledgeRecordReferences);
      for (const section of plannedSections) {
        for (const key of section.requiredKnowledgeRecords) {
          knowledgeRecordIds.add(key);
        }
      }

      const references = approvedRecords
        .filter((record) => knowledgeRecordIds.has(record.knowledgeRecordId) || knowledgeRecordIds.has(record.canonicalKey))
        .map((record) => ({
          pageBriefId: selectedBrief.briefId,
          knowledgeWorkspaceId: record.knowledgeWorkspaceId,
          knowledgeRecordId: record.knowledgeRecordId,
          knowledgeRecordVersion: record.version,
          required: true,
          role: "content_requirement",
          metadata: { canonicalKey: record.canonicalKey },
        }));

      await pageRepository.replaceKnowledgeReferencesForPlan(page.pageId, plan.contentPlanId, page.projectId, references);
      await pageRepository.replaceSourceReferencesForPlan(
        page.pageId,
        plan.contentPlanId,
        page.projectId,
        selectedBrief.sourceReferences.map((sourceId) => ({
          pageBriefId: selectedBrief.briefId,
          sourceId,
          required: true,
          role: "evidence_requirement",
          metadata: {},
        })),
      );

      const links = (await pageRepository.listRelationshipsForPage(page.pageId))
        .filter((relationship) => relationship.sourcePageId === page.pageId)
        .map((relationship) => ({
          projectId: page.projectId,
          sourcePageId: relationship.sourcePageId,
          targetPageId: relationship.targetPageId,
          sourcePageRefId: page.pageId,
          targetPageRefId: relationship.targetPageId,
          linkPurpose: relationship.relationshipType,
          anchorTextGuidance: "Contextual anchor based on target page topic",
          requirementLevel: "REQUIRED",
          sectionPlacement: "overview",
          priority: relationship.priority,
          status: "PLANNED",
          reason: relationship.reason,
          knowledgeRelationship: relationship.relationshipType,
          seoRelationship: "topic_cluster",
          metadata: {},
        }));

      await pageRepository.replaceInternalLinksForPage(page.pageId, links);
      await pageRepository.updatePage(page.pageId, { currentContentPlanId: plan.contentPlanId });

      createGopExecution(page.projectId, "generate_page_plan", actorId, page.pageId);

      return {
        page,
        brief: selectedBrief,
        contentPlan: plan,
        sections: plannedSections,
      };
    },

    async runReadinessAssessment(pageId, actorId) {
      const page = await pageRepository.getPageById(pageId);
      if (!page || page.archivedAt) return null;

      const plan = page.currentContentPlanId ? await pageRepository.getContentPlanById(page.currentContentPlanId) : null;
      const brief = page.currentBriefId ? await pageRepository.getBriefById(page.currentBriefId) : null;

      const sections = plan ? await pageRepository.listSectionsForPlan(plan.contentPlanId) : [];
      const knowledgeReferences = await pageRepository.listKnowledgeReferencesForPage(pageId);
      const internalLinks = await pageRepository.listInternalLinksForPage(pageId);

      const planningReadiness = plan ? 100 : 0;
      const knowledgeReadiness = knowledgeReferences.length > 0 ? 100 : 0;
      const seoReadiness = plan?.seoRequirements.length ? 80 : 20;
      const evidenceReadiness = brief?.evidenceRequirements.length ? 80 : 40;
      const linkingReadiness = internalLinks.length > 0 ? 90 : 40;

      const blockingIssues: string[] = [];
      if (!brief || brief.status !== "APPROVED") blockingIssues.push("approved_brief_required");
      if (!plan || plan.status !== "APPROVED") blockingIssues.push("approved_plan_required");
      if (sections.length === 0) blockingIssues.push("sections_missing");
      if (knowledgeReferences.length === 0) blockingIssues.push("knowledge_references_missing");

      const warnings: string[] = [];
      if (internalLinks.length === 0) warnings.push("internal_links_missing");
      if (!plan?.seoRequirements.includes("meta_description")) warnings.push("meta_description_requirement_missing");

      const recommendations: string[] = [];
      if (blockingIssues.includes("approved_brief_required")) recommendations.push("Submit and approve the latest page brief.");
      if (blockingIssues.includes("approved_plan_required")) recommendations.push("Submit and approve the current content plan.");
      if (warnings.includes("internal_links_missing")) recommendations.push("Define at least one internal link relationship for the page.");

      const overallScore = Math.round((planningReadiness + knowledgeReadiness + seoReadiness + evidenceReadiness + linkingReadiness) / 5);
      const assessment = await pageRepository.createReadinessAssessment({
        projectId: page.projectId,
        pageId,
        scoringModelVersion: GMP_PAGE_READINESS_MODEL_VERSION,
        overallScore,
        planningReadiness,
        knowledgeReadiness,
        seoReadiness,
        evidenceReadiness,
        linkingReadiness,
        blockingIssues,
        warnings,
        recommendations,
        metadata: {
          actorId,
          hasBrief: Boolean(brief),
          hasPlan: Boolean(plan),
          sectionCount: sections.length,
          knowledgeReferenceCount: knowledgeReferences.length,
          internalLinkCount: internalLinks.length,
        },
      });

      createGopExecution(page.projectId, "run_page_readiness", actorId, page.pageId);
      return assessment;
    },
  };
}
