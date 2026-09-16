import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestPrincipal, resolveRequestScope } from "@/modules/foundation/api-auth";
import {
  evaluateProductMediaReadiness,
  intakeProductMedia,
  listProductMediaAuthority,
  OUTDOOR_DIGITAL_SPHERE_ORGANIZATION_ID,
  OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID,
  OUTDOOR_DIGITAL_SPHERE_SITE_ID,
  PRODUCT_MEDIA_MAX_BYTES,
  reviewProductMedia,
  type ProductMediaAuthorityClass,
  type ProductMediaSourceType,
} from "@/modules/glw/product-media-authority";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ productId: string }> };
const AUTHORITY_CLASSES = new Set<ProductMediaAuthorityClass>(["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"]);
const SOURCE_TYPES = new Set<ProductMediaSourceType>(["FACTORY_SUPPLIED", "OWNER_SUPPLIED", "OWNER_APPROVED_EXISTING", "GENESIS_GENERATED_CONTEXTUAL", "REFERENCE_ONLY", "UNVERIFIED"]);

function scopeAllowed(request: NextRequest, productId: string): boolean {
  const scope = resolveRequestScope(request);
  return productId === OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID
    && scope.organizationId === OUTDOOR_DIGITAL_SPHERE_ORGANIZATION_ID
    && scope.siteId === OUTDOOR_DIGITAL_SPHERE_SITE_ID;
}

function publicRecord(record: ReturnType<typeof listProductMediaAuthority>[number]) {
  return {
    ...record,
    contentBase64: undefined,
    contentUrl: `/api/glw/products/${encodeURIComponent(record.productId)}/media-authority/${encodeURIComponent(record.mediaAuthorityId)}/content?organizationId=${encodeURIComponent(record.organizationId)}&siteId=${encodeURIComponent(record.siteId)}`,
  };
}

function parseScopes(value: FormDataEntryValue | null): ProductMediaAuthorityClass[] {
  const parsed = JSON.parse(String(value ?? "[]")) as unknown;
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string" || !AUTHORITY_CLASSES.has(entry as ProductMediaAuthorityClass))) throw new Error("PRODUCT_MEDIA_USAGE_SCOPES_INVALID");
  return parsed as ProductMediaAuthorityClass[];
}

function result() {
  const records = listProductMediaAuthority({ organizationId: OUTDOOR_DIGITAL_SPHERE_ORGANIZATION_ID, siteId: OUTDOOR_DIGITAL_SPHERE_SITE_ID, productId: OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID });
  return {
    contract: "GENESIS_OUTDOOR_DIGITAL_SPHERE_PRODUCT_MEDIA_AUTHORITY_ONBOARDING_V1",
    productId: OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID,
    productName: "Outdoor Digital Sphere",
    records: records.map(publicRecord),
    readiness: evaluateProductMediaReadiness(records),
    forensic: {
      fingerprint: "17a758d06e06de66aac6832951bcc5d1cc5f4f063f37554a7c62d670a95463af",
      candidateMediaCount: 68,
      plausibleCandidateCount: 0,
      ownerReviewCandidateCount: 0,
      groups: { likelyActualProduct: 0, likelySphereInstallationContext: 0, likelyContextualApplication: 0, clearlyUnrelated: 68, insufficientProvenance: 0 },
      ownerReviewCandidates: [],
    },
    callerSuppliedRoleHeadersAuthorize: false,
    n8nExecutionCreated: false,
    generationAttempted: false,
    wordpressMutation: false,
  };
}

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { productId } = await context.params;
  if (!scopeAllowed(request, productId)) return NextResponse.json({ error: "Product media authority not found in scope." }, { status: 404 });
  return NextResponse.json(result());
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const principal = resolveRequestPrincipal(request);
  if (!principal) return NextResponse.json({ error: "Authenticated operator session is required." }, { status: 401 });
  const { productId } = await context.params;
  if (!scopeAllowed(request, productId)) return NextResponse.json({ error: "Product media authority not found in scope." }, { status: 404 });

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      if (form.get("action") !== "INTAKE_PRODUCT_MEDIA") throw new Error("PRODUCT_MEDIA_INTAKE_ACTION_REQUIRED");
      const file = form.get("file");
      const sourceType = String(form.get("sourceType") ?? "") as ProductMediaSourceType;
      const authorityClass = String(form.get("authorityClass") ?? "") as ProductMediaAuthorityClass;
      if (!(file instanceof File) || file.size > PRODUCT_MEDIA_MAX_BYTES || !SOURCE_TYPES.has(sourceType) || !AUTHORITY_CLASSES.has(authorityClass)) throw new Error("PRODUCT_MEDIA_INTAKE_INVALID");
      const record = await intakeProductMedia({
        organizationId: OUTDOOR_DIGITAL_SPHERE_ORGANIZATION_ID,
        siteId: OUTDOOR_DIGITAL_SPHERE_SITE_ID,
        productId,
        originalFilename: file.name,
        mimeType: file.type,
        bytes: Buffer.from(await file.arrayBuffer()),
        sourceType,
        sourceDescription: String(form.get("sourceDescription") ?? ""),
        provenance: String(form.get("provenance") ?? ""),
        authorityClass,
        usageScopes: parseScopes(form.get("usageScopes")),
        depictsActualProduct: form.get("depictsActualProduct") === "true",
        heroEligible: form.get("heroEligible") === "true",
        altTextAuthority: String(form.get("altTextAuthority") ?? ""),
        captionAuthority: String(form.get("captionAuthority") ?? ""),
      });
      return NextResponse.json({ ...result(), record: publicRecord(record), ownerApprovalPersisted: false }, { status: 201 });
    }

    const body = await request.json().catch(() => null) as {
      action?: string;
      mediaAuthorityId?: string;
      decision?: "APPROVE" | "REJECT";
      authorityClass?: ProductMediaAuthorityClass;
      usageScopes?: ProductMediaAuthorityClass[];
      depictsActualProduct?: boolean;
      heroEligible?: boolean;
      altTextAuthority?: string;
      captionAuthority?: string;
    } | null;
    if (body?.action !== "REVIEW_PRODUCT_MEDIA" || !body.mediaAuthorityId || !body.decision || !body.authorityClass || !AUTHORITY_CLASSES.has(body.authorityClass) || !Array.isArray(body.usageScopes)) throw new Error("PRODUCT_MEDIA_REVIEW_ACTION_REQUIRED");
    const record = reviewProductMedia({
      organizationId: OUTDOOR_DIGITAL_SPHERE_ORGANIZATION_ID,
      siteId: OUTDOOR_DIGITAL_SPHERE_SITE_ID,
      productId,
      mediaAuthorityId: body.mediaAuthorityId,
      decision: body.decision,
      authorityClass: body.authorityClass,
      usageScopes: body.usageScopes,
      depictsActualProduct: body.depictsActualProduct === true,
      heroEligible: body.heroEligible === true,
      altTextAuthority: body.altTextAuthority ?? "",
      captionAuthority: body.captionAuthority ?? "",
      principalId: principal.principalId,
      sessionId: principal.sessionId,
    });
    return NextResponse.json({ ...result(), record: publicRecord(record), ownerApprovalPersisted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PRODUCT_MEDIA_AUTHORITY_FAILED", downstreamSideEffectsPerformed: false }, { status: 409 });
  }
}