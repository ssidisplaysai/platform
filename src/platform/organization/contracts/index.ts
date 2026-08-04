export type OrganizationId = string;

export type OrganizationType =
  | "ORGANIZATION"
  | "COMPANY"
  | "BUSINESS_UNIT"
  | "BRAND"
  | "DIVISION"
  | "LOCATION"
  | "DEPARTMENT"
  | "LEGAL_ENTITY"
  | "TENANT";

export type OrganizationStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";

export type OrganizationMetadata = Record<string, string | number | boolean | null>;
export type OrganizationSettings = Record<string, string | number | boolean | null>;

export type OrganizationIdentityDependency = {
  resolveIdentity(actorId: string): Promise<{ actorId: string; actorName?: string } | null>;
};

export type OrganizationAuthorizationDependency = {
  authorize(input: {
    actorId: string;
    action: string;
    organizationId?: OrganizationId;
  }): Promise<{ allowed: boolean; reason?: string }>;
};

export type OrganizationMessagingDependency = {
  inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }>;
};

export type OrganizationWorkflowDependency = {
  inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }>;
};

export type OrganizationSchedulingDependency = {
  inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }>;
};

export type OrganizationNotificationDependency = {
  inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }>;
};

export type OrganizationAIDependency = {
  inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }>;
};

export type OrganizationPlatformDependencies = {
  identity: OrganizationIdentityDependency;
  authorization: OrganizationAuthorizationDependency;
  messaging: OrganizationMessagingDependency;
  workflow: OrganizationWorkflowDependency;
  scheduling: OrganizationSchedulingDependency;
  notifications: OrganizationNotificationDependency;
  ai: OrganizationAIDependency;
};

export type OrganizationLifecycleTransition = {
  from: OrganizationStatus;
  to: OrganizationStatus;
  actorId: string;
  reason?: string;
  occurredAt: string;
};

export type OrganizationLifecycle = {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  statusChangedAt?: string;
  statusChangedBy?: string;
  transitions: OrganizationLifecycleTransition[];
};

export type Organization = {
  organizationId: OrganizationId;
  externalId?: string;
  type: OrganizationType;
  name: string;
  displayName?: string;
  status: OrganizationStatus;
  tenantId?: string;
  legalEntityCode?: string;
  metadata: OrganizationMetadata;
  settings: OrganizationSettings;
  lifecycle: OrganizationLifecycle;
};

export type BusinessUnit = {
  businessUnitId: string;
  organizationId: OrganizationId;
  name: string;
};

export type Brand = {
  brandId: string;
  organizationId: OrganizationId;
  name: string;
};

export type Division = {
  divisionId: string;
  organizationId: OrganizationId;
  name: string;
};

export type Location = {
  locationId: string;
  organizationId: OrganizationId;
  name: string;
  countryCode?: string;
};

export type Department = {
  departmentId: string;
  organizationId: OrganizationId;
  name: string;
};

export type Tenant = {
  tenantId: string;
  organizationId: OrganizationId;
  slug: string;
};

export type HierarchyNode = {
  nodeId: string;
  organizationId: OrganizationId;
  parentOrganizationId?: OrganizationId;
  childOrganizationIds: OrganizationId[];
  depth: number;
  path: OrganizationId[];
  updatedAt: string;
};

export type OrganizationRelationship = {
  relationshipId: string;
  fromOrganizationId: OrganizationId;
  toOrganizationId: OrganizationId;
  relationshipType: "PARENT_OF" | "ASSOCIATED_WITH" | "SUPPLIES" | "PARTNERS_WITH" | "SERVICES";
  active: boolean;
  metadata?: OrganizationMetadata;
  createdAt: string;
  createdBy: string;
};

export type OrganizationAuditRecord = {
  recordId: string;
  eventType: string;
  organizationId?: OrganizationId;
  actorId?: string;
  message: string;
  details?: Record<string, unknown>;
  recordedAt: string;
};

export type OrganizationMetricsSnapshot = {
  organizationCount: number;
  activeOrganizationCount: number;
  suspendedOrganizationCount: number;
  archivedOrganizationCount: number;
  hierarchyNodeCount: number;
  relationshipCount: number;
  lifecycleTransitionCount: number;
  settingsUpdateCount: number;
  metadataUpdateCount: number;
  auditRecordCount: number;
  persistenceLoadCount: number;
  persistenceSaveCount: number;
};

export type OrganizationHealthSnapshot = {
  status: "HEALTHY" | "DEGRADED";
  checks: Array<{
    name: "persistence" | "registry" | "hierarchy" | "relationships" | "audit" | "metrics" | "integration";
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
  generatedAt: string;
};

export type OrganizationIntegrationSnapshot = {
  capabilityId: "platform.organization";
  capabilityName: string;
  version: string;
  health: OrganizationHealthSnapshot;
  metrics: OrganizationMetricsSnapshot;
  consumedBoundaries: {
    identity: boolean;
    authorization: boolean;
    messaging: boolean;
    workflow: boolean;
    scheduling: boolean;
    notifications: boolean;
    ai: boolean;
  };
  readiness: {
    providerNeutral: boolean;
    applicationNeutral: boolean;
    workflowNeutral: boolean;
    schedulingNeutral: boolean;
    messagingNeutral: boolean;
    notificationNeutral: boolean;
    missionControlCompatible: boolean;
  };
};

export type OrganizationPersistedState = {
  schemaVersion: "1.0.0";
  organizations: Organization[];
  hierarchy: HierarchyNode[];
  relationships: OrganizationRelationship[];
  audits: OrganizationAuditRecord[];
  metrics: OrganizationMetricsSnapshot;
};

export function createDefaultOrganizationMetrics(): OrganizationMetricsSnapshot {
  return {
    organizationCount: 0,
    activeOrganizationCount: 0,
    suspendedOrganizationCount: 0,
    archivedOrganizationCount: 0,
    hierarchyNodeCount: 0,
    relationshipCount: 0,
    lifecycleTransitionCount: 0,
    settingsUpdateCount: 0,
    metadataUpdateCount: 0,
    auditRecordCount: 0,
    persistenceLoadCount: 0,
    persistenceSaveCount: 0,
  };
}

export function createDefaultPersistedState(): OrganizationPersistedState {
  return {
    schemaVersion: "1.0.0",
    organizations: [],
    hierarchy: [],
    relationships: [],
    audits: [],
    metrics: createDefaultOrganizationMetrics(),
  };
}
