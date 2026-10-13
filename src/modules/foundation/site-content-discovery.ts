import "server-only";

import {
  createAuthenticatedWordPressReadAuthority,
} from "./authenticated-wordpress-read-authority";
import {
  resolveWordPressCredentialReference,
} from "./wordpress-credential-resolver";
import type {
  SiteConfiguration,
} from "./types";

type WordPressRenderedField = {
  rendered?: unknown;
};

type WordPressPageRecord = {
  id?: unknown;
  slug?: unknown;
  link?: unknown;
  status?: unknown;
  title?: WordPressRenderedField;
  excerpt?: WordPressRenderedField;
  content?: WordPressRenderedField;
};

export type SiteContentDiscoveryCandidate = {
  wordpressPageId: number;
  title: string;
  slug: string;
  sourceUrl: string;
  status: string;
  classification: "product_or_service" | "possible_product_or_service";
  confidence: "high" | "medium";
  evidence: readonly string[];
};

export type SiteContentDiscoveryResult =
  | {
      ok: true;
      siteId: string;
      siteName: string;
      scannedPageCount: number;
      candidateCount: number;
      candidates: readonly SiteContentDiscoveryCandidate[];
      truncated: boolean;
      discoveredAt: string;
    }
  | {
      ok: false;
      siteId: string;
      message: string;
      reason:
        | "not_configured"
        | "credential_unavailable"
        | "read_failed"
        | "malformed_response";
      discoveredAt: string;
    };

const PAGE_SIZE = 100;
const MAX_PAGES = 300;

const EXCLUDED_SLUGS = new Set([
  "",
  "home",
  "about",
  "about-us",
  "contact",
  "contact-us",
  "blog",
  "news",
  "privacy-policy",
  "privacy",
  "terms",
  "terms-of-service",
  "thank-you",
  "cart",
  "checkout",
  "my-account",
  "account",
  "sitemap",
  "genesis-site-connection-test",
]);

