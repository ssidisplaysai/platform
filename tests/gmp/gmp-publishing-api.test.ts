import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import { createGmpProject } from "@/lib/gmp/models";
import { createInMemoryGmpRepository } from "@/lib/gmp/repository";
import { createInMemoryGmpPageRepository } from "@/lib/gmp/page-repository";
import { createInMemoryGmpContentRepository } from "@/lib/gmp/content-repository";
import { createInMemoryGmpPublishingRepository } from "@/lib/gmp/publishing-repository";
import { createGmpPublishingServices } from "@/lib/gmp/publishing-services";
import { buildPage } from "@/lib/gmp/page-models";
import {
  handleApprovePublishingPackage,
  handleCreateDestination,
  handleCreatePublishingPackage,
  handleCreateRelease,
  handleExecuteRelease,
  handleGetDestination,
  handleGetDestinationCapabilities,
  handleGetDestinationHealth,
  handleGetPublishingEligibility,
  handleListPublications,
  handlePatchDestination,
  handleReconcilePublication,
  handleRetryRelease,
  handleTestDestinationReadAccess,
  handleTestDestinationWriteCapability,
  handleInvalidateDestinationCredentialCache,
  handleRetryPublication,
  handleRollbackPublication,
  handleSubmitPublishingPackage,
} from "@/lib/gmp/publishing-api";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const sessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });

async function seedPublishingApiContext() {
  const project = createGmpProject({ name: "Publishing API Project", workspaceId: "glw-led-display-warehouse", ownerActorId: "admin@example.com", slug: "publishing-api-project" });
  const projectRepository = createInMemoryGmpRepository({ projects: [project] });
  const pageRepository = createInMemoryGmpPageRepository();
  const contentRepository = createInMemoryGmpContentRepository();
  const publishingRepository = createInMemoryGmpPublishingRepository();
  const publishingServices = createGmpPublishingServices({ projectRepository, pageRepository, contentRepository, publishingRepository });

  const site = await projectRepository.createSite({ projectId: project.projectId, displayName: "Site", primaryDomain: "example.com", environment: "production", publishingPlatform: "wordpress", publishingStatus: "CONNECTED", authenticationMethod: "token", connectionStatus: "HEALTHY", publishingCapabilities: ["draft", "publish"], defaultLanguage: "en", defaultTheme: "core" });
  const page = await pageRepository.createPage(buildPage({ projectId: project.projectId, siteId: site.siteId, actorId: "admin@example.com", pageType: "product", name: "Publish Page", title: "Publish Page" }));
  const brief = await pageRepository.createBrief({ projectId: project.projectId, pageId: page.pageId, status: "APPROVED", purpose: "publish", audience: "operators", userNeed: "control", businessGoal: "safe release", primaryTopic: "publishing", secondaryTopics: [], primaryKeyword: "publishing", secondaryKeywords: [], searchIntent: "commercial", funnelStage: "decision", valueProposition: "governed", requiredClaims: [], requiredProofPoints: [], requiredProductsOrServices: [], requiredApplications: [], requiredIndustries: [], requiredTechnicalSpecifications: [], requiredFaqs: [], restrictedMessaging: [], conversionGoal: "contact", primaryCta: "Contact", secondaryCta: "Learn", competitorContext: {}, toneGuidance: "direct", evidenceRequirements: [], knowledgeRecordReferences: [], sourceReferences: [], approvedAt: new Date().toISOString(), approvedBy: "admin@example.com", metadata: {}, archivedAt: null });
  await pageRepository.updatePage(page.pageId, { currentBriefId: brief.briefId });
  const plan = await pageRepository.createContentPlan({ projectId: project.projectId, pageId: page.pageId, pageBriefId: brief.briefId, status: "APPROVED", planningModelVersion: "test", targetWordRange: { min: 300, max: 600 }, readingLevel: "professional", requiredSectionCount: 1, optionalSectionCount: 0, sectionOrder: ["hero"], internalLinkRequirements: [], externalEvidenceRequirements: [], structuredDataRequirements: [], mediaRequirements: [], ctaRequirements: [], seoRequirements: [], accessibilityRequirements: [], approvalRequirements: [], readinessScore: 95, approvedAt: new Date().toISOString(), approvedBy: "admin@example.com", archivedAt: null, metadata: {} });
  await pageRepository.updatePage(page.pageId, { currentContentPlanId: plan.contentPlanId });
  const [section] = await pageRepository.replaceSectionsForPlan(plan.contentPlanId, page.pageId, project.projectId, [{ projectId: project.projectId, pageId: page.pageId, contentPlanId: plan.contentPlanId, parentSectionId: undefined, sectionType: "hero", sectionKey: "hero", position: 1, headingLevel: 1, workingHeading: "Hero", purpose: "intro", audienceNeed: "overview", requiredKnowledgeRecords: [], requiredClaims: [], requiredEvidence: [], requiredProducts: [], requiredServices: [], requiredSpecifications: [], requiredFaqs: [], targetWordRange: { min: 40, max: 120 }, ctaType: undefined, mediaRequirement: {}, internalLinkRequirement: {}, structuredDataContribution: {}, optional: false, status: "PLANNED", metadata: {} }]);

  const draft = await contentRepository.createDraft({ projectId: project.projectId, siteId: site.siteId, pageId: page.pageId, pageVersion: page.version, pageBriefId: brief.briefId, pageBriefVersion: brief.briefVersion, contentPlanId: plan.contentPlanId, contentPlanVersion: plan.planVersion, knowledgeWorkspaceId: "workspace", knowledgeWorkspaceVersion: 1, brandProfileVersion: 1, generationRequestId: undefined, generationStatus: "GENERATED", editorialStatus: "APPROVED", approvalStatus: "APPROVED", language: page.language, locale: page.locale, provider: "deterministic", modelIdentifier: "test-model", generationPolicyVersion: "v1", promptAdapterVersion: "v1", createdBy: "admin@example.com", submittedAt: new Date().toISOString(), approvedAt: new Date().toISOString(), approvedBy: "admin@example.com", rejectedAt: null, rejectedBy: null, supersededAt: null, metadata: {} });
  await contentRepository.createSectionContent({ contentDraftId: draft.contentDraftId, pageSectionId: section.sectionId, pageSectionStableKey: section.sectionKey, sectionType: section.sectionType, position: section.position, heading: "Governed", bodyContent: "Approved publish body.", structuredContent: {}, ctaContent: {}, mediaGuidance: {}, internalLinkSuggestions: [], externalEvidenceReferences: [], knowledgeRecordReferences: [], claimReferences: [], sourceReferences: [], restrictionEvaluation: {}, generationStatus: "GENERATED", editorialStatus: "APPROVED", approvalStatus: "APPROVED", wordCount: 40, readingLevel: "professional", metadata: {} });

  const destination = await publishingRepository.createDestination({ projectId: project.projectId, siteId: site.siteId, destinationType: "WORDPRESS", name: "WP", baseUrl: "https://example.com", environment: "production", connectionStatus: "HEALTHY", credentialReference: "vault:wp/prod", capabilityProfile: { createPage: true, updatePage: true, schedulePublication: true, setSeoMetadata: true }, configuration: {}, defaultAuthor: "1", defaultStatus: "draft", defaultTaxonomyMapping: {}, defaultMediaPolicy: {}, defaultSeoPolicy: {}, webhookConfiguration: {}, metadata: {}, lastValidatedAt: null, lastSuccessfulPublishAt: null, lastFailureAt: null });

  return { project, site, page, draft, destination, projectRepository, pageRepository, contentRepository, publishingRepository, publishingServices };
}

