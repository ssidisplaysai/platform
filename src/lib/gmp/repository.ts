import { Prisma, type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  GmpBrandProfile,
  GmpEnvironmentConfiguration,
  GmpProject,
  GmpPublishingConnection,
  GmpSite,
} from "./models";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export type GmpRepository = {
  createProject: (project: GmpProject) => Promise<GmpProject>;
  updateProject: (projectId: string, changes: Partial<GmpProject>) => Promise<GmpProject | null>;
  archiveProject: (projectId: string) => Promise<GmpProject | null>;
  getProjectById: (projectId: string) => Promise<GmpProject | null>;
  getProjectBySlug: (workspaceId: string, slug: string) => Promise<GmpProject | null>;
  listProjects: (workspaceId: string) => Promise<GmpProject[]>;

  createSite: (site: Omit<GmpSite, "siteId" | "version" | "createdAt" | "updatedAt" | "archivedAt">) => Promise<GmpSite>;
  updateSite: (siteId: string, changes: Partial<GmpSite>) => Promise<GmpSite | null>;
  archiveSite: (siteId: string) => Promise<GmpSite | null>;
  getSiteById: (siteId: string) => Promise<GmpSite | null>;
  listSitesForProject: (projectId: string) => Promise<GmpSite[]>;

  upsertBrandProfile: (profile: Omit<GmpBrandProfile, "brandProfileId" | "version" | "createdAt" | "updatedAt"> & { brandProfileId?: string }) => Promise<GmpBrandProfile>;
  getBrandProfileByProjectId: (projectId: string) => Promise<GmpBrandProfile | null>;

  createPublishingConnection: (connection: Omit<GmpPublishingConnection, "connectionId" | "version" | "createdAt" | "updatedAt" | "archivedAt">) => Promise<GmpPublishingConnection>;
  updatePublishingConnection: (connectionId: string, changes: Partial<GmpPublishingConnection>) => Promise<GmpPublishingConnection | null>;
  archivePublishingConnection: (connectionId: string) => Promise<GmpPublishingConnection | null>;
  listPublishingConnectionsForSite: (siteId: string) => Promise<GmpPublishingConnection[]>;

  upsertEnvironmentConfig: (config: Omit<GmpEnvironmentConfiguration, "configId" | "version" | "createdAt" | "updatedAt"> & { configId?: string }) => Promise<GmpEnvironmentConfiguration>;
  listEnvironmentConfigsForProject: (projectId: string) => Promise<GmpEnvironmentConfiguration[]>;
};

