import { mkdtemp, rm } from "node:fs/promises";
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
});
