import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";
import { listProducts } from "./product-repository";
import { isUnsafePublicAddress } from "./public-network-address";
import { evaluateProductAuthorityCompletion } from "./site-product-authority-completion";
import type { SiteStrategyProposal } from "./site-intelligence";
import type { ProductConfiguration, ProductSiteAssignment, ProductSpecification, ProductVisibilityState } from "./types";

export type SiteSourceKind = "URL" | "UPLOAD" | "OWNER_KNOWLEDGE";
export type SiteSourceRole = "BUSINESS_FACTS" | "PRODUCT_SERVICE_AUTHORITY" | "TECHNICAL_SPECIFICATION" | "CREATIVE_REFERENCE" | "OTHER_REFERENCE";
export type SiteSourceAuthority = "REFERENCE_ONLY" | "OWNER_ATTESTED" | "EVIDENCE_SOURCE";
export type SiteSource = {
  sourceId: string;
  organizationId: string;
  siteId: string;
  kind: SiteSourceKind;
  label: string;
  sourceRole: SiteSourceRole;
  authority: SiteSourceAuthority;
  approvalState: "OWNER_APPROVED" | "REFERENCE_ONLY";
  url: string | null;
  normalizedUrl: string | null;
  firstParty: boolean;
  retrievalState: "NOT_RETRIEVED" | "AVAILABLE";
  retrievedAt: string | null;
  title: string | null;
  extractedRepresentation: string | null;
  contentFingerprint: string | null;
  assetId: string | null;
  originalFileName: string | null;
  sha256: string | null;
  mediaType: string | null;
  ownerStatement: string | null;
  publishable: false;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthorityCandidateType = "PRODUCT" | "SERVICE" | "PRODUCT_FAMILY" | "SERVICE_FAMILY";
export type AuthorityDecision = "PENDING" | "APPROVED" | "QUALIFIED" | "FUTURE" | "REJECTED";
export type SiteProductServiceAuthority = {
  authorityId: string;
  organizationId: string;
  siteId: string;
  strategyRevision: number;
  strategyFamily: string;
  type: AuthorityCandidateType;
  canonicalName: string;
  displayName: string;
  slug: string;
  description: string;
  limitations: string | null;
  decision: AuthorityDecision;
  provenance?: {
    kind: "STRATEGY" | "SOURCE" | "CANONICAL_PRODUCT_REGISTRY";
    referenceId: string;
  };
  canonicalProductId?: string | null;
  canonicalProductSlug?: string | null;
  canonicalSiteAssignment?: {
    siteId: string;
    enabledForSite: boolean;
    visibility: ProductVisibilityState;
    publicationStatus: string;
  } | null;
  canonicalSpecifications?: ProductSpecification[];
  authorityBasis: "NONE" | "OWNER_ATTESTED" | "OWNER_ATTESTED_AND_EVIDENCE";
  ownerAttestation: string | null;
  sourceIds: string[];
  protectedClaimBlockers: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
};

type State = {
  sources: SiteSource[];
  authorities: SiteProductServiceAuthority[];
  audit: Array<{ action: string; actor: string; at: string; reason: string }>;
};

const NAMESPACE = "site-product-authority-repository";
const MAX_SOURCE_PROPOSALS = 12;
const ELIGIBLE_PRODUCT_VISIBILITY = new Set<ProductVisibilityState>(["site_visible", "public_candidate"]);
const ELIGIBLE_CATALOG_STATUS = new Set(["ready", "published"]);

function now() {
  return new Date().toISOString();
}

function load() {
  return loadPersistedState<State>({
    namespace: NAMESPACE,
    seedFactory: () => ({ sources: [], authorities: [], audit: [] }),
  });
}

function persist(state: State, revision: number) {
  savePersistedState({ namespace: NAMESPACE, state, expectedRevision: revision });
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(countertops)\b/g, "countertop")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function display(value: string) {
  return value.replace(/\bAnd\b/g, "&").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function classify(value: string): AuthorityCandidateType {
  return /design[- ]build|fabrication service|installation|consult|service/i.test(value)
    ? "SERVICE_FAMILY"
    : "PRODUCT_FAMILY";
}

function protectedClaims(value: string): string[] {
  const rules: Array<[RegExp, string]> = [
    [/\b(UL|NSF|GMP|ISO|certif|compliance|compliant|licensed|regulatory)\b/i, "Certification or compliance proof required"],
    [/\b(gauge|dimensions?|load rating|material grade|warranty|lead time|pricing|technical performance)\b/i, "Technical specification proof required"],
    [/\b(nationwide|service area|shipping|installation)\b/i, "Service scope proof required"],
  ];
  return rules.filter(([pattern]) => pattern.test(value)).map(([, reason]) => reason);
}

function canonicalAuthorityId(siteId: string, productId: string): string {
  return `site-authority-canonical-${siteId}-${productId}`;
}

function canonicalCandidateSlug(product: ProductConfiguration, assignment: ProductSiteAssignment): string {
  return slug(assignment.siteSpecificSlug || product.slug || product.displayName || product.productName);
}

function canonicalCandidateDisplayName(product: ProductConfiguration, assignment: ProductSiteAssignment): string {
  return assignment.siteSpecificDisplayName?.trim() || product.displayName?.trim() || product.productName.trim();
}

function canonicalProductEligibleForSite(input: { organizationId: string; siteId: string; product: ProductConfiguration }): ProductSiteAssignment | null {
  const { product } = input;
  if (product.organizationId !== input.organizationId) return null;
  if (product.lifecycleState !== "active") return null;
  if (!ELIGIBLE_CATALOG_STATUS.has(product.catalogStatus)) return null;
  if (!product.enabled) return null;
  if (!ELIGIBLE_PRODUCT_VISIBILITY.has(product.visibility)) return null;
  const assignment = product.siteAssignments.find((item) => item.siteId === input.siteId) ?? null;
  if (!assignment) return null;
  if (!assignment.enabledForSite) return null;
  if (assignment.publicationStatus !== "ready") return null;
  if (!ELIGIBLE_PRODUCT_VISIBILITY.has(assignment.visibility)) return null;
  return assignment;
}

function authorityOriginPriority(candidate: SiteProductServiceAuthority): number {
  const kind = candidate.provenance?.kind;
  if (kind === "CANONICAL_PRODUCT_REGISTRY") return 3;
  if (kind === "STRATEGY") return 2;
  if (kind === "SOURCE") return 1;
  if (candidate.authorityId.startsWith("site-authority-source-")) return 1;
  return 2;
}

function canonicalJoinCandidates(input: { organizationId: string; siteId: string; strategy: SiteStrategyProposal }): SiteProductServiceAuthority[] {
  const timestamp = input.strategy.createdAt;
  const candidates: SiteProductServiceAuthority[] = [];
  for (const product of listProducts()) {
    const assignment = canonicalProductEligibleForSite({ organizationId: input.organizationId, siteId: input.siteId, product });
    if (!assignment) continue;
    const displayName = canonicalCandidateDisplayName(product, assignment);
    const productSlug = canonicalCandidateSlug(product, assignment);
    candidates.push({
      authorityId: canonicalAuthorityId(input.siteId, product.productId),
      organizationId: input.organizationId,
      siteId: input.siteId,
      strategyRevision: input.strategy.revision,
      strategyFamily: `Canonical product: ${displayName}`,
      type: "PRODUCT",
      canonicalName: productSlug,
      displayName,
      slug: productSlug,
      description: product.shortDescription?.trim() || product.fullDescription?.trim() || `Canonical product assigned to ${assignment.siteId}.`,
      limitations: null,
      decision: "PENDING",
      provenance: { kind: "CANONICAL_PRODUCT_REGISTRY", referenceId: product.productId },
      canonicalProductId: product.productId,
      canonicalProductSlug: product.slug,
      canonicalSiteAssignment: {
        siteId: assignment.siteId,
        enabledForSite: assignment.enabledForSite,
        visibility: assignment.visibility,
        publicationStatus: assignment.publicationStatus,
      },
      canonicalSpecifications: [...product.specifications],
      authorityBasis: "NONE",
      ownerAttestation: null,
      sourceIds: [],
      protectedClaimBlockers: protectedClaims(`${displayName} ${product.shortDescription ?? ""} ${product.fullDescription ?? ""}`),
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      decidedBy: null,
      decidedAt: null,
    });
  }
  return candidates;
}

function strategyCandidates(input: { organizationId: string; siteId: string; strategy: SiteStrategyProposal }): SiteProductServiceAuthority[] {
  const bySlug = new Map<string, string>();
  for (const family of input.strategy.productServiceFamilies) {
    const key = slug(family);
    if (!bySlug.has(key)) bySlug.set(key, family);
  }

  return [...bySlug.entries()].map(([key, family]) => ({
    authorityId: `site-authority-${input.siteId}-${key}`,
    organizationId: input.organizationId,
    siteId: input.siteId,
    strategyRevision: input.strategy.revision,
    strategyFamily: family,
    type: classify(family),
    canonicalName: key,
    displayName: display(family),
    slug: key,
    description: `Proposed from approved strategy revision ${input.strategy.revision}.`,
    limitations: null,
    decision: "PENDING",
    provenance: { kind: "STRATEGY", referenceId: `strategy-${input.strategy.revision}` },
    canonicalProductId: null,
    canonicalProductSlug: null,
    canonicalSiteAssignment: null,
    canonicalSpecifications: [],
    authorityBasis: "NONE",
    ownerAttestation: null,
    sourceIds: [],
    protectedClaimBlockers: protectedClaims(family),
    revision: 0,
    createdAt: input.strategy.createdAt,
    updatedAt: input.strategy.createdAt,
    decidedBy: null,
    decidedAt: null,
  }));
}

export { evaluateProductAuthorityCompletion };

export function deriveAuthorityCandidates(input: { organizationId: string; siteId: string; strategy: SiteStrategyProposal }): SiteProductServiceAuthority[] {
  const bySlug = new Map<string, SiteProductServiceAuthority>();
  for (const candidate of [...strategyCandidates(input), ...canonicalJoinCandidates(input)]) {
    const existing = bySlug.get(candidate.slug);
    if (!existing || authorityOriginPriority(candidate) > authorityOriginPriority(existing)) bySlug.set(candidate.slug, candidate);
  }
  return [...bySlug.values()];
}

export function getSiteAuthorityWorkspace(input: { organizationId: string; siteId: string; strategy: SiteStrategyProposal }) {
  const loaded = load();
  const sources = loaded.state.sources.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId);
  const persisted = loaded.state.authorities.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId);
  const derived = deriveAuthorityCandidates(input);
  const byId = new Map(persisted.map((item) => [item.authorityId, item]));
  const candidates = derived.map((item) => byId.get(item.authorityId) ?? item);
  const existing = new Set(candidates.map((item) => item.authorityId));

  for (const record of persisted) {
    if (!existing.has(record.authorityId)) candidates.push(record);
  }

  const deduped = new Map<string, SiteProductServiceAuthority>();
  for (const candidate of candidates) {
    const key = candidate.slug || slug(candidate.displayName);
    const current = deduped.get(key);
    if (!current || authorityOriginPriority(candidate) > authorityOriginPriority(current)) deduped.set(key, candidate);
  }
  const visibleCandidates = [...deduped.values()];

  return deepClone({
    sources,
    candidates: visibleCandidates,
    progress: {
      proposed: visibleCandidates.length,
      approved: visibleCandidates.filter((item) => item.decision === "APPROVED" || item.decision === "QUALIFIED").length,
      needReview: visibleCandidates.filter((item) => item.decision === "PENDING").length,
    },
  });
}

