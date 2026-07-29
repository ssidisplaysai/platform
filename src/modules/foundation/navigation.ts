import type {
  CommandPaletteAction,
  EnterpriseSearchItem,
  NavigationItem,
} from "./types";

export const FOUNDATION_NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    id: "mission-control",
    label: "Mission Control",
    href: "/",
    requiredPermissions: ["workspace:view"],
  },
  {
    id: "companies",
    label: "Companies",
    href: "/companies",
    requiredPermissions: ["workspace:view"],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    requiredPermissions: ["settings:view"],
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    requiredPermissions: ["notifications:view"],
  },
  {
    id: "audit",
    label: "Audit",
    href: "/audit",
    requiredPermissions: ["audit:view"],
  },
  {
    id: "search",
    label: "Enterprise Search",
    href: "/search",
    requiredPermissions: ["search:use"],
  },
];

export const FOUNDATION_COMMANDS: readonly CommandPaletteAction[] = [
  {
    id: "open-companies",
    label: "Open Companies",
    description: "Switch to the organization catalog",
    href: "/companies",
    requiredPermissions: ["workspace:view", "command_palette:use"],
  },
  {
    id: "open-settings",
    label: "Open Settings",
    description: "Review workspace and organization settings",
    href: "/settings",
    requiredPermissions: ["settings:view", "command_palette:use"],
  },
  {
    id: "open-notifications",
    label: "Open Notifications",
    description: "Review organization and system alerts",
    href: "/notifications",
    requiredPermissions: ["notifications:view", "command_palette:use"],
  },
  {
    id: "open-audit",
    label: "Open Audit",
    description: "View governance and lifecycle events",
    href: "/audit",
    requiredPermissions: ["audit:view", "command_palette:use"],
  },
  {
    id: "open-search",
    label: "Open Enterprise Search",
    description: "Search organizations, sites, users, and settings",
    href: "/search",
    requiredPermissions: ["search:use", "command_palette:use"],
  },
];

export const FOUNDATION_SEARCH_INDEX: readonly EnterpriseSearchItem[] = [
  {
    id: "settings-workspace",
    title: "Workspace Settings",
    subtitle: "Govern workspace defaults and operator controls",
    href: "/settings",
    scope: "settings",
    requiredPermissions: ["settings:view"],
  },
  {
    id: "notifications-center",
    title: "Notifications Center",
    subtitle: "Review event alerts and acknowledge notices",
    href: "/notifications",
    scope: "all",
    requiredPermissions: ["notifications:view"],
  },
  {
    id: "audit-view",
    title: "Audit Event Foundation",
    subtitle: "Inspect governance event outcomes",
    href: "/audit",
    scope: "all",
    requiredPermissions: ["audit:view"],
  },
  {
    id: "organization-registry",
    title: "Organization Context",
    subtitle: "Switch and scope application workspace",
    href: "/companies",
    scope: "organizations",
    requiredPermissions: ["organization:switch"],
  },
];
