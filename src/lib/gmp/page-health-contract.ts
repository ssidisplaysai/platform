export const GMP_PAGE_HEALTH_REPORT_VERSION = "gmp-page-health-report/v1";

export type GmpHealthIssue = {
  ruleId: string;
  severity: "INFO" | "WARNING" | "ERROR";
  reason: string;
  suggestedResolution: string;
  affectedPageIds?: string[];
};

export type GmpHealthScore = {
  score: number;
  reason: string;
  blockingIssues: string[];
  warnings: string[];
  recommendations: string[];
  modelVersion: string;
  timestamp: string;
};

export type GmpHealthExecutionReference = {
  executionId?: string;
  status?: string;
  operationType?: string;
  createdAt?: string;
  projectId?: string;
  siteId?: string;
  pageId?: string;
  reportVersion?: string;
  relationshipRuleVersion?: string;
  linkRuleVersion?: string;
  knowledgeWorkspaceVersion?: number;
};

export type GmpHealthDiagnostics = {
  graph: {
    parentTree: Record<string, string[]>;
    childTree: Record<string, string[]>;
    siblingGroups: Record<string, string[]>;
    clusterGroups: Record<string, string[]>;
    circularReferences: string[][];
  };
  links: {
    inboundLinks: Record<string, string[]>;
    outboundLinks: Record<string, string[]>;
    issues: GmpHealthIssue[];
  };
  relationshipIssues: GmpHealthIssue[];
  linkIssues: GmpHealthIssue[];
  execution?: GmpHealthExecutionReference;
};

export type GmpPageHealthReport = {
  reportVersion: string;
  projectId: string;
  siteId?: string;
  pageId?: string;
  generatedAt: string;
  graphModelVersion: string;
  linkModelVersion: string;
  relationshipHealth: GmpHealthScore;
  linkHealth: GmpHealthScore;
  readinessHealth: GmpHealthScore;
  knowledgeHealth: GmpHealthScore;
  seoHealth: GmpHealthScore;
  overallPlanningHealth: GmpHealthScore;
  graphHealthScore: number;
  linkHealthScore: number;
  pagesReady: number;
  pagesBlocked: number;
  missingBriefs: number;
  missingPlans: number;
  missingSections: number;
  averageReadiness: number;
  knowledgeBlocked: number;
  evidenceMissing: number;
  conflictedKnowledge: number;
  expiredKnowledge: number;
  relationshipBroken: number;
  circularReferences: number;
  weakClusters: number;
  weakPillars: number;
  disconnectedPages: number;
  orphanPages: number;
  missingInternalLinks: number;
  brokenPlannedLinks: number;
  duplicateCanonicals: number;
  missingMetadata: number;
  latestGopExecutions: GmpHealthExecutionReference[];
  diagnostics: GmpHealthDiagnostics;
};