export function normalizeSiteSourceUrl(value: string): string {
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || url.hostname === "localhost"
    || url.hostname.endsWith(".localhost")
    || (isIP(url.hostname) !== 0 && isUnsafePublicAddress(url.hostname))
  ) {
    throw new Error("SOURCE_URL_UNSAFE");
  }

  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

export async function assertPublicSiteSourceUrl(
  value: string,
  resolveHost = async (hostname: string) => lookup(hostname, { all: true, verbatim: true }),
) {
  const normalized = normalizeSiteSourceUrl(value);
  const addresses = await resolveHost(new URL(normalized).hostname);
  if (!addresses.length || addresses.some((item) => isUnsafePublicAddress(item.address))) throw new Error("SOURCE_URL_PRIVATE");
  return normalized;
}

function addSource(source: SiteSource, actor: string, reason: string) {
  const loaded = load();
  const duplicate = loaded.state.sources.find((item) =>
    item.organizationId === source.organizationId
    && item.siteId === source.siteId
    && ((source.normalizedUrl && item.normalizedUrl === source.normalizedUrl) || (source.sha256 && item.sha256 === source.sha256)));
  if (duplicate) return deepClone(duplicate);
  loaded.state.sources.push(source);
  loaded.state.audit.push({ action: "SITE_SOURCE_ADDED", actor, at: now(), reason });
  persist(loaded.state, loaded.revision);
  return deepClone(source);
}

