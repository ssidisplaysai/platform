import { randomUUID } from "node:crypto";
import type {
  HierarchyNode,
  Organization,
  OrganizationId,
  OrganizationLifecycleTransition,
  OrganizationMetadata,
  OrganizationPersistedState,
  OrganizationRelationship,
  OrganizationSettings,
  OrganizationStatus,
  OrganizationType,
} from "../contracts";
import { createDefaultPersistedState } from "../contracts";
import type { OrganizationPersistence } from "../persistence";
import type { OrganizationAuditWriter } from "../audit";
import type { OrganizationMetricsService } from "../metrics";

function nowIso(): string {
  return new Date().toISOString();
}

function canTransition(from: OrganizationStatus, to: OrganizationStatus): boolean {
  if (from === to) {
    return true;
  }

  const map: Record<OrganizationStatus, OrganizationStatus[]> = {
    DRAFT: ["ACTIVE", "ARCHIVED"],
    ACTIVE: ["INACTIVE", "SUSPENDED", "ARCHIVED"],
    INACTIVE: ["ACTIVE", "ARCHIVED"],
    SUSPENDED: ["ACTIVE", "ARCHIVED"],
    ARCHIVED: [],
  };

  return map[from].includes(to);
}

export class OrganizationRegistry {
  private state: OrganizationPersistedState = createDefaultPersistedState();

  constructor(
    private readonly persistence: OrganizationPersistence,
    private readonly audit: OrganizationAuditWriter,
    private readonly metrics: OrganizationMetricsService,
  ) {}

  async load(): Promise<void> {
    this.state = await this.persistence.load();
    this.audit.replace(this.state.audits);
    this.metrics.replace(this.state.metrics);
    this.metrics.recalculateOrganizations(this.state.organizations);
    this.metrics.setHierarchyNodeCount(this.state.hierarchy.length);
    this.metrics.setRelationshipCount(this.state.relationships.length);
    this.metrics.increment("persistenceLoadCount", 1);
  }

  async save(): Promise<void> {
    this.state.audits = this.audit.list(10000);
    this.state.metrics = this.metrics.snapshot();
    await this.persistence.save(this.state);
    this.metrics.increment("persistenceSaveCount", 1);
  }

  listOrganizations(): Organization[] {
    return this.state.organizations.map((item) => structuredClone(item));
  }

  getOrganization(organizationId: OrganizationId): Organization | undefined {
    const found = this.state.organizations.find((item) => item.organizationId === organizationId);
    return found ? structuredClone(found) : undefined;
  }

  async registerOrganization(input: {
    organizationId?: OrganizationId;
    type: OrganizationType;
    name: string;
    displayName?: string;
    tenantId?: string;
    legalEntityCode?: string;
    createdBy: string;
    metadata?: OrganizationMetadata;
    settings?: OrganizationSettings;
  }): Promise<Organization> {
    const createdAt = nowIso();
    const organization: Organization = {
      organizationId: input.organizationId ?? `org_${randomUUID()}`,
      type: input.type,
      name: input.name,
      displayName: input.displayName,
      tenantId: input.tenantId,
      legalEntityCode: input.legalEntityCode,
      status: "DRAFT",
      metadata: structuredClone(input.metadata ?? {}),
      settings: structuredClone(input.settings ?? {}),
      lifecycle: {
        createdAt,
        createdBy: input.createdBy,
        updatedAt: createdAt,
        updatedBy: input.createdBy,
        transitions: [],
      },
    };

    this.state.organizations.push(organization);
    this.metrics.recalculateOrganizations(this.state.organizations);
    this.audit.append({
      eventType: "ORGANIZATION_REGISTERED",
      organizationId: organization.organizationId,
      actorId: input.createdBy,
      message: `organization ${organization.organizationId} registered`,
      details: { type: organization.type, name: organization.name },
    });
    this.metrics.increment("auditRecordCount", 1);
    await this.save();
    return structuredClone(organization);
  }

  async updateMetadata(organizationId: OrganizationId, metadata: OrganizationMetadata, actorId: string): Promise<Organization> {
    const organization = this.requireOrganizationRef(organizationId);
    organization.metadata = structuredClone(metadata);
    organization.lifecycle.updatedAt = nowIso();
    organization.lifecycle.updatedBy = actorId;

    this.metrics.increment("metadataUpdateCount", 1);
    this.audit.append({
      eventType: "ORGANIZATION_METADATA_UPDATED",
      organizationId,
      actorId,
      message: "organization metadata updated",
    });
    this.metrics.increment("auditRecordCount", 1);
    await this.save();
    return structuredClone(organization);
  }

