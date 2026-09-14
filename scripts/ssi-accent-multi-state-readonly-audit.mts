import { createDecipheriv, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { evaluateGlwReferenceClaimAuthority } from "../src/modules/glw/reference-claim-authority";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as { loadEnvConfig: (directory: string, dev: boolean) => void };
loadEnvConfig(process.cwd(), true);

const root = process.env.GCP_FOUNDATION_PERSISTENCE_DIR?.trim();
if (!root) throw new Error("GCP_FOUNDATION_PERSISTENCE_DIR is required.");

const campaignId = "campaign-ssi-site-ssi-screen-solutions-international-ssi-accent-rear-projection-film-multi-state-benchmark";
const stateNames: Readonly<Record<string, string>> = {
  AZ: "Arizona", CA: "California", CO: "Colorado", CT: "Connecticut", FL: "Florida",
  GA: "Georgia", IL: "Illinois", NC: "North Carolina", NY: "New York", TN: "Tennessee",
};
const allStateNames = Object.values(stateNames);

type TargetRecord = Record<string, unknown> & {
  campaignId?: string; stateCode?: string; targetId?: string; status?: string;
  jobId?: string | null; wordpressObjectId?: string | null; updatedAt?: string; lastError?: string | null;
};
type JobRecord = Record<string, unknown> & {
  jobId?: string; status?: string; externalExecutionId?: string | null; wordpressObjectId?: string | null;
  wordpressStatus?: string | null; slug?: string; updatedAt?: string; errorMessage?: string | null;
  qaStatus?: string | null; qaChecks?: Record<string, unknown> | null; qaFailureReasons?: Record<string, unknown> | null;
  seoTitle?: string | null; metaDescription?: string | null;
  generatedDraft?: { contentHtml?: string; seoTitle?: string | null; metaDescription?: string | null } | null;
};
type KnowledgePackRecord = Record<string, unknown> & {
  campaignId?: string; revision?: number; instructions?: string; updatedAt?: string;
  references?: Array<Record<string, unknown> & { storagePath: string }>;
};
type SiteRecord = Record<string, unknown> & {
  siteId?: string; integrations: { wordpressApiBaseUrl?: string | null };
};
type WordPressPage = Record<string, unknown> & {
  id?: number; status?: string; slug?: string; link?: string; parent?: number; featured_media?: number;
  content?: { raw?: string; rendered?: string };
};
type WordPressMedia = Record<string, unknown> & {
  id?: number; source_url?: string; alt_text?: string;
};

function readEnvelope<T>(name: string): { revision: number; data: T } {
  return JSON.parse(readFileSync(join(root, name), "utf8")) as { revision: number; data: T };
}

function sha(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function stripHtml(value: string): string {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ").trim();
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))].length;
}

function links(html: string): Array<{ href: string; text: string }> {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: match[1], text: stripHtml(match[2]) }));
}

function media(html: string): Array<{ url: string; alt: string | null }> {
  return [...html.matchAll(/<img\b([^>]*)>/gi)].map((match) => ({
    url: match[1].match(/\bsrc=["']([^"']+)["']/i)?.[1] ?? "",
    alt: match[1].match(/\balt=["']([^"']*)["']/i)?.[1] ?? null,
  }));
}

const campaignEnvelope = readEnvelope<{ campaigns: Array<Record<string, unknown>> }>("glw-campaign-repository.json");
const campaign = campaignEnvelope.data.campaigns.find((item) => item.campaignId === campaignId);
if (!campaign) throw new Error("Campaign not found.");
const targetEnvelope = readEnvelope<{ targets: TargetRecord[] }>("glw-campaign-target-repository.json");
const targets = targetEnvelope.data.targets.filter((item) => item.campaignId === campaignId);
const jobs = readEnvelope<{ records: JobRecord[] }>("glw-page-execution-repository.json").data.records;
const pack = readEnvelope<{ packs: KnowledgePackRecord[] }>("glw-campaign-reference-repository.json").data.packs.find((item) => item.campaignId === campaignId);
const approvals = readEnvelope<{ approvals: Array<Record<string, unknown> & { campaignId?: string; stateCode?: string }> }>("glw-campaign-reference-approval-repository.json").data.approvals.filter((item) => item.campaignId === campaignId);
const enrichment = readEnvelope<{ records: Array<Record<string, unknown> & { campaignId?: string }> }>("glw-site-enrichment-repository.json").data.records.filter((item) => item.campaignId === campaignId);

