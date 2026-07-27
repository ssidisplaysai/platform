import { createHash, randomUUID } from "node:crypto";

export const marketingCampaignStatuses = ["PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;
export const marketingStrategyStatuses = ["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"] as const;
export const marketingRecommendationStatuses = ["NEW", "REVIEWED", "APPROVED", "REJECTED", "DISMISSED"] as const;
export const marketingApprovalStatuses = ["PENDING", "APPROVED", "REJECTED", "ESCALATED"] as const;

export type MarketingCampaignStatus = (typeof marketingCampaignStatuses)[number];
export type MarketingStrategyStatus = (typeof marketingStrategyStatuses)[number];
export type MarketingRecommendationStatus = (typeof marketingRecommendationStatuses)[number];
export type MarketingApprovalStatus = (typeof marketingApprovalStatuses)[number];

export type MarketingDashboard = {
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  projectName: string;
  brandName?: string;
  activeCampaigns: number;
  contentStrategyStatus: MarketingStrategyStatus;
  seoCoverageScore: number;
  analyticsSignalScore: number;
  recommendationCount: number;
  healthScore: number;
  generatedAt: string;
  immutableLineage: string;
};

export type MarketingCampaignPlan = {
  marketingCampaignPlanId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  campaignName: string;
  objective: string;
  channelFocus: string[];
  targetAudience: string;
  status: MarketingCampaignStatus;
  startAt?: string;
  endAt?: string;
  budgetCents: number;
  expectedImpressions: number;
  expectedConversions: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  immutableLineage: string;
};

export type MarketingCampaignPlanHistory = {
  marketingCampaignPlanHistoryId: string;
  marketingCampaignPlanId: string;
  workspaceId: string;
  organizationId: string;
  status: MarketingCampaignStatus;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type MarketingContentStrategy = {
  marketingContentStrategyId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  title: string;
  summary: string;
  status: MarketingStrategyStatus;
  pillarTopics: string[];
  brandVoice: string;
  seoTheme: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  immutableLineage: string;
};

export type MarketingSeoIntelligence = {
  marketingSeoIntelligenceId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  score: number;
  opportunities: string[];
  blockers: string[];
  createdAt: string;
  immutableLineage: string;
};

export type MarketingBrandGovernanceReview = {
  marketingBrandGovernanceReviewId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  reviewState: "PASS" | "REVIEW" | "BLOCK";
  notes: string;
  reviewedBy: string;
  reviewedAt: string;
  immutableLineage: string;
};

export type MarketingAnalyticsSnapshot = {
  marketingAnalyticsSnapshotId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  sourceRecommendations: number;
  sourceCollections: number;
  trafficScore: number;
  engagementScore: number;
  conversionScore: number;
  createdAt: string;
  immutableLineage: string;
};

export type MarketingRecommendation = {
  marketingRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  category: string;
  title: string;
  summary: string;
  recommendedAction: string;
  priority: "P0" | "P1" | "P2" | "P3";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  status: MarketingRecommendationStatus;
  sourceReference: string;
  createdAt: string;
  immutableLineage: string;
};

export type MarketingRecommendationReview = {
  marketingRecommendationReviewId: string;
  marketingRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  decision: Extract<MarketingRecommendationStatus, "REVIEWED" | "APPROVED" | "REJECTED" | "DISMISSED">;
  notes?: string;
  reviewedBy: string;
  reviewedAt: string;
  immutableLineage: string;
};

export type MarketingTimelineEvent = {
  marketingTimelineEventId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  eventType: string;
  subjectId: string;
  summary: string;
  actorId: string;
  evidenceReferences: string[];
  createdAt: string;
  immutableLineage: string;
};

export type MarketingExecutiveReport = {
  marketingExecutiveReportId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  period: string;
  summary: string;
  campaignHighlights: Record<string, unknown>;
  contentHighlights: Record<string, unknown>;
  seoHighlights: Record<string, unknown>;
  createdAt: string;
  immutableLineage: string;
};

export type MarketingHealthSnapshot = {
  marketingHealthId: string;
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  status: "HEALTHY" | "DEGRADED" | "BLOCKED";
  blockedCampaigns: number;
  reviewBacklog: number;
  seoRisks: number;
  analyticsGaps: number;
  generatedAt: string;
  immutableLineage: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function marketingId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function stableMarketingChecksum(value: unknown): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(value));
  return hash.digest("hex");
}

export function createMarketingImmutableLineage(value: unknown): string {
  return stableMarketingChecksum(value);
}

export function createMarketingDashboardLineage(value: unknown): string {
  return createMarketingImmutableLineage(value);
}

export function createMarketingCampaignPlan(input: {
  workspaceId: string;
  organizationId: string;
  projectId: string;
  siteId?: string;
  campaignName: string;
  objective: string;
  channelFocus: string[];
  targetAudience: string;
  budgetCents: number;
  expectedImpressions: number;
  expectedConversions: number;
  createdBy: string;
}): MarketingCampaignPlan {
  const timestamp = nowIso();
  return {
    marketingCampaignPlanId: marketingId("gbamktcmp"),
    workspaceId: input.workspaceId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    siteId: input.siteId,
    campaignName: input.campaignName.trim(),
    objective: input.objective.trim(),
    channelFocus: [...new Set(input.channelFocus.map((entry) => entry.trim()).filter(Boolean))],
    targetAudience: input.targetAudience.trim(),
    status: "PLANNED",
    budgetCents: input.budgetCents,
    expectedImpressions: input.expectedImpressions,
    expectedConversions: input.expectedConversions,
    createdBy: input.createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
    immutableLineage: createMarketingImmutableLineage(input),
  };
}
