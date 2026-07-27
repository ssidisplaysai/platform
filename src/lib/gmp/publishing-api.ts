import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { createPrismaGmpRepository, type GmpRepository } from "./repository";
import { createPrismaGmpPageRepository, type GmpPageRepository } from "./page-repository";
import { createPrismaGmpContentRepository, type GmpContentRepository } from "./content-repository";
import { createPrismaGmpPublishingRepository, type GmpPublishingRepository } from "./publishing-repository";
import { createGmpPublishingServices, type GmpPublishingServices } from "./publishing-services";
import { createWordpressDestinationAdapter, type GmpDestinationAdapter } from "./publishing-adapters";
import { createWordpressTransport } from "./publishing-wordpress-transport";
import { createEnvironmentDestinationCredentialProvider, type GmpDestinationCredentialProvider } from "./publishing-credentials";

const DEFAULT_WORKSPACE_ID = "glw-led-display-warehouse";
const DEFAULT_MODULE_ID = "gmp.publishing";

type PublishingAction =
  | "gmp:publishing:view_packages"
  | "gmp:publishing:create_package"
  | "gmp:publishing:build_package"
  | "gmp:publishing:validate_package"
  | "gmp:publishing:submit_package"
  | "gmp:publishing:approve_package"
  | "gmp:publishing:reject_package"
  | "gmp:publishing:view_destinations"
  | "gmp:publishing:manage_destinations"
  | "gmp:publishing:validate_destination"
  | "gmp:publishing:create_release"
  | "gmp:publishing:modify_release"
  | "gmp:publishing:submit_release"
  | "gmp:publishing:approve_release"
  | "gmp:publishing:reject_release"
  | "gmp:publishing:schedule_release"
  | "gmp:publishing:execute_release"
  | "gmp:publishing:cancel_release"
  | "gmp:publishing:retry_publication"
  | "gmp:publishing:verify_publication"
  | "gmp:publishing:reconcile_publication"
  | "gmp:publishing:create_rollback"
  | "gmp:publishing:approve_rollback"
  | "gmp:publishing:execute_rollback"
  | "gmp:publishing:view_history"
  | "gmp:publishing:archive_publication"
  | "gmp:publishing:force_overwrite";

export type GmpPublishingApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  projectRepository?: GmpRepository;
  pageRepository?: GmpPageRepository;
  contentRepository?: GmpContentRepository;
  publishingRepository?: GmpPublishingRepository;
  publishingServices?: GmpPublishingServices;
  wordpressAdapter?: GmpDestinationAdapter;
  credentialProvider?: GmpDestinationCredentialProvider;
};

function deps(input?: GmpPublishingApiDependencies): Required<GmpPublishingApiDependencies> {
  const projectRepository = input?.projectRepository ?? createPrismaGmpRepository();
  const pageRepository = input?.pageRepository ?? createPrismaGmpPageRepository();
  const contentRepository = input?.contentRepository ?? createPrismaGmpContentRepository();
  const publishingRepository = input?.publishingRepository ?? createPrismaGmpPublishingRepository();
  const credentialProvider = input?.credentialProvider ?? createEnvironmentDestinationCredentialProvider();
  const wordpressAdapter = input?.wordpressAdapter ?? createWordpressDestinationAdapter(createWordpressTransport({ credentialProvider }));

  return {
    sessionLoader: input?.sessionLoader ?? getGlwSession,
    projectRepository,
    pageRepository,
    contentRepository,
    publishingRepository,
    publishingServices: input?.publishingServices ?? createGmpPublishingServices({
      projectRepository,
      pageRepository,
      contentRepository,
      publishingRepository,
      wordpressAdapter,
    }),
    wordpressAdapter,
    credentialProvider,
  };
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

function workspaceFromUrl(url: URL): string {
  return url.searchParams.get("workspaceId") ?? DEFAULT_WORKSPACE_ID;
}

type PublishingAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

async function authorize(input: { actionId: PublishingAction; workspaceId: string; route: string; dependencies?: GmpPublishingApiDependencies }): Promise<PublishingAuthorizeResult> {
  const d = deps(input.dependencies);
  const session = await d.sessionLoader();
  if (!session) return { error: json({ error: "GLW session is required." }, 401) } as const;

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: input.workspaceId,
    moduleId: DEFAULT_MODULE_ID,
    action: createActionReference(input.actionId, "route_access"),
    resource: { workspaceId: input.workspaceId, moduleId: DEFAULT_MODULE_ID, route: input.route },
  });

  if (!decision.allowed) return { error: json({ error: decision.reason }, 403) } as const;
  return { subject } as const;
}

