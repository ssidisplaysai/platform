export type DocumentId = string;
export type TenantId = string;
export type RevisionId = string;
export type TemplateId = string;
export type ApprovalId = string;
export type SignatureId = string;

export type DocumentType =
  | "CONTRACT"
  | "PROPOSAL"
  | "QUOTE"
  | "INVOICE"
  | "PURCHASE_ORDER"
  | "SOP"
  | "POLICY"
  | "MANUAL"
  | "SPECIFICATION"
  | "REPORT"
  | "FORM"
  | "GENERATED_PDF"
  | "GENERATED_DOCX"
  | "GENERATED_HTML";

export type DocumentLifecycleStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "ACTIVE" | "ARCHIVED" | "RETIRED";

export type DocumentApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type DocumentActorContext = {
  actorId: string;
  occurredAt: string;
  source?: string;
  correlationId?: string;
  causationId?: string;
};

export type DocumentMetadataValue = string | number | boolean | null;
export type DocumentMetadata = Record<string, DocumentMetadataValue>;

export type DocumentStructuredContent = {
  schemaVersion: "1.0.0";
  sections: Array<{ sectionId: string; title: string; body: string }>;
  fields: Record<string, string | number | boolean | null>;
};

export type DocumentTemplate = {
  templateId: TemplateId;
  tenantId: TenantId;
  name: string;
  version: number;
  format: "HTML" | "DOCX" | "PDF";
  templateBody: string;
  metadata: DocumentMetadata;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type DocumentRevision = {
  revisionId: RevisionId;
  documentId: DocumentId;
  tenantId: TenantId;
  revisionNumber: number;
  changeSummary: string;
  content: DocumentStructuredContent;
  metadata: DocumentMetadata;
  createdAt: string;
  createdBy: string;
};

export type DocumentApprovalEvent = {
  approvalId: ApprovalId;
  documentId: DocumentId;
  tenantId: TenantId;
  fromStatus: DocumentApprovalStatus;
  toStatus: DocumentApprovalStatus;
  reason?: string;
  actor: DocumentActorContext;
  occurredAt: string;
};

export type DocumentSignature = {
  signatureId: SignatureId;
  documentId: DocumentId;
  tenantId: TenantId;
  signerActorId: string;
  signerName: string;
  signatureType: "APPROVAL" | "ATTESTATION" | "ACKNOWLEDGEMENT";
  signedAt: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
};

export type DocumentRelationship = {
  relationshipId: string;
  tenantId: TenantId;
  fromDocumentId: DocumentId;
  toDocumentId: DocumentId;
  relationshipType: "REFERENCES" | "DERIVED_FROM" | "SUPERCEDES" | "SUPPORTS";
  createdAt: string;
  createdBy: string;
};

export type DocumentAssetReference = {
  referenceId: string;
  tenantId: TenantId;
  documentId: DocumentId;
  assetId: string;
  role: "PRIMARY_OUTPUT" | "ATTACHMENT" | "SOURCE" | "EVIDENCE";
  metadata: DocumentMetadata;
  createdAt: string;
  createdBy: string;
};

export type DocumentRecord = {
  documentId: DocumentId;
  tenantId: TenantId;
  type: DocumentType;
  title: string;
  ownerOrganizationId?: string;
  ownerContactId?: string;
  lifecycleStatus: DocumentLifecycleStatus;
  approvalStatus: DocumentApprovalStatus;
  metadata: DocumentMetadata;
  currentRevisionId: RevisionId;
  revisions: DocumentRevision[];
  approvalHistory: DocumentApprovalEvent[];
  signatures: DocumentSignature[];
  relationships: string[];
  assetReferences: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type DocumentAuditRecord = {
  auditId: string;
  eventType: string;
  tenantId: TenantId;
  documentId?: DocumentId;
  actor: DocumentActorContext;
  message: string;
  details?: Record<string, unknown>;
  recordedAt: string;
};

export type DocumentMetrics = {
  documentsTotal: number;
  draftDocuments: number;
  reviewDocuments: number;
  approvedDocuments: number;
  activeDocuments: number;
  archivedDocuments: number;
  retiredDocuments: number;
  revisionsTotal: number;
  templatesTotal: number;
  approvalsTotal: number;
  signaturesTotal: number;
  activeSignatures: number;
  relationshipsTotal: number;
  assetReferencesTotal: number;
  generatedOutputsTotal: number;
  recoveryCount: number;
  corruptStateCount: number;
  auditEvents: number;
};

export type DocumentHealth = {
  status: "HEALTHY" | "DEGRADED";
  generatedAt: string;
  checks: Array<{
    name:
      | "persistence"
      | "registry"
      | "templates"
      | "revisions"
      | "approvals"
      | "signatures"
      | "lifecycle"
      | "relationships"
      | "assetReferences";
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
};

export type DocumentPersistedState = {
  schemaVersion: "1.0.0";
  documents: DocumentRecord[];
  templates: DocumentTemplate[];
  relationships: DocumentRelationship[];
  assetReferences: DocumentAssetReference[];
  audits: DocumentAuditRecord[];
  metrics: DocumentMetrics;
};

export function createDefaultDocumentMetrics(): DocumentMetrics {
  return {
    documentsTotal: 0,
    draftDocuments: 0,
    reviewDocuments: 0,
    approvedDocuments: 0,
    activeDocuments: 0,
    archivedDocuments: 0,
    retiredDocuments: 0,
    revisionsTotal: 0,
    templatesTotal: 0,
    approvalsTotal: 0,
    signaturesTotal: 0,
    activeSignatures: 0,
    relationshipsTotal: 0,
    assetReferencesTotal: 0,
    generatedOutputsTotal: 0,
    recoveryCount: 0,
    corruptStateCount: 0,
    auditEvents: 0,
  };
}

export function createDefaultDocumentPersistedState(): DocumentPersistedState {
  return {
    schemaVersion: "1.0.0",
    documents: [],
    templates: [],
    relationships: [],
    assetReferences: [],
    audits: [],
    metrics: createDefaultDocumentMetrics(),
  };
}

export type DocumentErrorCode =
  | "DOCUMENT_INVALID"
  | "DOCUMENT_DUPLICATE"
  | "DOCUMENT_NOT_FOUND"
  | "TEMPLATE_NOT_FOUND"
  | "TENANT_MISMATCH"
  | "REVISION_INVALID"
  | "APPROVAL_TRANSITION_INVALID"
  | "SIGNATURE_INVALID"
  | "LIFECYCLE_TRANSITION_INVALID"
  | "STATE_CORRUPT"
  | "PERSISTENCE_FAILURE"
  | "RECOVERY_FAILURE";

export type DocumentErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export class DocumentError extends Error {
  constructor(
    public readonly code: DocumentErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly auditRequired: boolean,
    public readonly severity: DocumentErrorSeverity,
  ) {
    super(message);
    this.name = "DocumentError";
  }
}