describe("gmp publishing api", () => {
  it("executes governed publishing lifecycle through API handlers", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedPublishingApiContext();
    const deps = { sessionLoader, ...seeded };

    const eligibility = await handleGetPublishingEligibility(makeRequest(`/api/gmp/content/drafts/${seeded.draft.contentDraftId}/publishing-eligibility?destinationId=${seeded.destination.destinationId}`), seeded.draft.contentDraftId, deps);
    expect(eligibility.status).toBe(200);

    const createPackage = await handleCreatePublishingPackage(
      makeRequest(`/api/gmp/pages/${seeded.page.pageId}/publishing/packages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentDraftId: seeded.draft.contentDraftId, destinationId: seeded.destination.destinationId }) }),
      seeded.page.pageId,
      deps,
    );
    expect(createPackage.status).toBe(201);
    const packageId = (await createPackage.json() as { package: { publishingPackageId: string } }).package.publishingPackageId;

    const submitPackage = await handleSubmitPublishingPackage(makeRequest(`/api/gmp/publishing/packages/${packageId}/submit`, { method: "POST" }), packageId, deps);
    expect(submitPackage.status).toBe(201);

    const approvePackage = await handleApprovePublishingPackage(makeRequest(`/api/gmp/publishing/packages/${packageId}/approve`, { method: "POST" }), packageId, deps);
    expect(approvePackage.status).toBe(201);

    const releaseResponse = await handleCreateRelease(
      makeRequest(`/api/gmp/projects/${seeded.project.projectId}/publishing/releases`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId: seeded.site.siteId, releaseName: "Launch", releaseType: "SINGLE_PACKAGE" }) }),
      seeded.project.projectId,
      deps,
    );
    expect(releaseResponse.status).toBe(201);
    const releaseId = (await releaseResponse.json() as { release: { releaseId: string } }).release.releaseId;

    await seeded.publishingServices.addPackageToRelease({ releaseId, publishingPackageId: packageId, destinationId: seeded.destination.destinationId, sequence: 1 });
    await seeded.publishingServices.submitRelease(releaseId);
    await seeded.publishingServices.approveRelease(releaseId, "admin@example.com");

    const execute = await handleExecuteRelease(makeRequest(`/api/gmp/publishing/releases/${releaseId}/execute`, { method: "POST" }), releaseId, deps);
    expect(execute.status).toBe(201);

    const publications = await handleListPublications(makeRequest(`/api/gmp/pages/${seeded.page.pageId}/publications`), seeded.page.pageId, deps);
    expect(publications.status).toBe(200);
    const publicationList = (await publications.json() as { publications: Array<{ publicationRecordId: string }> }).publications;
    expect(publicationList.length).toBe(1);
  });

  it("enforces session authentication", async () => {
    const seeded = await seedPublishingApiContext();
    const unauthorized = await handleCreateDestination(
      makeRequest(`/api/gmp/projects/${seeded.project.projectId}/publishing/destinations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId: seeded.site.siteId, name: "WP", baseUrl: "https://example.com", destinationType: "WORDPRESS" }) }),
      seeded.project.projectId,
      { sessionLoader: async () => null, ...seeded },
    );

    expect(unauthorized.status).toBe(401);
  });

  it("returns destination detail, capabilities, and health", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedPublishingApiContext();
    const deps = { sessionLoader, ...seeded };

    const detail = await handleGetDestination(
      makeRequest(`/api/gmp/publishing/destinations/${seeded.destination.destinationId}`),
      seeded.destination.destinationId,
      deps,
    );
    expect(detail.status).toBe(200);

    const capabilities = await handleGetDestinationCapabilities(
      makeRequest(`/api/gmp/publishing/destinations/${seeded.destination.destinationId}/capabilities`),
      seeded.destination.destinationId,
      deps,
    );
    expect(capabilities.status).toBe(200);

    const health = await handleGetDestinationHealth(
      makeRequest(`/api/gmp/publishing/destinations/${seeded.destination.destinationId}/health`),
      seeded.destination.destinationId,
      deps,
    );
    expect(health.status).toBe(200);

    const patched = await handlePatchDestination(
      makeRequest(`/api/gmp/publishing/destinations/${seeded.destination.destinationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Destination" }),
      }),
      seeded.destination.destinationId,
      deps,
    );
    expect(patched.status).toBe(200);

    const testRead = await handleTestDestinationReadAccess(
      makeRequest(`/api/gmp/publishing/destinations/${seeded.destination.destinationId}/test-read`, { method: "POST" }),
      seeded.destination.destinationId,
      deps,
    );
    expect(testRead.status).toBe(201);

    const testWrite = await handleTestDestinationWriteCapability(
      makeRequest(`/api/gmp/publishing/destinations/${seeded.destination.destinationId}/test-write`, { method: "POST" }),
      seeded.destination.destinationId,
      deps,
    );
    expect(testWrite.status).toBe(201);

    const invalidate = await handleInvalidateDestinationCredentialCache(
      makeRequest(`/api/gmp/publishing/destinations/${seeded.destination.destinationId}/credentials/invalidate`, { method: "POST" }),
      seeded.destination.destinationId,
      deps,
    );
    expect(invalidate.status).toBe(201);
  });

  it("supports retry and rollback publication handlers", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedPublishingApiContext();
    const deps = { sessionLoader, ...seeded };

    const createPackage = await handleCreatePublishingPackage(
      makeRequest(`/api/gmp/pages/${seeded.page.pageId}/publishing/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentDraftId: seeded.draft.contentDraftId, destinationId: seeded.destination.destinationId }),
      }),
      seeded.page.pageId,
      deps,
    );
    const packageId = (await createPackage.json() as { package: { publishingPackageId: string } }).package.publishingPackageId;

    await handleSubmitPublishingPackage(makeRequest(`/api/gmp/publishing/packages/${packageId}/submit`, { method: "POST" }), packageId, deps);
    await handleApprovePublishingPackage(makeRequest(`/api/gmp/publishing/packages/${packageId}/approve`, { method: "POST" }), packageId, deps);

    const releaseResponse = await handleCreateRelease(
      makeRequest(`/api/gmp/projects/${seeded.project.projectId}/publishing/releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: seeded.site.siteId, releaseName: "Launch", releaseType: "SINGLE_PACKAGE" }),
      }),
      seeded.project.projectId,
      deps,
    );
    const releaseId = (await releaseResponse.json() as { release: { releaseId: string } }).release.releaseId;
    await seeded.publishingServices.addPackageToRelease({ releaseId, publishingPackageId: packageId, destinationId: seeded.destination.destinationId, sequence: 1 });
    await seeded.publishingServices.submitRelease(releaseId);
    await seeded.publishingServices.approveRelease(releaseId, "admin@example.com");
    await handleExecuteRelease(makeRequest(`/api/gmp/publishing/releases/${releaseId}/execute`, { method: "POST" }), releaseId, deps);

    const publications = await handleListPublications(makeRequest(`/api/gmp/pages/${seeded.page.pageId}/publications`), seeded.page.pageId, deps);
    const publicationId = (await publications.json() as { publications: Array<{ publicationRecordId: string }> }).publications[0].publicationRecordId;

    const retry = await handleRetryPublication(
      makeRequest(`/api/gmp/publishing/publications/${publicationId}/retry`, { method: "POST" }),
      publicationId,
      deps,
    );
    expect(retry.status).toBe(201);

    const rollback = await handleRollbackPublication(
      makeRequest(`/api/gmp/publishing/publications/${publicationId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollbackTargetRevisionId: "rev_1" }),
      }),
      publicationId,
      deps,
    );
    expect(rollback.status).toBe(201);

    const releaseRetry = await handleRetryRelease(
      makeRequest(`/api/gmp/publishing/releases/${releaseId}/retry`, { method: "POST" }),
      releaseId,
      deps,
    );
    expect(releaseRetry.status).toBe(201);
  });

  it("denies force overwrite reconciliation action to viewer role", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const seeded = await seedPublishingApiContext();

    const deps = { sessionLoader: viewerSessionLoader, ...seeded };

    const createPackage = await handleCreatePublishingPackage(
      makeRequest(`/api/gmp/pages/${seeded.page.pageId}/publishing/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentDraftId: seeded.draft.contentDraftId, destinationId: seeded.destination.destinationId }),
      }),
      seeded.page.pageId,
      { sessionLoader, ...seeded },
    );
    const packageId = (await createPackage.json() as { package: { publishingPackageId: string } }).package.publishingPackageId;

    await handleSubmitPublishingPackage(makeRequest(`/api/gmp/publishing/packages/${packageId}/submit`, { method: "POST" }), packageId, { sessionLoader, ...seeded });
    await handleApprovePublishingPackage(makeRequest(`/api/gmp/publishing/packages/${packageId}/approve`, { method: "POST" }), packageId, { sessionLoader, ...seeded });

    const releaseResponse = await handleCreateRelease(
      makeRequest(`/api/gmp/projects/${seeded.project.projectId}/publishing/releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: seeded.site.siteId, releaseName: "Launch", releaseType: "SINGLE_PACKAGE" }),
      }),
      seeded.project.projectId,
      { sessionLoader, ...seeded },
    );
    const releaseId = (await releaseResponse.json() as { release: { releaseId: string } }).release.releaseId;
    await seeded.publishingServices.addPackageToRelease({ releaseId, publishingPackageId: packageId, destinationId: seeded.destination.destinationId, sequence: 1 });
    await seeded.publishingServices.submitRelease(releaseId);
    await seeded.publishingServices.approveRelease(releaseId, "admin@example.com");
    await handleExecuteRelease(makeRequest(`/api/gmp/publishing/releases/${releaseId}/execute`, { method: "POST" }), releaseId, { sessionLoader, ...seeded });

    const publications = await handleListPublications(makeRequest(`/api/gmp/pages/${seeded.page.pageId}/publications`), seeded.page.pageId, { sessionLoader, ...seeded });
    const publicationId = (await publications.json() as { publications: Array<{ publicationRecordId: string }> }).publications[0].publicationRecordId;

    const denied = await handleReconcilePublication(
      makeRequest(`/api/gmp/publishing/publications/${publicationId}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionAction: "force_republish" }),
      }),
      publicationId,
      deps,
    );

    expect(denied.status).toBe(403);
  });
});
