import { describe, expect, it } from "@jest/globals";
import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpPageRepository } from "@/lib/gmp/page-repository";
import { buildPage } from "@/lib/gmp/page-models";
import { createInMemoryGmpContentRepository } from "@/lib/gmp/content-repository";
import { createInMemoryGmpPublishingRepository } from "@/lib/gmp/publishing-repository";
import { createMockPublishingAdapter } from "@/lib/gmp/publishing-adapters";
import { createGmpPublishingServices } from "@/lib/gmp/publishing-services";

async function seedPublishingContext() {
  const project = createGmpProject({
    name: "Publishing Project",
    workspaceId: "glw-led-display-warehouse",
    ownerActorId: "admin@example.com",
    slug: "publishing-project",
  });

  const projectRepository = createInMemoryGmpRepository({ projects: [project] });
  const pageRepository = createInMemoryGmpPageRepository();
  const contentRepository = createInMemoryGmpContentRepository();
  const publishingRepository = createInMemoryGmpPublishingRepository();

  const site = await projectRepository.createSite({
    projectId: project.projectId,
    displayName: "Main Site",
    primaryDomain: "example.com",
    environment: "production",
    publishingPlatform: "wordpress",
    publishingStatus: "CONNECTED",
    authenticationMethod: "token",
    connectionStatus: "HEALTHY",
    publishingCapabilities: ["draft", "publish"],
    defaultLanguage: "en",
    defaultTheme: "core",
  });

  const page = await pageRepository.createPage(buildPage({
    projectId: project.projectId,
    siteId: site.siteId,
    actorId: "admin@example.com",
    pageType: "product",
    name: "Publishing Page",
    title: "Publishing Page",
  }));

  const brief = await pageRepository.createBrief({
    projectId: project.projectId,
    pageId: page.pageId,
    status: "APPROVED",
    purpose: "Publish governed content",
    audience: "Operators",
    userNeed: "Release controls",
    businessGoal: "Safe publishing",
    primaryTopic: "Governed release",
    secondaryTopics: [],
    primaryKeyword: "governed release",
    secondaryKeywords: [],
    searchIntent: "commercial",
    funnelStage: "decision",
    valueProposition: "Control",
    requiredClaims: [],
    requiredProofPoints: [],
    requiredProductsOrServices: [],
    requiredApplications: [],
    requiredIndustries: [],
    requiredTechnicalSpecifications: [],
    requiredFaqs: [],
    restrictedMessaging: [],
    conversionGoal: "contact",
    primaryCta: "Contact",
    secondaryCta: "Learn",
    competitorContext: {},
    toneGuidance: "direct",
    evidenceRequirements: [],
    knowledgeRecordReferences: [],
    sourceReferences: [],
    approvedAt: new Date().toISOString(),
    approvedBy: "admin@example.com",
    archivedAt: null,
    metadata: {},
  });

  await pageRepository.updatePage(page.pageId, { currentBriefId: brief.briefId });

  const plan = await pageRepository.createContentPlan({
    projectId: project.projectId,
    pageId: page.pageId,
    pageBriefId: brief.briefId,
    status: "APPROVED",
    planningModelVersion: "test-plan",
    targetWordRange: { min: 300, max: 700 },
    readingLevel: "professional",
    requiredSectionCount: 2,
    optionalSectionCount: 0,
    sectionOrder: ["hero", "cta"],
    internalLinkRequirements: [],
    externalEvidenceRequirements: [],
    structuredDataRequirements: [],
    mediaRequirements: [],
    ctaRequirements: [],
    seoRequirements: [],
    accessibilityRequirements: [],
    approvalRequirements: [],
    readinessScore: 95,
    approvedAt: new Date().toISOString(),
    approvedBy: "admin@example.com",
    archivedAt: null,
    metadata: {},
  });

  await pageRepository.updatePage(page.pageId, { currentContentPlanId: plan.contentPlanId });
  const sections = await pageRepository.replaceSectionsForPlan(plan.contentPlanId, page.pageId, project.projectId, [
    {
      projectId: project.projectId,
      pageId: page.pageId,
      contentPlanId: plan.contentPlanId,
      parentSectionId: undefined,
      sectionType: "hero",
      sectionKey: "hero",
      position: 1,
      headingLevel: 1,
      workingHeading: "Hero",
      purpose: "intro",
      audienceNeed: "overview",
      requiredKnowledgeRecords: [],
      requiredClaims: [],
      requiredEvidence: [],
      requiredProducts: [],
      requiredServices: [],
      requiredSpecifications: [],
      requiredFaqs: [],
      targetWordRange: { min: 50, max: 120 },
      ctaType: undefined,
      mediaRequirement: {},
      internalLinkRequirement: {},
      structuredDataContribution: {},
      optional: false,
      status: "PLANNED",
      metadata: {},
    },
    {
      projectId: project.projectId,
      pageId: page.pageId,
      contentPlanId: plan.contentPlanId,
      parentSectionId: undefined,
      sectionType: "cta",
      sectionKey: "cta",
      position: 2,
      headingLevel: 2,
      workingHeading: "CTA",
      purpose: "convert",
      audienceNeed: "action",
      requiredKnowledgeRecords: [],
      requiredClaims: [],
      requiredEvidence: [],
      requiredProducts: [],
      requiredServices: [],
      requiredSpecifications: [],
      requiredFaqs: [],
      targetWordRange: { min: 20, max: 60 },
      ctaType: "primary",
      mediaRequirement: {},
      internalLinkRequirement: {},
      structuredDataContribution: {},
      optional: false,
      status: "PLANNED",
      metadata: {},
    },
  ]);

  const draft = await contentRepository.createDraft({
    projectId: project.projectId,
    siteId: site.siteId,
    pageId: page.pageId,
    pageVersion: page.version,
    pageBriefId: brief.briefId,
    pageBriefVersion: brief.briefVersion,
    contentPlanId: plan.contentPlanId,
    contentPlanVersion: plan.planVersion,
    knowledgeWorkspaceId: "workspace",
    knowledgeWorkspaceVersion: 1,
    brandProfileVersion: 1,
    generationRequestId: undefined,
    generationStatus: "GENERATED",
    editorialStatus: "APPROVED",
    approvalStatus: "APPROVED",
    language: page.language,
    locale: page.locale,
    provider: "deterministic",
    modelIdentifier: "test-model",
    generationPolicyVersion: "v1",
    promptAdapterVersion: "v1",
    createdBy: "admin@example.com",
    submittedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: "admin@example.com",
    rejectedAt: null,
    rejectedBy: null,
    supersededAt: null,
    metadata: {},
  });

  await Promise.all(sections.map((section, index) => contentRepository.createSectionContent({
    contentDraftId: draft.contentDraftId,
    pageSectionId: section.sectionId,
    pageSectionStableKey: section.sectionKey,
    sectionType: section.sectionType,
    position: section.position,
    heading: index === 0 ? "Governed Publishing" : "Start Release",
    bodyContent: index === 0 ? "Approved content only." : "Create governed release.",
    structuredContent: {},
    ctaContent: index === 1 ? { label: "Start" } : {},
    mediaGuidance: {},
    internalLinkSuggestions: [],
    externalEvidenceReferences: [],
    knowledgeRecordReferences: [],
    claimReferences: [],
    sourceReferences: [],
    restrictionEvaluation: {},
    generationStatus: "GENERATED",
    editorialStatus: "APPROVED",
    approvalStatus: "APPROVED",
    wordCount: 40,
    readingLevel: "professional",
    metadata: {},
  })));

  const destination = await publishingRepository.createDestination({
    projectId: project.projectId,
    siteId: site.siteId,
    destinationType: "WORDPRESS",
    name: "WordPress Production",
    baseUrl: "https://example.com",
    environment: "production",
    connectionStatus: "HEALTHY",
    credentialReference: "vault:wp/prod",
    capabilityProfile: {
      createPage: true,
      updatePage: true,
      uploadMedia: true,
      setSeoMetadata: true,
      schedulePublication: true,
    },
    configuration: {},
    defaultAuthor: "1",
    defaultStatus: "draft",
    defaultTaxonomyMapping: {},
    defaultMediaPolicy: {},
    defaultSeoPolicy: {},
    webhookConfiguration: {},
    metadata: {},
    lastValidatedAt: null,
    lastSuccessfulPublishAt: null,
    lastFailureAt: null,
  });

  const services = createGmpPublishingServices({
    projectRepository,
    pageRepository,
    contentRepository,
    publishingRepository,
    fallbackAdapter: createMockPublishingAdapter(),
  });

  return { project, site, page, draft, destination, services, publishingRepository };
}