  async updateSettings(organizationId: OrganizationId, settings: OrganizationSettings, actorId: string): Promise<Organization> {
    const organization = this.requireOrganizationRef(organizationId);
    organization.settings = structuredClone(settings);
    organization.lifecycle.updatedAt = nowIso();
    organization.lifecycle.updatedBy = actorId;

    this.metrics.increment("settingsUpdateCount", 1);
    this.audit.append({
      eventType: "ORGANIZATION_SETTINGS_UPDATED",
      organizationId,
      actorId,
      message: "organization settings updated",
    });
    this.metrics.increment("auditRecordCount", 1);
    await this.save();
    return structuredClone(organization);
  }

  async applyStatusTransition(organizationId: OrganizationId, transition: OrganizationLifecycleTransition): Promise<Organization> {
    const organization = this.requireOrganizationRef(organizationId);

    if (!canTransition(organization.status, transition.to)) {
      throw new Error(`invalid status transition: ${organization.status} -> ${transition.to}`);
    }

    if (organization.status !== transition.from) {
      throw new Error(`transition from status mismatch: expected ${organization.status} got ${transition.from}`);
    }

    organization.status = transition.to;
    organization.lifecycle.statusChangedAt = transition.occurredAt;
    organization.lifecycle.statusChangedBy = transition.actorId;
    organization.lifecycle.updatedAt = transition.occurredAt;
    organization.lifecycle.updatedBy = transition.actorId;
    organization.lifecycle.transitions.push(structuredClone(transition));

    this.metrics.recalculateOrganizations(this.state.organizations);
    this.metrics.increment("lifecycleTransitionCount", 1);
    this.audit.append({
      eventType: "ORGANIZATION_STATUS_CHANGED",
      organizationId,
      actorId: transition.actorId,
      message: `status changed from ${transition.from} to ${transition.to}`,
      details: { reason: transition.reason },
    });
    this.metrics.increment("auditRecordCount", 1);
    await this.save();
    return structuredClone(organization);
  }

  hierarchyNodes(): HierarchyNode[] {
    return this.state.hierarchy.map((item) => structuredClone(item));
  }

  relationships(): OrganizationRelationship[] {
    return this.state.relationships.map((item) => structuredClone(item));
  }

  setHierarchyNodes(nodes: HierarchyNode[]): void {
    this.state.hierarchy = nodes.map((node) => structuredClone(node));
    this.metrics.setHierarchyNodeCount(this.state.hierarchy.length);
  }

  setRelationships(relationships: OrganizationRelationship[]): void {
    this.state.relationships = relationships.map((item) => structuredClone(item));
    this.metrics.setRelationshipCount(this.state.relationships.length);
  }

  private requireOrganizationRef(organizationId: OrganizationId): Organization {
    const found = this.state.organizations.find((item) => item.organizationId === organizationId);
    if (!found) {
      throw new Error(`organization not found: ${organizationId}`);
    }
    return found;
  }
}

export class OrganizationHierarchyService {
  constructor(
    private readonly registry: OrganizationRegistry,
    private readonly audit: OrganizationAuditWriter,
    private readonly metrics: OrganizationMetricsService,
  ) {}

