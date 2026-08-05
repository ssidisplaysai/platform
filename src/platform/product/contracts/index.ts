export type ProductId = string;
export type ProductVariantId = string;
export type ProductFamilyId = string;
export type CategoryId = string;
export type AttributeDefinitionId = string;
export type OptionDefinitionId = string;
export type ConfigurationId = string;
export type ConfigurationRuleId = string;
export type ProductRelationshipId = string;
export type ProductBundleId = string;
export type ProductKitId = string;
export type ProductVersionId = string;
export type PricingDefinitionId = string;
export type BillOfMaterialDefinitionId = string;
export type ReferenceId = string;
export type VersionIdentifier = string;
export type TenantId = string;

export type LifecycleState =
  | "DRAFT"
  | "PROPOSED"
  | "APPROVED"
  | "ACTIVE"
  | "DEPRECATED"
  | "RETIRED"
  | "ARCHIVED";

export type ProductActorContext = {
  actorId: string;
  occurredAt: string;
  source?: string;
  correlationId?: string;
  causationId?: string;
};

export type ProductMetadataValue = string | number | boolean | null;
export type ProductMetadata = Record<string, ProductMetadataValue>;

export type AttributeValue = {
  attributeDefinitionId: AttributeDefinitionId;
  value: string;
};

export type Product = {
  productId: ProductId;
  tenantId: TenantId;
  productCode: string;
  versionIdentifier: VersionIdentifier;
  productFamilyId: ProductFamilyId;
  categoryId: CategoryId;
  displayName: string;
  lifecycleState: LifecycleState;
  metadata: ProductMetadata;
  attributes: AttributeValue[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type ProductVariant = {
  productVariantId: ProductVariantId;
  tenantId: TenantId;
  productId: ProductId;
  sku: string;
  displayName: string;
  lifecycleState: LifecycleState;
  versionIdentifier: VersionIdentifier;
  attributes: AttributeValue[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type ProductFamily = {
  productFamilyId: ProductFamilyId;
  tenantId: TenantId;
  code: string;
  displayName: string;
  description?: string;
};

export type Category = {
  categoryId: CategoryId;
  tenantId: TenantId;
  code: string;
  displayName: string;
  parentCategoryId?: CategoryId;
};

export type AttributeDefinition = {
  attributeDefinitionId: AttributeDefinitionId;
  tenantId: TenantId;
  code: string;
  displayName: string;
  valueType: "STRING" | "NUMBER" | "BOOLEAN";
  required: boolean;
};

export type OptionDefinition = {
  optionDefinitionId: OptionDefinitionId;
  tenantId: TenantId;
  attributeDefinitionId: AttributeDefinitionId;
  code: string;
  displayName: string;
};

export type ConfigurationRule = {
  configurationRuleId: ConfigurationRuleId;
  expression: string;
  severity: "ERROR" | "WARN";
};

export type Configuration = {
  configurationId: ConfigurationId;
  tenantId: TenantId;
  productId: ProductId;
  lifecycleState: LifecycleState;
  versionIdentifier: VersionIdentifier;
  rules: ConfigurationRule[];
};

export type ProductRelationship = {
  productRelationshipId: ProductRelationshipId;
  tenantId: TenantId;
  sourceProductId: ProductId;
  targetProductId: ProductId;
  kind: "REQUIRES" | "REPLACES" | "COMPATIBLE_WITH";
  lifecycleState?: LifecycleState;
};

export type ProductBundle = {
  productBundleId: ProductBundleId;
  tenantId: TenantId;
  code: string;
  lifecycleState: LifecycleState;
  versionIdentifier: VersionIdentifier;
  componentProductIds: ProductId[];
};

export type ProductKit = {
  productKitId: ProductKitId;
  tenantId: TenantId;
  code: string;
  lifecycleState: LifecycleState;
  versionIdentifier: VersionIdentifier;
  componentProductIds: ProductId[];
};

export type ProductVersion = {
  productVersionId: ProductVersionId;
  tenantId: TenantId;
  productId: ProductId;
  versionIdentifier: VersionIdentifier;
  revisionIdentifier: string;
  effectiveFrom: string;
  lifecycleState: LifecycleState;
};

export type PricingDefinition = {
  pricingDefinitionId: PricingDefinitionId;
  tenantId: TenantId;
  productId: ProductId;
  currency: string;
  amount: number;
  lifecycleState: LifecycleState;
  versionIdentifier: VersionIdentifier;
};

export type BillOfMaterialDefinition = {
  billOfMaterialDefinitionId: BillOfMaterialDefinitionId;
  tenantId: TenantId;
  productId: ProductId;
  components: Array<{ componentProductId: ProductId; quantity: number }>;
  lifecycleState: LifecycleState;
  versionIdentifier: VersionIdentifier;
};

export type AssetReference = {
  referenceId: ReferenceId;
  tenantId: TenantId;
  productId: ProductId;
  assetId: string;
};

export type DocumentReference = {
  referenceId: ReferenceId;
  tenantId: TenantId;
  productId: ProductId;
  documentId: string;
};

export type KnowledgeReference = {
  referenceId: ReferenceId;
  tenantId: TenantId;
  productId: ProductId;
  knowledgeId: string;
};

export type OrganizationReference = {
  referenceId: ReferenceId;
  tenantId: TenantId;
  productId: ProductId;
  organizationId: string;
};

export type ProductAuditRecord = {
  auditId: string;
  eventType: string;
  tenantId: TenantId;
  productId?: ProductId;
  actor: ProductActorContext;
  message: string;
  details?: Record<string, unknown>;
  recordedAt: string;
};

export type ProductMetrics = {
  productTotal: number;
  variantTotal: number;
  familyTotal: number;
  categoryTotal: number;
  bundleTotal: number;
  kitTotal: number;
  pricingDefinitionTotal: number;
  bomDefinitionTotal: number;
  productVersionTotal: number;
  activeProducts: number;
  deprecatedProducts: number;
  retiredProducts: number;
  archivedProducts: number;
  invalidReferenceCount: number;
  versionConflictCount: number;
  providerConflictCount: number;
  invariantViolationCount: number;
  recoveryCount: number;
  corruptStateCount: number;
  auditEvents: number;
};

export type ProductHealth = {
  status: "HEALTHY" | "DEGRADED" | "FAILED";
  generatedAt: string;
  checks: Array<{
    name: "persistence" | "provider-registry" | "invariants" | "references" | "audit" | "integration-ports";
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
};

export type ProductPersistedState = {
  schemaVersion: "1.1.0";
  products: Product[];
  variants: ProductVariant[];
  productFamilies: ProductFamily[];
  categories: Category[];
  attributeDefinitions: AttributeDefinition[];
  optionDefinitions: OptionDefinition[];
  configurations: Configuration[];
  productRelationships: ProductRelationship[];
  productBundles: ProductBundle[];
  productKits: ProductKit[];
  productVersions: ProductVersion[];
  pricingDefinitions: PricingDefinition[];
  billOfMaterialDefinitions: BillOfMaterialDefinition[];
  assetReferences: AssetReference[];
  documentReferences: DocumentReference[];
  knowledgeReferences: KnowledgeReference[];
  organizationReferences: OrganizationReference[];
  audits: ProductAuditRecord[];
  metrics: ProductMetrics;
};

export function createDefaultProductMetrics(): ProductMetrics {
  return {
    productTotal: 0,
    variantTotal: 0,
    familyTotal: 0,
    categoryTotal: 0,
    bundleTotal: 0,
    kitTotal: 0,
    pricingDefinitionTotal: 0,
    bomDefinitionTotal: 0,
    productVersionTotal: 0,
    activeProducts: 0,
    deprecatedProducts: 0,
    retiredProducts: 0,
    archivedProducts: 0,
    invalidReferenceCount: 0,
    versionConflictCount: 0,
    providerConflictCount: 0,
    invariantViolationCount: 0,
    recoveryCount: 0,
    corruptStateCount: 0,
    auditEvents: 0,
  };
}

export function createDefaultProductPersistedState(): ProductPersistedState {
  return {
    schemaVersion: "1.1.0",
    products: [],
    variants: [],
    productFamilies: [],
    categories: [],
    attributeDefinitions: [],
    optionDefinitions: [],
    configurations: [],
    productRelationships: [],
    productBundles: [],
    productKits: [],
    productVersions: [],
    pricingDefinitions: [],
    billOfMaterialDefinitions: [],
    assetReferences: [],
    documentReferences: [],
    knowledgeReferences: [],
    organizationReferences: [],
    audits: [],
    metrics: createDefaultProductMetrics(),
  };
}

export const validLifecycleStates: readonly LifecycleState[] = [
  "DRAFT",
  "PROPOSED",
  "APPROVED",
  "ACTIVE",
  "DEPRECATED",
  "RETIRED",
  "ARCHIVED",
] as const;

export function isLifecycleState(value: string): value is LifecycleState {
  return validLifecycleStates.includes(value as LifecycleState);
}

export type ProductErrorCode =
  | "PRODUCT_INVALID"
  | "PRODUCT_DUPLICATE"
  | "PRODUCT_NOT_FOUND"
  | "TENANT_MISMATCH"
  | "VERSION_CONFLICT"
  | "LIFECYCLE_TRANSITION_INVALID"
  | "LIFECYCLE_STATE_INVALID"
  | "IMMUTABLE_FIELD"
  | "REFERENCE_INVALID"
  | "BOUNDARY_VIOLATION"
  | "STATE_CORRUPT"
  | "PERSISTENCE_FAILURE"
  | "RECOVERY_FAILURE";

export type ProductErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export class ProductError extends Error {
  constructor(
    public readonly code: ProductErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly auditRequired: boolean,
    public readonly severity: ProductErrorSeverity,
  ) {
    super(message);
    this.name = "ProductError";
  }
}
