import { createHash } from "node:crypto";
import { type GmpInternalLinkPlan, type GmpPage, type GmpPageRelationship } from "./page-models";
import { type GmpPageRepository } from "./page-repository";

export const GMP_PAGE_GRAPH_MODEL_VERSION = "gmp-page-graph/v1";

export type GmpPageGraphNode = {
  pageId: string;
  siteId: string;
  parentPageId?: string;
  canonicalUrl: string;
  name: string;
  slug: string;
  pageType: string;
  lifecycleState: string;
  publishingState: string;
};

export type GmpPageGraphIssue = {
  ruleId: string;
  severity: "INFO" | "WARNING" | "ERROR";
  reason: string;
  suggestedResolution: string;
  affectedPageIds: string[];
};

export type GmpPageGraph = {
  modelVersion: string;
  projectId: string;
  generatedAt: string;
  pages: GmpPageGraphNode[];
  relationships: GmpPageRelationship[];
  internalLinks: GmpInternalLinkPlan[];
  parentTree: Record<string, string[]>;
  childTree: Record<string, string[]>;
  siblingGroups: Record<string, string[]>;
  clusterGroups: Record<string, string[]>;
  redirectChains: string[][];
  canonicalChains: string[][];
  relationshipCounts: Record<string, number>;
  disconnectedNodeIds: string[];
  circularReferences: string[][];
  brokenReferences: string[];
  unusedPageIds: string[];
  duplicateCanonicalTargets: string[];
  healthScore: number;
  issues: GmpPageGraphIssue[];
};

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function groupBy<T>(items: T[], keySelector: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((accumulator, item) => {
    const key = keySelector(item);
    (accumulator[key] ??= []).push(item);
    return accumulator;
  }, {});
}

function buildChains(startId: string, edges: Map<string, string[]>, visited: Set<string> = new Set()): string[] {
  const chain: string[] = [];
  let current = startId;
  while (current && !visited.has(current)) {
    visited.add(current);
    chain.push(current);
    const next = edges.get(current)?.[0];
    if (!next) break;
    current = next;
  }
  return chain;
}