const PRODUCT_SERVICE_TERMS = [
  "led",
  "display",
  "video wall",
  "sphere",
  "digital signage",
  "oled",
  "transparent oled",
  "projection",
  "projector",
  "enclosure",
  "kiosk",
  "touch",
  "interactive",
  "monitor",
  "screen",
  "film",
  "dvled",
  "direct view",
  "outdoor",
  "indoor",
  "rental",
  "service",
  "installation",
  "integration",
  "solution",
  "product",
];

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function rendered(value: WordPressRenderedField | undefined): string {
  return text(value?.rendered)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSlug(value: unknown): string {
  return text(value).toLowerCase();
}

function scoreCandidate(page: WordPressPageRecord): {
  score: number;
  evidence: string[];
} {
  const title = rendered(page.title);
  const excerpt = rendered(page.excerpt);
  const content = rendered(page.content).slice(0, 4000);
  const slug = normalizeSlug(page.slug);

  const searchable =
    `${title} ${slug.replace(/-/g, " ")} ${excerpt} ${content}`
      .toLowerCase();

  let score = 0;
  const evidence: string[] = [];

  for (const term of PRODUCT_SERVICE_TERMS) {
    if (!searchable.includes(term)) {
      continue;
    }

    if (
      title.toLowerCase().includes(term) ||
      slug.replace(/-/g, " ").includes(term)
    ) {
      score += 3;
      evidence.push(`Title or slug contains "${term}"`);
    } else {
      score += 1;
      evidence.push(`Page content contains "${term}"`);
    }

    if (evidence.length >= 4) {
      break;
    }
  }

  if (
    /\b(product|products|service|services|solution|solutions)\b/i.test(
      `${title} ${slug.replace(/-/g, " ")}`,
    )
  ) {
    score += 2;
    evidence.push("Title or slug uses product/service language");
  }

  return {
    score,
    evidence: [...new Set(evidence)].slice(0, 4),
  };
}

function candidateFromPage(
  page: WordPressPageRecord,
): SiteContentDiscoveryCandidate | null {
  const wordpressPageId =
    typeof page.id === "number"
      ? page.id
      : Number(page.id);

  const title = rendered(page.title);
  const slug = normalizeSlug(page.slug);
  const sourceUrl = text(page.link);
  const status = text(page.status) || "unknown";

  if (
    !Number.isFinite(wordpressPageId) ||
    wordpressPageId <= 0 ||
    !title ||
    !slug ||
    !sourceUrl ||
    EXCLUDED_SLUGS.has(slug)
  ) {
    return null;
  }

  const scored = scoreCandidate(page);

  if (scored.score < 3) {
    return null;
  }

  return {
    wordpressPageId,
    title,
    slug,
    sourceUrl,
    status,
    classification:
      scored.score >= 6
        ? "product_or_service"
        : "possible_product_or_service",
    confidence:
      scored.score >= 6
        ? "high"
        : "medium",
    evidence: scored.evidence,
  };
}

export async function discoverSiteContent(
  site: SiteConfiguration,
): Promise<SiteContentDiscoveryResult> {
  const discoveredAt = new Date().toISOString();

  const wordpressApiBaseUrl =
    site.integrations.wordpressApiBaseUrl?.trim() ?? "";

  const wordpressCredentialReference =
    site.integrations.wordpressCredentialReference?.trim() ?? "";

  if (!wordpressApiBaseUrl || !wordpressCredentialReference) {
    return {
      ok: false,
      siteId: site.siteId,
      message: "WordPress discovery is not configured for this site.",
      reason: "not_configured",
      discoveredAt,
    };
  }

  const credential = resolveWordPressCredentialReference(
    wordpressCredentialReference,
  );

  if (!credential) {
    return {
      ok: false,
      siteId: site.siteId,
      message: "The site's WordPress credential could not be resolved.",
      reason: "credential_unavailable",
      discoveredAt,
    };
  }

  const authority = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl: wordpressApiBaseUrl,
      username: credential.username,
      applicationPassword: credential.applicationPassword,
      timeoutMs: 30_000,
    },
  });

  const discoveredPages: WordPressPageRecord[] = [];
  let pageNumber = 1;
  let truncated = false;

  while (discoveredPages.length < MAX_PAGES) {
    const remaining = MAX_PAGES - discoveredPages.length;
    const perPage = Math.min(PAGE_SIZE, remaining);

    const query = new URLSearchParams({
      context: "edit",
      status: "publish,draft,pending,private,future",
      per_page: String(perPage),
      page: String(pageNumber),
      orderby: "id",
      order: "asc",
      _fields: "id,slug,link,status,title,excerpt,content",
    });

    const read = await authority.getJson({
      path: "/pages",
      query,
    });

    if (!read.ok) {
      /*
       * WordPress returns an invalid-page response after the final
       * page on some installations. Once at least one page has been
       * collected, treat a later failed page as the end of inventory.
       */
      if (pageNumber > 1 && discoveredPages.length > 0) {
        break;
      }

      return {
        ok: false,
        siteId: site.siteId,
        message: "Genesis could not read the WordPress page inventory.",
        reason: "read_failed",
        discoveredAt,
      };
    }

    if (!Array.isArray(read.body)) {
      return {
        ok: false,
        siteId: site.siteId,
        message: "WordPress returned an unexpected page inventory.",
        reason: "malformed_response",
        discoveredAt,
      };
    }

    const batch = read.body as WordPressPageRecord[];

    discoveredPages.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    if (discoveredPages.length >= MAX_PAGES) {
      truncated = true;
      break;
    }

    pageNumber += 1;
  }

  const candidates = discoveredPages
    .map(candidateFromPage)
    .filter(
      (
        candidate,
      ): candidate is SiteContentDiscoveryCandidate =>
        candidate !== null,
    )
    .sort((left, right) => {
      if (left.confidence !== right.confidence) {
        return left.confidence === "high" ? -1 : 1;
      }

      return left.title.localeCompare(right.title);
    });

  return {
    ok: true,
    siteId: site.siteId,
    siteName: site.displayName,
    scannedPageCount: discoveredPages.length,
    candidateCount: candidates.length,
    candidates,
    truncated,
    discoveredAt,
  };
}