const site = readEnvelope<{ sites: SiteRecord[] }>("site-repository.json").data.sites.find((item) => item.siteId === campaign.siteId);
if (!site) throw new Error("Site not found.");
const credentialRecord = readEnvelope<{ credentials: Array<Record<string, string>> }>("wordpress-credential-store.json").data.credentials.find((item) =>
  item.organizationId === campaign.organizationId && item.siteId === campaign.siteId,
);
const encodedKey = process.env.GENESIS_CREDENTIAL_MASTER_KEY?.trim();
if (!credentialRecord || !encodedKey || !site.integrations.wordpressApiBaseUrl) throw new Error("SSI WordPress read authority unavailable.");
const key = Buffer.from(encodedKey, "base64");
if (key.length !== 32) throw new Error("Credential master key is invalid.");
const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(credentialRecord.iv, "base64"));
decipher.setAuthTag(Buffer.from(credentialRecord.authTag, "base64"));
const credential = JSON.parse(Buffer.concat([
  decipher.update(Buffer.from(credentialRecord.ciphertext, "base64")),
  decipher.final(),
]).toString("utf8")) as { username: string; applicationPassword: string };
const authorization = `Basic ${Buffer.from(`${credential.username}:${credential.applicationPassword}`).toString("base64")}`;
const apiRoot = site.integrations.wordpressApiBaseUrl.replace(/\/$/, "");

async function readPage(id: string): Promise<WordPressPage | null> {
  const response = await fetch(`${apiRoot}/pages/${encodeURIComponent(id)}?context=edit`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: authorization },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`WordPress read failed for ${id}: HTTP ${response.status}`);
  return await response.json() as WordPressPage;
}

const mediaCache = new Map<string, WordPressMedia | null>();
async function readMedia(id: string): Promise<WordPressMedia | null> {
  if (mediaCache.has(id)) return mediaCache.get(id) ?? null;
  const response = await fetch(`${apiRoot}/media/${encodeURIComponent(id)}?context=edit`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: authorization },
    cache: "no-store",
  });
  const item = response.status === 404 ? null : response.ok ? await response.json() as WordPressMedia : null;
  mediaCache.set(id, item);
  return item;
}

