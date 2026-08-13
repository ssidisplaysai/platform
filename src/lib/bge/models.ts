export type BgeObjectType =
  | "BG.ORG.COMPANY"
  | "BG.CATALOG.PRODUCT"
  | "BG.KNOWLEDGE.DOCUMENT"
  | "BG.CONTENT.WEBSITE"
  | "BG.EVIDENCE.EVIDENCE_RECORD";

export type BgeRelationshipType =
  | "BG.REL.REFERENCES"
  | "BG.REL.BELONGS_TO"
  | "BG.REL.DERIVED_FROM"
  | "BG.REL.SUPPORTS";

export type BgeEventType =
  | "BG.EVENT.INGESTED"
  | "BG.EVENT.PROPOSED"
  | "BG.EVENT.APPROVED"
  | "BG.EVENT.REJECTED"
  | "BG.EVENT.VERSION_CREATED"
  | "BG.EVENT.CREATED"
  | "BG.EVENT.UPDATED"
  | "BG.EVENT.RELATED";

export type BgeActorType = "HUMAN" | "AI" | "SYSTEM";

export type BgeProposalOperation = "CREATE_OBJECT" | "UPDATE_OBJECT" | "RELATE_OBJECTS";

export type BgeLifecycleState = "active" | "deprecated" | "retired";

export interface BgeActor {
  actor_type: BgeActorType;
  actor_id: string;
  display_name?: string;
}

export interface BgeVersion {
  version_id: string;
  created_at: string;
  actor: BgeActor;
  evidence_ids: string[];
  policy_ids: string[];
  payload: Record<string, unknown>;
  reason: string;
  rollback_of_version_id?: string;
}

export interface BgeCanonicalObject {
  object_id: string;
  tenant_id: string;
  object_type: Exclude<BgeObjectType, "BG.EVIDENCE.EVIDENCE_RECORD">;
  lifecycle_state: BgeLifecycleState;
  canonical_status?: "ACTIVE" | "DEPRECATED" | "RETIRED";
  current_version_id: string;
  created_at?: string;
  updated_at?: string;
  effective_at?: string | null;
  deprecated_at?: string | null;
  versions: BgeVersion[];
}

export interface BgeEvidenceRecord {
  evidence_id: string;
  object_id: string;
  tenant_id: string;
  object_type: "BG.EVIDENCE.EVIDENCE_RECORD";
  lifecycle_state: "ACTIVE" | "ARCHIVED";
  captured_at: string;
  source: string;
  source_identity: string;
  extraction_lineage: string[];
  captured_by: BgeActor;
  normalized_payload: Record<string, unknown>;
  confidence_score: number;
  confidence_level: string;
  normalization_version: string;
  confidence_version: string;
  knowledge_retrieval_status: string;
  retention_owner: "ged";
  evidence_payload: Record<string, unknown>;
  immutable: true;
}

export interface BgeRelationship {
  relationship_id: string;
  tenant_id: string;
  relationship_type: BgeRelationshipType;
  source_object_id: string;
  target_object_id: string;
  status?: "ACTIVE" | "ARCHIVED";
  created_by?: BgeActor;
  created_at: string;
  updated_at?: string;
  effective_at?: string | null;
  deprecated_at?: string | null;
  evidence_ids: string[];
  policy_ids: string[];
  idempotency_key?: string;
}

export interface BgeProposal {
  proposal_id: string;
  tenant_id: string;
  object_type: BgeObjectType;
  object_id?: string;
  operation: BgeProposalOperation;
  patch?: Record<string, unknown>;
  relationship?: {
    relationship_type: BgeRelationshipType;
    source_object_id: string;
    target_object_id: string;
  };
  evidence_ids: string[];
  policy_ids: string[];
  reason: string;
  initiator: BgeActor;
  confidence_score?: number;
  confidence_reference?: string;
  expires_at?: string | null;
  idempotency_key?: string;
  created_at: string;
  updated_at?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface BgeApproval {
  approval_id: string;
  proposal_id: string;
  tenant_id: string;
  decision: "APPROVE" | "REJECT";
  approver: BgeActor;
  reason: string;
  policy_ids?: string[];
  resulting_object_id?: string;
  resulting_version_id?: string;
  resulting_relationship_id?: string;
  idempotency_key?: string;
  decided_at?: string;
  created_at: string;
}

export interface BgeEvent {
  event_id: string;
  event_type: BgeEventType;
  tenant_id: string;
  object_type: BgeObjectType;
  object_id: string;
  object_version_id: string;
  occurred_at: string;
  recorded_at: string;
  actor: BgeActor;
  initiator: BgeActor;
  approval_id?: string;
  proposal_id?: string;
  policy_ids: string[];
  evidence_ids: string[];
  confidence_score: number;
  correlation_id: string;
  causation_id?: string;
  chain_id: string;
  sequence_in_chain: number;
  change_summary: string;
  reason: string;
  relationship_id?: string;
  relationship_type?: BgeRelationshipType;
}

export interface BgeTimeline {
  tenant_id: string;
  object_id: string;
  events: BgeEvent[];
}
