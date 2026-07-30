import type { GenesisWorkspaceDescriptor, GenesisWorkspaceIdentity } from "../contracts";

export type GenesisWorkspaceSiteDescriptor = {
  siteId: string;
  name: string;
  region?: string;
};

export type GenesisWorkspaceSiteInput = {
  siteId?: string;
  id?: string;
  name: string;
  region?: string;
};

export const GENESIS_PRIMARY_WORKSPACE_IDENTITY: GenesisWorkspaceIdentity = {
  workspaceId: "glw-led-display-warehouse",
  workspaceKey: "glw",
  displayName: "LED Display Warehouse",
  aliases: ["glw-led-display-warehouse"],
  registration: {
    defaultModuleId: "glw.core",
    enabledModuleIds: ["glw.core"],
    featureFlags: ["gop.events", "gop.inspector"],
    environment: "development",
    order: 10,
  },
};

export const GENESIS_PRIMARY_WORKSPACE_ID = GENESIS_PRIMARY_WORKSPACE_IDENTITY.workspaceId;
export const GENESIS_PRIMARY_WORKSPACE_KEY = GENESIS_PRIMARY_WORKSPACE_IDENTITY.workspaceKey;
export const GENESIS_PRIMARY_WORKSPACE_MODULE_ID = GENESIS_PRIMARY_WORKSPACE_IDENTITY.registration.defaultModuleId;

export function toWorkspaceSites(sites: GenesisWorkspaceSiteInput[]): GenesisWorkspaceSiteDescriptor[] {
  return sites.map((site) => ({
    siteId: site.siteId ?? site.id ?? "",
    name: site.name,
    region: site.region,
  }));
}

export function createPrimaryWorkspaceDescriptor(input: {
  availableSites?: GenesisWorkspaceSiteDescriptor[];
} = {}): GenesisWorkspaceDescriptor {
  return {
    workspaceId: GENESIS_PRIMARY_WORKSPACE_IDENTITY.workspaceId,
    name: GENESIS_PRIMARY_WORKSPACE_IDENTITY.displayName,
    description: "GLW reference workspace",
    enabled: true,
    enabledModuleIds: [...GENESIS_PRIMARY_WORKSPACE_IDENTITY.registration.enabledModuleIds],
    defaultModuleId: GENESIS_PRIMARY_WORKSPACE_IDENTITY.registration.defaultModuleId,
    availableSites: input.availableSites,
    featureFlags: GENESIS_PRIMARY_WORKSPACE_IDENTITY.registration.featureFlags,
    branding: {
      shortName: "GLW",
      logoText: "GLW",
    },
    environment: GENESIS_PRIMARY_WORKSPACE_IDENTITY.registration.environment,
    order: GENESIS_PRIMARY_WORKSPACE_IDENTITY.registration.order,
  };
}