describe("gmp publishing services", () => {
  it("evaluates deterministic publishing eligibility", async () => {
    const { draft, destination, services } = await seedPublishingContext();
    const eligibility = await services.evaluateEligibility({ contentDraftId: draft.contentDraftId, destinationId: destination.destinationId });

    expect(eligibility).not.toBeNull();
    expect(eligibility?.eligible).toBe(true);
    expect(eligibility?.blockingIssues).toEqual([]);
  });

  it("builds package and manifest with deterministic fingerprint", async () => {
    const { draft, destination, services } = await seedPublishingContext();

    const first = await services.buildPackageFromDraft({
      contentDraftId: draft.contentDraftId,
      destinationId: destination.destinationId,
      actorId: "admin@example.com",
    });

    const second = await services.buildPackageFromDraft({
      contentDraftId: draft.contentDraftId,
      destinationId: destination.destinationId,
      actorId: "admin@example.com",
    });

    expect(first.approvedRevisionSet.sourceFingerprint).toBe(second.approvedRevisionSet.sourceFingerprint);
    expect(first.package.packageFingerprint).toBe(second.package.packageFingerprint);
    expect(first.manifest.packageFingerprint).toBe(second.manifest.packageFingerprint);
  });

  it("executes approved release and records publication", async () => {
    const { project, site, page, draft, destination, services } = await seedPublishingContext();

    const built = await services.buildPackageFromDraft({
      contentDraftId: draft.contentDraftId,
      destinationId: destination.destinationId,
      actorId: "admin@example.com",
    });

    await services.submitPackage(built.package.publishingPackageId, "admin@example.com");
    const approvedPackage = await services.approvePackage(built.package.publishingPackageId, "admin@example.com");
    expect(approvedPackage?.packageStatus).toBe("APPROVED");

    const release = await services.createRelease({
      projectId: project.projectId,
      siteId: site.siteId,
      releaseName: "Launch Release",
      releaseType: "SINGLE_PACKAGE",
      requestedBy: "admin@example.com",
    });

    const releaseItem = await services.addPackageToRelease({
      releaseId: release.releaseId,
      publishingPackageId: built.package.publishingPackageId,
      destinationId: destination.destinationId,
      sequence: 1,
    });
    expect(releaseItem).not.toBeNull();

    const submitted = await services.submitRelease(release.releaseId);
    expect(submitted?.releaseStatus).toBe("IN_REVIEW");

    const approvedRelease = await services.approveRelease(release.releaseId, "admin@example.com");
    expect(approvedRelease?.releaseStatus).toBe("APPROVED");

    const executed = await services.executeRelease(release.releaseId, "admin@example.com");
    expect(executed.records.length).toBe(1);

    const publications = await services.listPublicationsForPage(page.pageId);
    expect(publications.length).toBe(1);

    const verification = await services.verifyPublication(publications[0].publicationRecordId);
    expect(verification).not.toBeNull();
    expect(["VERIFIED", "VERIFIED_WITH_WARNINGS", "MISMATCH"]).toContain(verification?.verificationStatus);
  });

  it("validates dependency graph and flags missing dependencies", async () => {
    const { project, site, destination, draft, services } = await seedPublishingContext();

    const first = await services.buildPackageFromDraft({
      contentDraftId: draft.contentDraftId,
      destinationId: destination.destinationId,
      actorId: "admin@example.com",
    });
    const second = await services.buildPackageFromDraft({
      contentDraftId: draft.contentDraftId,
      destinationId: destination.destinationId,
      actorId: "admin@example.com",
    });

    await services.submitPackage(first.package.publishingPackageId, "admin@example.com");
    await services.submitPackage(second.package.publishingPackageId, "admin@example.com");
    await services.approvePackage(first.package.publishingPackageId, "admin@example.com");
    await services.approvePackage(second.package.publishingPackageId, "admin@example.com");

    const release = await services.createRelease({
      projectId: project.projectId,
      siteId: site.siteId,
      releaseName: "Cyclic Release",
      releaseType: "BATCH",
      requestedBy: "admin@example.com",
    });

    await services.addPackageToRelease({
      releaseId: release.releaseId,
      publishingPackageId: first.package.publishingPackageId,
      destinationId: destination.destinationId,
      sequence: 1,
    });
    await services.addPackageToRelease({
      releaseId: release.releaseId,
      publishingPackageId: second.package.publishingPackageId,
      destinationId: destination.destinationId,
      sequence: 2,
      dependencyReferences: ["missing-release-item"],
    });

    const validation = await services.validateRelease(release.releaseId);
    expect(validation).not.toBeNull();
    expect(validation?.valid).toBe(false);
    expect(validation?.blockingIssues.some((entry) => entry.startsWith("dependency_missing:"))).toBe(true);
  });

  it("supports reconciliation resolution action", async () => {
    const { project, site, page, draft, destination, services } = await seedPublishingContext();

    const built = await services.buildPackageFromDraft({
      contentDraftId: draft.contentDraftId,
      destinationId: destination.destinationId,
      actorId: "admin@example.com",
    });

    await services.submitPackage(built.package.publishingPackageId, "admin@example.com");
    await services.approvePackage(built.package.publishingPackageId, "admin@example.com");

    const release = await services.createRelease({
      projectId: project.projectId,
      siteId: site.siteId,
      releaseName: "Reconciliation Release",
      releaseType: "SINGLE_PACKAGE",
      requestedBy: "admin@example.com",
    });

    await services.addPackageToRelease({
      releaseId: release.releaseId,
      publishingPackageId: built.package.publishingPackageId,
      destinationId: destination.destinationId,
      sequence: 1,
    });

    await services.submitRelease(release.releaseId);
    await services.approveRelease(release.releaseId, "admin@example.com");
    await services.executeRelease(release.releaseId, "admin@example.com");

    const publications = await services.listPublicationsForPage(page.pageId);
    const verification = await services.verifyPublication(publications[0].publicationRecordId);
    expect(verification).not.toBeNull();

    const resolved = await services.reconcilePublication(publications[0].publicationRecordId, "accept_remote");
    expect(resolved).not.toBeNull();
  });

  it("preserves prior attempts when retrying and creates superseding record", async () => {
    const { project, site, page, draft, destination, services, publishingRepository } = await seedPublishingContext();

    const built = await services.buildPackageFromDraft({
      contentDraftId: draft.contentDraftId,
      destinationId: destination.destinationId,
      actorId: "admin@example.com",
    });

    await services.submitPackage(built.package.publishingPackageId, "admin@example.com");
    await services.approvePackage(built.package.publishingPackageId, "admin@example.com");

    const release = await services.createRelease({
      projectId: project.projectId,
      siteId: site.siteId,
      releaseName: "Retry Release",
      releaseType: "SINGLE_PACKAGE",
      requestedBy: "admin@example.com",
    });

    await services.addPackageToRelease({
      releaseId: release.releaseId,
      publishingPackageId: built.package.publishingPackageId,
      destinationId: destination.destinationId,
      sequence: 1,
    });

    await services.submitRelease(release.releaseId);
    await services.approveRelease(release.releaseId, "admin@example.com");
    await services.executeRelease(release.releaseId, "admin@example.com");

    const publications = await services.listPublicationsForPage(page.pageId);
    const prior = publications[0];
    const retried = await services.retryPublication(prior.publicationRecordId, "admin@example.com");

    expect(retried).not.toBeNull();
    const updatedRecords = await publishingRepository.listPublicationRecordsForPage(page.pageId);
    expect(updatedRecords.length).toBeGreaterThanOrEqual(2);
    const attempts = await publishingRepository.listPublicationAttemptsForDestination(destination.destinationId, 20);
    expect(attempts.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves publication history when rolling back", async () => {
    const { project, site, page, draft, destination, services, publishingRepository } = await seedPublishingContext();

    const built = await services.buildPackageFromDraft({
      contentDraftId: draft.contentDraftId,
      destinationId: destination.destinationId,
      actorId: "admin@example.com",
    });

    await services.submitPackage(built.package.publishingPackageId, "admin@example.com");
    await services.approvePackage(built.package.publishingPackageId, "admin@example.com");

    const release = await services.createRelease({
      projectId: project.projectId,
      siteId: site.siteId,
      releaseName: "Rollback Release",
      releaseType: "SINGLE_PACKAGE",
      requestedBy: "admin@example.com",
    });

    await services.addPackageToRelease({
      releaseId: release.releaseId,
      publishingPackageId: built.package.publishingPackageId,
      destinationId: destination.destinationId,
      sequence: 1,
    });

    await services.submitRelease(release.releaseId);
    await services.approveRelease(release.releaseId, "admin@example.com");
    await services.executeRelease(release.releaseId, "admin@example.com");

    const publications = await services.listPublicationsForPage(page.pageId);
    const rollback = await services.rollbackPublication(publications[0].publicationRecordId, "admin@example.com", "rev_target");
    expect(rollback).not.toBeNull();

    const allRecords = await publishingRepository.listPublicationRecordsForPage(page.pageId);
    expect(allRecords.length).toBeGreaterThanOrEqual(2);
    expect(allRecords.some((entry) => entry.rolledBackFromRecordId === publications[0].publicationRecordId)).toBe(true);
  });
});
