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

function tenantBoundaryKey(organization: Organization): string {
  if (organization.type === "TENANT") {
    return organization.organizationId;
  }

  return organization.tenantId ?? "__GLOBAL__";
}

function assertSameTenantBoundary(
  left: Organization,
  right: Organization,
  context: "hierarchy" | "relationship",
): void {
  const leftBoundary = tenantBoundaryKey(left);
  const rightBoundary = tenantBoundaryKey(right);

  if (leftBoundary !== rightBoundary) {
    throw new Error(
      `cross-tenant ${context} rejected: ${left.organizationId} (${leftBoundary}) -> ${right.organizationId} (${rightBoundary})`,
    );
  }
}

function validateTenantReference(
  organization: Organization,
  organizationsById: Map<OrganizationId, Organization>,
): void {
  if (organization.type === "TENANT") {
    if (organization.tenantId && organization.tenantId !== organization.organizationId) {
      throw new Error(
        `invalid tenant reference: tenant organization ${organization.organizationId} must reference itself`,
      );
    }
    return;
  }

  if (!organization.tenantId) {
    return;
  }

  const tenant = organizationsById.get(organization.tenantId);
  if (!tenant) {
    throw new Error(`tenant not found: ${organization.tenantId}`);
  }

  if (tenant.type !== "TENANT") {
    throw new Error(`tenant reference is not a tenant organization: ${organization.tenantId}`);
  }
}

function buildParentMap(nodes: HierarchyNode[]): Map<OrganizationId, OrganizationId> {
  const parentByOrg = new Map<OrganizationId, OrganizationId>();

  for (const node of nodes) {
    if (!node.parentOrganizationId) {
      continue;
    }

    parentByOrg.set(node.organizationId, node.parentOrganizationId);
  }

  return parentByOrg;
}

function computePath(
  organizationId: OrganizationId,
  parentByOrg: Map<OrganizationId, OrganizationId>,
): OrganizationId[] {
  const path: OrganizationId[] = [organizationId];
  const visited = new Set<OrganizationId>(path);
  let current = organizationId;

  while (true) {
    const parent = parentByOrg.get(current);
    if (!parent) {
      break;
    }

    if (visited.has(parent)) {
      throw new Error(`recursive ancestor loop detected for organization ${organizationId}`);
    }

    path.push(parent);
    visited.add(parent);
    current = parent;
  }

  return path.reverse();
}

function assertHierarchyIntegrity(
  nodes: HierarchyNode[],
  organizationsById: Map<OrganizationId, Organization>,
): void {
  const organizationIds = new Set<OrganizationId>();

  for (const node of nodes) {
    if (organizationIds.has(node.organizationId)) {
      throw new Error(`duplicate hierarchy node organizationId: ${node.organizationId}`);
    }
    organizationIds.add(node.organizationId);

    if (!organizationsById.has(node.organizationId)) {
      throw new Error(`hierarchy organization not found: ${node.organizationId}`);
    }

    if (!node.parentOrganizationId) {
      continue;
    }

    if (node.parentOrganizationId === node.organizationId) {
      throw new Error(`self-parent hierarchy rejected: ${node.organizationId}`);
    }

    const parentOrganization = organizationsById.get(node.parentOrganizationId);
    if (!parentOrganization) {
      throw new Error(`parent organization not found: ${node.parentOrganizationId}`);
    }

    const childOrganization = organizationsById.get(node.organizationId);
    if (!childOrganization) {
      throw new Error(`hierarchy organization not found: ${node.organizationId}`);
    }

    assertSameTenantBoundary(childOrganization, parentOrganization, "hierarchy");
  }

  const parentByOrg = buildParentMap(nodes);
  for (const organizationId of organizationIds) {
    void computePath(organizationId, parentByOrg);
  }
}

