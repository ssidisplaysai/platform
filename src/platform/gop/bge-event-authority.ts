import { bgeId, chainId, correlationId } from "@/lib/bge/ids";
import { getGenesisEventStore } from "./runtime/event-store";
import type { GenesisEventStore } from "./event-store";
import type { BgeEvent, BgeEventType, BgeObjectType, BgeRelationshipType } from "@/lib/bge/models";
import type { BgeMissionControlProjector } from "./bge-mission-control-projector";
import type { BgeKnowledgeAuthority } from "@/lib/gmp/bge-knowledge-authority";

export function buildBgeEventStreamId(tenantId: string, objectId: string): string {
  return `bge:${tenantId}:${objectId}`;
}

function buildBgeCorrelationId(tenantId: string, objectId: string): string {
  return `corr_${tenantId}_${objectId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class BgeEventAuthority {
  private sequence = 0;

  constructor(
    private readonly eventStore: GenesisEventStore = getGenesisEventStore(),
    private readonly projector?: BgeMissionControlProjector,
    private readonly knowledgeAuthority?: BgeKnowledgeAuthority,
  ) {}

  async emit(input: {
    event_type: BgeEventType;
    tenant_id: string;
    object_type: BgeObjectType;
    object_id: string;
    object_version_id: string;
    actor: { actor_type: "HUMAN" | "AI" | "SYSTEM"; actor_id: string; display_name?: string };
    initiator: { actor_type: "HUMAN" | "AI" | "SYSTEM"; actor_id: string; display_name?: string };
    policy_ids: string[];
    evidence_ids: string[];
    confidence_score?: number;
    change_summary: string;
    reason: string;
    proposal_id?: string;
    approval_id?: string;
    relationship_id?: string;
    relationship_type?: BgeRelationshipType;
    causation_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<BgeEvent> {
    this.sequence += 1;

    const event: BgeEvent = {
      event_id: bgeId("bgevt_"),
      event_type: input.event_type,
      tenant_id: input.tenant_id,
      object_type: input.object_type,
      object_id: input.object_id,
      object_version_id: input.object_version_id,
      occurred_at: nowIso(),
      recorded_at: nowIso(),
      actor: input.actor,
      initiator: input.initiator,
      approval_id: input.approval_id,
      proposal_id: input.proposal_id,
      policy_ids: input.policy_ids,
      evidence_ids: input.evidence_ids,
      confidence_score: input.confidence_score ?? 1,
      correlation_id: buildBgeCorrelationId(input.tenant_id, input.object_id),
      causation_id: input.causation_id,
      chain_id: chainId(),
      sequence_in_chain: this.sequence,
      change_summary: input.change_summary,
      reason: input.reason,
      relationship_id: input.relationship_id,
      relationship_type: input.relationship_type,
    };

    await this.eventStore.appendEventIdempotently({
      eventId: event.event_id,
      jobId: buildBgeEventStreamId(event.tenant_id, event.object_id),
      moduleId: "bge.runtime",
      jobType: "BUSINESS_GENOME_COMPILATION",
      type: event.event_type,
      label: event.event_type,
      stage: event.object_type,
      status: "RUNNING",
      message: event.change_summary,
      source: event.reason,
      occurredAt: event.occurred_at,
      sequence: event.sequence_in_chain,
      actorId: event.actor.actor_id,
      actorName: event.actor.display_name,
      correlationId: event.correlation_id,
      causationId: event.causation_id,
      idempotencyKey: `${event.object_id}:${event.sequence_in_chain}:${event.event_type}`,
      metadata: {
        bgeEvent: event,
        ...(input.metadata ?? {}),
      },
    });

    this.projector?.projectEvent({
      event,
      knowledge: this.knowledgeAuthority?.retrieveKnowledge({
        tenantId: event.tenant_id,
        objectType: event.object_type,
        objectId: event.object_id,
        payload: {},
      }) ?? {
        authority: "gmp",
        status: "UNAVAILABLE_WITHOUT_PROJECT_CONTEXT",
        retrievalFingerprint: "unavailable",
      },
      confidence: this.knowledgeAuthority?.deriveConfidence({ evidenceCount: event.evidence_ids.length }) ?? {
        confidenceScore: event.confidence_score,
        confidenceLevel: "UNKNOWN",
        confidenceVersion: "bge-fallback/v0",
      },
    });

    return event;
  }

  async timelineForObject(objectId: string, tenantId: string) {
    const events = await this.eventStore.listEventsForJob(buildBgeEventStreamId(tenantId, objectId));
    return events
      .map((event) => (event.metadata as { bgeEvent?: BgeEvent } | null)?.bgeEvent ?? null)
      .filter((event): event is BgeEvent => event !== null)
      .sort((a, b) => a.sequence_in_chain - b.sequence_in_chain);
  }
}