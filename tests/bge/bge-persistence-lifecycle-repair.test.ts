import { afterAll, afterEach, describe, expect, it } from "@jest/globals";
import { createPrismaBgeRepository } from "@/lib/bge/prisma-repository";
import { createBgeRuntime } from "@/lib/bge/runtime";
import { getPrismaClient } from "@/lib/glw/prisma";
import { resetGenesisEventStoreForTests } from "@/platform/gop/runtime/event-store";
import { createGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestrator";
import { setGenesisOrchestrationRuntimeForTests } from "@/platform/gop/runtime/orchestration-runtime";

describe("bge persistence lifecycle repair", () => {
  afterEach(() => {
    setGenesisOrchestrationRuntimeForTests(null);
    resetGenesisEventStoreForTests();
  });

  afterAll(async () => {
    await getPrismaClient().$disconnect();
  });

  it("creates the first object/version pair and preserves append-only history across a fresh runtime", async () => {
    const prisma = getPrismaClient();
    const tenantId = `tenant_repair_${Date.now()}`;
    setGenesisOrchestrationRuntimeForTests(createGenesisOrchestrationRuntime({ bootstrapDefaultWorkers: false }));

    const runtimeOne = createBgeRuntime({
      repository: createPrismaBgeRepository(),
    });

    const evidence = await runtimeOne.evidence.createEvidence({
      tenant_id: tenantId,
      source: "manual://persistence-repair",
      source_identity: "src.persistence.repair",
      extraction_lineage: ["certification.phase.2", "repair.lifecycle"],
      evidence_payload: {
        legal_name: "Genesis Repair Company",
        product_name: "Genesis Repair Product",
      },
      actor: {
        actor_type: "HUMAN",
        actor_id: "architect@example.com",
      },
    });

    const companyCreateProposal = await runtimeOne.proposals.createProposal({
      tenant_id: tenantId,
      object_type: "BG.ORG.COMPANY",
      operation: "CREATE_OBJECT",
      patch: { legal_name: "Genesis Repair Company" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Create first canonical company",
      initiator: { actor_type: "AI", actor_id: "genesis-agent" },
    });

    const duplicateCompanyProposal = await runtimeOne.proposals.createProposal({
      tenant_id: tenantId,
      object_type: "BG.ORG.COMPANY",
      operation: "CREATE_OBJECT",
      patch: { legal_name: "Genesis Repair Company" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Create first canonical company",
      initiator: { actor_type: "AI", actor_id: "genesis-agent" },
    });

    expect(duplicateCompanyProposal.proposal_id).toBe(companyCreateProposal.proposal_id);

    const companyApproval = await runtimeOne.approvals.decide({
      tenant_id: tenantId,
      proposal_id: companyCreateProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve first canonical company",
    });

    const duplicateCompanyApproval = await runtimeOne.approvals.decide({
      tenant_id: tenantId,
      proposal_id: companyCreateProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve first canonical company",
    });

    expect(duplicateCompanyApproval.approval_id).toBe(companyApproval.approval_id);

    const companyApprovalRow = await prisma.bgeCanonicalApproval.findUnique({
      where: { proposalId: companyCreateProposal.proposal_id },
    });
    const companyObjectId = companyApprovalRow?.resultingObjectId;
    expect(companyObjectId).toBeTruthy();

    const companyBeforeUpdate = await runtimeOne.objects.getObject(companyObjectId!, tenantId);
    expect(companyBeforeUpdate).not.toBeNull();
    expect(companyBeforeUpdate?.versions).toHaveLength(1);
    expect(companyBeforeUpdate?.current_version_id).toMatch(/^bgver_/);

    const updateProposal = await runtimeOne.proposals.createProposal({
      tenant_id: tenantId,
      object_type: "BG.ORG.COMPANY",
      object_id: companyObjectId!,
      operation: "UPDATE_OBJECT",
      patch: { legal_name: "Genesis Repair Company v2" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Promote append-only company version",
      initiator: { actor_type: "HUMAN", actor_id: "operator@example.com" },
    });

    await runtimeOne.approvals.decide({
      tenant_id: tenantId,
      proposal_id: updateProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve append-only company version",
    });

    const productCreateProposal = await runtimeOne.proposals.createProposal({
      tenant_id: tenantId,
      object_type: "BG.CATALOG.PRODUCT",
      operation: "CREATE_OBJECT",
      patch: { name: "Genesis Repair Product", product_code: "GRP-001" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Create related canonical product",
      initiator: { actor_type: "AI", actor_id: "genesis-agent" },
    });

    await runtimeOne.approvals.decide({
      tenant_id: tenantId,
      proposal_id: productCreateProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve related canonical product",
    });

    const productApprovalRow = await prisma.bgeCanonicalApproval.findUnique({
      where: { proposalId: productCreateProposal.proposal_id },
    });
    const productObjectId = productApprovalRow?.resultingObjectId;
    expect(productObjectId).toBeTruthy();

    const relationshipProposal = await runtimeOne.proposals.createProposal({
      tenant_id: tenantId,
      object_type: "BG.ORG.COMPANY",
      object_id: companyObjectId!,
      operation: "RELATE_OBJECTS",
      relationship: {
        relationship_type: "BG.REL.SUPPORTS",
        source_object_id: companyObjectId!,
        target_object_id: productObjectId!,
      },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.relationship"],
      reason: "Persist canonical relationship",
      initiator: { actor_type: "AI", actor_id: "genesis-agent" },
    });

    const relationshipApproval = await runtimeOne.approvals.decide({
      tenant_id: tenantId,
      proposal_id: relationshipProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve canonical relationship",
    });

    expect(relationshipApproval.approval_id).toMatch(/^bgappr_/);

    const rollbackProposal = await runtimeOne.proposals.createProposal({
      tenant_id: tenantId,
      object_type: "BG.ORG.COMPANY",
      object_id: companyObjectId!,
      operation: "UPDATE_OBJECT",
      patch: { legal_name: "Genesis Repair Company" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Rollback by new version",
      initiator: { actor_type: "HUMAN", actor_id: "operator@example.com" },
    });

    await runtimeOne.approvals.decide({
      tenant_id: tenantId,
      proposal_id: rollbackProposal.proposal_id,
      decision: "APPROVE",
      approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
      reason: "Approve rollback version",
    });

    const companyBeforeRestart = await runtimeOne.objects.getObject(companyObjectId!, tenantId);
    const timelineBeforeRestart = await runtimeOne.timeline.getTimeline(companyObjectId!, tenantId);
    const relationshipId = timelineBeforeRestart.events.find((event) => event.relationship_id)?.relationship_id;

    expect(companyBeforeRestart).not.toBeNull();
    expect(companyBeforeRestart?.versions).toHaveLength(3);
    expect(companyBeforeRestart?.versions.map((version) => version.reason)).toEqual([
      "Created through approved proposal",
      "Updated through approved proposal",
      "Updated through approved proposal",
    ]);
    expect(companyBeforeRestart?.current_version_id).toBe(companyBeforeRestart?.versions[2]?.version_id);
    expect(timelineBeforeRestart.events.map((event) => event.event_type)).toEqual([
      "BG.EVENT.PROPOSED",
      "BG.EVENT.APPROVED",
      "BG.EVENT.VERSION_CREATED",
      "BG.EVENT.CREATED",
      "BG.EVENT.PROPOSED",
      "BG.EVENT.APPROVED",
      "BG.EVENT.VERSION_CREATED",
      "BG.EVENT.UPDATED",
      "BG.EVENT.PROPOSED",
      "BG.EVENT.APPROVED",
      "BG.EVENT.RELATED",
      "BG.EVENT.PROPOSED",
      "BG.EVENT.APPROVED",
      "BG.EVENT.VERSION_CREATED",
      "BG.EVENT.UPDATED",
    ]);
    expect(relationshipId).toBeTruthy();

    const runtimeTwo = createBgeRuntime({
      repository: createPrismaBgeRepository(),
    });

    const companyAfterRestart = await runtimeTwo.objects.getObject(companyObjectId!, tenantId);
    const timelineAfterRestart = await runtimeTwo.timeline.getTimeline(companyObjectId!, tenantId);
    const relationshipAfterRestart = await runtimeTwo.relationships.getRelationship(relationshipId!, tenantId);
    const foreignTenantView = await runtimeTwo.objects.getObject(companyObjectId!, "tenant_foreign");

    expect(companyAfterRestart).toEqual(companyBeforeRestart);
    expect(timelineAfterRestart).toEqual(timelineBeforeRestart);
    expect(relationshipAfterRestart?.relationship_id).toBe(relationshipId);
    expect(relationshipAfterRestart?.relationship_type).toBe("BG.REL.SUPPORTS");
    expect(foreignTenantView).toBeNull();

    const replayedCompanyProposal = await runtimeTwo.proposals.createProposal({
      tenant_id: tenantId,
      object_type: "BG.ORG.COMPANY",
      object_id: companyObjectId!,
      operation: "UPDATE_OBJECT",
      patch: { legal_name: "Genesis Repair Company" },
      evidence_ids: [evidence.evidence_id],
      policy_ids: ["policy.constitutional.approval"],
      reason: "Rollback by new version",
      initiator: { actor_type: "HUMAN", actor_id: "operator@example.com" },
    });

    expect(replayedCompanyProposal.proposal_id).toBe(rollbackProposal.proposal_id);
  });
});