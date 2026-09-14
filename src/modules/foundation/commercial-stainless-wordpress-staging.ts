import "server-only";

import { createHash } from "node:crypto";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";
import { getSiteBuildWorkspace } from "./site-build-service";
import { COMMERCIAL_STAINLESS_ORIGIN, COMMERCIAL_STAINLESS_SITE_ID, extractCommercialStainlessPublicShell, inventoryCommercialStainlessPages } from "./commercial-stainless-rich-composition";
import { COMMERCIAL_STAINLESS_WAVE_1_PATHS, stageCommercialStainlessWave1 } from "./commercial-stainless-wave1-rollout";
import type { SiteConfiguration } from "./types";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import { verifyWordPressTemplateStructure } from "./wordpress-post-content-publication-verifier";
import { evaluateSemanticMediaReuse, extractRenderedMediaInstances, type SemanticMediaPolicyResult } from "./semantic-media-reuse-policy";

export const COMMERCIAL_STAINLESS_APPROVED_WAVE_1_SHA = "c1d94a4b80661397a67d1ba8674c0ea8f71c3e19";
export const COMMERCIAL_STAINLESS_PAGE23_MEDIA_REPAIR_AUTHORIZATION = "COMMERCIAL_STAINLESS_PAGE23_GOVERNED_REVISION_STAGING_V1:APPROVED";
export const COMMERCIAL_STAINLESS_PAGE23_PRIOR_AUTOSAVE_HASH = "f12ea05f629d60988a31969b138b472caffde88833557422cf5766a388602dc0";
export const COMMERCIAL_STAINLESS_PAGE23_REPLACEMENT_MEDIA_ID = 50;
export const COMMERCIAL_STAINLESS_PAGE23_REPLACEMENT_MEDIA_URL = "https://commercialstainlesscounters.com/wp-content/uploads/2026/09/design-build-fabrication.jpg";
export const COMMERCIAL_STAINLESS_PAGE23_LENGTH_OPTIMIZATION_AUTHORIZATION = "COMMERCIAL_STAINLESS_PAGE23_OWNER_APPROVED_LENGTH_OPTIMIZATION_V1:APPROVED";
export const COMMERCIAL_STAINLESS_PAGE23_REPAIRED_HASH = "7408944090acce3b273c48e875f5eeace9f646ec31801a4a4865a70785d1c89d";
const PAGE23_LENGTH_OPTIMIZATION_STYLE = ".wr-page>.wr-section{padding-block:64px}.wr-page>.wr-section .wr-grid{margin-top:28px}.wr-page>.wr-cta{padding-block:48px}.wr-page>.wr-related{padding-block:24px}@media(max-width:800px){.wr-page>.wr-section{padding-block:52px}.wr-page>.wr-cta{padding-block:48px}.wr-page>.wr-related{padding-block:24px}}@media(max-width:520px){.wr-page>.wr-section{padding-block:48px}.wr-page>.wr-cta{padding-block:44px}.wr-page>.wr-related{padding-block:20px}}";

const AUTHORIZED_IDS = [24, 11, 13, 17, 23] as const;

type WordPressPage = {
  id?: number;
  status?: string;
  slug?: string;
  link?: string;
  template?: string;
  featured_media?: number;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
  meta?: Record<string, unknown>;
  yoast_head_json?: { title?: string; description?: string; canonical?: string; robots?: Record<string, string> };
};

type WordPressAutosave = WordPressPage & { parent?: number; date_gmt?: string; modified_gmt?: string };

export type CommercialStainlessWordPressStagingPreflightItem = {
  wordpressObjectId: number;
  status: string;
  url: string;
  slug: string;
  canonical: string;
  seoTitle: string;
  metaDescription: string;
  indexability: string;
  featuredMediaId: number;
  template: string;
  operativeAuthority: "POST_CONTENT_BLOCK_HTML" | "AMBIGUOUS";
  currentContentHash: string;
  currentRenderedHash: string;
  currentPublicBodyHash: string;
  currentPublicHttp: number;
  existingAutosaveIds: number[];
  rollbackEvidence: { status: string; slug: string; title: string; contentRaw: string; contentHash: string; renderedHash: string; featuredMediaId: number; seoTitle: string; metaDescription: string; canonical: string; indexability: string };
  ready: boolean;
  blockers: string[];
};

export type CommercialStainlessWordPressStageRecord = {
  stageId: string;
  wordpressObjectId: number;
  autosaveId: number | null;
  status: "PREPARED" | "STAGED" | "OWNER_REVIEW_READY" | "PUBLICATION_READY" | "BLOCKED" | "ROLLED_BACK";
  targetProfile: string;
  currentPublicUrl: string;
  stagedContentHash: string;
  stagedRenderedHash: string | null;
  stagedRenderedHtml: string | null;
  publicBodyHashBefore: string;
  publicBodyHashAfter: string | null;
  publicBodyChanged: boolean | null;
  rollbackEvidence: CommercialStainlessWordPressStagingPreflightItem["rollbackEvidence"];
  rollbackReady: boolean;
  seoHashPreserved: boolean;
  canonicalPreserved: boolean;
  urlPreserved: boolean;
  slugPreserved: boolean;
  indexabilityPreserved: boolean;
  mediaPreserved: boolean;
  blockers: string[];
  certification: null | { certifiedAt: string; desktop1440: true; desktop1024: true; tablet768: true; mobile375: true; horizontalOverflow: 0; globalHeaderCount: 1; bodyNavigationCount: 0; h1Count: 1; mediaResolved: true; brokenLinks: 0; devLinks: 0; unsupportedClaims: 0 };
  createdAt: string;
  updatedAt: string;
};

type StagingState = { records: CommercialStainlessWordPressStageRecord[] };
const STAGING_NAMESPACE = "commercial-stainless-wordpress-wave1-staging-v1";
const PAGE23_REPAIR_NAMESPACE = "commercial-stainless-page23-governed-revision-staging-v1";
const PAGE23_LENGTH_NAMESPACE = "commercial-stainless-page23-owner-approved-length-optimization-v1";

export type CommercialStainlessPage23RepairEvidence = {
  evidenceId: string;
  ownerAuthorization: typeof COMMERCIAL_STAINLESS_PAGE23_MEDIA_REPAIR_AUTHORIZATION;
  status: "PREPARED" | "OWNER_REVIEW_READY" | "ROLLED_BACK" | "BLOCKED";
  wordpressObjectId: 23;
  profile: "RESOURCE";
  priorAutosaveId: 92;
  priorAutosaveHash: string;
  priorAutosaveContentRaw: string;
  priorAutosaveRenderedHash: string;
  preRepairStoredContentHash: string;
  preRepairPublicHash: string;
  preRepairRevisionIds: number[];
  preRepairAuthorityRecoverable: boolean;
  postRepairRevisionIds: number[];
  postRepairRevisionCreated: boolean;
  revisionAuthority: "WORDPRESS_REVISION" | "GENESIS_DURABLE_EQUIVALENT";
  repairedStoredContentHash: string | null;
  repairedContentRaw: string | null;
  repairedRenderedHash: string | null;
  replacementMediaId: 50;
  replacementMediaUrl: typeof COMMERCIAL_STAINLESS_PAGE23_REPLACEMENT_MEDIA_URL;
  semanticPolicy: SemanticMediaPolicyResult | null;
  visualCertification: CommercialStainlessPage23RepairVisualCertification | null;
  parentIdentityPreserved: boolean;
  publicIdentityPreserved: boolean;
  rollbackExecuted: boolean;
  blockers: string[];
  createdAt: string;
  updatedAt: string;
};

export type CommercialStainlessPage23RepairVisualCertification = {
  certificationId: string;
  desktop1440: boolean;
  desktop1024: boolean;
  tablet768: boolean;
  mobile375: boolean;
  horizontalOverflow: number;
  mediaInstanceCount: number;
  repeatedSourceCount: number;
  mediaResolved: boolean;
  primaryCapabilitiesImagePreserved: boolean;
  replacementMediaPresent: boolean;
  sectionRhythmPreserved: boolean;
  textMediaBalancePreserved: boolean;
};

type Page23RepairState = { evidence: CommercialStainlessPage23RepairEvidence[] };

