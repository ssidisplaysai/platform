export type AppRole =
  | "platform_admin"
  | "ops_manager"
  | "operations"
  | "company_operator"
  | "analyst"
  | "manufacturing_planner"
  | "production_supervisor"
  | "executive"
  | "administrator"
  | "viewer";

export type PermissionAction =
  | "workspace:view"
  | "workspace:manage"
  | "organization:switch"
  | "site:switch"
  | "executions:read"
  | "executions:create"
  | "executions:update"
  | "executions:pause"
  | "executions:resume"
  | "executions:cancel"
  | "executions:archive"
  | "executions:view_audit"
  | "executions:view_revisions"
  | "executions:view_timeline"
  | "executions:search"
  | "schedules:read"
  | "schedules:create"
  | "schedules:update"
  | "schedules:release"
  | "schedules:cancel"
  | "schedules:revise"
  | "schedules:view_audit"
  | "schedules:view_revisions"
  | "schedules:search"
  | "routings:read"
  | "routings:create"
  | "routings:update"
  | "routings:release"
  | "routings:archive"
  | "routings:revise"
  | "routings:view_audit"
  | "routings:view_revisions"
  | "routings:search"
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
  | "inventory:read"
  | "inventory:read_internal"
  | "inventory:create_movement"
  | "inventory:adjust"
  | "inventory:transfer"
  | "inventory:receive"
  | "inventory:damage"
  | "inventory:hold"
  | "inventory:reserve"
  | "inventory:release_reservation"
  | "inventory:fulfill_reservation"
  | "inventory:reverse_movement"
  | "inventory:manage_locations"
  | "inventory:manage_reorder_policy"
  | "inventory:count"
  | "inventory:approve_count"
  | "inventory:view_audit"
  | "profiles:read"
  | "profiles:create"
  | "profiles:update"
  | "profiles:validate"
  | "profiles:evaluate_readiness"
  | "profiles:assign"
  | "customers:read"
  | "customers:create"
  | "customers:update"
  | "customers:archive"
  | "customers:evaluate_readiness"
  | "customers:detect_duplicates"
  | "customers:view_activity"
  | "contacts:read"
  | "contacts:create"
  | "contacts:update"
  | "addresses:read"
  | "addresses:create"
  | "addresses:update"
  | "quotes:read"
  | "quotes:create"
  | "quotes:update"
  | "quotes:update_lines"
  | "quotes:create_revision"
  | "quotes:submit"
  | "quotes:approve"
  | "quotes:reject"
  | "quotes:withdraw"
  | "quotes:present"
  | "quotes:accept"
  | "quotes:cancel"
  | "quotes:expire"
  | "quotes:convert"
  | "quotes:view_audit"
  | "orders:read"
  | "orders:create"
  | "orders:update"
  | "orders:approve"
  | "orders:release"
  | "orders:revise"
  | "orders:cancel"
  | "orders:view_audit"
  | "manufacturing:read"
  | "manufacturing:create"
  | "manufacturing:update"
  | "manufacturing:revise"
  | "manufacturing:transition"
  | "manufacturing:view_audit"
  | "manufacturing:publish_events"
  | "work_orders:read"
  | "work_orders:create"
  | "work_orders:update"
  | "work_orders:release"
  | "work_orders:revise"
  | "work_orders:pause"
  | "work_orders:cancel"
  | "work_orders:view_audit"
  | "work_orders:view_revisions"
  | "production_jobs:read"
  | "production_jobs:create"
  | "production_jobs:release"
  | "production_jobs:pause"
  | "production_jobs:cancel"
  | "production_jobs:revise"
  | "production_jobs:view_audit"
  | "production_jobs:view_revisions"
  | "routings:read"
  | "routings:create"
  | "routings:update"
  | "routings:release"
  | "routings:archive"
  | "routings:revise"
  | "routings:view_audit"
  | "routings:view_revisions"
  | "routings:search"
  | "operations:read"
  | "operations:create"
  | "operations:update"
  | "operations:release"
  | "operations:cancel"
  | "operations:revise"
  | "operations:view_audit"
  | "operations:view_revisions"
  | "operations:view_lineage"
  | "operations:search"
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
  | "manufacturers"
  | "inventory"
  | "locations"
  | "movements"
  | "reservations"
  | "profiles"
  | "publishing_profiles"
  | "wordpress_profiles"
  | "workflow_profiles"
  | "prompt_profiles"
  | "image_profiles"
  | "seo_profiles"
  | "brand_profiles"
  | "analytics_profiles"
  | "customers"
  | "customer_accounts"
  | "customer_contacts"
  | "customer_addresses"
  | "quotes"
  | "quote_registry"
  | "quote_lines"
  | "quote_revisions"
  | "quote_audit"
  | "orders"
  | "order_registry"
  | "order_revisions"
  | "order_audit"
  | "manufacturing"
  | "manufacturing_foundation"
  | "manufacturing_revisions"
  | "manufacturing_audit"
  | "work_orders"
  | "work_order_registry"
  | "work_order_revisions"
  | "work_order_audit"
  | "production_jobs"
  | "production_job_registry"
  | "production_job_revisions"
  | "production_job_audit"
  | "executions"
  | "execution_registry"
  | "execution_activities"
  | "execution_audit"
  | "execution_revisions"
  | "execution_timeline"
  | "schedules"
  | "schedule_registry"
  | "schedule_entries"
  | "schedule_audit"
  | "schedule_revisions"
  | "schedule_timeline"
  | "schedule_calendar"
  | "routings"
  | "routing_registry"
  | "routing_versions"
  | "routing_audit"
  | "routing_lineage"
  | "routing_timeline"
  | "operations"
  | "operation_registry"
  | "operation_revisions"
  | "operation_audit"
  | "operation_lineage"
  | "operation_timeline";

