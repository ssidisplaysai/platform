import { createGenesisWorkspaceRegistry } from "./registry";
import type { GenesisAuthorizationSubject } from "../contracts";

const defaultSites = [
  { siteId: "led-display-warehouse", name: "LED Display Warehouse", region: "Austin, TX" },
  { siteId: "california-outdoor-led", name: "California Outdoor LED", region: "Los Angeles, CA" },
  { siteId: "sphere-rental-dallas", name: "Sphere Rental Dallas", region: "Dallas, TX" },
  { siteId: "projection-screen-chicago", name: "Projection Screen Chicago", region: "Chicago, IL" },
];

const registry = createGenesisWorkspaceRegistry([
  {
    workspaceId: "glw-led-display-warehouse",
    name: "LED Display Warehouse",
    description: "GLW reference workspace",
    enabled: true,
    enabledModuleIds: ["glw.core"],
    defaultModuleId: "glw.core",
    availableSites: defaultSites,
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