  async upsertNode(input: {
    organizationId: OrganizationId;
    parentOrganizationId?: OrganizationId;
    actorId: string;
  }): Promise<HierarchyNode> {
    if (!this.registry.getOrganization(input.organizationId)) {
      throw new Error(`organization not found: ${input.organizationId}`);
    }

    if (input.parentOrganizationId && !this.registry.getOrganization(input.parentOrganizationId)) {
      throw new Error(`parent organization not found: ${input.parentOrganizationId}`);
    }

    const nodes = this.registry.hierarchyNodes();
    const children = nodes
      .filter((node) => node.parentOrganizationId === input.organizationId)
      .map((node) => node.organizationId);

    const parentNode = input.parentOrganizationId
      ? nodes.find((node) => node.organizationId === input.parentOrganizationId)
      : undefined;

    const path = parentNode
      ? [...parentNode.path, input.organizationId]
      : [input.organizationId];

    const node: HierarchyNode = {
      nodeId: `orgnode_${input.organizationId}`,
      organizationId: input.organizationId,
      parentOrganizationId: input.parentOrganizationId,
      childOrganizationIds: children,
      depth: path.length - 1,
      path,
      updatedAt: nowIso(),
    };

    const existingIdx = nodes.findIndex((item) => item.organizationId === input.organizationId);
    if (existingIdx >= 0) {
      nodes[existingIdx] = node;
    } else {
      nodes.push(node);
    }

    if (input.parentOrganizationId) {
      const parentIdx = nodes.findIndex((item) => item.organizationId === input.parentOrganizationId);
      if (parentIdx >= 0 && !nodes[parentIdx].childOrganizationIds.includes(input.organizationId)) {
        nodes[parentIdx].childOrganizationIds.push(input.organizationId);
        nodes[parentIdx].updatedAt = nowIso();
      }
    }

    this.registry.setHierarchyNodes(nodes);
    await this.registry.save();

    this.audit.append({
      eventType: "ORGANIZATION_HIERARCHY_UPDATED",
      organizationId: input.organizationId,
      actorId: input.actorId,
      message: "organization hierarchy node upserted",
      details: { parentOrganizationId: input.parentOrganizationId, depth: node.depth },
    });
    this.metrics.increment("auditRecordCount", 1);

    return structuredClone(node);
  }

  list(): HierarchyNode[] {
    return this.registry.hierarchyNodes();
  }
}

export class OrganizationLifecycleService {
  constructor(private readonly registry: OrganizationRegistry) {}

  async transitionStatus(input: {
    organizationId: OrganizationId;
    from: OrganizationStatus;
    to: OrganizationStatus;
    actorId: string;
    reason?: string;
  }): Promise<Organization> {
    return this.registry.applyStatusTransition(input.organizationId, {
      from: input.from,
      to: input.to,
      actorId: input.actorId,
      reason: input.reason,
      occurredAt: nowIso(),
    });
  }
}

export class OrganizationRelationshipService {
  constructor(
    private readonly registry: OrganizationRegistry,
    private readonly audit: OrganizationAuditWriter,
    private readonly metrics: OrganizationMetricsService,
  ) {}

  async createRelationship(input: {
    fromOrganizationId: OrganizationId;
    toOrganizationId: OrganizationId;
    relationshipType: OrganizationRelationship["relationshipType"];
    actorId: string;
    metadata?: OrganizationMetadata;
  }): Promise<OrganizationRelationship> {
    if (!this.registry.getOrganization(input.fromOrganizationId)) {
      throw new Error(`organization not found: ${input.fromOrganizationId}`);
    }
    if (!this.registry.getOrganization(input.toOrganizationId)) {
      throw new Error(`organization not found: ${input.toOrganizationId}`);
    }

    const relationship: OrganizationRelationship = {
      relationshipId: `orgrel_${randomUUID()}`,
      fromOrganizationId: input.fromOrganizationId,
      toOrganizationId: input.toOrganizationId,
      relationshipType: input.relationshipType,
      active: true,
      metadata: structuredClone(input.metadata ?? {}),
      createdAt: nowIso(),
      createdBy: input.actorId,
    };

    const relationships = this.registry.relationships();
    relationships.push(relationship);
    this.registry.setRelationships(relationships);
    await this.registry.save();

    this.audit.append({
      eventType: "ORGANIZATION_RELATIONSHIP_CREATED",
      organizationId: input.fromOrganizationId,
      actorId: input.actorId,
      message: "organization relationship created",
      details: { toOrganizationId: input.toOrganizationId, relationshipType: input.relationshipType },
    });
    this.metrics.increment("auditRecordCount", 1);

    return structuredClone(relationship);
  }

  list(): OrganizationRelationship[] {
    return this.registry.relationships();
  }
}

export class OrganizationSettingsService {
  constructor(private readonly registry: OrganizationRegistry) {}

  async updateSettings(organizationId: OrganizationId, settings: OrganizationSettings, actorId: string): Promise<Organization> {
    return this.registry.updateSettings(organizationId, settings, actorId);
  }
}

export class OrganizationMetadataService {
  constructor(private readonly registry: OrganizationRegistry) {}

  async updateMetadata(organizationId: OrganizationId, metadata: OrganizationMetadata, actorId: string): Promise<Organization> {
    return this.registry.updateMetadata(organizationId, metadata, actorId);
  }
}
