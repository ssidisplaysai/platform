import { bgeId } from "./ids";
import { createPrismaBgeRepository } from "./prisma-repository";
import type {
  BgeApproval,
  BgeCanonicalObject,
  BgeEvent,
  BgeEvidenceRecord,
  BgeProposal,
  BgeRelationship,
  BgeVersion,
} from "./models";

type BgeObject = BgeCanonicalObject | BgeEvidenceRecord;

export interface BgeRepository {
  createEvidence(evidence: BgeEvidenceRecord): Promise<BgeEvidenceRecord>;
  getEvidenceById(evidenceId: string, tenantId?: string): Promise<BgeEvidenceRecord | null>;
  getObjectById(objectId: string, tenantId?: string): Promise<BgeObject | null>;
  saveCanonicalObject(object: BgeCanonicalObject): Promise<BgeCanonicalObject>;
  createProposal(proposal: BgeProposal): Promise<BgeProposal>;
  findProposalByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<BgeProposal | null>;
  getProposalById(proposalId: string, tenantId?: string): Promise<BgeProposal | null>;
  saveProposal(proposal: BgeProposal): Promise<BgeProposal>;
  createApproval(approval: BgeApproval): Promise<BgeApproval>;
  findApprovalByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<BgeApproval | null>;
  createRelationship(relationship: BgeRelationship): Promise<BgeRelationship>;
  findRelationshipByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<BgeRelationship | null>;
  getRelationshipById(relationshipId: string, tenantId?: string): Promise<BgeRelationship | null>;
  appendEvent(event: BgeEvent): Promise<void>;
  listEventsForObject(objectId: string, tenantId?: string): Promise<BgeEvent[]>;
  withTransaction<T>(operation: (repository: BgeRepository) => Promise<T>): Promise<T>;
}

class InMemoryBgeRepository implements BgeRepository {
  private readonly objects = new Map<string, BgeObject>();
  private readonly evidence = new Map<string, BgeEvidenceRecord>();
  private readonly proposals = new Map<string, BgeProposal>();
  private readonly approvals = new Map<string, BgeApproval>();
  private readonly relationships = new Map<string, BgeRelationship>();
  private readonly events: BgeEvent[] = [];

  constructor() {
    this.seed();
  }

  private seed(): void {
    const now = new Date().toISOString();

    const seedObject = (objectType: BgeCanonicalObject["object_type"], payload: Record<string, unknown>): void => {
      const objectId = bgeId("bgobj_");
      const versionId = bgeId("bgver_");
      const version: BgeVersion = {
        version_id: versionId,
        created_at: now,
        actor: { actor_type: "SYSTEM", actor_id: "seed" },
        evidence_ids: [],
        policy_ids: [],
        payload,
        reason: "Initial seed object",
      };

      this.objects.set(objectId, {
        object_id: objectId,
        tenant_id: "tenant_demo",
        object_type: objectType,
        lifecycle_state: "active",
        current_version_id: versionId,
        versions: [version],
      });
    };

    seedObject("BG.ORG.COMPANY", { legal_name: "Genesis Demo Company" });
    seedObject("BG.CATALOG.PRODUCT", { product_code: "DEMO-PROD-001", name: "Demo Product" });
    seedObject("BG.KNOWLEDGE.DOCUMENT", { title: "Demo Document", document_code: "DOC-001" });
    seedObject("BG.CONTENT.WEBSITE", { domain: "demo.genesis.local" });
  }

  async createEvidence(evidence: BgeEvidenceRecord): Promise<BgeEvidenceRecord> {
    this.evidence.set(evidence.evidence_id, evidence);
    this.objects.set(evidence.object_id, evidence);
    return evidence;
  }

  async getEvidenceById(evidenceId: string, tenantId?: string): Promise<BgeEvidenceRecord | null> {
    const evidence = this.evidence.get(evidenceId) ?? null;
    if (!evidence) {
      return null;
    }

    if (tenantId && evidence.tenant_id !== tenantId) {
      return null;
    }

    return evidence;
  }

  async getObjectById(objectId: string, tenantId?: string): Promise<BgeObject | null> {
    const object = this.objects.get(objectId) ?? null;
    if (!object) {
      return null;
    }

    if (tenantId && object.tenant_id !== tenantId) {
      return null;
    }

    return object;
  }

  async saveCanonicalObject(object: BgeCanonicalObject): Promise<BgeCanonicalObject> {
    this.objects.set(object.object_id, object);
    return object;
  }

  async createProposal(proposal: BgeProposal): Promise<BgeProposal> {
    this.proposals.set(proposal.proposal_id, proposal);
    return proposal;
  }

  async findProposalByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<BgeProposal | null> {
    return [...this.proposals.values()].find((proposal) => proposal.tenant_id === tenantId && proposal.idempotency_key === idempotencyKey) ?? null;
  }

  async getProposalById(proposalId: string, tenantId?: string): Promise<BgeProposal | null> {
    const proposal = this.proposals.get(proposalId) ?? null;
    if (!proposal) {
      return null;
    }

    if (tenantId && proposal.tenant_id !== tenantId) {
      return null;
    }

    return proposal;
  }

  async saveProposal(proposal: BgeProposal): Promise<BgeProposal> {
    this.proposals.set(proposal.proposal_id, proposal);
    return proposal;
  }

  async createApproval(approval: BgeApproval): Promise<BgeApproval> {
    this.approvals.set(approval.approval_id, approval);
    return approval;
  }

  async findApprovalByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<BgeApproval | null> {
    return [...this.approvals.values()].find((approval) => approval.tenant_id === tenantId && approval.idempotency_key === idempotencyKey) ?? null;
  }

  async createRelationship(relationship: BgeRelationship): Promise<BgeRelationship> {
    this.relationships.set(relationship.relationship_id, relationship);
    return relationship;
  }

  async findRelationshipByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<BgeRelationship | null> {
    return [...this.relationships.values()].find((relationship) => relationship.tenant_id === tenantId && relationship.idempotency_key === idempotencyKey) ?? null;
  }

  async getRelationshipById(relationshipId: string, tenantId?: string): Promise<BgeRelationship | null> {
    const relationship = this.relationships.get(relationshipId) ?? null;
    if (!relationship) {
      return null;
    }

    if (tenantId && relationship.tenant_id !== tenantId) {
      return null;
    }

    return relationship;
  }

  async appendEvent(event: BgeEvent): Promise<void> {
    this.events.push(event);
  }

  async listEventsForObject(objectId: string, tenantId?: string): Promise<BgeEvent[]> {
    return this.events
      .filter((event) => event.object_id === objectId)
      .filter((event) => !tenantId || event.tenant_id === tenantId)
      .sort((a, b) => {
        if (a.occurred_at !== b.occurred_at) {
          return a.occurred_at.localeCompare(b.occurred_at);
        }

        if (a.sequence_in_chain !== b.sequence_in_chain) {
          return a.sequence_in_chain - b.sequence_in_chain;
        }

        return a.event_id.localeCompare(b.event_id);
      });
  }

  async withTransaction<T>(operation: (repository: BgeRepository) => Promise<T>): Promise<T> {
    return operation(this);
  }
}

let singleton: BgeRepository | null = null;

export function createInMemoryBgeRepository(): BgeRepository {
  return new InMemoryBgeRepository();
}

export function setBgeRepositoryForTests(repository: BgeRepository | null): void {
  singleton = repository;
}

export function getBgeRepository(): BgeRepository {
  if (!singleton) {
    singleton = createPrismaBgeRepository();
  }

  return singleton;
}
