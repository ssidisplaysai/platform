import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/modules/foundation/api-auth";
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
  if (!isAuthorized(request, "products:evaluate_readiness")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { productId } = await context.params;
  const product = getProductById(productId);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const roleHeader = request.headers.get("x-gcp-roles") ?? "ops_manager";
  const roles = roleHeader.split(",").map((value) => value.trim()).filter((value) => value.length > 0) as Array<
    "platform_admin" | "ops_manager" | "company_operator" | "analyst" | "viewer"
  >;

  const readiness = evaluateProductReadiness({
    product,
    requiredPermission: "products:evaluate_readiness",
    permissions: resolvePermissions(roles),
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
