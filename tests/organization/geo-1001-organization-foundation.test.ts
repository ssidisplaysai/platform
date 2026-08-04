import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  FileOrganizationStore,
  createGenesisOrganizationRuntime,
  type OrganizationPlatformDependencies,
} from "@/platform/organization";

function dependencies(): OrganizationPlatformDependencies {
  const health = async () => ({ status: "HEALTHY" as const, detail: "ok" });
  return {
    identity: {
      async resolveIdentity(actorId: string) {
        return { actorId, actorName: actorId };
      },
    },
    authorization: {
      async authorize() {
        return { allowed: true };
      },
    },
    messaging: { inspectHealth: health },
    workflow: { inspectHealth: health },
    scheduling: { inspectHealth: health },
    notifications: { inspectHealth: health },
    ai: { inspectHealth: health },
  };
}

describe("GEO-1001 Genesis Organization Platform foundation", () => {
  it("manages hierarchy nodes with deterministic pathing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-hierarchy-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const parent = await runtime.registry.registerOrganization({
        type: "COMPANY",
        name: "Genesis Holdings",
        createdBy: "system",
      });
      const child = await runtime.registry.registerOrganization({
        type: "DIVISION",
        name: "Genesis Retail",
        createdBy: "system",
      });

      await runtime.hierarchy.upsertNode({ organizationId: parent.organizationId, actorId: "system" });
      const childNode = await runtime.hierarchy.upsertNode({
        organizationId: child.organizationId,
        parentOrganizationId: parent.organizationId,
        actorId: "system",
      });

      expect(childNode.depth).toBe(1);
      expect(childNode.path).toEqual([parent.organizationId, child.organizationId]);
      expect(runtime.hierarchy.list()).toHaveLength(2);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("creates organization relationships", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-rel-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const a = await runtime.registry.registerOrganization({ type: "COMPANY", name: "A", createdBy: "ops" });
      const b = await runtime.registry.registerOrganization({ type: "BRAND", name: "B", createdBy: "ops" });

      const relationship = await runtime.relationships.createRelationship({
        fromOrganizationId: a.organizationId,
        toOrganizationId: b.organizationId,
        relationshipType: "ASSOCIATED_WITH",
        actorId: "ops",
      });

      expect(relationship.active).toBe(true);
      expect(runtime.relationships.list()).toHaveLength(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("enforces lifecycle transitions", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-lifecycle-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const org = await runtime.registry.registerOrganization({ type: "TENANT", name: "Tenant Alpha", createdBy: "admin" });

      const activated = await runtime.lifecycle.transitionStatus({
        organizationId: org.organizationId,
        from: "DRAFT",
        to: "ACTIVE",
        actorId: "admin",
      });

      expect(activated.status).toBe("ACTIVE");

      await expect(runtime.lifecycle.transitionStatus({
        organizationId: org.organizationId,
        from: "DRAFT",
        to: "ARCHIVED",
        actorId: "admin",
      })).rejects.toThrow("transition from status mismatch");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("updates metadata and settings", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-meta-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const org = await runtime.registry.registerOrganization({ type: "COMPANY", name: "MetaCo", createdBy: "owner" });

      const withMetadata = await runtime.metadata.updateMetadata(org.organizationId, { region: "NA", priority: 1 }, "owner");
      const withSettings = await runtime.settings.updateSettings(org.organizationId, { enforceSso: true }, "owner");

      expect(withMetadata.metadata.region).toBe("NA");
      expect(withSettings.settings.enforceSso).toBe(true);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("persists state across runtime restarts with file-backed versioned store", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-persist-"));
    try {
      const store = new FileOrganizationStore({ rootDir });
      const runtimeA = await createGenesisOrganizationRuntime({ rootDir, persistence: store, dependencies: dependencies() });
      const created = await runtimeA.registry.registerOrganization({ type: "COMPANY", name: "PersistCo", createdBy: "svc" });
      await runtimeA.hierarchy.upsertNode({ organizationId: created.organizationId, actorId: "svc" });

      const runtimeB = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const found = runtimeB.registry.getOrganization(created.organizationId);

      expect(found?.organizationId).toBe(created.organizationId);
      expect(runtimeB.hierarchy.list().length).toBeGreaterThanOrEqual(1);
      expect(runtimeB.metrics.snapshot().persistenceLoadCount).toBeGreaterThan(0);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("reports health and metrics", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-health-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      await runtime.registry.registerOrganization({ type: "COMPANY", name: "HealthCo", createdBy: "svc" });
      const health = runtime.health.snapshot();
      const metrics = runtime.metrics.snapshot();

      expect(health.status).toBe("HEALTHY");
      expect(metrics.organizationCount).toBe(1);
      expect(metrics.auditRecordCount).toBeGreaterThan(0);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("provides mission control observability-only integration", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-integration-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      await runtime.registry.registerOrganization({ type: "COMPANY", name: "ObsCo", createdBy: "svc" });
      const snapshot = runtime.integration.snapshot();
      const aggregate = runtime.integration.gopAggregateMetrics();

      expect(snapshot.capabilityId).toBe("platform.organization");
      expect(snapshot.readiness.missionControlCompatible).toBe(true);
      expect(snapshot.consumedBoundaries.identity).toBe(true);
      expect(aggregate.organizationCount).toBe(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects self-parent hierarchy links", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-self-parent-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const org = await runtime.registry.registerOrganization({ type: "COMPANY", name: "Solo", createdBy: "ops" });

      await expect(runtime.hierarchy.upsertNode({
        organizationId: org.organizationId,
        parentOrganizationId: org.organizationId,
        actorId: "ops",
      })).rejects.toThrow("self-parent hierarchy rejected");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects direct hierarchy cycles", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-direct-cycle-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const a = await runtime.registry.registerOrganization({ type: "COMPANY", name: "A", createdBy: "ops" });
      const b = await runtime.registry.registerOrganization({ type: "DIVISION", name: "B", createdBy: "ops" });

      await runtime.hierarchy.upsertNode({ organizationId: a.organizationId, actorId: "ops" });
      await runtime.hierarchy.upsertNode({
        organizationId: b.organizationId,
        parentOrganizationId: a.organizationId,
        actorId: "ops",
      });

      await expect(runtime.hierarchy.upsertNode({
        organizationId: a.organizationId,
        parentOrganizationId: b.organizationId,
        actorId: "ops",
      })).rejects.toThrow("recursive ancestor loop detected");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects indirect hierarchy cycles", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-indirect-cycle-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const a = await runtime.registry.registerOrganization({ type: "COMPANY", name: "A", createdBy: "ops" });
      const b = await runtime.registry.registerOrganization({ type: "DIVISION", name: "B", createdBy: "ops" });
      const c = await runtime.registry.registerOrganization({ type: "DEPARTMENT", name: "C", createdBy: "ops" });

      await runtime.hierarchy.upsertNode({ organizationId: a.organizationId, actorId: "ops" });
      await runtime.hierarchy.upsertNode({
        organizationId: b.organizationId,
        parentOrganizationId: a.organizationId,
        actorId: "ops",
      });
      await runtime.hierarchy.upsertNode({
        organizationId: c.organizationId,
        parentOrganizationId: b.organizationId,
        actorId: "ops",
      });

      await expect(runtime.hierarchy.upsertNode({
        organizationId: a.organizationId,
        parentOrganizationId: c.organizationId,
        actorId: "ops",
      })).rejects.toThrow("recursive ancestor loop detected");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate organization ids during registration", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-duplicate-id-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      await runtime.registry.registerOrganization({
        organizationId: "org-dup",
        type: "COMPANY",
        name: "One",
        createdBy: "ops",
      });

      await expect(runtime.registry.registerOrganization({
        organizationId: "org-dup",
        type: "BRAND",
        name: "Two",
        createdBy: "ops",
      })).rejects.toThrow("duplicate organization id");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects invalid tenant references during registration", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-invalid-tenant-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });

      await expect(runtime.registry.registerOrganization({
        type: "DIVISION",
        name: "NoTenant",
        tenantId: "tenant-missing",
        createdBy: "ops",
      })).rejects.toThrow("tenant not found");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects cross-tenant hierarchy links", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-cross-tenant-hierarchy-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const tenantA = await runtime.registry.registerOrganization({ type: "TENANT", name: "Tenant A", createdBy: "ops" });
      const tenantB = await runtime.registry.registerOrganization({ type: "TENANT", name: "Tenant B", createdBy: "ops" });
      const orgA = await runtime.registry.registerOrganization({
        type: "DIVISION",
        name: "Org A",
        tenantId: tenantA.organizationId,
        createdBy: "ops",
      });
      const orgB = await runtime.registry.registerOrganization({
        type: "DIVISION",
        name: "Org B",
        tenantId: tenantB.organizationId,
        createdBy: "ops",
      });

      await runtime.hierarchy.upsertNode({ organizationId: orgA.organizationId, actorId: "ops" });

      await expect(runtime.hierarchy.upsertNode({
        organizationId: orgB.organizationId,
        parentOrganizationId: orgA.organizationId,
        actorId: "ops",
      })).rejects.toThrow("cross-tenant hierarchy rejected");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects cross-tenant relationships", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-cross-tenant-rel-"));
    try {
      const runtime = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const tenantA = await runtime.registry.registerOrganization({ type: "TENANT", name: "Tenant A", createdBy: "ops" });
      const tenantB = await runtime.registry.registerOrganization({ type: "TENANT", name: "Tenant B", createdBy: "ops" });
      const orgA = await runtime.registry.registerOrganization({
        type: "DIVISION",
        name: "Org A",
        tenantId: tenantA.organizationId,
        createdBy: "ops",
      });
      const orgB = await runtime.registry.registerOrganization({
        type: "DIVISION",
        name: "Org B",
        tenantId: tenantB.organizationId,
        createdBy: "ops",
      });

      await expect(runtime.relationships.createRelationship({
        fromOrganizationId: orgA.organizationId,
        toOrganizationId: orgB.organizationId,
        relationshipType: "ASSOCIATED_WITH",
        actorId: "ops",
      })).rejects.toThrow("cross-tenant relationship rejected");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate organization ids during recovery validation", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-duplicate-recovery-"));
    try {
      const stateFile = join(rootDir, "organization", "organization-state.v1.json");
      await mkdir(join(rootDir, "organization"), { recursive: true });
      await writeFile(stateFile, JSON.stringify({
        schemaVersion: "1.0.0",
        organizations: [
          {
            organizationId: "org-dup",
            type: "COMPANY",
            name: "A",
            status: "DRAFT",
            metadata: {},
            settings: {},
            lifecycle: {
              createdAt: new Date().toISOString(),
              createdBy: "ops",
              updatedAt: new Date().toISOString(),
              updatedBy: "ops",
              transitions: [],
            },
          },
          {
            organizationId: "org-dup",
            type: "COMPANY",
            name: "B",
            status: "DRAFT",
            metadata: {},
            settings: {},
            lifecycle: {
              createdAt: new Date().toISOString(),
              createdBy: "ops",
              updatedAt: new Date().toISOString(),
              updatedBy: "ops",
              transitions: [],
            },
          },
        ],
        hierarchy: [],
        relationships: [],
        audits: [],
        metrics: {
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
        },
      }, null, 2), "utf8");

      await expect(createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() })).rejects.toThrow(
        "duplicate organization id in persisted state",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate hierarchy import state and fails closed", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-duplicate-import-"));
    try {
      const stateFile = join(rootDir, "organization", "organization-state.v1.json");
      await mkdir(join(rootDir, "organization"), { recursive: true });
      const now = new Date().toISOString();
      await writeFile(stateFile, JSON.stringify({
        schemaVersion: "1.0.0",
        organizations: [
          {
            organizationId: "tenant-a",
            type: "TENANT",
            name: "Tenant A",
            tenantId: "tenant-a",
            status: "DRAFT",
            metadata: {},
            settings: {},
            lifecycle: {
              createdAt: now,
              createdBy: "ops",
              updatedAt: now,
              updatedBy: "ops",
              transitions: [],
            },
          },
          {
            organizationId: "org-a",
            type: "DIVISION",
            name: "Org A",
            tenantId: "tenant-a",
            status: "DRAFT",
            metadata: {},
            settings: {},
            lifecycle: {
              createdAt: now,
              createdBy: "ops",
              updatedAt: now,
              updatedBy: "ops",
              transitions: [],
            },
          },
        ],
        hierarchy: [
          {
            nodeId: "n1",
            organizationId: "org-a",
            parentOrganizationId: "tenant-a",
            childOrganizationIds: [],
            depth: 1,
            path: ["tenant-a", "org-a"],
            updatedAt: now,
          },
          {
            nodeId: "n2",
            organizationId: "org-a",
            parentOrganizationId: "tenant-a",
            childOrganizationIds: [],
            depth: 1,
            path: ["tenant-a", "org-a"],
            updatedAt: now,
          },
        ],
        relationships: [],
        audits: [],
        metrics: {
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
        },
      }, null, 2), "utf8");

      await expect(createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() })).rejects.toThrow(
        "duplicate hierarchy node organizationId",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("preserves hierarchy and tenant integrity across restart recovery", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "geo-1001-restart-integrity-"));
    try {
      const runtimeA = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const tenant = await runtimeA.registry.registerOrganization({ type: "TENANT", name: "Tenant Z", createdBy: "ops" });
      const parent = await runtimeA.registry.registerOrganization({
        type: "COMPANY",
        name: "Parent",
        tenantId: tenant.organizationId,
        createdBy: "ops",
      });
      const child = await runtimeA.registry.registerOrganization({
        type: "DIVISION",
        name: "Child",
        tenantId: tenant.organizationId,
        createdBy: "ops",
      });

      await runtimeA.hierarchy.upsertNode({ organizationId: parent.organizationId, actorId: "ops" });
      await runtimeA.hierarchy.upsertNode({
        organizationId: child.organizationId,
        parentOrganizationId: parent.organizationId,
        actorId: "ops",
      });

      const runtimeB = await createGenesisOrganizationRuntime({ rootDir, dependencies: dependencies() });
      const recoveredChild = runtimeB.hierarchy.list().find((node) => node.organizationId === child.organizationId);

      expect(recoveredChild?.path).toEqual([parent.organizationId, child.organizationId]);
      expect(recoveredChild?.depth).toBe(1);

      await expect(runtimeB.relationships.createRelationship({
        fromOrganizationId: parent.organizationId,
        toOrganizationId: child.organizationId,
        relationshipType: "ASSOCIATED_WITH",
        actorId: "ops",
      })).resolves.toBeDefined();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