export type IntegrationProfileType =
  | "publishing"
  | "wordpress"
  | "workflow"
  | "prompt"
  | "image"
  | "seo"
  | "brand"
  | "analytics";

export type IntegrationProfileStatus =
  | "draft"
  | "active"
  | "suspended"
  | "archived";

export type IntegrationProfileAssignmentTargetType =
  | "site"
  | "product"
  | "category"
  | "page_template"
  | "blog_template"
  | "media";

export type IntegrationProfileReferenceSet = {
  credentialReference: string | null;
  workflowReference: string | null;
  promptReference: string | null;
  providerReference: string | null;
  brandReference: string | null;
  workflowProfileReference: string | null;
  wordpressProfileReference: string | null;
  promptProfileReference: string | null;
  imageProfileReference: string | null;
  seoProfileReference: string | null;
  analyticsProfileReference: string | null;
  titleStrategyReference: string | null;
  metaStrategyReference: string | null;
  schemaReference: string | null;
  openGraphReference: string | null;
  slugStrategyReference: string | null;
  canonicalPolicyReference: string | null;
  logoReference: string | null;
  colorPaletteReference: string | null;
  typographyReference: string | null;
  voiceReference: string | null;
  defaultCtaReference: string | null;
  assetReference: string | null;
  baseUrlReference: string | null;
  authorReference: string | null;
  categoryReference: string | null;
  postStatusReference: string | null;
  featuredImagePolicyReference: string | null;
  imageInsertionPolicyReference: string | null;
  yoastPolicyReference: string | null;
  inputContractReference: string | null;
  outputContractReference: string | null;
  retryPolicyReference: string | null;
  executionTimeoutReference: string | null;
  environmentReference: string | null;
};

export type IntegrationProfileConfiguration = {
  profileId: string;
  profileType: IntegrationProfileType;
  organizationId: string;
  profileName: string;
  description: string | null;
  status: IntegrationProfileStatus;
  enabled: boolean;
  version: string;
  assignedSiteIds: readonly string[];
  defaultForOrganization: boolean;
  references: IntegrationProfileReferenceSet;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
};

