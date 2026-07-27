import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import { type GmpRepository } from "./repository";
import { createPrismaGmpRepository } from "./repository";
import { type GmpKnowledgeRecord, type GmpKnowledgeRepository } from "./knowledge-repository";
import { createPrismaGmpKnowledgeRepository } from "./knowledge-repository";
import { createPrismaGmpPageRepository, type GmpPageRepository } from "./page-repository";
import {
  GMP_CONTENT_ELIGIBILITY_MODEL_VERSION,
  GMP_EDITORIAL_VALIDATION_MODEL_VERSION,
  GMP_GENERATION_INPUT_SCHEMA_VERSION,
  GMP_GENERATION_POLICY_VERSION,
  stableInputFingerprint,
  type GmpCanonicalGenerationInput,
  type GmpContentDraft,
  type GmpContentGenerationMode,
  type GmpContentValidation,
  type GmpGenerationEligibilityReport,
  type GmpGenerationOperationType,
  type GmpGenerationRequest,
  type GmpSectionContent,
  type GmpSectionContentRevision,
  type GmpSectionValidation,
} from "./content-models";
import { createPrismaGmpContentRepository, type GmpContentRepository } from "./content-repository";
import { createDeterministicGmpGenerationProvider, createGmpPromptAdapter, type GmpGenerationProvider } from "./content-provider";
import { validateGenerationInput } from "./content-contracts";

function approvedKnowledge(records: GmpKnowledgeRecord[]): GmpKnowledgeRecord[] {
  return records.filter((record) => record.status === "APPROVED" && record.reviewState === "APPROVED" && !record.archivedAt);
}

function nowIso(): string {
  return new Date().toISOString();
}

function countWords(value: string | undefined): number {
  return value?.trim() ? value.trim().split(/\s+/).length : 0;
}

function buildRestrictionTerms(brief: { restrictedMessaging: string[] }, records: GmpKnowledgeRecord[]): string[] {
  const domainRestrictions = records
    .filter((record) => record.domain === "restricted_messaging")
    .map((record) => record.title)
    .filter(Boolean);
  return [...new Set([...brief.restrictedMessaging, ...domainRestrictions])];
}

function buildClaimLookup(records: GmpKnowledgeRecord[]): Set<string> {
  const values = new Set<string>();
  for (const record of records) {
    values.add(record.knowledgeRecordId);
    values.add(record.canonicalKey);
    values.add(record.title);
  }
  return values;
}

function createExecution(projectId: string, workspaceId: string, actorId: string, input: Record<string, unknown>) {
  const runtime = getGenesisOrchestrationRuntime();
  const execution = runtime.createExecution({
    executionType: "gmp_content_operation",
    workspaceId,
    moduleId: "gmp.content",
    jobType: "PAGE_GENERATION",
    executionClass: "AUTOMATED",
    priority: "NORMAL",
    input,
    correlationId: `${projectId}:${String(input.operationType ?? "content_operation")}:${Date.now()}`,
  });

  runtime.syncGlwExecutionState({
    jobId: execution.jobId ?? `gmp_content_${execution.executionId}`,
    status: "RUNNING",
    correlationId: execution.correlationId,
    result: { actorId, ...input },
  });

  return execution.executionId;
}

export type GmpContentServices = {
  evaluateEligibility: (pageId: string) => Promise<GmpGenerationEligibilityReport | null>;
  createDraftForPage: (input: { pageId: string; actorId: string; provider?: string; modelIdentifier?: string }) => Promise<GmpContentDraft | null>;
  generateDraft: (input: { draftId: string; actorId: string; generationMode?: GmpContentGenerationMode; requestedSections?: string[]; operationType?: GmpGenerationOperationType }) => Promise<{ draft: GmpContentDraft; request: GmpGenerationRequest; sections: GmpSectionContent[]; validation: GmpContentValidation; }>;
  getGenerationStatus: (draftId: string) => Promise<Record<string, unknown> | null>;
  reviseSection: (input: { sectionContentId: string; actorId: string; instruction: string; revisionType: GmpSectionContentRevision["revisionType"] }) => Promise<GmpSectionContent | null>;
  updateSectionDraft: (input: { sectionContentId: string; actorId: string; heading?: string; bodyContent?: string; ctaContent?: Record<string, unknown>; mediaGuidance?: Record<string, unknown>; internalLinkSuggestions?: Array<Record<string, unknown>>; reason?: string }) => Promise<GmpSectionContent | null>;
  validateDraft: (draftId: string) => Promise<GmpContentValidation | null>;
  validateSection: (sectionContentId: string) => Promise<GmpSectionValidation | null>;
  submitDraftForReview: (draftId: string, actorId: string, notes?: string) => Promise<GmpContentDraft | null>;
  reviewSection: (sectionContentId: string, actorId: string, notes?: string) => Promise<GmpSectionContent | null>;
  approveDraft: (draftId: string, actorId: string, notes?: string) => Promise<GmpContentDraft | null>;
  rejectDraft: (draftId: string, actorId: string, notes?: string) => Promise<GmpContentDraft | null>;
  requestDraftChanges: (draftId: string, actorId: string, notes?: string) => Promise<GmpContentDraft | null>;
  approveSection: (sectionContentId: string, actorId: string, notes?: string) => Promise<GmpSectionContent | null>;
  rejectSection: (sectionContentId: string, actorId: string, notes?: string) => Promise<GmpSectionContent | null>;
  requestSectionChanges: (sectionContentId: string, actorId: string, notes?: string) => Promise<GmpSectionContent | null>;
  getLineage: (draftId: string) => Promise<Record<string, unknown>[]>;
  getPreview: (draftId: string) => Promise<Record<string, unknown> | null>;
};