async function ensureProject(projectId: string, workspaceId: string, dependencies?: GmpPublishingApiDependencies) {
  const project = await deps(dependencies).projectRepository.getProjectById(projectId);
  if (!project || project.workspaceId !== workspaceId) return null;
  return project;
}

async function ensurePage(pageId: string, workspaceId: string, dependencies?: GmpPublishingApiDependencies) {
  const d = deps(dependencies);
  const page = await d.pageRepository.getPageById(pageId);
  if (!page) return null;
  const project = await ensureProject(page.projectId, workspaceId, dependencies);
  return project ? page : null;
}

export async function handleGetPublishingEligibility(request: Request, draftId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_packages", workspaceId, route: "/api/gmp/content/drafts/[draftId]/publishing-eligibility", dependencies });
  if ("error" in access) return access.error;
  const destinationId = new URL(request.url).searchParams.get("destinationId") ?? undefined;
  const eligibility = await deps(dependencies).publishingServices.evaluateEligibility({ contentDraftId: draftId, destinationId });
  if (!eligibility) return json({ error: "Draft not found." }, 404);
  return json({ eligibility });
}

export async function handleListPublishingPackages(request: Request, pageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_packages", workspaceId, route: "/api/gmp/pages/[pageId]/publishing/packages", dependencies });
  if ("error" in access) return access.error;
  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);
  const packages = await deps(dependencies).publishingServices.listPackagesForPage(page.pageId);
  return json({ packages });
}

export async function handleCreatePublishingPackage(request: Request, pageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:create_package", workspaceId, route: "/api/gmp/pages/[pageId]/publishing/packages", dependencies });
  if ("error" in access) return access.error;
  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.contentDraftId !== "string" || typeof body.destinationId !== "string") {
    return json({ error: "contentDraftId and destinationId are required." }, 400);
  }

  const built = await deps(dependencies).publishingServices.buildPackageFromDraft({
    contentDraftId: body.contentDraftId,
    destinationId: body.destinationId,
    actorId: access.subject.actorId,
    publicationMode: typeof body.publicationMode === "string" ? body.publicationMode : "PUBLISH_NOW",
    schedule: typeof body.schedule === "object" && body.schedule !== null ? body.schedule as Record<string, unknown> : undefined,
  });

  return json(built, 201);
}

export async function handleGetPublishingPackage(request: Request, packageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_packages", workspaceId, route: "/api/gmp/publishing/packages/[packageId]", dependencies });
  if ("error" in access) return access.error;
  const pkg = await deps(dependencies).publishingRepository.getPackageById(packageId);
  if (!pkg) return json({ error: "Package not found." }, 404);
  const project = await ensureProject(pkg.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Package not found." }, 404);
  const [manifest, validation] = await Promise.all([
    deps(dependencies).publishingRepository.getManifestByPackageId(packageId),
    deps(dependencies).publishingRepository.getLatestValidation(packageId),
  ]);
  return json({ package: pkg, manifest, validation });
}

export async function handlePatchPublishingPackage(request: Request, packageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:create_package", workspaceId, route: "/api/gmp/publishing/packages/[packageId]", dependencies });
  if ("error" in access) return access.error;
  const pkg = await deps(dependencies).publishingRepository.getPackageById(packageId);
  if (!pkg) return json({ error: "Package not found." }, 404);
  const project = await ensureProject(pkg.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Package not found." }, 404);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Request body must be valid JSON." }, 400);

  const updated = await deps(dependencies).publishingRepository.updatePackage(packageId, {
    targetSlug: typeof body.targetSlug === "string" ? body.targetSlug : undefined,
    canonicalUrl: typeof body.canonicalUrl === "string" ? body.canonicalUrl : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  });

  return json({ package: updated });
}

export async function handleBuildPublishingPackage(request: Request, packageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:build_package", workspaceId, route: "/api/gmp/publishing/packages/[packageId]/build", dependencies });
  if ("error" in access) return access.error;
  const pkg = await deps(dependencies).publishingRepository.getPackageById(packageId);
  if (!pkg) return json({ error: "Package not found." }, 404);
  const rebuilt = await deps(dependencies).publishingServices.buildPackageFromDraft({ contentDraftId: pkg.contentDraftId, destinationId: pkg.destinationId, actorId: access.subject.actorId });
  return json(rebuilt, 201);
}

