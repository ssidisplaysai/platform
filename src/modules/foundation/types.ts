export type AppRole =
  | "platform_admin"
  | "ops_manager"
  | "company_operator"
  | "analyst"
  | "viewer";

export type PermissionAction =
  | "workspace:view"
  | "workspace:manage"
  | "organization:switch"
  | "site:switch"
  | "settings:view"
  | "settings:manage"
  | "notifications:view"
  | "notifications:manage"
  | "audit:view"
  | "command_palette:use"
  | "search:use";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  roles: readonly AppRole[];
};

export type OrganizationContext = {
  id: string;
  slug: string;
  name: string;
};

export type SiteContext = {
  id: string;
  slug: string;
  organizationId: string;
  name: string;
  region: string;
};

export type FoundationContext = {
  user: AppUser;
  organizations: readonly OrganizationContext[];
  sites: readonly SiteContext[];
  selectedOrganizationId: string;
  selectedSiteId: string;
};

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  requiredPermissions?: readonly PermissionAction[];
};

export type CommandPaletteAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  requiredPermissions?: readonly PermissionAction[];
};

export type SearchScope = "all" | "organizations" | "sites" | "users" | "settings";

export type EnterpriseSearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  scope: SearchScope;
  requiredPermissions?: readonly PermissionAction[];
};

export type NotificationRecord = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  timestamp: string;
};

export type AuditEventRecord = {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
  outcome: "accepted" | "rejected" | "failed" | "completed";
};
