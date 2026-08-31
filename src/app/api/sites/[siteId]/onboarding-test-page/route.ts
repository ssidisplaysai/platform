import { NextResponse } from "next/server";
import { getSiteById, updateSite } from "@/modules/foundation/site-repository";
import { publishGenesisTestPage } from "@/modules/foundation/wordpress-onboarding-publisher";

export async function POST(
  request: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const roles = request.headers.get("x-gcp-roles") ?? "";
  const organizationId = request.headers.get("x-gcp-organization-id");
  const requestedSiteId = request.headers.get("x-gcp-site-id");

  if (!roles.split(",").map((value) => value.trim()).includes("ops_manager")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (!site) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  if (
    organizationId !== site.organizationId ||
    requestedSiteId !== site.siteId
  ) {
    return NextResponse.json({ error: "Site scope mismatch." }, { status: 403 });
  }

  const result = await publishGenesisTestPage(site);

  if (!result.ok) {
    return NextResponse.json({ result }, { status: 502 });
  }

  const certifiedAt = new Date().toISOString();

  const persisted = updateSite(site.siteId, {
    onboarding: {
      status: "certified",
      wordpressConnectionVerifiedAt:
        site.onboarding?.wordpressConnectionVerifiedAt ?? certifiedAt,
      certificationStatus: "certified",
      certificationPageId: result.wordpressObjectId,
      certificationUrl: result.url,
      certifiedAt,
    },
  });

  if (!persisted.validation.valid || !persisted.site) {
    return NextResponse.json(
      {
        error:
          "Genesis certified the WordPress site but could not persist the certification state.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    result,
    onboarding: persisted.site.onboarding,
  });
}