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
  | "products:read"
  | "products:create"
  | "products:update"
  | "products:archive"
  | "products:manage_categories"
  | "products:manage_manufacturers"
  | "products:manage_specifications"
  | "products:assign_sites"
  | "products:evaluate_readiness"
  | "products:view_internal"
  | "products:view_audit"
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

export type SearchScope =
  | "all"
  | "organizations"
  | "sites"
  | "users"
  | "settings"
  | "products"
  | "categories"
  | "manufacturers";

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

export type ProductLifecycleState =
  | "draft"
  | "configuring"
  | "active"
  | "suspended"
  | "archived";

export type ProductCatalogStatus =
  | "incomplete"
  | "review_required"
  | "ready"
  | "published"
  | "blocked";

export type ProductVisibilityState =
  | "hidden"
  | "internal"
  | "site_visible"
  | "public_candidate";

export type ProductType =
  | "led_display"
  | "digital_sphere"
  | "oled_display"
  | "kiosk"
  | "projection_film"
  | "projector_enclosure"
  | "touch_display"
  | "accessory"
  | "custom_fabrication"
  | "service";

export type ProductSitePublicationStatus =
  | "disabled"
  | "not_ready"
  | "ready"
  | "blocked"
  | "published";

export type ProductPricingDisplayMode =
  | "hidden"
  | "request_quote"
  | "range"
  | "fixed";

export type ProductSpecificationVisibility = "public" | "internal";

export type ProductSpecification = {
  specificationId: string;
  specificationGroup: string;
  key: string;
  displayLabel: string;
  rawValue: string;
  normalizedValue: string | null;
  unit: string | null;
  sortOrder: number;
  sourceReference: string | null;
  evidenceReference: string | null;
  confidence: number | null;
  visibility: ProductSpecificationVisibility;
};

export type ProductMediaReferences = {
  primaryImageReference: string | null;
  galleryImageReferences: readonly string[];
  videoReferences: readonly string[];
};

export type ProductDocumentReferences = {
  technicalDrawingReferences: readonly string[];
  specSheetReferences: readonly string[];
  brochureReferences: readonly string[];
  manualReferences: readonly string[];
  installationGuideReferences: readonly string[];
  warrantyDocumentReferences: readonly string[];
};

export type ProductSiteAssignment = {
  siteId: string;
  enabledForSite: boolean;
  siteSpecificSlug: string;
  siteSpecificDisplayName: string | null;
  siteSpecificShortDescription: string | null;
  visibility: ProductVisibilityState;
  featured: boolean;
  sortOrder: number;
  categoryIds: readonly string[];
  defaultContentType: SiteDefaultContentType;
  publicationStatus: ProductSitePublicationStatus;
  seoProfileReference: string | null;
  promptProfileReference: string | null;
  imageProfileReference: string | null;
  pricingDisplayMode: ProductPricingDisplayMode;
  lastReadinessEvaluation: string | null;
  lastPublicationReference: string | null;
};

export type ProductConfiguration = {
  productId: string;
  organizationId: string;
  productName: string;
  displayName: string;
  slug: string;
  sku: string;
  modelNumber: string | null;
  shortDescription: string | null;
  fullDescription: string | null;
  productType: ProductType | null;
  productFamily: string | null;
  categoryIds: readonly string[];
  manufacturerId: string | null;
  brandReference: string | null;
  lifecycleState: ProductLifecycleState;
  catalogStatus: ProductCatalogStatus;
  enabled: boolean;
  visibility: ProductVisibilityState;
  featured: boolean;
  primarySiteId: string | null;
  assignedSiteIds: readonly string[];
  siteAssignments: readonly ProductSiteAssignment[];
  media: ProductMediaReferences;
  documents: ProductDocumentReferences;
  specifications: readonly ProductSpecification[];
  seoProfileReference: string | null;
  promptProfileReference: string | null;
  businessGenomeObjectReference: string | null;
  sourceEvidenceReference: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  notes: string | null;
};

export type CategoryStatus = "active" | "suspended" | "archived";

export type ProductCategory = {
  categoryId: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  parentCategoryId: string | null;
  status: CategoryStatus;
  sortOrder: number;
  siteAssignments: readonly string[];
  createdAt: string;
  updatedAt: string;
};

export type ManufacturerStatus = "active" | "suspended" | "archived";

export type ProductManufacturer = {
  manufacturerId: string;
  organizationId: string;
  name: string;
  displayName: string;
  slug: string;
  website: string | null;
  status: ManufacturerStatus;
  businessGenomeReference: string | null;
  notes: string | null;
};

export type ProductReadinessCondition = {
  key:
    | "product_enabled"
    | "lifecycle_permits_operation"
    | "name_present"
    | "slug_valid"
    | "sku_present"
    | "product_type_present"
    | "category_assigned"
    | "primary_site_assigned"
    | "site_assignment_enabled"
    | "required_description_present"
    | "required_specifications_present"
    | "primary_image_present"
    | "manufacturer_present_or_exception"
    | "site_active"
    | "site_publishability_compatible"
    | "visibility_compatible"
    | "required_profile_references_present"
    | "user_has_permission";
  passed: boolean;
  details: string;
};

export type ProductReadinessStatus = "ready" | "blocked" | "warning";

export type ProductReadinessResult = {
  ready: boolean;
  status: ProductReadinessStatus;
  blockingReasons: readonly string[];
  warnings: readonly string[];
  checkedConditions: readonly ProductReadinessCondition[];
  checkedAt: string;
};

export type ProductValidationIssue = {
  field: string;
  message: string;
};

export type ProductValidationResult = {
  valid: boolean;
  issues: readonly ProductValidationIssue[];
};

export type NewProductInput = Omit<
  ProductConfiguration,
  | "productId"
  | "lifecycleState"
  | "catalogStatus"
  | "enabled"
  | "visibility"
  | "featured"
  | "createdAt"
  | "updatedAt"
  | "publishedAt"
>;

export type UpdateProductInput = Partial<
  Omit<
    ProductConfiguration,
    "productId" | "organizationId" | "createdAt" | "businessGenomeObjectReference"
  >
>;

export type ProductListFilters = {
  organizationId?: string;
  siteId?: string;
  lifecycleState?: ProductLifecycleState;
  catalogStatus?: ProductCatalogStatus;
  visibility?: ProductVisibilityState;
  categoryId?: string;
  manufacturerId?: string;
  query?: string;
};

export type ProductActivityType =
  | "product_created"
  | "product_updated"
  | "product_archived"
  | "category_assigned"
  | "manufacturer_assigned"
  | "site_assigned"
  | "specification_changed"
  | "product_readiness_evaluated";

export type ProductActivityRecord = {
  activityId: string;
  productId: string;
  organizationId: string;
  type: ProductActivityType;
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
  resultType?: "product" | "category" | "manufacturer" | "generic";
  supportingIdentifier?: string;
  readinessIndicator?: "ready" | "blocked" | "warning" | "unknown";
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
