import { createHash } from "node:crypto";
import { parseDocument } from "htmlparser2";

export const WORDPRESS_POST_CONTENT_PUBLICATION_AUTHORITY = "POST_CONTENT_BLOCK_HTML" as const;

type HtmlNode = {
  type: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: HtmlNode[];
  parent?: HtmlNode;
  data?: string;
};

export type WordPressStructuralPredicateMatrix = {
  globalHeaderCount: boolean;
  globalFooterCount: boolean;
  bodyNavigationCountZero: boolean;
  duplicateBodyHeaderFalse: boolean;
  h1CountValid: boolean;
  pageIdentityValid: boolean;
};

export type WordPressStructuralEvidence = {
  globalHeaderCount: number;
  globalFooterCount: number;
  bodyNavigationCount: number;
  bodyHeaderCount: number;
  bodyFooterArtifactCount: number;
  h1Count: number;
  pageIdentityCount: number;
  globalHeaderHtmlHash: string | null;
  globalFooterHtmlHash: string | null;
  postContentHtmlHash: string | null;
  predicates: WordPressStructuralPredicateMatrix;
  failedPredicates: string[];
  pass: boolean;
};

export type RenderedRect = { top: number; bottom: number; left: number; right: number; width: number; height: number };
export type RenderedRegionEvidence = {
  regionId: string;
  role: "HERO" | "SECTION" | "SPACER";
  rect: RenderedRect;
  visible: boolean;
  textRects: RenderedRect[];
  mediaRects: RenderedRect[];
  ctaRects: RenderedRect[];
};
export type RenderedLayoutEvidence = { viewport: { width: number; height: number }; regions: RenderedRegionEvidence[] };
export type RenderedWhitespaceEvidence = {
  pass: boolean;
  maxMeaningfulGap: number;
  emptyRegionIds: string[];
  regionOccupancy: Array<{ regionId: string; occupiedRatio: number; meaningfulElementCount: number }>;
};

export type PublicCacheClassification = "FRESH_EXPECTED" | "STALE_PRIOR" | "CONVERGED_EXPECTED" | "INDETERMINATE";
export type PublicVerificationPredicateMatrix = WordPressStructuralPredicateMatrix & {
  http200: boolean;
  storedContentHashValid: boolean;
  semanticIdentityValid: boolean;
  renderedGeometryValid: boolean | null;
};
export type PublicVerificationRead = {
  timestamp: string;
  url: string;
  httpStatus: number;
  responseHeaders: Record<string, string | null>;
  responseBodyHash: string;
  responseBodyHtml: string;
  expectedStoredContentHash: string;
  actualStoredContentHash: string;
  semanticIdentity: string;
  predicateMatrix: PublicVerificationPredicateMatrix;
  failedPredicates: string[];
  cacheClassification: PublicCacheClassification;
  visualCertificationReference: string | null;
};

export type PublicReadConvergenceResult = {
  converged: boolean;
  classification: PublicCacheClassification;
  attempts: PublicVerificationRead[];
  consecutiveExpectedReads: number;
  timeoutMs: number;
};

