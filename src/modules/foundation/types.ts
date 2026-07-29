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
  | "sites:read"
  | "sites:create"
  | "sites:update"
  | "sites:enable"
  | "sites:disable"
  | "sites:test_connection"
  | "sites:manage_integrations"
  | "sites:view_health"
  | "sites:view_audit"
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
  environment: SiteEnvironment;
  health: SiteHealthStatus;
  publishing: SitePublishingStatus;
  enabled: boolean;
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

export type SiteLifecycleState =
  | "draft"
  | "configuring"
  | "active"
  | "suspended"
  | "archived";

export type SiteEnvironment =
  | "local"
  | "development"
  | "test"
  | "staging"
  | "production";

export type SiteHealthStatus =
  | "unknown"
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "not_configured";

export type SitePublishingStatus =
  | "disabled"
  | "not_ready"
  | "ready"
  | "blocked"
  | "suspended";

export type SiteActionIntent = "publish" | "connection_test" | "configure";

export type SiteDefaultContentType =
  | "article"
  | "landing_page"
  | "product_update"
  | "campaign";

export type SiteDefaultPublicationStatus = "draft" | "review" | "scheduled";

export type SiteIntegrationReferences = {
  wordpressApiBaseUrl: string | null;
  wordpressCredentialReference: string | null;
  workflowReference: string | null;
};

export type SiteProfileReferences = {
  promptProfileReference: string | null;
  imageProfileReference: string | null;
  seoProfileReference: string | null;
  brandProfileReference: string | null;
  analyticsProfileReference: string | null;
};

export type SiteConfiguration = {
  siteId: string;
  organizationId: string;
  siteName: string;
  displayName: string;
  slug: string;
  domain: string | null;
  canonicalUrl: string | null;
  environment: SiteEnvironment;
  lifecycleState: SiteLifecycleState;
  enabled: boolean;
  healthStatus: SiteHealthStatus;
  publishingStatus: SitePublishingStatus;
  defaultContentType: SiteDefaultContentType;
  defaultPublicationStatus: SiteDefaultPublicationStatus;
  defaultAuthorReference: string | null;
  defaultCategoryReferences: readonly string[];
  integrations: SiteIntegrationReferences;
  profiles: SiteProfileReferences;
  lastConnectionTest: string | null;
  lastSuccessfulPublication: string | null;
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
};

export type SiteReadinessCondition = {
  key:
    | "site_enabled"
    | "lifecycle_permits_operation"
    | "domain_present"
    | "wordpress_api_present"
    | "credential_reference_present"
    | "workflow_reference_present"
    | "health_acceptable"
    | "environment_permits_action"
    | "publishing_state_permits_action"
    | "profiles_present"
    | "organization_active"
    | "user_has_site_permission";
  passed: boolean;
  details: string;
};

export type SiteReadinessStatus = "ready" | "blocked" | "warning";

export type SiteReadinessResult = {
  ready: boolean;
  status: SiteReadinessStatus;
  blockingReasons: readonly string[];
  warnings: readonly string[];
  checkedConditions: readonly SiteReadinessCondition[];
  checkedAt: string;
};

export type SiteConnectionTestResult = {
  status: "not_configured" | "unavailable" | "passed" | "failed";
  message: string;
  checkedAt: string;
  details?: string;
};

export type SiteValidationIssue = {
  field: string;
  message: string;
};

export type SiteValidationResult = {
  valid: boolean;
  issues: readonly SiteValidationIssue[];
};

export type NewSiteInput = {
  organizationId: string;
  siteName: string;
  displayName: string;
  slug: string;
  domain: string | null;
  canonicalUrl: string | null;
  environment: SiteEnvironment;
  enabled: boolean;
  defaultContentType: SiteDefaultContentType;
  defaultPublicationStatus: SiteDefaultPublicationStatus;
  defaultAuthorReference: string | null;
  defaultCategoryReferences: readonly string[];
  integrations: SiteIntegrationReferences;
  profiles: SiteProfileReferences;
  notes: string | null;
};

export type UpdateSiteInput = Partial<Omit<SiteConfiguration, "siteId" | "organizationId" | "createdAt">>;

export type SiteListFilters = {
  organizationId?: string;
  environment?: SiteEnvironment;
  lifecycleState?: SiteLifecycleState;
  healthStatus?: SiteHealthStatus;
  query?: string;
};

export type SiteActivityType =
  | "site_created"
  | "site_updated"
  | "site_enabled"
  | "site_disabled"
  | "connection_test_requested"
  | "readiness_evaluated";

export type SiteActivityRecord = {
  activityId: string;
  siteId: string;
  organizationId: string;
  type: SiteActivityType;
  actor: string;
  createdAt: string;
  summary: string;
};

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
