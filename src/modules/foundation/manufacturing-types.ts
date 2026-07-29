import type { PermissionAction } from "./types";

export type ManufacturingComponentType =
  | "aggregate_base"
  | "repository"
  | "validation"
  | "selectors"
  | "lifecycle"
  | "audit"
  | "revisions"
  | "events"
  | "search"
  | "authorization"
  | "identity"
  | "persistence";

export type ManufacturingFoundationStatus =
  | "draft"
  | "active"
  | "suspended"
  | "retired";

export type ManufacturingAuditEventType =
  | "foundation_initialized"
  | "component_registered"
  | "component_updated"
  | "component_status_changed"
  | "component_revised"
  | "component_viewed";

export type ManufacturingPublishedEventType =
  | "ManufacturingFoundationInitialized"
  | "ManufacturingComponentRegistered"
  | "ManufacturingComponentUpdated"
  | "ManufacturingComponentStatusChanged"
  | "ManufacturingComponentRevised";

export type ManufacturingPermissionAction = Extract<
  PermissionAction,
  | "manufacturing:read"
  | "manufacturing:create"
  | "manufacturing:update"
  | "manufacturing:revise"
  | "manufacturing:transition"
  | "manufacturing:view_audit"
  | "manufacturing:publish_events"
>;

export type ManufacturingAuditEnvelope = {
  createdBy: string;
  updatedBy: string;
  correlationId: string | null;
};

export type ManufacturingRevisionRecord = {
  revisionNumber: number;
  parentRevision: number | null;
  author: string;
  timestamp: string;
  reason: string;
  changedFields: readonly string[];
  previousStatus: ManufacturingFoundationStatus;
  nextStatus: ManufacturingFoundationStatus;
};

export type ManufacturingFoundationRecord = {
  componentId: string;
  componentNumber: string;
  componentKey: string;
  organizationId: string;
  siteReference: string | null;
  owningApplicationId: "gmp";
  componentType: ManufacturingComponentType;
  displayName: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  revision: number;
  status: ManufacturingFoundationStatus;
  enabled: boolean;
  identityModelVersion: string;
  repositoryContractVersion: string;
  validationContractVersion: string;
  selectorContractVersion: string;
  lifecycleContractVersion: string;
  auditContractVersion: string;
  revisionContractVersion: string;
  searchContractVersion: string;
  authorizationContractVersion: string;
  eventContractVersion: string;
  persistenceContractVersion: string;
  metadata: Readonly<Record<string, string>>;
  auditEnvelope: ManufacturingAuditEnvelope;
  revisionHistory: readonly ManufacturingRevisionRecord[];
};

export type ManufacturingAuditEvent = {
  eventId: string;
  componentId: string;
  organizationId: string;
  type: ManufacturingAuditEventType;
  actor: string;
  createdAt: string;
  summary: string;
  correlationId: string | null;
};

export type ManufacturingPublishedEvent = {
  eventId: string;
  componentId: string;
  organizationId: string;
  type: ManufacturingPublishedEventType;
  actor: string;
  createdAt: string;
  payload: Readonly<Record<string, string | number | boolean | null>>;
};

export type ManufacturingValidationIssue = {
  field: string;
  message: string;
};

export type ManufacturingValidationResult = {
  valid: boolean;
  issues: readonly ManufacturingValidationIssue[];
};

export type NewManufacturingComponentInput = {
  organizationId: string;
  siteReference: string | null;
  componentType: ManufacturingComponentType;
  componentKey: string;
  displayName: string;
  description: string | null;
  metadata: Readonly<Record<string, string>>;
};

export type UpdateManufacturingComponentInput = Partial<
  Pick<
    ManufacturingFoundationRecord,
    | "siteReference"
    | "displayName"
    | "description"
    | "enabled"
    | "metadata"
    | "status"
  >
>;

export type ManufacturingListFilters = {
  organizationId?: string;
  siteReference?: string;
  componentType?: ManufacturingComponentType;
  status?: ManufacturingFoundationStatus;
  query?: string;
};

export type ManufacturingSearchFilters = {
  organizationId?: string;
  siteReference?: string;
  query: string;
};

export type ManufacturingSearchResult = {
  componentId: string;
  componentNumber: string;
  componentKey: string;
  componentType: ManufacturingComponentType;
  status: ManufacturingFoundationStatus;
  matchedFields: readonly string[];
};
