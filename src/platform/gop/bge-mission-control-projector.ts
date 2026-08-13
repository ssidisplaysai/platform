import type { BgeEvent } from "@/lib/bge/models";
import type { BgeKnowledgeAuthority } from "@/lib/gmp/bge-knowledge-authority";
import { getGenesisOrchestrationRuntime } from "./runtime/orchestration-runtime";

export type BgeMissionControlProjector = {
  projectEvent: (input: {
    event: BgeEvent;
    knowledge: ReturnType<BgeKnowledgeAuthority["retrieveKnowledge"]>;
    confidence: { confidenceScore: number; confidenceLevel: string; confidenceVersion: string };
  }) => void;
};

function buildProjectionJobId(event: BgeEvent): string {
  return `bgeproj_${event.tenant_id}_${event.object_id}_${event.sequence_in_chain}`;
}

export function createBgeMissionControlProjector(): BgeMissionControlProjector {
  return {
    projectEvent(input) {
      const runtime = getGenesisOrchestrationRuntime();
      runtime.createExecution({
        executionId: `gexec_${buildProjectionJobId(input.event)}`,
        executionType: "BUSINESS_GENOME_COMPILATION",
        jobId: buildProjectionJobId(input.event),
        workspaceId: input.event.tenant_id,
        moduleId: "bge.runtime",
        jobType: "BUSINESS_GENOME_COMPILATION",
        executionClass: "AUTOMATED",
        priority: "NORMAL",
        input: {
          projectionType: "bge.mission-control",
          eventType: input.event.event_type,
          tenantId: input.event.tenant_id,
          objectType: input.event.object_type,
          objectId: input.event.object_id,
          objectVersionId: input.event.object_version_id,
          proposalId: input.event.proposal_id,
          approvalId: input.event.approval_id,
          relationshipId: input.event.relationship_id,
          relationshipType: input.event.relationship_type,
          eventCount: 1,
          confidenceScore: input.confidence.confidenceScore,
          confidenceLevel: input.confidence.confidenceLevel,
          certificationState: "PENDING_RUNTIME_CERTIFICATION",
          knowledgeStatus: input.knowledge.status,
          activityAt: input.event.occurred_at,
          causationId: input.event.causation_id,
          correlationId: input.event.correlation_id,
        },
      });
    },
  };
}