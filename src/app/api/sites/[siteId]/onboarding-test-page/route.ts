import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getSiteById, updateSite } from "@/modules/foundation/site-repository";
import { publishGenesisTestPage } from "@/modules/foundation/wordpress-onboarding-publisher";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = authorizeRequest(request, "sites:update");
  const scope = resolveRequestScope(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (!site) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  if (
    scope.organizationId !== site.organizationId ||
    scope.siteId !== site.siteId
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