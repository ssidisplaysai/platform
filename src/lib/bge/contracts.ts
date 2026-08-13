import type {
  BgeActor,
  BgeCanonicalObject,
  BgeEvidenceRecord,
  BgeObjectType,
  BgeProposal,
  BgeProposalOperation,
  BgeRelationship,
  BgeRelationshipType,
  BgeTimeline,
} from "./models";

export type BgeObjectLookup = BgeCanonicalObject | BgeEvidenceRecord;

export interface CreateEvidenceRequest {
  tenant_id: string;
  source: string;
  source_identity?: string;
  extraction_lineage?: string[];
  evidence_payload: Record<string, unknown>;
  actor: BgeActor;
}

export interface CreateProposalRequest {
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
}

export interface CreateApprovalRequest {
  tenant_id: string;
  proposal_id: string;
  decision: "APPROVE" | "REJECT";
  approver: BgeActor;
  reason: string;
}

export interface EvidenceResponse {
  evidence: BgeEvidenceRecord;
}

export interface ObjectResponse {
  object: BgeObjectLookup;
}

export interface ProposalResponse {
  proposal: BgeProposal;
}

export interface ApprovalResponse {
  approval_id: string;
  proposal_id: string;
  decision: "APPROVE" | "REJECT";
}

export interface RelationshipResponse {
  relationship: BgeRelationship;
}

export interface TimelineResponse {
  timeline: BgeTimeline;
}