export async function handleValidatePublishingPackage(request: Request, packageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:validate_package", workspaceId, route: "/api/gmp/publishing/packages/[packageId]/validate", dependencies });
  if ("error" in access) return access.error;
  const validation = await deps(dependencies).publishingServices.validatePackage(packageId);
  if (!validation) return json({ error: "Package not found." }, 404);
  return json({ validation }, 201);
}

export async function handleSubmitPublishingPackage(request: Request, packageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:submit_package", workspaceId, route: "/api/gmp/publishing/packages/[packageId]/submit", dependencies });
  if ("error" in access) return access.error;
  const updated = await deps(dependencies).publishingServices.submitPackage(packageId, access.subject.actorId);
  if (!updated) return json({ error: "Package cannot be submitted from current status." }, 409);
  return json({ package: updated }, 201);
}

export async function handleApprovePublishingPackage(request: Request, packageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:approve_package", workspaceId, route: "/api/gmp/publishing/packages/[packageId]/approve", dependencies });
  if ("error" in access) return access.error;
  const updated = await deps(dependencies).publishingServices.approvePackage(packageId, access.subject.actorId);
  if (!updated) return json({ error: "Package cannot be approved." }, 409);
  return json({ package: updated }, 201);
}

export async function handleRejectPublishingPackage(request: Request, packageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:reject_package", workspaceId, route: "/api/gmp/publishing/packages/[packageId]/reject", dependencies });
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const updated = await deps(dependencies).publishingServices.rejectPackage(packageId, access.subject.actorId, typeof body.reason === "string" ? body.reason : undefined);
  if (!updated) return json({ error: "Package cannot be rejected." }, 409);
  return json({ package: updated }, 201);
}

export async function handleGetPublishingManifest(request: Request, packageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_packages", workspaceId, route: "/api/gmp/publishing/packages/[packageId]/manifest", dependencies });
  if ("error" in access) return access.error;
  const pkg = await deps(dependencies).publishingRepository.getPackageById(packageId);
  if (!pkg) return json({ error: "Package not found." }, 404);
  const manifest = await deps(dependencies).publishingRepository.getManifestByPackageId(packageId);
  return json({ manifest });
}

export async function handleListDestinations(request: Request, projectId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_destinations", workspaceId, route: "/api/gmp/projects/[id]/publishing/destinations", dependencies });
  if ("error" in access) return access.error;
  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);
  const destinations = await deps(dependencies).publishingServices.listDestinationsForProject(projectId);
  return json({ destinations });
}

export async function handleCreateDestination(request: Request, projectId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:manage_destinations", workspaceId, route: "/api/gmp/projects/[id]/publishing/destinations", dependencies });
  if ("error" in access) return access.error;
  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.siteId !== "string" || typeof body.name !== "string" || typeof body.baseUrl !== "string" || typeof body.destinationType !== "string") {
    return json({ error: "siteId, name, baseUrl, and destinationType are required." }, 400);
  }

  const destination = await deps(dependencies).publishingServices.createDestination({
    projectId,
    siteId: body.siteId,
    destinationType: String(body.destinationType) as never,
    name: body.name,
    baseUrl: body.baseUrl,
    environment: typeof body.environment === "string" ? body.environment : "production",
    connectionStatus: typeof body.connectionStatus === "string" ? body.connectionStatus : "HEALTHY",
    credentialReference: typeof body.credentialReference === "string" ? body.credentialReference : undefined,
    configuration: typeof body.configuration === "object" && body.configuration !== null ? body.configuration as Record<string, unknown> : undefined,
    defaultAuthor: typeof body.defaultAuthor === "string" ? body.defaultAuthor : undefined,
    defaultStatus: typeof body.defaultStatus === "string" ? body.defaultStatus : "draft",
    defaultTaxonomyMapping: typeof body.defaultTaxonomyMapping === "object" && body.defaultTaxonomyMapping !== null ? body.defaultTaxonomyMapping as Record<string, unknown> : undefined,
    defaultMediaPolicy: typeof body.defaultMediaPolicy === "object" && body.defaultMediaPolicy !== null ? body.defaultMediaPolicy as Record<string, unknown> : undefined,
    defaultSeoPolicy: typeof body.defaultSeoPolicy === "object" && body.defaultSeoPolicy !== null ? body.defaultSeoPolicy as Record<string, unknown> : undefined,
    webhookConfiguration: typeof body.webhookConfiguration === "object" && body.webhookConfiguration !== null ? body.webhookConfiguration as Record<string, unknown> : undefined,
    metadata: {},
    lastValidatedAt: null,
    lastSuccessfulPublishAt: null,
    lastFailureAt: null,
    capabilityProfile: typeof body.capabilityProfile === "object" && body.capabilityProfile !== null ? body.capabilityProfile as Record<string, boolean> : undefined,
  });

  return json({ destination }, 201);
}