export type IntegrationProfileReadinessCondition = {
  key:
    | "profile_enabled"
    | "status_permits_operation"
    | "version_present"
    | "wordpress_base_url_reference_present"
    | "wordpress_credential_reference_present"
    | "workflow_reference_present"
    | "provider_reference_present"
    | "prompt_reference_present"
    | "image_provider_reference_present"
    | "seo_title_strategy_present"
    | "seo_meta_strategy_present"
    | "seo_schema_reference_present"
    | "seo_open_graph_reference_present"
    | "seo_slug_strategy_present"
    | "seo_canonical_policy_present"
    | "brand_logo_reference_present"
    | "brand_palette_reference_present"
    | "brand_typography_reference_present"
    | "brand_voice_reference_present"
    | "brand_cta_reference_present"
    | "publishing_wordpress_profile_present"
    | "publishing_workflow_profile_present"
    | "publishing_prompt_profile_present"
    | "publishing_seo_profile_present"
    | "analytics_provider_reference_present"
    | "retry_policy_reference_present"
    | "execution_timeout_reference_present";
  passed: boolean;
  details: string;
};

export type IntegrationProfileReadinessResult = {
  profileId: string;
  profileType: IntegrationProfileType;
  ready: boolean;
  warnings: readonly string[];
  blockers: readonly string[];
  checkedConditions: readonly IntegrationProfileReadinessCondition[];
  timestamp: string;
};

export type IntegrationProfileValidationIssue = {
  field: string;
  message: string;
};

export type IntegrationProfileValidationResult = {
  valid: boolean;
  issues: readonly IntegrationProfileValidationIssue[];
};

export type NewIntegrationProfileInput = Omit<
  IntegrationProfileConfiguration,
  "createdAt" | "updatedAt"
>;

export type UpdateIntegrationProfileInput = Partial<
  Omit<
    IntegrationProfileConfiguration,
    "profileId" | "organizationId" | "profileType" | "createdAt"
  >
>;

export type IntegrationProfileListFilters = {
  organizationId?: string;
  profileType?: IntegrationProfileType;
  status?: IntegrationProfileStatus;
  enabled?: boolean;
  siteId?: string;
  query?: string;
};

export type IntegrationProfileAssignmentRecord = {
  assignmentId: string;
  organizationId: string;
  targetType: IntegrationProfileAssignmentTargetType;
  targetId: string;
  siteId: string | null;
  profileType: IntegrationProfileType;
  profileId: string;
  inherited: boolean;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
};

export type IntegrationProfileUsageRecord = {
  profileId: string;
  targetType: IntegrationProfileAssignmentTargetType;
  targetId: string;
  siteId: string | null;
  inherited: boolean;
};

export type EffectiveProfileAssignment = {
  profileType: IntegrationProfileType;
  directProfileId: string | null;
  inheritedProfileId: string | null;
  effectiveProfileId: string | null;
  inheritanceSource: "direct" | "site" | "organization_default" | "none";
};

export type CustomerLifecycleState =
  | "prospect"
  | "active"
  | "inactive"
  | "suspended"
  | "archived";

export type CustomerAccountType =
  | "direct"
  | "dealer"
  | "distributor"
  | "partner"
  | "internal"
  | "other";

export type CustomerCommunicationFrequency = "none" | "critical_only" | "weekly" | "realtime";

export type CustomerCommunicationPreferences = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  phoneEnabled: boolean;
  marketingOptIn: boolean;
  operationalAlertsEnabled: boolean;
  invoiceNoticesEnabled: boolean;
  preferredFrequency: CustomerCommunicationFrequency;
  timezone: string | null;
};

