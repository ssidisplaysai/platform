import { geaId, nowIso, stableChecksum, stableStringify } from "@/lib/gea/agent-models";

export type ExecutiveConfidence = "HIGH" | "MEDIUM" | "LOW";
export type ExecutivePriority = "P1" | "P2" | "P3" | "P4";
export type ExecutiveStatus = "ON_TRACK" | "AT_RISK" | "BEHIND" | "BLOCKED" | "COMPLETE";
export type RecommendationCategory =
  | "FINANCIAL"
  | "OPERATIONS"
  | "MARKETING"
  | "SALES"
  | "MANUFACTURING"
  | "INVENTORY"
  | "CUSTOMER_SUCCESS"
  | "COMPLIANCE"
  | "TECHNOLOGY"
  | "WORKFORCE";

export type ExecutiveScopeFilter = {
  company?: string;
  division?: string;
  department?: string;
  projectId?: string;
  period?: string;
  geography?: string;
};

export type ExecutiveMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend: number;
  asOf: string;
  evidenceReferences: string[];
};

export type ExecutiveDashboard = {
  workspaceId: string;
  organizationId: string;
  filters: ExecutiveScopeFilter;
  revenue: ExecutiveMetric;
  profit: ExecutiveMetric;
  cashFlow: ExecutiveMetric;
  salesPipeline: ExecutiveMetric;
  marketingPerformance: ExecutiveMetric;
  manufacturingThroughput: ExecutiveMetric;
  inventoryHealth: ExecutiveMetric;
  purchasingStatus: ExecutiveMetric;
  customerHealth: ExecutiveMetric;
  projectHealth: ExecutiveMetric;
  systemHealth: ExecutiveMetric;
  generatedAt: string;
  immutableLineage: string;
};

