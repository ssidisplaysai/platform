import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import {
  getProductMediaAuthorityContent,
  OUTDOOR_DIGITAL_SPHERE_ORGANIZATION_ID,
  OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID,
  OUTDOOR_DIGITAL_SPHERE_SITE_ID,
} from "@/modules/glw/product-media-authority";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ productId: string; mediaAuthorityId: string }> }) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { productId, mediaAuthorityId } = await context.params;
  const scope = resolveRequestScope(request);
  if (productId !== OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID || scope.organizationId !== OUTDOOR_DIGITAL_SPHERE_ORGANIZATION_ID || scope.siteId !== OUTDOOR_DIGITAL_SPHERE_SITE_ID) {
    return NextResponse.json({ error: "Product media authority not found in scope." }, { status: 404 });
  }
  const content = getProductMediaAuthorityContent({ mediaAuthorityId, organizationId: OUTDOOR_DIGITAL_SPHERE_ORGANIZATION_ID, siteId: OUTDOOR_DIGITAL_SPHERE_SITE_ID, productId });
  if (!content) return NextResponse.json({ error: "Product media authority not found." }, { status: 404 });
  return new NextResponse(Uint8Array.from(content.bytes), { headers: { "Content-Type": content.mimeType, "Cache-Control": "private, no-store", ETag: `\"${content.hash}\"` } });
}