export function addUrlSource(input: { organizationId: string; siteId: string; siteDomain: string | null; url: string; sourceRole: SiteSourceRole; label: string; actor: string }) {
  const normalizedUrl = normalizeSiteSourceUrl(input.url);
  const hostname = new URL(normalizedUrl).hostname.replace(/^www\./, "");
  const siteDomain = (input.siteDomain ?? "").replace(/^www\./, "").toLowerCase();
  const timestamp = now();
  return addSource({
    sourceId: `source-${randomUUID()}`,
    organizationId: input.organizationId,
    siteId: input.siteId,
    kind: "URL",
    label: input.label.trim() || hostname,
    sourceRole: input.sourceRole,
    authority: input.sourceRole === "CREATIVE_REFERENCE" ? "REFERENCE_ONLY" : "EVIDENCE_SOURCE",
    approvalState: "OWNER_APPROVED",
    url: input.url,
    normalizedUrl,
    firstParty: Boolean(siteDomain && hostname === siteDomain),
    retrievalState: "NOT_RETRIEVED",
    retrievedAt: null,
    title: null,
    extractedRepresentation: null,
    contentFingerprint: null,
    assetId: null,
    originalFileName: null,
    sha256: null,
    mediaType: null,
    ownerStatement: null,
    publishable: false,
    createdBy: input.actor,
    createdAt: timestamp,
    updatedAt: timestamp,
  }, input.actor, "Owner added a bounded URL source.");
}

