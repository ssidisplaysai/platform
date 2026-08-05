import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  KnowledgeError,
  createDefaultKnowledgeDependencies,
  createGenesisKnowledgeRuntime,
  type KnowledgeActorContext,
} from "@/platform/knowledge";

function actor(actorId = "svc.knowledge"): KnowledgeActorContext {
  return {
    actorId,
    occurredAt: new Date().toISOString(),
    source: "test",
  };
}

describe("GKN-1001 Genesis Knowledge Platform foundation", () => {
  it("registers knowledge records and supports metadata, governance, lifecycle, and observability", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gkn-1001-knowledge-"));
    try {
      const runtime = await createGenesisKnowledgeRuntime({ rootDir });

      const policy = await runtime.registry.registerKnowledge({
        tenantId: "tenant-a",
        identityKey: "knowledge.policy.foundation",
        displayName: "Knowledge Foundation Policy",
        classification: "POLICY",
        actor: actor(),
        metadata: { version: "1.0.0", owner: "governance" },
      });

      const updated = await runtime.registry.updateMetadata({
        tenantId: "tenant-a",
        knowledgeId: policy.knowledgeId,
        actor: actor(),
        metadata: { version: "1.0.1", owner: "platform.knowledge" },
      });
      expect(updated.metadata.version).toBe("1.0.1");

      const verified = await runtime.registry.attestGovernance({
        tenantId: "tenant-a",
        knowledgeId: policy.knowledgeId,
        state: "VERIFIED",
        actor: actor(),
      });
      expect(verified.governance.state).toBe("VERIFIED");

      const activated = await runtime.registry.transitionLifecycle({
        tenantId: "tenant-a",
        knowledgeId: policy.knowledgeId,
        status: "ACTIVE",
        actor: actor(),
        reason: "foundation baseline published",
      });
      expect(activated.lifecycle.status).toBe("ACTIVE");

      const observability = await runtime.observability();
      expect(observability.capability).toBe("platform.knowledge");
      expect(observability.metrics.knowledgeTotal).toBe(1);
      expect(observability.metrics.activeKnowledge).toBe(1);
      expect(observability.health.status).toBe("HEALTHY");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("enforces uniqueness and tenant boundaries", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gkn-1001-boundary-"));
    try {
      const runtime = await createGenesisKnowledgeRuntime({ rootDir });

      const created = await runtime.registry.registerKnowledge({
        tenantId: "tenant-a",
        identityKey: "knowledge.reference.boundary",
        displayName: "Boundary Record",
        actor: actor(),
      });

      await expect(
        runtime.registry.registerKnowledge({
          tenantId: "tenant-a",
          identityKey: "knowledge.reference.boundary",
          displayName: "Duplicate",
          actor: actor(),
        }),
      ).rejects.toBeInstanceOf(KnowledgeError);

      await expect(
        runtime.registry.updateMetadata({
          tenantId: "tenant-b",
          knowledgeId: created.knowledgeId,
          actor: actor(),
          metadata: { should: "fail" },
        }),
      ).rejects.toBeInstanceOf(KnowledgeError);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("persists canonical state across runtime restart", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gkn-1001-restart-"));
    try {
      const runtimeA = await createGenesisKnowledgeRuntime({ rootDir });
      const created = await runtimeA.registry.registerKnowledge({
        tenantId: "tenant-a",
        identityKey: "knowledge.evidence.restart",
        displayName: "Restart Evidence",
        classification: "EVIDENCE",
        actor: actor(),
      });

      const runtimeB = await createGenesisKnowledgeRuntime({ rootDir });
      const found = runtimeB.registry.getKnowledge(created.knowledgeId);

      expect(found?.knowledgeId).toBe(created.knowledgeId);
      expect(runtimeB.snapshot("tenant-a").length).toBeGreaterThanOrEqual(1);
      expect((await runtimeB.observability()).metadata.persistence).toBe("file.knowledge-state.v1");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed for corrupt persisted state and does not silently repair", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gkn-1001-corrupt-"));
    const stateFile = join(rootDir, "knowledge", "knowledge-state.v1.json");

    try {
      await mkdir(join(rootDir, "knowledge"), { recursive: true });
      const corruptPayload = "{\"schemaVersion\":\"2.0.0\",\"knowledge\":[]";
      await writeFile(stateFile, corruptPayload, "utf8");

      await expect(createGenesisKnowledgeRuntime({ rootDir })).rejects.toMatchObject({
        name: "KnowledgeError",
        code: "STATE_CORRUPT",
        severity: "CRITICAL",
      });

      const persistedAfterFailure = await readFile(stateFile, "utf8");
      expect(persistedAfterFailure).toBe(corruptPayload);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects provider registration conflicts deterministically without overwrite", () => {
    const dependencies = createDefaultKnowledgeDependencies();
    const beforeProviders = dependencies.providers.listProviders();
    const foundationProvider = beforeProviders.find((provider) => provider.providerId === "knowledge-foundation-provider");

    expect(foundationProvider).toBeDefined();

    expect(() => {
      dependencies.providers.register({
        providerId: "knowledge-foundation-provider",
        capability: "governance",
        async inspectHealth() {
          return { status: "DEGRADED", detail: "conflict" };
        },
      });
    }).toThrow("knowledge provider registration conflict: knowledge-foundation-provider");

    const afterProviders = dependencies.providers.listProviders();
    expect(afterProviders.length).toBe(beforeProviders.length);
    expect(afterProviders.find((provider) => provider.providerId === "knowledge-foundation-provider")?.capability).toBe("registry");
  });
});
