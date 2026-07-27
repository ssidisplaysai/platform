import { glwSites } from "@/lib/glw/sites";
import { createGenesisWorkspaceRegistry } from "./registry";
import type { GenesisAuthorizationSubject } from "../contracts";

const registry = createGenesisWorkspaceRegistry([
  {
    workspaceId: "glw-led-display-warehouse",
    name: "LED Display Warehouse",
    description: "GLW reference workspace",
    enabled: true,
    enabledModuleIds: ["glw.core"],
    defaultModuleId: "glw.core",
    availableSites: glwSites.map((site) => ({
      siteId: site.id,
      name: site.name,
      region: site.region,
    })),
    featureFlags: ["gop.events", "gop.inspector"],
    branding: {
      shortName: "GLW",
      logoText: "GLW",
    },
    environment: "development",
    order: 10,
  },
]);

export function getGenesisWorkspaceRegistry() {
  return registry;
}

export function resolveAuthorizedWorkspaces(subject: GenesisAuthorizationSubject) {
  return registry.resolveForSubject(subject);
}