export async function handleValidateDestination(request: Request, destinationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:validate_destination", workspaceId, route: "/api/gmp/publishing/destinations/[destinationId]/validate", dependencies });
  if ("error" in access) return access.error;
  const result = await deps(dependencies).publishingServices.validateDestination(destinationId);
  if (!result) return json({ error: "Destination not found." }, 404);
  return json({ validation: result }, 201);
}

export async function handleGetDestination(request: Request, destinationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_destinations", workspaceId, route: "/api/gmp/publishing/destinations/[destinationId]", dependencies });
  if ("error" in access) return access.error;

  const detail = await deps(dependencies).publishingServices.getDestinationDetail(destinationId);
  if (!detail) return json({ error: "Destination not found." }, 404);
  const destination = detail.destination as { projectId: string };
  const project = await ensureProject(destination.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Destination not found." }, 404);
  return json(detail);
}

export async function handlePatchDestination(request: Request, destinationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:manage_destinations", workspaceId, route: "/api/gmp/publishing/destinations/[destinationId]", dependencies });
  if ("error" in access) return access.error;

  const existing = await deps(dependencies).publishingServices.getDestinationById(destinationId);
  if (!existing) return json({ error: "Destination not found." }, 404);
  const project = await ensureProject(existing.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Destination not found." }, 404);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Request body must be valid JSON." }, 400);

  const updated = await deps(dependencies).publishingServices.updateDestination(destinationId, {
    name: typeof body.name === "string" ? body.name : undefined,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
    environment: typeof body.environment === "string" ? body.environment : undefined,
    connectionStatus: typeof body.connectionStatus === "string" ? body.connectionStatus : undefined,
    credentialReference: typeof body.credentialReference === "string" ? body.credentialReference : undefined,
    configuration: typeof body.configuration === "object" && body.configuration !== null ? body.configuration as Record<string, unknown> : undefined,
    capabilityProfile: typeof body.capabilityProfile === "object" && body.capabilityProfile !== null ? body.capabilityProfile as Record<string, boolean> : undefined,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  });

  return json({ destination: updated });
}

