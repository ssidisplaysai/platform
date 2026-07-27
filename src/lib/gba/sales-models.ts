import { createHash, randomUUID } from "node:crypto";

export const salesRecommendationStatuses = ["NEW", "REVIEWED", "APPROVED", "REJECTED", "DISMISSED"] as const;

export type SalesRecommendationStatus = (typeof salesRecommendationStatuses)[number];

export type SalesPipelineStage = "PROSPECT" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "COMMITTED";

export type SalesDashboardMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend: number;
  asOf: string;
  evidenceReferences: string[];
};

export type SalesDashboard = {
  workspaceId: string;
  organizationId: string;
  totalPipelineValue: SalesDashboardMetric;
  weightedForecast: SalesDashboardMetric;
  winRate: SalesDashboardMetric;
  cycleTimeDays: SalesDashboardMetric;
  accountRiskScore: SalesDashboardMetric;
  fulfillmentReadiness: SalesDashboardMetric;
  recommendationCount: SalesDashboardMetric;
  generatedAt: string;
  immutableLineage: string;
};

export type SalesPipelineRecord = {
  salesPipelineRecordId: string;
  workspaceId: string;
  organizationId: string;
  accountId: string;
  accountName: string;
  opportunityReference: string;
  stage: SalesPipelineStage;
  amountCents: number;
  weightedAmountCents: number;
  probabilityPercent: number;
  expectedCloseAt: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  immutableLineage: string;
};

export type SalesForecastSnapshot = {
  salesForecastSnapshotId: string;
  workspaceId: string;
  organizationId: string;
  period: string;
  pipelineAmountCents: number;
  weightedAmountCents: number;
  committedAmountCents: number;
  modeledWinRatePercent: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  assumptions: string[];
  createdAt: string;
  immutableLineage: string;
};

export type SalesAccountIntelligence = {
  salesAccountIntelligenceId: string;
  workspaceId: string;
  organizationId: string;
  accountId: string;
  accountName: string;
  relationshipHealthScore: number;
  expansionPotentialScore: number;
  churnRiskScore: number;
  openOpportunities: number;
  openRevenueCents: number;
  signals: string[];
  updatedAt: string;
  immutableLineage: string;
};

export type SalesRecommendation = {
  salesRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  category: "PIPELINE" | "FORECAST" | "ACCOUNT" | "FULFILLMENT";
  title: string;
  summary: string;
  recommendedAction: string;
  priority: "P0" | "P1" | "P2" | "P3";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  status: SalesRecommendationStatus;
  sourceReference: string;
  createdAt: string;
  immutableLineage: string;
};

export type SalesRecommendationReview = {
  salesRecommendationReviewId: string;
  salesRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  decision: Extract<SalesRecommendationStatus, "REVIEWED" | "APPROVED" | "REJECTED" | "DISMISSED">;
  notes?: string;
  reviewedBy: string;
  reviewedAt: string;
  immutableLineage: string;
};

export type SalesTimelineEvent = {
  salesTimelineEventId: string;
  workspaceId: string;
  organizationId: string;
  eventType: string;
  subjectId: string;
  summary: string;
  actorId: string;
  evidenceReferences: string[];
  createdAt: string;
  immutableLineage: string;
};

export type SalesHealthSnapshot = {
  salesHealthId: string;
  workspaceId: string;
  organizationId: string;
  status: "HEALTHY" | "DEGRADED" | "BLOCKED";
  stalledOpportunityCount: number;
  riskyAccountCount: number;
  forecastGapCount: number;
  fulfillmentConstraintCount: number;
  generatedAt: string;
  immutableLineage: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function salesId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function stableSalesChecksum(value: unknown): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(value));
  return hash.digest("hex");
}

export function createSalesImmutableLineage(value: unknown): string {
  return stableSalesChecksum(value);
}

export function createSalesPipelineRecord(input: {
  workspaceId: string;
  organizationId: string;
  accountId: string;
  accountName: string;
  opportunityReference: string;
  stage: SalesPipelineStage;
  amountCents: number;
  probabilityPercent: number;
  expectedCloseAt: string;
  ownerId: string;
}): SalesPipelineRecord {
  const timestamp = nowIso();
  const weightedAmountCents = Math.round((input.amountCents * input.probabilityPercent) / 100);

  return {
    salesPipelineRecordId: salesId("gbasalespipe"),
    workspaceId: input.workspaceId,
    organizationId: input.organizationId,
    accountId: input.accountId,
    accountName: input.accountName,
    opportunityReference: input.opportunityReference,
    stage: input.stage,
    amountCents: input.amountCents,
    weightedAmountCents,
    probabilityPercent: input.probabilityPercent,
    expectedCloseAt: input.expectedCloseAt,
    ownerId: input.ownerId,
    createdAt: timestamp,
    updatedAt: timestamp,
    immutableLineage: createSalesImmutableLineage(input),
  };
}

export function toSalesDollars(cents: number): number {
  return Math.round((cents / 100) * 100) / 100;
}