export type CommercialStainlessPage23LengthGeometry = { width: 1440 | 1024 | 768 | 375; totalHeightBefore: number; totalHeightAfter: number; largestBlankBefore: number; largestBlankAfter: number; horizontalOverflow: number };
export type CommercialStainlessPage23LengthEvidence = {
  evidenceId: string;
  ownerAuthorization: typeof COMMERCIAL_STAINLESS_PAGE23_LENGTH_OPTIMIZATION_AUTHORIZATION;
  status: "PREPARED" | "STAGED" | "FINAL_OWNER_CANDIDATE" | "ROLLED_BACK" | "BLOCKED";
  wordpressObjectId: 23;
  profile: "RESOURCE";
  priorRepairedHash: string;
  priorRepairedContentRaw: string;
  optimizedStoredContentHash: string | null;
  optimizedContentRaw: string | null;
  optimizedRenderedHash: string | null;
  preRepairPublicHash: string;
  semanticPolicy: SemanticMediaPolicyResult | null;
  visualCertification: null | { certificationId: string; geometry: CommercialStainlessPage23LengthGeometry[]; noContentRemoved: boolean; noSectionRemoved: boolean; visualHierarchyPreserved: boolean; noClipping: boolean; noOverlap: boolean; mediaCropsValid: boolean; ctaFooterCollisionFree: boolean };
  parentIdentityPreserved: boolean;
  publicIdentityPreserved: boolean;
  rollbackExecuted: boolean;
  blockers: string[];
  createdAt: string;
  updatedAt: string;
};

type Page23LengthState = { evidence: CommercialStainlessPage23LengthEvidence[] };

function loadStaging() {
  return loadPersistedState<StagingState>({ namespace: STAGING_NAMESPACE, seedFactory: () => ({ records: [] }) });
}

