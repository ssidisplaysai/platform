import { NextRequest, NextResponse } from "next/server";

import {
  getGlwCampaign,
} from "@/modules/glw/campaign-repository";

import {
  previewGlwDraftEnrichmentIntake,
  initializeGlwDraftEnrichmentIntake,
} from "@/modules/glw/campaign-enrichment-intake";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

function header(
  request: NextRequest,
  name: string,
): string {
  return request.headers
    .get(name)
    ?.trim() ?? "";
}

function requirePlatformAdmin(
  request: NextRequest,
): void {
  const roles =
    header(
      request,
      "x-gcp-roles",
    )
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);

  if (!roles.includes("platform_admin")) {
    throw new Error(
      "Platform administrator authority is required.",
    );
  }
}

function requireScope(
  request: NextRequest,
): {
  organizationId: string;
  siteId: string;
} {
  const organizationId =
    header(
      request,
      "x-gcp-organization-id",
    );

  const siteId =
    header(
      request,
      "x-gcp-site-id",
    );

  if (!organizationId || !siteId) {
    throw new Error(
      "Organization and site scope headers are required.",
    );
  }

  return {
    organizationId,
    siteId,
  };
}

function campaignConfig(
  request: NextRequest,
  campaignId: string,
) {
  requirePlatformAdmin(request);

  const scope =
    requireScope(request);

  const campaign =
    getGlwCampaign({
      campaignId,
    });

  if (!campaign) {
    throw new Error(
      "Campaign was not found.",
    );
  }

  if (
    campaign.organizationId
      !== scope.organizationId
    || campaign.siteId
      !== scope.siteId
  ) {
    throw new Error(
      "Campaign does not match the requested organization/site scope.",
    );
  }

  const siteDomain =
    header(
      request,
      "x-glw-enrichment-site-domain",
    );

  const productSlug =
    header(
      request,
      "x-glw-enrichment-product-slug",
    );

  const productTopic =
    header(
      request,
      "x-glw-enrichment-product-topic",
    );

  const upstreamAuthorityDomains =
    header(
      request,
      "x-glw-enrichment-upstream-domains",
    )
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean);

  if (
    !siteDomain
    || !productSlug
    || !productTopic
  ) {
    throw new Error(
      "Enrichment site domain, product slug, and product topic are required.",
    );
  }

  return {
    organizationId:
      scope.organizationId,
    siteId:
      scope.siteId,
    campaignId:
      campaign.campaignId,
    productId:
      campaign.productId,
    productSlug,
    productTopic,
    siteDomain,
    upstreamAuthorityDomains,
  };
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { campaignId } =
      await context.params;

    const config =
      campaignConfig(
        request,
        campaignId,
      );

    const preview =
      previewGlwDraftEnrichmentIntake(
        config,
      );

    return NextResponse.json({
      ok: true,
      mode: "preview",
      ...preview,
      wordpressMutationPerformed:
        false,
      generationPerformed:
        false,
      publicationPerformed:
        false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Draft enrichment intake preview failed.",
      },
      {
        status: 400,
      },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const body =
      await request.json();

    if (
      body?.confirm
      !== "INITIALIZE_DRAFT_ENRICHMENT"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Exact confirmation INITIALIZE_DRAFT_ENRICHMENT is required.",
        },
        {
          status: 400,
        },
      );
    }

    const { campaignId } =
      await context.params;

    const config =
      campaignConfig(
        request,
        campaignId,
      );

    const result =
      initializeGlwDraftEnrichmentIntake(
        config,
      );

    return NextResponse.json({
      ok: true,
      mode: "initialize",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Draft enrichment intake failed.",
      },
      {
        status: 400,
      },
    );
  }
}