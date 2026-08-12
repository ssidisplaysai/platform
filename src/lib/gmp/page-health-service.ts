import { type GmpPageRepository } from "./page-repository";
import { buildPageGraph, GMP_PAGE_GRAPH_MODEL_VERSION } from "./page-graph-service";
import { buildPageLinkSummary, GMP_PAGE_LINK_MODEL_VERSION } from "./page-link-service";
import {
  GMP_PAGE_HEALTH_REPORT_VERSION,
  type GmpHealthExecutionReference,
  type GmpHealthScore,
  type GmpPageHealthReport,
} from "./page-health-contract";

export const GMP_PAGE_HEALTH_MODEL_VERSION = "gmp-page-health/v1";

export type { GmpHealthExecutionReference, GmpHealthIssue, GmpHealthScore, GmpPageHealthReport } from "./page-health-contract";

function scoreFromBlocks(base: number, blocking: number, warnings: number): number {
  return Math.max(0, base - blocking * 20 - warnings * 5);
}

function scoreBundle(input: { modelVersion: string; score: number; reason: string; blockingIssues: string[]; warnings: string[]; recommendations: string[] }): GmpHealthScore {
  return {
    ...input,
    timestamp: input.modelVersion,
  };
}

export async function buildPageHealthReport(input: {
  projectId: string;
  pageId?: string;
  repository: GmpPageRepository;
  executions?: GmpHealthExecutionReference[];
}): Promise<GmpPageHealthReport> {
  const graph = await buildPageGraph(input.projectId, input.repository);
  const links = await buildPageLinkSummary(input.projectId, input.repository);
  const pages = await input.repository.listPagesForProject(input.projectId, true);
  const page = input.pageId ? await input.repository.getPageById(input.pageId) : null;
  const readinessAssessments = await Promise.all(pages.map((page) => input.repository.getLatestReadinessAssessment(page.pageId)));
  const briefs = await Promise.all(pages.map((page) => input.repository.listBriefsForPage(page.pageId)));
  const currentBriefs = briefs.flat().filter(Boolean);

  const pagesReady = readinessAssessments.filter((assessment) => (assessment?.overallScore ?? 0) >= 80).length;
  const pagesBlocked = readinessAssessments.filter((assessment) => (assessment?.blockingIssues ?? []).length > 0).length;
  const missingBriefs = pages.filter((page) => !page.currentBriefId).length;
  const missingPlans = pages.filter((page) => !page.currentContentPlanId).length;
  const missingSections = pages.filter((page) => !page.currentContentPlanId).length;
  const averageReadiness = readinessAssessments.length === 0 ? 0 : Math.round(readinessAssessments.reduce((total, assessment) => total + (assessment?.overallScore ?? 0), 0) / readinessAssessments.length);
  const knowledgeBlocked = readinessAssessments.filter((assessment) => (assessment?.blockingIssues ?? []).includes("knowledge_references_missing")).length;
  const evidenceMissing = currentBriefs.filter((brief) => brief.evidenceRequirements.length === 0).length;
  const conflictedKnowledge = graph.issues.filter((issue) => issue.ruleId === "page.graph.circular").length;
  const expiredKnowledge = 0;
  const relationshipBroken = graph.issues.filter((issue) => issue.ruleId === "page.graph.disconnected").length;
  const circularReferences = graph.circularReferences.length;
  const weakClusters = links.weakClusterCoverage.length;
  const weakPillars = links.pillarCoverage.length === 0 ? 1 : 0;
  const disconnectedPages = graph.disconnectedNodeIds.length;
  const orphanPages = links.orphanPages.length;
  const missingInternalLinks = links.noOutboundLinks.length;
  const brokenPlannedLinks = links.brokenTargets.length;
  const duplicateCanonicals = graph.duplicateCanonicalTargets.length;
  const missingMetadata = pages.filter((page) => !page.metadata || Object.keys(page.metadata).length === 0).length;
  const generatedAt = [graph.generatedAt, links.generatedAt, ...pages.map((page) => page.updatedAt), ...readinessAssessments.map((assessment) => assessment?.createdAt).filter(Boolean)].filter(Boolean).sort().at(-1) ?? new Date(0).toISOString();
  const relationshipIssues = graph.issues;
  const linkIssues = links.issues;
  const latestExecution = input.executions?.[0];

  const relationshipHealth = scoreBundle({
    modelVersion: GMP_PAGE_HEALTH_MODEL_VERSION,
    score: graph.healthScore,
    reason: `${graph.issues.length} graph issue(s) found.`,
    blockingIssues: graph.issues.filter((issue) => issue.severity === "ERROR").map((issue) => issue.ruleId),
    warnings: graph.issues.filter((issue) => issue.severity === "WARNING").map((issue) => issue.ruleId),
    recommendations: graph.issues.map((issue) => issue.suggestedResolution),
  });

  const linkHealth = scoreBundle({
    modelVersion: GMP_PAGE_HEALTH_MODEL_VERSION,
    score: links.linkHealthScore,
    reason: `${links.issues.length} link issue(s) found.`,
    blockingIssues: links.issues.filter((issue) => issue.severity === "ERROR").map((issue) => issue.ruleId),
    warnings: links.issues.filter((issue) => issue.severity === "WARNING").map((issue) => issue.ruleId),
    recommendations: links.issues.map((issue) => issue.suggestedResolution),
  });

  const readinessHealth = scoreBundle({
    modelVersion: GMP_PAGE_HEALTH_MODEL_VERSION,
    score: scoreFromBlocks(100, pagesBlocked, pagesReady === 0 ? 1 : 0),
    reason: `${pagesReady} page(s) ready, ${pagesBlocked} blocked.`,
    blockingIssues: readinessAssessments.flatMap((assessment) => assessment?.blockingIssues ?? []),
    warnings: readinessAssessments.flatMap((assessment) => assessment?.warnings ?? []),
    recommendations: readinessAssessments.flatMap((assessment) => assessment?.recommendations ?? []),
  });

  const knowledgeHealth = scoreBundle({
    modelVersion: GMP_PAGE_HEALTH_MODEL_VERSION,
    score: scoreFromBlocks(100, knowledgeBlocked, evidenceMissing),
    reason: `${knowledgeBlocked} knowledge-blocked page(s).`,
    blockingIssues: knowledgeBlocked > 0 ? ["knowledge_references_missing"] : [],
    warnings: evidenceMissing > 0 ? ["briefs_missing_evidence_requirements"] : [],
    recommendations: ["Link approved knowledge records and evidence to the page brief."] ,
  });

  const seoHealth = scoreBundle({
    modelVersion: GMP_PAGE_HEALTH_MODEL_VERSION,
    score: scoreFromBlocks(100, brokenPlannedLinks + duplicateCanonicals, missingMetadata),
    reason: `${brokenPlannedLinks} broken planned link(s) and ${duplicateCanonicals} duplicate canonical target(s).`,
    blockingIssues: brokenPlannedLinks > 0 ? ["broken_planned_links"] : [],
    warnings: duplicateCanonicals > 0 ? ["duplicate_canonical_targets"] : [],
    recommendations: ["Resolve canonical targets, metadata gaps, and broken planned links."],
  });

  const overallPlanningHealth = scoreBundle({
    modelVersion: GMP_PAGE_HEALTH_MODEL_VERSION,
    score: Math.round((relationshipHealth.score + linkHealth.score + readinessHealth.score + knowledgeHealth.score + seoHealth.score) / 5),
    reason: `Combined from relationship, link, readiness, knowledge, and SEO health.`,
    blockingIssues: [...new Set([...relationshipHealth.blockingIssues, ...linkHealth.blockingIssues, ...readinessHealth.blockingIssues])],
    warnings: [...new Set([...relationshipHealth.warnings, ...linkHealth.warnings, ...readinessHealth.warnings])],
    recommendations: [...new Set([...relationshipHealth.recommendations, ...linkHealth.recommendations, ...readinessHealth.recommendations])],
  });

  relationshipHealth.timestamp = generatedAt;
  linkHealth.timestamp = generatedAt;
  readinessHealth.timestamp = generatedAt;
  knowledgeHealth.timestamp = generatedAt;
  seoHealth.timestamp = generatedAt;
  overallPlanningHealth.timestamp = generatedAt;

  return {
    reportVersion: GMP_PAGE_HEALTH_REPORT_VERSION,
    projectId: input.projectId,
    siteId: page?.siteId,
    pageId: input.pageId,
    generatedAt,
    graphModelVersion: GMP_PAGE_GRAPH_MODEL_VERSION,
    linkModelVersion: GMP_PAGE_LINK_MODEL_VERSION,
    relationshipHealth,
    linkHealth,
    readinessHealth,
    knowledgeHealth,
    seoHealth,
    overallPlanningHealth,
    graphHealthScore: graph.healthScore,
    linkHealthScore: links.linkHealthScore,
    pagesReady,
    pagesBlocked,
    missingBriefs,
    missingPlans,
    missingSections,
    averageReadiness,
    knowledgeBlocked,
    evidenceMissing,
    conflictedKnowledge,
    expiredKnowledge,
    relationshipBroken,
    circularReferences,
    weakClusters,
    weakPillars,
    disconnectedPages,
    orphanPages,
    missingInternalLinks,
    brokenPlannedLinks,
    duplicateCanonicals,
    missingMetadata,
    latestGopExecutions: (input.executions ?? []).slice(0, 5),
    diagnostics: {
      graph: {
        parentTree: graph.parentTree,
        childTree: graph.childTree,
        siblingGroups: graph.siblingGroups,
        clusterGroups: graph.clusterGroups,
        circularReferences: graph.circularReferences,
      },
      links: {
        inboundLinks: links.inboundLinks,
        outboundLinks: links.outboundLinks,
        issues: links.issues,
      },
      relationshipIssues,
      linkIssues,
      execution: latestExecution,
    },
  };
}
