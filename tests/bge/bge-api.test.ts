import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "mocked.session.token" }),
    set: () => undefined,
    delete: () => undefined,
  }),
}), { virtual: true });

import { handleGetObject, handleGetRelationship, handleGetTimeline, handlePostApproval, handlePostEvidence, handlePostProposal } from "@/lib/bge/api";
import { createInMemoryBgeRepository } from "@/lib/bge/repository";
import { createBgeRuntime, setBgeRuntimeForTests } from "@/lib/bge/runtime";
import { createInMemoryGenesisEventStore } from "@/platform/gop/event-store";
import { setGenesisEventStoreForTests } from "@/platform/gop/runtime/event-store";
import { createGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestrator";
import { setGenesisOrchestrationRuntimeForTests } from "@/platform/gop/runtime/orchestration-runtime";

function makeRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

const sessionLoader = async () => ({ email: "admin@example.com", expiresAt: Date.now() + 100000 });
const noSessionLoader = async () => null;

describe("bge api", () => {
  it("enforces GOP-owned authorization on the BGE public surface", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";

    const unauthorized = await handlePostEvidence(
      makeRequest("/api/bge/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "tenant_alpha",
          source: "manual://test",
          evidence_payload: { statement: "unauthorized" },
          actor: { actor_type: "HUMAN", actor_id: "operator@example.com" },
        }),
      }),
      { sessionLoader: noSessionLoader as never },
    );

    expect(unauthorized.status).toBe(401);
  });

  it("preserves the stable BGE API contract through the integrated platform owners", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.com";
    const eventStore = createInMemoryGenesisEventStore();
    setGenesisEventStoreForTests(eventStore);
    setGenesisOrchestrationRuntimeForTests(createGenesisOrchestrationRuntime({ bootstrapDefaultWorkers: false }));
    setBgeRuntimeForTests(createBgeRuntime({ repository: createInMemoryBgeRepository(), eventStore }));

    const evidenceResponse = await handlePostEvidence(
      makeRequest("/api/bge/evidence?workspaceId=glw-led-display-warehouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "tenant_alpha",
          source: "manual://api-test",
          source_identity: "src.api-test",
          evidence_payload: { legal_name: "API Company", product_name: "API Product" },
          actor: { actor_type: "HUMAN", actor_id: "operator@example.com" },
        }),
      }),
      { sessionLoader },
    );

    expect(evidenceResponse.status).toBe(201);
    const evidencePayload = await evidenceResponse.json() as { evidence: { evidence_id: string; object_id: string } };

    const companyObjectId = "bgobj_API_COMPANY0000000000000".replace(/_/g, "_");

    const proposalResponse = await handlePostProposal(
      makeRequest("/api/bge/proposals?workspaceId=glw-led-display-warehouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "tenant_alpha",
          object_type: "BG.ORG.COMPANY",
          object_id: companyObjectId,
          operation: "CREATE_OBJECT",
          patch: { legal_name: "API Company" },
          evidence_ids: [evidencePayload.evidence.evidence_id],
          policy_ids: ["policy.constitutional.approval"],
          reason: "Create object through stable API",
          initiator: { actor_type: "AI", actor_id: "genesis-agent" },
        }),
      }),
      { sessionLoader },
    );

    expect(proposalResponse.status).toBe(201);
    const proposalPayload = await proposalResponse.json() as { proposal: { proposal_id: string } };

    const approvalResponse = await handlePostApproval(
      makeRequest("/api/bge/approvals?workspaceId=glw-led-display-warehouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "tenant_alpha",
          proposal_id: proposalPayload.proposal.proposal_id,
          decision: "APPROVE",
          approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
          reason: "Approve object through stable API",
        }),
      }),
      { sessionLoader },
    );

    expect(approvalResponse.status).toBe(201);

    const objectResponse = await handleGetObject(
      makeRequest("/api/bge/objects/test?workspaceId=glw-led-display-warehouse&tenant_id=tenant_alpha"),
      companyObjectId,
      "tenant_alpha",
      { sessionLoader },
    );
    expect(objectResponse.status).toBe(200);

    const relationshipProposalResponse = await handlePostProposal(
      makeRequest("/api/bge/proposals?workspaceId=glw-led-display-warehouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "tenant_alpha",
          object_type: "BG.ORG.COMPANY",
          object_id: companyObjectId,
          operation: "RELATE_OBJECTS",
          relationship: {
            relationship_type: "BG.REL.SUPPORTS",
            source_object_id: companyObjectId,
            target_object_id: companyObjectId,
          },
          evidence_ids: [evidencePayload.evidence.evidence_id],
          policy_ids: ["policy.constitutional.relationship"],
          reason: "Create relationship through stable API",
          initiator: { actor_type: "AI", actor_id: "genesis-agent" },
        }),
      }),
      { sessionLoader },
    );

    expect(relationshipProposalResponse.status).toBe(201);
    const relationshipProposalPayload = await relationshipProposalResponse.json() as { proposal: { proposal_id: string } };

    const relationshipApprovalResponse = await handlePostApproval(
      makeRequest("/api/bge/approvals?workspaceId=glw-led-display-warehouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "tenant_alpha",
          proposal_id: relationshipProposalPayload.proposal.proposal_id,
          decision: "APPROVE",
          approver: { actor_type: "HUMAN", actor_id: "governor@example.com" },
          reason: "Approve relationship through stable API",
        }),
      }),
      { sessionLoader },
    );

    expect(relationshipApprovalResponse.status).toBe(201);

    const timelineResponse = await handleGetTimeline(
      makeRequest("/api/bge/timeline/test?workspaceId=glw-led-display-warehouse&tenant_id=tenant_alpha"),
      companyObjectId,
      "tenant_alpha",
      { sessionLoader },
    );
    expect(timelineResponse.status).toBe(200);
    const timelinePayload = await timelineResponse.json() as { timeline: { events: Array<{ relationship_id?: string }> } };
    const relationshipId = timelinePayload.timeline.events.find((event) => event.relationship_id)?.relationship_id;
    expect(relationshipId).toBeTruthy();

    const relationshipResponse = await handleGetRelationship(
      makeRequest("/api/bge/relationships/test?workspaceId=glw-led-display-warehouse&tenant_id=tenant_alpha"),
      relationshipId!,
      "tenant_alpha",
      { sessionLoader },
    );
    expect(relationshipResponse.status).toBe(200);

    setBgeRuntimeForTests(null);
    setGenesisOrchestrationRuntimeForTests(null);
  });
});