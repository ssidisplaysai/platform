import { describe, expect, it } from "@jest/globals";
import { bgeId } from "@/lib/bge/ids";
import { createInMemoryBgeRepository } from "@/lib/bge/repository";
import { createBgeRuntime, setBgeRuntimeForTests } from "@/lib/bge/runtime";
import { buildBgeEventStreamId } from "@/platform/gop/bge-event-authority";
import { createInMemoryGenesisEventStore } from "@/platform/gop/event-store";
import { setGenesisEventStoreForTests } from "@/platform/gop/runtime/event-store";
import { createGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestrator";
import { setGenesisOrchestrationRuntimeForTests } from "@/platform/gop/runtime/orchestration-runtime";

describe("bge convergence runtime", () => {
  it("enforces the evidence to proposal to approval to relationship to timeline flow", async () => {
    const tenantId = "tenant_alpha";
    const eventStore = createInMemoryGenesisEventStore();
    const orchestration = createGenesisOrchestrationRuntime({ bootstrapDefaultWorkers: false });
    setGenesisEventStoreForTests(eventStore);
    setGenesisOrchestrationRuntimeForTests(orchestration);
    const runtime = createBgeRuntime({ repository: createInMemoryBgeRepository(), eventStore });
    setBgeRuntimeForTests(runtime);

    const evidence = await runtime.evidence.createEvidence({
      tenant_id: tenantId,
      source: "manual://interview/session-001",
      source_identity: "src.interview.session-001",
      extraction_lineage: ["discovery.capture", "bge.evidence.ingest"],
      evidence_payload: {
        legal_name: "Acme Constitutional Company",
        product_name: "Acme Beacon",
      },
      actor: {
        actor_type: "HUMAN",
        actor_id: "architect@example.com",
      },
    });

    expect(evidence.evidence_id).toMatch(/^bgev_[0-9A-Z]{26}$/);
    expect(evidence.object_id).toMatch(/^bgobj_[0-9A-Z]{26}$/);
    expect(evidence.source_identity).toBe("src.interview.session-001");
    expect(evidence.extraction_lineage).toEqual(["discovery.capture", "bge.evidence.ingest"]);
    expect(evidence.immutable).toBe(true);
    expect(evidence.lifecycle_state).toBe("ACTIVE");
    expect(evidence.retention_owner).toBe("ged");
    expect(evidence.normalization_version).toBe("gmp-bge-normalization/v1");
    expect(evidence.confidence_version).toBe("gmp-bge-confidence/v1");
    expect(evidence.normalized_payload.legal_name).toBe("Acme Constitutional Company");
    expect(evidence.confidence_score).toBeGreaterThan(0);

    const companyObjectId = bgeId("bgobj_");
    const productObjectId = bgeId("bgobj_");

    const companyProposal = await runtime.proposals.createProposal({
      tenant_id: tenantId,
      object_type: "BG.ORG.COMPANY",
      object_id: companyObjectId,
      operation: "CREATE_OBJECT",
      patch: { legal_name: "Acme Constitutional Company" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Create canonical company from approved evidence",
      initiator: {
        actor_type: "AI",
        actor_id: "genesis-agent",
      },
    });

    expect(await runtime.objects.getObject(companyObjectId, tenantId)).toBeNull();

    const companyApproval = await runtime.approvals.decide({
      tenant_id: tenantId,
      proposal_id: companyProposal.proposal_id,
      decision: "APPROVE",
      approver: {
        actor_type: "HUMAN",
        actor_id: "governor@example.com",
      },
      reason: "Governance approved canonical company",
    });

    expect(companyApproval.approval_id).toMatch(/^bgappr_[0-9A-Z]{26}$/);

    const company = await runtime.objects.getObject(companyObjectId, tenantId);
    expect(company).not.toBeNull();
    expect(company && company.object_type).toBe("BG.ORG.COMPANY");
    expect(company && company.current_version_id).toMatch(/^bgver_[0-9A-Z]{26}$/);
    expect(company && "versions" in company ? company.versions : []).toHaveLength(1);

    const productProposal = await runtime.proposals.createProposal({
      tenant_id: tenantId,
      object_type: "BG.CATALOG.PRODUCT",
      object_id: productObjectId,
      operation: "CREATE_OBJECT",
      patch: { name: "Acme Beacon", product_code: "ACME-BEACON" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Create canonical product from approved evidence",
      initiator: {
        actor_type: "HUMAN",
        actor_id: "operator@example.com",
      },
    });

    await runtime.approvals.decide({
      tenant_id: tenantId,
      proposal_id: productProposal.proposal_id,
      decision: "APPROVE",
      approver: {
        actor_type: "HUMAN",
        actor_id: "governor@example.com",
      },
      reason: "Governance approved canonical product",
    });

    const relationshipProposal = await runtime.proposals.createProposal({
      tenant_id: tenantId,
      object_type: "BG.ORG.COMPANY",
      object_id: companyObjectId,
      operation: "RELATE_OBJECTS",
      relationship: {
        relationship_type: "BG.REL.SUPPORTS",
        source_object_id: companyObjectId,
        target_object_id: productObjectId,
      },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.relationship"],
      reason: "Record company supports product relationship",
      initiator: {
        actor_type: "AI",
        actor_id: "genesis-agent",
      },
    });

    const relationshipApproval = await runtime.approvals.decide({
      tenant_id: tenantId,
      proposal_id: relationshipProposal.proposal_id,
      decision: "APPROVE",
      approver: {
        actor_type: "HUMAN",
        actor_id: "governor@example.com",
      },
      reason: "Governance approved relationship",
    });

    expect(relationshipApproval.approval_id).toMatch(/^bgappr_[0-9A-Z]{26}$/);

    const timelineOne = await runtime.timeline.getTimeline(companyObjectId, tenantId);
    const timelineTwo = await runtime.timeline.getTimeline(companyObjectId, tenantId);

    expect(timelineOne).toEqual(timelineTwo);
    expect(timelineOne.events.map((event) => event.event_type)).toEqual([
      "BG.EVENT.PROPOSED",
      "BG.EVENT.APPROVED",
      "BG.EVENT.VERSION_CREATED",
      "BG.EVENT.CREATED",
      "BG.EVENT.PROPOSED",
      "BG.EVENT.APPROVED",
      "BG.EVENT.RELATED",
    ]);
    expect(timelineOne.events.every((event) => event.tenant_id === tenantId)).toBe(true);
    expect(timelineOne.events.every((event) => event.evidence_ids.includes(evidence.evidence_id))).toBe(true);
    expect(timelineOne.events.every((event) => event.event_id.startsWith("bgevt_"))).toBe(true);
    expect(timelineOne.events.every((event) => event.correlation_id.startsWith("corr_"))).toBe(true);

    const durableEvents = await eventStore.listEventsForJob(buildBgeEventStreamId(tenantId, companyObjectId));
    expect(durableEvents.length).toBe(timelineOne.events.length);
    expect(durableEvents.every((event) => event.moduleId === "bge.runtime")).toBe(true);
    expect(durableEvents.every((event) => event.metadata && "bgeEvent" in event.metadata)).toBe(true);

    const projections = orchestration.listExecutions().filter((execution) => execution.moduleId === "bge.runtime");
    expect(projections.length).toBeGreaterThan(0);
    expect(projections.some((execution) => execution.input.projectionType === "bge.mission-control")).toBe(true);
    expect(projections.some((execution) => execution.input.confidenceScore === evidence.confidence_score)).toBe(true);

    const relatedEvent = timelineOne.events[timelineOne.events.length - 1];
    expect(relatedEvent.relationship_id).toMatch(/^bgrel_[0-9A-Z]{26}$/);
    expect(relatedEvent.relationship_type).toBe("BG.REL.SUPPORTS");

    await expect(
      runtime.proposals.createProposal({
        tenant_id: "tenant_beta",
        object_type: "BG.ORG.COMPANY",
        object_id: bgeId("bgobj_"),
        operation: "CREATE_OBJECT",
        patch: { legal_name: "Foreign Tenant" },
        evidence_ids: [evidence.evidence_id],
        policy_ids: ["policy.constitutional.approval"],
        reason: "Cross-tenant attempt",
        initiator: {
          actor_type: "AI",
          actor_id: "genesis-agent",
        },
      }),
    ).rejects.toThrow("Evidence not found for tenant");

    expect(await runtime.objects.getObject(companyObjectId, "tenant_beta")).toBeNull();
    expect(await runtime.timeline.getTimeline(companyObjectId, "tenant_beta")).toEqual({
      tenant_id: "tenant_beta",
      object_id: companyObjectId,
      events: [],
    });

    setBgeRuntimeForTests(null);
    setGenesisOrchestrationRuntimeForTests(null);
    setGenesisEventStoreForTests(createInMemoryGenesisEventStore());
  });

  it("rejects attempts to mutate immutable evidence records", async () => {
    const eventStore = createInMemoryGenesisEventStore();
    setGenesisOrchestrationRuntimeForTests(createGenesisOrchestrationRuntime({ bootstrapDefaultWorkers: false }));
    setGenesisEventStoreForTests(eventStore);
    const runtime = createBgeRuntime({ repository: createInMemoryBgeRepository(), eventStore });
    setBgeRuntimeForTests(runtime);
    const evidence = await runtime.evidence.createEvidence({
      tenant_id: "tenant_alpha",
      source: "manual://interview/session-002",
      evidence_payload: { statement: "Evidence cannot be edited" },
      actor: {
        actor_type: "HUMAN",
        actor_id: "architect@example.com",
      },
    });

    await expect(
      runtime.proposals.createProposal({
        tenant_id: "tenant_alpha",
        object_type: "BG.EVIDENCE.EVIDENCE_RECORD",
        object_id: evidence.object_id,
        operation: "UPDATE_OBJECT",
        patch: { statement: "Mutated" },
        evidence_ids: [evidence.evidence_id],
        policy_ids: [],
        reason: "Attempt mutation",
        initiator: {
          actor_type: "HUMAN",
          actor_id: "operator@example.com",
        },
      }),
    ).rejects.toThrow("Canonical object not found");

    setBgeRuntimeForTests(null);
    setGenesisOrchestrationRuntimeForTests(null);
    setGenesisEventStoreForTests(createInMemoryGenesisEventStore());
  });
});