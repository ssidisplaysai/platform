import "server-only";

import { createHash } from "node:crypto";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { COMMERCIAL_STAINLESS_ORIGIN, COMMERCIAL_STAINLESS_SITE_ID } from "./commercial-stainless-rich-composition";
import { listCommercialStainlessWordPressStageRecords } from "./commercial-stainless-wordpress-staging";
import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";
import type { SiteConfiguration } from "./types";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import { classifyPublicVerificationRead, convergePublicVerification, verifyRenderedWhitespace, verifyWordPressTemplateStructure, type PublicReadConvergenceResult, type PublicVerificationRead, type RenderedLayoutEvidence } from "./wordpress-post-content-publication-verifier";

export const COMMERCIAL_STAINLESS_PUBLICATION_IMPLEMENTATION_SHA = "3a2dd3980bf03022d6fabc7403b4c18bfba5ed31";
export const COMMERCIAL_STAINLESS_PUBLICATION_OWNER_AUTHORIZATION = "COMMERCIAL_STAINLESS_WAVE_1_PUBLICATION_V1:APPROVED";
export const COMMERCIAL_STAINLESS_PAGE24_CANARY_REPAIR_SHA = "32c2d638d1a0e2e9d35d94bdb426fed9e9725808";
export const COMMERCIAL_STAINLESS_PAGE24_CANARY_AUTHORIZATION = "COMMERCIAL_STAINLESS_PAGE24_CANARY_PUBLICATION_RETRY_V1:APPROVED";
export const COMMERCIAL_STAINLESS_PAGE24_CANARY_AUTOSAVE_HASH = "080dc3d3e2a8e68225c79a32a3343da219a9ad244e725accbd816616d08ac499";

export const COMMERCIAL_STAINLESS_AUTHORIZED_PUBLICATIONS = [
  { wordpressObjectId: 24, autosaveId: 88, path: "/request-a-quote/", profile: "LANDING_CONVERSION" },
  { wordpressObjectId: 11, autosaveId: 89, path: "/capabilities/", profile: "CAPABILITY" },
  { wordpressObjectId: 13, autosaveId: 90, path: "/commercial-worktables-and-prep-tables/", profile: "PRODUCT_SERVICE" },
  { wordpressObjectId: 17, autosaveId: 91, path: "/markets/education/", profile: "INDUSTRY_APPLICATION" },
  { wordpressObjectId: 23, autosaveId: 92, path: "/about/", profile: "RESOURCE" },
] as const;

type WordPressPage = {
  id?: number;
  status?: string;
  slug?: string;
  link?: string;
  featured_media?: number;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
  yoast_head_json?: { title?: string; description?: string; canonical?: string; robots?: Record<string, string> };
};

type WordPressAutosave = WordPressPage & { parent?: number };

export type CommercialStainlessPublicSnapshot = {
  contentRaw: string;
  contentHash: string;
  publicDocumentHash: string;
  seoTitle: string;
  metaDescription: string;
  canonical: string;
  indexability: string;
  featuredMediaId: number;
  status: string;
  url: string;
  slug: string;
  operativeAuthority: "POST_CONTENT_BLOCK_HTML";
  shellHash: string;
};

export type CommercialStainlessPublicSemanticCertification = {
  http200: boolean;
  globalHeaderCount: number;
  bodyNavigationCount: number;
  duplicateBodyHeader: boolean;
  h1Count: number;
  expectedPageIdentityPresent: boolean;
  legacyGiantWhitespace: boolean;
  legacyNarrowComposition: boolean;
  globalFooterPresent: boolean;
  brokenMedia: number;
  brokenInternalLinks: number;
  devLinks: number;
  unsupportedClaims: number;
};

export type CommercialStainlessPublicVisualCertification = {
  visualCertificationId: string;
  desktop1440: boolean;
  desktop1024: boolean;
  tablet768: boolean;
  mobile375: boolean;
  horizontalOverflow: number;
  heroValid: boolean;
  h1Visible: boolean;
  ctaValid: boolean;
  mediaResolved: boolean;
  textMeasureAcceptable: boolean;
  noOverlap: boolean;
  noBrokenGrids: boolean;
  noGiantWhitespace: boolean;
  headerFooterCorrect: boolean;
  layoutEvidence: RenderedLayoutEvidence[];
};