function normalizeHierarchy(
  nodes: HierarchyNode[],
  organizationsById: Map<OrganizationId, Organization>,
): HierarchyNode[] {
  assertHierarchyIntegrity(nodes, organizationsById);

  const parentByOrg = buildParentMap(nodes);
  const childrenByParent = new Map<OrganizationId, OrganizationId[]>();
  const nodeByOrganizationId = new Map<OrganizationId, HierarchyNode>();

  for (const node of nodes) {
    nodeByOrganizationId.set(node.organizationId, node);
    if (!node.parentOrganizationId) {
      continue;
    }

    const children = childrenByParent.get(node.parentOrganizationId) ?? [];
    children.push(node.organizationId);
    childrenByParent.set(node.parentOrganizationId, children);
  }

  return [...nodeByOrganizationId.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((organizationId) => {
      const original = nodeByOrganizationId.get(organizationId);
      if (!original) {
        throw new Error(`hierarchy organization not found: ${organizationId}`);
      }

      const path = computePath(organizationId, parentByOrg);

      return {
        ...original,
        parentOrganizationId: parentByOrg.get(organizationId),
        childOrganizationIds: [...(childrenByParent.get(organizationId) ?? [])].sort((left, right) => left.localeCompare(right)),
        depth: path.length - 1,
        path,
      };
    });
}

function validatePersistedStateOrThrow(state: OrganizationPersistedState): void {
  const organizationsById = new Map<OrganizationId, Organization>();

  for (const organization of state.organizations) {
    if (organizationsById.has(organization.organizationId)) {
      throw new Error(`duplicate organization id in persisted state: ${organization.organizationId}`);
    }
    organizationsById.set(organization.organizationId, organization);
  }

  for (const organization of state.organizations) {
    validateTenantReference(organization, organizationsById);
  }

  assertHierarchyIntegrity(state.hierarchy, organizationsById);

  for (const relationship of state.relationships) {
    const fromOrganization = organizationsById.get(relationship.fromOrganizationId);
    if (!fromOrganization) {
      throw new Error(`relationship source organization not found: ${relationship.fromOrganizationId}`);
    }

    const toOrganization = organizationsById.get(relationship.toOrganizationId);
    if (!toOrganization) {
      throw new Error(`relationship target organization not found: ${relationship.toOrganizationId}`);
    }

    assertSameTenantBoundary(fromOrganization, toOrganization, "relationship");
  }
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
    validatePersistedStateOrThrow(this.state);
    this.state.hierarchy = normalizeHierarchy(this.state.hierarchy, this.organizationsById());
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
    const organizationId = input.organizationId ?? `org_${randomUUID()}`;
    if (this.state.organizations.some((item) => item.organizationId === organizationId)) {
      throw new Error(`duplicate organization id: ${organizationId}`);
    }

    const organization: Organization = {
      organizationId,
      type: input.type,
      name: input.name,
      displayName: input.displayName,
      tenantId: input.type === "TENANT" ? organizationId : input.tenantId,
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

    const organizationsById = this.organizationsById();
    organizationsById.set(organization.organizationId, organization);
    validateTenantReference(organization, organizationsById);

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

  private organizationsById(): Map<OrganizationId, Organization> {
    return new Map(this.state.organizations.map((organization) => [organization.organizationId, organization]));
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
    const organization = this.registry.getOrganization(input.organizationId);
    if (!organization) {
      throw new Error(`organization not found: ${input.organizationId}`);
    }

    if (input.parentOrganizationId === input.organizationId) {
      throw new Error(`self-parent hierarchy rejected: ${input.organizationId}`);
    }

    const parentOrganization = input.parentOrganizationId
      ? this.registry.getOrganization(input.parentOrganizationId)
      : undefined;

    if (input.parentOrganizationId && !parentOrganization) {
      throw new Error(`parent organization not found: ${input.parentOrganizationId}`);
    }

    if (parentOrganization) {
      assertSameTenantBoundary(organization, parentOrganization, "hierarchy");
    }

    const nodes = this.registry.hierarchyNodes();

    const node: HierarchyNode = {
      nodeId: `orgnode_${input.organizationId}`,
      organizationId: input.organizationId,
      parentOrganizationId: input.parentOrganizationId,
      childOrganizationIds: [],
      depth: 0,
      path: [input.organizationId],
      updatedAt: nowIso(),
    };

    const existingIdx = nodes.findIndex((item) => item.organizationId === input.organizationId);
    if (existingIdx >= 0) {
      nodes[existingIdx] = node;
    } else {
      nodes.push(node);
    }

    const organizationsById = new Map(
      this.registry.listOrganizations().map((item) => [item.organizationId, item] as const),
    );
    const normalizedNodes = normalizeHierarchy(nodes, organizationsById).map((item) => ({
      ...item,
      updatedAt: item.organizationId === input.organizationId ? nowIso() : item.updatedAt,
    }));

    this.registry.setHierarchyNodes(normalizedNodes);
    await this.registry.save();

    const createdNode = normalizedNodes.find((item) => item.organizationId === input.organizationId);
    if (!createdNode) {
      throw new Error(`hierarchy organization not found: ${input.organizationId}`);
    }

    this.audit.append({
      eventType: "ORGANIZATION_HIERARCHY_UPDATED",
      organizationId: input.organizationId,
      actorId: input.actorId,
      message: "organization hierarchy node upserted",
      details: { parentOrganizationId: input.parentOrganizationId, depth: createdNode.depth },
    });
    this.metrics.increment("auditRecordCount", 1);

    return structuredClone(createdNode);
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
    const fromOrganization = this.registry.getOrganization(input.fromOrganizationId);
    if (!fromOrganization) {
      throw new Error(`organization not found: ${input.fromOrganizationId}`);
    }

    const toOrganization = this.registry.getOrganization(input.toOrganizationId);
    if (!toOrganization) {
      throw new Error(`organization not found: ${input.toOrganizationId}`);
    }

    assertSameTenantBoundary(fromOrganization, toOrganization, "relationship");

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
