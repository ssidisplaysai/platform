import "server-only";

import { evaluateSiteReadiness } from "./site-readiness";
import type {
  PermissionAction,
  SiteConfiguration,
  SiteReadinessResult,
} from "./types";
import type {
  WordPressEstateReadResult,
  WordPressEstateReader,
} from "./wordpress-estate-reader";

export type FreshSiteCompletionState =
  | "SITE_CONNECTED"
  | "SITE_CONFIGURING"
  | "SITE_READY_FOR_PRODUCT_ONBOARDING"
  | "SITE_READY_FOR_CAMPAIGNS";

export type FreshSiteInventory = {
  pages: number;
  posts: number;
  media: number;
  categories: number;
  tags: number;
  productCount: 0;
  urls: string[];
  emptyContentAccepted: boolean;
};

export type IntegrationRequirement = {
  key: "wordpress_rest" | "authenticated_reads" | "media" | "seo" | "page_builder" | "publishing";
  label: string;
  status: "READY" | "MISSING" | "OPTIONAL" | "NOT_REQUIRED";
  details: string;
};

export type WordPressOperatorCapabilities = {
  editPosts: boolean;
  uploadFiles: boolean;
  publishPosts: boolean;
};

export function readWordPressOperatorCapabilities(body: unknown): WordPressOperatorCapabilities {
  const capabilities = body
    && typeof body === "object"
    && !Array.isArray(body)
    && (body as { capabilities?: unknown }).capabilities
    && typeof (body as { capabilities?: unknown }).capabilities === "object"
      ? (body as { capabilities: Record<string, unknown> }).capabilities
      : {};

  return {
    editPosts: capabilities.edit_posts === true,
    uploadFiles: capabilities.upload_files === true,
    publishPosts: capabilities.publish_posts === true,
  };
}

function count(result: WordPressEstateReadResult): number {
  if (!result.ok) return 0;
  return result.collection.total ?? result.collection.objects.length;
}

function urls(result: WordPressEstateReadResult): string[] {
  if (!result.ok) return [];
  return result.collection.objects
    .map((object) => object.link)
    .filter((link): link is string => Boolean(link))
    .slice(0, 20);
}

export async function inspectFreshWordPressSite(input: {
  site: SiteConfiguration;
  reader: WordPressEstateReader;
  organizationActive: boolean;
  permissions: Set<PermissionAction>;
  capabilities?: WordPressOperatorCapabilities;
}): Promise<{
  inventory: FreshSiteInventory;
  requirements: IntegrationRequirement[];
  readiness: SiteReadinessResult;
  completionState: FreshSiteCompletionState;
  complexity: "LOW" | "MODERATE";
  effort: "LOW" | "MODERATE";
}> {
  const [pages, posts, media, types, categories, tags] = await Promise.all([
    input.reader.readPages(),
    input.reader.readPosts(),
    input.reader.readMedia(),
    input.reader.readPostTypes(),
    input.reader.readCategories(),
    input.reader.readTags(),
  ]);
  const coreReadsReady = pages.ok && posts.ok && media.ok;
  const inventory: FreshSiteInventory = {
    pages: count(pages),
    posts: count(posts),
    media: count(media),
    categories: count(categories),
    tags: count(tags),
    productCount: 0,
    urls: [...urls(pages), ...urls(posts)].slice(0, 20),
    emptyContentAccepted: coreReadsReady,
  };
  const profilesReady = Boolean(
    input.site.profiles.promptProfileReference
    && input.site.profiles.imageProfileReference
    && input.site.profiles.seoProfileReference
    && input.site.profiles.brandProfileReference,
  );
  const configurationReady = Boolean(
    input.site.integrations.workflowReference
    && profilesReady
    && input.site.publicationPolicy === "draft_only",
  );
  const connected = input.site.onboarding?.status === "connected" && coreReadsReady;
  const readiness = evaluateSiteReadiness({
    site: input.site,
    organizationActive: input.organizationActive,
    requiredPermission: "sites:manage_integrations",
    permissions: input.permissions,
    intent: "configure",
    requireWorkflowReference: true,
  });
  const completionState: FreshSiteCompletionState = connected
    ? configurationReady
      ? "SITE_READY_FOR_PRODUCT_ONBOARDING"
      : "SITE_CONFIGURING"
    : "SITE_CONNECTED";
  const contentVolume = inventory.pages + inventory.posts + inventory.media;
  const lowComplexity = coreReadsReady && contentVolume <= 20;

  return {
    inventory,
    readiness,
    completionState,
    complexity: lowComplexity ? "LOW" : "MODERATE",
    effort: lowComplexity ? "LOW" : "MODERATE",
    requirements: [
      { key: "wordpress_rest", label: "WordPress REST API", status: coreReadsReady ? "READY" : "MISSING", details: coreReadsReady ? "Core REST collections are readable." : "One or more core REST collections could not be read." },
      { key: "authenticated_reads", label: "Authenticated reads", status: connected ? "READY" : "MISSING", details: connected ? "Application Password identity is valid." : "Authenticated identity has not been verified." },
      { key: "media", label: "Media library", status: media.ok ? "READY" : "MISSING", details: media.ok ? "Media is readable; an empty library is allowed." : "Media REST access is unavailable." },
      { key: "seo", label: "SEO integration", status: input.site.profiles.seoProfileReference ? "READY" : "OPTIONAL", details: input.site.profiles.seoProfileReference ? "SEO profile selected." : "Select an SEO profile before campaign readiness." },
      { key: "page_builder", label: "Page builder", status: "NOT_REQUIRED", details: types.ok ? "Fresh onboarding does not require a page builder." : "Post-type inspection was unavailable; no builder is required for V1." },
      {
        key: "publishing",
        label: "Publishing authority",
        status: input.capabilities?.editPosts && input.capabilities.uploadFiles ? "READY" : "OPTIONAL",
        details: input.capabilities?.editPosts && input.capabilities.uploadFiles
          ? `Edit and media capabilities detected without writing content. Publish capability: ${input.capabilities.publishPosts ? "available" : "not granted"}.`
          : "No write was attempted. Publishing remains disabled during onboarding.",
      },
    ],
  };
}