function detectCycles(edges: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (nodeId: string, stack: string[]) => {
    if (visiting.has(nodeId)) {
      const start = stack.indexOf(nodeId);
      if (start >= 0) cycles.push(stack.slice(start));
      return;
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    stack.push(nodeId);
    for (const next of edges.get(nodeId) ?? []) dfs(next, stack);
    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const nodeId of edges.keys()) dfs(nodeId, []);
  return cycles;
}

function maxIso(values: Array<string | null | undefined>): string {
  const sorted = values.filter((value): value is string => Boolean(value)).sort();
  return sorted[sorted.length - 1] ?? new Date(0).toISOString();
}

export async function buildPageGraph(projectId: string, repository: GmpPageRepository): Promise<GmpPageGraph> {
  const pages = await repository.listPagesForProject(projectId, true);
  const relationships = await Promise.all(pages.map((page) => repository.listRelationshipsForPage(page.pageId)));
  const links = await Promise.all(pages.map((page) => repository.listInternalLinksForPage(page.pageId)));
  const allRelationships = relationships.flat();
  const allLinks = links.flat();
  const nodeMap = new Map<string, GmpPage>(pages.map((page) => [page.pageId, page]));

  const parentTree: Record<string, string[]> = {};
  const childTree: Record<string, string[]> = {};
  const siblingGroups: Record<string, string[]> = {};
  const clusterGroups: Record<string, string[]> = {};
  const canonicalTargets = new Map<string, string[]>();
  const relationshipCounts: Record<string, number> = {};
  const brokenReferences: string[] = [];
  const disconnectedNodeIds = new Set(pages.map((page) => page.pageId));
  const unusedPageIds = new Set(pages.map((page) => page.pageId));

  for (const relationship of allRelationships) {
    relationshipCounts[relationship.relationshipType] = (relationshipCounts[relationship.relationshipType] ?? 0) + 1;
    if (!nodeMap.has(relationship.sourcePageId) || !nodeMap.has(relationship.targetPageId)) {
      brokenReferences.push(relationship.relationshipId);
      continue;
    }

    disconnectedNodeIds.delete(relationship.sourcePageId);
    disconnectedNodeIds.delete(relationship.targetPageId);
    unusedPageIds.delete(relationship.sourcePageId);
    unusedPageIds.delete(relationship.targetPageId);

    if (relationship.relationshipType === "Parent") {
      (parentTree[relationship.targetPageId] ??= []).push(relationship.sourcePageId);
      (childTree[relationship.sourcePageId] ??= []).push(relationship.targetPageId);
    }

    if (relationship.relationshipType === "Sibling") {
      const groupKey = [relationship.sourcePageId, relationship.targetPageId].sort().join("::");
      (siblingGroups[groupKey] ??= []).push(relationship.sourcePageId, relationship.targetPageId);
    }

    if (["Cluster", "Pillar", "Supports", "Supported By", "Related", "Alternative", "Comparison", "Canonical Variant", "Localized Variant", "Campaign"].includes(relationship.relationshipType)) {
      const groupKey = stableHash({ type: relationship.relationshipType, source: relationship.sourcePageId, target: relationship.targetPageId }).slice(0, 12);
      (clusterGroups[groupKey] ??= []).push(relationship.sourcePageId, relationship.targetPageId);
    }

    if (relationship.relationshipType === "Canonical Variant") {
      canonicalTargets.set(relationship.sourcePageId, [...(canonicalTargets.get(relationship.sourcePageId) ?? []), relationship.targetPageId]);
    }
  }

  for (const link of allLinks) {
    if (!nodeMap.has(link.sourcePageId) || !nodeMap.has(link.targetPageId)) {
      brokenReferences.push(link.internalLinkPlanId);
      continue;
    }
    disconnectedNodeIds.delete(link.sourcePageId);
    disconnectedNodeIds.delete(link.targetPageId);
    unusedPageIds.delete(link.sourcePageId);
    unusedPageIds.delete(link.targetPageId);
  }

  const parentEdges = new Map<string, string[]>();
  for (const [childId, parents] of Object.entries(parentTree)) parentEdges.set(childId, parents);
  const redirectEdges = new Map<string, string[]>();
  for (const relationship of allRelationships.filter((entry) => entry.relationshipType === "Redirect")) {
    redirectEdges.set(relationship.sourcePageId, [...(redirectEdges.get(relationship.sourcePageId) ?? []), relationship.targetPageId]);
  }
  const canonicalEdges = new Map<string, string[]>();
  for (const [sourceId, targets] of canonicalTargets.entries()) canonicalEdges.set(sourceId, targets);

  const circularReferences = [...detectCycles(parentEdges), ...detectCycles(redirectEdges), ...detectCycles(canonicalEdges)];
  const duplicateCanonicalTargets = [...canonicalTargets.entries()].filter(([, targets]) => new Set(targets).size > 1).map(([sourceId]) => sourceId);
  const generatedAt = maxIso([
    ...pages.map((page) => page.updatedAt),
    ...allRelationships.map((relationship) => relationship.createdAt),
    ...allLinks.map((link) => link.updatedAt),
  ]);

  const issues: GmpPageGraphIssue[] = [];
  for (const cycle of circularReferences) {
    issues.push({
      ruleId: "page.graph.circular",
      severity: "ERROR",
      reason: `Circular reference detected across ${cycle.join(" -> ")}.`,
      suggestedResolution: "Break the cycle by removing one edge in the chain.",
      affectedPageIds: cycle,
    });
  }
  for (const pageId of duplicateCanonicalTargets) {
    issues.push({
      ruleId: "page.graph.duplicate-canonical-target",
      severity: "ERROR",
      reason: "A canonical source points to multiple canonical targets.",
      suggestedResolution: "Collapse the variant chain to a single canonical target.",
      affectedPageIds: [pageId],
    });
  }
  for (const pageId of disconnectedNodeIds) {
    issues.push({
      ruleId: "page.graph.disconnected",
      severity: "WARNING",
      reason: "The page is disconnected from the current relationship graph.",
      suggestedResolution: "Assign at least one structural relationship or internal link.",
      affectedPageIds: [pageId],
    });
  }
  for (const pageId of unusedPageIds) {
    issues.push({
      ruleId: "page.graph.unused-page",
      severity: "WARNING",
      reason: "The page does not participate in any relationships or links.",
      suggestedResolution: "Connect the page to a pillar, cluster, or link path.",
      affectedPageIds: [pageId],
    });
  }

  const possible = pages.length === 0 ? 100 : Math.max(0, 100 - issues.filter((issue) => issue.severity === "ERROR").length * 15 - issues.filter((issue) => issue.severity === "WARNING").length * 5);

  return {
    modelVersion: GMP_PAGE_GRAPH_MODEL_VERSION,
    projectId,
    generatedAt,
    pages: pages.map((page) => ({
      pageId: page.pageId,
      siteId: page.siteId,
      parentPageId: page.parentPageId,
      canonicalUrl: page.canonicalUrl,
      name: page.name,
      slug: page.slug,
      pageType: page.pageType,
      lifecycleState: page.lifecycleState,
      publishingState: page.publishingState,
    })),
    relationships: allRelationships,
    internalLinks: allLinks,
    parentTree,
    childTree,
    siblingGroups,
    clusterGroups,
    redirectChains: [...redirectEdges.keys()].map((nodeId) => buildChains(nodeId, redirectEdges)),
    canonicalChains: [...canonicalEdges.keys()].map((nodeId) => buildChains(nodeId, canonicalEdges)),
    relationshipCounts,
    disconnectedNodeIds: [...disconnectedNodeIds],
    circularReferences,
    brokenReferences,
    unusedPageIds: [...unusedPageIds],
    duplicateCanonicalTargets,
    healthScore: possible,
    issues,
  };
}
