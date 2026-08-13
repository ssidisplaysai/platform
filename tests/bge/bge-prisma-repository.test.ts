import { afterEach, describe, expect, it } from "@jest/globals";
import { createInMemoryGenesisEventStore } from "@/platform/gop/event-store";
import { setGenesisEventStoreForTests } from "@/platform/gop/runtime/event-store";
import { createGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestrator";
import { setGenesisOrchestrationRuntimeForTests } from "@/platform/gop/runtime/orchestration-runtime";
import { createPrismaBgeRepository } from "@/lib/bge/prisma-repository";
import { createBgeRuntime } from "@/lib/bge/runtime";
import type { BgeEvidenceRecord } from "@/lib/bge/models";

type FakeStore = {
  objects: Map<string, any>;
  versions: Map<string, any>;
  relationships: Map<string, any>;
  proposals: Map<string, any>;
  approvals: Map<string, any>;
  gopEvents: Array<{ jobId: string; eventType: string; sequence: number; metadata: unknown }>;
};

function createFakePrisma(store: FakeStore) {
  const versionRowsForObject = (objectId: string) => [...store.versions.values()]
    .filter((version) => version.objectId === objectId)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  return {
    bgeCanonicalObject: {
      findFirst: async ({ where, include }: any) => {
        const row = store.objects.get(where.objectId);
        if (!row) return null;
        if (where.tenantId && row.tenantId !== where.tenantId) return null;
        return include?.versions ? { ...row, versions: versionRowsForObject(row.objectId) } : row;
      },
      findUniqueOrThrow: async ({ where, include }: any) => {
        const row = store.objects.get(where.objectId);
        if (!row) throw new Error("Object not found");
        return include?.versions ? { ...row, versions: versionRowsForObject(row.objectId) } : row;
      },
      upsert: async ({ where, update, create }: any) => {
        const existing = store.objects.get(where.objectId);
        const createdAt = create.createdAt ?? new Date();
        const next = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { ...create, createdAt, updatedAt: createdAt };
        store.objects.set(next.objectId, next);
        return next;
      },
    },
    bgeCanonicalObjectVersion: {
      upsert: async ({ where, update, create }: any) => {
        const existing = store.versions.get(where.versionId);
        const next = existing ? { ...existing, ...update } : create;
        store.versions.set(next.versionId, next);
        return next;
      },
    },
    bgeCanonicalRelationship: {
      upsert: async ({ where, update, create }: any) => {
        const existing = [...store.relationships.values()].find((relationship) => relationship.tenantId === where.tenantId_idempotencyKey.tenantId && relationship.idempotencyKey === where.tenantId_idempotencyKey.idempotencyKey);
        const next = existing ? { ...existing, ...update, updatedAt: new Date() } : { ...create, updatedAt: create.createdAt };
        store.relationships.set(next.relationshipId, next);
        return next;
      },
      findUnique: async ({ where }: any) => {
        return [...store.relationships.values()].find((relationship) => relationship.tenantId === where.tenantId_idempotencyKey.tenantId && relationship.idempotencyKey === where.tenantId_idempotencyKey.idempotencyKey) ?? null;
      },
      findFirst: async ({ where }: any) => {
        const row = store.relationships.get(where.relationshipId);
        if (!row) return null;
        if (where.tenantId && row.tenantId !== where.tenantId) return null;
        return row;
      },
    },
    bgeCanonicalProposal: {
      upsert: async ({ where, update, create }: any) => {
        const existing = [...store.proposals.values()].find((proposal) => proposal.tenantId === where.tenantId_idempotencyKey.tenantId && proposal.idempotencyKey === where.tenantId_idempotencyKey.idempotencyKey);
        const next = existing ? { ...existing, ...update, updatedAt: new Date() } : { ...create, updatedAt: create.createdAt };
        store.proposals.set(next.proposalId, next);
        return next;
      },
      findUnique: async ({ where }: any) => {
        return [...store.proposals.values()].find((proposal) => proposal.tenantId === where.tenantId_idempotencyKey.tenantId && proposal.idempotencyKey === where.tenantId_idempotencyKey.idempotencyKey) ?? null;
      },
      findFirst: async ({ where }: any) => {
        const row = store.proposals.get(where.proposalId);
        if (!row) return null;
        if (where.tenantId && row.tenantId !== where.tenantId) return null;
        return row;
      },
      update: async ({ where, data }: any) => {
        const existing = store.proposals.get(where.proposalId);
        if (!existing) throw new Error("Proposal not found");
        const next = { ...existing, ...data, updatedAt: new Date() };
        store.proposals.set(next.proposalId, next);
        return next;
      },
    },
    bgeCanonicalApproval: {
      upsert: async ({ where, update, create }: any) => {
        const existing = [...store.approvals.values()].find((approval) => approval.tenantId === where.tenantId_idempotencyKey.tenantId && approval.idempotencyKey === where.tenantId_idempotencyKey.idempotencyKey);
        const next = existing ? { ...existing, ...update } : create;
        store.approvals.set(next.approvalId, next);
        return next;
      },
      findUnique: async ({ where }: any) => {
        return [...store.approvals.values()].find((approval) => approval.tenantId === where.tenantId_idempotencyKey.tenantId && approval.idempotencyKey === where.tenantId_idempotencyKey.idempotencyKey) ?? null;
      },
    },
    $queryRaw: async (query: TemplateStringsArray, ...values: any[]) => {
      const sql = query.join(" ");

      if (sql.includes("BG.EVENT.INGESTED")) {
        const stringValues = values.filter((value) => typeof value === "string");
        const value = stringValues[0];
        const tenantId = stringValues.length > 1 ? stringValues[1] : undefined;
        return store.gopEvents
          .filter((event) => event.eventType === "BG.EVENT.INGESTED")
          .filter((event) => {
            const evidence = (event.metadata as { evidenceRecord?: BgeEvidenceRecord } | undefined)?.evidenceRecord;
            return evidence
              && (evidence.evidence_id === value || evidence.object_id === value)
              && (!tenantId || evidence.tenant_id === tenantId);
          })
          .sort((left, right) => right.sequence - left.sequence)
          .slice(0, 1)
          .map((event) => ({ metadata: event.metadata }));
      }

      if (sql.includes('FROM "GopJobEvent"') && values.length >= 1) {
        const [streamId] = values;
        return store.gopEvents
          .filter((event) => event.jobId === streamId)
          .sort((left, right) => left.sequence - right.sequence)
          .map((event) => ({ metadata: event.metadata }));
      }

      return [];
    },
    $executeRawUnsafe: async () => 0,
    $transaction: async (operation: any) => operation(createFakePrisma(store)),
  } as never;
}

afterEach(() => {
  setGenesisOrchestrationRuntimeForTests(null);
  setGenesisEventStoreForTests(createInMemoryGenesisEventStore());
});

describe("bge prisma repository", () => {
  it("persists canonical state durably across repository instances and enforces idempotency and tenant isolation", async () => {
    const eventStore = createInMemoryGenesisEventStore();
    const orchestration = createGenesisOrchestrationRuntime({ bootstrapDefaultWorkers: false });
    setGenesisEventStoreForTests(eventStore);
    setGenesisOrchestrationRuntimeForTests(orchestration);

    const store: FakeStore = {
      objects: new Map(),
      versions: new Map(),
      relationships: new Map(),
      proposals: new Map(),
      approvals: new Map(),
      gopEvents: [],
    };

    const originalAppend = eventStore.appendEventIdempotently.bind(eventStore);
    eventStore.appendEventIdempotently = async (input) => {
      const result = await originalAppend(input);
      store.gopEvents.push({
        jobId: result.jobId,
        eventType: result.eventType,
        sequence: result.sequence,
        metadata: result.metadata,
      });
      return result;
    };

    const runtimeOne = createBgeRuntime({
      repository: createPrismaBgeRepository(createFakePrisma(store)),
      eventStore,
    });

    const evidence = await runtimeOne.evidence.createEvidence({
      tenant_id: "tenant_alpha",
      source: "manual://persistence",
      source_identity: "src.persistence",
      evidence_payload: { legal_name: "Persistent Company", status: "active" },
      actor: { actor_type: "HUMAN", actor_id: "architect@example.com" },
    });

    const firstProposal = await runtimeOne.proposals.createProposal({
      tenant_id: "tenant_alpha",
      object_type: "BG.ORG.COMPANY",
      object_id: "bgobj_persistent_company",
      operation: "CREATE_OBJECT",
      patch: { legal_name: "Persistent Company" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Create persistent company",
      initiator: { actor_type: "AI", actor_id: "genesis-agent" },
    });

    const duplicateProposal = await runtimeOne.proposals.createProposal({
      tenant_id: "tenant_alpha",
      object_type: "BG.ORG.COMPANY",
      object_id: "bgobj_persistent_company",
      operation: "CREATE_OBJECT",
      patch: { legal_name: "Persistent Company" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Create persistent company",
      initiator: { actor_type: "AI", actor_id: "genesis-agent" },
    });

    expect(duplicateProposal.proposal_id).toBe(firstProposal.proposal_id);

    const firstApproval = await runtimeOne.approvals.decide({
      tenant_id: "tenant_alpha",
      proposal_id: firstProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve persistent company",
    });

    const duplicateApproval = await runtimeOne.approvals.decide({
      tenant_id: "tenant_alpha",
      proposal_id: firstProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve persistent company",
    });

    expect(duplicateApproval.approval_id).toBe(firstApproval.approval_id);

    const updateProposal = await runtimeOne.proposals.createProposal({
      tenant_id: "tenant_alpha",
      object_type: "BG.ORG.COMPANY",
      object_id: "bgobj_persistent_company",
      operation: "UPDATE_OBJECT",
      patch: { legal_name: "Persistent Company Rollback Target" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Update persistent company",
      initiator: { actor_type: "HUMAN", actor_id: "operator@example.com" },
    });

    await runtimeOne.approvals.decide({
      tenant_id: "tenant_alpha",
      proposal_id: updateProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve persistent update",
    });

    const relationshipProposal = await runtimeOne.proposals.createProposal({
      tenant_id: "tenant_alpha",
      object_type: "BG.ORG.COMPANY",
      object_id: "bgobj_persistent_company",
      operation: "RELATE_OBJECTS",
      relationship: {
        relationship_type: "BG.REL.SUPPORTS",
        source_object_id: "bgobj_persistent_company",
        target_object_id: "bgobj_persistent_company",
      },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.relationship"],
      reason: "Relate persistent company",
      initiator: { actor_type: "AI", actor_id: "genesis-agent" },
    });

    await runtimeOne.approvals.decide({
      tenant_id: "tenant_alpha",
      proposal_id: relationshipProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve persistent relationship",
    });

    const rollbackProposal = await runtimeOne.proposals.createProposal({
      tenant_id: "tenant_alpha",
      object_type: "BG.ORG.COMPANY",
      object_id: "bgobj_persistent_company",
      operation: "UPDATE_OBJECT",
      patch: { legal_name: "Persistent Company" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Rollback by new version",
      initiator: { actor_type: "HUMAN", actor_id: "operator@example.com" },
    });

    await runtimeOne.approvals.decide({
      tenant_id: "tenant_alpha",
      proposal_id: rollbackProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve rollback version",
    });

    const runtimeTwo = createBgeRuntime({
      repository: createPrismaBgeRepository(createFakePrisma(store)),
      eventStore,
    });

    const durableObject = await runtimeTwo.objects.getObject("bgobj_persistent_company", "tenant_alpha");
    expect(durableObject).not.toBeNull();
    expect(durableObject && "versions" in durableObject ? durableObject.versions : []).toHaveLength(3);
    expect(durableObject && durableObject.current_version_id).toMatch(/^bgver_/);

    const durableEvidence = await runtimeTwo.repository.getEvidenceById(evidence.evidence_id, "tenant_alpha");
    expect(durableEvidence?.source_identity).toBe("src.persistence");

    const durableRelationship = await runtimeTwo.relationships.getRelationship(
      [...store.relationships.values()][0].relationshipId,
      "tenant_alpha",
    );
    expect(durableRelationship?.relationship_type).toBe("BG.REL.SUPPORTS");

    const durableTimeline = await runtimeTwo.timeline.getTimeline("bgobj_persistent_company", "tenant_alpha");
    expect(durableTimeline.events.length).toBeGreaterThan(0);
    expect(durableTimeline.events.every((event) => event.tenant_id === "tenant_alpha")).toBe(true);

    expect(await runtimeTwo.objects.getObject("bgobj_persistent_company", "tenant_beta")).toBeNull();
    expect(await runtimeTwo.repository.getProposalById(firstProposal.proposal_id, "tenant_beta")).toBeNull();
  });
});