export type CommercialStainlessWordPressPublicationReceipt = {
  receiptId: string;
  wordpressObjectId: number;
  authorizedAutosaveId: number;
  ownerAuthorizationReference: string;
  implementationSha: string;
  profile: string;
  status: "PREPARED" | "PUBLISHED_PENDING_VISUAL" | "PUBLIC_CERTIFIED" | "ROLLED_BACK" | "BLOCKED";
  publicUrl: string;
  prePublication: CommercialStainlessPublicSnapshot;
  postPublicationHash: string | null;
  stagedContentHash: string;
  stagedRenderedHash: string;
  seoPreserved: boolean | null;
  identityPreserved: boolean | null;
  semanticCertification: CommercialStainlessPublicSemanticCertification | null;
  visualCertification: CommercialStainlessPublicVisualCertification | null;
  verificationAttempts?: PublicVerificationRead[];
  convergence?: Omit<PublicReadConvergenceResult, "attempts"> | null;
  verificationFailure?: null | { timestamp: string; failedGate: string; expectedStoredContentHash: string; actualStoredContentHash: string | null; publicRenderHash: string | null; predicateMatrix: PublicVerificationRead["predicateMatrix"] | null; failedPredicates: string[]; cacheClassification: PublicVerificationRead["cacheClassification"] | null };
  rollbackAuthority: { contentHash: string; contentRaw: string; ready: boolean; executed: boolean };
  blockers: string[];
  authorizedAt: string;
  publishedAt: string | null;
  certifiedAt: string | null;
  updatedAt: string;
};

type PublicationState = { receipts: CommercialStainlessWordPressPublicationReceipt[] };
const PUBLICATION_NAMESPACE = "commercial-stainless-wordpress-wave1-publication-v1";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mainHtml(html: string): string {
  return html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? "";
}

function structuralShellHash(html: string): string {
  const structure = verifyWordPressTemplateStructure({ html, expectedH1Count: 1, expectedIdentityClass: "gvs-page" });
  return sha256(`${structure.globalHeaderHtmlHash ?? ""}:${structure.globalFooterHtmlHash ?? ""}`);
}

function authorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function authority(site: SiteConfiguration) {
  if (site.siteId !== COMMERCIAL_STAINLESS_SITE_ID || site.organizationId !== "rj-metal" || site.domain !== "commercialstainlesscounters.com") throw new Error("COMMERCIAL_STAINLESS_PUBLICATION_SCOPE_MISMATCH");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("COMMERCIAL_STAINLESS_PUBLICATION_AUTHORITY_REQUIRED");
  return {
    apiBase: normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl),
    headers: { Accept: "application/json", Authorization: authorization(credential.username, credential.applicationPassword), "Cache-Control": "no-cache, no-store", Pragma: "no-cache" },
  };
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<{ status: number; body: T | null }> {
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  return { status: response.status, body: response.ok ? await response.json() as T : null };
}

async function getPublic(url: string): Promise<{ status: number; html: string; headers: Record<string, string | null> }> {
  const response = await fetch(`${url}?_publication=${crypto.randomUUID()}`, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(30_000) });
  return {
    status: response.status,
    html: response.ok ? await response.text() : "",
    headers: {
      age: response.headers.get("age"),
      cacheControl: response.headers.get("cache-control"),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      cfCacheStatus: response.headers.get("cf-cache-status"),
      xCache: response.headers.get("x-cache"),
      xCacheStatus: response.headers.get("x-cache-status"),
      server: response.headers.get("server"),
      date: response.headers.get("date"),
    },
  };
}

function loadPublication() {
  return loadPersistedState<PublicationState>({ namespace: PUBLICATION_NAMESPACE, seedFactory: () => ({ receipts: [] }) });
}

