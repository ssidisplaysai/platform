import { randomUUID } from "node:crypto";

export const gmpSiteEnvironments = ["development", "staging", "production"] as const;
export type GmpSiteEnvironment = (typeof gmpSiteEnvironments)[number];

export const gmpPublishingPlatforms = ["wordpress", "shopify", "webflow", "contentful", "headless_cms", "custom_api"] as const;
export type GmpPublishingPlatform = (typeof gmpPublishingPlatforms)[number];

export type GmpProjectMember = {
  actorId: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  addedAt: string;
};

export type GmpProject = {
  projectId: string;
  name: string;
  slug: string;
  description?: string;
  organization?: string;
  workspaceId: string;
  ownerActorId: string;
  members: GmpProjectMember[];
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  lifecycleState: "ONBOARDING" | "LIVE" | "MAINTENANCE" | "SUNSET";
  businessProfileReference?: string;
  businessGenomeReference?: string;
  defaultLanguage: string;
  defaultLocale: string;
  timezone: string;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type GmpSite = {
  siteId: string;
  projectId: string;
  displayName: string;
  primaryDomain: string;
  environment: GmpSiteEnvironment;
  publishingPlatform: GmpPublishingPlatform;
  publishingStatus: "CONNECTED" | "DISCONNECTED" | "DEGRADED";
  authenticationMethod: "oauth2" | "api_key" | "basic" | "token" | "custom";
  connectionStatus: "HEALTHY" | "DEGRADED" | "OFFLINE";
  publishingCapabilities: string[];
  defaultLanguage: string;
  defaultTheme?: string;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type GmpBrandProfile = {
  brandProfileId: string;
  projectId: string;
  companyName: string;
  tagline?: string;
  mission?: string;
  brandVoice?: string;
  writingStyle?: string;
  primaryAudience?: string;
  secondaryAudience?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoReferences: string[];
  typography?: Record<string, unknown>;
  assetReferences: string[];
  socialLinks: Array<{ platform: string; url: string }>;
  contactInformation?: {
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
  };
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type GmpPublishingConnection = {
  connectionId: string;
  siteId: string;
  provider: GmpPublishingPlatform;
  environment: GmpSiteEnvironment;
  publishingStatus: "READY" | "LIMITED" | "DISABLED";
  authenticationMethod: "oauth2" | "api_key" | "basic" | "token" | "custom";
  connectionStatus: "HEALTHY" | "DEGRADED" | "OFFLINE";
  publishingCapabilities: string[];
  configuration?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  version: number;
  lastValidatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type GmpEnvironmentConfiguration = {
  configId: string;
  projectId?: string;
  siteId?: string;
  environment: GmpSiteEnvironment;
  variables: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function slugifyProjectName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function createGmpProject(input: {
  name: string;
  slug?: string;
  description?: string;
  organization?: string;
  workspaceId: string;
  ownerActorId: string;
  defaultLanguage?: string;
  defaultLocale?: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
}): GmpProject {
  const timestamp = nowIso();
  const slug = input.slug?.trim() || slugifyProjectName(input.name);

  return {
    projectId: `gmpprj_${randomUUID()}`,
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || undefined,
    organization: input.organization?.trim() || undefined,
    workspaceId: input.workspaceId,
    ownerActorId: input.ownerActorId,
    members: [
      {
        actorId: input.ownerActorId,
        role: "OWNER",
        addedAt: timestamp,
      },
    ],
    status: "ACTIVE",
    lifecycleState: "ONBOARDING",
    defaultLanguage: input.defaultLanguage ?? "en",
    defaultLocale: input.defaultLocale ?? "en-US",
    timezone: input.timezone ?? "UTC",
    metadata: input.metadata,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
  };
}

export function validateProjectInput(input: Record<string, unknown> | null): { ok: true; value: { name: string; slug?: string; description?: string; organization?: string; defaultLanguage?: string; defaultLocale?: string; timezone?: string; metadata?: Record<string, unknown> } } | { ok: false; error: string } {
  if (!input) {
    return { ok: false, error: "Request body must be valid JSON." };
  }

  if (typeof input.name !== "string" || input.name.trim().length < 2) {
    return { ok: false, error: "Project name is required and must be at least 2 characters." };
  }

  if (input.slug !== undefined && (typeof input.slug !== "string" || input.slug.trim().length < 2)) {
    return { ok: false, error: "Project slug must be at least 2 characters when provided." };
  }

  return {
    ok: true,
    value: {
      name: input.name,
      slug: typeof input.slug === "string" ? input.slug : undefined,
      description: typeof input.description === "string" ? input.description : undefined,
      organization: typeof input.organization === "string" ? input.organization : undefined,
      defaultLanguage: typeof input.defaultLanguage === "string" ? input.defaultLanguage : undefined,
      defaultLocale: typeof input.defaultLocale === "string" ? input.defaultLocale : undefined,
      timezone: typeof input.timezone === "string" ? input.timezone : undefined,
      metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : undefined,
    },
  };
}

export function validateSiteInput(input: Record<string, unknown> | null): { ok: true; value: Omit<GmpSite, "siteId" | "version" | "createdAt" | "updatedAt" | "archivedAt"> } | { ok: false; error: string } {
  if (!input) {
    return { ok: false, error: "Request body must be valid JSON." };
  }

  if (typeof input.projectId !== "string" || input.projectId.trim().length < 2) {
    return { ok: false, error: "projectId is required." };
  }

  if (typeof input.displayName !== "string" || input.displayName.trim().length < 2) {
    return { ok: false, error: "displayName is required." };
  }

  if (typeof input.primaryDomain !== "string" || input.primaryDomain.trim().length < 3) {
    return { ok: false, error: "primaryDomain is required." };
  }

  const environment = String(input.environment ?? "development").toLowerCase() as GmpSiteEnvironment;
  if (!gmpSiteEnvironments.includes(environment)) {
    return { ok: false, error: "environment must be development, staging, or production." };
  }

  const publishingPlatform = String(input.publishingPlatform ?? "wordpress").toLowerCase() as GmpPublishingPlatform;
  if (!gmpPublishingPlatforms.includes(publishingPlatform)) {
    return { ok: false, error: "Unsupported publishing platform." };
  }

  return {
    ok: true,
    value: {
      projectId: input.projectId,
      displayName: input.displayName,
      primaryDomain: input.primaryDomain,
      environment,
      publishingPlatform,
      publishingStatus: (typeof input.publishingStatus === "string" ? input.publishingStatus : "DISCONNECTED") as GmpSite["publishingStatus"],
      authenticationMethod: (typeof input.authenticationMethod === "string" ? input.authenticationMethod : "token") as GmpSite["authenticationMethod"],
      connectionStatus: (typeof input.connectionStatus === "string" ? input.connectionStatus : "OFFLINE") as GmpSite["connectionStatus"],
      publishingCapabilities: Array.isArray(input.publishingCapabilities) ? input.publishingCapabilities.map(String) : ["draft", "publish"],
      defaultLanguage: typeof input.defaultLanguage === "string" ? input.defaultLanguage : "en",
      defaultTheme: typeof input.defaultTheme === "string" ? input.defaultTheme : undefined,
      metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : undefined,
    },
  };
}
