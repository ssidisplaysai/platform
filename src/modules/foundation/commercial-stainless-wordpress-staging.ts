import "server-only";

import { createHash } from "node:crypto";

import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";
import { getSiteBuildWorkspace } from "./site-build-service";
import { COMMERCIAL_STAINLESS_ORIGIN, COMMERCIAL_STAINLESS_SITE_ID, extractCommercialStainlessPublicShell, inventoryCommercialStainlessPages } from "./commercial-stainless-rich-composition";
import { COMMERCIAL_STAINLESS_WAVE_1_PATHS, stageCommercialStainlessWave1 } from "./commercial-stainless-wave1-rollout";
import type { SiteConfiguration } from "./types";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";

export const COMMERCIAL_STAINLESS_APPROVED_WAVE_1_SHA = "c1d94a4b80661397a67d1ba8674c0ea8f71c3e19";

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
  status: "PREPARED" | "STAGED" | "PUBLICATION_READY" | "BLOCKED" | "ROLLED_BACK";
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
  return { readOnly: true, authorizedObjectIds: [...AUTHORIZED_IDS], autosaveCreateSupported, revisionDeleteSupported, items, ready: autosaveCreateSupported && revisionDeleteSupported && items.every((item) => item.ready) };
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