export function addOwnerKnowledgeSource(input: { organizationId: string; siteId: string; label: string; statement: string; sourceRole: SiteSourceRole; actor: string }) {
  if (!input.statement.trim()) throw new Error("OWNER_KNOWLEDGE_REQUIRED");
  const blockers = protectedClaims(input.statement);
  if (blockers.length) throw new Error("PROTECTED_CLAIM_EVIDENCE_REQUIRED");
  const timestamp = now();
  return addSource({
    sourceId: `source-${randomUUID()}`,
    organizationId: input.organizationId,
    siteId: input.siteId,
    kind: "OWNER_KNOWLEDGE",
    label: input.label.trim() || "Owner knowledge",
    sourceRole: input.sourceRole,
    authority: "OWNER_ATTESTED",
    approvalState: "OWNER_APPROVED",
    url: null,
    normalizedUrl: null,
    firstParty: true,
    retrievalState: "AVAILABLE",
    retrievedAt: timestamp,
    title: input.label.trim() || null,
    extractedRepresentation: input.statement.trim(),
    contentFingerprint: createHash("sha256").update(input.statement.trim()).digest("hex"),
    assetId: null,
    originalFileName: null,
    sha256: null,
    mediaType: null,
    ownerStatement: input.statement.trim(),
    publishable: false,
    createdBy: input.actor,
    createdAt: timestamp,
    updatedAt: timestamp,
  }, input.actor, "Owner added owner-attested site knowledge.");
}

