import "server-only";

import { createAuthenticatedWordPressReadAuthority } from "./authenticated-wordpress-read-authority";
import { resolveWordPressCredentialReference } from "./wordpress-credential-resolver";
import type { ProductConfiguration, SiteConfiguration } from "./types";

export type SiteStudioLinkCandidate = {
  kind: "canonical_product" | "related_product" | "supporting_reference";
  url: string;
  anchorText: string;
  source: "PRODUCT_INTELLIGENCE";
  destinationValid: boolean;
  external: boolean;
};

export type SiteStudioMediaCandidate = {
  wordpressMediaId: number;
  url: string;
  altText: string;
  provenance: "PRODUCT_INTELLIGENCE";
  exactProductMatch: boolean;
  destinationValid: boolean;
};

export type SiteStudioProductAuthority = {
  lookupResult: "EXACT_MATCH";
  productId: string;
  productName: string;
  productFamily: string | null;
  categoryIds: readonly string[];
  specifications: ProductConfiguration["specifications"];
  canonicalProduct: SiteStudioLinkCandidate | null;
  internalLinkCandidates: readonly SiteStudioLinkCandidate[];
  externalReferenceCandidates: readonly SiteStudioLinkCandidate[];
  selectedInternalLinks: readonly SiteStudioLinkCandidate[];
  selectedExternalReferences: readonly SiteStudioLinkCandidate[];
  mediaCandidates: readonly SiteStudioMediaCandidate[];
  selectedMedia: SiteStudioMediaCandidate | null;
  generatedMediaReason: string | null;
};

function sourceUrl(product: ProductConfiguration): URL | null {
  const match = product.sourceEvidenceReference?.match(/^wordpress-page:\d+:(https:\/\/.+)$/);
  if (!match) return null;
  try {
    return new URL(match[1]);
  } catch {
    return null;
  }
}

function sourcePageId(product: ProductConfiguration): number | null {
  const match = product.sourceEvidenceReference?.match(/^wordpress-page:(\d+):https:\/\//);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function wordpressId(reference: string | null): number | null {
  const match = reference?.match(/^wordpress-media:(\d+)$/);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function sameSite(url: URL, site: SiteConfiguration): boolean {
  return url.hostname.replace(/^www\./, "") === (site.domain ?? "").replace(/^www\./, "");
}
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function validPublicUrl(url: URL): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const finalUrl = new URL(response.url);
    return response.ok && finalUrl.hostname === url.hostname && finalUrl.pathname === url.pathname;
  } catch {
    return false;
  }
}