export type CustomerConfiguration = {
  customerId: string;
  organizationId: string;
  accountName: string;
  legalName: string | null;
  accountCode: string;
  accountType: CustomerAccountType;
  lifecycleState: CustomerLifecycleState;
  enabled: boolean;
  primarySiteId: string | null;
  associatedSiteIds: readonly string[];
  primaryContactId: string | null;
  billingAddressId: string | null;
  shippingAddressId: string | null;
  communicationPreferences: CustomerCommunicationPreferences;
  taxExempt: boolean;
  tags: readonly string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerContactRole =
  | "owner"
  | "procurement"
  | "operations"
  | "finance"
  | "marketing"
  | "technical"
  | "other";

export type CustomerContactRecord = {
  contactId: string;
  customerId: string;
  organizationId: string;
  fullName: string;
  role: CustomerContactRole;
  title: string | null;
  email: string | null;
  phone: string | null;
  preferredContact: boolean;
  decisionMaker: boolean;
  enabled: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerAddressType = "billing" | "shipping" | "service" | "headquarters" | "other";

export type CustomerAddressRecord = {
  addressId: string;
  customerId: string;
  organizationId: string;
  label: string;
  addressType: CustomerAddressType;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  siteId: string | null;
  defaultBilling: boolean;
  defaultShipping: boolean;
  enabled: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerReadinessCondition = {
  key:
    | "customer_enabled"
    | "lifecycle_permits_operation"
    | "primary_site_assigned"
    | "site_association_present"
    | "primary_contact_present"
    | "contact_reachable"
    | "billing_address_present"
    | "shipping_address_present"
    | "communication_preferences_defined"
    | "user_has_permission";
  passed: boolean;
  details: string;
};

export type CustomerReadinessStatus = "ready" | "blocked" | "warning";

export type CustomerReadinessResult = {
  customerId: string;
  ready: boolean;
  status: CustomerReadinessStatus;
  blockingReasons: readonly string[];
  warnings: readonly string[];
  checkedConditions: readonly CustomerReadinessCondition[];
  checkedAt: string;
};

export type CustomerValidationIssue = {
  field: string;
  message: string;
};

export type CustomerValidationResult = {
  valid: boolean;
  issues: readonly CustomerValidationIssue[];
};

export type NewCustomerInput = Omit<
  CustomerConfiguration,
  "customerId" | "primaryContactId" | "billingAddressId" | "shippingAddressId" | "createdAt" | "updatedAt"
>;

export type UpdateCustomerInput = Partial<
  Omit<CustomerConfiguration, "customerId" | "organizationId" | "createdAt">
>;

export type NewCustomerContactInput = Omit<
  CustomerContactRecord,
  "contactId" | "customerId" | "organizationId" | "createdAt" | "updatedAt"
>;

export type UpdateCustomerContactInput = Partial<
  Omit<CustomerContactRecord, "contactId" | "customerId" | "organizationId" | "createdAt">
>;

export type NewCustomerAddressInput = Omit<
  CustomerAddressRecord,
  "addressId" | "customerId" | "organizationId" | "createdAt" | "updatedAt"
>;

export type UpdateCustomerAddressInput = Partial<
  Omit<CustomerAddressRecord, "addressId" | "customerId" | "organizationId" | "createdAt">
>;

export type CustomerListFilters = {
  organizationId?: string;
  lifecycleState?: CustomerLifecycleState;
  accountType?: CustomerAccountType;
  enabled?: boolean;
  siteId?: string;
  query?: string;
};

export type CustomerDuplicateCandidate = {
  customerId: string;
  matchedCustomerId: string;
  reasons: readonly string[];
  confidence: number;
};

export type CustomerActivityType =
  | "customer_created"
  | "customer_updated"
  | "customer_archived"
  | "customer_readiness_evaluated"
  | "contact_created"
  | "contact_updated"
  | "address_created"
  | "address_updated"
  | "duplicate_scan_requested";

export type CustomerActivityRecord = {
  activityId: string;
  customerId: string;
  organizationId: string;
  type: CustomerActivityType;
  actor: string;
  createdAt: string;
  summary: string;
};

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

export type InventoryLocationType =
  | "warehouse"
  | "showroom"
  | "store"
  | "office"
  | "manufacturing"
  | "third_party_logistics"
  | "supplier_held"
  | "virtual"
  | "transit"
  | "damaged_goods"
  | "returns";

export type InventoryLocationLifecycleState =
  | "draft"
  | "active"
  | "suspended"
  | "archived";

export type InventoryLocationHealthStatus =
  | "unknown"
  | "operational"
  | "degraded"
  | "unavailable"
  | "not_configured";

export type InventoryLocationConfiguration = {
  locationId: string;
  organizationId: string;
  siteId: string | null;
  locationName: string;
  displayName: string;
  locationCode: string;
  locationType: InventoryLocationType;
  addressReference: string | null;
  timeZone: string | null;
  lifecycleState: InventoryLocationLifecycleState;
  healthStatus: InventoryLocationHealthStatus;
  enabled: boolean;
  fulfillmentCapable: boolean;
  reservationCapable: boolean;
  receivingCapable: boolean;
  shippingCapable: boolean;
  defaultLocation: boolean;
  parentLocationId: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
};

export type InventoryUnitOfMeasure =
  | "ea"
  | "set"
  | "kit"
  | "sqm"
  | "meter"
  | "box"
  | "roll";

export type InventoryStockStatus =
  | "unknown"
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "backordered"
  | "incoming"
  | "reserved"
  | "unavailable"
  | "discontinued";

export type InventoryStockRecord = {
  inventoryRecordId: string;
  organizationId: string;
  productId: string;
  locationId: string;
  siteId: string | null;
  skuSnapshot: string;
  unitOfMeasure: InventoryUnitOfMeasure;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  incomingQuantity: number;
  allocatedQuantity: number;
  damagedQuantity: number;
  inspectionHoldQuantity: number;
  backorderedQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  safetyStock: number;
  maximumStock: number | null;
  stockStatus: InventoryStockStatus;
  lastCountedAt: string | null;
  lastMovementAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type InventoryMovementType =
  | "receipt"
  | "issue"
  | "transfer"
  | "adjustment_increase"
  | "adjustment_decrease"
  | "reservation"
  | "reservation_release"
  | "allocation"
  | "allocation_release"
  | "damage"
  | "inspection_hold"
  | "inspection_release"
  | "return"
  | "shipment"
  | "count_correction"
  | "reversal";

export type InventoryMovementStatus =
  | "draft"
  | "requested"
  | "completed"
  | "rejected"
  | "reversed"
  | "cancelled";

export type InventoryMovementRecord = {
  movementId: string;
  organizationId: string;
  productId: string;
  sourceLocationId: string | null;
  destinationLocationId: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  unitOfMeasure: InventoryUnitOfMeasure;
  reasonCode: string;
  referenceType: string | null;
  referenceId: string | null;
  actorReference: string;
  correlationId: string | null;
  idempotencyKey: string | null;
  status: InventoryMovementStatus;
  requestedAt: string;
  completedAt: string | null;
  reversedMovementId: string | null;
  notes: string | null;
  evidenceReference: string | null;
};

export type InventoryReservationStatus =
  | "pending"
  | "active"
  | "released"
  | "expired"
  | "fulfilled"
  | "cancelled"
  | "rejected";

export type InventoryReservationType =
  | "quote_hold"
  | "order_hold"
  | "project_allocation"
  | "rental_hold"
  | "internal_hold"
  | "manual_hold";

export type InventoryReservationRecord = {
  reservationId: string;
  organizationId: string;
  productId: string;
  locationId: string;
  siteId: string | null;
  quantity: number;
  unitOfMeasure: InventoryUnitOfMeasure;
  status: InventoryReservationStatus;
  reservationType: InventoryReservationType;
  referenceType: string | null;
  referenceId: string | null;
  requestedBy: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  releasedAt: string | null;
  fulfilledAt: string | null;
  notes: string | null;
};

export type InventoryAvailabilityDisplayPolicy =
  | "show_exact_quantity"
  | "show_stock_status_only"
  | "hide_quantity"
  | "allow_backorder"
  | "inquiry_only"
  | "made_to_order"
  | "rental_separate"
  | "not_displayed";

export type InventoryLocationAvailabilitySummary = {
  locationId: string;
  locationName: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  incomingQuantity: number;
  damagedQuantity: number;
  inspectionHoldQuantity: number;
  backorderedQuantity: number;
  stockStatus: InventoryStockStatus;
  fulfillmentCapable: boolean;
};

export type InventoryAvailabilityResult = {
  productId: string;
  siteId: string | null;
  locationSummaries: readonly InventoryLocationAvailabilitySummary[];
  onHandTotal: number;
  reservedTotal: number;
  availableTotal: number;
  incomingTotal: number;
  damagedTotal: number;
  inspectionHoldTotal: number;
  backorderedTotal: number;
  stockStatus: InventoryStockStatus;
  fulfillmentLocationIds: readonly string[];
  warnings: readonly string[];
  blockingConditions: readonly string[];
  evaluationTimestamp: string;
};

export type InventoryReorderEvaluation = {
  productId: string;
  locationId: string;
  reorderRecommended: boolean;
  suggestedReorderQuantity: number;
  reason: string;
  warningLevel: "none" | "low" | "medium" | "high";
  evaluationTimestamp: string;
};

export type InventoryCountStatus =
  | "draft"
  | "in_progress"
  | "submitted"
  | "approved"
  | "applied"
  | "cancelled";

export type InventoryCountRecord = {
  countId: string;
  organizationId: string;
  locationId: string;
  productId: string;
  expectedQuantity: number;
  countedQuantity: number;
  varianceQuantity: number;
  status: InventoryCountStatus;
  actor: string;
  timestamp: string;
  adjustmentReference: string | null;
};

export type InventoryValidationIssue = {
  field: string;
  message: string;
};

export type InventoryValidationResult = {
  valid: boolean;
  issues: readonly InventoryValidationIssue[];
};

export type InventoryLocationFilters = {
  organizationId?: string;
  siteId?: string;
  locationType?: InventoryLocationType;
  lifecycleState?: InventoryLocationLifecycleState;
  enabled?: boolean;
  query?: string;
};

export type InventoryStockFilters = {
  organizationId?: string;
  siteId?: string;
  locationId?: string;
  productId?: string;
  stockStatus?: InventoryStockStatus;
  lowStockOnly?: boolean;
  enabledLocationOnly?: boolean;
  query?: string;
};

export type NewInventoryMovementInput = {
  organizationId: string;
  productId: string;
  sourceLocationId: string | null;
  destinationLocationId: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  unitOfMeasure: InventoryUnitOfMeasure;
  reasonCode: string;
  referenceType: string | null;
  referenceId: string | null;
  actorReference: string;
  correlationId: string | null;
  idempotencyKey: string | null;
  notes: string | null;
  evidenceReference: string | null;
};

export type NewInventoryReservationInput = {
  organizationId: string;
  productId: string;
  locationId: string;
  siteId: string | null;
  quantity: number;
  unitOfMeasure: InventoryUnitOfMeasure;
  reservationType: InventoryReservationType;
  referenceType: string | null;
  referenceId: string | null;
  requestedBy: string;
  expiresAt: string | null;
  notes: string | null;
};

export type InventoryActivityType =
  | "location_created"
  | "location_updated"
  | "inventory_received"
  | "inventory_issued"
  | "inventory_transferred"
  | "inventory_adjusted"
  | "inventory_damaged"
  | "inventory_hold_placed"
  | "inventory_hold_released"
  | "reservation_created"
  | "reservation_released"
  | "reservation_fulfilled"
  | "movement_reversed"
  | "inventory_count_submitted"
  | "inventory_count_applied"
  | "availability_evaluated"
  | "reorder_evaluated";

export type InventoryActivityRecord = {
  activityId: string;
  organizationId: string;
  productId: string | null;
  locationId: string | null;
  type: InventoryActivityType;
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
  resultType?:
    | "product"
    | "category"
    | "manufacturer"
    | "inventory"
    | "location"
    | "movement"
    | "reservation"
    | "profile"
    | "customer"
    | "contact"
    | "address"
    | "quote"
    | "quote_line"
    | "quote_revision"
    | "quote_audit"
    | "order"
    | "order_revision"
    | "order_audit"
    | "manufacturing_foundation"
    | "manufacturing_revision"
    | "manufacturing_audit"
    | "work_order"
    | "work_order_revision"
    | "work_order_audit"
    | "production_job"
    | "production_job_revision"
    | "production_job_audit"
    | "generic";
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