export function addUploadedSource(input: { organizationId: string; siteId: string; assetId: string; originalFileName: string; sha256: string; mediaType: string; sourceRole: SiteSourceRole; label: string; actor: string }) {
  const timestamp = now();
  return addSource({
    sourceId: `source-${randomUUID()}`,
    organizationId: input.organizationId,
    siteId: input.siteId,
    kind: "UPLOAD",
    label: input.label.trim() || input.originalFileName,
    sourceRole: input.sourceRole,
    authority: input.sourceRole === "CREATIVE_REFERENCE" ? "REFERENCE_ONLY" : "EVIDENCE_SOURCE",
    approvalState: "OWNER_APPROVED",
    url: null,
    normalizedUrl: null,
    firstParty: true,
    retrievalState: "AVAILABLE",
    retrievedAt: timestamp,
    title: input.originalFileName,
    extractedRepresentation: null,
    contentFingerprint: input.sha256,
    assetId: input.assetId,
    originalFileName: input.originalFileName,
    sha256: input.sha256,
    mediaType: input.mediaType,
    ownerStatement: null,
    publishable: false,
    createdBy: input.actor,
    createdAt: timestamp,
    updatedAt: timestamp,
  }, input.actor, "Owner uploaded a reusable site source.");
}

function sanitizeCandidateName(value: string): string | null {
  const cleaned = value
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "")
    .replace(/\b(home\s?page|homepage|page|for|our|official|welcome|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (/^(products?|services?|solutions?|offerings?|catalog|store)$/i.test(cleaned)) return null;
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 1 && words[0].length < 6) return null;
  if (isLikelyAssetFilenameIdentity(cleaned)) return null;
  return display(cleaned.toLowerCase());
}

function isLikelyAssetFilenameIdentity(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (/\.(jpe?g|png|webp|gif|pdf)$/i.test(trimmed)) return true;

  const tokens = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (!tokens.length) return false;

  const extension = new Set(["jpg", "jpeg", "png", "webp", "gif", "pdf"]);
  const filenameCues = new Set(["image", "img", "photo", "picture", "screenshot", "scan", "shared", "upload", "file", "document"]);
  const hasExtensionToken = tokens.some((token) => extension.has(token));
  const hasFilenameCue = tokens.some((token) => filenameCues.has(token));
  if (hasExtensionToken && hasFilenameCue) return true;
  if (hasExtensionToken && tokens.length <= 4) return true;
  return /^\w+[_-]\w+/.test(trimmed) && hasExtensionToken;
}

function sourceValuesForCandidateExtraction(source: SiteSource): string[] {
  const values: string[] = [];
  const pushIfPresent = (value: string | null) => {
    const trimmed = String(value ?? "").trim();
    if (trimmed) values.push(trimmed);
  };

  if (source.kind === "OWNER_KNOWLEDGE") {
    pushIfPresent(source.ownerStatement);
    pushIfPresent(source.extractedRepresentation);
    pushIfPresent(source.label);
    return values;
  }

  if (source.kind === "UPLOAD") {
    pushIfPresent(source.ownerStatement);
    pushIfPresent(source.extractedRepresentation);
    if (!isLikelyAssetFilenameIdentity(source.label)) {
      pushIfPresent(source.label);
    }
    return values;
  }

  const urlName = source.normalizedUrl
    ? decodeURIComponent(new URL(source.normalizedUrl).pathname.split("/").filter(Boolean).at(-1) ?? "")
    : "";
  pushIfPresent(source.label);
  pushIfPresent(source.title);
  pushIfPresent(source.extractedRepresentation);
  pushIfPresent(source.ownerStatement);
  pushIfPresent(urlName);
  return values;
}

function sourceTextCandidates(source: SiteSource): string[] {
  const values = sourceValuesForCandidateExtraction(source);

  const names = new Set<string>();
  for (const value of values) {
    const fragments = value
      .split(/[\n,;|]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);
    for (const fragment of fragments) {
      if (isLikelyAssetFilenameIdentity(fragment)) continue;
      const normalized = sanitizeCandidateName(fragment);
      if (normalized) names.add(normalized);
    }
  }

  return [...names].slice(0, 3);
}

