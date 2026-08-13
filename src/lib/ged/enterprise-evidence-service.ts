import { bgeId } from "@/lib/bge/ids";
import type { CreateEvidenceRequest } from "@/lib/bge/contracts";
import type { BgeKnowledgeAuthority } from "@/lib/gmp/bge-knowledge-authority";
import type { BgeRepository } from "@/lib/bge/repository";
import type { BgeEventAuthority } from "@/platform/gop/bge-event-authority";

function nowIso(): string {
  return new Date().toISOString();
}

export class GedEnterpriseEvidenceService {
  constructor(
    private readonly repository: BgeRepository,
    private readonly events: BgeEventAuthority,
    private readonly knowledge: BgeKnowledgeAuthority,
  ) {}

  async createEvidence(input: CreateEvidenceRequest) {
    const capturedAt = nowIso();
    const evidenceId = bgeId("bgev_");
    const objectId = bgeId("bgobj_");
    const versionId = bgeId("bgver_");

    const normalized = this.knowledge.normalizePayload(input.evidence_payload);
    const confidence = this.knowledge.deriveConfidence({
      evidenceCount: 1,
      sourceAgreement: 1,
      publicationMatches: 0,
    });
    const retrieval = this.knowledge.retrieveKnowledge({
      tenantId: input.tenant_id,
      objectType: "BG.EVIDENCE.EVIDENCE_RECORD",
      objectId,
      payload: normalized.normalizedPayload,
    });

    const evidence = {
      evidence_id: evidenceId,
      object_id: objectId,
      tenant_id: input.tenant_id,
      object_type: "BG.EVIDENCE.EVIDENCE_RECORD" as const,
      lifecycle_state: "ACTIVE" as const,
      captured_at: capturedAt,
      source: input.source,
      source_identity: input.source_identity ?? input.source,
      extraction_lineage: input.extraction_lineage ?? ["ged.enterprise.evidence", "bge.evidence.ingest"],
      captured_by: input.actor,
      normalized_payload: normalized.normalizedPayload,
      confidence_score: confidence.confidenceScore,
      confidence_level: confidence.confidenceLevel,
      normalization_version: normalized.normalizationVersion,
      confidence_version: confidence.confidenceVersion,
      knowledge_retrieval_status: retrieval.status,
      retention_owner: "ged" as const,
      evidence_payload: input.evidence_payload,
      immutable: true as const,
    };

    await this.repository.createEvidence(evidence);
    await this.events.emit({
      event_type: "BG.EVENT.INGESTED",
      tenant_id: input.tenant_id,
      object_type: evidence.object_type,
      object_id: evidence.object_id,
      object_version_id: versionId,
      actor: input.actor,
      initiator: input.actor,
      policy_ids: [],
      evidence_ids: [evidence.evidence_id],
      confidence_score: evidence.confidence_score,
      change_summary: "Evidence captured",
      reason: "POST /evidence",
      metadata: {
        evidenceRecord: evidence,
      },
    });

    return evidence;
  }
}