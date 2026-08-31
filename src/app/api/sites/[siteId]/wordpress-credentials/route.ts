import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  getSiteById,
  updateSite,
} from "@/modules/foundation/site-repository";
import {
  hasStoredWordPressCredential,
  storeWordPressCredential,
} from "@/modules/foundation/wordpress-credential-store";

type RouteContext = {
  params: Promise<{
    siteId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = authorizeRequest(
    request,
    "sites:read",
  );

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const scope = resolveRequestScope(request);

  if (!hasOrganizationScope(scope)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (
    !site ||
    !isRecordInScope({
      recordOrganizationId: site.organizationId,
      recordSiteId: site.siteId,
      scope,
    })
  ) {
    return NextResponse.json(
      { error: "Site not found" },
      { status: 404 },
    );
  }

  const reference =
    site.integrations.wordpressCredentialReference;

  return NextResponse.json({
    configured:
      hasStoredWordPressCredential(reference) ||
      Boolean(reference),
    managedByGenesis:
      hasStoredWordPressCredential(reference),
  });
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  const auth = authorizeRequest(
    request,
    "sites:update",
  );

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const scope = resolveRequestScope(request);

  if (!hasOrganizationScope(scope)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    );
  }

  const { siteId } = await context.params;
  const site = getSiteById(siteId);

  if (
    !site ||
    !isRecordInScope({
      recordOrganizationId: site.organizationId,
      recordSiteId: site.siteId,
      scope,
    })
  ) {
    return NextResponse.json(
      { error: "Site not found" },
      { status: 404 },
    );
  }

  const body = (await request.json()) as {
    username?: unknown;
    applicationPassword?: unknown;
  };

  if (
    typeof body.username !== "string" ||
    typeof body.applicationPassword !== "string" ||
    !body.username.trim() ||
    !body.applicationPassword.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "WordPress username and application password are required.",
      },
      { status: 400 },
    );
  }

  try {
    const stored = storeWordPressCredential({
      organizationId: site.organizationId,
      siteId: site.siteId,
      username: body.username,
      applicationPassword:
        body.applicationPassword,
      existingReference:
        site.integrations.wordpressCredentialReference,
    });

    const updated = updateSite(site.siteId, {
      integrations: {
        ...site.integrations,
        wordpressCredentialReference:
          stored.reference,
      },
    });

    if (!updated.site) {
      return NextResponse.json(
        {
          error:
            "Credential was stored but the site reference could not be updated.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      configured: true,
      managedByGenesis: true,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Genesis could not securely store the WordPress credentials.",
      },
      { status: 500 },
    );
  }
}