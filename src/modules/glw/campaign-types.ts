export type GlwCampaignStatus = "draft" | "active" | "paused" | "complete";
export type GlwCampaignPublicationPolicy = "draft_only" | "publish_after_gates";
export type GlwCampaignPageType = "state_service";

export type GlwCampaign = {
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  name: string;
  pageType: GlwCampaignPageType;
  stateCodes: readonly string[];
  pagesPerDay: number;
  publicationPolicy: GlwCampaignPublicationPolicy;
  imageRequired: boolean;
  status: GlwCampaignStatus;
  completedTargetCount: number;
  failedTargetCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NewGlwCampaignInput = {
  organizationId: string;
  siteId: string;
  productId: string;
  name: string;
  pageType: GlwCampaignPageType;
  stateCodes: readonly string[];
  pagesPerDay: number;
  publicationPolicy: GlwCampaignPublicationPolicy;
  imageRequired: boolean;
};