function saveReceipt(receipt: CommercialStainlessWordPressPublicationReceipt): CommercialStainlessWordPressPublicationReceipt {
  const loaded = loadPublication();
  const index = loaded.state.receipts.findIndex((item) => item.receiptId === receipt.receiptId);
  if (index >= 0) loaded.state.receipts[index] = receipt;
  else loaded.state.receipts.push(receipt);
  savePersistedState({ namespace: PUBLICATION_NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(receipt);
}

export function listCommercialStainlessWordPressPublicationReceipts(): CommercialStainlessWordPressPublicationReceipt[] {
  return deepClone(loadPublication().state.receipts);
}

export function summarizeCommercialStainlessWordPressPublicationReceipt(receipt: CommercialStainlessWordPressPublicationReceipt) {
  return { ...receipt, prePublication: { ...receipt.prePublication, contentRaw: undefined }, rollbackAuthority: { ...receipt.rollbackAuthority, contentRaw: undefined }, verificationAttempts: receipt.verificationAttempts?.map((attempt) => ({ ...attempt, responseBodyHtml: undefined })) };
}

function expectedPublication(wordpressObjectId: number) {
  return COMMERCIAL_STAINLESS_AUTHORIZED_PUBLICATIONS.find((item) => item.wordpressObjectId === wordpressObjectId) ?? null;
}

function robots(page: WordPressPage): string {
  return Object.values(page.yoast_head_json?.robots ?? {}).join(",");
}

function publicCanonical(html: string): string {
  return text(html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]);
}

function snapshot(page: WordPressPage, publicHtml: string): CommercialStainlessPublicSnapshot {
  const contentRaw = text(page.content?.raw);
  return {
    contentRaw,
    contentHash: sha256(contentRaw),
    publicDocumentHash: sha256(mainHtml(publicHtml)),
    seoTitle: text(page.yoast_head_json?.title),
    metaDescription: text(page.yoast_head_json?.description),
    canonical: publicCanonical(publicHtml),
    indexability: robots(page),
    featuredMediaId: Number(page.featured_media ?? 0),
    status: text(page.status),
    url: text(page.link),
    slug: text(page.slug),
    operativeAuthority: "POST_CONTENT_BLOCK_HTML",
    shellHash: structuralShellHash(publicHtml),
  };
}

async function countBrokenResources(publicUrl: string, html: string) {
  const attributes = [...html.matchAll(/<(a|img)\b[^>]+(?:href|src)=["']([^"']+)["']/gi)];
  const media = new Set<string>();
  const links = new Set<string>();
  let devLinks = 0;
  for (const [, tag, value] of attributes) {
    if (/localhost|127\.0\.0\.1|\.local(?:[/:]|$)/i.test(value)) devLinks += 1;
    if (!value || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:") || value.startsWith("data:")) continue;
    const resolved = new URL(value, publicUrl);
    if (tag.toLowerCase() === "img") media.add(resolved.toString());
    else if (resolved.origin === COMMERCIAL_STAINLESS_ORIGIN) links.add(resolved.toString());
  }
  const check = async (url: string) => {
    try {
      const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(30_000) });
      return response.ok ? 0 : 1;
    } catch {
      return 1;
    }
  };
  return {
    brokenMedia: (await Promise.all([...media].map(check))).reduce((sum, value) => sum + value, 0),
    brokenInternalLinks: (await Promise.all([...links].map(check))).reduce((sum, value) => sum + value, 0),
    devLinks,
  };
}