const audited = [];
for (const target of targets.sort((left, right) => String(left.stateCode).localeCompare(String(right.stateCode)))) {
  const stateCode = String(target.stateCode);
  const stateName = stateNames[stateCode] ?? stateCode;
  const job = jobs.find((item) => item.jobId === target.jobId) ?? null;
  const artifactHtml = String(job?.generatedDraft?.contentHtml ?? "");
  const wordpressId = target.wordpressObjectId ?? job?.wordpressObjectId ?? null;
  const page = wordpressId ? await readPage(String(wordpressId)) : null;
  const storedContent = String(page?.content?.raw ?? page?.content?.rendered ?? "");
  const renderedContent = String(page?.content?.rendered ?? storedContent);
  const renderDirectory = process.env.SSI_AUDIT_RENDER_DIR?.trim();
  if (renderDirectory && renderedContent) {
    mkdirSync(renderDirectory, { recursive: true });
    writeFileSync(join(renderDirectory, `${stateCode.toLowerCase()}.html`), `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${renderedContent}</body></html>`, "utf8");
  }
  const effectiveHtml = artifactHtml || storedContent;
  const text = stripHtml(effectiveHtml);
  const claimQa = artifactHtml
    ? evaluateGlwReferenceClaimAuthority({ artifact: job.generatedDraft })
    : null;
  const unsupported = claimQa?.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED") ?? [];
  const reviewRequired = claimQa?.findings.filter((finding) => finding.authorityStatus === "REVIEW_REQUIRED") ?? [];
  const storedClaimQa = storedContent
    ? evaluateGlwReferenceClaimAuthority({ artifact: { ...(job?.generatedDraft ?? {}), contentHtml: storedContent } })
    : null;
  const storedUnsupported = storedClaimQa?.findings.filter((finding) => finding.authorityStatus === "UNSUPPORTED") ?? [];
  const wrongStates = allStateNames.filter((name) => name !== stateName && new RegExp(`\\b${name.replace(" ", "\\s+")}\\b`, "i").test(text));
  const stateMentions = countMatches(text, new RegExp(`\\b${stateName.replace(" ", "\\s+")}\\b`, "gi"));
  const artifactLinks = links(effectiveHtml);
  const exactProductLinks = artifactLinks.filter((link) =>
    link.href === "https://ssidisplays.com/accent-rear-projection-film/"
    && link.text.trim().toLowerCase() === "accent rear projection film");
  const images = media(renderedContent);
  const featuredMedia = page?.featured_media ? await readMedia(String(page.featured_media)) : null;
  const headings = [...effectiveHtml.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({ level: Number(match[1]), text: stripHtml(match[2]) }));
  const h1Count = headings.filter((heading) => heading.level === 1).length;
  const devLinks = artifactLinks.filter((link) => /localhost|127\.0\.0\.1|preview|_canary|_visual/i.test(link.href));
  const brokenLinks = artifactLinks.filter((link) => !link.href.trim() || link.href === "#" || /^javascript:/i.test(link.href));
  const artifactSha = artifactHtml ? sha(artifactHtml) : null;
  const storedHash = storedContent ? sha(storedContent) : null;
  const withoutFigures = (value: string) => value.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "").trim();
  const artifactStoredRelation = !artifactHtml || !storedContent
    ? "NOT_COMPARABLE"
    : artifactHtml === storedContent
      ? "EXACT"
      : withoutFigures(artifactHtml) === withoutFigures(storedContent)
        ? "MEDIA_ONLY_DRIFT"
        : stripHtml(artifactHtml) === stripHtml(storedContent)
          ? "MARKUP_ONLY_DRIFT"
          : "MATERIAL_TEXT_DRIFT";
  const mediaItems = [
    ...(featuredMedia ? [{
      mediaId: String(featuredMedia.id),
      url: String(featuredMedia.source_url ?? ""),
      semanticRole: "LOCAL_CONTEXTUAL_ATMOSPHERE",
      sourceType: "WORDPRESS_MEDIA",
      provenance: `wordpress-media:${featuredMedia.id}`,
      approvalState: "UNKNOWN_HISTORICAL",
      accessibility: String(featuredMedia.alt_text ?? "").trim() ? "ALT_PRESENT" : "ALT_MISSING",
      duplicateUse: false,
      broken: !featuredMedia.source_url,
    }] : []),
    ...images.filter((image) => image.url !== featuredMedia?.source_url).map((image) => ({
    mediaId: null,
    url: image.url,
    semanticRole: "CONTEXTUAL_IN_USE",
    sourceType: image.url.includes("ssidisplays.com") ? "WORDPRESS_MEDIA" : "EXTERNAL_OR_UNKNOWN",
    provenance: page ? `wordpress-page:${page.id}` : "GENERATED_ARTIFACT",
    approvalState: "UNKNOWN_HISTORICAL",
    accessibility: image.alt?.trim() ? "ALT_PRESENT" : "ALT_MISSING",
    duplicateUse: images.filter((candidate) => candidate.url === image.url).length > 1,
    broken: !image.url,
  }))];
  audited.push({
    stateCode, stateName, targetId: target.targetId, lifecycleState: target.status,
    referenceTarget: approvals.some((approval) => approval.stateCode === stateCode),
    jobId: target.jobId ?? null, jobState: job?.status ?? null,
    executionId: job?.externalExecutionId ?? null, executionState: job?.status ?? null,
    generatedArtifactPresent: Boolean(artifactHtml), generatedArtifactSha: artifactSha,
    generatedArtifactLength: artifactHtml.length,
    wordpressObjectId: wordpressId, wordpressStatus: page?.status ?? job?.wordpressStatus ?? null,
    storedPostContentHash: storedHash,
    artifactToStoredContentExact: Boolean(artifactSha && storedHash && artifactSha === storedHash),
    artifactStoredRelation,
    canonicalPath: page?.slug ? `/accent-rear-projection-film/${page.slug}/` : job?.slug ?? null,
    wordpressEditLink: page?.link ?? null, parentId: page?.parent != null ? String(page.parent) : null,
    featuredMediaId: page?.featured_media ? String(page.featured_media) : null,
    lastActivity: job?.updatedAt ?? target.updatedAt, lastError: job?.errorMessage ?? target.lastError ?? null,
    historicalAuthority: {
      referenceFingerprintAtGeneration: null,
      instructionFingerprintAtGeneration: null,
      productAuthorityFingerprintAtGeneration: null,
      qaPolicyAtGeneration: job?.qaChecks?.claimAuthority?.policyVersion ?? null,
      generatorRuntimeAtGeneration: null,
      classification: "UNKNOWN_AUTHORITY",
    },
    unsupportedFactualClaimCount: unsupported.length,
    reviewRequiredClaimCount: reviewRequired.length,
    unsupportedClaims: unsupported.map((finding) => ({ claimClass: finding.claimClass, claimText: finding.claimText })),
    storedUnsupportedFactualClaimCount: storedUnsupported.length,
    storedUnsupportedClaims: storedUnsupported.map((finding) => ({ claimClass: finding.claimClass, claimText: finding.claimText })),
    artifactStoredLengthDelta: storedContent ? storedContent.length - artifactHtml.length : null,
    localization: {
      stateMentionCount: stateMentions,
      wrongStateContaminationCount: wrongStates.length,
      wrongStates,
      unsupportedLocalClaimCount: unsupported.filter((finding) => finding.claimClass === "LOCATION_FACT" || finding.claimClass === "MARKET_ADOPTION" || finding.claimClass === "CLIMATE").length,
      status: !artifactHtml ? "NOT_EVALUABLE" : wrongStates.length > 0 ? "FAIL_WRONG_STATE_CONTAMINATION" : stateMentions < 2 ? "FAIL_GENERIC_OR_MISSING" : "PASS_STRUCTURAL_REVIEW_REQUIRED",
    },
    productAuthority: {
      known: true,
      canonicalUrl: "https://ssidisplays.com/accent-rear-projection-film/",
      linkPresent: exactProductLinks.length > 0,
      linkExact: exactProductLinks.length > 0,
      productClaimsSupported: unsupported.every((finding) => !finding.claimClass.startsWith("PRODUCT_")),
    },
    media: {
      items: mediaItems,
      status: !page ? "MEDIA_MISSING" : !page.featured_media ? "MEDIA_MISSING" : mediaItems.some((item) => item.accessibility === "ALT_MISSING" || item.broken) ? "MEDIA_REPAIR_REQUIRED" : "MEDIA_UNGOVERNED",
    },
    composition: {
      h1Count, headingCount: headings.length,
      paragraphCount: countMatches(effectiveHtml, /<p\b/gi),
      wordCount: text ? text.split(/\s+/).length : 0,
      status: !artifactHtml ? "NOT_EVALUABLE" : h1Count !== 1 || headings.length < 5 ? "OLD_COMPOSITION" : "STRUCTURALLY_RICH_HOST_REVIEW_REQUIRED",
      responsiveStatus: "UNKNOWN_REQUIRES_AUTHENTICATED_DRAFT_HOST_RENDER",
      contrastStatus: "UNKNOWN_REQUIRES_AUTHENTICATED_DRAFT_HOST_RENDER",
      hostPresentationStatus: "UNKNOWN_REQUIRES_AUTHENTICATED_DRAFT_HOST_RENDER",
      mediaGeometryStatus: images.length ? "STATIC_REVIEW_ONLY" : "MEDIA_MISSING",
    },
    seo: {
      slug: page?.slug ?? job?.slug ?? null,
      canonical: page?.link ?? null,
      parent: page?.parent != null ? String(page.parent) : null,
      seoTitle: job?.generatedDraft?.seoTitle ?? job?.seoTitle ?? null,
      metaDescription: job?.generatedDraft?.metaDescription ?? job?.metaDescription ?? null,
      devLinkCount: devLinks.length,
      brokenLinkCount: brokenLinks.length,
      internalAnchorCount: artifactLinks.filter((link) => link.href.startsWith("/") || link.href.startsWith("https://ssidisplays.com/")).length,
      status: !page ? "SEO_NOT_EVALUABLE" : !page.slug || !job?.generatedDraft?.seoTitle || !job?.generatedDraft?.metaDescription ? "SEO_REPAIR_REQUIRED" : "SEO_STRUCTURAL_PASS_METADATA_RECERTIFY",
      navigationStatus: brokenLinks.length || devLinks.length ? "NAVIGATION_REPAIR_REQUIRED" : "NAVIGATION_STATIC_PASS_HOST_RECERTIFY",
    },
    persistedQa: { status: job?.qaStatus ?? null, checks: job?.qaChecks ?? null, failures: job?.qaFailureReasons ?? null },
  });
}

const campaignFingerprint = sha(JSON.stringify(campaign));
const references = pack?.references ?? [];
const referenceFingerprint = references.length === 1
  ? sha(readFileSync(references[0].storagePath))
  : sha(JSON.stringify(references.map((reference: Record<string, unknown>) => ({
      referenceId: reference.referenceId, fileName: reference.fileName,
      role: reference.role, scope: reference.scope,
    }))));

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  readOnly: true,
  campaignRepositoryRevision: campaignEnvelope.revision,
  targetRepositoryRevision: targetEnvelope.revision,
  campaign,
  campaignFingerprint,
  product: { productId: campaign.productId, productName: "Accent Rear Projection Film", canonicalUrl: "https://ssidisplays.com/accent-rear-projection-film/" },
  knowledgePack: {
    revision: pack?.revision ?? null,
    referenceCount: references.length,
    referenceFingerprint,
    instructionFingerprint: pack?.instructions ? sha(String(pack.instructions).trim()) : null,
    updatedAt: pack?.updatedAt ?? null,
  },
  approvals,
  enrichmentRecordCount: enrichment.length,
  currentQaPolicyVersion: "GLW_REFERENCE_CLAIM_AUTHORITY_V1",
  targets: audited,
}, null, 2));