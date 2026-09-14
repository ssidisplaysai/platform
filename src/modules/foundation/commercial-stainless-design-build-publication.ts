import "server-only";

import { createHash } from "node:crypto";
import { normalizeWordPressApiBaseUrl } from "./authenticated-wordpress-read-authority";
import {
  COMMERCIAL_STAINLESS_ORIGIN,
  COMMERCIAL_STAINLESS_SITE_ID,
} from "./commercial-stainless-rich-composition";
import {
  COMMERCIAL_STAINLESS_DESIGN_BUILD_MOBILE_OVERFLOW_REPAIR_AUTHORIZATION,
  listCommercialStainlessDesignBuildStageRecords,
} from "./commercial-stainless-design-build-staging";
import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import {
  evaluateSemanticMediaReuse,
  extractRenderedMediaInstances,
} from "./semantic-media-reuse-policy";
import type { SiteConfiguration } from "./types";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import { verifyWordPressTemplateStructure } from "./wordpress-post-content-publication-verifier";

export const DESIGN_BUILD_PUBLICATION_OPERATION =
  "COMMERCIAL_STAINLESS_DESIGN_BUILD_REPAIRED_CANDIDATE_PUBLICATION_V2";
export const DESIGN_BUILD_APPROVED_REVISION = 119;
export const DESIGN_BUILD_APPROVED_HASH =
  "60d0a538b3d90c3c542b06c1ac55282c1b28ffa94bb04d5756bcbbc968e8a691";
const DESIGN_BUILD_PRE_REPAIR_HASH =
  "6a7fd9a24b5eaef25d4beaf858ad294e46c23dc35c22422a722be580d1904669";
export const DESIGN_BUILD_PREVIOUS_HASH =
  "f6b02c55646697fbe89a503834f550a22f896a42dc462397517c0ff3d590b5be";
const DESIGN_BUILD_OVERFLOW_RULE =
  ".wr-page{width:100vw!important;max-width:none!important;margin:0 0 0 calc(50% - 50vw)!important;padding:0!important}";
const DESIGN_BUILD_REPAIRED_OVERFLOW_RULE =
  ".wp-block-post-content:has(>.wr-page--design-build){padding-left:0!important;padding-right:0!important}.wr-page{width:100%!important;max-width:none!important;margin:0!important;padding:0!important}";
const NAMESPACE = "commercial-stainless-design-build-repaired-publication-v2";
const URL = `${COMMERCIAL_STAINLESS_ORIGIN}/design-build-fabrication/`;
type Value = { raw?: string; rendered?: string };
type Page = {
  id?: number;
  status?: string;
  slug?: string;
  parent?: number;
  link?: string;
  featured_media?: number;
  content?: Value;
  yoast_head_json?: {
    title?: string;
    description?: string;
    robots?: Record<string, string>;
  };
};
export type DesignBuildViewport = {
  width: 1440 | 1024 | 768 | 375;
  pass: boolean;
  viewportWidth: number;
  documentScrollWidth: number;
  wrPageLeft: number;
  wrPageRight: number;
  headerHeroGap: number;
  horizontalOverflow: number;
  globalHeaderCount: number;
  globalFooterCount: number;
  themePageTitleVisible: number;
  genesisHeroVisible: number;
  semanticH1Count: number;
  duplicatePrimaryHeadingCount: number;
  mainContentImageCount: number;
  uniqueMainContentImageCount: number;
  brokenMedia: number;
  actualDuplicateMedia: number;
  overlapCount: number;
  fragmentedHeadingCount: number;
  emptySectionCount: number;
  largestBlankRegion: number;
  heroEyebrowContrast: number;
  finalCtaEyebrowContrast: number;
  darkOnDarkFailures: number;
  lightOnLightFailures: number;
  unreadableTextFailures: number;
  ctaClipping: number;
  imageCroppingFailures: number;
  gridCollapseCount: number;
  negativeSideGutterCount: number;
  brokenCardCount: number;
  headerFooterOverflow: number;
};
export type DesignBuildReceipt = {
  receiptId: string;
  operation: typeof DESIGN_BUILD_PUBLICATION_OPERATION;
  status:
    | "PREPARED"
    | "PUBLISHED_PENDING_VISUAL"
    | "PUBLIC_CERTIFIED"
    | "ROLLED_BACK"
    | "BLOCKED";
  previousPublishedHash: string;
  candidateHash: string;
  candidateRevision: 119;
  publicationAttempted: true;
  publicationWriteExecuted: boolean;
  contentReconstructed: false;
  copyChanged: false;
  mediaChanged: false;
  pre: {
    contentRaw: string;
    publicHash: string;
    slug: string;
    canonical: string;
    featuredMedia: number;
    seoTitle: string;
    description: string;
    indexability: string;
  };
  reads: Array<{
    timestamp: string;
    httpStatus: number;
    finalUrl: string;
    headers: Record<string, string | null>;
    cacheClassification: "NO_CACHE_HEADER" | "CACHE_BYPASS" | "CACHE_HIT" | "CACHE_OTHER";
    bodyComplete: boolean;
    renderHash: string;
    predicates: Record<string, boolean>;
    failed: string[];
  }>;
  visual: null | {
    certificationId: string;
    authority: "ACTUAL_PUBLIC_HOST_RENDER";
    viewports: DesignBuildViewport[];
    brokenInternalLinks: number;
    devLinks: number;
    previewLinks: number;
    overflowMaskUsed: false;
    claimSafety: "PASS";
    unsupportedClaims: number;
  };
  rollbackExecuted: boolean;
  rollbackVerified: boolean;
  blockers: string[];
  createdAt: string;
  updatedAt: string;
};
type State = { receipts: DesignBuildReceipt[] };
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const main = (h: string) =>
  h.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? "";