function eligibleSourceForProposal(source: SiteSource): boolean {
  return source.sourceRole === "PRODUCT_SERVICE_AUTHORITY"
    && source.approvalState === "OWNER_APPROVED"
    && source.authority !== "REFERENCE_ONLY";
}

export function proposeAuthorityCandidatesFromSources(input: {
  organizationId: string;
  siteId: string;
  strategy: SiteStrategyProposal;
  actor: string;
  sourceIds?: string[];
}) {
  const loaded = load();
  const sourceFilter = input.sourceIds ? new Set(input.sourceIds) : null;
  const scopedSources = loaded.state.sources.filter((source) =>
    source.organizationId === input.organizationId
    && source.siteId === input.siteId
    && eligibleSourceForProposal(source)
    && (!sourceFilter || sourceFilter.has(source.sourceId)));

  if (!scopedSources.length) throw new Error("SOURCE_CANDIDATE_PROPOSAL_INSUFFICIENT_EVIDENCE");

  const workspace = getSiteAuthorityWorkspace({
    organizationId: input.organizationId,
    siteId: input.siteId,
    strategy: input.strategy,
  });

  const existingSlugs = new Set(workspace.candidates.map((candidate) => candidate.slug));
  const proposals = new Map<string, { displayName: string; type: AuthorityCandidateType; description: string; sourceIds: Set<string>; blockers: string[] }>();

  for (const source of scopedSources.slice(0, 25)) {
    for (const name of sourceTextCandidates(source)) {
      const key = slug(name);
      if (!key || existingSlugs.has(key)) continue;
      const current = proposals.get(key);
      const description = `Proposed from owner-authorized source: ${source.label}.`;
      const blockers = protectedClaims(`${name} ${description}`);
      if (current) {
        current.sourceIds.add(source.sourceId);
        continue;
      }
      proposals.set(key, {
        displayName: name,
        type: classify(name),
        description,
        sourceIds: new Set([source.sourceId]),
        blockers,
      });
    }
  }

  if (!proposals.size) throw new Error("SOURCE_CANDIDATE_PROPOSAL_INSUFFICIENT_EVIDENCE");

  const timestamp = now();
  const persisted: SiteProductServiceAuthority[] = [];
  for (const [candidateSlug, candidate] of [...proposals.entries()].slice(0, MAX_SOURCE_PROPOSALS)) {
    const authorityId = `site-authority-source-${input.siteId}-${candidateSlug}`;
    const existing = loaded.state.authorities.find((item) =>
      item.organizationId === input.organizationId
      && item.siteId === input.siteId
      && item.authorityId === authorityId);
    if (existing) continue;

    const record: SiteProductServiceAuthority = {
      authorityId,
      organizationId: input.organizationId,
      siteId: input.siteId,
      strategyRevision: input.strategy.revision,
      strategyFamily: `Source-derived: ${candidate.displayName}`,
      type: candidate.type,
      canonicalName: candidateSlug,
      displayName: candidate.displayName,
      slug: candidateSlug,
      description: candidate.description,
      limitations: null,
      decision: "PENDING",
      provenance: { kind: "SOURCE", referenceId: [...candidate.sourceIds][0] ?? authorityId },
      canonicalProductId: null,
      canonicalProductSlug: null,
      canonicalSiteAssignment: null,
      canonicalSpecifications: [],
      authorityBasis: "NONE",
      ownerAttestation: null,
      sourceIds: [...candidate.sourceIds],
      protectedClaimBlockers: candidate.blockers,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      decidedBy: null,
      decidedAt: null,
    };
    loaded.state.authorities.push(record);
    persisted.push(record);
  }

  if (!persisted.length) throw new Error("SOURCE_CANDIDATE_PROPOSAL_INSUFFICIENT_EVIDENCE");

  loaded.state.audit.push({
    action: "SITE_SOURCE_CANDIDATES_PROPOSED",
    actor: input.actor,
    at: timestamp,
    reason: `Proposed ${persisted.length} pending candidate(s) from scoped authority sources.`,
  });
  persist(loaded.state, loaded.revision);
  return deepClone(persisted);
}