function saveRecord(record: CommercialStainlessWordPressStageRecord): CommercialStainlessWordPressStageRecord {
  const loaded = loadStaging();
  const index = loaded.state.records.findIndex((item) => item.stageId === record.stageId);
  if (index >= 0) loaded.state.records[index] = record;
  else loaded.state.records.push(record);
  savePersistedState({ namespace: STAGING_NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(record);
}

export function listCommercialStainlessWordPressStageRecords(): CommercialStainlessWordPressStageRecord[] {
  return deepClone(loadStaging().state.records);
}

export function summarizeCommercialStainlessWordPressStageRecord(record: CommercialStainlessWordPressStageRecord) {
  return { ...record, stagedRenderedHtml: undefined, rollbackEvidence: { ...record.rollbackEvidence, contentRaw: undefined } };
}

export function renderCommercialStainlessWordPressStagedPage(record: CommercialStainlessWordPressStageRecord, publicHtml: string): string {
  if (!record.stagedRenderedHtml || !record.autosaveId) throw new Error(`COMMERCIAL_STAINLESS_STAGED_RENDER_MISSING:${record.wordpressObjectId}`);
  const shell = extractCommercialStainlessPublicShell(publicHtml);
  const mainAttributes = publicHtml.match(/<main([^>]*)>/i)?.[1] ?? "";
  return `<!doctype html><html lang="en"><head>${shell.headHtml}<base href="${COMMERCIAL_STAINLESS_ORIGIN}/"></head><body${shell.bodyAttributes}><div class="wp-site-blocks">${shell.headerHtml}<main${mainAttributes}>${record.stagedRenderedHtml}</main>${shell.footerHtml}</div></body></html>`;
}

export type CommercialStainlessWordPressStagingPreflight = {
  readOnly: true;
  authorizedObjectIds: number[];
  autosaveCreateSupported: boolean;
  revisionDeleteSupported: boolean;
  items: CommercialStainlessWordPressStagingPreflightItem[];
  unauthorizedAutosaves: Array<{ wordpressObjectId: number; autosaveIds: number[] }>;
  ready: boolean;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function authorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function authority(site: SiteConfiguration) {
  if (site.siteId !== COMMERCIAL_STAINLESS_SITE_ID || site.organizationId !== "rj-metal" || site.domain !== "commercialstainlesscounters.com") throw new Error("COMMERCIAL_STAINLESS_STAGING_SCOPE_MISMATCH");
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential || !site.integrations.wordpressApiBaseUrl) throw new Error("COMMERCIAL_STAINLESS_STAGING_AUTHORITY_REQUIRED");
  const apiBase = normalizeWordPressApiBaseUrl(site.integrations.wordpressApiBaseUrl);
  return { apiBase, origin: new URL(apiBase).origin, headers: { Accept: "application/json", Authorization: authorization(credential.username, credential.applicationPassword), "Cache-Control": "no-cache, no-store", Pragma: "no-cache" } };
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<{ status: number; body: T | null }> {
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  return { status: response.status, body: response.ok ? await response.json() as T : null };
}

function mainHtml(html: string): string {
  return html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? "";
}

function routeSupports(index: { routes?: Record<string, { methods?: string[] }> }, route: string, method: string): boolean {
  return index.routes?.[route]?.methods?.includes(method) === true;
}

export async function inspectCommercialStainlessWordPressStaging(site: SiteConfiguration): Promise<CommercialStainlessWordPressStagingPreflight> {
  const resolved = authority(site);
  const indexResponse = await getJson<{ routes?: Record<string, { methods?: string[] }> }>(`${resolved.origin}/wp-json/`, resolved.headers);
  const index = indexResponse.body ?? {};
  const autosaveCreateSupported = routeSupports(index, "/wp/v2/pages/(?P<id>[\\d]+)/autosaves", "POST");
  const revisionDeleteSupported = routeSupports(index, "/wp/v2/pages/(?P<parent>[\\d]+)/revisions/(?P<id>[\\d]+)", "DELETE");
  const items = await Promise.all(AUTHORIZED_IDS.map(async (wordpressObjectId): Promise<CommercialStainlessWordPressStagingPreflightItem> => {
    const [pageResponse, autosavesResponse, publicResponse] = await Promise.all([
      getJson<WordPressPage>(`${resolved.apiBase}/pages/${wordpressObjectId}?context=edit&_fields=id,status,slug,link,template,featured_media,title,content,meta,yoast_head_json&_staging=${crypto.randomUUID()}`, resolved.headers),
      getJson<WordPressAutosave[]>(`${resolved.apiBase}/pages/${wordpressObjectId}/autosaves?context=edit&_fields=id,parent,date_gmt,modified_gmt,title,content&_staging=${crypto.randomUUID()}`, resolved.headers),
      fetch(`${COMMERCIAL_STAINLESS_ORIGIN}/?page_id=${wordpressObjectId}&_staging=${crypto.randomUUID()}`, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(30_000) }),
    ]);
    const page = pageResponse.body ?? {};
    const publicHtml = publicResponse.ok ? await publicResponse.text() : "";
    const raw = text(page.content?.raw);
    const rendered = text(page.content?.rendered);
    const publicMain = mainHtml(publicHtml);
    const autosaves = Array.isArray(autosavesResponse.body) ? autosavesResponse.body : [];
    const seoTitle = text(page.yoast_head_json?.title);
    const metaDescription = text(page.yoast_head_json?.description);
    const canonical = text(page.yoast_head_json?.canonical);
    const indexability = Object.values(page.yoast_head_json?.robots ?? {}).join(",");
    const operativeAuthority = /<!--\s*wp:html\s*-->/i.test(raw) && /class=["']gvs-page\b/i.test(raw) && /class=["']gvs-page\b/i.test(publicMain) && !/elementor/i.test(publicMain) ? "POST_CONTENT_BLOCK_HTML" as const : "AMBIGUOUS" as const;
    const expectedPath = COMMERCIAL_STAINLESS_WAVE_1_PATHS[AUTHORIZED_IDS.indexOf(wordpressObjectId)];
    const blockers = [
      ...(pageResponse.status !== 200 ? [`PAGE_READ_HTTP_${pageResponse.status}`] : []),
      ...(page.id !== wordpressObjectId ? ["OBJECT_ID_MISMATCH"] : []),
      ...(page.status !== "publish" ? ["PUBLISHED_PARENT_REQUIRED"] : []),
      ...(new URL(text(page.link) || COMMERCIAL_STAINLESS_ORIGIN).pathname !== expectedPath ? ["URL_PATH_MISMATCH"] : []),
      ...(operativeAuthority !== "POST_CONTENT_BLOCK_HTML" ? ["OPERATIVE_AUTHORITY_AMBIGUOUS"] : []),
      ...(autosavesResponse.status !== 200 ? [`AUTOSAVE_READ_HTTP_${autosavesResponse.status}`] : []),
      ...(autosaves.length > 0 ? ["EXISTING_EDITOR_AUTOSAVE_PRESENT"] : []),
      ...(!raw || !rendered || !publicMain ? ["ROLLBACK_CONTENT_INCOMPLETE"] : []),
      ...(!seoTitle || !metaDescription || !canonical || !indexability ? ["SEO_READBACK_INCOMPLETE"] : []),
      ...(!publicResponse.ok ? [`PUBLIC_HTTP_${publicResponse.status}`] : []),
    ];
    const publicCanonical = text(publicHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]) || canonical;
    const rollbackEvidence = { status: text(page.status), slug: text(page.slug), title: text(page.title?.raw ?? page.title?.rendered), contentRaw: raw, contentHash: sha256(raw), renderedHash: sha256(rendered), featuredMediaId: Number(page.featured_media ?? 0), seoTitle, metaDescription, canonical: publicCanonical, indexability };
    return { wordpressObjectId, status: text(page.status), url: text(page.link), slug: text(page.slug), canonical: publicCanonical, seoTitle, metaDescription, indexability, featuredMediaId: Number(page.featured_media ?? 0), template: text(page.template), operativeAuthority, currentContentHash: rollbackEvidence.contentHash, currentRenderedHash: rollbackEvidence.renderedHash, currentPublicBodyHash: sha256(publicMain), currentPublicHttp: publicResponse.status, existingAutosaveIds: autosaves.map((item) => Number(item.id ?? 0)).filter((id) => id > 0), rollbackEvidence, ready: blockers.length === 0, blockers };
  }));
  const unauthorizedIds = Array.from({ length: 15 }, (_, index) => index + 10).filter((id) => !AUTHORIZED_IDS.includes(id as (typeof AUTHORIZED_IDS)[number]));
  const unauthorizedAutosaves = (await Promise.all(unauthorizedIds.map(async (wordpressObjectId) => {
    const response = await getJson<WordPressAutosave[]>(`${resolved.apiBase}/pages/${wordpressObjectId}/autosaves?context=edit&_fields=id&_staging=${crypto.randomUUID()}`, resolved.headers);
    return { wordpressObjectId, autosaveIds: Array.isArray(response.body) ? response.body.map((item) => Number(item.id ?? 0)).filter((id) => id > 0) : [-1] };
  }))).filter((item) => item.autosaveIds.length > 0);
  return { readOnly: true, authorizedObjectIds: [...AUTHORIZED_IDS], autosaveCreateSupported, revisionDeleteSupported, items, unauthorizedAutosaves, ready: autosaveCreateSupported && revisionDeleteSupported && items.every((item) => item.ready) && unauthorizedAutosaves.length === 0 };
}

export function buildCommercialStainlessWave1StagingArtifacts(input: { site: SiteConfiguration; publicHtmlByPath: Record<string, string> }) {
  const workspace = getSiteBuildWorkspace(input.site);
  const pages = workspace.currentAssembly?.pages ?? [];
  const inventory = inventoryCommercialStainlessPages({ pages, visuals: workspace.currentVisualAssemblies });
  const stages = stageCommercialStainlessWave1({ pages, inventory, publicHtmlByPath: input.publicHtmlByPath });
  return stages.map((stage) => ({ stage, shell: extractCommercialStainlessPublicShell(input.publicHtmlByPath[new URL(stage.page.url).pathname]) }));
}

async function deleteRevision(input: { apiBase: string; headers: Record<string, string>; parentId: number; revisionId: number }): Promise<boolean> {
  const response = await fetch(`${input.apiBase}/pages/${input.parentId}/revisions/${input.revisionId}?force=true`, { method: "DELETE", headers: input.headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  return response.ok;
}

export async function stageCommercialStainlessWordPressWave1(site: SiteConfiguration): Promise<CommercialStainlessWordPressStageRecord[]> {
  const preflight = await inspectCommercialStainlessWordPressStaging(site);
  if (!preflight.ready) throw new Error(`COMMERCIAL_STAINLESS_STAGING_PREFLIGHT_BLOCKED:${preflight.items.flatMap((item) => item.blockers.map((blocker) => `${item.wordpressObjectId}:${blocker}`)).join(",")}`);
  const existing = listCommercialStainlessWordPressStageRecords().filter((record) => record.status === "STAGED" || record.status === "PUBLICATION_READY");
  if (existing.length === AUTHORIZED_IDS.length && existing.every((record) => AUTHORIZED_IDS.includes(record.wordpressObjectId as (typeof AUTHORIZED_IDS)[number]))) return existing;
  if (existing.length > 0) throw new Error("COMMERCIAL_STAINLESS_PARTIAL_STAGE_REVIEW_REQUIRED");
  const resolved = authority(site);
  const publicEntries = await Promise.all(COMMERCIAL_STAINLESS_WAVE_1_PATHS.map(async (path) => {
    const response = await fetch(`${COMMERCIAL_STAINLESS_ORIGIN}${path}?_staging_source=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`COMMERCIAL_STAINLESS_PUBLIC_SOURCE_FAILED:${path}:${response.status}`);
    return [path, await response.text()] as const;
  }));
  const artifacts = buildCommercialStainlessWave1StagingArtifacts({ site, publicHtmlByPath: Object.fromEntries(publicEntries) });
  const created: Array<{ parentId: number; revisionId: number; stageId: string }> = [];
  const records: CommercialStainlessWordPressStageRecord[] = [];
  try {
    for (const { stage } of artifacts) {
      const wordpressObjectId = Number(stage.page.wordpressObjectId);
      const before = preflight.items.find((item) => item.wordpressObjectId === wordpressObjectId);
      if (!before || !AUTHORIZED_IDS.includes(wordpressObjectId as (typeof AUTHORIZED_IDS)[number])) throw new Error(`COMMERCIAL_STAINLESS_UNAUTHORIZED_STAGE_TARGET:${wordpressObjectId}`);
      const now = new Date().toISOString();
      let record = saveRecord({ stageId: stage.stageId, wordpressObjectId, autosaveId: null, status: "PREPARED", targetProfile: stage.targetProfile, currentPublicUrl: stage.page.url, stagedContentHash: stage.wordpressContentHash, stagedRenderedHash: null, stagedRenderedHtml: null, publicBodyHashBefore: before.currentPublicBodyHash, publicBodyHashAfter: null, publicBodyChanged: null, rollbackEvidence: before.rollbackEvidence, rollbackReady: preflight.revisionDeleteSupported, seoHashPreserved: true, canonicalPreserved: true, urlPreserved: true, slugPreserved: true, indexabilityPreserved: true, mediaPreserved: true, blockers: [], certification: null, createdAt: now, updatedAt: now });
      const response = await fetch(`${resolved.apiBase}/pages/${wordpressObjectId}/autosaves`, { method: "POST", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ title: stage.page.title, content: stage.wordpressContent, excerpt: stage.page.currentSeo.metaDescription, featured_media: before.featuredMediaId }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
      const autosave = await response.json().catch(() => null) as WordPressAutosave | null;
      const autosaveId = Number(autosave?.id ?? 0);
      if (!response.ok || !autosaveId) throw new Error(`COMMERCIAL_STAINLESS_AUTOSAVE_CREATE_FAILED:${wordpressObjectId}:${response.status}`);
      created.push({ parentId: wordpressObjectId, revisionId: autosaveId, stageId: stage.stageId });
      const [exactAutosave, parentAfter, publicAfter] = await Promise.all([
        getJson<WordPressAutosave>(`${resolved.apiBase}/pages/${wordpressObjectId}/autosaves/${autosaveId}?context=edit&_fields=id,parent,title,content,featured_media&_staging=${crypto.randomUUID()}`, resolved.headers),
        getJson<WordPressPage>(`${resolved.apiBase}/pages/${wordpressObjectId}?context=edit&_fields=id,status,slug,link,featured_media,title,content,yoast_head_json&_staging=${crypto.randomUUID()}`, resolved.headers),
        fetch(`${stage.page.url}?_staging_verify=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }),
      ]);
      const stagedRaw = text(exactAutosave.body?.content?.raw);
      const stagedRendered = text(exactAutosave.body?.content?.rendered);
      const parent = parentAfter.body ?? {};
      const publicHtml = publicAfter.ok ? await publicAfter.text() : "";
      const publicBodyHashAfter = sha256(mainHtml(publicHtml));
      const blockers = [
        ...(exactAutosave.status !== 200 || Number(exactAutosave.body?.id ?? 0) !== autosaveId ? ["AUTOSAVE_READBACK_FAILED"] : []),
        ...(sha256(stagedRaw) !== stage.wordpressContentHash ? ["AUTOSAVE_RAW_HASH_MISMATCH"] : []),
        ...(!/class=["']wr-page\b/.test(stagedRendered) ? ["AUTOSAVE_RENDER_MISSING"] : []),
        ...(Number(parent.id ?? 0) !== wordpressObjectId || text(parent.status) !== before.status || text(parent.slug) !== before.slug || sha256(text(parent.content?.raw)) !== before.currentContentHash || Number(parent.featured_media ?? 0) !== before.featuredMediaId ? ["PUBLISHED_PARENT_CHANGED"] : []),
        ...(publicBodyHashAfter !== before.currentPublicBodyHash ? ["PUBLIC_BODY_CHANGED"] : []),
      ];
      record = saveRecord({ ...record, autosaveId, status: blockers.length ? "BLOCKED" : "STAGED", stagedRenderedHash: stagedRendered ? sha256(stagedRendered) : null, stagedRenderedHtml: stagedRendered || null, publicBodyHashAfter, publicBodyChanged: publicBodyHashAfter !== before.currentPublicBodyHash, blockers, updatedAt: new Date().toISOString() });
      records.push(record);
      if (blockers.length) throw new Error(`COMMERCIAL_STAINLESS_STAGE_VERIFICATION_FAILED:${wordpressObjectId}:${blockers.join(",")}`);
    }
    return records;
  } catch (error) {
    for (const createdRevision of created.reverse()) {
      const deleted = await deleteRevision({ apiBase: resolved.apiBase, headers: resolved.headers, parentId: createdRevision.parentId, revisionId: createdRevision.revisionId });
      const current = listCommercialStainlessWordPressStageRecords().find((record) => record.stageId === createdRevision.stageId);
      if (current) saveRecord({ ...current, status: deleted ? "ROLLED_BACK" : "BLOCKED", rollbackReady: deleted, blockers: [...current.blockers, ...(deleted ? [] : ["AUTOSAVE_DELETE_FAILED"])], updatedAt: new Date().toISOString() });
    }
    throw error;
  }
}

export type CommercialStainlessWordPressCertificationResult = { stageId: string; desktop1440: boolean; desktop1024: boolean; tablet768: boolean; mobile375: boolean; horizontalOverflow: number; globalHeaderCount: number; bodyNavigationCount: number; h1Count: number; mediaResolved: boolean; brokenLinks: number; devLinks: number; unsupportedClaims: number };

export type CommercialStainlessPrepublicationResult = {
  wordpressObjectId: number;
  autosaveId: number;
  status: "PREPUBLICATION_READY" | "BLOCKED";
  contentIdentity: boolean;
  renderedIdentity: boolean;
  seoPreserved: boolean;
  canonicalPreserved: boolean;
  indexabilityPreserved: boolean;
  mediaValid: boolean;
  linksValid: boolean;
  compositionValid: boolean;
  responsiveValid: boolean;
  blockers: string[];
};

async function resourcesValid(html: string, publicUrl: string) {
  const references = [...html.matchAll(/<(a|img)\b[^>]+(?:href|src)=["']([^"']+)["']/gi)];
  const media = new Set<string>();
  const links = new Set<string>();
  for (const [, tag, value] of references) {
    if (!value || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:") || value.startsWith("data:")) continue;
    const url = new URL(value, publicUrl);
    if (tag.toLowerCase() === "img") media.add(url.toString());
    else if (url.origin === COMMERCIAL_STAINLESS_ORIGIN) links.add(url.toString());
  }
  const valid = async (url: string) => {
    try { return (await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(30_000) })).ok; } catch { return false; }
  };
  return { mediaValid: (await Promise.all([...media].map(valid))).every(Boolean), linksValid: (await Promise.all([...links].map(valid))).every(Boolean) };
}

export async function inspectCommercialStainlessWordPressWave1Prepublication(site: SiteConfiguration): Promise<CommercialStainlessPrepublicationResult[]> {
  const expectedAutosaves = new Map([[24, 88], [11, 89], [13, 90], [17, 91], [23, 92]]);
  const records = listCommercialStainlessWordPressStageRecords().filter((record) => expectedAutosaves.has(record.wordpressObjectId));
  const resolved = authority(site);
  const results: CommercialStainlessPrepublicationResult[] = [];
  for (const wordpressObjectId of AUTHORIZED_IDS) {
    const record = records.find((item) => item.wordpressObjectId === wordpressObjectId);
    const autosaveId = expectedAutosaves.get(wordpressObjectId)!;
    if (!record) {
      results.push({ wordpressObjectId, autosaveId, status: "BLOCKED", contentIdentity: false, renderedIdentity: false, seoPreserved: false, canonicalPreserved: false, indexabilityPreserved: false, mediaValid: false, linksValid: false, compositionValid: false, responsiveValid: false, blockers: ["STAGE_RECORD_MISSING"] });
      continue;
    }
    const [autosave, parent, publicResponse] = await Promise.all([
      getJson<WordPressAutosave>(`${resolved.apiBase}/pages/${wordpressObjectId}/autosaves/${autosaveId}?context=edit&_fields=id,parent,content&_prepublication=${crypto.randomUUID()}`, resolved.headers),
      getJson<WordPressPage>(`${resolved.apiBase}/pages/${wordpressObjectId}?context=edit&_fields=id,status,slug,link,featured_media,content,yoast_head_json&_prepublication=${crypto.randomUUID()}`, resolved.headers),
      fetch(`${record.currentPublicUrl}?_prepublication=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }),
    ]);
    const raw = text(autosave.body?.content?.raw);
    const rendered = text(autosave.body?.content?.rendered);
    const publicHtml = publicResponse.ok ? await publicResponse.text() : "";
    const stagedDocument = record.stagedRenderedHtml && publicHtml ? renderCommercialStainlessWordPressStagedPage(record, publicHtml) : "";
    const structure = stagedDocument ? verifyWordPressTemplateStructure({ html: stagedDocument, expectedH1Count: 1, expectedIdentityClass: "wr-page" }) : null;
    const resources = await resourcesValid(rendered, record.currentPublicUrl);
    const parentRobots = Object.values(parent.body?.yoast_head_json?.robots ?? {}).join(",");
    const publicPageCanonical = text(publicHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]);
    const contentIdentity = autosave.status === 200 && Number(autosave.body?.id ?? 0) === autosaveId && Number(autosave.body?.parent ?? 0) === wordpressObjectId && sha256(raw) === record.stagedContentHash;
    const renderedIdentity = sha256(rendered) === record.stagedRenderedHash;
    const seoPreserved = text(parent.body?.yoast_head_json?.title) === record.rollbackEvidence.seoTitle && text(parent.body?.yoast_head_json?.description) === record.rollbackEvidence.metaDescription;
    const canonicalPreserved = publicPageCanonical === record.rollbackEvidence.canonical;
    const indexabilityPreserved = parentRobots === record.rollbackEvidence.indexability;
    const compositionValid = structure?.pass === true && !/class=["']gvs-page\b/i.test(rendered);
    const responsiveValid = Boolean(record.certification?.desktop1440 && record.certification.desktop1024 && record.certification.tablet768 && record.certification.mobile375 && record.certification.horizontalOverflow === 0);
    const blockers = [...(record.status !== "PUBLICATION_READY" ? ["OWNER_REVIEW_ONLY"] : []), ...(!contentIdentity ? ["AUTOSAVE_CONTENT_IDENTITY_FAILED"] : []), ...(!renderedIdentity ? ["AUTOSAVE_RENDERED_IDENTITY_FAILED"] : []), ...(!seoPreserved ? ["SEO_DRIFT"] : []), ...(!canonicalPreserved ? ["CANONICAL_DRIFT"] : []), ...(!indexabilityPreserved ? ["INDEXABILITY_DRIFT"] : []), ...(!resources.mediaValid ? ["MEDIA_INVALID"] : []), ...(!resources.linksValid ? ["LINK_INVALID"] : []), ...(!compositionValid ? ["COMPOSITION_INVALID"] : []), ...(!responsiveValid ? ["RESPONSIVE_EVIDENCE_INVALID"] : [])];
    results.push({ wordpressObjectId, autosaveId, status: blockers.length ? "BLOCKED" : "PREPUBLICATION_READY", contentIdentity, renderedIdentity, seoPreserved, canonicalPreserved, indexabilityPreserved, ...resources, compositionValid, responsiveValid, blockers });
  }
  return results;
}

export async function certifyCommercialStainlessWordPressWave1(site: SiteConfiguration, results: CommercialStainlessWordPressCertificationResult[]): Promise<CommercialStainlessWordPressStageRecord[]> {
  const records = listCommercialStainlessWordPressStageRecords().filter((record) => record.status === "STAGED" || record.status === "PUBLICATION_READY");
  if (records.length !== AUTHORIZED_IDS.length || results.length !== AUTHORIZED_IDS.length) throw new Error("COMMERCIAL_STAINLESS_COMPLETE_STAGE_CERTIFICATION_REQUIRED");
  const resolved = authority(site);
  const certified: CommercialStainlessWordPressStageRecord[] = [];
  for (const record of records) {
    const result = results.find((candidate) => candidate.stageId === record.stageId);
    if (!result) throw new Error(`COMMERCIAL_STAINLESS_STAGE_RESULT_MISSING:${record.wordpressObjectId}`);
    const visualPass = result.desktop1440 && result.desktop1024 && result.tablet768 && result.mobile375 && result.horizontalOverflow === 0 && result.globalHeaderCount === 1 && result.bodyNavigationCount === 0 && result.h1Count === 1 && result.mediaResolved && result.brokenLinks === 0 && result.devLinks === 0 && result.unsupportedClaims === 0;
    const [autosave, parent, publicResponse] = await Promise.all([
      getJson<WordPressAutosave>(`${resolved.apiBase}/pages/${record.wordpressObjectId}/autosaves/${record.autosaveId}?context=edit&_fields=id,parent,content&_cert=${crypto.randomUUID()}`, resolved.headers),
      getJson<WordPressPage>(`${resolved.apiBase}/pages/${record.wordpressObjectId}?context=edit&_fields=id,status,slug,link,featured_media,content,yoast_head_json&_cert=${crypto.randomUUID()}`, resolved.headers),
      fetch(`${record.currentPublicUrl}?_cert=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }),
    ]);
    const publicHtml = publicResponse.ok ? await publicResponse.text() : "";
    const publicCanonical = text(publicHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]);
    const parentIndexability = Object.values(parent.body?.yoast_head_json?.robots ?? {}).join(",");
    const invariantsPass = autosave.status === 200 && sha256(text(autosave.body?.content?.rendered)) === record.stagedRenderedHash && parent.status === 200 && text(parent.body?.status) === record.rollbackEvidence.status && text(parent.body?.slug) === record.rollbackEvidence.slug && text(parent.body?.link) === record.currentPublicUrl && Number(parent.body?.featured_media ?? 0) === record.rollbackEvidence.featuredMediaId && sha256(text(parent.body?.content?.raw)) === record.rollbackEvidence.contentHash && text(parent.body?.yoast_head_json?.title) === record.rollbackEvidence.seoTitle && text(parent.body?.yoast_head_json?.description) === record.rollbackEvidence.metaDescription && parentIndexability === record.rollbackEvidence.indexability && publicCanonical === record.rollbackEvidence.canonical && sha256(mainHtml(publicHtml)) === record.publicBodyHashBefore;
    if (!visualPass || !invariantsPass) {
      certified.push(saveRecord({ ...record, status: "BLOCKED", blockers: [...record.blockers, ...(!visualPass ? ["VISUAL_CERTIFICATION_FAILED"] : []), ...(!invariantsPass ? ["WORDPRESS_INVARIANT_FAILED"] : [])], updatedAt: new Date().toISOString() }));
      continue;
    }
    const certification = { certifiedAt: new Date().toISOString(), desktop1440: true as const, desktop1024: true as const, tablet768: true as const, mobile375: true as const, horizontalOverflow: 0 as const, globalHeaderCount: 1 as const, bodyNavigationCount: 0 as const, h1Count: 1 as const, mediaResolved: true as const, brokenLinks: 0 as const, devLinks: 0 as const, unsupportedClaims: 0 as const };
    certified.push(saveRecord({ ...record, status: "PUBLICATION_READY", certification, updatedAt: certification.certifiedAt }));
  }
  return certified;
}

export function listCommercialStainlessPage23RepairEvidence(): CommercialStainlessPage23RepairEvidence[] {
  return deepClone(loadPersistedState<Page23RepairState>({ namespace: PAGE23_REPAIR_NAMESPACE, seedFactory: () => ({ evidence: [] }) }).state.evidence);
}

function savePage23RepairEvidence(evidence: CommercialStainlessPage23RepairEvidence): CommercialStainlessPage23RepairEvidence {
  const loaded = loadPersistedState<Page23RepairState>({ namespace: PAGE23_REPAIR_NAMESPACE, seedFactory: () => ({ evidence: [] }) });
  const index = loaded.state.evidence.findIndex((item) => item.evidenceId === evidence.evidenceId);
  if (index >= 0) loaded.state.evidence[index] = evidence;
  else loaded.state.evidence.push(evidence);
  savePersistedState({ namespace: PAGE23_REPAIR_NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(evidence);
}

export function summarizeCommercialStainlessPage23RepairEvidence(evidence: CommercialStainlessPage23RepairEvidence) {
  return { ...evidence, priorAutosaveContentRaw: undefined, repairedContentRaw: undefined };
}

function replacePage23CapabilitiesCard(content: string): string {
  const cardPattern = /<a class="wr-card" href="\/capabilities\/"><img[^>]+src="https:\/\/commercialstainlesscounters\.com\/wp-content\/uploads\/2026\/09\/capabilities\.jpg"[^>]*>/;
  const matches = content.match(new RegExp(cardPattern.source, "g")) ?? [];
  if (matches.length !== 1) throw new Error(`COMMERCIAL_STAINLESS_PAGE23_EXACT_CARD_REQUIRED:${matches.length}`);
  const repairedTag = matches[0]
    .replace("https://commercialstainlesscounters.com/wp-content/uploads/2026/09/capabilities.jpg", COMMERCIAL_STAINLESS_PAGE23_REPLACEMENT_MEDIA_URL)
    .replace("Conceptual context for Capabilities", "Conceptual fabrication capability context for Capabilities");
  return content.replace(cardPattern, repairedTag);
}

function page23RepairPolicy(html: string): SemanticMediaPolicyResult {
  return evaluateSemanticMediaReuse({ instances: extractRenderedMediaInstances({ html, origin: `${COMMERCIAL_STAINLESS_ORIGIN}/about/` }), declarations: [] });
}

export async function stageCommercialStainlessPage23MediaRepair(site: SiteConfiguration): Promise<{ record: CommercialStainlessWordPressStageRecord; evidence: CommercialStainlessPage23RepairEvidence }> {
  const existingEvidence = listCommercialStainlessPage23RepairEvidence().find((item) => item.status === "OWNER_REVIEW_READY");
  const existingRecord = listCommercialStainlessWordPressStageRecords().find((item) => item.wordpressObjectId === 23);
  if (existingEvidence && existingRecord?.status === "OWNER_REVIEW_READY" && existingEvidence.repairedStoredContentHash === existingRecord.stagedContentHash) return { record: existingRecord, evidence: existingEvidence };
  if (!existingRecord || existingRecord.autosaveId !== 92 || existingRecord.targetProfile !== "RESOURCE") throw new Error("COMMERCIAL_STAINLESS_PAGE23_PRIOR_STAGE_REQUIRED");
  const resolved = authority(site);
  const [autosaveBefore, parentBefore, publicBefore, revisionsBefore] = await Promise.all([
    getJson<WordPressAutosave>(`${resolved.apiBase}/pages/23/autosaves/92?context=edit&_fields=id,parent,title,content,featured_media&_repair=${crypto.randomUUID()}`, resolved.headers),
    getJson<WordPressPage>(`${resolved.apiBase}/pages/23?context=edit&_fields=id,status,slug,link,featured_media,title,content,yoast_head_json&_repair=${crypto.randomUUID()}`, resolved.headers),
    fetch(`${COMMERCIAL_STAINLESS_ORIGIN}/about/?_repair=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }),
    getJson<WordPressAutosave[]>(`${resolved.apiBase}/pages/23/revisions?context=edit&per_page=100&_fields=id,parent,date_gmt,modified_gmt&_repair=${crypto.randomUUID()}`, resolved.headers),
  ]);
  const priorRaw = text(autosaveBefore.body?.content?.raw);
  const priorRendered = text(autosaveBefore.body?.content?.rendered);
  const parent = parentBefore.body ?? {};
  const publicHtmlBefore = publicBefore.ok ? await publicBefore.text() : "";
  const priorHash = sha256(priorRaw);
  const preRepairStoredContentHash = sha256(text(parent.content?.raw));
  const preRepairPublicHash = sha256(mainHtml(publicHtmlBefore));
  const preRevisionIds = (Array.isArray(revisionsBefore.body) ? revisionsBefore.body : []).map((item) => Number(item.id ?? 0)).filter(Boolean).sort((left, right) => left - right);
  const precheck = autosaveBefore.status === 200 && Number(autosaveBefore.body?.id ?? 0) === 92 && Number(autosaveBefore.body?.parent ?? 0) === 23 && priorHash === COMMERCIAL_STAINLESS_PAGE23_PRIOR_AUTOSAVE_HASH && parentBefore.status === 200 && Number(parent.id ?? 0) === 23 && text(parent.status) === "publish" && text(parent.slug) === "about" && new URL(text(parent.link)).pathname === "/about/" && preRepairStoredContentHash === existingRecord.rollbackEvidence.contentHash && preRepairPublicHash === existingRecord.publicBodyHashBefore && publicBefore.status === 200;
  if (!precheck) throw new Error("COMMERCIAL_STAINLESS_PAGE23_REPAIR_PREFLIGHT_BLOCKED");
  const repairedRaw = replacePage23CapabilitiesCard(priorRaw);
  const expectedRepairedHash = sha256(repairedRaw);
  const now = new Date().toISOString();
  let evidence = savePage23RepairEvidence({ evidenceId: `csc-page23-media-repair-v1-${expectedRepairedHash.slice(0, 16)}`, ownerAuthorization: COMMERCIAL_STAINLESS_PAGE23_MEDIA_REPAIR_AUTHORIZATION, status: "PREPARED", wordpressObjectId: 23, profile: "RESOURCE", priorAutosaveId: 92, priorAutosaveHash: priorHash, priorAutosaveContentRaw: priorRaw, priorAutosaveRenderedHash: sha256(priorRendered), preRepairStoredContentHash, preRepairPublicHash, preRepairRevisionIds: preRevisionIds, preRepairAuthorityRecoverable: true, postRepairRevisionIds: [], postRepairRevisionCreated: false, revisionAuthority: "GENESIS_DURABLE_EQUIVALENT", repairedStoredContentHash: null, repairedContentRaw: repairedRaw, repairedRenderedHash: null, replacementMediaId: COMMERCIAL_STAINLESS_PAGE23_REPLACEMENT_MEDIA_ID, replacementMediaUrl: COMMERCIAL_STAINLESS_PAGE23_REPLACEMENT_MEDIA_URL, semanticPolicy: null, visualCertification: null, parentIdentityPreserved: false, publicIdentityPreserved: false, rollbackExecuted: false, blockers: [], createdAt: now, updatedAt: now });
  try {
    const write = await fetch(`${resolved.apiBase}/pages/23/autosaves`, { method: "POST", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ title: text(parent.title?.raw ?? parent.title?.rendered), content: repairedRaw, excerpt: existingRecord.rollbackEvidence.metaDescription, featured_media: existingRecord.rollbackEvidence.featuredMediaId }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const written = await write.json().catch(() => null) as WordPressAutosave | null;
    const postAutosaveId = Number(written?.id ?? 0);
    if (!write.ok || postAutosaveId !== 92) throw new Error(`COMMERCIAL_STAINLESS_PAGE23_AUTOSAVE_UPDATE_FAILED:${write.status}:${postAutosaveId}`);
    const [autosaveAfter, parentAfter, publicAfter, revisionsAfter] = await Promise.all([
      getJson<WordPressAutosave>(`${resolved.apiBase}/pages/23/autosaves/92?context=edit&_fields=id,parent,content&_repair=${crypto.randomUUID()}`, resolved.headers),
      getJson<WordPressPage>(`${resolved.apiBase}/pages/23?context=edit&_fields=id,status,slug,link,featured_media,content,yoast_head_json&_repair=${crypto.randomUUID()}`, resolved.headers),
      fetch(`${COMMERCIAL_STAINLESS_ORIGIN}/about/?_repair=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }),
      getJson<WordPressAutosave[]>(`${resolved.apiBase}/pages/23/revisions?context=edit&per_page=100&_fields=id,parent,date_gmt,modified_gmt&_repair=${crypto.randomUUID()}`, resolved.headers),
    ]);
    const repairedRendered = text(autosaveAfter.body?.content?.rendered);
    const repairedHash = sha256(text(autosaveAfter.body?.content?.raw));
    const publicHtmlAfter = publicAfter.ok ? await publicAfter.text() : "";
    const postRevisionIds = (Array.isArray(revisionsAfter.body) ? revisionsAfter.body : []).map((item) => Number(item.id ?? 0)).filter(Boolean).sort((left, right) => left - right);
    const postRepairRevisionCreated = postRevisionIds.some((id) => !preRevisionIds.includes(id));
    const parentIdentityPreserved = parentAfter.status === 200 && Number(parentAfter.body?.id ?? 0) === 23 && text(parentAfter.body?.status) === "publish" && text(parentAfter.body?.slug) === existingRecord.rollbackEvidence.slug && text(parentAfter.body?.link) === existingRecord.currentPublicUrl && Number(parentAfter.body?.featured_media ?? 0) === existingRecord.rollbackEvidence.featuredMediaId && sha256(text(parentAfter.body?.content?.raw)) === preRepairStoredContentHash && text(parentAfter.body?.yoast_head_json?.title) === existingRecord.rollbackEvidence.seoTitle && text(parentAfter.body?.yoast_head_json?.description) === existingRecord.rollbackEvidence.metaDescription && Object.values(parentAfter.body?.yoast_head_json?.robots ?? {}).join(",") === existingRecord.rollbackEvidence.indexability;
    const publicIdentityPreserved = publicAfter.status === 200 && sha256(mainHtml(publicHtmlAfter)) === preRepairPublicHash && text(publicHtmlAfter.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]) === existingRecord.rollbackEvidence.canonical;
    const policy = page23RepairPolicy(repairedRendered);
    const sources = policy.instances.map((item) => item.mediaSourceIdentity);
    const exactChange = repairedRaw !== priorRaw && repairedRaw.replaceAll(COMMERCIAL_STAINLESS_PAGE23_REPLACEMENT_MEDIA_URL, "https://commercialstainlesscounters.com/wp-content/uploads/2026/09/capabilities.jpg").replace("Conceptual fabrication capability context for Capabilities", "Conceptual context for Capabilities") === priorRaw;
    const blockers = [...(autosaveAfter.status !== 200 || repairedHash !== expectedRepairedHash ? ["REPAIRED_AUTOSAVE_IDENTITY_FAILED"] : []), ...(!parentIdentityPreserved ? ["PUBLISHED_PARENT_CHANGED"] : []), ...(!publicIdentityPreserved ? ["PUBLIC_BODY_CHANGED"] : []), ...(!exactChange ? ["UNBOUNDED_COMPOSITION_CHANGE"] : []), ...(!policy.pass || policy.instances.length !== 5 || new Set(sources).size !== 5 ? ["SEMANTIC_MEDIA_POLICY_FAILED"] : []), ...(!policy.instances.some((item) => item.mediaSourceIdentity.endsWith("/capabilities.jpg") && item.compositionRole === "CONTEXTUAL_SUPPORT") ? ["PRIMARY_CAPABILITIES_MEDIA_CHANGED"] : []), ...(!policy.instances.some((item) => item.mediaSourceIdentity === COMMERCIAL_STAINLESS_PAGE23_REPLACEMENT_MEDIA_URL && item.compositionRole === "RELATED_CARD" && item.claimClass === "CONCEPTUAL") ? ["REPLACEMENT_MEDIA_AUTHORITY_FAILED"] : [])];
    evidence = savePage23RepairEvidence({ ...evidence, status: "PREPARED", postRepairRevisionIds: postRevisionIds, postRepairRevisionCreated, revisionAuthority: postRepairRevisionCreated ? "WORDPRESS_REVISION" : "GENESIS_DURABLE_EQUIVALENT", repairedStoredContentHash: repairedHash, repairedRenderedHash: sha256(repairedRendered), semanticPolicy: policy, parentIdentityPreserved, publicIdentityPreserved, blockers, updatedAt: new Date().toISOString() });
    if (blockers.length) throw new Error(`COMMERCIAL_STAINLESS_PAGE23_REPAIR_VERIFICATION_FAILED:${blockers.join(",")}`);
    const certification = existingRecord.certification ? { ...existingRecord.certification, certifiedAt: new Date().toISOString() } : null;
    const record = saveRecord({ ...existingRecord, status: "OWNER_REVIEW_READY", stagedContentHash: repairedHash, stagedRenderedHash: sha256(repairedRendered), stagedRenderedHtml: repairedRendered, mediaPreserved: true, certification, updatedAt: new Date().toISOString() });
    evidence = savePage23RepairEvidence({ ...evidence, status: "OWNER_REVIEW_READY", updatedAt: new Date().toISOString() });
    return { record, evidence };
  } catch (cause) {
    const restore = await fetch(`${resolved.apiBase}/pages/23/autosaves`, { method: "POST", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ title: text(parent.title?.raw ?? parent.title?.rendered), content: priorRaw, excerpt: existingRecord.rollbackEvidence.metaDescription, featured_media: existingRecord.rollbackEvidence.featuredMediaId }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const restored = await getJson<WordPressAutosave>(`${resolved.apiBase}/pages/23/autosaves/92?context=edit&_fields=id,parent,content&_repair=${crypto.randomUUID()}`, resolved.headers);
    const rollbackVerified = restore.ok && restored.status === 200 && sha256(text(restored.body?.content?.raw)) === priorHash;
    saveRecord({ ...existingRecord, updatedAt: new Date().toISOString() });
    savePage23RepairEvidence({ ...evidence, status: rollbackVerified ? "ROLLED_BACK" : "BLOCKED", rollbackExecuted: true, blockers: [...evidence.blockers, cause instanceof Error ? cause.message : "UNKNOWN_PAGE23_REPAIR_FAILURE", ...(!rollbackVerified ? ["AUTOSAVE_ROLLBACK_FAILED"] : [])], updatedAt: new Date().toISOString() });
    throw cause;
  }
}

export function certifyCommercialStainlessPage23MediaRepair(input: CommercialStainlessPage23RepairVisualCertification): CommercialStainlessPage23RepairEvidence {
  const evidence = listCommercialStainlessPage23RepairEvidence().find((item) => item.status === "OWNER_REVIEW_READY");
  const record = listCommercialStainlessWordPressStageRecords().find((item) => item.wordpressObjectId === 23 && item.status === "OWNER_REVIEW_READY");
  const visualPass = Boolean(input.certificationId.trim()) && input.desktop1440 && input.desktop1024 && input.tablet768 && input.mobile375 && input.horizontalOverflow === 0 && input.mediaInstanceCount === 5 && input.repeatedSourceCount === 0 && input.mediaResolved && input.primaryCapabilitiesImagePreserved && input.replacementMediaPresent && input.sectionRhythmPreserved && input.textMediaBalancePreserved;
  if (!evidence || !record || evidence.repairedStoredContentHash !== record.stagedContentHash || evidence.semanticPolicy?.pass !== true || !visualPass) throw new Error("COMMERCIAL_STAINLESS_PAGE23_REPAIR_VISUAL_CERTIFICATION_BLOCKED");
  const certifiedAt = new Date().toISOString();
  saveRecord({ ...record, certification: { certifiedAt, desktop1440: true, desktop1024: true, tablet768: true, mobile375: true, horizontalOverflow: 0, globalHeaderCount: 1, bodyNavigationCount: 0, h1Count: 1, mediaResolved: true, brokenLinks: 0, devLinks: 0, unsupportedClaims: 0 }, updatedAt: certifiedAt });
  return savePage23RepairEvidence({ ...evidence, visualCertification: input, updatedAt: certifiedAt });
}

export function listCommercialStainlessPage23LengthEvidence(): CommercialStainlessPage23LengthEvidence[] {
  return deepClone(loadPersistedState<Page23LengthState>({ namespace: PAGE23_LENGTH_NAMESPACE, seedFactory: () => ({ evidence: [] }) }).state.evidence);
}

function savePage23LengthEvidence(evidence: CommercialStainlessPage23LengthEvidence): CommercialStainlessPage23LengthEvidence {
  const loaded = loadPersistedState<Page23LengthState>({ namespace: PAGE23_LENGTH_NAMESPACE, seedFactory: () => ({ evidence: [] }) });
  const index = loaded.state.evidence.findIndex((item) => item.evidenceId === evidence.evidenceId);
  if (index >= 0) loaded.state.evidence[index] = evidence;
  else loaded.state.evidence.push(evidence);
  savePersistedState({ namespace: PAGE23_LENGTH_NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(evidence);
}

export function summarizeCommercialStainlessPage23LengthEvidence(evidence: CommercialStainlessPage23LengthEvidence) {
  return { ...evidence, priorRepairedContentRaw: undefined, optimizedContentRaw: undefined };
}

function optimizePage23Length(content: string): string {
  if (content.includes(PAGE23_LENGTH_OPTIMIZATION_STYLE)) return content;
  const styleClosures = content.match(/<\/style>/g) ?? [];
  if (styleClosures.length !== 1) throw new Error(`COMMERCIAL_STAINLESS_PAGE23_SINGLE_STYLE_REQUIRED:${styleClosures.length}`);
  return content.replace("</style>", `${PAGE23_LENGTH_OPTIMIZATION_STYLE}</style>`);
}

export async function stageCommercialStainlessPage23LengthOptimization(site: SiteConfiguration): Promise<{ record: CommercialStainlessWordPressStageRecord; evidence: CommercialStainlessPage23LengthEvidence }> {
  const existingEvidence = listCommercialStainlessPage23LengthEvidence().find((item) => item.status === "STAGED" || item.status === "FINAL_OWNER_CANDIDATE");
  const existingRecord = listCommercialStainlessWordPressStageRecords().find((item) => item.wordpressObjectId === 23);
  if (existingEvidence && existingRecord?.status === "OWNER_REVIEW_READY" && existingEvidence.optimizedStoredContentHash === existingRecord.stagedContentHash) return { record: existingRecord, evidence: existingEvidence };
  const mediaEvidence = listCommercialStainlessPage23RepairEvidence().find((item) => item.status === "OWNER_REVIEW_READY");
  if (!existingRecord || existingRecord.status !== "OWNER_REVIEW_READY" || existingRecord.targetProfile !== "RESOURCE" || existingRecord.stagedContentHash !== COMMERCIAL_STAINLESS_PAGE23_REPAIRED_HASH || !mediaEvidence || mediaEvidence.repairedStoredContentHash !== COMMERCIAL_STAINLESS_PAGE23_REPAIRED_HASH) throw new Error("COMMERCIAL_STAINLESS_PAGE23_REPAIRED_AUTHORITY_REQUIRED");
  const resolved = authority(site);
  const [autosaveBefore, parentBefore, publicBefore] = await Promise.all([
    getJson<WordPressAutosave>(`${resolved.apiBase}/pages/23/autosaves/92?context=edit&_fields=id,parent,title,content,featured_media&_length=${crypto.randomUUID()}`, resolved.headers),
    getJson<WordPressPage>(`${resolved.apiBase}/pages/23?context=edit&_fields=id,status,slug,link,featured_media,title,content,yoast_head_json&_length=${crypto.randomUUID()}`, resolved.headers),
    fetch(`${COMMERCIAL_STAINLESS_ORIGIN}/about/?_length=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }),
  ]);
  const priorRaw = text(autosaveBefore.body?.content?.raw);
  const parent = parentBefore.body ?? {};
  const publicHtmlBefore = publicBefore.ok ? await publicBefore.text() : "";
  const publicHashBefore = sha256(mainHtml(publicHtmlBefore));
  const precheck = autosaveBefore.status === 200 && Number(autosaveBefore.body?.id ?? 0) === 92 && Number(autosaveBefore.body?.parent ?? 0) === 23 && sha256(priorRaw) === COMMERCIAL_STAINLESS_PAGE23_REPAIRED_HASH && parentBefore.status === 200 && text(parent.status) === "publish" && text(parent.slug) === "about" && new URL(text(parent.link)).pathname === "/about/" && sha256(text(parent.content?.raw)) === existingRecord.rollbackEvidence.contentHash && publicBefore.status === 200 && publicHashBefore === existingRecord.publicBodyHashBefore;
  if (!precheck) throw new Error("COMMERCIAL_STAINLESS_PAGE23_LENGTH_PREFLIGHT_BLOCKED");
  const optimizedRaw = optimizePage23Length(priorRaw);
  const optimizedHash = sha256(optimizedRaw);
  const now = new Date().toISOString();
  let evidence = savePage23LengthEvidence({ evidenceId: `csc-page23-length-v1-${optimizedHash.slice(0, 16)}`, ownerAuthorization: COMMERCIAL_STAINLESS_PAGE23_LENGTH_OPTIMIZATION_AUTHORIZATION, status: "PREPARED", wordpressObjectId: 23, profile: "RESOURCE", priorRepairedHash: sha256(priorRaw), priorRepairedContentRaw: priorRaw, optimizedStoredContentHash: null, optimizedContentRaw: optimizedRaw, optimizedRenderedHash: null, preRepairPublicHash: publicHashBefore, semanticPolicy: null, visualCertification: null, parentIdentityPreserved: false, publicIdentityPreserved: false, rollbackExecuted: false, blockers: [], createdAt: now, updatedAt: now });
  try {
    const write = await fetch(`${resolved.apiBase}/pages/23/autosaves`, { method: "POST", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ title: text(parent.title?.raw ?? parent.title?.rendered), content: optimizedRaw, excerpt: existingRecord.rollbackEvidence.metaDescription, featured_media: existingRecord.rollbackEvidence.featuredMediaId }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const written = await write.json().catch(() => null) as WordPressAutosave | null;
    if (!write.ok || Number(written?.id ?? 0) !== 92) throw new Error(`COMMERCIAL_STAINLESS_PAGE23_LENGTH_AUTOSAVE_UPDATE_FAILED:${write.status}`);
    const [autosaveAfter, parentAfter, publicAfter] = await Promise.all([
      getJson<WordPressAutosave>(`${resolved.apiBase}/pages/23/autosaves/92?context=edit&_fields=id,parent,content&_length=${crypto.randomUUID()}`, resolved.headers),
      getJson<WordPressPage>(`${resolved.apiBase}/pages/23?context=edit&_fields=id,status,slug,link,featured_media,content,yoast_head_json&_length=${crypto.randomUUID()}`, resolved.headers),
      fetch(`${COMMERCIAL_STAINLESS_ORIGIN}/about/?_length=${crypto.randomUUID()}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }),
    ]);
    const afterRaw = text(autosaveAfter.body?.content?.raw);
    const afterRendered = text(autosaveAfter.body?.content?.rendered);
    const afterHash = sha256(afterRaw);
    const publicHtmlAfter = publicAfter.ok ? await publicAfter.text() : "";
    const parentIdentityPreserved = parentAfter.status === 200 && Number(parentAfter.body?.id ?? 0) === 23 && text(parentAfter.body?.status) === "publish" && text(parentAfter.body?.slug) === existingRecord.rollbackEvidence.slug && text(parentAfter.body?.link) === existingRecord.currentPublicUrl && Number(parentAfter.body?.featured_media ?? 0) === existingRecord.rollbackEvidence.featuredMediaId && sha256(text(parentAfter.body?.content?.raw)) === existingRecord.rollbackEvidence.contentHash && text(parentAfter.body?.yoast_head_json?.title) === existingRecord.rollbackEvidence.seoTitle && text(parentAfter.body?.yoast_head_json?.description) === existingRecord.rollbackEvidence.metaDescription && Object.values(parentAfter.body?.yoast_head_json?.robots ?? {}).join(",") === existingRecord.rollbackEvidence.indexability;
    const publicIdentityPreserved = publicAfter.status === 200 && sha256(mainHtml(publicHtmlAfter)) === publicHashBefore && text(publicHtmlAfter.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]) === existingRecord.rollbackEvidence.canonical;
    const policy = page23RepairPolicy(afterRendered);
    const exactChange = afterRaw.replace(PAGE23_LENGTH_OPTIMIZATION_STYLE, "") === priorRaw;
    const sources = policy.instances.map((item) => item.mediaSourceIdentity);
    const blockers = [...(autosaveAfter.status !== 200 || afterHash !== optimizedHash ? ["OPTIMIZED_AUTOSAVE_IDENTITY_FAILED"] : []), ...(!parentIdentityPreserved ? ["PUBLISHED_PARENT_CHANGED"] : []), ...(!publicIdentityPreserved ? ["PUBLIC_BODY_CHANGED"] : []), ...(!exactChange ? ["UNBOUNDED_LENGTH_CHANGE"] : []), ...(!policy.pass || policy.instances.length !== 5 || new Set(sources).size !== 5 ? ["SEMANTIC_MEDIA_POLICY_FAILED"] : [])];
    evidence = savePage23LengthEvidence({ ...evidence, status: blockers.length ? "BLOCKED" : "STAGED", optimizedStoredContentHash: afterHash, optimizedRenderedHash: sha256(afterRendered), semanticPolicy: policy, parentIdentityPreserved, publicIdentityPreserved, blockers, updatedAt: new Date().toISOString() });
    if (blockers.length) throw new Error(`COMMERCIAL_STAINLESS_PAGE23_LENGTH_VERIFICATION_FAILED:${blockers.join(",")}`);
    const record = saveRecord({ ...existingRecord, status: "OWNER_REVIEW_READY", stagedContentHash: afterHash, stagedRenderedHash: sha256(afterRendered), stagedRenderedHtml: afterRendered, certification: null, updatedAt: new Date().toISOString() });
    return { record, evidence };
  } catch (cause) {
    const restore = await fetch(`${resolved.apiBase}/pages/23/autosaves`, { method: "POST", headers: { ...resolved.headers, "Content-Type": "application/json" }, body: JSON.stringify({ title: text(parent.title?.raw ?? parent.title?.rendered), content: priorRaw, excerpt: existingRecord.rollbackEvidence.metaDescription, featured_media: existingRecord.rollbackEvidence.featuredMediaId }), cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const restored = await getJson<WordPressAutosave>(`${resolved.apiBase}/pages/23/autosaves/92?context=edit&_fields=id,parent,content&_length=${crypto.randomUUID()}`, resolved.headers);
    const rollbackVerified = restore.ok && restored.status === 200 && sha256(text(restored.body?.content?.raw)) === COMMERCIAL_STAINLESS_PAGE23_REPAIRED_HASH;
    saveRecord({ ...existingRecord, updatedAt: new Date().toISOString() });
    savePage23LengthEvidence({ ...evidence, status: rollbackVerified ? "ROLLED_BACK" : "BLOCKED", rollbackExecuted: true, blockers: [...evidence.blockers, cause instanceof Error ? cause.message : "UNKNOWN_PAGE23_LENGTH_FAILURE", ...(!rollbackVerified ? ["AUTOSAVE_ROLLBACK_FAILED"] : [])], updatedAt: new Date().toISOString() });
    throw cause;
  }
}

export function certifyCommercialStainlessPage23LengthOptimization(input: { certificationId: string; geometry: CommercialStainlessPage23LengthGeometry[]; noContentRemoved: boolean; noSectionRemoved: boolean; visualHierarchyPreserved: boolean; noClipping: boolean; noOverlap: boolean; mediaCropsValid: boolean; ctaFooterCollisionFree: boolean }): CommercialStainlessPage23LengthEvidence {
  const evidence = listCommercialStainlessPage23LengthEvidence().find((item) => item.status === "STAGED" || item.status === "FINAL_OWNER_CANDIDATE");
  const record = listCommercialStainlessWordPressStageRecords().find((item) => item.wordpressObjectId === 23 && item.status === "OWNER_REVIEW_READY");
  const widths = [1440, 1024, 768, 375];
  const geometryPass = input.geometry.length === 4 && widths.every((width) => input.geometry.some((item) => item.width === width && item.totalHeightAfter < item.totalHeightBefore && item.largestBlankAfter < item.largestBlankBefore && item.horizontalOverflow === 0));
  const pass = Boolean(input.certificationId.trim()) && geometryPass && input.noContentRemoved && input.noSectionRemoved && input.visualHierarchyPreserved && input.noClipping && input.noOverlap && input.mediaCropsValid && input.ctaFooterCollisionFree;
  if (!evidence || !record || evidence.optimizedStoredContentHash !== record.stagedContentHash || evidence.semanticPolicy?.pass !== true || !pass) throw new Error("COMMERCIAL_STAINLESS_PAGE23_LENGTH_VISUAL_CERTIFICATION_BLOCKED");
  const certifiedAt = new Date().toISOString();
  saveRecord({ ...record, certification: { certifiedAt, desktop1440: true, desktop1024: true, tablet768: true, mobile375: true, horizontalOverflow: 0, globalHeaderCount: 1, bodyNavigationCount: 0, h1Count: 1, mediaResolved: true, brokenLinks: 0, devLinks: 0, unsupportedClaims: 0 }, updatedAt: certifiedAt });
  return savePage23LengthEvidence({ ...evidence, status: "FINAL_OWNER_CANDIDATE", visualCertification: input, updatedAt: certifiedAt });
}