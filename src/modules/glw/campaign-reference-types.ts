export type GlwCampaignReferenceKind = "document" | "image";
export type GlwCampaignReferenceScope = "campaign" | "reference_only";
export type GlwCampaignReferenceRole =
  | "authoritative_fact"
  | "content_reference"
  | "product_image"
  | "image_style";

export type GlwCampaignReference = {
  referenceId: string;
  campaignId: string;
  organizationId: string;
  siteId: string;
  kind: GlwCampaignReferenceKind;
  scope: GlwCampaignReferenceScope;
  role: GlwCampaignReferenceRole;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
};

export type GlwCampaignKnowledgePack = {
  campaignId: string;
  organizationId: string;
  siteId: string;
  instructions: string;
  references: readonly GlwCampaignReference[];
  revision?: number;
  status?: "ready";
  parentCampaignId?: string | null;
  authorityReferences?: readonly {
    sourceType: "product" | "profile" | "parent_campaign" | "approved_reference" | "canonical_registry";
    sourceId: string;
    scope: "stable_fact" | "guidance" | "quality_evidence" | "geography";
  }[];
  ownerApprovalRequired?: boolean;
  approvedAt?: string | null;
  updatedAt: string;
};
