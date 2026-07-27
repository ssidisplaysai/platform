import { describe, expect, it, beforeEach, jest } from "@jest/globals";

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
import { buildPage } from "@/lib/gmp/page-models";
import { createGmpPublishingServices } from "@/lib/gmp/publishing-services";
import {
  handleApprovePublishingPackage,
  handleApproveRelease,
  handleCreateRelease,
  handleExecuteRelease,
  handleGetDestination,
  handleGetDestinationCapabilities,
  handleGetDestinationHealth,
  handleGetPublication,
  handleGetPublicationHistory,
  handleGetReconciliation,
  handleListProjectPublications,
  handlePatchDestination,
  handleReconcilePublication,
  handleRetryPublication,
  handleRetryRelease,
  handleRollbackPublication,
  handleValidateDestination,
  handleVerifyPublication,
} from "@/lib/gmp/publishing-api";
import { createActionReference, createGenesisAuthorizationResolver, createGenesisSubject } from "@/platform/gop/auth/resolver";
import { genesisDefaultPolicies } from "@/platform/gop/auth/policies";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const adminSessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const viewerSessionLoader = async () => ({ email: "viewer@example.com", expiresAt: Date.now() + 100000 });
const unauthorizedSessionLoader = async () => null;

async function seedProjectFixture(input: {
  workspaceId: string;
  ownerActorId: string;
  slug: string;
  services: ReturnType<typeof createGmpPublishingServices>;
  projectRepository: ReturnType<typeof createInMemoryGmpRepository>;
  pageRepository: ReturnType<typeof createInMemoryGmpPageRepository>;
  contentRepository: ReturnType<typeof createInMemoryGmpContentRepository>;
  publishingRepository: ReturnType<typeof createInMemoryGmpPublishingRepository>;
}) {
  const project = createGmpProject({
    name: `Publishing ${input.slug}`,
    workspaceId: input.workspaceId,
    ownerActorId: input.ownerActorId,
    slug: input.slug,
  });
  await input.projectRepository.createProject(project);

  const site = await input.projectRepository.createSite({
    projectId: project.projectId,
    displayName: `${input.slug}-site`,
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

  const page = await input.pageRepository.createPage(buildPage({
    projectId: project.projectId,
    siteId: site.siteId,
    actorId: input.ownerActorId,
    pageType: "product",
    name: `${input.slug}-page`,
    title: `${input.slug}-page`,
  }));

  const brief = await input.pageRepository.createBrief({
    projectId: project.projectId,
    pageId: page.pageId,
    status: "APPROVED",
    purpose: "publish",
    audience: "operators",
    userNeed: "control",
    businessGoal: "safe release",
    primaryTopic: "publishing",
    secondaryTopics: [],
    primaryKeyword: "publishing",
    secondaryKeywords: [],
    searchIntent: "commercial",
    funnelStage: "decision",
    valueProposition: "governed",
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
    approvedBy: input.ownerActorId,
    metadata: {},
    archivedAt: null,
  });
  await input.pageRepository.updatePage(page.pageId, { currentBriefId: brief.briefId });

  const plan = await input.pageRepository.createContentPlan({
    projectId: project.projectId,
    pageId: page.pageId,
    pageBriefId: brief.briefId,
    status: "APPROVED",
    planningModelVersion: "test",
    targetWordRange: { min: 300, max: 600 },
    readingLevel: "professional",
    requiredSectionCount: 1,
    optionalSectionCount: 0,
    sectionOrder: ["hero"],
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
    approvedBy: input.ownerActorId,
    archivedAt: null,
    metadata: {},
  });
  await input.pageRepository.updatePage(page.pageId, { currentContentPlanId: plan.contentPlanId });

  const [section] = await input.pageRepository.replaceSectionsForPlan(plan.contentPlanId, page.pageId, project.projectId, [{
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
    targetWordRange: { min: 40, max: 120 },
    ctaType: undefined,
    mediaRequirement: {},
    internalLinkRequirement: {},
    structuredDataContribution: {},
    optional: false,
    status: "PLANNED",
    metadata: {},
  }]);

  const draft = await input.contentRepository.createDraft({
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
    createdBy: input.ownerActorId,
    submittedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: input.ownerActorId,
    rejectedAt: null,
    rejectedBy: null,
    supersededAt: null,
    metadata: {},
  });

  await input.contentRepository.createSectionContent({
    contentDraftId: draft.contentDraftId,
    pageSectionId: section.sectionId,
    pageSectionStableKey: section.sectionKey,
    sectionType: section.sectionType,
    position: section.position,
    heading: "Governed",
    bodyContent: "Approved publish body.",
    structuredContent: {},
    ctaContent: {},
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
  });

  const destination = await input.publishingRepository.createDestination({
    projectId: project.projectId,
    siteId: site.siteId,
    destinationType: "WORDPRESS",
    name: `${input.slug}-destination`,
    baseUrl: "https://example.com",
    environment: "production",
    connectionStatus: "HEALTHY",
    credentialReference: "vault:wp/prod",
    capabilityProfile: { createPage: true, updatePage: true, schedulePublication: true, setSeoMetadata: true },
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

  const built = await input.services.buildPackageFromDraft({
    contentDraftId: draft.contentDraftId,
    destinationId: destination.destinationId,
    actorId: input.ownerActorId,
  });

  await input.services.submitPackage(built.package.publishingPackageId, input.ownerActorId);
  await input.services.approvePackage(built.package.publishingPackageId, input.ownerActorId);

  const release = await input.services.createRelease({
    projectId: project.projectId,
    siteId: site.siteId,
    releaseName: `${input.slug}-release`,
    releaseType: "SINGLE_PACKAGE",
    requestedBy: input.ownerActorId,
  });

  await input.services.addPackageToRelease({
    releaseId: release.releaseId,
    publishingPackageId: built.package.publishingPackageId,
    destinationId: destination.destinationId,
    sequence: 1,
  });
  await input.services.submitRelease(release.releaseId);
  await input.services.approveRelease(release.releaseId, input.ownerActorId);
  await input.services.executeRelease(release.releaseId, input.ownerActorId);

  const publications = await input.services.listPublicationsForPage(page.pageId);
  const publication = publications[0];
  await input.services.verifyPublication(publication.publicationRecordId);
  await input.services.reconcilePublication(publication.publicationRecordId, "accept_remote");

  return {
    project,
    site,
    page,
    draft,
    destination,
    packageId: built.package.publishingPackageId,
    releaseId: release.releaseId,
    publicationId: publication.publicationRecordId,
  };
}

async function seedDualWorkspaceContext() {
  const projectRepository = createInMemoryGmpRepository();
  const pageRepository = createInMemoryGmpPageRepository();
  const contentRepository = createInMemoryGmpContentRepository();
  const publishingRepository = createInMemoryGmpPublishingRepository();
  const publishingServices = createGmpPublishingServices({
    projectRepository,
    pageRepository,
    contentRepository,
    publishingRepository,
  });

  const primary = await seedProjectFixture({
    workspaceId: "glw-led-display-warehouse",
    ownerActorId: "admin@example.com",
    slug: "primary",
    services: publishingServices,
    projectRepository,
    pageRepository,
    contentRepository,
    publishingRepository,
  });

  const foreign = await seedProjectFixture({
    workspaceId: "other-workspace",
    ownerActorId: "admin@example.com",
    slug: "foreign",
    services: publishingServices,
    projectRepository,
    pageRepository,
    contentRepository,
    publishingRepository,
  });

  return {
    primary,
    foreign,
    deps: {
      projectRepository,
      pageRepository,
      contentRepository,
      publishingRepository,
      publishingServices,
    },
  };
}

describe("gmp publishing authorization matrix", () => {
  beforeEach(() => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
  });

  it("enforces role/action matrix including default deny", () => {
    const resolver = createGenesisAuthorizationResolver(genesisDefaultPolicies);

    const viewer = createGenesisSubject({
      actorId: "viewer@example.com",
      role: "VIEWER",
      workspaceMemberships: [{ workspaceId: "glw-led-display-warehouse", actorId: "viewer@example.com", role: "VIEWER", permissions: ["read"], active: true }],
      permissions: ["read"],
    });

    const operator = createGenesisSubject({
      actorId: "operator@example.com",
      role: "OPERATOR",
      workspaceMemberships: [{ workspaceId: "glw-led-display-warehouse", actorId: "operator@example.com", role: "OPERATOR", permissions: ["read", "write"], active: true }],
      permissions: ["read", "write"],
    });

    const admin = createGenesisSubject({
      actorId: "admin@example.com",
      role: "ADMINISTRATOR",
      workspaceMemberships: [{ workspaceId: "glw-led-display-warehouse", actorId: "admin@example.com", role: "ADMINISTRATOR", permissions: ["read", "write", "admin"], active: true }],
      permissions: ["read", "write", "admin"],
    });

    const actions = [
      { id: "gmp:publishing:view_destinations", viewer: true, operator: true, admin: true },
      { id: "gmp:publishing:validate_destination", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:manage_destinations", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:view_packages", viewer: true, operator: true, admin: true },
      { id: "gmp:publishing:approve_package", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:create_release", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:approve_release", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:execute_release", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:retry_publication", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:create_rollback", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:approve_rollback", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:execute_rollback", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:verify_publication", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:reconcile_publication", viewer: false, operator: true, admin: true },
      { id: "gmp:publishing:force_overwrite", viewer: false, operator: false, admin: true },
      { id: "gmp:publishing:view_history", viewer: true, operator: true, admin: true },
    ];

    for (const entry of actions) {
      const resource = { workspaceId: "glw-led-display-warehouse", moduleId: "gmp.publishing", route: "/matrix", ownerActorId: "viewer@example.com" };
      expect(resolver.authorize({ workspaceId: "glw-led-display-warehouse", moduleId: "gmp.publishing", subject: viewer, action: createActionReference(entry.id, "route_access"), resource }).allowed).toBe(entry.viewer);
      expect(resolver.authorize({ workspaceId: "glw-led-display-warehouse", moduleId: "gmp.publishing", subject: operator, action: createActionReference(entry.id, "route_access"), resource }).allowed).toBe(entry.operator);
      expect(resolver.authorize({ workspaceId: "glw-led-display-warehouse", moduleId: "gmp.publishing", subject: admin, action: createActionReference(entry.id, "route_access"), resource }).allowed).toBe(entry.admin);
    }

    const unknown = resolver.authorize({
      workspaceId: "glw-led-display-warehouse",
      moduleId: "gmp.publishing",
      subject: operator,
      action: createActionReference("gmp:publishing:unknown_action", "route_access"),
      resource: { workspaceId: "glw-led-display-warehouse", moduleId: "gmp.publishing", route: "/unknown" },
    });
    expect(unknown.allowed).toBe(false);
    expect(unknown.reasonCode).toBe("DENIED_DEFAULT");

    const crossWorkspace = resolver.authorize({
      workspaceId: "other-workspace",
      moduleId: "gmp.publishing",
      subject: operator,
      action: createActionReference("gmp:publishing:view_destinations", "route_access"),
      resource: { workspaceId: "other-workspace", moduleId: "gmp.publishing", route: "/workspace" },
    });
    expect(crossWorkspace.allowed).toBe(false);
    expect(crossWorkspace.reasonCode).toBe("DENIED_WORKSPACE");

    const crossOwned = resolver.authorize({
      workspaceId: "glw-led-display-warehouse",
      moduleId: "gmp.publishing",
      subject: viewer,
      action: createActionReference("gmp:publishing:view_destinations", "route_access"),
      resource: { workspaceId: "glw-led-display-warehouse", moduleId: "gmp.publishing", route: "/owned", ownerActorId: "someone-else@example.com" },
    });
    expect(crossOwned.allowed).toBe(false);
    expect(crossOwned.reasonCode).toBe("DENIED_OWNERSHIP");
  });

  it("covers endpoint authentication, authorization, isolation, and success paths", async () => {
    const { primary, foreign, deps } = await seedDualWorkspaceContext();

    const adminDeps = { sessionLoader: adminSessionLoader, ...deps };
    const viewerDeps = { sessionLoader: viewerSessionLoader, ...deps };

    const endpoints = {
      getDestination: () => handleGetDestination(makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}`), primary.destination.destinationId, adminDeps),
      patchDestination: () => handlePatchDestination(makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Updated", baseUrl: primary.destination.baseUrl, environment: primary.destination.environment, capabilityProfile: primary.destination.capabilityProfile, configuration: primary.destination.configuration }) }), primary.destination.destinationId, adminDeps),
      validateDestination: () => handleValidateDestination(makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}/validate`, { method: "POST" }), primary.destination.destinationId, adminDeps),
      getCapabilities: () => handleGetDestinationCapabilities(makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}/capabilities`), primary.destination.destinationId, adminDeps),
      getHealth: () => handleGetDestinationHealth(makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}/health`), primary.destination.destinationId, adminDeps),
      retryPublication: () => handleRetryPublication(makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/retry`, { method: "POST" }), primary.publicationId, adminDeps),
      rollbackPublication: () => handleRollbackPublication(makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/rollback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rollbackTargetRevisionId: "rev_1" }) }), primary.publicationId, adminDeps),
      verifyPublication: () => handleVerifyPublication(makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/verify`, { method: "POST" }), primary.publicationId, adminDeps),
      reconcilePublication: () => handleReconcilePublication(makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/reconcile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolutionAction: "accept_remote" }) }), primary.publicationId, adminDeps),
      forceOverwrite: () => handleReconcilePublication(makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/reconcile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolutionAction: "force_republish" }) }), primary.publicationId, adminDeps),
      retryRelease: () => handleRetryRelease(makeRequest(`/api/gmp/publishing/releases/${primary.releaseId}/retry`, { method: "POST" }), primary.releaseId, adminDeps),
      getPublicationHistory: () => handleGetPublicationHistory(makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/history`), primary.publicationId, adminDeps),
      getReconciliation: () => handleGetReconciliation(makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/reconcile`), primary.publicationId, adminDeps),
      getPublication: () => handleGetPublication(makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}`), primary.publicationId, adminDeps),
      listProjectHistory: () => handleListProjectPublications(makeRequest(`/api/gmp/projects/${primary.project.projectId}/publishing/publications`), primary.project.projectId, adminDeps),
    };

    expect((await endpoints.getDestination()).status).toBe(200);
    expect((await endpoints.validateDestination()).status).toBe(201);
    expect((await endpoints.getCapabilities()).status).toBe(200);
    expect((await endpoints.getHealth()).status).toBe(200);
    expect((await endpoints.patchDestination()).status).toBe(200);
    expect((await endpoints.retryPublication()).status).toBe(201);
    expect((await endpoints.rollbackPublication()).status).toBe(201);
    expect((await endpoints.verifyPublication()).status).toBe(201);
    expect((await endpoints.reconcilePublication()).status).toBe(201);
    expect((await endpoints.forceOverwrite()).status).toBe(201);
    expect((await endpoints.retryRelease()).status).toBe(201);
    expect((await endpoints.getPublicationHistory()).status).toBe(200);
    expect((await endpoints.getReconciliation()).status).toBe(200);
    expect((await endpoints.getPublication()).status).toBe(200);
    expect((await endpoints.listProjectHistory()).status).toBe(200);

    const unauthorized = await handleGetDestination(
      makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}`),
      primary.destination.destinationId,
      { ...deps, sessionLoader: unauthorizedSessionLoader },
    );
    expect(unauthorized.status).toBe(401);

    const viewerReadDetail = await handleGetDestination(
      makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}`),
      primary.destination.destinationId,
      viewerDeps,
    );
    expect(viewerReadDetail.status).toBe(200);

    const viewerReadHistory = await handleGetPublicationHistory(
      makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/history`),
      primary.publicationId,
      viewerDeps,
    );
    expect(viewerReadHistory.status).toBe(200);

    const viewerPatchDenied = await handlePatchDestination(
      makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "x" }) }),
      primary.destination.destinationId,
      viewerDeps,
    );
    expect(viewerPatchDenied.status).toBe(403);

    const viewerValidateDenied = await handleValidateDestination(
      makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}/validate`, { method: "POST" }),
      primary.destination.destinationId,
      viewerDeps,
    );
    expect(viewerValidateDenied.status).toBe(403);

    const viewerRetryDenied = await handleRetryPublication(
      makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/retry`, { method: "POST" }),
      primary.publicationId,
      viewerDeps,
    );
    expect(viewerRetryDenied.status).toBe(403);

    const viewerRollbackDenied = await handleRollbackPublication(
      makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/rollback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rollbackTargetRevisionId: "rev_1" }) }),
      primary.publicationId,
      viewerDeps,
    );
    expect(viewerRollbackDenied.status).toBe(403);

    const viewerVerifyDenied = await handleVerifyPublication(
      makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/verify`, { method: "POST" }),
      primary.publicationId,
      viewerDeps,
    );
    expect(viewerVerifyDenied.status).toBe(403);

    const viewerReconcileDenied = await handleReconcilePublication(
      makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/reconcile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolutionAction: "accept_remote" }) }),
      primary.publicationId,
      viewerDeps,
    );
    expect(viewerReconcileDenied.status).toBe(403);

    const viewerForceDenied = await handleReconcilePublication(
      makeRequest(`/api/gmp/publishing/publications/${primary.publicationId}/reconcile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolutionAction: "force_republish" }) }),
      primary.publicationId,
      viewerDeps,
    );
    expect(viewerForceDenied.status).toBe(403);

    const viewerReleaseRetryDenied = await handleRetryRelease(
      makeRequest(`/api/gmp/publishing/releases/${primary.releaseId}/retry`, { method: "POST" }),
      primary.releaseId,
      viewerDeps,
    );
    expect(viewerReleaseRetryDenied.status).toBe(403);

    const crossWorkspaceDenied = await handleGetDestination(
      makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}?workspaceId=other-workspace`),
      primary.destination.destinationId,
      adminDeps,
    );
    expect(crossWorkspaceDenied.status).toBe(403);

    const crossProjectIsolation = await handleGetDestination(
      makeRequest(`/api/gmp/publishing/destinations/${foreign.destination.destinationId}`),
      foreign.destination.destinationId,
      adminDeps,
    );
    expect(crossProjectIsolation.status).toBe(404);

    const crossDestinationIsolation = await handleGetDestinationHealth(
      makeRequest(`/api/gmp/publishing/destinations/${foreign.destination.destinationId}/health`),
      foreign.destination.destinationId,
      adminDeps,
    );
    expect(crossDestinationIsolation.status).toBe(404);

    const crossPublicationIsolation = await handleGetPublication(
      makeRequest(`/api/gmp/publishing/publications/${foreign.publicationId}`),
      foreign.publicationId,
      adminDeps,
    );
    expect(crossPublicationIsolation.status).toBe(404);

    const unseededDestination = await handleGetDestination(
      makeRequest("/api/gmp/publishing/destinations/destination_unseeded"),
      "destination_unseeded",
      adminDeps,
    );
    expect(unseededDestination.status).toBe(404);

    const invalidRelease = await handleRetryRelease(
      makeRequest("/api/gmp/publishing/releases/release_missing/retry", { method: "POST" }),
      "release_missing",
      adminDeps,
    );
    expect(invalidRelease.status).toBe(404);

    const invalidPublication = await handleGetPublication(
      makeRequest("/api/gmp/publishing/publications/publication_missing"),
      "publication_missing",
      adminDeps,
    );
    expect(invalidPublication.status).toBe(404);

    const validationResponse = await handleValidateDestination(
      makeRequest(`/api/gmp/publishing/destinations/${primary.destination.destinationId}/validate`, { method: "POST" }),
      primary.destination.destinationId,
      adminDeps,
    );
    const validationBody = await validationResponse.json() as { validation?: { blockingIssues?: string[]; warnings?: string[] } };
    const serialized = JSON.stringify(validationBody);
    expect(serialized).not.toContain("applicationPassword");
    expect(serialized).not.toContain("Authorization");
  });

  it("retains approved package and release operations for approver/admin role", async () => {
    const projectRepository = createInMemoryGmpRepository();
    const pageRepository = createInMemoryGmpPageRepository();
    const contentRepository = createInMemoryGmpContentRepository();
    const publishingRepository = createInMemoryGmpPublishingRepository();
    const publishingServices = createGmpPublishingServices({ projectRepository, pageRepository, contentRepository, publishingRepository });

    const fixture = await seedProjectFixture({
      workspaceId: "glw-led-display-warehouse",
      ownerActorId: "admin@example.com",
      slug: "approval",
      services: publishingServices,
      projectRepository,
      pageRepository,
      contentRepository,
      publishingRepository,
    });

    const deps = { sessionLoader: adminSessionLoader, projectRepository, pageRepository, contentRepository, publishingRepository, publishingServices };

    const release = await handleCreateRelease(
      makeRequest(`/api/gmp/projects/${fixture.project.projectId}/publishing/releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: fixture.site.siteId, releaseName: "Approval Flow", releaseType: "SINGLE_PACKAGE" }),
      }),
      fixture.project.projectId,
      deps,
    );
    expect(release.status).toBe(201);

    const releaseId = (await release.json() as { release: { releaseId: string } }).release.releaseId;
    await publishingServices.addPackageToRelease({ releaseId, publishingPackageId: fixture.packageId, destinationId: fixture.destination.destinationId, sequence: 1 });
    await publishingServices.submitRelease(releaseId);

    const approveRelease = await handleApproveRelease(
      makeRequest(`/api/gmp/publishing/releases/${releaseId}/approve`, { method: "POST" }),
      releaseId,
      deps,
    );
    expect(approveRelease.status).toBe(201);

    const executeRelease = await handleExecuteRelease(
      makeRequest(`/api/gmp/publishing/releases/${releaseId}/execute`, { method: "POST" }),
      releaseId,
      deps,
    );
    expect(executeRelease.status).toBe(201);

    const approvePackage = await handleApprovePublishingPackage(
      makeRequest(`/api/gmp/publishing/packages/${fixture.packageId}/approve`, { method: "POST" }),
      fixture.packageId,
      deps,
    );
    expect([201, 409]).toContain(approvePackage.status);
  });
});
