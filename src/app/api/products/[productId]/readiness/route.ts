import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  isRecordInScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { recordProductActivity } from "@/modules/foundation/product-audit";
import { evaluateProductReadiness } from "@/modules/foundation/product-readiness";
import { getProductById } from "@/modules/foundation/product-repository";

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "products:evaluate_readiness");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { productId } = await context.params;
  const product = getProductById(productId);

  if (
    !product ||
    !isRecordInScope({
      recordOrganizationId: product.organizationId,
      recordSiteId: product.primarySiteId,
      scope,
    })
  ) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const readiness = evaluateProductReadiness({
    product,
    requiredPermission: "products:evaluate_readiness",
    permissions: resolvePermissions(auth.roles),
  });

  recordProductActivity({
    productId: product.productId,
    organizationId: product.organizationId,
    type: "product_readiness_evaluated",
    actor: "api",
    summary: `Product readiness evaluated with status ${readiness.status}.`,
  });

  return NextResponse.json({ readiness });
}
