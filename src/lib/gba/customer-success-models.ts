import { createHash, randomUUID } from "node:crypto";

export const customerSuccessRecommendationStatuses = ["NEW", "REVIEWED", "APPROVED", "REJECTED", "DISMISSED"] as const;

export type CustomerSuccessRecommendationStatus = (typeof customerSuccessRecommendationStatuses)[number];

export type CustomerSuccessMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend: number;
  asOf: string;
  evidenceReferences: string[];
};

export type CustomerSuccessDashboard = {
  workspaceId: string;
  organizationId: string;
  activeCustomers: CustomerSuccessMetric;
  customerHealthSummary: CustomerSuccessMetric;
  onboardingProgress: CustomerSuccessMetric;
  renewalsDue: CustomerSuccessMetric;
  renewalPipeline: CustomerSuccessMetric;
  churnRiskSummary: CustomerSuccessMetric;
  expansionOpportunities: CustomerSuccessMetric;
  customerSatisfactionTrends: CustomerSuccessMetric;
  supportActivitySummary: CustomerSuccessMetric;
  executiveCustomerAlerts: CustomerSuccessMetric;
  generatedAt: string;
  immutableLineage: string;
};

export type CustomerSuccessOnboardingRecord = {
  customerSuccessOnboardingId: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "AT_RISK" | "READY_FOR_GO_LIVE" | "COMPLETE";
  implementationMilestones: string[];
  trainingProgressPercent: number;
  documentationCompletionPercent: number;
  goLiveReadinessPercent: number;
  adoptionCheckpointPercent: number;
  ownerId: string;
  updatedAt: string;
  immutableLineage: string;
};

export type CustomerSuccessHealthRecord = {
  customerSuccessHealthId: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  overallHealthScore: number;
  trendDirection: "IMPROVING" | "STABLE" | "DECLINING";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  productAdoptionScore: number;
  renewalHistoryScore: number;
  supportInteractionScore: number;
  engagementScore: number;
  satisfactionScore: number;
  executiveEscalationScore: number;
  financialStandingScore: number;
  operationalDeliveryScore: number;
  recommendedActions: string[];
  measuredAt: string;
  immutableLineage: string;
};

export type CustomerSuccessPlan = {
  customerSuccessPlanId: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  strategicObjectives: string[];
  customerGoals: string[];
  milestones: string[];
  actionItems: string[];
  reviewSchedule: string;
  successOutcomes: string[];
  updatedAt: string;
  immutableLineage: string;
};

export type CustomerSuccessRenewal = {
  customerSuccessRenewalId: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  contractReference: string;
  contractExpiresAt: string;
  renewalProbabilityPercent: number;
  renewalForecastCents: number;
  churnRiskPercent: number;
  escalationRequired: boolean;
  recommendationSummary: string;
  updatedAt: string;
  immutableLineage: string;
};

export type CustomerSuccessSatisfaction = {
  customerSuccessSatisfactionId: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  csatScore: number;
  npsScore: number;
  sentimentTrend: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  surveySummary: string;
  feedbackHighlights: string[];
  measuredAt: string;
  immutableLineage: string;
};

export type CustomerSuccessSupportSignal = {
  customerSuccessSupportSignalId: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  openIssues: number;
  escalations: number;
  resolutionProgressPercent: number;
  slaPerformancePercent: number;
  communicationSummary: string;
  updatedAt: string;
  immutableLineage: string;
};

export type CustomerSuccessExpansionOpportunity = {
  customerSuccessExpansionOpportunityId: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  opportunityType: "UPSELL" | "CROSS_SELL";
  productAdoptionGap: string;
  growthIndicator: string;
  projectedRevenueCents: number;
  confidenceScore: number;
  recommendationSummary: string;
  updatedAt: string;
  immutableLineage: string;
};

export type CustomerSuccessKpi = {
  customerSuccessKpiId: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  value: number;
  unit: string;
  target: number;
  trend: number;
  measuredAt: string;
  immutableLineage: string;
};

export type CustomerSuccessRecommendation = {
  customerSuccessRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  category: "AT_RISK" | "RENEWAL" | "ESCALATION" | "ADOPTION" | "OUTREACH" | "PLAN_UPDATE" | "EXPANSION" | "ENGAGEMENT";
  title: string;
  summary: string;
  recommendedAction: string;
  priority: "P0" | "P1" | "P2" | "P3";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  status: CustomerSuccessRecommendationStatus;
  sourceReference: string;
  createdAt: string;
  immutableLineage: string;
};

export type CustomerSuccessRecommendationReview = {
  customerSuccessRecommendationReviewId: string;
  customerSuccessRecommendationId: string;
  workspaceId: string;
  organizationId: string;
  decision: Extract<CustomerSuccessRecommendationStatus, "REVIEWED" | "APPROVED" | "REJECTED" | "DISMISSED">;
  notes?: string;
  reviewedBy: string;
  reviewedAt: string;
  immutableLineage: string;
};

export type CustomerSuccessExecutiveReport = {
  customerSuccessExecutiveReportId: string;
  workspaceId: string;
  organizationId: string;
  period: "DAILY" | "WEEKLY" | "MONTHLY";
  summary: string;
  churnForecast: string;
  renewalForecast: string;
  strategicRisks: string[];
  strategicOpportunities: string[];
  createdAt: string;
  immutableLineage: string;
};

export type CustomerSuccessTimelineEvent = {
  customerSuccessTimelineEventId: string;
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

export type CustomerSuccessHealthSnapshot = {
  customerSuccessAgentHealthId: string;
  workspaceId: string;
  organizationId: string;
  status: "HEALTHY" | "DEGRADED" | "BLOCKED";
  atRiskCustomers: number;
  renewalsAtRisk: number;
  escalatedAccounts: number;
  onboardingDelays: number;
  generatedAt: string;
  immutableLineage: string;
};

export function customerSuccessId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function stableCustomerSuccessChecksum(value: unknown): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(value));
  return hash.digest("hex");
}

export function createCustomerSuccessImmutableLineage(value: unknown): string {
  return stableCustomerSuccessChecksum(value);
}

export function customerSuccessNowIso(): string {
  return new Date().toISOString();
}
