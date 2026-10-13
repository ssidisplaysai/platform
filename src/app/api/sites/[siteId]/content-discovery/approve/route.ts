import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  createProduct,
  getProductById,
} from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import type {
  NewProductInput,
  ProductSiteAssignment,
} from "@/modules/foundation/types";

type ApprovalCandidate = {
  wordpressPageId: number;
  title: string;
  slug: string;
  sourceUrl: string;
  status: string;
  classification:
    | "product_or_service"
    | "possible_product_or_service";
  confidence: "high" | "medium";
  evidence: readonly string[];
  categoryIds: readonly string[];
};

type ApprovalRequest = {
  candidates?: ApprovalCandidate[];
};

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createDiscoverySku(
  siteId: string,
  wordpressPageId: number,
): string {
  const siteToken = siteId
    .replace(/^site-/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .toUpperCase()
    .slice(0, 24);

  return `WP-${siteToken}-${wordpressPageId}`;
}

function createSiteAssignment(
  siteId: string,
  candidate: ApprovalCandidate,
): ProductSiteAssignment {
  return {
    siteId,
    enabledForSite: true,
    siteSpecificSlug: candidate.slug,
    siteSpecificDisplayName: candidate.title,
    siteSpecificShortDescription: null,
    visibility: "internal",
    featured: false,
    sortOrder: 0,
    categoryIds: candidate.categoryIds,
    defaultContentType: "product",
    publicationStatus: "draft",
    seoProfileReference: null,
    promptProfileReference: null,
    imageProfileReference: null,
    pricingDisplayMode: "hidden",
    lastReadinessEvaluation: null,
    lastPublicationReference: null,
  };
}

function createInput(
  organizationId: string,
  siteId: string,
  candidate: ApprovalCandidate,
): NewProductInput {
  const slug = normalizeSlug(candidate.slug);

  return {
    organizationId,
    productName: candidate.title,
    displayName: candidate.title,
    slug,
    sku: createDiscoverySku(
      siteId,
      candidate.wordpressPageId,
    ),
    modelNumber: null,
    shortDescription: null,
    fullDescription: null,
    productType: null,
    productFamily: null,
    categoryIds: candidate.categoryIds,
    manufacturerId: null,
    brandReference: null,
    primarySiteId: siteId,
    assignedSiteIds: [siteId],
    siteAssignments: [
      createSiteAssignment(siteId, {
        ...candidate,
        slug,
      }),
    ],
    media: {
      primaryImageReference: null,
      galleryImageReferences: [],
      videoReferences: [],
    },
    documents: {
      technicalDrawingReferences: [],
      specSheetReferences: [],
      brochureReferences: [],
      manualReferences: [],
      installationGuideReferences: [],
      warrantyDocumentReferences: [],
    },
    specifications: [],
    seoProfileReference: null,
    promptProfileReference: null,
    businessGenomeObjectReference: null,
    sourceEvidenceReference:
      `wordpress-page:${candidate.wordpressPageId}:${candidate.sourceUrl}`,
    notes:
      `Approved from Genesis site content discovery. WordPress page ${candidate.wordpressPageId}. Confidence: ${candidate.confidence}.`,
  };
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      siteId: string;
    }>;
  },
) {
  const auth = authorizeRequest(
    request,
    "products:create",
  );

  if (!auth.ok) {
    return NextResponse.json(
      {
        error: auth.error,
      },
      {
        status: auth.status,
      },
    );
  }

  const scope = resolveRequestScope(request);

  if (!hasOrganizationScope(scope)) {
    return NextResponse.json(
      {
        error: "Forbidden",
      },
      {
        status: 403,
      },
    );
  }

  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (!site) {
    return NextResponse.json(
      {
        error: "Site not found.",
      },
      {
        status: 404,
      },
    );
  }

  if (
    site.organizationId !== scope.organizationId
  ) {
    return NextResponse.json(
      {
        error: "Forbidden",
      },
      {
        status: 403,
      },
    );
  }

  if (
    scope.siteId &&
    scope.siteId !== siteId
  ) {
    return NextResponse.json(
      {
        error: "Forbidden",
      },
      {
        status: 403,
      },
    );
  }

  const body =
    (await request.json()) as ApprovalRequest;

  const candidates =
    Array.isArray(body.candidates)
      ? body.candidates
      : [];

  if (candidates.length === 0) {
    return NextResponse.json(
      {
        error:
          "Select at least one discovered product or service.",
      },
      {
        status: 400,
      },
    );
  }

  if (candidates.length > 100) {
    return NextResponse.json(
      {
        error:
          "Approve no more than 100 candidates at one time.",
      },
      {
        status: 400,
      },
    );
  }

  const created: Array<{
    productId: string;
    title: string;
  }> = [];

  const rejected: Array<{
    wordpressPageId: number;
    title: string;
    issues: readonly {
      field: string;
      message: string;
    }[];
  }> = [];

  for (const candidate of candidates) {

    if (
      !candidate ||
      !Number.isFinite(
        candidate.wordpressPageId,
      ) ||
      candidate.wordpressPageId <= 0 ||
      !candidate.title?.trim() ||
      !candidate.slug?.trim() ||
      !candidate.sourceUrl?.trim()
    ) {
      rejected.push({
        wordpressPageId:
          candidate?.wordpressPageId ?? 0,
        title:
          candidate?.title ??
          "Unknown candidate",
        issues: [
          {
            field: "candidate",
            message:
              "Discovery candidate is incomplete.",
          },
        ],
      });

      continue;
    }

    const normalizedSlug =
      normalizeSlug(candidate.slug);

    if (!normalizedSlug) {
      rejected.push({
        wordpressPageId:
          candidate.wordpressPageId,
        title: candidate.title,
        issues: [
          {
            field: "slug",
            message:
              "Discovery candidate does not contain a usable slug.",
          },
        ],
      });

      continue;
    }

    const expectedProductId =
      `prod-${site.organizationId}-${normalizedSlug}`;

    const existing =
      getProductById(expectedProductId);

    if (existing) {

      if (
        existing.organizationId ===
          site.organizationId &&
        existing.assignedSiteIds.includes(siteId)
      ) {
        created.push({
          productId: existing.productId,
          title: existing.displayName,
        });

        continue;
      }

      rejected.push({
        wordpressPageId:
          candidate.wordpressPageId,
        title: candidate.title,
        issues: [
          {
            field: "slug",
            message:
              "A canonical product with this slug already exists but is not assigned to this site.",
          },
        ],
      });

      continue;
    }

    if (
      !Array.isArray(candidate.categoryIds) ||
      candidate.categoryIds.length === 0
    ) {
      rejected.push({
        wordpressPageId:
          candidate.wordpressPageId,
        title: candidate.title,
        issues: [
          {
            field: "categoryIds",
            message:
              "Select at least one category before approval.",
          },
        ],
      });

      continue;
    }

    const result = createProduct(
      createInput(
        site.organizationId,
        siteId,
        {
          ...candidate,
          slug: normalizedSlug,
        },
      ),
    );

    if (
      !result.validation.valid ||
      !result.product
    ) {
      rejected.push({
        wordpressPageId:
          candidate.wordpressPageId,
        title: candidate.title,
        issues: result.validation.issues,
      });

      continue;
    }

    created.push({
      productId: result.product.productId,
      title: result.product.displayName,
    });
  }

  return NextResponse.json({
    ok: rejected.length === 0,
    siteId,
    createdCount: created.length,
    rejectedCount: rejected.length,
    created,
    rejected,
  });
}