export function createGmpContentServices(dependencies?: {
  projectRepository?: GmpRepository;
  pageRepository?: GmpPageRepository;
  knowledgeRepository?: GmpKnowledgeRepository;
  contentRepository?: GmpContentRepository;
  provider?: GmpGenerationProvider;
}) : GmpContentServices {
  const projectRepository = dependencies?.projectRepository ?? createPrismaGmpRepository();
  const pageRepository = dependencies?.pageRepository ?? createPrismaGmpPageRepository();
  const knowledgeRepository = dependencies?.knowledgeRepository ?? createPrismaGmpKnowledgeRepository();
  const contentRepository = dependencies?.contentRepository ?? createPrismaGmpContentRepository();
  const provider = dependencies?.provider ?? createDeterministicGmpGenerationProvider();

  async function loadGenerationContext(pageId: string) {
    const page = await pageRepository.getPageById(pageId);
    if (!page || page.archivedAt || page.lifecycleState === "ARCHIVED") return null;

    const [project, site, brief, plan, sections, readiness, knowledgeWorkspace, records, brandProfile, conflicts, internalLinks] = await Promise.all([
      projectRepository.getProjectById(page.projectId),
      projectRepository.getSiteById(page.siteId),
      page.currentBriefId ? pageRepository.getBriefById(page.currentBriefId) : Promise.resolve(null),
      page.currentContentPlanId ? pageRepository.getContentPlanById(page.currentContentPlanId) : Promise.resolve(null),
      page.currentContentPlanId ? pageRepository.listSectionsForPlan(page.currentContentPlanId) : Promise.resolve([]),
      pageRepository.getLatestReadinessAssessment(page.pageId),
      knowledgeRepository.ensureWorkspace(page.projectId),
      knowledgeRepository.listRecords(page.projectId, { includeArchived: false }),
      projectRepository.getBrandProfileByProjectId(page.projectId),
      knowledgeRepository.listConflicts(page.projectId),
      pageRepository.listInternalLinksForPage(page.pageId),
    ]);

    return {
      project,
      site,
      page,
      brief,
      plan,
      sections,
      readiness,
      knowledgeWorkspace,
      records,
      brandProfile,
      conflicts,
      internalLinks,
    };
  }

  async function buildInput(context: NonNullable<Awaited<ReturnType<typeof loadGenerationContext>>>, sectionId: string): Promise<GmpCanonicalGenerationInput | null> {
    const section = context.sections.find((entry) => entry.sectionId === sectionId);
    if (!section || !context.project || !context.site || !context.brief || !context.plan || !context.brandProfile) return null;
    const approvedRecords = approvedKnowledge(context.records);
    const claimLookup = buildClaimLookup(approvedRecords);
    const restrictions = buildRestrictionTerms(context.brief, approvedRecords);
    const input: GmpCanonicalGenerationInput = {
      schemaVersion: GMP_GENERATION_INPUT_SCHEMA_VERSION,
      generationPolicyVersion: GMP_GENERATION_POLICY_VERSION,
      project: context.project,
      site: context.site,
      page: context.page,
      brief: context.brief,
      contentPlan: context.plan,
      section,
      approvedKnowledge: approvedRecords
        .filter((record) => section.requiredKnowledgeRecords.includes(record.knowledgeRecordId) || section.requiredKnowledgeRecords.includes(record.canonicalKey) || context.brief?.knowledgeRecordReferences.includes(record.knowledgeRecordId) || context.brief?.knowledgeRecordReferences.includes(record.canonicalKey))
        .map((record) => ({
          knowledgeRecordId: record.knowledgeRecordId,
          canonicalKey: record.canonicalKey,
          title: record.title,
          value: record.normalizedValue ?? record.structuredValue,
          version: record.version,
          domain: record.domain,
        })),
      evidenceReferences: [...new Set([...context.brief.sourceReferences, ...section.requiredEvidence])],
      claims: context.brief.requiredClaims.filter((claim) => claimLookup.has(claim) || claim.trim().length > 0),
      proofPoints: context.brief.requiredProofPoints,
      restrictions,
      brand: context.brandProfile,
      seoRequirements: context.plan.seoRequirements,
      internalLinkRequirements: context.internalLinks.filter((link) => link.sectionPlacement === section.sectionKey || link.sectionPlacement === undefined).map((link) => ({
        targetPageId: link.targetPageId,
        anchorTextGuidance: link.anchorTextGuidance,
        requirementLevel: link.requirementLevel,
      })),
      ctaRequirements: context.plan.ctaRequirements,
      accessibilityRequirements: context.plan.accessibilityRequirements,
      locale: context.page.locale,
      language: context.page.language,
    };
    return validateGenerationInput(input).ok ? input : null;
  }

  async function createSectionValidationFromContent(draft: GmpContentDraft, section: GmpSectionContent): Promise<GmpSectionValidation> {
    const draftContext = await loadGenerationContext(draft.pageId);
    if (!draftContext || !draftContext.brief || !draftContext.plan) {
      throw new Error("Page generation context is unavailable.");
    }

    const blockingIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const claimLookup = buildClaimLookup(approvedKnowledge(draftContext.records));
    const classifications = section.claimReferences.map((claim) => {
      if (claimLookup.has(claim)) {
        return { statement: claim, classification: "SUPPORTED_CLAIM" as const, reason: "Claim matches approved knowledge." };
      }
      blockingIssues.push(`unsupported_claim:${claim}`);
      return { statement: claim, classification: "UNSUPPORTED_CLAIM" as const, reason: "Claim does not match approved knowledge." };
    });

    const matchedSection = draftContext.sections.find((entry) => entry.sectionId === section.pageSectionId);
    const minWords = Number((matchedSection?.targetWordRange as { min?: number } | undefined)?.min ?? 0);
    const maxWords = Number((matchedSection?.targetWordRange as { max?: number } | undefined)?.max ?? 99999);
    if (!section.heading?.trim()) {
      blockingIssues.push("heading_required");
    }
    if (!section.bodyContent?.trim()) {
      blockingIssues.push("body_required");
    }
    if (section.wordCount < minWords || section.wordCount > maxWords) {
      warnings.push("word_range_violation");
      recommendations.push(`Keep section word count between ${minWords} and ${maxWords}.`);
    }
    if (!section.ctaContent || Object.keys(section.ctaContent).length === 0) {
      warnings.push("cta_missing");
    }

    for (const restriction of buildRestrictionTerms(draftContext.brief, approvedKnowledge(draftContext.records))) {
      if (restriction && section.bodyContent?.toLowerCase().includes(restriction.toLowerCase())) {
        blockingIssues.push(`restricted_messaging:${restriction}`);
      }
    }

    const score = Math.max(0, 100 - blockingIssues.length * 20 - warnings.length * 5);
    return contentRepository.createSectionValidation({
      projectId: draft.projectId,
      pageId: draft.pageId,
      contentDraftId: draft.contentDraftId,
      sectionContentId: section.sectionContentId,
      validationModelVersion: GMP_EDITORIAL_VALIDATION_MODEL_VERSION,
      editorialScore: score,
      blockingIssues,
      warnings,
      recommendations,
      claimClassifications: classifications,
      metadata: {},
    });
  }

  async function assemblePreviewForDraft(draft: GmpContentDraft): Promise<Record<string, unknown>> {
    const sections = await contentRepository.listSectionContentsForDraft(draft.contentDraftId);
    const validation = await contentRepository.getLatestContentValidation(draft.contentDraftId);
    const assembly = await contentRepository.upsertAssembly({
      projectId: draft.projectId,
      pageId: draft.pageId,
      contentDraftId: draft.contentDraftId,
      assemblyType: "draft_preview",
      assembledDocument: {
        contentDraftId: draft.contentDraftId,
        sections: sections.sort((left, right) => left.position - right.position).map((section) => ({
          sectionContentId: section.sectionContentId,
          sectionKey: section.pageSectionStableKey,
          heading: section.heading,
          bodyContent: section.bodyContent,
          ctaContent: section.ctaContent,
          internalLinkSuggestions: section.internalLinkSuggestions,
          mediaGuidance: section.mediaGuidance,
        })),
      },
      validationSummary: validation ?? {},
      metadata: {},
    });
    return assembly.assembledDocument;
  }

  return {
    async evaluateEligibility(pageId) {
      const context = await loadGenerationContext(pageId);
      if (!context?.page) return null;

      const blockingIssues: string[] = [];
      const warnings: string[] = [];
      const requiredInputs = ["page", "site", "approved_brief", "approved_content_plan", "sections", "approved_knowledge", "brand_profile"];
      const missingInputs: string[] = [];
      const approvedRecords = approvedKnowledge(context.records);
      const claimLookup = buildClaimLookup(approvedRecords);
      const openConflicts = context.conflicts.filter((entry) => entry.conflict.resolutionStatus === "OPEN");

      if (!context.site || context.site.projectId !== context.page.projectId) {
        blockingIssues.push("site_missing_or_cross_project");
        missingInputs.push("site");
      }
      if (!context.brief || context.brief.status !== "APPROVED") {
        blockingIssues.push("approved_brief_required");
        missingInputs.push("approved_brief");
      }
      if (!context.plan || context.plan.status !== "APPROVED") {
        blockingIssues.push("approved_content_plan_required");
        missingInputs.push("approved_content_plan");
      }
      if (context.sections.length === 0 || (context.plan && context.sections.filter((section) => !section.optional).length < context.plan.requiredSectionCount)) {
        blockingIssues.push("required_sections_missing");
        missingInputs.push("sections");
      }
      if ((context.readiness?.blockingIssues ?? []).length > 0) {
        blockingIssues.push(...(context.readiness?.blockingIssues ?? []));
      }
      if (openConflicts.length > 0) {
        blockingIssues.push("knowledge_conflicts_unresolved");
      }
      if (!context.brandProfile) {
        blockingIssues.push("brand_profile_required");
        missingInputs.push("brand_profile");
      }
      if (context.brief) {
        for (const claim of context.brief.requiredClaims) {
          if (!claimLookup.has(claim)) {
            blockingIssues.push(`required_claim_missing:${claim}`);
          }
        }
        if (context.brief.evidenceRequirements.length > 0 && context.brief.sourceReferences.length === 0) {
          blockingIssues.push("required_evidence_missing");
        }
        if (context.brief.restrictedMessaging.length === 0) {
          warnings.push("restricted_messaging_rules_missing");
        }
      }

      return {
        eligible: blockingIssues.length === 0,
        blockingIssues,
        warnings,
        requiredInputs,
        missingInputs,
        pageVersion: context.page.version,
        briefVersion: context.brief?.briefVersion,
        planVersion: context.plan?.planVersion,
        knowledgeWorkspaceVersion: context.knowledgeWorkspace.workspaceVersion,
        eligibilityModelVersion: GMP_CONTENT_ELIGIBILITY_MODEL_VERSION,
      };
    },

    async createDraftForPage({ pageId, actorId, provider: providerId, modelIdentifier }) {
      const context = await loadGenerationContext(pageId);
      const eligibility = await this.evaluateEligibility(pageId);
      if (!context?.page || !context.project || !context.site || !context.brief || !context.plan || !context.brandProfile || !eligibility?.eligible) {
        return null;
      }

      return contentRepository.createDraft({
        projectId: context.page.projectId,
        siteId: context.page.siteId,
        pageId: context.page.pageId,
        pageVersion: context.page.version,
        pageBriefId: context.brief.briefId,
        pageBriefVersion: context.brief.briefVersion,
        contentPlanId: context.plan.contentPlanId,
        contentPlanVersion: context.plan.planVersion,
        knowledgeWorkspaceId: context.knowledgeWorkspace.knowledgeWorkspaceId,
        knowledgeWorkspaceVersion: context.knowledgeWorkspace.workspaceVersion,
        brandProfileVersion: context.brandProfile.version,
        generationRequestId: undefined,
        generationStatus: "PENDING",
        editorialStatus: "DRAFT",
        approvalStatus: "PENDING",
        language: context.page.language,
        locale: context.page.locale,
        provider: providerId ?? provider.providerId,
        modelIdentifier: modelIdentifier ?? provider.modelIdentifier,
        generationPolicyVersion: GMP_GENERATION_POLICY_VERSION,
        promptAdapterVersion: createGmpPromptAdapter({ provider: providerId, modelIdentifier }).promptAdapterVersion,
        createdBy: actorId,
        submittedAt: null,
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        supersededAt: null,
        metadata: { eligibility },
      });
    },

    async generateDraft({ draftId, actorId, generationMode = "FULL_PAGE", requestedSections = [], operationType = "FULL_PAGE_GENERATION" }) {
      const draft = await contentRepository.getDraftById(draftId);
      if (!draft) throw new Error("Draft not found.");

      const context = await loadGenerationContext(draft.pageId);
      if (!context?.project || !context.site || !context.page || !context.brief || !context.plan || !context.brandProfile) {
        throw new Error("Draft generation context is unavailable.");
      }

      const eligible = await this.evaluateEligibility(draft.pageId);
      if (!eligible?.eligible) {
        throw new Error(`Draft is not eligible for generation: ${eligible?.blockingIssues.join(", ")}`);
      }

      const adapter = createGmpPromptAdapter({ provider: draft.provider, modelIdentifier: draft.modelIdentifier });
      const sectionsToGenerate = context.sections.filter((section) => requestedSections.length === 0 || requestedSections.includes(section.sectionId) || requestedSections.includes(section.sectionKey));
      const executionId = createExecution(draft.projectId, context.project.workspaceId, actorId, {
        operationType,
        projectId: draft.projectId,
        siteId: draft.siteId,
        pageId: draft.pageId,
        contentDraftId: draft.contentDraftId,
      });
      const request = await contentRepository.createGenerationRequest({
        projectId: draft.projectId,
        pageId: draft.pageId,
        contentDraftId: draft.contentDraftId,
        operationType,
        requestedSections: sectionsToGenerate.map((section) => section.sectionId),
        generationMode,
        providerPreference: draft.provider,
        modelPreference: draft.modelIdentifier,
        temperature: 0,
        maximumOutputPolicy: context.plan.targetWordRange.max,
        requestedBy: actorId,
        startedAt: nowIso(),
        completedAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        gopExecutionId: executionId,
        contextPackageReference: `${draft.contentDraftId}:${context.knowledgeWorkspace.workspaceVersion}`,
        inputFingerprint: stableInputFingerprint({ draftId, requestedSections, generationMode, operationType }),
        status: "RUNNING",
        metadata: {},
      });
      await contentRepository.updateDraft(draft.contentDraftId, { generationRequestId: request.generationRequestId, generationStatus: "GENERATING" });

      const generatedSections: GmpSectionContent[] = [];
      let failedCount = 0;
      for (const pageSection of sectionsToGenerate) {
        try {
          const generationInput = await buildInput(context, pageSection.sectionId);
          if (!generationInput) {
            failedCount += 1;
            continue;
          }
          const fingerprint = stableInputFingerprint(generationInput);
          const prompt = adapter.buildPrompt({ input: generationInput, inputFingerprint: fingerprint });
          const providerOutput = await provider.generateSection(generationInput, prompt);
          const validation = await provider.validateOutput(providerOutput);
          if (!validation.ok) {
            failedCount += 1;
            continue;
          }

          const existing = (await contentRepository.listSectionContentsForDraft(draft.contentDraftId)).find((entry) => entry.pageSectionId === pageSection.sectionId);
          const payload = {
            contentDraftId: draft.contentDraftId,
            pageSectionId: pageSection.sectionId,
            pageSectionStableKey: pageSection.sectionKey,
            sectionType: pageSection.sectionType,
            position: pageSection.position,
            heading: providerOutput.heading,
            bodyContent: providerOutput.body,
            structuredContent: { sectionKey: providerOutput.sectionKey, notes: providerOutput.generationNotes },
            ctaContent: providerOutput.cta,
            mediaGuidance: providerOutput.mediaGuidance,
            internalLinkSuggestions: providerOutput.internalLinksSuggested,
            externalEvidenceReferences: providerOutput.evidenceReferencesUsed,
            knowledgeRecordReferences: providerOutput.knowledgeRecordsUsed,
            claimReferences: providerOutput.claimsUsed,
            sourceReferences: providerOutput.evidenceReferencesUsed,
            restrictionEvaluation: { restrictions: generationInput.restrictions },
            generationStatus: "GENERATED" as const,
            editorialStatus: "DRAFT" as const,
            approvalStatus: "PENDING" as const,
            wordCount: countWords(providerOutput.body),
            readingLevel: context.plan.readingLevel,
            metadata: { warnings: providerOutput.warnings, unresolvedRequirements: providerOutput.unresolvedRequirements },
          };
          const sectionContent = existing
            ? await contentRepository.updateSectionContent(existing.sectionContentId, payload)
            : await contentRepository.createSectionContent(payload);
          if (!sectionContent) {
            failedCount += 1;
            continue;
          }

          await contentRepository.createSectionRevision({
            sectionContentId: sectionContent.sectionContentId,
            contentDraftId: draft.contentDraftId,
            revisionType: existing ? "REGENERATE_SECTION" : "AI_ASSISTED_REVISION",
            instruction: undefined,
            reason: existing ? "Section regenerated" : "Initial section generation",
            previousContent: existing ?? {},
            newContent: sectionContent,
            changedBy: actorId,
            changedAt: nowIso(),
            provider: draft.provider,
            modelIdentifier: draft.modelIdentifier,
            inputFingerprint: fingerprint,
            knowledgeImpact: { knowledgeRecordReferences: sectionContent.knowledgeRecordReferences },
            evidenceImpact: { evidenceReferences: sectionContent.externalEvidenceReferences },
            validationResult: {},
            metadata: {},
          });

          await contentRepository.createLineage({
            projectId: draft.projectId,
            pageId: draft.pageId,
            contentDraftId: draft.contentDraftId,
            sectionContentId: sectionContent.sectionContentId,
            pageVersion: draft.pageVersion,
            pageBriefId: draft.pageBriefId,
            pageBriefVersion: draft.pageBriefVersion,
            contentPlanId: draft.contentPlanId,
            contentPlanVersion: draft.contentPlanVersion,
            pageSectionId: pageSection.sectionId,
            pageSectionStableKey: pageSection.sectionKey,
            knowledgeWorkspaceId: draft.knowledgeWorkspaceId,
            knowledgeWorkspaceVersion: draft.knowledgeWorkspaceVersion,
            knowledgeRecordVersions: sectionContent.knowledgeRecordReferences,
            evidenceReferences: sectionContent.externalEvidenceReferences,
            claims: sectionContent.claimReferences,
            restrictions: buildRestrictionTerms(context.brief, approvedKnowledge(context.records)),
            provider: draft.provider,
            modelIdentifier: draft.modelIdentifier,
            promptAdapterVersion: draft.promptAdapterVersion,
            inputFingerprint: fingerprint,
            generationRequestId: request.generationRequestId,
            gopExecutionId: executionId,
            metadata: {},
          });

          await createSectionValidationFromContent(draft, sectionContent);
          generatedSections.push(sectionContent);
        } catch {
          failedCount += 1;
        }
      }

      const validation = await this.validateDraft(draft.contentDraftId);
      const nextStatus = failedCount === 0 ? "GENERATED" : generatedSections.length > 0 ? "PARTIALLY_GENERATED" : "GENERATION_FAILED";
      const updatedDraft = await contentRepository.updateDraft(draft.contentDraftId, {
        generationStatus: nextStatus,
        editorialStatus: generatedSections.length > 0 ? "DRAFT" : draft.editorialStatus,
      });
      await contentRepository.updateGenerationRequest(request.generationRequestId, {
        status: failedCount === 0 ? "COMPLETED" : generatedSections.length > 0 ? "PARTIALLY_COMPLETED" : "FAILED",
        completedAt: nowIso(),
        failedAt: failedCount > 0 ? nowIso() : null,
        failureReason: failedCount > 0 ? `${failedCount} section(s) failed generation.` : null,
      });
      if (updatedDraft) {
        await assemblePreviewForDraft(updatedDraft);
      }

      return {
        draft: updatedDraft ?? draft,
        request,
        sections: generatedSections,
        validation: validation ?? await contentRepository.createContentValidation({
          projectId: draft.projectId,
          pageId: draft.pageId,
          contentDraftId: draft.contentDraftId,
          validationModelVersion: GMP_EDITORIAL_VALIDATION_MODEL_VERSION,
          overallScore: 0,
          blockingIssues: ["validation_unavailable"],
          warnings: [],
          recommendations: [],
          sectionScores: [],
          metadata: {},
        }),
      };
    },

    async getGenerationStatus(draftId) {
      const draft = await contentRepository.getDraftById(draftId);
      if (!draft) return null;
      const [requests, sections] = await Promise.all([
        contentRepository.listGenerationRequestsForDraft(draftId),
        contentRepository.listSectionContentsForDraft(draftId),
      ]);
      return {
        draft,
        requests,
        completedSections: sections.filter((section) => section.generationStatus === "GENERATED").length,
        failedSections: sections.filter((section) => section.generationStatus === "GENERATION_FAILED").length,
        totalSections: sections.length,
      };
    },

    async reviseSection({ sectionContentId, actorId, instruction, revisionType }) {
      const section = await contentRepository.getSectionContentById(sectionContentId);
      if (!section) return null;
      const draft = await contentRepository.getDraftById(section.contentDraftId);
      if (!draft) return null;
      const context = await loadGenerationContext(draft.pageId);
      if (!context) return null;
      const input = await buildInput(context, section.pageSectionId);
      if (!input) return null;
      const fingerprint = stableInputFingerprint({ input, instruction, revisionType });
      const prompt = createGmpPromptAdapter({ provider: draft.provider, modelIdentifier: draft.modelIdentifier }).buildPrompt({ input, inputFingerprint: fingerprint });
      const output = await provider.reviseSection(input, prompt, instruction);
      const updated = await contentRepository.updateSectionContent(sectionContentId, {
        heading: output.heading,
        bodyContent: output.body,
        ctaContent: output.cta,
        mediaGuidance: output.mediaGuidance,
        internalLinkSuggestions: output.internalLinksSuggested,
        claimReferences: output.claimsUsed,
        knowledgeRecordReferences: output.knowledgeRecordsUsed,
        externalEvidenceReferences: output.evidenceReferencesUsed,
        sourceReferences: output.evidenceReferencesUsed,
        generationStatus: "EDITING",
        editorialStatus: "DRAFT",
        approvalStatus: "PENDING",
        wordCount: countWords(output.body),
      });
      if (!updated) return null;
      await contentRepository.createSectionRevision({
        sectionContentId,
        contentDraftId: draft.contentDraftId,
        revisionType,
        instruction,
        reason: "AI-assisted revision",
        previousContent: section,
        newContent: updated,
        changedBy: actorId,
        changedAt: nowIso(),
        provider: draft.provider,
        modelIdentifier: draft.modelIdentifier,
        inputFingerprint: fingerprint,
        knowledgeImpact: { knowledgeRecordReferences: updated.knowledgeRecordReferences },
        evidenceImpact: { evidenceReferences: updated.externalEvidenceReferences },
        validationResult: {},
        metadata: {},
      });
      await createSectionValidationFromContent(draft, updated);
      await this.validateDraft(draft.contentDraftId);
      await assemblePreviewForDraft(draft);
      return updated;
    },

    async updateSectionDraft({ sectionContentId, actorId, heading, bodyContent, ctaContent, mediaGuidance, internalLinkSuggestions, reason }) {
      const section = await contentRepository.getSectionContentById(sectionContentId);
      if (!section) return null;
      const updated = await contentRepository.updateSectionContent(sectionContentId, {
        heading: heading ?? section.heading,
        bodyContent: bodyContent ?? section.bodyContent,
        ctaContent: ctaContent ?? section.ctaContent,
        mediaGuidance: mediaGuidance ?? section.mediaGuidance,
        internalLinkSuggestions: internalLinkSuggestions ?? section.internalLinkSuggestions,
        generationStatus: "EDITING",
        editorialStatus: "DRAFT",
        approvalStatus: "PENDING",
        wordCount: countWords(bodyContent ?? section.bodyContent),
      });
      if (!updated) return null;
      await contentRepository.createSectionRevision({
        sectionContentId,
        contentDraftId: updated.contentDraftId,
        revisionType: "MANUAL_EDIT",
        instruction: undefined,
        reason,
        previousContent: section,
        newContent: updated,
        changedBy: actorId,
        changedAt: nowIso(),
        knowledgeImpact: {},
        evidenceImpact: {},
        validationResult: {},
        metadata: {},
      });
      const draft = await contentRepository.getDraftById(updated.contentDraftId);
      if (draft) {
        await createSectionValidationFromContent(draft, updated);
        await this.validateDraft(draft.contentDraftId);
        await assemblePreviewForDraft(draft);
      }
      return updated;
    },

    async validateDraft(draftId) {
      const draft = await contentRepository.getDraftById(draftId);
      if (!draft) return null;
      const sections = await contentRepository.listSectionContentsForDraft(draftId);
      const sectionValidations = await Promise.all(sections.map((section) => contentRepository.getLatestSectionValidation(section.sectionContentId)));
      const blockingIssues = sectionValidations.flatMap((validation) => validation?.blockingIssues ?? []);
      const warnings = sectionValidations.flatMap((validation) => validation?.warnings ?? []);
      const recommendations = sectionValidations.flatMap((validation) => validation?.recommendations ?? []);
      const scores = sectionValidations.filter(Boolean).map((validation) => validation!.editorialScore);
      const overallScore = scores.length === 0 ? 0 : Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
      const validation = await contentRepository.createContentValidation({
        projectId: draft.projectId,
        pageId: draft.pageId,
        contentDraftId: draft.contentDraftId,
        validationModelVersion: GMP_EDITORIAL_VALIDATION_MODEL_VERSION,
        overallScore,
        blockingIssues,
        warnings,
        recommendations,
        sectionScores: sectionValidations.filter(Boolean).map((entry) => ({ sectionContentId: entry!.sectionContentId, score: entry!.editorialScore })),
        metadata: {},
      });
      return validation;
    },

    async validateSection(sectionContentId) {
      const section = await contentRepository.getSectionContentById(sectionContentId);
      if (!section) return null;
      const draft = await contentRepository.getDraftById(section.contentDraftId);
      if (!draft) return null;
      return createSectionValidationFromContent(draft, section);
    },

    async submitDraftForReview(draftId, actorId, notes) {
      const draft = await contentRepository.getDraftById(draftId);
      if (!draft) return null;
      await this.validateDraft(draftId);
      const updated = await contentRepository.updateDraft(draftId, { editorialStatus: "READY_FOR_REVIEW", submittedAt: nowIso() });
      if (!updated) return null;
      await contentRepository.createReview({
        projectId: updated.projectId,
        pageId: updated.pageId,
        contentDraftId: updated.contentDraftId,
        sectionContentId: undefined,
        assignedTo: undefined,
        reviewState: "READY_FOR_REVIEW",
        requestedBy: actorId,
        requestedAt: nowIso(),
        completedBy: undefined,
        completedAt: null,
        reviewNotes: notes,
        sectionNotes: undefined,
        approvalNotes: undefined,
        metadata: {},
      });
      return updated;
    },

    async reviewSection(sectionContentId, actorId, notes) {
      const section = await contentRepository.getSectionContentById(sectionContentId);
      if (!section) return null;
      const updated = await contentRepository.updateSectionContent(sectionContentId, { editorialStatus: "IN_REVIEW" });
      if (!updated) return null;
      const draft = await contentRepository.getDraftById(updated.contentDraftId);
      if (draft) {
        await contentRepository.createReview({ projectId: draft.projectId, pageId: draft.pageId, contentDraftId: draft.contentDraftId, sectionContentId, assignedTo: actorId, reviewState: "IN_REVIEW", requestedBy: actorId, requestedAt: nowIso(), completedBy: undefined, completedAt: null, reviewNotes: notes, sectionNotes: notes, approvalNotes: undefined, metadata: {} });
      }
      return updated;
    },

    async approveDraft(draftId, actorId, notes) {
      const draft = await contentRepository.getDraftById(draftId);
      if (!draft) return null;
      const validation = await contentRepository.getLatestContentValidation(draftId);
      const sections = await contentRepository.listSectionContentsForDraft(draftId);
      if ((validation?.blockingIssues.length ?? 0) > 0 || sections.some((section) => section.approvalStatus !== "APPROVED")) {
        return null;
      }
      const updated = await contentRepository.updateDraft(draftId, { editorialStatus: "APPROVED", approvalStatus: "APPROVED", generationStatus: "APPROVED", approvedAt: nowIso(), approvedBy: actorId });
      if (!updated) return null;
      await contentRepository.createApproval({ projectId: updated.projectId, pageId: updated.pageId, contentDraftId: updated.contentDraftId, sectionContentId: undefined, decision: "APPROVED", decidedBy: actorId, decidedAt: nowIso(), notes, metadata: {} });
      return updated;
    },

    async rejectDraft(draftId, actorId, notes) {
      const updated = await contentRepository.updateDraft(draftId, { editorialStatus: "REJECTED", approvalStatus: "REJECTED", generationStatus: "REJECTED", rejectedAt: nowIso(), rejectedBy: actorId });
      if (!updated) return null;
      await contentRepository.createApproval({ projectId: updated.projectId, pageId: updated.pageId, contentDraftId: updated.contentDraftId, sectionContentId: undefined, decision: "REJECTED", decidedBy: actorId, decidedAt: nowIso(), notes, metadata: {} });
      return updated;
    },

    async requestDraftChanges(draftId, actorId, notes) {
      const updated = await contentRepository.updateDraft(draftId, { editorialStatus: "CHANGES_REQUESTED", generationStatus: "CHANGES_REQUESTED" });
      if (!updated) return null;
      await contentRepository.createReview({ projectId: updated.projectId, pageId: updated.pageId, contentDraftId: updated.contentDraftId, sectionContentId: undefined, assignedTo: updated.createdBy, reviewState: "CHANGES_REQUESTED", requestedBy: actorId, requestedAt: nowIso(), completedBy: undefined, completedAt: null, reviewNotes: notes, sectionNotes: undefined, approvalNotes: undefined, metadata: {} });
      return updated;
    },

    async approveSection(sectionContentId, actorId, notes) {
      const section = await contentRepository.getSectionContentById(sectionContentId);
      if (!section) return null;
      const validation = await contentRepository.getLatestSectionValidation(sectionContentId);
      if ((validation?.blockingIssues.length ?? 0) > 0) return null;
      const updated = await contentRepository.updateSectionContent(sectionContentId, { editorialStatus: "APPROVED", approvalStatus: "APPROVED" });
      if (!updated) return null;
      const draft = await contentRepository.getDraftById(updated.contentDraftId);
      if (draft) {
        await contentRepository.createApproval({ projectId: draft.projectId, pageId: draft.pageId, contentDraftId: draft.contentDraftId, sectionContentId, decision: "APPROVED", decidedBy: actorId, decidedAt: nowIso(), notes, metadata: {} });
      }
      return updated;
    },

    async rejectSection(sectionContentId, actorId, notes) {
      const section = await contentRepository.updateSectionContent(sectionContentId, { editorialStatus: "REJECTED", approvalStatus: "REJECTED" });
      if (!section) return null;
      const draft = await contentRepository.getDraftById(section.contentDraftId);
      if (draft) {
        await contentRepository.createApproval({ projectId: draft.projectId, pageId: draft.pageId, contentDraftId: draft.contentDraftId, sectionContentId, decision: "REJECTED", decidedBy: actorId, decidedAt: nowIso(), notes, metadata: {} });
      }
      return section;
    },

    async requestSectionChanges(sectionContentId, actorId, notes) {
      const section = await contentRepository.updateSectionContent(sectionContentId, { editorialStatus: "CHANGES_REQUESTED", approvalStatus: "PENDING" });
      if (!section) return null;
      const draft = await contentRepository.getDraftById(section.contentDraftId);
      if (draft) {
        await contentRepository.createReview({ projectId: draft.projectId, pageId: draft.pageId, contentDraftId: draft.contentDraftId, sectionContentId, assignedTo: draft.createdBy, reviewState: "CHANGES_REQUESTED", requestedBy: actorId, requestedAt: nowIso(), completedBy: undefined, completedAt: null, reviewNotes: notes, sectionNotes: notes, approvalNotes: undefined, metadata: {} });
      }
      return section;
    },

    async getLineage(draftId) {
      const lineage = await contentRepository.listLineageForDraft(draftId);
      return lineage.map((entry) => ({ ...entry }));
    },

    async getPreview(draftId) {
      const draft = await contentRepository.getDraftById(draftId);
      if (!draft) return null;
      const existing = await contentRepository.getAssemblyForDraft(draftId);
      if (existing) return existing.assembledDocument;
      return assemblePreviewForDraft(draft);
    },
  };
}