export type ExecutiveKpiDefinition = {
  kpiId: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  owner: string;
  target: number;
  thresholdGreen: number;
  thresholdYellow: number;
  unit: string;
  versionTag: string;
  evidenceReferences: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveKpiHistoryRecord = {
  kpiHistoryId: string;
  kpiId: string;
  workspaceId: string;
  organizationId: string;
  measuredValue: number;
  trend: number;
  score: number;
  status: ExecutiveStatus;
  measuredAt: string;
  immutableLineage: string;
};

export type ExecutiveGoal = {
  goalId: string;
  workspaceId: string;
  organizationId: string;
  parentGoalId?: string;
  level: "ENTERPRISE" | "BUSINESS_UNIT" | "DEPARTMENT" | "PROJECT" | "INDIVIDUAL";
  title: string;
  owner: string;
  objective: string;
  keyResults: string[];
  milestones: string[];
  dependencies: string[];
  deadline: string;
  progressPercent: number;
  status: ExecutiveStatus;
  evidenceReferences: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveGoalHistoryRecord = {
  goalHistoryId: string;
  goalId: string;
  workspaceId: string;
  organizationId: string;
  progressPercent: number;
  status: ExecutiveStatus;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type ExecutiveRecommendation = {
  recommendationId: string;
  workspaceId: string;
  organizationId: string;
  category: RecommendationCategory;
  title: string;
  summary: string;
  evidenceReferences: string[];
  businessImpact: string;
  confidence: ExecutiveConfidence;
  requiredApprovals: string[];
  suggestedOwner: string;
  priority: ExecutivePriority;
  deterministicChecksum: string;
  reviewed: boolean;
  createdAt: string;
  immutableLineage: string;
};

export type ExecutiveRecommendationReview = {
  recommendationReviewId: string;
  recommendationId: string;
  workspaceId: string;
  organizationId: string;
  decision: "APPROVED" | "REJECTED";
  notes?: string;
  reviewedBy: string;
  reviewedAt: string;
  immutableLineage: string;
};

export type ExecutiveRisk = {
  riskId: string;
  workspaceId: string;
  organizationId: string;
  category:
    | "FINANCIAL"
    | "OPERATIONAL"
    | "COMPLIANCE"
    | "SECURITY"
    | "DELIVERY"
    | "VENDOR"
    | "CUSTOMER"
    | "MANUFACTURING";
  title: string;
  probability: number;
  impact: number;
  owner: string;
  mitigation: string;
  status: ExecutiveStatus;
  evidenceReferences: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveRiskHistoryRecord = {
  riskHistoryId: string;
  riskId: string;
  workspaceId: string;
  organizationId: string;
  status: ExecutiveStatus;
  reviewNote: string;
  reviewedBy: string;
  reviewedAt: string;
  immutableLineage: string;
};

export type ExecutiveOpportunity = {
  opportunityId: string;
  workspaceId: string;
  organizationId: string;
  category:
    | "REVENUE"
    | "COST_REDUCTION"
    | "EFFICIENCY"
    | "AUTOMATION"
    | "INVENTORY"
    | "MARKETING"
    | "SALES"
    | "MANUFACTURING";
  title: string;
  projectedImpact: string;
  owner: string;
  status: ExecutiveStatus;
  evidenceReferences: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveOpportunityHistoryRecord = {
  opportunityHistoryId: string;
  opportunityId: string;
  workspaceId: string;
  organizationId: string;
  status: ExecutiveStatus;
  note: string;
  changedBy: string;
  changedAt: string;
  immutableLineage: string;
};

export type ExecutiveDelegation = {
  delegationId: string;
  workspaceId: string;
  organizationId: string;
  targetAgent:
    | "MARKETING_AGENT"
    | "SALES_AGENT"
    | "FINANCE_AGENT"
    | "MANUFACTURING_AGENT"
    | "OPERATIONS_AGENT"
    | "CUSTOMER_SUCCESS_AGENT"
    | "ENGINEERING_AGENT"
    | "HR_AGENT";
  objective: string;
  orchestrationExecutionId: string;
  requestedBy: string;
  createdAt: string;
  immutableLineage: string;
};

export type ExecutiveApproval = {
  approvalId: string;
  workspaceId: string;
  organizationId: string;
  subjectType: "RECOMMENDATION" | "BRIEFING" | "DELEGATION";
  subjectId: string;
  state: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requiredApprovers: string[];
  approvedBy: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExecutiveBriefing = {
  briefingId: string;
  workspaceId: string;
  organizationId: string;
  period: string;
  executiveSummary: string;
  criticalAlerts: string[];
  topOpportunities: string[];
  topRisks: string[];
  completedGoals: string[];
  behindScheduleGoals: string[];
  operationalHighlights: string[];
  financialHighlights: string[];
  marketingHighlights: string[];
  manufacturingHighlights: string[];
  salesHighlights: string[];
  supportHighlights: string[];
  recommendedExecutiveActions: string[];
  evidenceReferences: string[];
  contextPackageId?: string;
  replayChecksum: string;
  createdBy: string;
  createdAt: string;
  immutableLineage: string;
};

export type ExecutiveTimelineEvent = {
  timelineEventId: string;
  workspaceId: string;
  organizationId: string;
  eventType:
    | "BRIEFING_GENERATED"
    | "RECOMMENDATION_CREATED"
    | "RECOMMENDATION_REVIEWED"
    | "DELEGATION_REQUESTED"
    | "GOAL_UPDATED"
    | "KPI_RECORDED"
    | "RISK_REVIEWED"
    | "OPPORTUNITY_UPDATED";
  subjectId: string;
  summary: string;
  actorId: string;
  evidenceReferences: string[];
  createdAt: string;
};

export type ExecutiveHealthSnapshot = {
  healthId: string;
  workspaceId: string;
  organizationId: string;
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  criticalRiskCount: number;
  behindGoalCount: number;
  openRecommendationCount: number;
  pendingApprovalCount: number;
  generatedAt: string;
  immutableLineage: string;
};

export function createExecutiveIds() {
  return {
    briefingId: geaId("gbabrief"),
    kpiId: geaId("gbakpi"),
    kpiHistoryId: geaId("gbakpih"),
    goalId: geaId("gbagoal"),
    goalHistoryId: geaId("gbagoalh"),
    recommendationId: geaId("gbarec"),
    recommendationReviewId: geaId("gbarecrev"),
    riskId: geaId("gbarisk"),
    riskHistoryId: geaId("gbariskh"),
    opportunityId: geaId("gbaopp"),
    opportunityHistoryId: geaId("gbaopph"),
    delegationId: geaId("gbadeleg"),
    approvalId: geaId("gbaappr"),
    timelineEventId: geaId("gbatime"),
    healthId: geaId("gbahealth"),
  };
}

export function gbaNowIso(): string {
  return nowIso();
}

export function gbaChecksum(value: unknown): string {
  return stableChecksum(value);
}

export function canonicalizeRecommendation(input: Pick<ExecutiveRecommendation, "category" | "title" | "summary" | "evidenceReferences" | "businessImpact" | "confidence" | "requiredApprovals" | "suggestedOwner" | "priority">): string {
  return stableStringify({
    ...input,
    evidenceReferences: [...input.evidenceReferences].sort((a, b) => a.localeCompare(b)),
    requiredApprovals: [...input.requiredApprovals].sort((a, b) => a.localeCompare(b)),
  });
}

export function createImmutableLineage(input: Record<string, unknown>): string {
  return stableChecksum(input);
}
