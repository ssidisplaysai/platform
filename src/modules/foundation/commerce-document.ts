export type CommerceDocumentLifecycleState =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "active"
  | "closed"
  | "archived"
  | "cancelled";

export type CommerceDocumentAddress = {
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
};

export type CommerceDocumentAttachment = {
  attachmentId: string;
  providerReference: string;
  mediaType: string;
  fileName: string;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
  createdBy: string;
};

export type CommerceDocumentNote = {
  noteId: string;
  visibility: "internal" | "external";
  body: string;
  createdAt: string;
  createdBy: string;
};

export type CommerceDocumentAuditEnvelope = {
  createdBy: string;
  updatedBy: string;
  correlationId: string | null;
};

export type CommerceDocumentBase = {
  documentId: string;
  documentNumber: string;
  organizationId: string;
  owningApplicationId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  revision: number;
  lifecycleState: CommerceDocumentLifecycleState;
  customerReference: string;
  customerContactReferences: readonly string[];
  ownerReference: string;
  salesRepresentativeReference: string | null;
  billingAddress: CommerceDocumentAddress | null;
  shippingAddress: CommerceDocumentAddress | null;
  installationAddress: CommerceDocumentAddress | null;
  serviceAddress: CommerceDocumentAddress | null;
  attachments: readonly CommerceDocumentAttachment[];
  notes: readonly CommerceDocumentNote[];
  metadata: Readonly<Record<string, string>>;
  auditEnvelope: CommerceDocumentAuditEnvelope;
};