function mapProject(row: {
  projectId: string;
  name: string;
  slug: string;
  description: string | null;
  organization: string | null;
  workspaceId: string;
  ownerActorId: string;
  members: unknown;
  status: string;
  lifecycleState: string;
  businessProfileRef: string | null;
  businessGenomeRef: string | null;
  defaultLanguage: string;
  defaultLocale: string;
  timezone: string;
  metadata: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): GmpProject {
  return {
    projectId: row.projectId,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    organization: row.organization ?? undefined,
    workspaceId: row.workspaceId,
    ownerActorId: row.ownerActorId,
    members: (row.members as GmpProject["members"]) ?? [],
    status: row.status as GmpProject["status"],
    lifecycleState: row.lifecycleState as GmpProject["lifecycleState"],
    businessProfileReference: row.businessProfileRef ?? undefined,
    businessGenomeReference: row.businessGenomeRef ?? undefined,
    defaultLanguage: row.defaultLanguage,
    defaultLocale: row.defaultLocale,
    timezone: row.timezone,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: iso(row.archivedAt),
  };
}

function mapSite(row: {
  siteId: string;
  projectId: string;
  displayName: string;
  primaryDomain: string;
  environment: string;
  publishingPlatform: string;
  publishingStatus: string;
  authenticationMethod: string;
  connectionStatus: string;
  publishingCapabilities: unknown;
  defaultLanguage: string;
  defaultTheme: string | null;
  metadata: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): GmpSite {
  return {
    siteId: row.siteId,
    projectId: row.projectId,
    displayName: row.displayName,
    primaryDomain: row.primaryDomain,
    environment: row.environment as GmpSite["environment"],
    publishingPlatform: row.publishingPlatform as GmpSite["publishingPlatform"],
    publishingStatus: row.publishingStatus as GmpSite["publishingStatus"],
    authenticationMethod: row.authenticationMethod as GmpSite["authenticationMethod"],
    connectionStatus: row.connectionStatus as GmpSite["connectionStatus"],
    publishingCapabilities: (row.publishingCapabilities as string[]) ?? [],
    defaultLanguage: row.defaultLanguage,
    defaultTheme: row.defaultTheme ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: iso(row.archivedAt),
  };
}

function mapBrandProfile(row: {
  brandProfileId: string;
  projectId: string;
  companyName: string;
  tagline: string | null;
  mission: string | null;
  brandVoice: string | null;
  writingStyle: string | null;
  primaryAudience: string | null;
  secondaryAudience: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoReferences: unknown;
  typography: unknown;
  assetReferences: unknown;
  socialLinks: unknown;
  contactInformation: unknown;
  metadata: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): GmpBrandProfile {
  return {
    brandProfileId: row.brandProfileId,
    projectId: row.projectId,
    companyName: row.companyName,
    tagline: row.tagline ?? undefined,
    mission: row.mission ?? undefined,
    brandVoice: row.brandVoice ?? undefined,
    writingStyle: row.writingStyle ?? undefined,
    primaryAudience: row.primaryAudience ?? undefined,
    secondaryAudience: row.secondaryAudience ?? undefined,
    primaryColor: row.primaryColor ?? undefined,
    secondaryColor: row.secondaryColor ?? undefined,
    logoReferences: (row.logoReferences as string[]) ?? [],
    typography: (row.typography as Record<string, unknown>) ?? undefined,
    assetReferences: (row.assetReferences as string[]) ?? [],
    socialLinks: (row.socialLinks as Array<{ platform: string; url: string }>) ?? [],
    contactInformation: (row.contactInformation as GmpBrandProfile["contactInformation"]) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapConnection(row: {
  connectionId: string;
  siteId: string;
  provider: string;
  environment: string;
  publishingStatus: string;
  authenticationMethod: string;
  connectionStatus: string;
  publishingCapabilities: unknown;
  configuration: unknown;
  metadata: unknown;
  version: number;
  lastValidatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): GmpPublishingConnection {
  return {
    connectionId: row.connectionId,
    siteId: row.siteId,
    provider: row.provider as GmpPublishingConnection["provider"],
    environment: row.environment as GmpPublishingConnection["environment"],
    publishingStatus: row.publishingStatus as GmpPublishingConnection["publishingStatus"],
    authenticationMethod: row.authenticationMethod as GmpPublishingConnection["authenticationMethod"],
    connectionStatus: row.connectionStatus as GmpPublishingConnection["connectionStatus"],
    publishingCapabilities: (row.publishingCapabilities as string[]) ?? [],
    configuration: (row.configuration as Record<string, unknown>) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    version: row.version,
    lastValidatedAt: iso(row.lastValidatedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: iso(row.archivedAt),
  };
}

function mapEnvironmentConfig(row: {
  configId: string;
  projectId: string | null;
  siteId: string | null;
  environment: string;
  variables: unknown;
  metadata: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): GmpEnvironmentConfiguration {
  return {
    configId: row.configId,
    projectId: row.projectId ?? undefined,
    siteId: row.siteId ?? undefined,
    environment: row.environment as GmpEnvironmentConfiguration["environment"],
    variables: (row.variables as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createPrismaGmpRepository(prisma: PrismaClient = getPrismaClient()): GmpRepository {
  return {
    async createProject(project) {
      const created = await prisma.gmpProject.create({
        data: {
          projectId: project.projectId,
          name: project.name,
          slug: project.slug,
          description: project.description ?? null,
          organization: project.organization ?? null,
          workspaceId: project.workspaceId,
          ownerActorId: project.ownerActorId,
          members: toJsonValue(project.members),
          status: project.status,
          lifecycleState: project.lifecycleState,
          businessProfileRef: project.businessProfileReference ?? null,
          businessGenomeRef: project.businessGenomeReference ?? null,
          defaultLanguage: project.defaultLanguage,
          defaultLocale: project.defaultLocale,
          timezone: project.timezone,
          metadata: project.metadata ? toJsonValue(project.metadata) : Prisma.JsonNull,
          version: project.version,
          archivedAt: project.archivedAt ? new Date(project.archivedAt) : null,
        },
      });

      return mapProject(created);
    },

    async updateProject(projectId, changes) {
      const existing = await prisma.gmpProject.findUnique({ where: { projectId } });
      if (!existing) {
        return null;
      }

      const updated = await prisma.gmpProject.update({
        where: { projectId },
        data: {
          name: changes.name,
          slug: changes.slug,
          description: changes.description === undefined ? undefined : changes.description ?? null,
          organization: changes.organization === undefined ? undefined : changes.organization ?? null,
          members: changes.members ? toJsonValue(changes.members) : undefined,
          status: changes.status,
          lifecycleState: changes.lifecycleState,
          businessProfileRef: changes.businessProfileReference === undefined ? undefined : changes.businessProfileReference ?? null,
          businessGenomeRef: changes.businessGenomeReference === undefined ? undefined : changes.businessGenomeReference ?? null,
          defaultLanguage: changes.defaultLanguage,
          defaultLocale: changes.defaultLocale,
          timezone: changes.timezone,
          metadata: changes.metadata ? toJsonValue(changes.metadata) : changes.metadata === null ? Prisma.JsonNull : undefined,
          archivedAt: changes.archivedAt === undefined ? undefined : changes.archivedAt ? new Date(changes.archivedAt) : null,
          version: existing.version + 1,
        },
      });

      return mapProject(updated);
    },

    async archiveProject(projectId) {
      return this.updateProject(projectId, {
        status: "ARCHIVED",
        lifecycleState: "SUNSET",
        archivedAt: new Date().toISOString(),
      });
    },

    async getProjectById(projectId) {
      const row = await prisma.gmpProject.findUnique({ where: { projectId } });
      return row ? mapProject(row) : null;
    },

    async getProjectBySlug(workspaceId, slug) {
      const row = await prisma.gmpProject.findUnique({ where: { workspaceId_slug: { workspaceId, slug } } });
      return row ? mapProject(row) : null;
    },

    async listProjects(workspaceId) {
      const rows = await prisma.gmpProject.findMany({
        where: { workspaceId },
        orderBy: [{ updatedAt: "desc" }],
      });

      return rows.map(mapProject);
    },

    async createSite(site) {
      const created = await prisma.gmpSite.create({
        data: {
          siteId: `gmpsite_${randomUUID()}`,
          projectId: site.projectId,
          displayName: site.displayName,
          primaryDomain: site.primaryDomain,
          environment: site.environment,
          publishingPlatform: site.publishingPlatform,
          publishingStatus: site.publishingStatus,
          authenticationMethod: site.authenticationMethod,
          connectionStatus: site.connectionStatus,
          publishingCapabilities: toJsonValue(site.publishingCapabilities),
          defaultLanguage: site.defaultLanguage,
          defaultTheme: site.defaultTheme ?? null,
          metadata: site.metadata ? toJsonValue(site.metadata) : Prisma.JsonNull,
        },
      });

      return mapSite(created);
    },

    async updateSite(siteId, changes) {
      const existing = await prisma.gmpSite.findUnique({ where: { siteId } });
      if (!existing) {
        return null;
      }

      const updated = await prisma.gmpSite.update({
        where: { siteId },
        data: {
          displayName: changes.displayName,
          primaryDomain: changes.primaryDomain,
          environment: changes.environment,
          publishingPlatform: changes.publishingPlatform,
          publishingStatus: changes.publishingStatus,
          authenticationMethod: changes.authenticationMethod,
          connectionStatus: changes.connectionStatus,
          publishingCapabilities: changes.publishingCapabilities ? toJsonValue(changes.publishingCapabilities) : undefined,
          defaultLanguage: changes.defaultLanguage,
          defaultTheme: changes.defaultTheme === undefined ? undefined : changes.defaultTheme ?? null,
          metadata: changes.metadata ? toJsonValue(changes.metadata) : changes.metadata === null ? Prisma.JsonNull : undefined,
          archivedAt: changes.archivedAt === undefined ? undefined : changes.archivedAt ? new Date(changes.archivedAt) : null,
          version: existing.version + 1,
        },
      });

      return mapSite(updated);
    },

    async archiveSite(siteId) {
      return this.updateSite(siteId, {
        archivedAt: new Date().toISOString(),
        connectionStatus: "OFFLINE",
      });
    },

    async getSiteById(siteId) {
      const row = await prisma.gmpSite.findUnique({ where: { siteId } });
      return row ? mapSite(row) : null;
    },

    async listSitesForProject(projectId) {
      const rows = await prisma.gmpSite.findMany({
        where: { projectId },
        orderBy: [{ updatedAt: "desc" }],
      });

      return rows.map(mapSite);
    },

    async upsertBrandProfile(profile) {
      const existing = await prisma.gmpBrandProfile.findUnique({ where: { projectId: profile.projectId } });
      if (!existing) {
        const created = await prisma.gmpBrandProfile.create({
          data: {
            brandProfileId: profile.brandProfileId ?? `gmpbrand_${randomUUID()}`,
            projectId: profile.projectId,
            companyName: profile.companyName,
            tagline: profile.tagline ?? null,
            mission: profile.mission ?? null,
            brandVoice: profile.brandVoice ?? null,
            writingStyle: profile.writingStyle ?? null,
            primaryAudience: profile.primaryAudience ?? null,
            secondaryAudience: profile.secondaryAudience ?? null,
            primaryColor: profile.primaryColor ?? null,
            secondaryColor: profile.secondaryColor ?? null,
            logoReferences: toJsonValue(profile.logoReferences),
            typography: profile.typography ? toJsonValue(profile.typography) : Prisma.JsonNull,
            assetReferences: toJsonValue(profile.assetReferences),
            socialLinks: toJsonValue(profile.socialLinks),
            contactInformation: profile.contactInformation ? toJsonValue(profile.contactInformation) : Prisma.JsonNull,
            metadata: profile.metadata ? toJsonValue(profile.metadata) : Prisma.JsonNull,
            version: 1,
          },
        });

        return mapBrandProfile(created);
      }

      const updated = await prisma.gmpBrandProfile.update({
        where: { projectId: profile.projectId },
        data: {
          companyName: profile.companyName,
          tagline: profile.tagline ?? null,
          mission: profile.mission ?? null,
          brandVoice: profile.brandVoice ?? null,
          writingStyle: profile.writingStyle ?? null,
          primaryAudience: profile.primaryAudience ?? null,
          secondaryAudience: profile.secondaryAudience ?? null,
          primaryColor: profile.primaryColor ?? null,
          secondaryColor: profile.secondaryColor ?? null,
          logoReferences: toJsonValue(profile.logoReferences),
          typography: profile.typography ? toJsonValue(profile.typography) : Prisma.JsonNull,
          assetReferences: toJsonValue(profile.assetReferences),
          socialLinks: toJsonValue(profile.socialLinks),
          contactInformation: profile.contactInformation ? toJsonValue(profile.contactInformation) : Prisma.JsonNull,
          metadata: profile.metadata ? toJsonValue(profile.metadata) : Prisma.JsonNull,
          version: existing.version + 1,
        },
      });

      return mapBrandProfile(updated);
    },

    async getBrandProfileByProjectId(projectId) {
      const row = await prisma.gmpBrandProfile.findUnique({ where: { projectId } });
      return row ? mapBrandProfile(row) : null;
    },

    async createPublishingConnection(connection) {
      const created = await prisma.gmpPublishingConnection.create({
        data: {
          connectionId: `gmpconn_${randomUUID()}`,
          siteId: connection.siteId,
          provider: connection.provider,
          environment: connection.environment,
          publishingStatus: connection.publishingStatus,
          authenticationMethod: connection.authenticationMethod,
          connectionStatus: connection.connectionStatus,
          publishingCapabilities: toJsonValue(connection.publishingCapabilities),
          configuration: connection.configuration ? toJsonValue(connection.configuration) : Prisma.JsonNull,
          metadata: connection.metadata ? toJsonValue(connection.metadata) : Prisma.JsonNull,
          lastValidatedAt: connection.lastValidatedAt ? new Date(connection.lastValidatedAt) : null,
        },
      });

      return mapConnection(created);
    },

    async updatePublishingConnection(connectionId, changes) {
      const existing = await prisma.gmpPublishingConnection.findUnique({ where: { connectionId } });
      if (!existing) {
        return null;
      }

      const updated = await prisma.gmpPublishingConnection.update({
        where: { connectionId },
        data: {
          provider: changes.provider,
          environment: changes.environment,
          publishingStatus: changes.publishingStatus,
          authenticationMethod: changes.authenticationMethod,
          connectionStatus: changes.connectionStatus,
          publishingCapabilities: changes.publishingCapabilities ? toJsonValue(changes.publishingCapabilities) : undefined,
          configuration: changes.configuration ? toJsonValue(changes.configuration) : changes.configuration === null ? Prisma.JsonNull : undefined,
          metadata: changes.metadata ? toJsonValue(changes.metadata) : changes.metadata === null ? Prisma.JsonNull : undefined,
          lastValidatedAt: changes.lastValidatedAt === undefined ? undefined : changes.lastValidatedAt ? new Date(changes.lastValidatedAt) : null,
          archivedAt: changes.archivedAt === undefined ? undefined : changes.archivedAt ? new Date(changes.archivedAt) : null,
          version: existing.version + 1,
        },
      });

      return mapConnection(updated);
    },

    async archivePublishingConnection(connectionId) {
      return this.updatePublishingConnection(connectionId, {
        archivedAt: new Date().toISOString(),
        connectionStatus: "OFFLINE",
      });
    },

    async listPublishingConnectionsForSite(siteId) {
      const rows = await prisma.gmpPublishingConnection.findMany({
        where: { siteId },
        orderBy: [{ updatedAt: "desc" }],
      });

      return rows.map(mapConnection);
    },

    async upsertEnvironmentConfig(config) {
      const existing = config.configId
        ? await prisma.gmpEnvironmentConfig.findUnique({ where: { configId: config.configId } })
        : null;

      if (!existing) {
        const created = await prisma.gmpEnvironmentConfig.create({
          data: {
            configId: config.configId ?? `gmpenv_${randomUUID()}`,
            projectId: config.projectId ?? null,
            siteId: config.siteId ?? null,
            environment: config.environment,
            variables: toJsonValue(config.variables),
            metadata: config.metadata ? toJsonValue(config.metadata) : Prisma.JsonNull,
          },
        });

        return mapEnvironmentConfig(created);
      }

      const updated = await prisma.gmpEnvironmentConfig.update({
        where: { configId: existing.configId },
        data: {
          projectId: config.projectId ?? null,
          siteId: config.siteId ?? null,
          environment: config.environment,
          variables: toJsonValue(config.variables),
          metadata: config.metadata ? toJsonValue(config.metadata) : Prisma.JsonNull,
          version: existing.version + 1,
        },
      });

      return mapEnvironmentConfig(updated);
    },

    async listEnvironmentConfigsForProject(projectId) {
      const rows = await prisma.gmpEnvironmentConfig.findMany({
        where: { projectId },
        orderBy: [{ updatedAt: "desc" }],
      });

      return rows.map(mapEnvironmentConfig);
    },
  };
}

export function createInMemoryGmpRepository(seed?: {
  projects?: GmpProject[];
  sites?: GmpSite[];
  brandProfiles?: GmpBrandProfile[];
  connections?: GmpPublishingConnection[];
  envConfigs?: GmpEnvironmentConfiguration[];
}): GmpRepository {
  const projects = new Map((seed?.projects ?? []).map((project) => [project.projectId, project]));
  const sites = new Map((seed?.sites ?? []).map((site) => [site.siteId, site]));
  const brandProfiles = new Map((seed?.brandProfiles ?? []).map((profile) => [profile.projectId, profile]));
  const connections = new Map((seed?.connections ?? []).map((connection) => [connection.connectionId, connection]));
  const envConfigs = new Map((seed?.envConfigs ?? []).map((config) => [config.configId, config]));

  return {
    async createProject(project) {
      projects.set(project.projectId, project);
      return project;
    },
    async updateProject(projectId, changes) {
      const current = projects.get(projectId);
      if (!current) return null;
      const updated: GmpProject = {
        ...current,
        ...changes,
        updatedAt: new Date().toISOString(),
        version: current.version + 1,
      };
      projects.set(projectId, updated);
      return updated;
    },
    async archiveProject(projectId) {
      return this.updateProject(projectId, {
        status: "ARCHIVED",
        lifecycleState: "SUNSET",
        archivedAt: new Date().toISOString(),
      });
    },
    async getProjectById(projectId) {
      return projects.get(projectId) ?? null;
    },
    async getProjectBySlug(workspaceId, slug) {
      return [...projects.values()].find((project) => project.workspaceId === workspaceId && project.slug === slug) ?? null;
    },
    async listProjects(workspaceId) {
      return [...projects.values()]
        .filter((project) => project.workspaceId === workspaceId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async createSite(site) {
      const created: GmpSite = {
        ...site,
        siteId: `gmpsite_${randomUUID()}`,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
      };
      sites.set(created.siteId, created);
      return created;
    },
    async updateSite(siteId, changes) {
      const current = sites.get(siteId);
      if (!current) return null;
      const updated: GmpSite = {
        ...current,
        ...changes,
        updatedAt: new Date().toISOString(),
        version: current.version + 1,
      };
      sites.set(siteId, updated);
      return updated;
    },
    async archiveSite(siteId) {
      return this.updateSite(siteId, {
        archivedAt: new Date().toISOString(),
        connectionStatus: "OFFLINE",
      });
    },
    async getSiteById(siteId) {
      return sites.get(siteId) ?? null;
    },
    async listSitesForProject(projectId) {
      return [...sites.values()].filter((site) => site.projectId === projectId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async upsertBrandProfile(profile) {
      const existing = brandProfiles.get(profile.projectId);
      const next: GmpBrandProfile = {
        brandProfileId: existing?.brandProfileId ?? profile.brandProfileId ?? `gmpbrand_${randomUUID()}`,
        projectId: profile.projectId,
        companyName: profile.companyName,
        tagline: profile.tagline,
        mission: profile.mission,
        brandVoice: profile.brandVoice,
        writingStyle: profile.writingStyle,
        primaryAudience: profile.primaryAudience,
        secondaryAudience: profile.secondaryAudience,
        primaryColor: profile.primaryColor,
        secondaryColor: profile.secondaryColor,
        logoReferences: profile.logoReferences,
        typography: profile.typography,
        assetReferences: profile.assetReferences,
        socialLinks: profile.socialLinks,
        contactInformation: profile.contactInformation,
        metadata: profile.metadata,
        version: (existing?.version ?? 0) + 1,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      brandProfiles.set(profile.projectId, next);
      return next;
    },
    async getBrandProfileByProjectId(projectId) {
      return brandProfiles.get(projectId) ?? null;
    },

    async createPublishingConnection(connection) {
      const created: GmpPublishingConnection = {
        ...connection,
        connectionId: `gmpconn_${randomUUID()}`,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
      };
      connections.set(created.connectionId, created);
      return created;
    },
    async updatePublishingConnection(connectionId, changes) {
      const current = connections.get(connectionId);
      if (!current) return null;
      const updated: GmpPublishingConnection = {
        ...current,
        ...changes,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      };
      connections.set(connectionId, updated);
      return updated;
    },
    async archivePublishingConnection(connectionId) {
      return this.updatePublishingConnection(connectionId, {
        archivedAt: new Date().toISOString(),
        connectionStatus: "OFFLINE",
      });
    },
    async listPublishingConnectionsForSite(siteId) {
      return [...connections.values()].filter((connection) => connection.siteId === siteId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async upsertEnvironmentConfig(config) {
      const existing = config.configId ? envConfigs.get(config.configId) : undefined;
      const next: GmpEnvironmentConfiguration = {
        configId: existing?.configId ?? config.configId ?? `gmpenv_${randomUUID()}`,
        projectId: config.projectId,
        siteId: config.siteId,
        environment: config.environment,
        variables: config.variables,
        metadata: config.metadata,
        version: (existing?.version ?? 0) + 1,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      envConfigs.set(next.configId, next);
      return next;
    },
    async listEnvironmentConfigsForProject(projectId) {
      return [...envConfigs.values()].filter((config) => config.projectId === projectId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
  };
}
