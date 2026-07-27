import { createHash } from "node:crypto";
import { type GmpInternalLinkPlan } from "./page-models";
import { type GmpPageRepository } from "./page-repository";
import { buildPageGraph, type GmpPageGraphIssue } from "./page-graph-service";

export const GMP_PAGE_LINK_MODEL_VERSION = "gmp-page-link/v1";

export type GmpPageLinkSummary = {
  modelVersion: string;
  generatedAt: string;
  projectId: string;
  inboundLinks: Record<string, string[]>;
  outboundLinks: Record<string, string[]>;
  requiredLinks: GmpInternalLinkPlan[];
  recommendedLinks: GmpInternalLinkPlan[];
  missingLinks: string[];
  duplicateLinks: string[];
  brokenTargets: string[];
  weakAnchorDiversity: string[];
  weakClusterCoverage: string[];
  pillarCoverage: string[];
  clusterCoverage: string[];
  orphanPages: string[];
  noOutboundLinks: string[];
  noInboundLinks: string[];
  linkDensity: number;
  linkHealthScore: number;
  issues: GmpPageGraphIssue[];
};

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function buildPageLinkSummary(projectId: string, repository: GmpPageRepository): Promise<GmpPageLinkSummary> {
  const graph = await buildPageGraph(projectId, repository);
  const linksByPage = new Map<string, GmpInternalLinkPlan[]>();
  const inbound = new Map<string, string[]>();
  const outbound = new Map<string, string[]>();
  const brokenTargets: string[] = [];
  const duplicateLinks: string[] = [];
  const requiredLinks: GmpInternalLinkPlan[] = [];
  const recommendedLinks: GmpInternalLinkPlan[] = [];

  for (const link of graph.internalLinks) {
    if (!graph.pages.some((page) => page.pageId === link.sourcePageId) || !graph.pages.some((page) => page.pageId === link.targetPageId)) {
      brokenTargets.push(link.internalLinkPlanId);
      continue;
    }
    const links = linksByPage.get(link.sourcePageId) ?? [];
    const duplicate = links.find((entry) => entry.targetPageId === link.targetPageId && entry.linkPurpose === link.linkPurpose && entry.anchorTextGuidance === link.anchorTextGuidance);
    if (duplicate) duplicateLinks.push(link.internalLinkPlanId);
    links.push(link);
    linksByPage.set(link.sourcePageId, links);

    (outbound.get(link.sourcePageId) ?? outbound.set(link.sourcePageId, []).get(link.sourcePageId)!).push(link.targetPageId);
    (inbound.get(link.targetPageId) ?? inbound.set(link.targetPageId, []).get(link.targetPageId)!).push(link.sourcePageId);
    if (link.requirementLevel === "REQUIRED") requiredLinks.push(link);
    else recommendedLinks.push(link);
  }

  const weakAnchorDiversity: string[] = [];
  for (const [pageId, links] of linksByPage.entries()) {
    const anchorGuidance = new Set(links.map((link) => link.anchorTextGuidance ?? ""));
    if (anchorGuidance.size > 0 && anchorGuidance.size < Math.max(1, Math.ceil(links.length / 2))) {
      weakAnchorDiversity.push(pageId);
    }
  }

  const clusterCoverage = [...new Set(requiredLinks.map((link) => stableHash({ target: link.targetPageId, purpose: link.linkPurpose }).slice(0, 10)))];
  const pillarCoverage = [...new Set(requiredLinks.filter((link) => link.linkPurpose === "Pillar").map((link) => link.targetPageId))];
  const weakClusterCoverage = graph.clusterGroups ? Object.entries(graph.clusterGroups).filter(([, group]) => new Set(group).size < 2).map(([groupKey]) => groupKey) : [];
  const orphanPages = graph.pages.filter((page) => !(inbound.get(page.pageId)?.length) && !(outbound.get(page.pageId)?.length)).map((page) => page.pageId);
  const noOutboundLinks = graph.pages.filter((page) => !(outbound.get(page.pageId)?.length)).map((page) => page.pageId);
  const noInboundLinks = graph.pages.filter((page) => !(inbound.get(page.pageId)?.length)).map((page) => page.pageId);
  const missingLinks = noOutboundLinks.filter((pageId) => !requiredLinks.some((link) => link.sourcePageId === pageId));
  const linkDensity = graph.pages.length === 0 ? 0 : Math.round((graph.internalLinks.length / graph.pages.length) * 10) / 10;
  const linkHealthScore = Math.max(0, 100 - brokenTargets.length * 15 - duplicateLinks.length * 10 - orphanPages.length * 5 - weakAnchorDiversity.length * 5);
  const generatedAt = [...graph.pages.map((page) => page.canonicalUrl), ...graph.relationships.map((relationship) => relationship.createdAt), ...graph.internalLinks.map((link) => link.updatedAt)].filter(Boolean).sort().at(-1) ?? new Date(0).toISOString();

  const issues: GmpPageGraphIssue[] = [
    ...brokenTargets.map((linkId) => ({ ruleId: "page.link.broken-target", severity: "ERROR" as const, reason: "Internal link target is missing from the page graph.", suggestedResolution: "Point the link at a canonical page in this project.", affectedPageIds: [linkId] })),
    ...duplicateLinks.map((linkId) => ({ ruleId: "page.link.duplicate", severity: "WARNING" as const, reason: "Duplicate internal link detected.", suggestedResolution: "Remove the redundant planned link.", affectedPageIds: [linkId] })),
    ...orphanPages.map((pageId) => ({ ruleId: "page.link.orphan", severity: "WARNING" as const, reason: "The page has no inbound or outbound links.", suggestedResolution: "Add at least one inbound or outbound link.", affectedPageIds: [pageId] })),
  ];

  return {
    modelVersion: GMP_PAGE_LINK_MODEL_VERSION,
    generatedAt,
    projectId,
    inboundLinks: Object.fromEntries([...inbound.entries()]),
    outboundLinks: Object.fromEntries([...outbound.entries()]),
    requiredLinks,
    recommendedLinks,
    missingLinks,
    duplicateLinks,
    brokenTargets,
    weakAnchorDiversity,
    weakClusterCoverage,
    pillarCoverage,
    clusterCoverage,
    orphanPages,
    noOutboundLinks,
    noInboundLinks,
    linkDensity,
    linkHealthScore,
    issues,
  };
}
