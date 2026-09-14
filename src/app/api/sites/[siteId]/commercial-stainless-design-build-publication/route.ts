import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import {
  certifyDesignBuild,
  DESIGN_BUILD_APPROVED_HASH,
  DESIGN_BUILD_APPROVED_REVISION,
  DESIGN_BUILD_PUBLICATION_OPERATION,
  listDesignBuildPublicationReceipts,
  publishDesignBuild,
  recoverDesignBuildPublication,
  summarizeDesignBuildPublicationReceipt,
  type DesignBuildViewport,
} from "@/modules/foundation/commercial-stainless-design-build-publication";
import { getSiteById } from "@/modules/foundation/site-repository";
type Context = { params: Promise<{ siteId: string }> };
async function scoped(request: NextRequest, context: Context) {
  const scope = resolveRequestScope(request),
    { siteId } = await context.params,
    site = getSiteById(siteId);
  return hasOrganizationScope(scope) &&
    site &&
    isRecordInScope({
      recordOrganizationId: site.organizationId,
      recordSiteId: site.siteId,
      scope,
    })
    ? site
    : null;
}
const receipts = () =>
  listDesignBuildPublicationReceipts().map(
    summarizeDesignBuildPublicationReceipt,
  );
export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context);
  if (!site)
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  return NextResponse.json({
    operation: DESIGN_BUILD_PUBLICATION_OPERATION,
    objectId: 14,
    approvedRevision: DESIGN_BUILD_APPROVED_REVISION,
    approvedHash: DESIGN_BUILD_APPROVED_HASH,
    receipts: receipts(),
    mutationPerformed: false,
  });
}
export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:manage_integrations");
  if (!auth.ok)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context);
  if (!site)
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as null | {
    confirm?: string;
    objectId?: number;
    revision?: number;
    candidateHash?: string;
    receiptId?: string;
    visual?: {
      certificationId: string;
      authority: "ACTUAL_PUBLIC_HOST_RENDER";
      viewports: DesignBuildViewport[];
      brokenInternalLinks: number;
      devLinks: number;
      previewLinks: number;
      overflowMaskUsed: false;
      claimSafety: "PASS";
      unsupportedClaims: number;
    };
  };
  if (
    !body ||
    body.objectId !== 14 ||
    body.revision !== 119 ||
    body.candidateHash !== DESIGN_BUILD_APPROVED_HASH
  )
    return NextResponse.json(
      { error: "Exact object 14 candidate authority required." },
      { status: 403 },
    );
  try {
    if (body.confirm === "PUBLISH_EXACT_REPAIRED_DESIGN_BUILD_CANDIDATE_V2")
      return NextResponse.json({
        receipt: summarizeDesignBuildPublicationReceipt(
          await publishDesignBuild(site),
        ),
        publicationMutation: true,
      });
    if (body.confirm === "RECOVER_EXACT_REPAIRED_DESIGN_BUILD_PUBLICATION_V2")
      return NextResponse.json({
        receipt: summarizeDesignBuildPublicationReceipt(
          await recoverDesignBuildPublication(site),
        ),
        publicationMutation: false,
      });
    if (
      body.confirm === "CERTIFY_EXACT_REPAIRED_DESIGN_BUILD_PUBLIC_RENDER_V2" &&
      body.receiptId &&
      body.visual
    )
      return NextResponse.json({
        receipt: summarizeDesignBuildPublicationReceipt(
          await certifyDesignBuild(site, body.receiptId, body.visual),
        ),
        publicationMutation: false,
      });
    return NextResponse.json(
      {
        error:
          "Exact publication, recovery, or certification confirmation required.",
      },
      { status: 400 },
    );
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "DESIGN_BUILD_PUBLICATION_FAILED",
        receipts: receipts(),
      },
      { status: 409 },
    );
  }
}