export async function resolveSiteStudioProductAuthority(input: {
  site: SiteConfiguration;
  product: ProductConfiguration;
  products: readonly ProductConfiguration[];
}): Promise<SiteStudioProductAuthority> {
  const credential = resolveWordPressCredentialReference(input.site.integrations.wordpressCredentialReference);
  const authority = credential && input.site.integrations.wordpressApiBaseUrl
    ? createAuthenticatedWordPressReadAuthority({
        configuration: {
          apiBaseUrl: input.site.integrations.wordpressApiBaseUrl,
          username: credential.username,
          applicationPassword: credential.applicationPassword,
          timeoutMs: 30_000,
        },
      })
    : null;
  const canonicalUrl = sourceUrl(input.product);
  const canonicalPageId = sourcePageId(input.product);
  const canonicalRead = authority && canonicalPageId
    ? await authority.getJson({
        path: `/pages/${canonicalPageId}`,
        query: new URLSearchParams({ context: "edit", _fields: "id,status,link,content" }),
      })
    : null;
  const canonicalPage = canonicalRead?.ok && canonicalRead.body && typeof canonicalRead.body === "object" && !Array.isArray(canonicalRead.body)
    ? canonicalRead.body as { id?: number; status?: string; link?: string; content?: { raw?: string } }
    : null;
  const canonicalValid = Boolean(
    canonicalUrl
    && sameSite(canonicalUrl, input.site)
    && ((
      canonicalPage?.id === canonicalPageId
      && canonicalPage.status === "publish"
      && canonicalPage.link === canonicalUrl.toString()
    ) || await validPublicUrl(canonicalUrl)),
  );
  const canonicalProduct: SiteStudioLinkCandidate | null = canonicalUrl && canonicalValid
    ? {
        kind: "canonical_product",
        url: canonicalUrl.toString(),
        anchorText: input.product.productName,
        source: "PRODUCT_INTELLIGENCE",
        destinationValid: true,
        external: false,
      }
    : null;

  const related = (await Promise.all(input.products
    .filter((candidate) =>
      candidate.productId !== input.product.productId
      && candidate.organizationId === input.product.organizationId
      && candidate.enabled
      && candidate.assignedSiteIds.includes(input.site.siteId)
      && candidate.categoryIds.some((categoryId) => input.product.categoryIds.includes(categoryId)),
    )
    .map(async (candidate): Promise<SiteStudioLinkCandidate | null> => {
      const url = sourceUrl(candidate);
      if (!url || !sameSite(url, input.site) || !await validPublicUrl(url)) return null;
      return {
        kind: "related_product" as const,
        url: url.toString(),
        anchorText: candidate.productName,
        source: "PRODUCT_INTELLIGENCE" as const,
        destinationValid: true,
        external: false,
      };
    }))).filter((candidate): candidate is SiteStudioLinkCandidate => Boolean(candidate));

  const supportingReferences = [
    ...input.product.documents.specSheetReferences,
    ...input.product.documents.brochureReferences,
    ...input.product.documents.installationGuideReferences,
    ...input.product.specifications.map((specification) => specification.evidenceReference).filter((value): value is string => Boolean(value)),
  ];
  const sourceLinks = [...(canonicalPage?.content?.raw ?? "").matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      url: match[1],
      anchorText: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }))
    .filter((candidate) => /^https:\/\//i.test(candidate.url));
  supportingReferences.push(...sourceLinks.map((candidate) => candidate.url));
  const uniqueSupporting = [...new Set(supportingReferences)];
  const referenceCandidates = (await Promise.all(uniqueSupporting.map(async (reference): Promise<SiteStudioLinkCandidate | null> => {
    try {
      const url = new URL(reference);
      if (canonicalUrl && url.toString() === canonicalUrl.toString()) return null;
      const destinationValid = await validPublicUrl(url);
      if (!destinationValid) return null;
      const sourceLink = sourceLinks.find((candidate) => candidate.url === reference);
      const relatedProduct = input.products.find((candidate) => sourceUrl(candidate)?.toString() === url.toString());
      return {
        kind: relatedProduct ? "related_product" as const : "supporting_reference" as const,
        url: url.toString(),
        anchorText: relatedProduct?.productName || sourceLink?.anchorText || "supporting product reference",
        source: "PRODUCT_INTELLIGENCE" as const,
        destinationValid,
        external: !sameSite(url, input.site),
      };
    } catch {
      return null;
    }
  }))).filter((candidate): candidate is SiteStudioLinkCandidate => Boolean(candidate));

  const mediaId = wordpressId(input.product.media.primaryImageReference);
  let selectedMedia: SiteStudioMediaCandidate | null = null;
  if (authority && mediaId) {
    const read = await authority.getJson({
      path: `/media/${mediaId}`,
      query: new URLSearchParams({ context: "edit", _fields: "id,media_type,source_url,alt_text" }),
    });
    if (read.ok && read.body && typeof read.body === "object" && !Array.isArray(read.body)) {
      const media = read.body as { id?: number; media_type?: string; source_url?: string; alt_text?: string };
      let mediaUrl: URL | null = null;
      try {
        mediaUrl = typeof media.source_url === "string" ? new URL(media.source_url) : null;
      } catch {
        mediaUrl = null;
      }
      if (media.id === mediaId && media.media_type === "image" && mediaUrl && sameSite(mediaUrl, input.site)) {
        selectedMedia = {
          wordpressMediaId: mediaId,
          url: mediaUrl.toString(),
          altText: media.alt_text?.trim() || input.product.productName,
          provenance: "PRODUCT_INTELLIGENCE",
          exactProductMatch: true,
          destinationValid: true,
        };
      }
    }
  }

  const internalLinkCandidates = [canonicalProduct, ...related, ...referenceCandidates.filter((candidate) => !candidate.external)]
    .filter((candidate): candidate is SiteStudioLinkCandidate => Boolean(candidate));
  const externalReferenceCandidates = referenceCandidates.filter((candidate) => candidate.external);

  return {
    lookupResult: "EXACT_MATCH",
    productId: input.product.productId,
    productName: input.product.productName,
    productFamily: input.product.productFamily,
    categoryIds: input.product.categoryIds,
    specifications: input.product.specifications,
    canonicalProduct,
    internalLinkCandidates,
    externalReferenceCandidates,
    selectedInternalLinks: canonicalProduct ? [canonicalProduct] : [],
    selectedExternalReferences: [],
    mediaCandidates: selectedMedia ? [selectedMedia] : [],
    selectedMedia,
    generatedMediaReason: selectedMedia ? null : "No validated exact-product destination media was available.",
  };
}

export function renderSiteStudioAuthorityLinks(input: {
  html: string;
  authority: SiteStudioProductAuthority;
}): { html: string; rendered: readonly SiteStudioLinkCandidate[] } {
  const selected = input.authority.selectedInternalLinks;
  if (selected.length === 0) return { html: input.html, rendered: [] };
  const canonical = selected[0];
  if (input.html.includes(`href="${canonical.url}"`) || input.html.includes(`href='${canonical.url}'`)) {
    return { html: input.html, rendered: [canonical] };
  }
  const sentence = `<p>For product details and supporting specifications, review <a href="${escapeHtml(canonical.url)}">${escapeHtml(canonical.anchorText)}</a>.</p>`;
  const firstParagraph = input.html.match(/<p\b[^>]*>[\s\S]*?<\/p>/i);
  if (!firstParagraph || typeof firstParagraph.index !== "number") {
    return { html: `${sentence}\n${input.html}`, rendered: [canonical] };
  }
  const end = firstParagraph.index + firstParagraph[0].length;
  return {
    html: `${input.html.slice(0, end)}\n${sentence}${input.html.slice(end)}`,
    rendered: [canonical],
  };
}