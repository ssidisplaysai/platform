import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import type { GmpRepository } from "./repository";
import { createPrismaGmpRepository } from "./repository";
import type { GmpPageRepository } from "./page-repository";
import { createPrismaGmpPageRepository } from "./page-repository";
import type { GmpContentRepository } from "./content-repository";
import { createPrismaGmpContentRepository } from "./content-repository";
import { defaultCapabilitiesByDestination } from "./publishing-contracts";
import { createMockPublishingAdapter, resolveDestinationAdapter, type GmpDestinationAdapter } from "./publishing-adapters";
import { renderPublishingContent } from "./publishing-renderer";
import {
  GMP_PUBLISHING_ELIGIBILITY_MODEL_VERSION,
  GMP_PUBLISHING_MANIFEST_SCHEMA_VERSION,
  GMP_PUBLISHING_PACKAGE_SCHEMA_VERSION,
  GMP_PUBLISHING_POLICY_VERSION,
  GMP_PUBLISHING_VALIDATION_MODEL_VERSION,
  stablePublishingFingerprint,
  type GmpApprovedRevisionSet,
  type GmpPublicationAttempt,
  type GmpPublicationOperationType,
  type GmpPublicationRecord,
  type GmpPublicationVerification,
  type GmpPublishingDestination,
  type GmpPublishingEligibilityReport,
  type GmpPublishingManifest,
  type GmpPublishingPackage,
  type GmpPublishingPackageValidation,
  type GmpRelease,
  type GmpReleaseItem,
} from "./publishing-models";
import type { GmpPublishingRepository } from "./publishing-repository";
import { createPrismaGmpPublishingRepository } from "./publishing-repository";

function nowIso(): string {
  return new Date().toISOString();
}

function releaseOperationType(releaseType: GmpRelease["releaseType"]): GmpPublicationOperationType {
  if (releaseType === "ROLLBACK") return "ROLLBACK";
  if (releaseType === "SCHEDULED") return "SCHEDULE";
  if (releaseType === "UPDATE" || releaseType === "REPUBLISH") return "UPDATE";
  return "CREATE";
}

function classifyFailure(error: unknown): { category: string; code: string; message: string; retryable: boolean } {
  const text = error instanceof Error ? error.message : String(error ?? "Unknown failure");
  const normalized = text.toLowerCase();
  if (normalized.includes("auth")) return { category: "AUTHENTICATION_FAILURE", code: "AUTH", message: text, retryable: false };
  if (normalized.includes("timeout")) return { category: "TIMEOUT", code: "TIMEOUT", message: text, retryable: true };
  if (normalized.includes("rate")) return { category: "RATE_LIMIT", code: "RATE_LIMIT", message: text, retryable: true };
  if (normalized.includes("validation")) return { category: "VALIDATION_FAILURE", code: "VALIDATION", message: text, retryable: false };
  return { category: "UNKNOWN_FAILURE", code: "UNKNOWN", message: text, retryable: false };
}

export type GmpPublishingServices = {
  evaluateEligibility: (input: { contentDraftId: string; destinationId?: string }) => Promise<GmpPublishingEligibilityReport | null>;
  createDestination: (input: Omit<GmpPublishingDestination, "destinationId" | "createdAt" | "updatedAt" | "capabilityProfile"> & { capabilityProfile?: Record<string, boolean> }) => Promise<GmpPublishingDestination>;
  getDestinationById: (destinationId: string) => Promise<GmpPublishingDestination | null>;
  updateDestination: (destinationId: string, changes: Partial<GmpPublishingDestination>) => Promise<GmpPublishingDestination | null>;
  validateDestination: (destinationId: string) => Promise<{ ok: boolean; warnings: string[]; blockingIssues: string[] } | null>;
  getDestinationCapabilities: (destinationId: string) => Promise<Record<string, boolean> | null>;
  getDestinationHealth: (destinationId: string) => Promise<Record<string, unknown> | null>;
  getDestinationDetail: (destinationId: string) => Promise<Record<string, unknown> | null>;
  testDestinationReadAccess: (destinationId: string) => Promise<Record<string, unknown> | null>;
  testDestinationWriteCapability: (destinationId: string) => Promise<Record<string, unknown> | null>;
  buildPackageFromDraft: (input: { contentDraftId: string; destinationId: string; actorId: string; publicationMode?: string; schedule?: Record<string, unknown> }) => Promise<{ package: GmpPublishingPackage; approvedRevisionSet: GmpApprovedRevisionSet; manifest: GmpPublishingManifest }>;
  validatePackage: (publishingPackageId: string) => Promise<GmpPublishingPackageValidation | null>;
  submitPackage: (publishingPackageId: string, actorId: string) => Promise<GmpPublishingPackage | null>;
  approvePackage: (publishingPackageId: string, actorId: string) => Promise<GmpPublishingPackage | null>;
  rejectPackage: (publishingPackageId: string, actorId: string, reason?: string) => Promise<GmpPublishingPackage | null>;

  createRelease: (input: { projectId: string; siteId: string; releaseName: string; releaseType: GmpRelease["releaseType"]; requestedBy: string; scheduledAt?: string | null; metadata?: Record<string, unknown> }) => Promise<GmpRelease>;
  addPackageToRelease: (input: { releaseId: string; publishingPackageId: string; destinationId: string; sequence: number; dependencyReferences?: string[] }) => Promise<GmpReleaseItem | null>;
  validateRelease: (releaseId: string) => Promise<{ valid: boolean; blockingIssues: string[]; warnings: string[] } | null>;
  submitRelease: (releaseId: string) => Promise<GmpRelease | null>;
  approveRelease: (releaseId: string, actorId: string) => Promise<GmpRelease | null>;
  rejectRelease: (releaseId: string) => Promise<GmpRelease | null>;
  executeRelease: (releaseId: string, actorId: string) => Promise<{ release: GmpRelease; items: GmpReleaseItem[]; attempts: GmpPublicationAttempt[]; records: GmpPublicationRecord[] }>;

  retryPublication: (publicationRecordId: string, actorId: string) => Promise<{ attempt: GmpPublicationAttempt; record?: GmpPublicationRecord } | null>;
  rollbackPublication: (publicationRecordId: string, actorId: string, rollbackTargetRevisionId?: string) => Promise<{ attempt: GmpPublicationAttempt; record?: GmpPublicationRecord } | null>;
  verifyPublication: (publicationRecordId: string) => Promise<GmpPublicationVerification | null>;
  reconcilePublication: (publicationRecordId: string, resolutionAction?: string) => Promise<Record<string, unknown> | null>;
  getReleaseDependencyPlan: (releaseId: string) => Promise<Record<string, unknown> | null>;
  getReleaseProgress: (releaseId: string) => Promise<Record<string, unknown> | null>;
  getPublicationTimeline: (publicationRecordId: string) => Promise<Array<Record<string, unknown>> | null>;

  listPackagesForPage: (pageId: string) => Promise<GmpPublishingPackage[]>;
  listDestinationsForProject: (projectId: string) => Promise<GmpPublishingDestination[]>;
  listReleasesForProject: (projectId: string) => Promise<GmpRelease[]>;
  listPublicationsForProject: (projectId: string) => Promise<GmpPublicationRecord[]>;
  listPublicationsForPage: (pageId: string) => Promise<GmpPublicationRecord[]>;
};