const canonical = (h: string) =>
  text(h.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]);
const robots = (p: Page) =>
  Object.values(p.yoast_head_json?.robots ?? {}).join(",");
function authority(site: SiteConfiguration) {
  if (
    site.organizationId !== "rj-metal" ||
    site.siteId !== COMMERCIAL_STAINLESS_SITE_ID ||
    site.domain !== "commercialstainlesscounters.com"
  )
    throw new Error("DESIGN_BUILD_PUBLICATION_SCOPE_MISMATCH");
  const c = resolveWordPressCredentialReference(
    site.integrations.wordpressCredentialReference,
  );
  if (!c || !site.integrations.wordpressApiBaseUrl)
    throw new Error("DESIGN_BUILD_PUBLICATION_AUTHORITY_REQUIRED");
  return {
    apiBase: normalizeWordPressApiBaseUrl(
      site.integrations.wordpressApiBaseUrl,
    ),
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${c.username}:${c.applicationPassword}`).toString("base64")}`,
      "Cache-Control": "no-cache, no-store",
      Pragma: "no-cache",
    },
  };
}
async function get<T>(url: string, headers: Record<string, string>) {
  const r = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  return { status: r.status, body: r.ok ? ((await r.json()) as T) : null };
}
async function publicRead() {
  const r = await fetch(`${URL}?_dbpub=${crypto.randomUUID()}`, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  return {
    status: r.status,
    url: r.url,
    headers: {
      date: r.headers.get("date"),
      server: r.headers.get("server"),
      cacheControl: r.headers.get("cache-control"),
      etag: r.headers.get("etag"),
      age: r.headers.get("age"),
      xCache: r.headers.get("x-cache"),
      cfCacheStatus: r.headers.get("cf-cache-status"),
    },
    html: await r.text(),
  };
}
function cacheClassification(headers: Record<string, string | null>) {
  const cacheControl = headers.cacheControl;
  if (/\bhit\b/i.test(`${headers.xCache} ${headers.cfCacheStatus}`) || Number(headers.age) > 0)
    return "CACHE_HIT" as const;
  if (!cacheControl) return "NO_CACHE_HEADER" as const;
  if (/\b(?:no-cache|no-store|private|bypass)\b/i.test(cacheControl))
    return "CACHE_BYPASS" as const;
  return "CACHE_OTHER" as const;
}
function load() {
  return loadPersistedState<State>({
    namespace: NAMESPACE,
    seedFactory: () => ({ receipts: [] }),
  });
}
function save(receipt: DesignBuildReceipt) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const l = load(),
      i = l.state.receipts.findIndex((x) => x.receiptId === receipt.receiptId);
    if (i >= 0) l.state.receipts[i] = receipt;
    else l.state.receipts.push(receipt);
    try {
      savePersistedState({
        namespace: NAMESPACE,
        state: l.state,
        expectedRevision: l.revision,
      });
      return deepClone(receipt);
    } catch (error) {
      if (attempt === 7) throw error;
    }
  }
  throw new Error("DESIGN_BUILD_RECEIPT_PERSISTENCE_FAILED");
}
export function listDesignBuildPublicationReceipts() {
  return deepClone(load().state.receipts);
}
export function summarizeDesignBuildPublicationReceipt(r: DesignBuildReceipt) {
  return { ...r, pre: { ...r.pre, contentRaw: undefined } };
}
async function update(
  apiBase: string,
  headers: Record<string, string>,
  content: string,
) {
  const r = await fetch(`${apiBase}/pages/14`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  return r.ok;
}
async function rollback(
  a: ReturnType<typeof authority>,
  r: DesignBuildReceipt,
) {
  const wrote = await update(a.apiBase, a.headers, r.pre.contentRaw);
  const p = await get<Page>(
    `${a.apiBase}/pages/14?context=edit&_fields=id,status,content&_rollback=${crypto.randomUUID()}`,
    a.headers,
  );
  if (
    !wrote ||
    p.status !== 200 ||
    text(p.body?.status) !== "publish" ||
    sha(text(p.body?.content?.raw)) !== DESIGN_BUILD_PREVIOUS_HASH
  )
    return false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const pub = await publicRead();
    if (pub.status === 200 && sha(main(pub.html)) === r.pre.publicHash)
      return true;
  }
  return false;
}
function inspect(html: string, httpStatus = 200) {
  const structure = verifyWordPressTemplateStructure({
    html,
    expectedH1Count: 1,
    expectedIdentityClass: "wr-page",
  });
  const media = evaluateSemanticMediaReuse({
    instances: extractRenderedMediaInstances({ html: main(html), origin: URL }),
    declarations: [],
  });
  const matrix = {
    http200: httpStatus === 200,
    canonical: canonical(html) === URL,
    bodyComplete: /<\/html>\s*$/i.test(html),
    globalHeader: structure.globalHeaderCount === 1,
    globalFooter: structure.globalFooterCount === 1,
    h1: structure.h1Count === 1,
    richPage: structure.pageIdentityCount === 1,
    titleSuppressed: !/(?:wp-block-post-title|entry-title)/i.test(main(html)),
    hero: /class=["'][^"']*\bwr-hero\b/i.test(main(html)),
    media:
      media.pass &&
      media.instances.length === 5 &&
      new Set(media.instances.map((x) => x.mediaSourceIdentity)).size === 5,
    noOverflowMask: !/body\s*\{[^}]*overflow-x\s*:\s*hidden/i.test(html),
    noDevLinks: !/href=["'](?:https?:\/\/(?:localhost|127\.0\.0\.1)|[^"']*(?:preview=true|_preview=))/i.test(html),
    claimSafety: !/\b(?:certified|licensed|engineering services|installation included|code compliant|nationwide service|lead time)\b/i.test(main(html)),
  };
  return {
    matrix,
    failed: Object.entries(matrix)
      .filter(([, v]) => !v)
      .map(([k]) => k),
  };
}
export async function publishDesignBuild(site: SiteConfiguration) {
  const existing = listDesignBuildPublicationReceipts().find(
    (r) => r.receiptId === "csc-design-build-repaired-publication-v2-14-60d0a538b3d9",
  );
  if (existing) return existing;
  const stage = listCommercialStainlessDesignBuildStageRecords().find(
    (r) =>
      r.candidateRevision === DESIGN_BUILD_APPROVED_REVISION &&
      r.candidateStoredHash === DESIGN_BUILD_APPROVED_HASH &&
      r.status === "OWNER_REVIEW_READY" &&
      r.repairAuthorization ===
        COMMERCIAL_STAINLESS_DESIGN_BUILD_MOBILE_OVERFLOW_REPAIR_AUTHORIZATION &&
      r.geometryRepair?.sourceRevision === 116 &&
      r.rollbackReady &&
      r.responsiveCertification?.authority === "NATIVE_EQUIVALENT_RENDER",
  );
  if (!stage)
    throw new Error("DESIGN_BUILD_EXACT_OWNER_APPROVED_STAGE_REQUIRED");
  if (sha(stage.rollbackContentRaw) !== DESIGN_BUILD_PREVIOUS_HASH)
    throw new Error("DESIGN_BUILD_EXACT_ROLLBACK_AUTHORITY_REQUIRED");
  const a = authority(site);
  const [page, revision, before] = await Promise.all([
    get<Page>(
      `${a.apiBase}/pages/14?context=edit&_fields=id,status,slug,parent,link,featured_media,content,yoast_head_json&_dbpub=${crypto.randomUUID()}`,
      a.headers,
    ),
    get<Page>(
      `${a.apiBase}/pages/14/autosaves/${DESIGN_BUILD_APPROVED_REVISION}?context=edit&_fields=id,parent,content&_dbpub=${crypto.randomUUID()}`,
      a.headers,
    ),
    publicRead(),
  ]);
  const p = page.body ?? {},
    candidate = text(revision.body?.content?.raw);
  const reversedCandidate = candidate.replace(
    DESIGN_BUILD_REPAIRED_OVERFLOW_RULE,
    DESIGN_BUILD_OVERFLOW_RULE,
  );
  const repairedViewportEvidence =
    stage.responsiveCertification?.viewports ?? [];
  const precheck =
    page.status === 200 &&
    Number(p.id) === 14 &&
    text(p.status) === "publish" &&
    text(p.slug) === "design-build-fabrication" &&
    Number(p.parent) === 0 &&
    sha(text(p.content?.raw)) === DESIGN_BUILD_PREVIOUS_HASH &&
    revision.status === 200 &&
    Number(revision.body?.id) === DESIGN_BUILD_APPROVED_REVISION &&
    Number(revision.body?.parent) === 14 &&
    sha(candidate) === DESIGN_BUILD_APPROVED_HASH &&
    candidate.split(DESIGN_BUILD_REPAIRED_OVERFLOW_RULE).length === 2 &&
    !candidate.includes(DESIGN_BUILD_OVERFLOW_RULE) &&
    !/body\s*\{[^}]*overflow-x\s*:\s*hidden/i.test(candidate) &&
    sha(reversedCandidate) === DESIGN_BUILD_PRE_REPAIR_HASH &&
    repairedViewportEvidence.length === 4 &&
    repairedViewportEvidence.every(
      (viewport) =>
        viewport.horizontalOverflow === 0 &&
        viewport.documentScrollWidth <= viewport.viewportWidth &&
        viewport.wrPageLeft >= 0 &&
        viewport.wrPageRight <= viewport.viewportWidth,
    ) &&
    stage.candidateRenderedHtml !== null &&
    before.status === 200 &&
    canonical(before.html) === URL &&
    Number(p.featured_media) === stage.currentFeaturedMedia &&
    text(p.yoast_head_json?.title) === stage.currentSeoIdentity.title &&
    text(p.yoast_head_json?.description) ===
      stage.currentSeoIdentity.description &&
    robots(p) === stage.currentSeoIdentity.indexability;
  if (!precheck)
    throw new Error("DESIGN_BUILD_EXACT_AUTHORITY_PREFLIGHT_FAILED");
  const now = new Date().toISOString();
  let receipt = save({
    receiptId: "csc-design-build-repaired-publication-v2-14-60d0a538b3d9",
    operation: DESIGN_BUILD_PUBLICATION_OPERATION,
    status: "PREPARED",
    previousPublishedHash: DESIGN_BUILD_PREVIOUS_HASH,
    candidateHash: DESIGN_BUILD_APPROVED_HASH,
    candidateRevision: 119,
    publicationAttempted: true,
    publicationWriteExecuted: false,
    contentReconstructed: false,
    copyChanged: false,
    mediaChanged: false,
    pre: {
      contentRaw: text(p.content?.raw),
      publicHash: sha(main(before.html)),
      slug: text(p.slug),
      canonical: canonical(before.html),
      featuredMedia: Number(p.featured_media),
      seoTitle: text(p.yoast_head_json?.title),
      description: text(p.yoast_head_json?.description),
      indexability: robots(p),
    },
    reads: [],
    visual: null,
    rollbackExecuted: false,
    rollbackVerified: true,
    blockers: [],
    createdAt: now,
    updatedAt: now,
  });
  try {
    if (!(await update(a.apiBase, a.headers, candidate)))
      throw new Error("DESIGN_BUILD_CONTENT_PROMOTION_FAILED");
    receipt = save({
      ...receipt,
      publicationWriteExecuted: true,
      updatedAt: new Date().toISOString(),
    });
    const after = await get<Page>(
      `${a.apiBase}/pages/14?context=edit&_fields=id,status,slug,parent,link,featured_media,content,yoast_head_json&_dbpub=${crypto.randomUUID()}`,
      a.headers,
    );
    const ap = after.body ?? {};
    if (
      after.status !== 200 ||
      sha(text(ap.content?.raw)) !== DESIGN_BUILD_APPROVED_HASH ||
      text(ap.slug) !== receipt.pre.slug ||
      Number(ap.featured_media) !== receipt.pre.featuredMedia ||
      text(ap.yoast_head_json?.title) !== receipt.pre.seoTitle ||
      text(ap.yoast_head_json?.description) !== receipt.pre.description ||
      robots(ap) !== receipt.pre.indexability
    )
      throw new Error("DESIGN_BUILD_STORED_IDENTITY_FAILED");
    const reads: DesignBuildReceipt["reads"] = [];
    let consecutive = 0;
    for (let attempt = 0; attempt < 5 && consecutive < 2; attempt++) {
      const pub = await publicRead(),
        result = inspect(pub.html, pub.status);
      const read = {
        timestamp: new Date().toISOString(),
        httpStatus: pub.status,
        finalUrl: pub.url.split("?")[0],
        headers: pub.headers,
        cacheClassification: cacheClassification(pub.headers),
        bodyComplete: /<\/html>\s*$/i.test(pub.html),
        renderHash: sha(main(pub.html)),
        predicates: result.matrix,
        failed: result.failed,
      };
      reads.push(read);
      consecutive = result.failed.length === 0 ? consecutive + 1 : 0;
      receipt = save({ ...receipt, reads, updatedAt: read.timestamp });
    }
    const successful = reads.filter((read) => read.failed.length === 0).slice(-2);
    if (
      consecutive < 2 ||
      successful.length < 2 ||
      successful[0].renderHash !== successful[1].renderHash
    )
      throw new Error("DESIGN_BUILD_PUBLIC_CONVERGENCE_FAILED");
    return save({
      ...receipt,
      status: "PUBLISHED_PENDING_VISUAL",
      reads,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const blocked = save({
      ...receipt,
      status: "BLOCKED",
      blockers: [error instanceof Error ? error.message : "UNKNOWN"],
      updatedAt: new Date().toISOString(),
    });
    const restored = await rollback(a, blocked);
    save({
      ...blocked,
      status: restored ? "ROLLED_BACK" : "BLOCKED",
      rollbackExecuted: true,
      rollbackVerified: restored,
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
}
export async function recoverDesignBuildPublication(site: SiteConfiguration) {
  const existing = listDesignBuildPublicationReceipts().find(
    (r) => r.receiptId === "csc-design-build-repaired-publication-v2-14-60d0a538b3d9",
  );
  if (existing) return existing;
  const stage = listCommercialStainlessDesignBuildStageRecords().find(
    (r) =>
      r.candidateRevision === DESIGN_BUILD_APPROVED_REVISION &&
      r.candidateStoredHash === DESIGN_BUILD_APPROVED_HASH &&
      r.status === "OWNER_REVIEW_READY" &&
      r.rollbackReady &&
      r.responsiveCertification?.authority === "NATIVE_EQUIVALENT_RENDER",
  );
  if (!stage || sha(stage.rollbackContentRaw) !== DESIGN_BUILD_PREVIOUS_HASH)
    throw new Error("DESIGN_BUILD_RECOVERY_AUTHORITY_REQUIRED");
  const a = authority(site),
    page = await get<Page>(
      `${a.apiBase}/pages/14?context=edit&_fields=id,status,slug,parent,link,featured_media,content,yoast_head_json&_dbrecover=${crypto.randomUUID()}`,
      a.headers,
    ),
    p = page.body ?? {};
  if (
    page.status !== 200 ||
    Number(p.id) !== 14 ||
    text(p.status) !== "publish" ||
    text(p.slug) !== stage.currentSlug ||
    Number(p.parent) !== 0 ||
    sha(text(p.content?.raw)) !== DESIGN_BUILD_APPROVED_HASH ||
    Number(p.featured_media) !== stage.currentFeaturedMedia ||
    text(p.yoast_head_json?.title) !== stage.currentSeoIdentity.title ||
    text(p.yoast_head_json?.description) !==
      stage.currentSeoIdentity.description ||
    robots(p) !== stage.currentSeoIdentity.indexability
  )
    throw new Error("DESIGN_BUILD_RECOVERY_IDENTITY_FAILED");
  const now = new Date().toISOString();
  let receipt = save({
    receiptId: "csc-design-build-repaired-publication-v2-14-60d0a538b3d9",
    operation: DESIGN_BUILD_PUBLICATION_OPERATION,
    status: "PREPARED",
    previousPublishedHash: DESIGN_BUILD_PREVIOUS_HASH,
    candidateHash: DESIGN_BUILD_APPROVED_HASH,
    candidateRevision: 119,
    publicationAttempted: true,
    publicationWriteExecuted: true,
    contentReconstructed: false,
    copyChanged: false,
    mediaChanged: false,
    pre: {
      contentRaw: stage.rollbackContentRaw,
      publicHash: stage.publicHashBefore,
      slug: stage.currentSlug,
      canonical: stage.currentCanonical,
      featuredMedia: stage.currentFeaturedMedia,
      seoTitle: stage.currentSeoIdentity.title,
      description: stage.currentSeoIdentity.description,
      indexability: stage.currentSeoIdentity.indexability,
    },
    reads: [],
    visual: null,
    rollbackExecuted: false,
    rollbackVerified: true,
    blockers: ["RECOVERED_AFTER_COMMITTED_WRITE_WITHOUT_RECEIPT"],
    createdAt: now,
    updatedAt: now,
  });
  let consecutive = 0;
  const reads: DesignBuildReceipt["reads"] = [];
  for (let attempt = 0; attempt < 5 && consecutive < 2; attempt++) {
    const pub = await publicRead(),
      result = inspect(pub.html, pub.status),
      read = {
        timestamp: new Date().toISOString(),
        httpStatus: pub.status,
        finalUrl: pub.url.split("?")[0],
        headers: pub.headers,
        cacheClassification: cacheClassification(pub.headers),
        bodyComplete: /<\/html>\s*$/i.test(pub.html),
        renderHash: sha(main(pub.html)),
        predicates: result.matrix,
        failed: result.failed,
      };
    reads.push(read);
    consecutive = result.failed.length === 0 ? consecutive + 1 : 0;
    receipt = save({ ...receipt, reads, updatedAt: read.timestamp });
  }
  const successful = reads.filter((read) => read.failed.length === 0).slice(-2);
  if (
    consecutive < 2 ||
    successful.length < 2 ||
    successful[0].renderHash !== successful[1].renderHash
  ) {
    const blocked = save({
        ...receipt,
        status: "BLOCKED",
        blockers: [
          ...receipt.blockers,
          "DESIGN_BUILD_PUBLIC_CONVERGENCE_FAILED",
        ],
        updatedAt: new Date().toISOString(),
      }),
      restored = await rollback(a, blocked);
    save({
      ...blocked,
      status: restored ? "ROLLED_BACK" : "BLOCKED",
      rollbackExecuted: true,
      rollbackVerified: restored,
      updatedAt: new Date().toISOString(),
    });
    throw new Error("DESIGN_BUILD_PUBLIC_CONVERGENCE_FAILED");
  }
  return save({
    ...receipt,
    status: "PUBLISHED_PENDING_VISUAL",
    reads,
    updatedAt: new Date().toISOString(),
  });
}
export async function certifyDesignBuild(
  site: SiteConfiguration,
  receiptId: string,
  visual: {
    certificationId: string;
    authority: "ACTUAL_PUBLIC_HOST_RENDER";
    viewports: DesignBuildViewport[];
    brokenInternalLinks: number;
    devLinks: number;
    previewLinks: number;
    overflowMaskUsed: false;
    claimSafety: "PASS";
    unsupportedClaims: number;
  },
) {
  const receipt = listDesignBuildPublicationReceipts().find(
    (r) => r.receiptId === receiptId && r.status === "PUBLISHED_PENDING_VISUAL",
  );
  if (!receipt || visual.authority !== "ACTUAL_PUBLIC_HOST_RENDER")
    throw new Error("DESIGN_BUILD_VISUAL_AUTHORITY_REQUIRED");
  const widths = [1440, 1024, 768, 375];
  const pass =
    visual.viewports.length === 4 &&
    widths.every((width) =>
      visual.viewports.some(
        (v) =>
          v.width === width &&
          v.pass &&
          v.documentScrollWidth <= v.viewportWidth &&
          v.wrPageLeft >= 0 &&
          v.wrPageRight <= v.viewportWidth &&
          v.headerHeroGap === 0 &&
          v.horizontalOverflow === 0 &&
          v.globalHeaderCount === 1 &&
          v.globalFooterCount === 1 &&
          v.themePageTitleVisible === 0 &&
          v.genesisHeroVisible === 1 &&
          v.semanticH1Count === 1 &&
          v.duplicatePrimaryHeadingCount === 0 &&
          v.mainContentImageCount === 5 &&
          v.uniqueMainContentImageCount === 5 &&
          v.brokenMedia === 0 &&
          v.actualDuplicateMedia === 0 &&
          v.overlapCount === 0 &&
          v.fragmentedHeadingCount === 0 &&
          v.emptySectionCount === 0 &&
          v.largestBlankRegion <= 120 &&
          v.heroEyebrowContrast >= 4.5 &&
          v.finalCtaEyebrowContrast >= 4.5 &&
          v.darkOnDarkFailures === 0 &&
          v.lightOnLightFailures === 0 &&
          v.unreadableTextFailures === 0 &&
          v.ctaClipping === 0 &&
          v.imageCroppingFailures === 0 &&
          v.gridCollapseCount === 0 &&
          v.negativeSideGutterCount === 0 &&
          v.brokenCardCount === 0 &&
          v.headerFooterOverflow === 0,
      ),
    ) &&
    visual.brokenInternalLinks === 0 &&
    visual.devLinks === 0 &&
    visual.previewLinks === 0 &&
    visual.overflowMaskUsed === false &&
    visual.claimSafety === "PASS" &&
    visual.unsupportedClaims === 0;
  const a = authority(site),
    page = await get<Page>(
      `${a.apiBase}/pages/14?context=edit&_fields=id,status,slug,parent,featured_media,content,yoast_head_json&_dbcert=${crypto.randomUUID()}`,
      a.headers,
    ),
    current = page.body ?? {},
    finalPublic = await publicRead(),
    finalInspection = inspect(finalPublic.html, finalPublic.status),
    identityPreserved =
      text(current.status) === "publish" &&
      text(current.slug) === receipt.pre.slug &&
      Number(current.parent) === 0 &&
      Number(current.featured_media) === receipt.pre.featuredMedia &&
      text(current.yoast_head_json?.title) === receipt.pre.seoTitle &&
      text(current.yoast_head_json?.description) === receipt.pre.description &&
      robots(current) === receipt.pre.indexability &&
      canonical(finalPublic.html) === receipt.pre.canonical;
  if (
    !pass ||
    page.status !== 200 ||
    sha(text(current.content?.raw)) !== DESIGN_BUILD_APPROVED_HASH ||
    !identityPreserved ||
    finalInspection.failed.length > 0
  ) {
    const blocked = save({
      ...receipt,
      status: "BLOCKED",
      visual,
      blockers: ["ACTUAL_PUBLIC_VISUAL_FAILED"],
      updatedAt: new Date().toISOString(),
    });
    const restored = await rollback(a, blocked);
    save({
      ...blocked,
      status: restored ? "ROLLED_BACK" : "BLOCKED",
      rollbackExecuted: true,
      rollbackVerified: restored,
      updatedAt: new Date().toISOString(),
    });
    throw new Error("DESIGN_BUILD_VISUAL_CERTIFICATION_FAILED");
  }
  return save({
    ...receipt,
    status: "PUBLIC_CERTIFIED",
    visual,
    updatedAt: new Date().toISOString(),
  });
}