export function decideAuthorityCandidate(input: {
  organizationId: string;
  siteId: string;
  strategy: SiteStrategyProposal;
  authorityId: string;
  type: AuthorityCandidateType;
  displayName: string;
  description: string;
  limitations: string;
  decision: AuthorityDecision;
  ownerAttestation: string;
  sourceIds: string[];
  actor: string;
}) {
  const loaded = load();
  const derived = deriveAuthorityCandidates({ organizationId: input.organizationId, siteId: input.siteId, strategy: input.strategy });
  const persisted = loaded.state.authorities.find((item) =>
    item.organizationId === input.organizationId
    && item.siteId === input.siteId
    && item.authorityId === input.authorityId);
  const proposed = derived.find((item) => item.authorityId === input.authorityId) ?? persisted;
  if (!proposed) throw new Error("AUTHORITY_CANDIDATE_NOT_FOUND");

  const sources = input.sourceIds.map((sourceId) => loaded.state.sources.find((item) => item.sourceId === sourceId));
  if (sources.some((source) => !source || source.organizationId !== input.organizationId)) throw new Error("SOURCE_ORGANIZATION_MISMATCH");
  if (sources.some((source) => source?.siteId !== input.siteId)) throw new Error("SOURCE_SITE_MISMATCH");
  if ((input.decision === "APPROVED" || input.decision === "QUALIFIED") && !input.ownerAttestation.trim()) throw new Error("OWNER_ATTESTATION_REQUIRED");
  if (input.decision === "QUALIFIED" && !input.limitations.trim()) throw new Error("LIMITATIONS_REQUIRED");

  const factualSources = sources.filter((source) => source && source.authority !== "REFERENCE_ONLY") as SiteSource[];
  const technicalSources = factualSources.filter((source) => source.sourceRole === "TECHNICAL_SPECIFICATION");
  const blockers = protectedClaims(`${input.displayName} ${input.description} ${input.limitations}`);
  if ((input.decision === "APPROVED" || input.decision === "QUALIFIED") && blockers.length && technicalSources.length === 0) {
    throw new Error("PROTECTED_CLAIM_EVIDENCE_REQUIRED");
  }

  const timestamp = now();
  const previous = loaded.state.authorities.find((item) => item.authorityId === input.authorityId);
  const record: SiteProductServiceAuthority = {
    ...proposed,
    ...previous,
    type: input.type,
    displayName: input.displayName.trim(),
    slug: slug(input.displayName),
    description: input.description.trim(),
    limitations: input.limitations.trim() || null,
    decision: input.decision,
    authorityBasis: input.decision === "APPROVED" || input.decision === "QUALIFIED"
      ? factualSources.length
        ? "OWNER_ATTESTED_AND_EVIDENCE"
        : "OWNER_ATTESTED"
      : "NONE",
    ownerAttestation: input.ownerAttestation.trim() || null,
    sourceIds: [...new Set(input.sourceIds)],
    protectedClaimBlockers: blockers,
    revision: (previous?.revision ?? 0) + 1,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
    decidedBy: input.actor,
    decidedAt: timestamp,
  };

  loaded.state.authorities = [...loaded.state.authorities.filter((item) => item.authorityId !== record.authorityId), record];
  loaded.state.audit.push({ action: `SITE_AUTHORITY_${input.decision}`, actor: input.actor, at: timestamp, reason: `Owner decided ${record.displayName}.` });
  persist(loaded.state, loaded.revision);
  return deepClone(record);
}

export function listGenerationAuthority(input: { organizationId: string; siteId: string }) {
  const loaded = load();
  return deepClone(
    loaded.state.authorities
      .filter((item) =>
        item.organizationId === input.organizationId
        && item.siteId === input.siteId
        && (item.decision === "APPROVED" || item.decision === "QUALIFIED")
        && (item.protectedClaimBlockers.length === 0 || item.authorityBasis === "OWNER_ATTESTED_AND_EVIDENCE"))
      .map((item) => ({
        authorityId: item.authorityId,
        type: item.type,
        displayName: item.displayName,
        description: item.description,
        limitations: item.limitations,
        authorityBasis: item.authorityBasis,
        sourceIds: item.sourceIds,
      })),
  );
}