export function createGmpPublishingServices(dependencies?: {
  projectRepository?: GmpRepository;
  pageRepository?: GmpPageRepository;
  contentRepository?: GmpContentRepository;
  publishingRepository?: GmpPublishingRepository;
  wordpressAdapter?: GmpDestinationAdapter;
  fallbackAdapter?: GmpDestinationAdapter;
}) : GmpPublishingServices {
  const projectRepository = dependencies?.projectRepository ?? createPrismaGmpRepository();
  const pageRepository = dependencies?.pageRepository ?? createPrismaGmpPageRepository();
  const contentRepository = dependencies?.contentRepository ?? createPrismaGmpContentRepository();
  const publishingRepository = dependencies?.publishingRepository ?? createPrismaGmpPublishingRepository();

  function normalizeDependencyReferences(items: GmpReleaseItem[]): {
    orderedIds: string[];
    missingDependencies: string[];
    cyclic: boolean;
  } {
    const itemMap = new Map(items.map((item) => [item.releaseItemId, item]));
    const indegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    const missingDependencies: string[] = [];

    for (const item of items) {
      indegree.set(item.releaseItemId, 0);
      outgoing.set(item.releaseItemId, []);
    }

    for (const item of items) {
      for (const dependencyId of item.dependencyReferences) {
        if (!itemMap.has(dependencyId)) {
          missingDependencies.push(`${item.releaseItemId}:${dependencyId}`);
          continue;
        }
        indegree.set(item.releaseItemId, (indegree.get(item.releaseItemId) ?? 0) + 1);
        const dependenciesForItem = outgoing.get(dependencyId) ?? [];
        dependenciesForItem.push(item.releaseItemId);
        outgoing.set(dependencyId, dependenciesForItem);
      }
    }

    const queue = items
      .filter((item) => (indegree.get(item.releaseItemId) ?? 0) === 0)
      .sort((left, right) => left.sequence - right.sequence)
      .map((item) => item.releaseItemId);

    const orderedIds: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      orderedIds.push(id);
      const dependents = (outgoing.get(id) ?? [])
        .sort((left, right) => {
          const leftItem = itemMap.get(left);
          const rightItem = itemMap.get(right);
          if (!leftItem || !rightItem) return 0;
          return leftItem.sequence - rightItem.sequence;
        });

      for (const dependentId of dependents) {
        const nextIndegree = (indegree.get(dependentId) ?? 0) - 1;
        indegree.set(dependentId, nextIndegree);
        if (nextIndegree === 0) {
          const dependentItem = itemMap.get(dependentId);
          if (dependentItem) {
            queue.push(dependentItem.releaseItemId);
            queue.sort((left, right) => {
              const leftItem = itemMap.get(left);
              const rightItem = itemMap.get(right);
              if (!leftItem || !rightItem) return 0;
              return leftItem.sequence - rightItem.sequence;
            });
          }
        }
      }
    }

    return {
      orderedIds,
      missingDependencies,
      cyclic: orderedIds.length !== items.length,
    };
  }

  async function assembleApprovedRevisionSet(contentDraftId: string): Promise<GmpApprovedRevisionSet | null> {
    const draft = await contentRepository.getDraftById(contentDraftId);
    if (!draft) return null;

    const [project, site, page, plan, contentValidation, sections, approvals] = await Promise.all([
      projectRepository.getProjectById(draft.projectId),
      projectRepository.getSiteById(draft.siteId),
      pageRepository.getPageById(draft.pageId),
      pageRepository.getContentPlanById(draft.contentPlanId),
      contentRepository.getLatestContentValidation(draft.contentDraftId),
      contentRepository.listSectionContentsForDraft(draft.contentDraftId),
      contentRepository.listApprovalsForDraft(draft.contentDraftId),
    ]);

    if (!project || !site || !page || !plan || draft.approvalStatus !== "APPROVED") {
      return null;
    }

    const approvedSections = sections
      .filter((section) => section.approvalStatus === "APPROVED" && !section.currentRevisionId?.includes("superseded"))
      .sort((left, right) => left.position - right.position);

    const requiredSectionCount = plan.requiredSectionCount;
    if (approvedSections.length < requiredSectionCount) {
      return null;
    }

    const source = {
      draft: {
        contentDraftId: draft.contentDraftId,
        version: draft.version,
        approvalStatus: draft.approvalStatus,
        approvedAt: draft.approvedAt,
      },
      sections: approvedSections.map((section) => ({
        sectionContentId: section.sectionContentId,
        version: section.version,
        position: section.position,
        heading: section.heading,
        bodyContent: section.bodyContent,
        ctaContent: section.ctaContent,
        links: section.internalLinkSuggestions,
        media: section.mediaGuidance,
      })),
      seo: {
        primaryKeyword: page.title,
        canonicalUrl: page.canonicalUrl,
        locale: page.locale,
      },
    };

    const sourceFingerprint = stablePublishingFingerprint(source);

    return publishingRepository.createApprovedRevisionSet({
      projectId: draft.projectId,
      siteId: draft.siteId,
      pageId: draft.pageId,
      contentDraftId: draft.contentDraftId,
      contentDraftVersion: draft.version,
      sourceFingerprint,
      sections: approvedSections.map((section) => ({
        sectionContentId: section.sectionContentId,
        sectionContentVersion: section.version,
        pageSectionId: section.pageSectionId,
        pageSectionStableKey: section.pageSectionStableKey,
        position: section.position,
        heading: section.heading,
        bodyContent: section.bodyContent,
        ctaContent: section.ctaContent,
        internalLinkSelections: section.internalLinkSuggestions,
        mediaGuidance: section.mediaGuidance,
        evidenceReferences: section.externalEvidenceReferences,
        metadata: section.metadata,
      })),
      seoMetadata: {
        seoTitle: page.title,
        metaDescription: page.summary ?? "",
        canonicalUrl: page.canonicalUrl,
        primaryTopic: page.title,
        secondaryTopics: page.secondaryObjectives,
        openGraphTitle: page.title,
        openGraphDescription: page.summary ?? "",
        socialTitle: page.title,
        socialDescription: page.summary ?? "",
        structuredData: {},
        breadcrumbs: [],
        redirects: [],
        robots: "index,follow",
      },
      structuredDataInputs: {},
      approvalRecords: approvals.map((entry) => ({ id: entry.contentApprovalId, decision: entry.decision, decidedBy: entry.decidedBy, decidedAt: entry.decidedAt })),
      validationRecords: contentValidation ? [{
        validationId: contentValidation.contentValidationId,
        overallScore: contentValidation.overallScore,
        blockingIssues: contentValidation.blockingIssues,
        warnings: contentValidation.warnings,
      }] : [],
    });
  }

  async function buildManifest(input: {
    packageEntity: GmpPublishingPackage;
    destination: GmpPublishingDestination;
    approvedSet: GmpApprovedRevisionSet;
    publicationMode: string;
    schedule?: Record<string, unknown>;
  }): Promise<GmpPublishingManifest> {
    const page = await pageRepository.getPageById(input.packageEntity.pageId);
    const rendered = renderPublishingContent({ approvedRevisionSet: input.approvedSet, destinationType: input.destination.destinationType, renderingPolicyVersion: GMP_PUBLISHING_POLICY_VERSION });

    return {
      packageId: input.packageEntity.publishingPackageId,
      packageVersion: input.packageEntity.packageVersion,
      projectIdentity: { projectId: input.packageEntity.projectId },
      siteIdentity: { siteId: input.packageEntity.siteId },
      pageIdentity: {
        pageId: input.packageEntity.pageId,
        title: page?.title,
        slug: input.packageEntity.targetSlug,
      },
      sourceDraftIdentity: {
        contentDraftId: input.packageEntity.contentDraftId,
        contentDraftVersion: input.packageEntity.contentDraftVersion,
      },
      approvedRevisionReferences: input.approvedSet.sections.map((section) => ({
        sectionContentId: section.sectionContentId,
        sectionContentVersion: section.sectionContentVersion,
      })),
      destinationIdentity: {
        destinationId: input.destination.destinationId,
        name: input.destination.name,
        baseUrl: input.destination.baseUrl,
      },
      destinationType: input.destination.destinationType,
      contentPayloadReference: {
        rendererVersion: rendered.rendererVersion,
        outputFingerprint: rendered.outputFingerprint,
        html: rendered.html,
        title: rendered.title,
        excerpt: rendered.excerpt,
      },
      seoPayload: input.approvedSet.seoMetadata,
      metadataPayload: {
        excerpt: rendered.excerpt,
        customFields: {},
      },
      structuredDataPayload: input.approvedSet.structuredDataInputs,
      mediaManifest: {
        featuredMediaId: undefined,
        items: input.approvedSet.sections.flatMap((section) =>
          Object.keys(section.mediaGuidance ?? {}).map((key) => ({
            mediaReferenceId: `${section.sectionContentId}:${key}`,
            role: key,
            required: false,
          })),
        ),
      },
      internalLinkManifest: {
        links: input.approvedSet.sections.flatMap((section) =>
          section.internalLinkSelections.map((entry) => ({
            sourceSectionId: section.sectionContentId,
            genesisTarget: entry.targetPageId,
            resolvedUrl: entry.resolvedUrl ?? null,
          })),
        ),
      },
      externalLinkManifest: {
        links: input.approvedSet.sections.flatMap((section) => section.evidenceReferences.map((entry) => ({ sourceSectionId: section.sectionContentId, reference: entry }))),
      },
      redirectInstructions: [],
      canonicalInstructions: { canonicalUrl: input.packageEntity.canonicalUrl },
      openGraphData: {
        title: input.approvedSet.seoMetadata.openGraphTitle,
        description: input.approvedSet.seoMetadata.openGraphDescription,
      },
      socialMetadata: {
        title: input.approvedSet.seoMetadata.socialTitle,
        description: input.approvedSet.seoMetadata.socialDescription,
      },
      publicationMode: input.publicationMode,
      schedule: input.schedule,
      validationSummary: {
        modelVersion: GMP_PUBLISHING_VALIDATION_MODEL_VERSION,
      },
      lineageSummary: {
        sourceFingerprint: input.approvedSet.sourceFingerprint,
      },
      packageFingerprint: input.packageEntity.packageFingerprint,
      createdAt: nowIso(),
      manifestSchemaVersion: GMP_PUBLISHING_MANIFEST_SCHEMA_VERSION,
    };
  }

  async function validatePackageEntity(entity: GmpPublishingPackage): Promise<GmpPublishingPackageValidation> {
    const [destination, manifest, approvedSet] = await Promise.all([
      publishingRepository.getDestinationById(entity.destinationId),
      publishingRepository.getManifestByPackageId(entity.publishingPackageId),
      entity.approvedRevisionSetId ? publishingRepository.getApprovedRevisionSetById(entity.approvedRevisionSetId) : Promise.resolve(null),
    ]);

    const blockingIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const capabilityGaps: string[] = [];

    if (!approvedSet) {
      blockingIssues.push("approved_revision_set_missing");
    }
    if (!manifest) {
      blockingIssues.push("manifest_missing");
    }
    if (!destination) {
      blockingIssues.push("destination_missing");
    }
    if (destination && destination.connectionStatus !== "HEALTHY") {
      blockingIssues.push("destination_connection_not_healthy");
    }

    const capabilities = destination?.capabilityProfile ?? {};
    if (manifest?.publicationMode === "SCHEDULED" && !capabilities.schedulePublication) {
      blockingIssues.push("destination_does_not_support_scheduling");
      capabilityGaps.push("schedulePublication");
    }
    if (manifest?.mediaManifest && !capabilities.uploadMedia) {
      warnings.push("destination_does_not_support_media_upload");
      capabilityGaps.push("uploadMedia");
    }
    if (manifest?.seoPayload && !capabilities.setSeoMetadata) {
      warnings.push("destination_does_not_support_seo_metadata");
      capabilityGaps.push("setSeoMetadata");
    }

    if (!entity.targetSlug.trim()) {
      blockingIssues.push("target_slug_required");
    }
    if (!entity.canonicalUrl.trim()) {
      blockingIssues.push("canonical_url_required");
    }

    if (warnings.length > 0) {
      recommendations.push("Review destination capability profile before approval.");
    }

    return publishingRepository.createValidation({
      publishingPackageId: entity.publishingPackageId,
      valid: blockingIssues.length === 0,
      blockingIssues,
      warnings,
      recommendations,
      capabilityGaps,
      validationModelVersion: GMP_PUBLISHING_VALIDATION_MODEL_VERSION,
      validatedAt: nowIso(),
      metadata: {},
    });
  }

  return {
    async evaluateEligibility({ contentDraftId, destinationId }) {
      const draft = await contentRepository.getDraftById(contentDraftId);
      if (!draft) return null;

      const [project, site, page, plan, sections, contentValidation, destination] = await Promise.all([
        projectRepository.getProjectById(draft.projectId),
        projectRepository.getSiteById(draft.siteId),
        pageRepository.getPageById(draft.pageId),
        pageRepository.getContentPlanById(draft.contentPlanId),
        contentRepository.listSectionContentsForDraft(contentDraftId),
        contentRepository.getLatestContentValidation(contentDraftId),
        destinationId ? publishingRepository.getDestinationById(destinationId) : Promise.resolve(null),
      ]);

      const blockingIssues: string[] = [];
      const warnings: string[] = [];
      const requiredInputs = ["project", "site", "page", "approved_draft", "approved_sections", "seo_metadata", "destination", "credentials"];
      const missingInputs: string[] = [];

      if (!project || project.status !== "ACTIVE") {
        blockingIssues.push("project_missing_or_inactive");
        missingInputs.push("project");
      }
      if (!site || site.projectId !== draft.projectId) {
        blockingIssues.push("site_missing_or_cross_project");
        missingInputs.push("site");
      }
      if (!page || page.siteId !== draft.siteId || page.lifecycleState === "ARCHIVED") {
        blockingIssues.push("page_missing_or_inactive");
        missingInputs.push("page");
      }
      if (draft.approvalStatus !== "APPROVED") {
        blockingIssues.push("draft_not_approved");
        missingInputs.push("approved_draft");
      }
      if (!plan || plan.status !== "APPROVED") {
        blockingIssues.push("content_plan_not_approved");
      }
      if (sections.filter((section) => section.approvalStatus === "APPROVED").length < (plan?.requiredSectionCount ?? 1)) {
        blockingIssues.push("required_sections_not_approved");
        missingInputs.push("approved_sections");
      }
      if (contentValidation && contentValidation.blockingIssues.length > 0) {
        blockingIssues.push("editorial_validation_blockers_present");
      }
      if (!page?.canonicalUrl) {
        blockingIssues.push("canonical_url_policy_missing");
        missingInputs.push("canonical_url");
      }
      if (!destination && !destinationId) {
        missingInputs.push("destination");
      }
      if (destinationId && !destination) {
        blockingIssues.push("destination_not_found");
      }
      if (destination) {
        if (destination.connectionStatus !== "HEALTHY") {
          blockingIssues.push("destination_connection_not_healthy");
        }
        if (!destination.credentialReference) {
          blockingIssues.push("destination_credentials_missing");
          missingInputs.push("credentials");
        }
      }

      return {
        eligible: blockingIssues.length === 0,
        blockingIssues,
        warnings,
        requiredInputs,
        missingInputs,
        draftVersion: draft.version,
        destinationId: destination?.destinationId,
        destinationType: destination?.destinationType,
        publishingPolicyVersion: GMP_PUBLISHING_POLICY_VERSION,
        eligibilityModelVersion: GMP_PUBLISHING_ELIGIBILITY_MODEL_VERSION,
      };
    },

    async createDestination(input) {
      return publishingRepository.createDestination({
        ...input,
        capabilityProfile: input.capabilityProfile ?? defaultCapabilitiesByDestination(input.destinationType),
      });
    },

    async getDestinationById(destinationId) {
      return publishingRepository.getDestinationById(destinationId);
    },

    async updateDestination(destinationId, changes) {
      const sanitizedChanges: Partial<GmpPublishingDestination> = { ...changes };
      delete sanitizedChanges.destinationId;
      delete sanitizedChanges.projectId;
      delete sanitizedChanges.siteId;
      delete sanitizedChanges.createdAt;
      return publishingRepository.updateDestination(destinationId, sanitizedChanges);
    },

    async validateDestination(destinationId) {
      const destination = await publishingRepository.getDestinationById(destinationId);
      if (!destination) return null;
      const adapter = resolveDestinationAdapter({
        destinationType: destination.destinationType,
        wordpressAdapter: dependencies?.wordpressAdapter,
        fallbackAdapter: dependencies?.fallbackAdapter ?? createMockPublishingAdapter(),
      });
      return adapter.validateConnection(destination);
    },

    async getDestinationCapabilities(destinationId) {
      const destination = await publishingRepository.getDestinationById(destinationId);
      if (!destination) return null;
      const adapter = resolveDestinationAdapter({
        destinationType: destination.destinationType,
        wordpressAdapter: dependencies?.wordpressAdapter,
        fallbackAdapter: dependencies?.fallbackAdapter ?? createMockPublishingAdapter(),
      });
      return adapter.getCapabilities(destination);
    },

    async getDestinationHealth(destinationId) {
      const destination = await publishingRepository.getDestinationById(destinationId);
      if (!destination) return null;

      const adapter = resolveDestinationAdapter({
        destinationType: destination.destinationType,
        wordpressAdapter: dependencies?.wordpressAdapter,
        fallbackAdapter: dependencies?.fallbackAdapter ?? createMockPublishingAdapter(),
      });

      const startedAt = Date.now();
      const validation = await adapter.validateConnection(destination);
      const latencyMs = Date.now() - startedAt;
      const capabilities = await adapter.getCapabilities(destination);

      const recentAttempts = await publishingRepository.listPublicationAttemptsForDestination(destination.destinationId, 20);
      const recentFailure = recentAttempts.find((entry) => entry.status === "FAILED");
      const successCount = recentAttempts.filter((entry) => entry.status === "SUCCEEDED").length;
      const failedCount = recentAttempts.filter((entry) => entry.status === "FAILED").length;
      const total = Math.max(1, recentAttempts.length);
      const publishingHealthScore = Math.max(0, Math.round((successCount / total) * 100));
      const capabilityCount = Object.keys(capabilities).length;
      const capabilitySupportedCount = Object.values(capabilities).filter(Boolean).length;
      const capabilityHealthScore = capabilityCount > 0 ? Math.round((capabilitySupportedCount / capabilityCount) * 100) : 100;

      const blockingIssues = [...validation.blockingIssues];
      const warnings = [...validation.warnings];
      const recommendations: string[] = [];

      if (!validation.ok) {
        recommendations.push("Validate destination credentials and remote API availability before publishing.");
      }
      if (failedCount > successCount) {
        warnings.push("recent_attempt_failure_rate_high");
        recommendations.push("Review recent failed attempts and remediate transport failures before release execution.");
      }

      const overallScore = Math.max(0, Math.round((
        (validation.ok ? 100 : 35)
        + capabilityHealthScore
        + publishingHealthScore
      ) / 3));

      return {
        destinationId: destination.destinationId,
        destinationType: destination.destinationType,
        connectionStatus: validation.ok ? "HEALTHY" : "DEGRADED",
        checkedAt: nowIso(),
        latencyMs,
        overallHealth: { score: overallScore, status: overallScore >= 80 ? "HEALTHY" : overallScore >= 50 ? "DEGRADED" : "UNHEALTHY" },
        connectionHealth: { score: validation.ok ? 100 : 30, status: validation.ok ? "HEALTHY" : "DEGRADED" },
        credentialHealth: { score: blockingIssues.some((entry) => entry.includes("credential")) ? 20 : 100, status: blockingIssues.some((entry) => entry.includes("credential")) ? "UNHEALTHY" : "HEALTHY" },
        capabilityHealth: { score: capabilityHealthScore, status: capabilityHealthScore >= 80 ? "HEALTHY" : "DEGRADED" },
        publishingHealth: { score: publishingHealthScore, status: publishingHealthScore >= 80 ? "HEALTHY" : "DEGRADED", successCount, failedCount },
        verificationHealth: { score: recentFailure ? 55 : 90, status: recentFailure ? "DEGRADED" : "HEALTHY" },
        driftHealth: { score: recentFailure ? 60 : 90, status: recentFailure ? "DEGRADED" : "HEALTHY" },
        warnings,
        blockingIssues,
        recommendations,
        capabilityProfile: capabilities,
        generatedAt: nowIso(),
        modelVersion: "gmp-destination-health/v1",
        latestFailureCategory: recentFailure?.failureCategory,
        lastTransportSuccessAt: recentAttempts.find((entry) => entry.status === "SUCCEEDED")?.completedAt,
        lastTransportFailureAt: recentFailure?.failedAt,
      };
    },

    async getDestinationDetail(destinationId) {
      const destination = await publishingRepository.getDestinationById(destinationId);
      if (!destination) return null;
      const [health, capabilities, attempts, records] = await Promise.all([
        this.getDestinationHealth(destinationId),
        this.getDestinationCapabilities(destinationId),
        publishingRepository.listPublicationAttemptsForDestination(destinationId, 10),
        publishingRepository.listPublicationRecordsForDestination(destinationId, 20),
      ]);

      const verifications = await Promise.all(records.slice(0, 10).map((entry) => publishingRepository.getLatestVerification(entry.publicationRecordId)));
      const reconciliations = await Promise.all(records.slice(0, 10).map((entry) => publishingRepository.getLatestReconciliation(entry.publicationRecordId)));
      const mismatches = verifications.filter((entry) => entry?.verificationStatus === "MISMATCH").length;
      const openReconciliations = reconciliations.filter((entry) => (entry?.metadata?.resolutionState as string | undefined) !== "RESOLVED" && entry?.driftDetected).length;

      const capabilityProfile = capabilities ?? {};

      return {
        destination,
        health,
        capabilityProfile,
        capabilityGaps: Object.entries(capabilityProfile).filter(([, supported]) => !supported).map(([key]) => key),
        credentialReferenceStatus: destination.credentialReference ? "CONFIGURED" : "MISSING",
        credentialValidationStatus: health?.blockingIssues?.some((entry: string) => entry.includes("credential")) ? "INVALID" : "VALID",
        remoteApiAvailability: health?.connectionHealth?.status ?? "UNKNOWN",
        mediaCapability: capabilityProfile.uploadMedia ?? false,
        seoCapability: capabilityProfile.setSeoMetadata ?? false,
        schedulingCapability: capabilityProfile.schedulePublication ?? false,
        rollbackCapability: capabilityProfile.rollback ?? false,
        verificationCapability: capabilityProfile.verifyPublishedState ?? false,
        recentAttempts: attempts,
        recentVerificationMismatches: mismatches,
        openReconciliationIssues: openReconciliations,
      };
    },

    async testDestinationReadAccess(destinationId) {
      const destination = await publishingRepository.getDestinationById(destinationId);
      if (!destination) return null;

      const validation = await this.validateDestination(destinationId);
      return {
        destinationId,
        operation: "test_read_access",
        safeOperation: true,
        ok: Boolean(validation?.ok),
        warnings: validation?.warnings ?? [],
        blockingIssues: validation?.blockingIssues ?? [],
      };
    },

    async testDestinationWriteCapability(destinationId) {
      const destination = await publishingRepository.getDestinationById(destinationId);
      if (!destination) return null;

      const adapter = resolveDestinationAdapter({
        destinationType: destination.destinationType,
        wordpressAdapter: dependencies?.wordpressAdapter,
        fallbackAdapter: dependencies?.fallbackAdapter ?? createMockPublishingAdapter(),
      });

      const dryRunManifest: GmpPublishingManifest = {
        packageId: "dry-run",
        packageVersion: 1,
        projectIdentity: {},
        siteIdentity: {},
        pageIdentity: { slug: "dry-run", title: "Dry Run" },
        sourceDraftIdentity: {},
        approvedRevisionReferences: [],
        destinationIdentity: {},
        destinationType: destination.destinationType,
        contentPayloadReference: { html: "<p>dry run</p>", outputFingerprint: "dry-run" },
        seoPayload: {},
        metadataPayload: {},
        structuredDataPayload: {},
        mediaManifest: {},
        internalLinkManifest: {},
        externalLinkManifest: {},
        redirectInstructions: [],
        canonicalInstructions: {},
        openGraphData: {},
        socialMetadata: {},
        publicationMode: "SAVE_DRAFT",
        schedule: undefined,
        validationSummary: {},
        lineageSummary: {},
        packageFingerprint: "dry-run",
        createdAt: nowIso(),
        manifestSchemaVersion: GMP_PUBLISHING_MANIFEST_SCHEMA_VERSION,
      };

      const result = await adapter.validatePackage(dryRunManifest);
      return {
        destinationId,
        operation: "test_write_capability",
        safeOperation: true,
        ok: result.ok,
        warnings: result.warnings,
        blockingIssues: result.blockingIssues,
      };
    },

    async buildPackageFromDraft({ contentDraftId, destinationId, actorId, publicationMode = "PUBLISH_NOW", schedule }) {
      const eligibility = await this.evaluateEligibility({ contentDraftId, destinationId });
      if (!eligibility?.eligible) {
        throw new Error(`Draft is not publishing-eligible: ${eligibility?.blockingIssues.join(",")}`);
      }

      const draft = await contentRepository.getDraftById(contentDraftId);
      const destination = await publishingRepository.getDestinationById(destinationId);
      const page = draft ? await pageRepository.getPageById(draft.pageId) : null;
      if (!draft || !destination || !page) {
        throw new Error("Draft, destination, or page was not found.");
      }

      const approvedSet = await assembleApprovedRevisionSet(contentDraftId);
      if (!approvedSet) {
        throw new Error("Approved revision set cannot be assembled.");
      }

      const packageFingerprint = stablePublishingFingerprint({
        sourceFingerprint: approvedSet.sourceFingerprint,
        destinationId: destination.destinationId,
        destinationType: destination.destinationType,
        publicationMode,
        schedule,
      });

      const packageEntity = await publishingRepository.createPackage({
        projectId: draft.projectId,
        siteId: draft.siteId,
        pageId: draft.pageId,
        contentDraftId: draft.contentDraftId,
        contentDraftVersion: draft.version,
        approvedRevisionSetId: approvedSet.approvedRevisionSetId,
        destinationId: destination.destinationId,
        destinationType: destination.destinationType,
        packageStatus: "BUILT",
        releaseStatus: "DRAFT",
        packageVersion: 1,
        packageSchemaVersion: GMP_PUBLISHING_PACKAGE_SCHEMA_VERSION,
        publishingPolicyVersion: GMP_PUBLISHING_POLICY_VERSION,
        sourceFingerprint: approvedSet.sourceFingerprint,
        packageFingerprint,
        canonicalUrl: page.canonicalUrl,
        targetSlug: page.slug,
        language: page.language,
        locale: page.locale,
        createdBy: actorId,
        validatedAt: null,
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        supersededAt: null,
        archivedAt: null,
        metadata: {
          publicationMode,
          schedule,
        },
      });

      const manifest = await buildManifest({ packageEntity, destination, approvedSet, publicationMode, schedule });
      await publishingRepository.upsertManifest(manifest);

      await this.validatePackage(packageEntity.publishingPackageId);

      return {
        package: packageEntity,
        approvedRevisionSet: approvedSet,
        manifest,
      };
    },

    async validatePackage(publishingPackageId) {
      const entity = await publishingRepository.getPackageById(publishingPackageId);
      if (!entity) return null;
      const validation = await validatePackageEntity(entity);
      await publishingRepository.updatePackage(publishingPackageId, {
        packageStatus: validation.valid ? "READY_FOR_REVIEW" : "VALIDATION_FAILED",
        validatedAt: validation.validatedAt,
      });
      return validation;
    },

    async submitPackage(publishingPackageId) {
      const entity = await publishingRepository.getPackageById(publishingPackageId);
      if (!entity) return null;
      if (entity.packageStatus !== "READY_FOR_REVIEW" && entity.packageStatus !== "CHANGES_REQUESTED") {
        return null;
      }
      return publishingRepository.updatePackage(publishingPackageId, { packageStatus: "IN_REVIEW" });
    },

    async approvePackage(publishingPackageId, actorId) {
      const entity = await publishingRepository.getPackageById(publishingPackageId);
      if (!entity) return null;
      const validation = await publishingRepository.getLatestValidation(publishingPackageId);
      if (!validation?.valid) {
        return null;
      }
      return publishingRepository.updatePackage(publishingPackageId, {
        packageStatus: "APPROVED",
        approvedAt: nowIso(),
        approvedBy: actorId,
      });
    },

    async rejectPackage(publishingPackageId, actorId, reason) {
      const entity = await publishingRepository.getPackageById(publishingPackageId);
      if (!entity) return null;
      return publishingRepository.updatePackage(publishingPackageId, {
        packageStatus: "REJECTED",
        rejectedAt: nowIso(),
        rejectedBy: actorId,
        metadata: {
          ...(entity.metadata ?? {}),
          rejectionReason: reason,
        },
      });
    },

    async createRelease(input) {
      return publishingRepository.createRelease({
        ...input,
        releaseStatus: input.scheduledAt ? "SCHEDULED" : "DRAFT",
        approvedBy: undefined,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        cancelledAt: null,
        rollbackReleaseId: undefined,
        gopExecutionId: undefined,
        policyVersion: GMP_PUBLISHING_POLICY_VERSION,
      });
    },

    async addPackageToRelease({ releaseId, publishingPackageId, destinationId, sequence, dependencyReferences = [] }) {
      const [release, pkg] = await Promise.all([
        publishingRepository.getReleaseById(releaseId),
        publishingRepository.getPackageById(publishingPackageId),
      ]);
      if (!release || !pkg || pkg.packageStatus !== "APPROVED") {
        return null;
      }
      return publishingRepository.createReleaseItem({
        releaseId,
        publishingPackageId,
        destinationId,
        sequence,
        dependencyReferences,
        status: "DRAFT",
        publicationAttemptCount: 0,
        currentPublicationRecordId: undefined,
        failureReason: undefined,
      });
    },

    async validateRelease(releaseId) {
      const release = await publishingRepository.getReleaseById(releaseId);
      if (!release) return null;
      const items = await publishingRepository.listReleaseItems(releaseId);
      const blockingIssues: string[] = [];
      const warnings: string[] = [];

      if (items.length === 0) {
        blockingIssues.push("release_items_required");
      }

      for (const item of items) {
        const pkg = await publishingRepository.getPackageById(item.publishingPackageId);
        if (!pkg || pkg.packageStatus !== "APPROVED") {
          blockingIssues.push(`item_${item.releaseItemId}_package_not_approved`);
        }
      }

      const graph = normalizeDependencyReferences(items);
      if (graph.missingDependencies.length > 0) {
        for (const missing of graph.missingDependencies) {
          blockingIssues.push(`dependency_missing:${missing}`);
        }
      }
      if (graph.cyclic) {
        blockingIssues.push("dependency_cycle_detected");
      }

      for (let index = 0; index < graph.orderedIds.length; index += 1) {
        const current = items.find((item) => item.releaseItemId === graph.orderedIds[index]);
        if (!current) continue;
        if (current.sequence !== index + 1) {
          warnings.push(`sequence_misaligned:${current.releaseItemId}`);
        }
      }

      return { valid: blockingIssues.length === 0, blockingIssues, warnings };
    },

    async submitRelease(releaseId) {
      const release = await publishingRepository.getReleaseById(releaseId);
      if (!release) return null;
      const validation = await this.validateRelease(releaseId);
      if (!validation?.valid) {
        return null;
      }
      return publishingRepository.updateRelease(releaseId, { releaseStatus: "IN_REVIEW" });
    },

    async approveRelease(releaseId, actorId) {
      const release = await publishingRepository.getReleaseById(releaseId);
      if (!release) return null;
      return publishingRepository.updateRelease(releaseId, { releaseStatus: release.scheduledAt ? "SCHEDULED" : "APPROVED", approvedBy: actorId });
    },

    async rejectRelease(releaseId) {
      const release = await publishingRepository.getReleaseById(releaseId);
      if (!release) return null;
      return publishingRepository.updateRelease(releaseId, { releaseStatus: "REJECTED" });
    },

    async executeRelease(releaseId, actorId) {
      const release = await publishingRepository.getReleaseById(releaseId);
      if (!release) {
        throw new Error("Release not found.");
      }
      if (release.releaseStatus !== "APPROVED" && release.releaseStatus !== "SCHEDULED") {
        throw new Error("Release must be approved before execution.");
      }

      const execution = getGenesisOrchestrationRuntime().createExecution({
        executionType: "gmp_publishing_release",
        workspaceId: "glw-led-display-warehouse",
        moduleId: "gmp.publishing",
        jobType: "PAGE_GENERATION",
        executionClass: "AUTOMATED",
        priority: "HIGH",
        input: { releaseId, actorId },
        correlationId: `gmp-publishing:${releaseId}:${Date.now()}`,
      });

      await publishingRepository.updateRelease(releaseId, {
        releaseStatus: "RUNNING",
        startedAt: nowIso(),
        gopExecutionId: execution.executionId,
      });

      const items = await publishingRepository.listReleaseItems(releaseId);
      const graph = normalizeDependencyReferences(items);
      if (graph.missingDependencies.length > 0 || graph.cyclic) {
        await publishingRepository.updateRelease(releaseId, {
          releaseStatus: "FAILED",
          failedAt: nowIso(),
          metadata: {
            ...(release.metadata ?? {}),
            dependencyValidation: {
              missingDependencies: graph.missingDependencies,
              cyclic: graph.cyclic,
            },
          },
        });
        throw new Error("Release dependency graph invalid.");
      }

      const orderedIds = graph.orderedIds;
      const itemLookup = new Map(items.map((entry) => [entry.releaseItemId, entry]));
      const sorted = orderedIds
        .map((id) => itemLookup.get(id))
        .filter((entry): entry is GmpReleaseItem => Boolean(entry));
      const attempts: GmpPublicationAttempt[] = [];
      const records: GmpPublicationRecord[] = [];

      for (const item of sorted) {
        const pkg = await publishingRepository.getPackageById(item.publishingPackageId);
        const destination = await publishingRepository.getDestinationById(item.destinationId);
        const manifest = pkg ? await publishingRepository.getManifestByPackageId(pkg.publishingPackageId) : null;

        if (!pkg || !destination || !manifest) {
          await publishingRepository.updateReleaseItem(item.releaseItemId, {
            status: "FAILED",
            failureReason: "Package, destination, or manifest missing.",
          });
          continue;
        }

        const operationType = releaseOperationType(release.releaseType);
        const requestFingerprint = stablePublishingFingerprint({
          destinationId: destination.destinationId,
          publishingPackageId: pkg.publishingPackageId,
          packageVersion: pkg.packageVersion,
          operationType,
          releaseItemId: item.releaseItemId,
          packageFingerprint: pkg.packageFingerprint,
        });

        const existingIdempotency = await publishingRepository.getIdempotencyRecordByRequest({
          destinationId: destination.destinationId,
          publishingPackageId: pkg.publishingPackageId,
          packageVersion: pkg.packageVersion,
          operationType,
          releaseItemId: item.releaseItemId,
          requestFingerprint,
        });

        if (existingIdempotency?.status === "SUCCEEDED") {
          const attempt = await publishingRepository.createPublicationAttempt({
            releaseId,
            releaseItemId: item.releaseItemId,
            publishingPackageId: pkg.publishingPackageId,
            destinationId: destination.destinationId,
            operationType,
            attemptNumber: item.publicationAttemptCount + 1,
            status: "SKIPPED",
            gopExecutionId: execution.executionId,
            requestFingerprint,
            startedAt: nowIso(),
            completedAt: nowIso(),
            failedAt: null,
            failureCategory: "IDEMPOTENCY_CONFLICT",
            failureCode: "DUPLICATE_PREVENTED",
            failureMessage: "Idempotent duplicate prevented.",
            retryable: false,
            remoteResponseReference: {},
            metadata: {},
          });
          attempts.push(attempt);
          await publishingRepository.updateReleaseItem(item.releaseItemId, {
            publicationAttemptCount: item.publicationAttemptCount + 1,
            status: "COMPLETED",
          });
          continue;
        }

        const adapter = resolveDestinationAdapter({
          destinationType: destination.destinationType,
          wordpressAdapter: dependencies?.wordpressAdapter,
          fallbackAdapter: dependencies?.fallbackAdapter ?? createMockPublishingAdapter(),
        });

        try {
          const adapterResponse = operationType === "SCHEDULE" && release.scheduledAt
            ? await adapter.schedule(destination, manifest, release.scheduledAt)
            : operationType === "UPDATE"
              ? await adapter.update(destination, manifest, String((pkg.metadata ?? {}).externalObjectId ?? ""))
              : await adapter.publish(destination, manifest);

          const attempt = await publishingRepository.createPublicationAttempt({
            releaseId,
            releaseItemId: item.releaseItemId,
            publishingPackageId: pkg.publishingPackageId,
            destinationId: destination.destinationId,
            operationType,
            attemptNumber: item.publicationAttemptCount + 1,
            status: adapterResponse.success ? "SUCCEEDED" : "FAILED",
            gopExecutionId: execution.executionId,
            requestFingerprint,
            startedAt: nowIso(),
            completedAt: adapterResponse.success ? nowIso() : null,
            failedAt: adapterResponse.success ? null : nowIso(),
            failureCategory: adapterResponse.success ? undefined : "REMOTE_CONFLICT",
            failureCode: adapterResponse.success ? undefined : "REMOTE_WRITE_FAILED",
            failureMessage: adapterResponse.success ? undefined : "Destination rejected payload.",
            retryable: !adapterResponse.success,
            remoteResponseReference: adapterResponse.response,
            metadata: {
              adapterVersion: adapter.adapterVersion,
            },
          });
          attempts.push(attempt);

          await publishingRepository.upsertIdempotencyRecord({
            destinationId: destination.destinationId,
            publishingPackageId: pkg.publishingPackageId,
            packageVersion: pkg.packageVersion,
            operationType,
            releaseItemId: item.releaseItemId,
            requestFingerprint,
            resultFingerprint: stablePublishingFingerprint(adapterResponse),
            status: adapterResponse.success ? "SUCCEEDED" : "FAILED",
            metadata: {
              publicationAttemptId: attempt.publicationAttemptId,
            },
          });

          if (!adapterResponse.success) {
            await publishingRepository.updateReleaseItem(item.releaseItemId, {
              publicationAttemptCount: item.publicationAttemptCount + 1,
              status: "FAILED",
              failureReason: "Destination publish failed.",
            });
            continue;
          }

          const record = await publishingRepository.createPublicationRecord({
            projectId: pkg.projectId,
            siteId: pkg.siteId,
            pageId: pkg.pageId,
            publishingPackageId: pkg.publishingPackageId,
            releaseId,
            destinationId: destination.destinationId,
            externalObjectType: adapterResponse.externalObjectType,
            externalObjectId: adapterResponse.externalObjectId,
            externalRevisionId: adapterResponse.externalRevisionId,
            externalUrl: adapterResponse.externalUrl,
            publishedStatus: adapterResponse.status,
            publishedAt: nowIso(),
            updatedAt: nowIso(),
            verifiedAt: null,
            remoteContentFingerprint: undefined,
            expectedContentFingerprint: pkg.packageFingerprint,
            verificationStatus: "PENDING",
            supersedesPublicationRecordId: undefined,
            rolledBackFromRecordId: undefined,
            metadata: {
              gopExecutionId: execution.executionId,
              adapterVersion: adapter.adapterVersion,
            },
          });
          records.push(record);

          await publishingRepository.updateReleaseItem(item.releaseItemId, {
            publicationAttemptCount: item.publicationAttemptCount + 1,
            currentPublicationRecordId: record.publicationRecordId,
            status: "COMPLETED",
          });

          await publishingRepository.updatePackage(pkg.publishingPackageId, {
            packageStatus: "PUBLISHED",
            releaseStatus: "COMPLETED",
            metadata: {
              ...(pkg.metadata ?? {}),
              externalObjectId: adapterResponse.externalObjectId,
              externalUrl: adapterResponse.externalUrl,
            },
          });
        } catch (error) {
          const failure = classifyFailure(error);
          const attempt = await publishingRepository.createPublicationAttempt({
            releaseId,
            releaseItemId: item.releaseItemId,
            publishingPackageId: pkg.publishingPackageId,
            destinationId: destination.destinationId,
            operationType,
            attemptNumber: item.publicationAttemptCount + 1,
            status: "FAILED",
            gopExecutionId: execution.executionId,
            requestFingerprint,
            startedAt: nowIso(),
            completedAt: null,
            failedAt: nowIso(),
            failureCategory: failure.category,
            failureCode: failure.code,
            failureMessage: failure.message,
            retryable: failure.retryable,
            remoteResponseReference: {},
            metadata: {},
          });
          attempts.push(attempt);

          await publishingRepository.updateReleaseItem(item.releaseItemId, {
            publicationAttemptCount: item.publicationAttemptCount + 1,
            status: "FAILED",
            failureReason: failure.message,
          });
        }
      }

      const finalizedItems = await publishingRepository.listReleaseItems(releaseId);
      const failureCount = finalizedItems.filter((entry) => entry.status === "FAILED").length;
      const completeCount = finalizedItems.filter((entry) => entry.status === "COMPLETED").length;

      const status: GmpRelease["releaseStatus"] = failureCount === 0
        ? "COMPLETED"
        : completeCount > 0
          ? "PARTIALLY_COMPLETED"
          : "FAILED";

      const updatedRelease = await publishingRepository.updateRelease(releaseId, {
        releaseStatus: status,
        completedAt: status === "COMPLETED" || status === "PARTIALLY_COMPLETED" ? nowIso() : null,
        failedAt: status === "FAILED" ? nowIso() : null,
      });

      return {
        release: updatedRelease ?? release,
        items: finalizedItems,
        attempts,
        records,
      };
    },

    async retryPublication(publicationRecordId, actorId) {
      const record = await publishingRepository.getPublicationRecordById(publicationRecordId);
      if (!record) return null;

      const [destination, manifest] = await Promise.all([
        publishingRepository.getDestinationById(record.destinationId),
        publishingRepository.getManifestByPackageId(record.publishingPackageId),
      ]);
      if (!destination || !manifest) return null;

      const releaseItems = await publishingRepository.listReleaseItems(record.releaseId);
      const releaseItem = releaseItems.find((item) =>
        item.currentPublicationRecordId === publicationRecordId
        || (item.destinationId === record.destinationId && item.publishingPackageId === record.publishingPackageId),
      );
      if (!releaseItem) return null;

      const adapter = resolveDestinationAdapter({
        destinationType: destination.destinationType,
        wordpressAdapter: dependencies?.wordpressAdapter,
        fallbackAdapter: dependencies?.fallbackAdapter ?? createMockPublishingAdapter(),
      });

      const requestFingerprint = stablePublishingFingerprint({
        operationType: "RETRY",
        releaseItemId: releaseItem.releaseItemId,
        publicationRecordId,
        actorId,
      });

      const response = record.externalObjectId
        ? await adapter.update(destination, manifest, record.externalObjectId)
        : await adapter.publish(destination, manifest);

      const attempt = await publishingRepository.createPublicationAttempt({
        releaseId: record.releaseId,
        releaseItemId: releaseItem.releaseItemId,
        publishingPackageId: record.publishingPackageId,
        destinationId: record.destinationId,
        operationType: "UPDATE",
        attemptNumber: releaseItem.publicationAttemptCount + 1,
        status: response.success ? "SUCCEEDED" : "FAILED",
        gopExecutionId: undefined,
        requestFingerprint,
        startedAt: nowIso(),
        completedAt: response.success ? nowIso() : null,
        failedAt: response.success ? null : nowIso(),
        failureCategory: response.success ? undefined : "REMOTE_CONFLICT",
        failureCode: response.success ? undefined : "RETRY_FAILED",
        failureMessage: response.success ? undefined : "Retry publish failed.",
        retryable: !response.success,
        remoteResponseReference: response.response,
        metadata: { requestedBy: actorId },
      });

      await publishingRepository.updateReleaseItem(releaseItem.releaseItemId, {
        publicationAttemptCount: releaseItem.publicationAttemptCount + 1,
        status: response.success ? "COMPLETED" : "FAILED",
        failureReason: response.success ? undefined : "Retry publish failed.",
      });

      if (!response.success) {
        return { attempt };
      }

      const supersedingRecord = await publishingRepository.createPublicationRecord({
        projectId: record.projectId,
        siteId: record.siteId,
        pageId: record.pageId,
        publishingPackageId: record.publishingPackageId,
        releaseId: record.releaseId,
        destinationId: record.destinationId,
        externalObjectType: response.externalObjectType,
        externalObjectId: response.externalObjectId,
        externalRevisionId: response.externalRevisionId,
        externalUrl: response.externalUrl,
        publishedStatus: response.status,
        publishedAt: nowIso(),
        updatedAt: nowIso(),
        verifiedAt: null,
        remoteContentFingerprint: undefined,
        expectedContentFingerprint: record.expectedContentFingerprint,
        verificationStatus: "PENDING",
        supersedesPublicationRecordId: record.publicationRecordId,
        rolledBackFromRecordId: undefined,
        metadata: { retryOfPublicationRecordId: record.publicationRecordId, requestedBy: actorId },
      });

      await publishingRepository.updateReleaseItem(releaseItem.releaseItemId, {
        currentPublicationRecordId: supersedingRecord.publicationRecordId,
      });

      return {
        attempt,
        record: supersedingRecord,
      };
    },

    async rollbackPublication(publicationRecordId, actorId, rollbackTargetRevisionId) {
      const record = await publishingRepository.getPublicationRecordById(publicationRecordId);
      if (!record) return null;
      const destination = await publishingRepository.getDestinationById(record.destinationId);
      if (!destination) return null;

      const releaseItems = await publishingRepository.listReleaseItems(record.releaseId);
      const releaseItem = releaseItems.find((item) =>
        item.currentPublicationRecordId === publicationRecordId
        || (item.destinationId === record.destinationId && item.publishingPackageId === record.publishingPackageId),
      );
      if (!releaseItem) return null;

      const adapter = resolveDestinationAdapter({
        destinationType: destination.destinationType,
        wordpressAdapter: dependencies?.wordpressAdapter,
        fallbackAdapter: dependencies?.fallbackAdapter ?? createMockPublishingAdapter(),
      });

      const rollbackResult = await adapter.rollback(destination, record.externalObjectId, rollbackTargetRevisionId);
      const attempt = await publishingRepository.createPublicationAttempt({
        releaseId: record.releaseId,
        releaseItemId: releaseItem.releaseItemId,
        publishingPackageId: record.publishingPackageId,
        destinationId: record.destinationId,
        operationType: "ROLLBACK",
        attemptNumber: releaseItem.publicationAttemptCount + 1,
        status: rollbackResult.success ? "SUCCEEDED" : "FAILED",
        gopExecutionId: undefined,
        requestFingerprint: stablePublishingFingerprint({
          operationType: "ROLLBACK",
          publicationRecordId,
          rollbackTargetRevisionId,
          actorId,
        }),
        startedAt: nowIso(),
        completedAt: rollbackResult.success ? nowIso() : null,
        failedAt: rollbackResult.success ? null : nowIso(),
        failureCategory: rollbackResult.success ? undefined : "REMOTE_CONFLICT",
        failureCode: rollbackResult.success ? undefined : "ROLLBACK_FAILED",
        failureMessage: rollbackResult.success ? undefined : "Rollback failed.",
        retryable: !rollbackResult.success,
        remoteResponseReference: { rollbackTargetRevisionId },
        metadata: { requestedBy: actorId },
      });

      await publishingRepository.updateReleaseItem(releaseItem.releaseItemId, {
        publicationAttemptCount: releaseItem.publicationAttemptCount + 1,
        status: rollbackResult.success ? "COMPLETED" : "FAILED",
        failureReason: rollbackResult.success ? undefined : "Rollback failed.",
      });

      if (!rollbackResult.success) {
        return { attempt };
      }

      const rollbackRecord = await publishingRepository.createPublicationRecord({
        projectId: record.projectId,
        siteId: record.siteId,
        pageId: record.pageId,
        publishingPackageId: record.publishingPackageId,
        releaseId: record.releaseId,
        destinationId: record.destinationId,
        externalObjectType: record.externalObjectType,
        externalObjectId: record.externalObjectId,
        externalRevisionId: rollbackTargetRevisionId,
        externalUrl: record.externalUrl,
        publishedStatus: "rolled_back",
        publishedAt: nowIso(),
        updatedAt: nowIso(),
        verifiedAt: null,
        remoteContentFingerprint: undefined,
        expectedContentFingerprint: record.expectedContentFingerprint,
        verificationStatus: "PENDING",
        supersedesPublicationRecordId: undefined,
        rolledBackFromRecordId: publicationRecordId,
        metadata: { requestedBy: actorId, rollbackTargetRevisionId },
      });

      await publishingRepository.updateReleaseItem(releaseItem.releaseItemId, {
        currentPublicationRecordId: rollbackRecord.publicationRecordId,
      });

      return {
        attempt,
        record: rollbackRecord,
      };
    },

    async verifyPublication(publicationRecordId) {
      const record = await publishingRepository.getPublicationRecordById(publicationRecordId);
      if (!record) return null;
      const destination = await publishingRepository.getDestinationById(record.destinationId);
      const manifest = await publishingRepository.getManifestByPackageId(record.publishingPackageId);
      if (!destination || !manifest) return null;

      const adapter = resolveDestinationAdapter({
        destinationType: destination.destinationType,
        wordpressAdapter: dependencies?.wordpressAdapter,
        fallbackAdapter: dependencies?.fallbackAdapter ?? createMockPublishingAdapter(),
      });

      const verification = await adapter.verify(destination, record.externalObjectId);
      const expectedState = {
        objectId: record.externalObjectId,
        url: record.externalUrl,
        packageFingerprint: record.expectedContentFingerprint,
        slug: manifest.pageIdentity.slug,
        title: manifest.pageIdentity.title,
        content: manifest.contentPayloadReference,
      };

      const normalizeText = (value: unknown): string => String(value ?? "")
        .replace(/<\/?(html|body)>/gi, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

      const remoteState = verification.remoteState;
      const normalizedExpected = {
        slug: normalizeText((expectedState as Record<string, unknown>).slug),
        title: normalizeText((expectedState as Record<string, unknown>).title),
        content: normalizeText((expectedState as Record<string, unknown>).content),
      };
      const normalizedRemote = {
        slug: normalizeText((remoteState as Record<string, unknown>).slug),
        title: normalizeText((remoteState as Record<string, unknown>).title),
        content: normalizeText((remoteState as Record<string, unknown>).content),
      };

      const remoteFingerprint = verification.available ? stablePublishingFingerprint(verification.remoteState) : "";
      const differences: Array<Record<string, unknown>> = [];
      const blockingDifferences: Array<Record<string, unknown>> = [];

      if (!verification.available) {
        blockingDifferences.push({ key: "remote_unavailable", expected: true, actual: false });
      }
      if (verification.available && manifest.contentPayloadReference.outputFingerprint && manifest.contentPayloadReference.outputFingerprint !== remoteFingerprint) {
        differences.push({ key: "content_fingerprint", expected: manifest.contentPayloadReference.outputFingerprint, actual: remoteFingerprint });
        blockingDifferences.push({ key: "content_fingerprint", expected: manifest.contentPayloadReference.outputFingerprint, actual: remoteFingerprint });
      }
      if (verification.available && normalizedExpected.slug && normalizedExpected.slug !== normalizedRemote.slug) {
        differences.push({ key: "slug", expected: normalizedExpected.slug, actual: normalizedRemote.slug });
      }
      if (verification.available && normalizedExpected.title && normalizedExpected.title !== normalizedRemote.title) {
        differences.push({ key: "title", expected: normalizedExpected.title, actual: normalizedRemote.title });
      }
      if (verification.available && normalizedExpected.content && normalizedExpected.content !== normalizedRemote.content) {
        differences.push({ key: "content", expected: "normalized", actual: "normalized_mismatch" });
      }

      const status = !verification.available
        ? "UNAVAILABLE"
        : blockingDifferences.length > 0
          ? "MISMATCH"
          : differences.length > 0
            ? "VERIFIED_WITH_WARNINGS"
            : "VERIFIED";

      const persisted = await publishingRepository.createVerification({
        publicationRecordId,
        verificationStatus: status,
        expectedState,
        remoteState: verification.remoteState,
        differences,
        blockingDifferences,
        warnings: [],
        verificationModelVersion: "gmp-publication-verification/v1",
        verifiedAt: nowIso(),
        metadata: {
          normalizationModelVersion: "gmp-publication-normalization/v1",
          normalizedExpected,
          normalizedRemote,
        },
      });

      await publishingRepository.createReconciliation({
        publicationRecordId,
        reconciliationStatus: status === "MISMATCH" ? "DRIFT_DETECTED" : "IN_SYNC",
        driftDetected: status === "MISMATCH",
        driftReasons: status === "MISMATCH" ? ["content_fingerprint_changed"] : [],
        expectedState,
        remoteState: verification.remoteState,
        detectedAt: nowIso(),
        metadata: {
          resolutionState: status === "MISMATCH" ? "UNRESOLVED" : "NOT_REQUIRED",
          normalizationModelVersion: "gmp-publication-normalization/v1",
          normalizedExpected,
          normalizedRemote,
        },
      });

      return persisted;
    },

    async reconcilePublication(publicationRecordId, resolutionAction) {
      const latest = await publishingRepository.getLatestReconciliation(publicationRecordId);
      if (!latest) return null;

      if (!resolutionAction) {
        return latest;
      }

      const updated = await publishingRepository.createReconciliation({
        publicationRecordId,
        reconciliationStatus: latest.reconciliationStatus,
        driftDetected: latest.driftDetected,
        driftReasons: latest.driftReasons,
        expectedState: latest.expectedState,
        remoteState: latest.remoteState,
        detectedAt: nowIso(),
        metadata: {
          ...(latest.metadata ?? {}),
          resolutionState: "RESOLVED",
          resolutionAction,
          resolvedAt: nowIso(),
        },
      });

      return updated;
    },

    async getReleaseDependencyPlan(releaseId) {
      const release = await publishingRepository.getReleaseById(releaseId);
      if (!release) return null;

      const items = await publishingRepository.listReleaseItems(releaseId);
      const graph = normalizeDependencyReferences(items);
      const blockedDependents = items
        .filter((item) => item.dependencyReferences.some((dependencyId) => {
          const dependency = items.find((entry) => entry.releaseItemId === dependencyId);
          return dependency?.status === "FAILED";
        }))
        .map((item) => item.releaseItemId);

      return {
        releaseId,
        items,
        resolvedExecutionOrder: graph.orderedIds,
        parallelizableGroups: graph.orderedIds.length > 0 ? [graph.orderedIds] : [],
        missingDependencies: graph.missingDependencies,
        circularDependencies: graph.cyclic,
        blockedDependents,
        sequenceConflicts: items
          .filter((item, index) => graph.orderedIds[index] && graph.orderedIds[index] !== item.releaseItemId)
          .map((entry) => entry.releaseItemId),
        validationModelVersion: "gmp-release-dependency-plan/v1",
        executionPolicy: release.releaseType,
        concurrencyPolicy: "SEQUENTIAL_TOPOLOGICAL",
      };
    },

    async getReleaseProgress(releaseId) {
      const release = await publishingRepository.getReleaseById(releaseId);
      if (!release) return null;

      const items = await publishingRepository.listReleaseItems(releaseId);
      const attempts = (await Promise.all(items.map((item) => publishingRepository.listPublicationAttemptsForReleaseItem(item.releaseItemId)))).flat();
      const queued = items.filter((entry) => entry.status === "QUEUED").length;
      const running = items.filter((entry) => entry.status === "RUNNING").length;
      const completed = items.filter((entry) => entry.status === "COMPLETED").length;
      const failed = items.filter((entry) => entry.status === "FAILED").length;
      const blocked = items.filter((entry) => entry.status === "DRAFT").length;
      const retryable = attempts.filter((entry) => entry.status === "FAILED" && entry.retryable).length;
      const latestFailure = attempts
        .filter((entry) => entry.status === "FAILED")
        .sort((left, right) => String(right.failedAt ?? "").localeCompare(String(left.failedAt ?? "")))[0];

      return {
        release,
        summary: {
          queuedItems: queued,
          runningItems: running,
          completedItems: completed,
          failedItems: failed,
          blockedItems: blocked,
          retryableItems: retryable,
          verificationStatus: failed > 0 ? "MISMATCH_OR_FAILED" : "PENDING_OR_VERIFIED",
          rollbackAvailability: failed > 0 || completed > 0,
          attemptCount: attempts.length,
          latestFailure,
        },
        items,
        attempts: attempts.slice(0, 30),
        gopExecutionId: release.gopExecutionId,
        modelVersion: "gmp-release-progress/v1",
      };
    },

    async getPublicationTimeline(publicationRecordId) {
      const record = await publishingRepository.getPublicationRecordById(publicationRecordId);
      if (!record) return null;

      const [pkg, release, verification, reconciliation] = await Promise.all([
        publishingRepository.getPackageById(record.publishingPackageId),
        publishingRepository.getReleaseById(record.releaseId),
        publishingRepository.getLatestVerification(publicationRecordId),
        publishingRepository.getLatestReconciliation(publicationRecordId),
      ]);

      const items = await publishingRepository.listReleaseItems(record.releaseId);
      const item = items.find((entry) => entry.currentPublicationRecordId === publicationRecordId || entry.publishingPackageId === record.publishingPackageId);
      const attempts = item ? await publishingRepository.listPublicationAttemptsForReleaseItem(item.releaseItemId) : [];

      const timeline: Array<Record<string, unknown>> = [];
      if (pkg) {
        timeline.push({ timestamp: pkg.createdAt, operation: "Publishing Package", status: pkg.packageStatus, actor: pkg.createdBy, objectReference: pkg.publishingPackageId });
      }
      timeline.push({ timestamp: record.createdAt, operation: "Remote Object Creation or Update", status: record.publishedStatus, objectReference: record.externalObjectId, executionReference: record.metadata?.gopExecutionId });

      for (const attempt of attempts.sort((left, right) => right.attemptNumber - left.attemptNumber)) {
        timeline.push({
          timestamp: attempt.completedAt ?? attempt.failedAt ?? attempt.startedAt,
          operation: attempt.operationType === "ROLLBACK" ? "Rollback" : attempt.operationType === "UPDATE" ? "Retry/Update" : "Publication Attempt",
          status: attempt.status,
          actor: attempt.metadata?.requestedBy,
          objectReference: attempt.publicationAttemptId,
          executionReference: attempt.gopExecutionId,
          outcome: attempt.failureMessage ?? "completed",
          failureCategory: attempt.failureCategory,
        });
      }

      if (release) {
        timeline.push({ timestamp: release.createdAt, operation: "Release", status: release.releaseStatus, actor: release.requestedBy, objectReference: release.releaseId, executionReference: release.gopExecutionId });
      }
      if (verification) {
        timeline.push({ timestamp: verification.verifiedAt, operation: "Verification", status: verification.verificationStatus, objectReference: verification.publicationVerificationId, outcome: verification.blockingDifferences.length > 0 ? "blocking_differences" : "verified" });
      }
      if (reconciliation) {
        timeline.push({ timestamp: reconciliation.detectedAt, operation: "Reconciliation", status: reconciliation.reconciliationStatus, objectReference: reconciliation.publicationReconciliationId, outcome: reconciliation.metadata?.resolutionState ?? "UNRESOLVED" });
      }

      return timeline.sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)));
    },

    async listPackagesForPage(pageId) {
      return publishingRepository.listPackagesForPage(pageId);
    },

    async listDestinationsForProject(projectId) {
      return publishingRepository.listDestinationsForProject(projectId);
    },

    async listReleasesForProject(projectId) {
      return publishingRepository.listReleasesForProject(projectId);
    },

    async listPublicationsForProject(projectId) {
      return publishingRepository.listPublicationRecordsForProject(projectId);
    },

    async listPublicationsForPage(pageId) {
      return publishingRepository.listPublicationRecordsForPage(pageId);
    },
  };
}
