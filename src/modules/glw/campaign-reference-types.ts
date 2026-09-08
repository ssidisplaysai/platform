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
  updatedAt: string;
};
