import "server-only";

import { createHash } from "node:crypto";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getProductById } from "@/modules/foundation/product-repository";
import { resolveApprovedProductAuthorityMedia } from "@/modules/foundation/site-page-media-assignment";
import { getSiteById } from "@/modules/foundation/site-repository";
import { writeGenesisWordPressDraft, type GenesisWordPressDraftWriteResult } from "@/modules/foundation/wordpress-draft-writer";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { listAllGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { buildGeneratedPageReviewModel, type GeneratedPageReviewModel } from "@/modules/glw/generated-page-review-read-model";
import { renderOutdoorSphereRichWordPress } from "@/modules/glw/outdoor-sphere-rich-wordpress-render";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { applyScopedThemeTitleSuppression } from "@/modules/glw/scoped-theme-title-suppression";

export const GA_RICH_COMPOSITION_REPAIR_IDENTITY = {
  organizationId: "led-display-warehouse",
  siteId: "site-led-display-warehouse-production",
  campaignId: "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview",
  targetId: "target-campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview-ga",
  jobId: "cb4684bf-477c-45f2-98c3-a37717368b83",
  externalExecutionId: "703853",
  wordpressObjectId: "20169",
  wordpressStatus: "draft",
} as const;

type WordPressDraft = {
  id?: number;
  status?: string;
  slug?: string;
  parent?: number;
  featured_media?: number;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
};

type RepairDependencies = {
  buildReviewModel: (input: { jobId: string; organizationId: string; siteId: string }) => Promise<GeneratedPageReviewModel | null>;
  getJobById: (jobId: string) => ReturnType<typeof glwPageExecutionRepository.getById>;
  updateJob: (jobId: string, patch: Record<string, unknown>) => ReturnType<typeof glwPageExecutionRepository.update>;
  getSiteById: typeof getSiteById;
  getProductById: typeof getProductById;
  resolveApprovedProductAuthorityMedia: typeof resolveApprovedProductAuthorityMedia;
  listAllTargets: typeof listAllGlwCampaignTargets;
  readWordPressDraft: (input: { siteId: string; wordpressObjectId: string }) => Promise<WordPressDraft>;
  writeDraft: (input: Parameters<typeof writeGenesisWordPressDraft>[0]) => Promise<GenesisWordPressDraftWriteResult>;
  renderRich: typeof renderOutdoorSphereRichWordPress;
  applyTitleSuppression: typeof applyScopedThemeTitleSuppression;
  now: () => string;
};

type ExecuteInput = {
  actor: string;
  expectedStoredSha256: string;
};

export type GaRichCompositionApplyRepairPreflight = {
  operation: "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT";
  identity: {
    campaignId: string;
    targetId: string;
    jobId: string;
    externalExecutionId: string;
    wordpressObjectId: string;
    wordpressStatus: "draft";
  };
  currentStoredSha256: string;
  title: string;
  canonicalPath: string;
  wordpressParentId: number | null;
  visualCertificationState: GeneratedPageReviewModel["visualQa"]["certificationState"];
};

export type GaRichCompositionApplyRepairResult = {
  operation: "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT";
  jobId: string;
  targetId: string;
  campaignId: string;
  wordpressObjectId: string;
  wordpressStatus: "draft";
  mutationPerformed: boolean;
  accounting: {
    wordpressUpdates: number;
    wordpressCreates: number;
    wordpressMutations: number;
    imageGenerationRequests: number;
    n8nDispatchRequests: number;
    publicationRequests: number;
  };
  verification: {
    readbackHashMatchesWrittenRichHtml: boolean;
    legacyProductImageAbsent: boolean;
    contextualHeroPresent: boolean;
    singleH1: boolean;
    contentMatch: boolean;
  };
  visualCertificationStateBefore: GeneratedPageReviewModel["visualQa"]["certificationState"];
  visualCertificationStateAfter: GeneratedPageReviewModel["visualQa"]["certificationState"];
  beforeHash: string;
  afterHash: string;
  richHash: string;
  actor: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hash(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseAbsoluteHttpUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveProductAuthorityUrl(input: {
  authority: ReturnType<typeof resolveApprovedProductAuthorityMedia>;
  siteRecord: NonNullable<ReturnType<typeof getSiteById>>;
}): string | null {
  const receiptUrl = parseAbsoluteHttpUrl(input.authority?.wordpressReceipt?.url ?? null);
  if (receiptUrl) return receiptUrl;
  if (!input.authority || input.authority.asset.type !== "APPROVED_EXISTING") return null;
  const assetUrl = parseAbsoluteHttpUrl(input.authority.asset.url);
  if (!assetUrl) return null;

  const allowedOrigins = new Set<string>();
  const canonicalUrl = parseAbsoluteHttpUrl(input.siteRecord.canonicalUrl);
  const apiBaseUrl = parseAbsoluteHttpUrl(input.siteRecord.integrations.wordpressApiBaseUrl);
  if (canonicalUrl) allowedOrigins.add(new URL(canonicalUrl).origin.toLowerCase());
  if (apiBaseUrl) allowedOrigins.add(new URL(apiBaseUrl).origin.toLowerCase());
  return allowedOrigins.has(new URL(assetUrl).origin.toLowerCase()) ? assetUrl : null;
}

function canonicalSlugFromPath(path: string): string {
  return path
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.toLowerCase() ?? "";
}

function parsePositiveInt(value: string | null | undefined): number | null {
  const normalized = value?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function defaultReadWordPressDraft(input: {
  siteId: string;
  wordpressObjectId: string;
}): Promise<WordPressDraft> {
  const site = getSiteById(input.siteId);
  if (!site?.integrations.wordpressApiBaseUrl) {
    throw new Error("GA_RICH_REPAIR_WORDPRESS_AUTHORITY_REQUIRED");
  }
  const credential = resolveWordPressCredentialReference(site.integrations.wordpressCredentialReference);
  if (!credential) {
    throw new Error("GA_RICH_REPAIR_WORDPRESS_CREDENTIAL_REQUIRED");
  }

  const authority = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl: site.integrations.wordpressApiBaseUrl,
      username: credential.username,
      applicationPassword: credential.applicationPassword,
      timeoutMs: 30_000,
    },
  });

  const read = await authority.getJson({
    path: `/pages/${input.wordpressObjectId}`,
    query: new URLSearchParams({
      context: "edit",
      _fields: "id,status,slug,parent,featured_media,title,content",
    }),
  });

  if (!read.ok || !read.body || typeof read.body !== "object" || Array.isArray(read.body)) {
    throw new Error("GA_RICH_REPAIR_WORDPRESS_READ_FAILED");
  }

  return read.body as WordPressDraft;
}

const defaults: RepairDependencies = {
  buildReviewModel: buildGeneratedPageReviewModel,
  getJobById: (jobId) => glwPageExecutionRepository.getById(jobId),
  updateJob: (jobId, patch) => glwPageExecutionRepository.update(jobId, patch),
  getSiteById,
  getProductById,
  resolveApprovedProductAuthorityMedia,
  listAllTargets: listAllGlwCampaignTargets,
  readWordPressDraft: defaultReadWordPressDraft,
  writeDraft: writeGenesisWordPressDraft,
  renderRich: renderOutdoorSphereRichWordPress,
  applyTitleSuppression: applyScopedThemeTitleSuppression,
  now: () => new Date().toISOString(),
};

export async function inspectGaRichCompositionApplyRepairPreflight(
  dependencies: RepairDependencies = defaults,
): Promise<GaRichCompositionApplyRepairPreflight> {
  const model = await dependencies.buildReviewModel({
    jobId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId,
    organizationId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId,
    siteId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId,
  });
  if (!model) throw new Error("GA_RICH_REPAIR_SCOPE_NOT_FOUND");

  const job = await dependencies.getJobById(GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId);
  if (!job) throw new Error("GA_RICH_REPAIR_JOB_NOT_FOUND");

  const target = dependencies.listAllTargets().find((entry) =>
    entry.targetId === GA_RICH_COMPOSITION_REPAIR_IDENTITY.targetId
    && entry.campaignId === GA_RICH_COMPOSITION_REPAIR_IDENTITY.campaignId
    && entry.organizationId === GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId
    && entry.siteId === GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId,
  );
  if (!target) throw new Error("GA_RICH_REPAIR_TARGET_NOT_FOUND");

  if (
    model.identity.campaignId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.campaignId
    || model.identity.targetId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.targetId
    || model.trace.jobId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId
    || model.trace.externalExecutionId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.externalExecutionId
    || model.wordpress.objectId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId
    || model.wordpress.status !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressStatus
  ) {
    throw new Error("GA_RICH_REPAIR_IDENTITY_MISMATCH");
  }

  const before = await dependencies.readWordPressDraft({
    siteId: job.siteId,
    wordpressObjectId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId,
  });
  const beforeHtml = text(before.content?.raw ?? before.content?.rendered);
  const beforeHash = hash(beforeHtml);

  const canonicalPath = target.canonicalPath ?? job.slug;
  const canonicalSlug = canonicalSlugFromPath(canonicalPath);
  const expectedParentId = parsePositiveInt(target.canonicalParentId ?? null);
  const title = text(job.generatedDraft?.title ?? model.identity.title ?? job.title);

  if (
    String(before.id ?? "") !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId
    || text(before.status) !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressStatus
    || text(before.slug).toLowerCase() !== canonicalSlug
    || (expectedParentId !== null && Number(before.parent ?? 0) !== expectedParentId)
    || text(before.title?.raw ?? before.title?.rendered) !== title
  ) {
    throw new Error("GA_RICH_REPAIR_PREFLIGHT_FAILED");
  }

  return {
    operation: "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT",
    identity: {
      campaignId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.campaignId,
      targetId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.targetId,
      jobId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId,
      externalExecutionId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.externalExecutionId,
      wordpressObjectId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId,
      wordpressStatus: "draft",
    },
    currentStoredSha256: beforeHash,
    title,
    canonicalPath,
    wordpressParentId: expectedParentId,
    visualCertificationState: model.visualQa.certificationState,
  };
}

export async function executeGaRichCompositionApplyRepair(
  input: ExecuteInput,
  dependencies: RepairDependencies = defaults,
): Promise<GaRichCompositionApplyRepairResult> {
  const model = await dependencies.buildReviewModel({
    jobId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId,
    organizationId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId,
    siteId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId,
  });
  if (!model) throw new Error("GA_RICH_REPAIR_SCOPE_NOT_FOUND");

  const job = await dependencies.getJobById(GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId);
  if (!job) throw new Error("GA_RICH_REPAIR_JOB_NOT_FOUND");

  const target = dependencies.listAllTargets().find((entry) =>
    entry.targetId === GA_RICH_COMPOSITION_REPAIR_IDENTITY.targetId
    && entry.campaignId === GA_RICH_COMPOSITION_REPAIR_IDENTITY.campaignId
    && entry.organizationId === GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId
    && entry.siteId === GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId,
  );
  if (!target) throw new Error("GA_RICH_REPAIR_TARGET_NOT_FOUND");

  if (
    model.identity.campaignId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.campaignId
    || model.identity.targetId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.targetId
    || model.trace.jobId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId
    || model.trace.externalExecutionId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.externalExecutionId
    || model.wordpress.objectId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId
    || model.wordpress.status !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressStatus
  ) {
    throw new Error("GA_RICH_REPAIR_IDENTITY_MISMATCH");
  }

  if (
    job.organizationId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId
    || job.siteId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId
    || job.jobId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId
    || job.externalExecutionId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.externalExecutionId
    || job.wordpressObjectId !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId
    || job.wordpressStatus !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressStatus
  ) {
    throw new Error("GA_RICH_REPAIR_JOB_SCOPE_MISMATCH");
  }

  const site = dependencies.getSiteById(job.siteId);
  if (!site) throw new Error("GA_RICH_REPAIR_SITE_NOT_FOUND");
  const product = dependencies.getProductById(job.productId);
  if (!product?.media.primaryImageReference) throw new Error("GA_RICH_REPAIR_PRODUCT_AUTHORITY_REQUIRED");

  const productAuthority = dependencies.resolveApprovedProductAuthorityMedia({
    organizationId: model.identity.campaignId.includes("led-display-warehouse")
      ? GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId
      : job.organizationId,
    siteId: job.siteId,
    productId: job.productId,
    authorityReference: product.media.primaryImageReference,
  });
  const productAuthorityMediaUrl = resolveProductAuthorityUrl({
    authority: productAuthority,
    siteRecord: site,
  });
  if (!productAuthority || !productAuthorityMediaUrl) {
    throw new Error("GA_RICH_REPAIR_PRODUCT_AUTHORITY_MEDIA_UNRESOLVED");
  }

  const contextualMediaUrl = parseAbsoluteHttpUrl(model.images.contextualInUse.imageUrl);
  if (!contextualMediaUrl) throw new Error("GA_RICH_REPAIR_CONTEXTUAL_MEDIA_REQUIRED");

  const semanticSourceHtml = text(
    job.rawGeneratedDraft?.contentHtml
    ?? job.canonicalizedGeneratedDraft?.contentHtml
    ?? job.generatedDraft?.contentHtml
    ?? model.source.rawHtml,
  );
  const title = text(job.generatedDraft?.title ?? model.identity.title ?? job.title);
  const excerpt = text(job.generatedDraft?.excerpt ?? model.source.excerpt ?? job.metaDescription);
  if (!semanticSourceHtml || !title || !excerpt || !job.state || !job.productTopic) {
    throw new Error("GA_RICH_REPAIR_RENDER_INPUT_REQUIRED");
  }

  const before = await dependencies.readWordPressDraft({
    siteId: job.siteId,
    wordpressObjectId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId,
  });
  const beforeHtml = text(before.content?.raw ?? before.content?.rendered);
  const beforeHash = hash(beforeHtml);

  const canonicalPath = target.canonicalPath ?? job.slug;
  const canonicalSlug = canonicalSlugFromPath(canonicalPath);
  const expectedParentId = parsePositiveInt(target.canonicalParentId ?? null);

  if (
    String(before.id ?? "") !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId
    || text(before.status) !== GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressStatus
    || text(before.slug).toLowerCase() !== canonicalSlug
    || (expectedParentId !== null && Number(before.parent ?? 0) !== expectedParentId)
    || text(before.title?.raw ?? before.title?.rendered) !== title
  ) {
    throw new Error("GA_RICH_REPAIR_PREFLIGHT_FAILED");
  }

  if (beforeHash !== input.expectedStoredSha256.trim()) {
    throw new Error("GA_RICH_REPAIR_EXPECTED_HASH_MISMATCH");
  }

  const ctaUrl = model.source.internalLinks.find((link) => /contact|quote|request|planning|project/i.test(link.label))?.url
    ?? model.source.internalLinks[0]?.url
    ?? null;
  const richRender = dependencies.renderRich({
    title,
    stateName: job.state,
    productTopic: job.productTopic,
    semanticSourceHtml,
    excerpt,
    contextualMediaUrl,
    productAuthorityMediaUrl,
    productAuthorityAltText: productAuthority.metadata.altText,
    canonicalProductUrl: null,
    governedCtaUrl: ctaUrl,
  });
  if (!richRender.ok) {
    throw new Error(richRender.code);
  }

  const richSuppression = site.domain === "leddisplaywarehouse.com"
    ? dependencies.applyTitleSuppression({
        contentHtml: richRender.html,
        wordpressObjectId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId,
      })
    : null;
  const richHtml = richSuppression?.contentHtml ?? richRender.html;
  const richHash = hash(richHtml);
  const mutationPerformed = beforeHash !== richHash;

  if (mutationPerformed) {
    const update = await dependencies.writeDraft({
      operation: "UPDATE",
      site,
      wordpressObjectId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId,
      artifact: {
        title,
        slug: canonicalPath,
        excerpt,
        contentHtml: richHtml,
        parentId: expectedParentId,
      },
    });
    if (!update.ok) {
      throw new Error(`GA_RICH_REPAIR_WORDPRESS_UPDATE_FAILED:${update.state}`);
    }
  }

  const after = await dependencies.readWordPressDraft({
    siteId: job.siteId,
    wordpressObjectId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId,
  });
  const afterHtml = text(after.content?.raw ?? after.content?.rendered);
  const afterHash = hash(afterHtml);

  if (
    String(after.id ?? "") !== String(before.id ?? "")
    || text(after.status) !== text(before.status)
    || text(after.slug) !== text(before.slug)
    || Number(after.parent ?? 0) !== Number(before.parent ?? 0)
    || Number(after.featured_media ?? -1) !== Number(before.featured_media ?? -1)
    || text(after.title?.raw ?? after.title?.rendered) !== text(before.title?.raw ?? before.title?.rendered)
  ) {
    throw new Error("GA_RICH_REPAIR_READBACK_IDENTITY_MISMATCH");
  }

  const readbackHashMatchesWrittenRichHtml = afterHash === richHash;
  const legacyProductImageAbsent = !afterHtml.includes(productAuthorityMediaUrl);
  const contextualHeroPresent = /data-genesis-hero(?:=["']true["'])?/i.test(afterHtml);
  const singleH1 = (afterHtml.match(/<h1\b/gi) ?? []).length === 1;
  if (!readbackHashMatchesWrittenRichHtml || !legacyProductImageAbsent || !contextualHeroPresent || !singleH1) {
    throw new Error("GA_RICH_REPAIR_READBACK_VERIFICATION_FAILED");
  }

  if (job.generatedDraft && stripHtml(job.generatedDraft.contentHtml) !== stripHtml(richHtml)) {
    await dependencies.updateJob(job.jobId, {
      generatedDraft: {
        ...job.generatedDraft,
        contentHtml: richHtml,
      },
      updatedAt: dependencies.now(),
    });
  }

  const afterModel = await dependencies.buildReviewModel({
    jobId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId,
    organizationId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.organizationId,
    siteId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.siteId,
  });
  const contentMatch = Boolean(afterModel?.wordpress.contentMatchesSource);

  return {
    operation: "APPLY_CURRENT_RICH_COMPOSITION_TO_EXISTING_DRAFT",
    jobId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.jobId,
    targetId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.targetId,
    campaignId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.campaignId,
    wordpressObjectId: GA_RICH_COMPOSITION_REPAIR_IDENTITY.wordpressObjectId,
    wordpressStatus: "draft",
    mutationPerformed,
    accounting: {
      wordpressUpdates: mutationPerformed ? 1 : 0,
      wordpressCreates: 0,
      wordpressMutations: mutationPerformed ? 1 : 0,
      imageGenerationRequests: 0,
      n8nDispatchRequests: 0,
      publicationRequests: 0,
    },
    verification: {
      readbackHashMatchesWrittenRichHtml,
      legacyProductImageAbsent,
      contextualHeroPresent,
      singleH1,
      contentMatch,
    },
    visualCertificationStateBefore: model.visualQa.certificationState,
    visualCertificationStateAfter: afterModel?.visualQa.certificationState ?? "NOT_CERTIFIED",
    beforeHash,
    afterHash,
    richHash,
    actor: input.actor,
  };
}