export async function handleGetDestinationCapabilities(request: Request, destinationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_destinations", workspaceId, route: "/api/gmp/publishing/destinations/[destinationId]/capabilities", dependencies });
  if ("error" in access) return access.error;

  const destination = await deps(dependencies).publishingServices.getDestinationById(destinationId);
  if (!destination) return json({ error: "Destination not found." }, 404);
  const project = await ensureProject(destination.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Destination not found." }, 404);

  const capabilities = await deps(dependencies).publishingServices.getDestinationCapabilities(destinationId);
  return json({ destinationId, destinationType: destination.destinationType, capabilities, modelVersion: "gmp-destination-capabilities/v1" });
}

export async function handleGetDestinationHealth(request: Request, destinationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:validate_destination", workspaceId, route: "/api/gmp/publishing/destinations/[destinationId]/health", dependencies });
  if ("error" in access) return access.error;

  const destination = await deps(dependencies).publishingServices.getDestinationById(destinationId);
  if (!destination) return json({ error: "Destination not found." }, 404);
  const project = await ensureProject(destination.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Destination not found." }, 404);

  const health = await deps(dependencies).publishingServices.getDestinationHealth(destinationId);
  return json({ health });
}

export async function handleTestDestinationReadAccess(request: Request, destinationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:validate_destination", workspaceId, route: "/api/gmp/publishing/destinations/[destinationId]/test-read", dependencies });
  if ("error" in access) return access.error;

  const destination = await deps(dependencies).publishingServices.getDestinationById(destinationId);
  if (!destination) return json({ error: "Destination not found." }, 404);
  const project = await ensureProject(destination.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Destination not found." }, 404);

  const result = await deps(dependencies).publishingServices.testDestinationReadAccess(destinationId);
  return json({ result }, 201);
}

export async function handleTestDestinationWriteCapability(request: Request, destinationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:manage_destinations", workspaceId, route: "/api/gmp/publishing/destinations/[destinationId]/test-write", dependencies });
  if ("error" in access) return access.error;

  const destination = await deps(dependencies).publishingServices.getDestinationById(destinationId);
  if (!destination) return json({ error: "Destination not found." }, 404);
  const project = await ensureProject(destination.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Destination not found." }, 404);

  const result = await deps(dependencies).publishingServices.testDestinationWriteCapability(destinationId);
  return json({ result }, 201);
}

export async function handleInvalidateDestinationCredentialCache(request: Request, destinationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:manage_destinations", workspaceId, route: "/api/gmp/publishing/destinations/[destinationId]/credentials/invalidate", dependencies });
  if ("error" in access) return access.error;

  const destination = await deps(dependencies).publishingServices.getDestinationById(destinationId);
  if (!destination) return json({ error: "Destination not found." }, 404);
  const project = await ensureProject(destination.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Destination not found." }, 404);

  deps(dependencies).credentialProvider.invalidateDestinationCredentialCache(destination.credentialReference);
  return json({ invalidated: true, destinationId, scope: destination.credentialReference ?? "global" }, 201);
}

export async function handleListReleases(request: Request, projectId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:create_release", workspaceId, route: "/api/gmp/projects/[id]/publishing/releases", dependencies });
  if ("error" in access) return access.error;
  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);
  const releases = await deps(dependencies).publishingServices.listReleasesForProject(projectId);
  return json({ releases });
}

export async function handleCreateRelease(request: Request, projectId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:create_release", workspaceId, route: "/api/gmp/projects/[id]/publishing/releases", dependencies });
  if ("error" in access) return access.error;
  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.siteId !== "string" || typeof body.releaseName !== "string" || typeof body.releaseType !== "string") {
    return json({ error: "siteId, releaseName, and releaseType are required." }, 400);
  }

  const release = await deps(dependencies).publishingServices.createRelease({
    projectId,
    siteId: body.siteId,
    releaseName: body.releaseName,
    releaseType: String(body.releaseType) as never,
    requestedBy: access.subject.actorId,
    scheduledAt: typeof body.scheduledAt === "string" ? body.scheduledAt : null,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : undefined,
  });

  return json({ release }, 201);
}

export async function handleGetRelease(request: Request, releaseId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:create_release", workspaceId, route: "/api/gmp/publishing/releases/[releaseId]", dependencies });
  if ("error" in access) return access.error;

  const release = await deps(dependencies).publishingRepository.getReleaseById(releaseId);
  if (!release) return json({ error: "Release not found." }, 404);
  const project = await ensureProject(release.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Release not found." }, 404);
  const items = await deps(dependencies).publishingRepository.listReleaseItems(releaseId);
  return json({ release, items });
}

export async function handleAddReleaseItem(request: Request, releaseId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:modify_release", workspaceId, route: "/api/gmp/publishing/releases/[releaseId]/items", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.publishingPackageId !== "string" || typeof body.destinationId !== "string") {
    return json({ error: "publishingPackageId and destinationId are required." }, 400);
  }

  const item = await deps(dependencies).publishingServices.addPackageToRelease({
    releaseId,
    publishingPackageId: body.publishingPackageId,
    destinationId: body.destinationId,
    sequence: typeof body.sequence === "number" ? body.sequence : 1,
    dependencyReferences: Array.isArray(body.dependencyReferences) ? body.dependencyReferences.map(String) : [],
  });
  if (!item) return json({ error: "Release item could not be created." }, 409);
  return json({ item }, 201);
}

export async function handleValidateRelease(request: Request, releaseId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:submit_release", workspaceId, route: "/api/gmp/publishing/releases/[releaseId]/validate", dependencies });
  if ("error" in access) return access.error;
  const validation = await deps(dependencies).publishingServices.validateRelease(releaseId);
  if (!validation) return json({ error: "Release not found." }, 404);
  return json({ validation }, 201);
}

export async function handleSubmitRelease(request: Request, releaseId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:submit_release", workspaceId, route: "/api/gmp/publishing/releases/[releaseId]/submit", dependencies });
  if ("error" in access) return access.error;
  const updated = await deps(dependencies).publishingServices.submitRelease(releaseId);
  if (!updated) return json({ error: "Release cannot be submitted." }, 409);
  return json({ release: updated }, 201);
}

export async function handleApproveRelease(request: Request, releaseId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:approve_release", workspaceId, route: "/api/gmp/publishing/releases/[releaseId]/approve", dependencies });
  if ("error" in access) return access.error;
  const updated = await deps(dependencies).publishingServices.approveRelease(releaseId, access.subject.actorId);
  if (!updated) return json({ error: "Release cannot be approved." }, 409);
  return json({ release: updated }, 201);
}

export async function handleRejectRelease(request: Request, releaseId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:reject_release", workspaceId, route: "/api/gmp/publishing/releases/[releaseId]/reject", dependencies });
  if ("error" in access) return access.error;
  const updated = await deps(dependencies).publishingServices.rejectRelease(releaseId);
  if (!updated) return json({ error: "Release cannot be rejected." }, 409);
  return json({ release: updated }, 201);
}

export async function handleExecuteRelease(request: Request, releaseId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:execute_release", workspaceId, route: "/api/gmp/publishing/releases/[releaseId]/execute", dependencies });
  if ("error" in access) return access.error;
  const result = await deps(dependencies).publishingServices.executeRelease(releaseId, access.subject.actorId);
  return json(result, 201);
}

export async function handleGetReleaseDependencyPlan(request: Request, releaseId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:create_release", workspaceId, route: "/api/gmp/publishing/releases/[releaseId]/dependency-plan", dependencies });
  if ("error" in access) return access.error;

  const release = await deps(dependencies).publishingRepository.getReleaseById(releaseId);
  if (!release) return json({ error: "Release not found." }, 404);
  const project = await ensureProject(release.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Release not found." }, 404);

  const plan = await deps(dependencies).publishingServices.getReleaseDependencyPlan(releaseId);
  return json({ plan });
}

export async function handleGetReleaseProgress(request: Request, releaseId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:create_release", workspaceId, route: "/api/gmp/publishing/releases/[releaseId]/progress", dependencies });
  if ("error" in access) return access.error;

  const release = await deps(dependencies).publishingRepository.getReleaseById(releaseId);
  if (!release) return json({ error: "Release not found." }, 404);
  const project = await ensureProject(release.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Release not found." }, 404);

  const progress = await deps(dependencies).publishingServices.getReleaseProgress(releaseId);
  return json({ progress });
}

export async function handleRetryRelease(request: Request, releaseId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:retry_publication", workspaceId, route: "/api/gmp/publishing/releases/[releaseId]/retry", dependencies });
  if ("error" in access) return access.error;

  const release = await deps(dependencies).publishingRepository.getReleaseById(releaseId);
  if (!release) return json({ error: "Release not found." }, 404);
  const project = await ensureProject(release.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Release not found." }, 404);

  const items = await deps(dependencies).publishingRepository.listReleaseItems(releaseId);
  const failedWithRecords = items.filter((entry) => entry.status === "FAILED" && entry.currentPublicationRecordId);
  const retried = [] as Array<Record<string, unknown>>;

  for (const entry of failedWithRecords) {
    const retriedEntry = await deps(dependencies).publishingServices.retryPublication(entry.currentPublicationRecordId as string, access.subject.actorId);
    if (retriedEntry) {
      retried.push({
        releaseItemId: entry.releaseItemId,
        publicationAttemptId: retriedEntry.attempt.publicationAttemptId,
        publicationRecordId: retriedEntry.record?.publicationRecordId,
        status: retriedEntry.attempt.status,
      });
    }
  }

  return json({ retried, retriedCount: retried.length }, 201);
}

export async function handleListPublications(request: Request, pageId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_history", workspaceId, route: "/api/gmp/pages/[pageId]/publications", dependencies });
  if ("error" in access) return access.error;
  const page = await ensurePage(pageId, workspaceId, dependencies);
  if (!page) return json({ error: "Page not found." }, 404);
  const publications = await deps(dependencies).publishingServices.listPublicationsForPage(pageId);
  return json({ publications });
}

export async function handleListProjectPublications(request: Request, projectId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_history", workspaceId, route: "/api/gmp/projects/[id]/publishing/publications", dependencies });
  if ("error" in access) return access.error;
  const project = await ensureProject(projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Project not found." }, 404);
  const publications = await deps(dependencies).publishingServices.listPublicationsForProject(projectId);
  return json({ publications });
}

export async function handleGetPublication(request: Request, publicationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_history", workspaceId, route: "/api/gmp/publishing/publications/[publicationId]", dependencies });
  if ("error" in access) return access.error;
  const publication = await deps(dependencies).publishingRepository.getPublicationRecordById(publicationId);
  if (!publication) return json({ error: "Publication not found." }, 404);
  const project = await ensureProject(publication.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Publication not found." }, 404);
  const [verification, reconciliation] = await Promise.all([
    deps(dependencies).publishingRepository.getLatestVerification(publicationId),
    deps(dependencies).publishingRepository.getLatestReconciliation(publicationId),
  ]);
  return json({ publication, verification, reconciliation });
}

export async function handleVerifyPublication(request: Request, publicationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:verify_publication", workspaceId, route: "/api/gmp/publishing/publications/[publicationId]/verify", dependencies });
  if ("error" in access) return access.error;
  const verification = await deps(dependencies).publishingServices.verifyPublication(publicationId);
  if (!verification) return json({ error: "Publication not found." }, 404);
  return json({ verification }, 201);
}

export async function handleReconcilePublication(request: Request, publicationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const resolutionAction = typeof body?.resolutionAction === "string" ? body.resolutionAction : undefined;
  const actionId = resolutionAction === "force_republish"
    ? "gmp:publishing:force_overwrite"
    : "gmp:publishing:reconcile_publication";

  const access = await authorize({ actionId, workspaceId, route: "/api/gmp/publishing/publications/[publicationId]/reconcile", dependencies });
  if ("error" in access) return access.error;
  const reconciliation = await deps(dependencies).publishingServices.reconcilePublication(publicationId, resolutionAction);
  if (!reconciliation) return json({ error: "Publication not found." }, 404);
  return json({ reconciliation }, 201);
}

export async function handleGetPublicationHistory(request: Request, publicationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_history", workspaceId, route: "/api/gmp/publishing/publications/[publicationId]/history", dependencies });
  if ("error" in access) return access.error;

  const publication = await deps(dependencies).publishingRepository.getPublicationRecordById(publicationId);
  if (!publication) return json({ error: "Publication not found." }, 404);
  const project = await ensureProject(publication.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Publication not found." }, 404);

  const timeline = await deps(dependencies).publishingServices.getPublicationTimeline(publicationId);
  return json({ timeline, modelVersion: "gmp-publication-history/v1" });
}

export async function handleGetReconciliation(request: Request, publicationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:view_history", workspaceId, route: "/api/gmp/publishing/publications/[publicationId]/reconcile", dependencies });
  if ("error" in access) return access.error;

  const publication = await deps(dependencies).publishingRepository.getPublicationRecordById(publicationId);
  if (!publication) return json({ error: "Publication not found." }, 404);
  const project = await ensureProject(publication.projectId, workspaceId, dependencies);
  if (!project) return json({ error: "Publication not found." }, 404);

  const [reconciliation, verification] = await Promise.all([
    deps(dependencies).publishingRepository.getLatestReconciliation(publicationId),
    deps(dependencies).publishingRepository.getLatestVerification(publicationId),
  ]);

  return json({ reconciliation, verification, modelVersion: "gmp-reconciliation-detail/v1" });
}

export async function handleRetryPublication(request: Request, publicationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:retry_publication", workspaceId, route: "/api/gmp/publishing/publications/[publicationId]/retry", dependencies });
  if ("error" in access) return access.error;

  const retry = await deps(dependencies).publishingServices.retryPublication(publicationId, access.subject.actorId);
  if (!retry) return json({ error: "Publication not found or cannot be retried." }, 404);
  return json({ retry }, 201);
}

export async function handleRollbackPublication(request: Request, publicationId: string, dependencies?: GmpPublishingApiDependencies): Promise<NextResponse> {
  const workspaceId = workspaceFromUrl(new URL(request.url));
  const access = await authorize({ actionId: "gmp:publishing:execute_rollback", workspaceId, route: "/api/gmp/publishing/publications/[publicationId]/rollback", dependencies });
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const rollbackTargetRevisionId = typeof body?.rollbackTargetRevisionId === "string" ? body.rollbackTargetRevisionId : undefined;
  const rollback = await deps(dependencies).publishingServices.rollbackPublication(publicationId, access.subject.actorId, rollbackTargetRevisionId);
  if (!rollback) return json({ error: "Publication not found or cannot be rolled back." }, 404);
  return json({ rollback }, 201);
}