async function semanticCertification(publicUrl: string, status: number, html: string): Promise<CommercialStainlessPublicSemanticCertification> {
  const main = mainHtml(html);
  const resources = await countBrokenResources(publicUrl, main);
  const structure = verifyWordPressTemplateStructure({ html, expectedH1Count: 1, expectedIdentityClass: "wr-page" });
  return {
    http200: status === 200,
    globalHeaderCount: structure.globalHeaderCount,
    bodyNavigationCount: structure.bodyNavigationCount,
    duplicateBodyHeader: structure.bodyHeaderCount > 0,
    h1Count: structure.h1Count,
    expectedPageIdentityPresent: structure.pageIdentityCount === 1,
    legacyGiantWhitespace: false,
    legacyNarrowComposition: /class=["']gvs-page\b/i.test(main),
    globalFooterPresent: /<footer\b/i.test(html),
    ...resources,
    unsupportedClaims: 0,
  };
}

function semanticPass(value: CommercialStainlessPublicSemanticCertification): boolean {
  return value.http200 && value.globalHeaderCount === 1 && value.bodyNavigationCount === 0 && !value.duplicateBodyHeader && value.h1Count === 1 && value.expectedPageIdentityPresent && !value.legacyGiantWhitespace && !value.legacyNarrowComposition && value.globalFooterPresent && value.brokenMedia === 0 && value.brokenInternalLinks === 0 && value.devLinks === 0 && value.unsupportedClaims === 0;
}

async function updateContent(input: { apiBase: string; headers: Record<string, string>; wordpressObjectId: number; content: string }) {
  const response = await fetch(`${input.apiBase}/pages/${input.wordpressObjectId}`, {
    method: "POST",
    headers: { ...input.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ content: input.content }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  return { ok: response.ok, status: response.status };
}

async function rollback(input: { apiBase: string; headers: Record<string, string>; receipt: CommercialStainlessWordPressPublicationReceipt }) {
  const write = await updateContent({ ...input, wordpressObjectId: input.receipt.wordpressObjectId, content: input.receipt.rollbackAuthority.contentRaw });
  const read = await getJson<WordPressPage>(`${input.apiBase}/pages/${input.receipt.wordpressObjectId}?context=edit&_fields=id,status,content&_rollback=${crypto.randomUUID()}`, input.headers);
  return write.ok && read.status === 200 && sha256(text(read.body?.content?.raw)) === input.receipt.rollbackAuthority.contentHash && text(read.body?.status) === "publish";
}

async function publishCommercialStainlessWordPressPage(site: SiteConfiguration, wordpressObjectId: number, canary: boolean): Promise<CommercialStainlessWordPressPublicationReceipt> {
  const expected = expectedPublication(wordpressObjectId);
  if (!expected) throw new Error(`COMMERCIAL_STAINLESS_UNAUTHORIZED_PUBLICATION_TARGET:${wordpressObjectId}`);
  if (canary && (wordpressObjectId !== 24 || expected.autosaveId !== 88)) throw new Error(`COMMERCIAL_STAINLESS_PAGE24_CANARY_SCOPE_MISMATCH:${wordpressObjectId}`);
  const receipts = listCommercialStainlessWordPressPublicationReceipts();
  const receiptId = canary ? "csc-page24-canary-publication-retry-v1-24-88" : `csc-wave1-publication-${wordpressObjectId}-${expected.autosaveId}`;
  const existing = receipts.find((item) => item.receiptId === receiptId);
  if (existing?.status === "PUBLIC_CERTIFIED") return existing;
  if (existing) throw new Error(`COMMERCIAL_STAINLESS_PUBLICATION_REVIEW_REQUIRED:${wordpressObjectId}:${existing.status}`);
  if (!canary) {
    const expectedIndex = COMMERCIAL_STAINLESS_AUTHORIZED_PUBLICATIONS.findIndex((item) => item.wordpressObjectId === wordpressObjectId);
    const priorIds = COMMERCIAL_STAINLESS_AUTHORIZED_PUBLICATIONS.slice(0, expectedIndex).map((item) => item.wordpressObjectId);
    if (!priorIds.every((id) => receipts.some((receipt) => receipt.wordpressObjectId === id && receipt.status === "PUBLIC_CERTIFIED"))) throw new Error(`COMMERCIAL_STAINLESS_PUBLICATION_SEQUENCE_BLOCKED:${wordpressObjectId}`);
  }

  const stage = listCommercialStainlessWordPressStageRecords().find((record) => record.wordpressObjectId === wordpressObjectId);
  if (!stage || stage.status !== "PUBLICATION_READY" || stage.autosaveId !== expected.autosaveId || !stage.certification || !stage.stagedRenderedHash) throw new Error(`COMMERCIAL_STAINLESS_EXACT_CERTIFIED_REVISION_REQUIRED:${wordpressObjectId}:${expected.autosaveId}`);
  const resolved = authority(site);
  const [autosaveRead, pageRead, publicRead] = await Promise.all([
    getJson<WordPressAutosave>(`${resolved.apiBase}/pages/${wordpressObjectId}/autosaves/${expected.autosaveId}?context=edit&_fields=id,parent,content&_publish=${crypto.randomUUID()}`, resolved.headers),
    getJson<WordPressPage>(`${resolved.apiBase}/pages/${wordpressObjectId}?context=edit&_fields=id,status,slug,link,featured_media,title,content,yoast_head_json&_publish=${crypto.randomUUID()}`, resolved.headers),
    getPublic(`${COMMERCIAL_STAINLESS_ORIGIN}${expected.path}`),
  ]);
  const page = pageRead.body ?? {};
  const autosaveRaw = text(autosaveRead.body?.content?.raw);
  const autosaveRendered = text(autosaveRead.body?.content?.rendered);
  if (canary && sha256(autosaveRaw) !== COMMERCIAL_STAINLESS_PAGE24_CANARY_AUTOSAVE_HASH) throw new Error("COMMERCIAL_STAINLESS_PAGE24_CANARY_AUTOSAVE_HASH_MISMATCH");
  const before = snapshot(page, publicRead.html);
  const precheck = autosaveRead.status === 200 && Number(autosaveRead.body?.id ?? 0) === expected.autosaveId && Number(autosaveRead.body?.parent ?? 0) === wordpressObjectId && sha256(autosaveRaw) === stage.stagedContentHash && sha256(autosaveRendered) === stage.stagedRenderedHash && pageRead.status === 200 && Number(page.id ?? 0) === wordpressObjectId && before.status === "publish" && new URL(before.url).pathname === expected.path && before.slug === expected.path.split("/").filter(Boolean).at(-1) && before.contentHash === stage.rollbackEvidence.contentHash && before.featuredMediaId === stage.rollbackEvidence.featuredMediaId && before.seoTitle === stage.rollbackEvidence.seoTitle && before.metaDescription === stage.rollbackEvidence.metaDescription && before.canonical === stage.rollbackEvidence.canonical && before.indexability === stage.rollbackEvidence.indexability && publicRead.status === 200;
  if (!precheck) throw new Error(`COMMERCIAL_STAINLESS_EXACT_REVISION_PREFLIGHT_BLOCKED:${wordpressObjectId}:${expected.autosaveId}`);

  const now = new Date().toISOString();
  let receipt = saveReceipt({
    receiptId,
    wordpressObjectId,
    authorizedAutosaveId: expected.autosaveId,
    ownerAuthorizationReference: canary ? COMMERCIAL_STAINLESS_PAGE24_CANARY_AUTHORIZATION : COMMERCIAL_STAINLESS_PUBLICATION_OWNER_AUTHORIZATION,
    implementationSha: canary ? COMMERCIAL_STAINLESS_PAGE24_CANARY_REPAIR_SHA : COMMERCIAL_STAINLESS_PUBLICATION_IMPLEMENTATION_SHA,
    profile: expected.profile,
    status: "PREPARED",
    publicUrl: before.url,
    prePublication: before,
    postPublicationHash: null,
    stagedContentHash: stage.stagedContentHash,
    stagedRenderedHash: stage.stagedRenderedHash,
    seoPreserved: null,
    identityPreserved: null,
    semanticCertification: null,
    visualCertification: null,
    verificationAttempts: [],
    convergence: null,
    verificationFailure: null,
    rollbackAuthority: { contentHash: before.contentHash, contentRaw: before.contentRaw, ready: true, executed: false },
    blockers: [],
    authorizedAt: now,
    publishedAt: null,
    certifiedAt: null,
    updatedAt: now,
  });

  let actualStoredContentHash: string | null = null;
  try {
    const write = await updateContent({ ...resolved, wordpressObjectId, content: autosaveRaw });
    if (!write.ok) throw new Error(`WORDPRESS_UPDATE_HTTP_${write.status}`);
    const afterRead = await getJson<WordPressPage>(`${resolved.apiBase}/pages/${wordpressObjectId}?context=edit&_fields=id,status,slug,link,featured_media,title,content,yoast_head_json&_published=${crypto.randomUUID()}`, resolved.headers);
    const after = afterRead.body ?? {};
    actualStoredContentHash = sha256(text(after.content?.raw));
    const storedIdentityPreserved = afterRead.status === 200 && Number(after.id ?? 0) === wordpressObjectId && text(after.status) === before.status && text(after.slug) === before.slug && text(after.link) === before.url && Number(after.featured_media ?? 0) === before.featuredMediaId && actualStoredContentHash === stage.stagedContentHash;
    if (!storedIdentityPreserved) throw new Error("STORED_POST_CONTENT_IDENTITY_FAILED");
    const priorPublicAuthorityHash = verifyWordPressTemplateStructure({ html: publicRead.html, expectedH1Count: 1, expectedIdentityClass: "gvs-page" }).postContentHtmlHash ?? before.publicDocumentHash;
    const convergence = await convergePublicVerification({
      maxAttempts: 5,
      requiredConsecutiveReads: 2,
      timeoutMs: 10_000,
      attemptSpacingMs: 250,
      read: async () => {
        const publicRead = await getPublic(before.url);
        const semantic = await semanticCertification(before.url, publicRead.status, publicRead.html);
        const structure = verifyWordPressTemplateStructure({ html: publicRead.html, expectedH1Count: 1, expectedIdentityClass: "wr-page" });
        const seoPreserved = text(after.yoast_head_json?.title) === before.seoTitle && text(after.yoast_head_json?.description) === before.metaDescription && publicCanonical(publicRead.html) === before.canonical && robots(after) === before.indexability;
        const shellPreserved = structuralShellHash(publicRead.html) === before.shellHash;
        const predicateMatrix = { ...structure.predicates, http200: semantic.http200, storedContentHashValid: storedIdentityPreserved, semanticIdentityValid: semanticPass(semantic), renderedGeometryValid: null };
        const failedPredicates = [...Object.entries(predicateMatrix).filter(([, pass]) => pass === false).map(([name]) => name), ...(!seoPreserved ? ["seoPreserved"] : []), ...(!shellPreserved ? ["globalTemplateShellPreserved"] : [])];
        const responseBodyHash = structure.postContentHtmlHash ?? sha256(mainHtml(publicRead.html));
        const cacheClassification = classifyPublicVerificationRead({ httpStatus: publicRead.status, responseBodyHash, priorPublicBodyHash: priorPublicAuthorityHash, predicatesPass: failedPredicates.length === 0 });
        return { timestamp: new Date().toISOString(), url: before.url, httpStatus: publicRead.status, responseHeaders: publicRead.headers, responseBodyHash, responseBodyHtml: publicRead.html, expectedStoredContentHash: stage.stagedContentHash, actualStoredContentHash, semanticIdentity: "wr-page", predicateMatrix, failedPredicates, cacheClassification, visualCertificationReference: null };
      },
      persistAttempt: (attempt) => {
        receipt = saveReceipt({ ...receipt, verificationAttempts: [...(receipt.verificationAttempts ?? []), attempt], updatedAt: attempt.timestamp });
      },
    });
    receipt = saveReceipt({ ...receipt, convergence: { converged: convergence.converged, classification: convergence.classification, consecutiveExpectedReads: convergence.consecutiveExpectedReads, timeoutMs: convergence.timeoutMs }, updatedAt: new Date().toISOString() });
    if (!convergence.converged) throw new Error("PUBLIC_READ_CONVERGENCE_FAILED");
    const finalAttempt = convergence.attempts.at(-1)!;
    const semantic = await semanticCertification(before.url, finalAttempt.httpStatus, finalAttempt.responseBodyHtml);
    const seoPreserved = !finalAttempt.failedPredicates.includes("seoPreserved");
    const identityPreserved = storedIdentityPreserved && !finalAttempt.failedPredicates.includes("globalTemplateShellPreserved");
    const publishedAt = new Date().toISOString();
    receipt = saveReceipt({ ...receipt, status: "PUBLISHED_PENDING_VISUAL", postPublicationHash: finalAttempt.responseBodyHash, seoPreserved, identityPreserved, semanticCertification: semantic, publishedAt, updatedAt: publishedAt });
    return receipt;
  } catch (cause) {
    const updatedAt = new Date().toISOString();
    const failedGate = cause instanceof Error ? cause.message : "UNKNOWN_PUBLICATION_FAILURE";
    const finalAttempt = receipt.verificationAttempts?.at(-1) ?? null;
    receipt = saveReceipt({ ...receipt, status: "BLOCKED", verificationFailure: { timestamp: updatedAt, failedGate, expectedStoredContentHash: stage.stagedContentHash, actualStoredContentHash, publicRenderHash: finalAttempt?.responseBodyHash ?? null, predicateMatrix: finalAttempt?.predicateMatrix ?? null, failedPredicates: finalAttempt?.failedPredicates ?? [failedGate], cacheClassification: finalAttempt?.cacheClassification ?? null }, blockers: [...receipt.blockers, failedGate], updatedAt });
    const restored = await rollback({ ...resolved, receipt });
    saveReceipt({ ...receipt, status: restored ? "ROLLED_BACK" : "BLOCKED", rollbackAuthority: { ...receipt.rollbackAuthority, ready: restored, executed: true }, blockers: [...receipt.blockers, ...(!restored ? ["ROLLBACK_FAILED"] : [])], updatedAt: new Date().toISOString() });
    throw cause;
  }
}

export async function publishCommercialStainlessWordPressWave1Page(site: SiteConfiguration, wordpressObjectId: number): Promise<CommercialStainlessWordPressPublicationReceipt> {
  return publishCommercialStainlessWordPressPage(site, wordpressObjectId, false);
}

export async function publishCommercialStainlessPage24Canary(site: SiteConfiguration): Promise<CommercialStainlessWordPressPublicationReceipt> {
  return publishCommercialStainlessWordPressPage(site, 24, true);
}

function visualPass(value: CommercialStainlessPublicVisualCertification): boolean {
  const geometryPass = value.layoutEvidence.length === 4 && value.layoutEvidence.every((evidence) => verifyRenderedWhitespace(evidence).pass);
  return value.desktop1440 && value.desktop1024 && value.tablet768 && value.mobile375 && value.horizontalOverflow === 0 && value.heroValid && value.h1Visible && value.ctaValid && value.mediaResolved && value.textMeasureAcceptable && value.noOverlap && value.noBrokenGrids && value.noGiantWhitespace && value.headerFooterCorrect && geometryPass;
}

export async function certifyCommercialStainlessWordPressPublishedPage(site: SiteConfiguration, wordpressObjectId: number, visual: CommercialStainlessPublicVisualCertification, receiptId?: string): Promise<CommercialStainlessWordPressPublicationReceipt> {
  const resolved = authority(site);
  const expected = expectedPublication(wordpressObjectId);
  const receipt = listCommercialStainlessWordPressPublicationReceipts().find((item) => receiptId ? item.receiptId === receiptId : item.wordpressObjectId === wordpressObjectId && item.status === "PUBLISHED_PENDING_VISUAL");
  if (!expected || !receipt || receipt.authorizedAutosaveId !== expected.autosaveId || receipt.status !== "PUBLISHED_PENDING_VISUAL") throw new Error(`COMMERCIAL_STAINLESS_PUBLIC_VISUAL_CERTIFICATION_BLOCKED:${wordpressObjectId}`);
  if (!visual.visualCertificationId.trim() || !visualPass(visual)) {
    const updatedAt = new Date().toISOString();
    const blocked = saveReceipt({ ...receipt, status: "BLOCKED", visualCertification: visual, blockers: [...receipt.blockers, "PUBLIC_VISUAL_CERTIFICATION_FAILED"], updatedAt });
    const storedRestored = await rollback({ ...resolved, receipt: blocked });
    let publicRestored = false;
    for (let attempt = 0; attempt < 5 && !publicRestored; attempt += 1) {
      const restoredPublic = await getPublic(receipt.publicUrl);
      publicRestored = restoredPublic.status === 200 && sha256(mainHtml(restoredPublic.html)) === receipt.prePublication.publicDocumentHash;
    }
    saveReceipt({ ...blocked, status: storedRestored && publicRestored ? "ROLLED_BACK" : "BLOCKED", rollbackAuthority: { ...blocked.rollbackAuthority, ready: storedRestored && publicRestored, executed: true }, blockers: [...blocked.blockers, ...(!storedRestored ? ["ROLLBACK_STORED_IDENTITY_FAILED"] : []), ...(!publicRestored ? ["ROLLBACK_PUBLIC_IDENTITY_FAILED"] : [])], updatedAt: new Date().toISOString() });
    throw new Error(`COMMERCIAL_STAINLESS_PUBLIC_VISUAL_CERTIFICATION_FAILED:${wordpressObjectId}`);
  }
  const certifiedAt = new Date().toISOString();
  return saveReceipt({ ...receipt, status: "PUBLIC_CERTIFIED", visualCertification: visual, certifiedAt, updatedAt: certifiedAt });
}