export type RetainOrRollbackResult = {
  retained: boolean;
  rolledBack: boolean;
  rollbackVerified: boolean;
  failedGate: string | null;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function attribute(node: HtmlNode, name: string): string {
  return node.attribs?.[name] ?? "";
}

function hasClass(node: HtmlNode, className: string): boolean {
  return attribute(node, "class").split(/\s+/u).includes(className);
}

function descendants(node: HtmlNode): HtmlNode[] {
  const result: HtmlNode[] = [];
  for (const child of node.children ?? []) {
    result.push(child, ...descendants(child));
  }
  return result;
}

function nodeText(node: HtmlNode): string {
  if (node.type === "text") return node.data ?? "";
  return (node.children ?? []).map(nodeText).join("");
}

function serializeStable(node: HtmlNode): string {
  if (node.type === "text") return node.data ?? "";
  const tag = node.name;
  if (!tag) return (node.children ?? []).map(serializeStable).join("");
  const attrs = Object.entries(node.attribs ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([name, value]) => ` ${name}="${value}"`).join("");
  return `<${tag}${attrs}>${(node.children ?? []).map(serializeStable).join("")}</${tag}>`;
}

function inside(node: HtmlNode, ancestor: HtmlNode): boolean {
  let current = node.parent;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

export function verifyWordPressTemplateStructure(input: { html: string; expectedH1Count: number; expectedIdentityClass: string }): WordPressStructuralEvidence {
  const document = parseDocument(input.html) as unknown as HtmlNode;
  const nodes = descendants(document);
  const main = nodes.find((node) => node.name === "main") ?? null;
  const globalHeaders = nodes.filter((node) => node.name === "header" && hasClass(node, "wp-block-template-part") && (!main || !inside(node, main)));
  const globalFooters = nodes.filter((node) => node.name === "footer" && hasClass(node, "wp-block-template-part") && (!main || !inside(node, main)));
  const bodyNodes = main ? [main, ...descendants(main)] : [];
  const bodyNavigationCount = bodyNodes.filter((node) => node.name === "nav").length;
  const bodyHeaderCount = bodyNodes.filter((node) => node.name === "header").length;
  const bodyFooterArtifactCount = bodyNodes.filter((node) => node.name === "footer").length;
  const h1Count = nodes.filter((node) => node.name === "h1" && nodeText(node).trim().length > 0).length;
  const pageIdentityCount = bodyNodes.filter((node) => hasClass(node, input.expectedIdentityClass)).length;
  const predicates: WordPressStructuralPredicateMatrix = {
    globalHeaderCount: globalHeaders.length === 1,
    globalFooterCount: globalFooters.length === 1,
    bodyNavigationCountZero: bodyNavigationCount === 0,
    duplicateBodyHeaderFalse: bodyHeaderCount === 0,
    h1CountValid: h1Count === input.expectedH1Count,
    pageIdentityValid: pageIdentityCount === 1,
  };
  const failedPredicates = Object.entries(predicates).filter(([, pass]) => !pass).map(([name]) => name);
  return {
    globalHeaderCount: globalHeaders.length,
    globalFooterCount: globalFooters.length,
    bodyNavigationCount,
    bodyHeaderCount,
    bodyFooterArtifactCount,
    h1Count,
    pageIdentityCount,
    globalHeaderHtmlHash: globalHeaders[0] ? sha256(serializeStable(globalHeaders[0])) : null,
    globalFooterHtmlHash: globalFooters[0] ? sha256(serializeStable(globalFooters[0])) : null,
    postContentHtmlHash: main ? sha256(serializeStable(main)) : null,
    predicates,
    failedPredicates,
    pass: failedPredicates.length === 0,
  };
}

function intersectionArea(left: RenderedRect, right: RenderedRect): number {
  const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
  const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  return width * height;
}

export function verifyRenderedWhitespace(evidence: RenderedLayoutEvidence): RenderedWhitespaceEvidence {
  const regionOccupancy = evidence.regions.map((region) => {
    const meaningful = [...region.textRects, ...region.mediaRects, ...region.ctaRects].filter((rect) => rect.width > 0 && rect.height > 0);
    const regionArea = Math.max(1, region.rect.width * region.rect.height);
    const occupiedArea = Math.min(regionArea, meaningful.reduce((total, rect) => total + intersectionArea(region.rect, rect), 0));
    return { regionId: region.regionId, occupiedRatio: occupiedArea / regionArea, meaningfulElementCount: meaningful.length };
  });
  const emptyRegionIds = evidence.regions.filter((region, index) => {
    const occupancy = regionOccupancy[index];
    return region.visible && region.rect.height >= evidence.viewport.height * 0.5 && occupancy.meaningfulElementCount === 0 && occupancy.occupiedRatio === 0;
  }).map((region) => region.regionId);
  const meaningfulRects = evidence.regions.flatMap((region) => [...region.textRects, ...region.mediaRects, ...region.ctaRects]).filter((rect) => rect.width > 0 && rect.height > 0).sort((left, right) => left.top - right.top);
  let maxMeaningfulGap = 0;
  for (let index = 1; index < meaningfulRects.length; index += 1) maxMeaningfulGap = Math.max(maxMeaningfulGap, Math.max(0, meaningfulRects[index].top - meaningfulRects[index - 1].bottom));
  return { pass: emptyRegionIds.length === 0, maxMeaningfulGap, emptyRegionIds, regionOccupancy };
}

export function classifyPublicVerificationRead(input: { httpStatus: number; responseBodyHash: string; priorPublicBodyHash: string; predicatesPass: boolean }): PublicCacheClassification {
  if (input.httpStatus !== 200) return "INDETERMINATE";
  if (input.responseBodyHash === input.priorPublicBodyHash) return "STALE_PRIOR";
  return input.predicatesPass ? "FRESH_EXPECTED" : "INDETERMINATE";
}

export async function convergePublicVerification(input: {
  read: (attempt: number) => Promise<PublicVerificationRead>;
  persistAttempt: (attempt: PublicVerificationRead) => Promise<void> | void;
  wait?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
  requiredConsecutiveReads?: number;
  timeoutMs?: number;
  attemptSpacingMs?: number;
}): Promise<PublicReadConvergenceResult> {
  const maxAttempts = input.maxAttempts ?? 5;
  const requiredConsecutiveReads = input.requiredConsecutiveReads ?? 2;
  const timeoutMs = input.timeoutMs ?? 10_000;
  const attemptSpacingMs = input.attemptSpacingMs ?? 250;
  const wait = input.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const startedAt = Date.now();
  const attempts: PublicVerificationRead[] = [];
  let consecutiveExpectedReads = 0;
  let expectedHash: string | null = null;
  for (let attemptNumber = 1; attemptNumber <= maxAttempts && Date.now() - startedAt < timeoutMs; attemptNumber += 1) {
    const attempt = await input.read(attemptNumber);
    attempts.push(attempt);
    await input.persistAttempt(attempt);
    const predicatesPass = attempt.failedPredicates.length === 0 && Object.values(attempt.predicateMatrix).every((value) => value !== false);
    if (attempt.cacheClassification === "FRESH_EXPECTED" && predicatesPass) {
      if (expectedHash === attempt.responseBodyHash) consecutiveExpectedReads += 1;
      else { expectedHash = attempt.responseBodyHash; consecutiveExpectedReads = 1; }
      if (consecutiveExpectedReads >= requiredConsecutiveReads) return { converged: true, classification: "CONVERGED_EXPECTED", attempts, consecutiveExpectedReads, timeoutMs };
    } else {
      expectedHash = null;
      consecutiveExpectedReads = 0;
    }
    if (attemptNumber < maxAttempts && Date.now() - startedAt < timeoutMs) await wait(attemptSpacingMs);
  }
  return { converged: false, classification: attempts.at(-1)?.cacheClassification ?? "INDETERMINATE", attempts, consecutiveExpectedReads, timeoutMs };
}

export async function executeRetainOrRollbackTransaction(input: {
  captureRollbackAuthority: () => Promise<{ contentHash: string }>;
  verifyApprovedAutosave: () => Promise<boolean>;
  verifyPromotionPayload: () => Promise<boolean>;
  promoteExactContent: () => Promise<void>;
  verifyStoredContent: () => Promise<boolean>;
  verifyPublicConvergence: () => Promise<PublicReadConvergenceResult>;
  verifyResponsiveVisuals: () => Promise<boolean>;
  persistFailureEvidence: (input: { failedGate: string; convergence: PublicReadConvergenceResult | null }) => Promise<void>;
  rollbackExactAuthority: () => Promise<void>;
  verifyRollbackIdentity: (expectedContentHash: string) => Promise<boolean>;
}): Promise<RetainOrRollbackResult> {
  const rollback = await input.captureRollbackAuthority();
  let failedGate: string | null = null;
  let convergence: PublicReadConvergenceResult | null = null;
  try {
    if (!await input.verifyApprovedAutosave()) throw new Error("APPROVED_AUTOSAVE_IDENTITY_FAILED");
    if (!await input.verifyPromotionPayload()) throw new Error("PROMOTION_PAYLOAD_IDENTITY_FAILED");
    await input.promoteExactContent();
    if (!await input.verifyStoredContent()) throw new Error("STORED_POST_CONTENT_IDENTITY_FAILED");
    convergence = await input.verifyPublicConvergence();
    if (!convergence.converged) throw new Error("PUBLIC_READ_CONVERGENCE_FAILED");
    if (!await input.verifyResponsiveVisuals()) throw new Error("PUBLIC_RESPONSIVE_VISUAL_CERTIFICATION_FAILED");
    return { retained: true, rolledBack: false, rollbackVerified: false, failedGate: null };
  } catch (cause) {
    failedGate = cause instanceof Error ? cause.message : "UNKNOWN_PUBLICATION_GATE_FAILURE";
    await input.persistFailureEvidence({ failedGate, convergence });
    await input.rollbackExactAuthority();
    const rollbackVerified = await input.verifyRollbackIdentity(rollback.contentHash);
    return { retained: false, rolledBack: true, rollbackVerified, failedGate };
  }
}